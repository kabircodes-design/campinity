/**
 * CAMPINITY NOTICE BOARD — admin-published notices shown on each user's
 * own Profile.
 *
 * Data model (two collections, so recipient lists never reach users):
 *
 *  noticeGroups/{groupId}   ADMIN-ONLY master record (no client rule ->
 *                           catch-all deny). Full content + targeting,
 *                           including any list of specific recipient uids,
 *                           status (draft | published | archived), audit fields.
 *
 *  notices/{deliveryId}     What users read. Published only. One delivery
 *                           per audience key:
 *                             everyone          -> 1 doc, audienceKeys ['all']
 *                             a campus          -> 1 doc, audienceKeys ['college:<id>']
 *                             specific users    -> 1 doc PER user, audienceKeys ['uid:<uid>']
 *                           so no user can ever see who else received a
 *                           personal notice. Delivery ids are deterministic
 *                           (`<groupId>__all`, `<groupId>__c_<collegeId>`,
 *                           `<groupId>__u_<uid>`) so re-publishing an edit
 *                           overwrites in place; stale deliveries are deleted.
 *                           Firestore rules let a signed-in user read a
 *                           delivery only if its audienceKeys contain 'all',
 *                           'uid:<their uid>' or 'college:<their collegeId>'.
 *
 *  users/{uid}/noticeReads/{groupId}  per-user read marker (owner-only rule).
 *
 * Scheduling: deliveries carry publishAt and expiresAt (never null — "never
 * expires" is stored as NEVER_EXPIRES_MS). firestore.rules only lets a user
 * read a delivery inside its [publishAt, expiresAt) window, so scheduled
 * notices can't be fetched early and expired ones can't be fetched at all.
 *
 * Every endpoint requires a valid, device-signed admin session
 * (requireValidAdminSession) and writes an audit entry.
 */
const crypto = require('crypto')

/** Year 9999 — stored on deliveries whose notice never expires. */
const NEVER_EXPIRES_MS = Date.UTC(9999, 0, 1)
/**
 * "Publish immediately" is stored slightly in the past. The app's board query
 * asks for publishAt <= (device now - 60s) to absorb clock skew (the read rule
 * needs a provable bound), so a notice stamped exactly "now" would otherwise
 * take a minute to appear.
 */
const IMMEDIATE_BACKDATE_MS = 2 * 60 * 1000
const LIMITS = { title: 90, body: 2000, actionLabel: 30, actionUrl: 500, maxUsers: 100, imageBytes: 1.5 * 1024 * 1024 }
const PRIORITIES = ['normal', 'important', 'urgent']
const STATUSES = ['draft', 'published', 'archived']
const IMAGE_TYPES = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  'image/webp': { ext: 'webp', magic: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' }
}

/** https:// URL, or an in-app path like /communities. Returns the cleaned value or throws. */
function cleanActionUrl(raw, HttpsError) {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw !== 'string' || raw.length > LIMITS.actionUrl) throw new HttpsError('invalid-argument', 'Action link is too long.')
  const v = raw.trim()
  if (/^\/(?!\/)[A-Za-z0-9\-._~/?#[\]@!$&'()*+,;=%]*$/.test(v)) return v
  let u
  try {
    u = new URL(v)
  } catch {
    throw new HttpsError('invalid-argument', 'Action link must be an https:// link or an in-app path like /communities.')
  }
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) {
    throw new HttpsError('invalid-argument', 'Action link must be an https:// link or an in-app path like /communities.')
  }
  return u.toString()
}

