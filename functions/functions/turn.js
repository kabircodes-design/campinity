/**
 * Short-lived TURN credentials (PREPARED — not deployed).
 *
 * Mints per-user Cloudflare Realtime TURN credentials so no permanent
 * TURN secret ever ships in the app. Secrets live only in Cloud Functions:
 *   CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
 *
 * Per-user rate limit: at most MAX_PER_WINDOW credential requests per
 * WINDOW_MS. The client asks once at sign-in and every 4 hours, so 10 per
 * hour is generous for real use while stopping a signed-in account from
 * minting credentials in a loop. Counted in turnRateLimits/{uid}, a
 * server-only collection (no client rule => default deny), inside a
 * transaction so concurrent calls can't slip past the limit.
 */
const TTL_SECONDS = 6 * 60 * 60
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 10

/** Pure: decides whether a request is allowed and the counter to store. */
function nextRateState(previous, nowMs) {
  const windowStart = previous && typeof previous.windowStartMs === 'number' ? previous.windowStartMs : 0
  const count = previous && typeof previous.count === 'number' ? previous.count : 0
  if (!windowStart || nowMs - windowStart >= WINDOW_MS) {
    return { allowed: true, state: { windowStartMs: nowMs, count: 1 } }
  }
  if (count >= MAX_PER_WINDOW) {
    return { allowed: false, retryAfterMs: windowStart + WINDOW_MS - nowMs, state: { windowStartMs: windowStart, count } }
  }
  return { allowed: true, state: { windowStartMs: windowStart, count: count + 1 } }
}

function makeTurnCredentialsHandler({ db, HttpsError, fetchImpl, getSecrets, now = () => Date.now() }) {
  return async (request) => {
    const uid = request.auth && request.auth.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in to place calls.')

    const { keyId, token } = getSecrets()
    if (!keyId || !token) throw new HttpsError('failed-precondition', 'TURN is not configured.')

    const limitRef = db.collection('turnRateLimits').doc(uid)
    const decision = await db.runTransaction(async (tx) => {
      const snap = await tx.get(limitRef)
      const result = nextRateState(snap.exists ? snap.data() : null, now())
      if (result.allowed) tx.set(limitRef, result.state)
      return result
    })
    if (!decision.allowed) {
      throw new HttpsError('resource-exhausted', 'Too many call setup requests. Try again later.', {
        retryAfterSeconds: Math.ceil(decision.retryAfterMs / 1000)
      })
    }

    const res = await fetchImpl(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_SECONDS })
      }
    )
    if (!res.ok) {
      console.error('TURN credential request failed', res.status)
      throw new HttpsError('unavailable', 'Could not get call relay credentials.')
    }
    const body = await res.json()
    const iceServers = Array.isArray(body.iceServers) ? body.iceServers : body.iceServers ? [body.iceServers] : []
    return { iceServers, ttlSeconds: TTL_SECONDS }
  }
}

module.exports = { makeTurnCredentialsHandler, nextRateState, TTL_SECONDS, WINDOW_MS, MAX_PER_WINDOW }