function cleanImageUrl(raw, HttpsError) {
  if (!raw) return null
  if (typeof raw !== 'string' || raw.length > 1000) throw new HttpsError('invalid-argument', 'Invalid image.')
  let u
  try {
    u = new URL(raw)
  } catch {
    throw new HttpsError('invalid-argument', 'Invalid image.')
  }
  // Only images uploaded through adminUploadNoticeImage (Firebase Storage) are accepted.
  if (u.protocol !== 'https:' || u.hostname !== 'firebasestorage.googleapis.com' || !/\/o\/notices%2F/.test(u.pathname)) {
    throw new HttpsError('invalid-argument', 'Upload the banner image with the uploader.')
  }
  return u.toString()
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')

function makeNoticeHandlers({ db, admin, requireValidAdminSession, HttpsError, logAdminAction, bucket, now = () => Date.now() }) {
  const { Timestamp, FieldValue } = admin.firestore
  const groups = () => db().collection('noticeGroups')
  const deliveries = () => db().collection('notices')
  const ms = (t) => (t && t.toMillis ? t.toMillis() : null)
  const fail = (code, msg) => new HttpsError(code, msg)

  /** Validates & normalises the editor payload into a master record (without status/audit fields). */
  /** keepPublishAtMs: an already-live notice keeps its original publish time when edited with "immediately". */
  async function normalise(input, keepPublishAtMs = null) {
    const title = str(input.title)
    const body = str(input.body)
    if (!title) throw fail('invalid-argument', 'Title is required.')
    if (title.length > LIMITS.title) throw fail('invalid-argument', `Title must be ${LIMITS.title} characters or fewer.`)
    if (!body) throw fail('invalid-argument', 'Message is required.')
    if (body.length > LIMITS.body) throw fail('invalid-argument', `Message must be ${LIMITS.body} characters or fewer.`)
    const priority = PRIORITIES.includes(input.priority) ? input.priority : 'normal'
    const actionUrl = cleanActionUrl(input.actionUrl, HttpsError)
    const actionLabel = actionUrl ? str(input.actionLabel).slice(0, LIMITS.actionLabel) || 'Open' : null
    const imageUrl = cleanImageUrl(input.imageUrl, HttpsError)

    const publishAtMs = input.publishAtMs ? Number(input.publishAtMs) : keepPublishAtMs || now() - IMMEDIATE_BACKDATE_MS
    if (!Number.isFinite(publishAtMs)) throw fail('invalid-argument', 'Invalid publish time.')
    let expiresAtMs = input.expiresAtMs ? Number(input.expiresAtMs) : null
    if (expiresAtMs !== null && (!Number.isFinite(expiresAtMs) || expiresAtMs <= publishAtMs)) throw fail('invalid-argument', 'Expiry must be after the publish time.')

    const a = input.audience || {}
    let audience
    if (a.type === 'all') audience = { type: 'all' }
    else if (a.type === 'college') {
      const collegeId = str(a.collegeId)
      if (!collegeId) throw fail('invalid-argument', 'Choose a campus.')
      const c = await db().collection('colleges').doc(collegeId).get()
      if (!c.exists) throw fail('invalid-argument', 'That campus does not exist.')
      audience = { type: 'college', collegeId, collegeName: c.data().name || '' }
    } else if (a.type === 'users') {
      const uids = [...new Set((Array.isArray(a.uids) ? a.uids : []).filter((u) => typeof u === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(u)))]
      if (!uids.length) throw fail('invalid-argument', 'Choose at least one user.')
      if (uids.length > LIMITS.maxUsers) throw fail('invalid-argument', `At most ${LIMITS.maxUsers} individual users per notice.`)
      const snaps = await db().getAll(...uids.map((u) => db().collection('users').doc(u)))
      const missing = snaps.filter((s) => !s.exists).map((s) => s.id)
      if (missing.length) throw fail('invalid-argument', `${missing.length} selected user(s) no longer exist.`)
      audience = { type: 'users', uids, labels: snaps.map((s) => ({ uid: s.id, name: s.data().displayName || '', username: s.data().username || '' })) }
    } else throw fail('invalid-argument', 'Choose who should see this notice.')

    return {
      title,
      body,
      priority,
      pinned: input.pinned === true,
      actionUrl,
      actionLabel,
      imageUrl,
      publishAt: Timestamp.fromMillis(publishAtMs),
      expiresAt: expiresAtMs ? Timestamp.fromMillis(expiresAtMs) : null,
      audience
    }
  }

  const deliveryIdsFor = (groupId, audience) =>
    audience.type === 'all' ? [[`${groupId}__all`, 'all']] : audience.type === 'college' ? [[`${groupId}__c_${audience.collegeId}`, `college:${audience.collegeId}`]] : audience.uids.map((u) => [`${groupId}__u_${u}`, `uid:${u}`])

  /** Makes deliveries match the master: writes current ones, deletes stale ones. */
  async function syncDeliveries(groupId, master) {
    const existing = await deliveries().where('groupId', '==', groupId).get()
    const wanted = master.status === 'published' ? deliveryIdsFor(groupId, master.audience) : []
    const wantedIds = new Set(wanted.map(([id]) => id))
    const writes = []
    for (const d of existing.docs) if (!wantedIds.has(d.id)) writes.push((b) => b.delete(d.ref))
    for (const [id, key] of wanted) {
      writes.push((b) =>
        b.set(deliveries().doc(id), {
          groupId,
          title: master.title,
          body: master.body,
          priority: master.priority,
          pinned: master.pinned,
          imageUrl: master.imageUrl || null,
          actionUrl: master.actionUrl || null,
          actionLabel: master.actionLabel || null,
          audienceKeys: [key],
          publishAt: master.publishAt,
          // Never null on deliveries: the read rule compares expiresAt to request.time.
          expiresAt: master.expiresAt || Timestamp.fromMillis(NEVER_EXPIRES_MS),
          updatedAt: master.contentUpdatedAt || master.updatedAt
        })
      )
    }
    for (let i = 0; i < writes.length; i += 400) {
      const batch = db().batch()
      writes.slice(i, i + 400).forEach((w) => w(batch))
      await batch.commit()
    }
    return wanted.length
  }

  const publicView = (id, d) => ({
    id,
    title: d.title,
    body: d.body,
    priority: d.priority,
    pinned: d.pinned === true,
    actionUrl: d.actionUrl || null,
    actionLabel: d.actionLabel || null,
    imageUrl: d.imageUrl || null,
    status: d.status,
    audience: d.audience,
    publishAtMs: ms(d.publishAt),
    expiresAtMs: ms(d.expiresAt),
    createdAtMs: ms(d.createdAt),
    updatedAtMs: ms(d.updatedAt),
    deliveryCount: d.deliveryCount || 0
  })

  async function listNotices(request) {
    const { sessionToken, status, cursor } = request.data || {}
    await requireValidAdminSession(sessionToken, request)
    let q = groups().orderBy('updatedAt', 'desc').limit(25)
    if (STATUSES.includes(status)) q = groups().where('status', '==', status).orderBy('updatedAt', 'desc').limit(25)
    if (typeof cursor === 'string' && cursor) {
      const after = await groups().doc(cursor).get()
      if (after.exists) q = q.startAfter(after)
    }
    const snap = await q.get()
    return { notices: snap.docs.map((d) => publicView(d.id, d.data())), nextCursor: snap.size === 25 ? snap.docs[snap.docs.length - 1].id : null }
  }

  /** Create (no id) or edit (id). `publish: true` publishes; otherwise keeps the current status (new -> draft). */
  async function saveNotice(request) {
    const { sessionToken, id, notice, publish } = request.data || {}
    const session = await requireValidAdminSession(sessionToken, request)
    const ref = id ? groups().doc(String(id)) : groups().doc()
    const prev = id ? await ref.get() : null
    if (id && !prev.exists) throw fail('not-found', 'Notice not found.')
    const prevData = prev && prev.exists ? prev.data() : null
    const prevLiveSince = prevData && prevData.status === 'published' && ms(prevData.publishAt) <= now() ? ms(prevData.publishAt) : null
    const fields = await normalise(notice || {}, prevLiveSince)
    if (prevData && prevData.status === 'archived' && !publish) throw fail('failed-precondition', 'Restore or re-publish an archived notice to edit it.')
    const status = publish ? 'published' : prevData ? prevData.status : 'draft'
    const ts = Timestamp.fromMillis(now())
    const master = {
      ...fields,
      status,
      updatedAt: ts,
      contentUpdatedAt: ts,
      createdAt: prevData ? prevData.createdAt : ts,
      createdByUid: prevData ? prevData.createdByUid : session.createdByUid,
      updatedByUid: session.createdByUid
    }
    master.deliveryCount = await syncDeliveries(ref.id, master)
    await ref.set(master)
    await logAdminAction({
      adminUid: session.createdByUid,
      action: !prevData ? (publish ? 'notice_published' : 'notice_drafted') : publish && prevData.status !== 'published' ? 'notice_published' : 'notice_edited',
      targetType: 'notice',
      targetId: ref.id,
      reason: `${fields.audience.type}${fields.audience.type === 'users' ? `:${fields.audience.uids.length}` : ''} · ${fields.title.slice(0, 60)}`
    })
    return { ok: true, notice: publicView(ref.id, master) }
  }

  /** publish | archive | restore(→draft) | pin | unpin */
  async function setNoticeState(request) {
    const { sessionToken, id, action } = request.data || {}
    const session = await requireValidAdminSession(sessionToken, request)
    if (!['publish', 'archive', 'restore', 'pin', 'unpin'].includes(action)) throw fail('invalid-argument', 'Unknown action.')
    const ref = groups().doc(String(id || ''))
    const snap = await ref.get()
    if (!id || !snap.exists) throw fail('not-found', 'Notice not found.')
    const d = snap.data()
    const patch = { updatedAt: Timestamp.fromMillis(now()), updatedByUid: session.createdByUid }
    if (action === 'publish') {
      patch.status = 'published'
      // A draft written days ago shouldn't go live looking old: past publish times restart now.
      if (!(ms(d.publishAt) > now())) {
        patch.publishAt = Timestamp.fromMillis(now() - IMMEDIATE_BACKDATE_MS)
        if (d.expiresAt && ms(d.expiresAt) <= now()) throw fail('failed-precondition', 'This notice has already expired. Edit its expiry before publishing.')
      }
    }
    if (action === 'archive') patch.status = 'archived'
    if (action === 'restore') patch.status = 'draft'
    if (action === 'pin' || action === 'unpin') patch.pinned = action === 'pin'
    const next = { ...d, ...patch }
    patch.deliveryCount = await syncDeliveries(ref.id, next)
    await ref.update(patch)
    await logAdminAction({ adminUid: session.createdByUid, action: `notice_${action === 'restore' ? 'restored' : action === 'publish' ? 'published' : action === 'archive' ? 'archived' : action === 'pin' ? 'pinned' : 'unpinned'}`, targetType: 'notice', targetId: ref.id })
    return { ok: true, notice: publicView(ref.id, { ...next, deliveryCount: patch.deliveryCount }) }
  }

  /** Permanent delete: master + every delivery. (Archive is the reversible option.) */
  async function deleteNotice(request) {
    const { sessionToken, id } = request.data || {}
    const session = await requireValidAdminSession(sessionToken, request)
    const ref = groups().doc(String(id || ''))
    const snap = await ref.get()
    if (!id || !snap.exists) throw fail('not-found', 'Notice not found.')
    await syncDeliveries(ref.id, { ...snap.data(), status: 'deleted' })
    await ref.delete()
    await logAdminAction({ adminUid: session.createdByUid, action: 'notice_deleted', targetType: 'notice', targetId: ref.id, reason: (snap.data().title || '').slice(0, 60) })
    return { ok: true }
  }

  /** Validated banner upload (JPEG/PNG/WebP, ≤ 1.5 MB, checked by magic bytes). */
  async function uploadNoticeImage(request) {
    const { sessionToken, contentType, dataBase64 } = request.data || {}
    const session = await requireValidAdminSession(sessionToken, request)
    const type = IMAGE_TYPES[contentType]
    if (!type) throw fail('invalid-argument', 'Use a JPEG, PNG or WebP image.')
    if (typeof dataBase64 !== 'string' || dataBase64.length > Math.ceil((LIMITS.imageBytes * 4) / 3) + 8) throw fail('invalid-argument', 'Image must be 1.5 MB or smaller.')
    const buf = Buffer.from(dataBase64, 'base64')
    if (!buf.length || buf.length > LIMITS.imageBytes) throw fail('invalid-argument', 'Image must be 1.5 MB or smaller.')
    if (!type.magic(buf)) throw fail('invalid-argument', "The file doesn't look like the image type it claims to be.")
    const token = crypto.randomUUID()
    const path = `notices/${crypto.randomBytes(12).toString('hex')}.${type.ext}`
    const b = bucket()
    await b.file(path).save(buf, { contentType, resumable: false, metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token, uploadedByAdminUid: session.createdByUid } } })
    const url = `https://firebasestorage.googleapis.com/v0/b/${b.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
    return { ok: true, imageUrl: url }
  }

  return { listNotices, saveNotice, setNoticeState, deleteNotice, uploadNoticeImage, _internal: { cleanActionUrl: (v) => cleanActionUrl(v, HttpsError), cleanImageUrl: (v) => cleanImageUrl(v, HttpsError), deliveryIdsFor } }
}

module.exports = { makeNoticeHandlers, NOTICE_LIMITS: LIMITS, NEVER_EXPIRES_MS }
