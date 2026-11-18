/**
 * Admin Control Center — READ-ONLY server endpoints (no writes, ever).
 *
 * Every handler first passes the existing admin session check
 * (requireValidAdminSession → adminSession/tokens/items/{token}), the same
 * boundary every other admin function uses. Nothing here returns email
 * addresses, auth tokens, private subcollections or message content.
 *
 * Query design: only single-field ranges/orders, equality-only filters
 * (served by Firestore's automatic indexes), or composite indexes that
 * already exist in firestore.indexes.json — no new index is required.
 * Counts use aggregation queries (count()), which read index entries,
 * not documents. Anything that can't be measured reliably is returned as
 * null with a reason, never a guess.
 */
const DAY = 24 * 60 * 60 * 1000
const TREND_DAYS = 30
const FEED_PER_SOURCE = 6
const FEED_MAX = 30

// ---------- small helpers ----------
const toMs = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : typeof ts === 'number' ? ts : null)
const clip = (s, n) => (typeof s === 'string' ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : '')

/** Public-profile subset an admin needs. Never email, tokens or private fields. */
function safeUser(id, d, { includeActivity = true } = {}) {
  if (!d) return { uid: id, missing: true }
  return {
    uid: id,
    displayName: d.displayName || d.fullName || '',
    username: d.username || '',
    avatar: d.avatar || '',
    campusAvatarUrl: d.campusAvatarUrl || '',
    avatarMode: d.avatarMode || 'photo',
    collegeId: d.collegeId || null,
    course: d.course || '',
    year: d.year || '',
    verifiedCampus: d.verifiedCampus === true,
    verificationStatus: d.verificationStatus || null,
    moderationStatus: d.moderationStatus || 'active',
    profileCompleted: d.profileCompleted === true,
    createdAtMs: toMs(d.createdAt),
    // Respect "Show activity status": hidden users' activity isn't shown even to admins.
    lastActiveAtMs: includeActivity && d.activityStatusVisible !== false ? toMs(d.lastActiveAt) : null,
    activityHidden: d.activityStatusVisible === false,
    followersCount: typeof d.followersCount === 'number' ? d.followersCount : null,
    followingCount: typeof d.followingCount === 'number' ? d.followingCount : null
  }
}

async function safeCount(query) {
  try {
    const snap = await query.count().get()
    return snap.data().count
  } catch (err) {
    return null
  }
}

/** Splits [now - days, now) into daily UTC buckets and counts docs per bucket. */
async function dailyCounts(db, Timestamp, collectionName, field, nowMs, days = TREND_DAYS, extra = (q) => q) {
  const todayStart = Math.floor(nowMs / DAY) * DAY
  const starts = Array.from({ length: days }, (_, i) => todayStart - (days - 1 - i) * DAY)
  const counts = await Promise.all(
    starts.map((s) =>
      safeCount(
        extra(db.collection(collectionName))
          .where(field, '>=', Timestamp.fromMillis(s))
          .where(field, '<', Timestamp.fromMillis(s + DAY))
      )
    )
  )
  return starts.map((s, i) => ({ dayStartMs: s, count: counts[i] }))
}

function makeAdminControlHandlers({ db, admin, requireValidAdminSession, HttpsError, now = () => Date.now(), fetchImpl = globalThis.fetch }) {
  const { Timestamp, FieldPath } = admin.firestore
  const since = (ms) => Timestamp.fromMillis(now() - ms)

  // ---------------------------------------------------------------- dashboard
  async function getDashboard(request) {
    await requireValidAdminSession((request.data || {}).sessionToken, request)
    const d = db()
    const nowMs = now()

    const [
      totalUsers, newUsers24h, newUsers7d, newUsers30d,
      active24h, active7d, active30d,
      totalPosts, totalCommunities, totalClubs, totalProducts, activeLostFound,
      totalMessages,
      pendingReports, pendingVerifications, pendingAchievements, pendingCollegeRequests,
      suspendedUsers
    ] = await Promise.all([
      safeCount(d.collection('users')),
      safeCount(d.collection('users').where('createdAt', '>=', since(DAY))),
      safeCount(d.collection('users').where('createdAt', '>=', since(7 * DAY))),
      safeCount(d.collection('users').where('createdAt', '>=', since(30 * DAY))),
      safeCount(d.collection('users').where('lastActiveAt', '>=', since(DAY))),
      safeCount(d.collection('users').where('lastActiveAt', '>=', since(7 * DAY))),
      safeCount(d.collection('users').where('lastActiveAt', '>=', since(30 * DAY))),
      safeCount(d.collection('posts')),
      safeCount(d.collection('communities')),
      safeCount(d.collection('communities').where('type', '==', 'official_club')),
      safeCount(d.collection('products')),
      safeCount(d.collection('lostFound').where('status', '==', 'active')),
      safeCount(d.collectionGroup('messages')),
      safeCount(d.collection('reports').where('status', '==', 'pending')),
      safeCount(d.collection('verificationRequests').where('status', '==', 'pending')),
      // Same shape as adminListAchievementSubmissions (status + submittedAt
      // desc): a plain status filter on this collection group has no index
      // in production (verified with a read-only probe), this one does.
      safeCount(d.collectionGroup('achievementSubmissions').where('status', '==', 'pending').orderBy('submittedAt', 'desc')),
      safeCount(d.collection('collegeRequests').where('status', '==', 'pending')),
      safeCount(d.collection('users').where('moderationStatus', '==', 'suspended'))
    ])

    const [usersTrend, postsTrend, communitiesTrend, productsTrend] = await Promise.all([
      dailyCounts(d, Timestamp, 'users', 'createdAt', nowMs),
      dailyCounts(d, Timestamp, 'posts', 'createdAt', nowMs),
      dailyCounts(d, Timestamp, 'communities', 'createdAt', nowMs),
      dailyCounts(d, Timestamp, 'products', 'createdAt', nowMs)
    ])

    // Oldest pending item age, from the newest-first queue (existing
    // status+createdAt indexes). If the queue is longer than the page, the
    // true oldest may be older — reported as `atLeast`.
    async function oldestPending(colRef, field) {
      try {
        const snap = await colRef.where('status', '==', 'pending').orderBy(field, 'desc').limit(200).get()
        if (snap.empty) return { ageMs: 0, atLeast: false }
        const last = snap.docs[snap.docs.length - 1].data()
        const ms = toMs(last[field])
        return { ageMs: ms ? nowMs - ms : null, atLeast: snap.size === 200 }
      } catch {
        return null
      }
    }
    const [oldestReport, oldestVerification] = await Promise.all([
      oldestPending(d.collection('reports'), 'createdAt'),
      oldestPending(d.collection('verificationRequests'), 'createdAt')
    ])

    const feed = await activityFeed(d)
    const alerts = buildAlerts({ pendingReports, pendingVerifications, pendingAchievements, pendingCollegeRequests, oldestReport, oldestVerification, newUsers24h, newUsers7d })

    return {
      generatedAtMs: nowMs,
      overview: {
        totalUsers, newUsers24h, newUsers7d, newUsers30d,
        active24h, active7d, active30d,
        totalPosts, totalCommunities, totalClubs, totalProducts, activeLostFound,
        totalMessages,
        pendingReports, pendingVerifications, pendingAchievements, pendingCollegeRequests,
        suspendedUsers
      },
      notes: {
        activity: 'Active users = last app heartbeat within the window. Users who hide their activity status are not counted.',
        messages: 'Total chat messages (count only; no message content is read).',
        trendsTimezone: 'Daily buckets are UTC days.'
      },
      trends: { users: usersTrend, posts: postsTrend, communities: communitiesTrend, products: productsTrend },
      oldestPending: { reports: oldestReport, verifications: oldestVerification },
      feed,
      alerts
    }
  }

  async function activityFeed(d) {
    const latest = (q) => q.orderBy('createdAt', 'desc').limit(FEED_PER_SOURCE).get().catch(() => ({ docs: [] }))
    const [users, posts, communities, products, reports, actions, verifications] = await Promise.all([
      latest(d.collection('users')),
      d.collection('posts').where('visibility', '==', 'public').orderBy('createdAt', 'desc').limit(FEED_PER_SOURCE).get().catch(() => ({ docs: [] })),
      latest(d.collection('communities')),
      latest(d.collection('products')),
      latest(d.collection('reports')),
      latest(d.collection('moderationActions')),
      latest(d.collection('verificationRequests'))
    ])
    const ev = []
    users.docs.forEach((x) => {
      const u = x.data()
      ev.push({ type: 'user_registered', id: x.id, atMs: toMs(u.createdAt), title: u.displayName || u.username || 'New user', subtitle: u.username ? `@${u.username}` : '', userId: x.id })
    })
    posts.docs.forEach((x) => {
      const p = x.data()
      ev.push({ type: 'post_created', id: x.id, atMs: toMs(p.createdAt), title: p.isAnonymous ? 'Anonymous post' : p.displayName || 'Post', subtitle: clip(p.text || (p.image ? '[photo]' : ''), 90), userId: p.isAnonymous ? null : p.userId || null })
    })
    communities.docs.forEach((x) => {
      const c = x.data()
      ev.push({ type: c.type === 'official_club' ? 'club_created' : 'community_created', id: x.id, atMs: toMs(c.createdAt), title: c.name || 'Community', subtitle: c.privacy === 'private' ? 'Private' : 'Public', userId: c.createdBy || c.ownerId || null })
    })
    products.docs.forEach((x) => {
      const p = x.data()
      ev.push({ type: 'listing_created', id: x.id, atMs: toMs(p.createdAt), title: p.name || 'Listing', subtitle: [p.sellerName, typeof p.price === 'number' ? `₹${p.price}` : null].filter(Boolean).join(' · '), userId: p.sellerId || null })
    })
    reports.docs.forEach((x) => {
      const r = x.data()
      ev.push({ type: 'report_submitted', id: x.id, atMs: toMs(r.createdAt), title: `Report: ${r.reason || 'unspecified'}`, subtitle: `${r.targetType || 'content'} · ${r.status || 'pending'}`, userId: null })
    })
    actions.docs.forEach((x) => {
      const a = x.data()
      ev.push({ type: 'moderation_action', id: x.id, atMs: toMs(a.createdAt), title: a.action || 'Admin action', subtitle: [a.targetType, a.reason].filter(Boolean).join(' · '), userId: a.targetUid || null })
    })
    verifications.docs.forEach((x) => {
      const v = x.data()
      ev.push({ type: 'verification_submitted', id: x.id, atMs: toMs(v.createdAt), title: 'Verification request', subtitle: v.status || 'pending', userId: v.uid || null })
    })
    return ev.filter((e) => e.atMs).sort((a, b) => b.atMs - a.atMs).slice(0, FEED_MAX)
  }

  function buildAlerts({ pendingReports, pendingVerifications, pendingAchievements, pendingCollegeRequests, oldestReport, oldestVerification, newUsers24h, newUsers7d }) {
    const alerts = []
    const add = (level, key, title, detail, section) => alerts.push({ level, key, title, detail, section })
    if (pendingReports === null) add('warning', 'reports-unknown', "Couldn't read the report queue", 'The pending-report count could not be loaded.', 'reports')
    else if (pendingReports >= 25) add('critical', 'reports-backlog', `${pendingReports} reports waiting`, 'The report backlog is large.', 'reports')
    else if (pendingReports >= 10) add('warning', 'reports-backlog', `${pendingReports} reports waiting`, 'The report backlog is growing.', 'reports')
    if (oldestReport && oldestReport.ageMs > 2 * DAY) {
      add('warning', 'reports-age', 'Reports waiting over 2 days', `Oldest pending report is ${oldestReport.atLeast ? 'at least ' : ''}${Math.floor(oldestReport.ageMs / DAY)} days old.`, 'reports')
    }
    if (pendingVerifications >= 10) add('warning', 'verification-backlog', `${pendingVerifications} verification requests waiting`, 'Students are waiting for campus verification.', 'photo-verification')
    if (oldestVerification && oldestVerification.ageMs > 3 * DAY) {
      add('warning', 'verification-age', 'Verification waiting over 3 days', `Oldest request is ${oldestVerification.atLeast ? 'at least ' : ''}${Math.floor(oldestVerification.ageMs / DAY)} days old.`, 'photo-verification')
    }
    if (pendingAchievements >= 10) add('info', 'achievements-backlog', `${pendingAchievements} achievements to review`, 'Achievement submissions are queueing up.', 'achievement-verification')
    if (pendingCollegeRequests >= 5) add('info', 'colleges-backlog', `${pendingCollegeRequests} college requests`, 'New colleges are waiting to be added.', 'college-requests')
    // Unusual signups: last 24h well above the 7-day daily average (real signal, simple rule).
    if (typeof newUsers24h === 'number' && typeof newUsers7d === 'number' && newUsers7d >= 14) {
      const avg = newUsers7d / 7
      if (newUsers24h >= Math.max(10, avg * 3)) add('info', 'signup-spike', 'Unusual sign-up spike', `${newUsers24h} sign-ups in 24h vs ~${avg.toFixed(1)}/day average this week.`, 'users')
    }
    return alerts
  }

  // ---------------------------------------------------------------- users
  async function searchUsers(request) {
    const { sessionToken, query: rawQuery, collegeId, verified, moderationStatus, pageSize, cursor } = request.data || {}
    await requireValidAdminSession(sessionToken, request)
    const d = db()
    const size = Math.min(Math.max(Number(pageSize) || 25, 1), 50)
    const q = typeof rawQuery === 'string' ? rawQuery.trim() : ''

    const passesFilters = (u) =>
      (!collegeId || u.collegeId === collegeId) &&
      (verified === undefined || verified === null || u.verifiedCampus === Boolean(verified)) &&
      (!moderationStatus || (moderationStatus === 'active' ? !u.moderationStatus || u.moderationStatus === 'active' : u.moderationStatus === moderationStatus))

    let docs = []
    let nextCursor = null
    let mode
    if (q) {
      mode = 'search'
      const lower = q.replace(/^@/, '').toLowerCase()
      const [byId, byUsername, byName] = await Promise.all([
        /^[A-Za-z0-9]{20,40}$/.test(q) ? d.collection('users').doc(q).get() : Promise.resolve(null),
        d.collection('users').where('username', '==', lower).limit(5).get(),
        d.collection('users').where('displayNameLower', '>=', lower).where('displayNameLower', '<=', `${lower}`).limit(50).get()
      ])
      const seen = new Map()
      if (byId && byId.exists) seen.set(byId.id, byId)
      byUsername.docs.forEach((x) => seen.set(x.id, x))
      byName.docs.forEach((x) => seen.set(x.id, x))
      docs = [...seen.values()].filter((x) => passesFilters(x.data())).slice(0, size)
    } else {
      mode = 'browse'
      let ref = d.collection('users')
      if (collegeId) ref = ref.where('collegeId', '==', collegeId)
      if (verified === true || verified === false) ref = ref.where('verifiedCampus', '==', verified)
      if (moderationStatus === 'suspended' || moderationStatus === 'restricted') ref = ref.where('moderationStatus', '==', moderationStatus)
      ref = ref.orderBy(FieldPath.documentId()).limit(size)
      if (typeof cursor === 'string' && cursor) ref = ref.startAfter(cursor)
      const snap = await ref.get()
      docs = snap.docs.filter((x) => passesFilters(x.data()))
      nextCursor = snap.size === size ? snap.docs[snap.docs.length - 1].id : null
    }

    const collegeIds = [...new Set(docs.map((x) => x.data().collegeId).filter(Boolean))]
    const colleges = collegeIds.length ? await d.getAll(...collegeIds.map((id) => d.collection('colleges').doc(id))) : []
    const collegeName = new Map(colleges.filter((c) => c.exists).map((c) => [c.id, c.data().name || '']))
    return {
      mode,
      users: docs.map((x) => ({ ...safeUser(x.id, x.data()), collegeName: collegeName.get(x.data().collegeId) || '' })),
      nextCursor
    }
  }

  async function getUserDetail(request) {
    const { sessionToken, uid } = request.data || {}
    await requireValidAdminSession(sessionToken, request)
    if (!uid || typeof uid !== 'string') throw new HttpsError('invalid-argument', 'Missing uid.')
    const d = db()
    const snap = await d.collection('users').doc(uid).get()
    if (!snap.exists) throw new HttpsError('not-found', 'This user does not exist.')
    const u = snap.data()

    const [collegeSnap, postCount, productCount, communitiesOwned, reportsFiledCount, reportsAgainst, actions, verifications, recentPosts] = await Promise.all([
      u.collegeId ? d.collection('colleges').doc(u.collegeId).get().catch(() => null) : Promise.resolve(null),
      safeCount(d.collection('posts').where('userId', '==', uid)),
      safeCount(d.collection('products').where('sellerId', '==', uid)),
      safeCount(d.collection('communities').where('ownerId', '==', uid)),
      safeCount(d.collection('reports').where('reporterUid', '==', uid)),
      d.collection('reports').where('targetOwnerUid', '==', uid).limit(50).get().catch(() => ({ docs: [] })),
      d.collection('moderationActions').where('targetUid', '==', uid).limit(50).get().catch(() => ({ docs: [] })),
      d.collection('verificationRequests').where('uid', '==', uid).limit(10).get().catch(() => ({ docs: [] })),
      d.collection('posts').where('userId', '==', uid).where('visibility', '==', 'public').orderBy('createdAt', 'desc').limit(5).get().catch(() => ({ docs: [] }))
    ])
    const byNewest = (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
    return {
      user: {
        ...safeUser(uid, u),
        bio: clip(u.bio || '', 300),
        collegeName: collegeSnap && collegeSnap.exists ? collegeSnap.data().name || '' : '',
        verificationMethod: u.verificationMethod || null
      },
      stats: { posts: postCount, listings: productCount, communitiesOwned, reportsFiled: reportsFiledCount, reportsAgainst: reportsAgainst.docs.length },
      reportsAgainst: reportsAgainst.docs
        .map((x) => ({ id: x.id, reason: x.data().reason || '', details: clip(x.data().details || '', 200), targetType: x.data().targetType || '', targetId: x.data().targetId || '', status: x.data().status || '', createdAtMs: toMs(x.data().createdAt) }))
        .sort(byNewest),
      moderationHistory: actions.docs
        .map((x) => ({ id: x.id, action: x.data().action || '', targetType: x.data().targetType || '', reason: x.data().reason || '', createdAtMs: toMs(x.data().createdAt) }))
        .sort(byNewest),
      verificationRequests: verifications.docs
        .map((x) => ({ id: x.id, status: x.data().status || '', createdAtMs: toMs(x.data().createdAt), reviewedAtMs: toMs(x.data().reviewedAt) }))
        .sort(byNewest),
      recentPosts: recentPosts.docs.map((x) => ({ id: x.id, text: clip(x.data().text || '', 160), hasImage: Boolean(x.data().image), createdAtMs: toMs(x.data().createdAt), likes: x.data().likesCount || 0, comments: x.data().commentsCount || 0 }))
    }
  }

  // ---------------------------------------------------------------- report context
  async function getReportContext(request) {
    const { sessionToken, reportId } = request.data || {}
    await requireValidAdminSession(sessionToken, request)
    if (!reportId || typeof reportId !== 'string') throw new HttpsError('invalid-argument', 'Missing reportId.')
    const d = db()
    const rSnap = await d.collection('reports').doc(reportId).get()
    if (!rSnap.exists) throw new HttpsError('not-found', 'This report no longer exists.')
    const r = rSnap.data()

    let target = { type: r.targetType, id: r.targetId, exists: false }
    try {
      if (r.targetType === 'post') {
        const p = await d.collection('posts').doc(r.targetId).get()
        if (p.exists) target = { type: 'post', id: p.id, exists: true, text: clip(p.data().text || '', 1000), imageUrl: p.data().image || null, authorUid: p.data().userId || null, visibility: p.data().visibility || 'public', createdAtMs: toMs(p.data().createdAt) }
      } else if (r.targetType === 'comment' && r.parentPostId) {
        const c = await d.collection('posts').doc(r.parentPostId).collection('comments').doc(r.targetId).get()
        if (c.exists) target = { type: 'comment', id: c.id, exists: true, text: clip(c.data().text || '', 1000), authorUid: c.data().userId || null, parentPostId: r.parentPostId, createdAtMs: toMs(c.data().createdAt) }
      } else if (r.targetType === 'story') {
        const s = await d.collection('stories').doc(r.targetId).get()
        if (s.exists) target = { type: 'story', id: s.id, exists: true, text: clip(s.data().text || s.data().caption || '', 500), imageUrl: s.data().mediaUrl || s.data().imageUrl || null, authorUid: s.data().userId || null, createdAtMs: toMs(s.data().createdAt) }
      } else if (r.targetType === 'product') {
        const p = await d.collection('products').doc(r.targetId).get()
        if (p.exists) target = { type: 'product', id: p.id, exists: true, text: clip(`${p.data().name || ''} — ${p.data().description || ''}`, 1000), imageUrl: p.data().imageUrl || null, authorUid: p.data().sellerId || null, createdAtMs: toMs(p.data().createdAt) }
      } else if (r.targetType === 'user' || r.targetType === 'profile') {
        target = { type: 'user', id: r.targetId, exists: true, authorUid: r.targetId }
      }
    } catch {
      // target stays exists:false — shown honestly as unavailable
    }
    const ownerUid = r.targetOwnerUid || target.authorUid || null
    const [reporterSnap, ownerSnap, sameTarget, sameOwner, history] = await Promise.all([
      r.reporterUid ? d.collection('users').doc(r.reporterUid).get().catch(() => null) : Promise.resolve(null),
      ownerUid ? d.collection('users').doc(ownerUid).get().catch(() => null) : Promise.resolve(null),
      r.targetId ? d.collection('reports').where('targetType', '==', r.targetType || '').where('targetId', '==', r.targetId).limit(50).get().catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] }),
      ownerUid ? d.collection('reports').where('targetOwnerUid', '==', ownerUid).limit(50).get().catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] }),
      r.targetId ? d.collection('moderationActions').where('targetId', '==', r.targetId).limit(30).get().catch(() => ({ docs: [] })) : Promise.resolve({ docs: [] })
    ])
    const brief = (x) => ({ id: x.id, reason: x.data().reason || '', status: x.data().status || '', targetType: x.data().targetType || '', createdAtMs: toMs(x.data().createdAt) })
    const byNewest = (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
    return {
      report: { id: rSnap.id, reason: r.reason || '', details: r.details || '', status: r.status || 'pending', targetType: r.targetType || '', targetId: r.targetId || '', createdAtMs: toMs(r.createdAt), reviewedAtMs: toMs(r.reviewedAt), moderationAction: r.moderationAction || null },
      target,
      // Reporter: identity only (name/username) — enough to spot abuse of reporting, nothing private.
      reporter: reporterSnap && reporterSnap.exists ? { uid: reporterSnap.id, displayName: reporterSnap.data().displayName || '', username: reporterSnap.data().username || '' } : null,
      owner: ownerSnap && ownerSnap.exists ? safeUser(ownerSnap.id, ownerSnap.data(), { includeActivity: false }) : null,
      sameTargetReports: sameTarget.docs.filter((x) => x.id !== rSnap.id).map(brief).sort(byNewest),
      sameOwnerReports: sameOwner.docs.filter((x) => x.id !== rSnap.id).map(brief).sort(byNewest),
      history: history.docs.map((x) => ({ id: x.id, action: x.data().action || '', reason: x.data().reason || '', createdAtMs: toMs(x.data().createdAt) })).sort(byNewest)
    }
  }

  // ---------------------------------------------------------------- system health
  /**
   * Real signals only: Cloud Logging entries for the deployed functions
   * (Cloud Run revisions) over the last 24h — error-level log entries and
   * HTTP request records (status + latency). If the logs can't be read
   * (missing permission, API error), returns available:false with the
   * reason — never a "healthy" verdict from missing data.
   */
  async function getSystemHealth(request) {
    await requireValidAdminSession((request.data || {}).sessionToken, request)
    const projectId = process.env.GCLOUD_PROJECT || (admin.app().options && admin.app().options.projectId)
    let token
    try {
      const credential = admin.app().options.credential || admin.credential.applicationDefault()
      token = (await credential.getAccessToken()).access_token
    } catch (err) {
      return { available: false, reason: 'No credentials to read Cloud Logging from this environment.' }
    }
    const sinceIso = new Date(now() - DAY).toISOString()
    const list = async (filter, pageSize) => {
      const res = await fetchImpl('https://logging.googleapis.com/v2/entries:list', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceNames: [`projects/${projectId}`], filter, orderBy: 'timestamp desc', pageSize })
      })
      if (!res.ok) {
        const reason = res.status === 403 ? 'The functions service account is not allowed to read logs (needs roles/logging.viewer).' : `Cloud Logging returned HTTP ${res.status}.`
        throw Object.assign(new Error(reason), { reason })
      }
      return (await res.json()).entries || []
    }
    let errors
    let requests
    try {
      ;[errors, requests] = await Promise.all([
        list(`resource.type="cloud_run_revision" AND severity>=ERROR AND timestamp>="${sinceIso}"`, 200),
        list(`resource.type="cloud_run_revision" AND httpRequest.status>0 AND timestamp>="${sinceIso}"`, 1000)
      ])
    } catch (err) {
      return { available: false, reason: err.reason || 'Could not read Cloud Logging.' }
    }

    const byFn = new Map()
    const fn = (name) => {
      if (!byFn.has(name)) byFn.set(name, { name, requests: 0, clientErrors: 0, serverErrors: 0, latenciesMs: [], errorLogs: 0, lastError: null })
      return byFn.get(name)
    }
    const latencyMs = (s) => (typeof s === 'string' && s.endsWith('s') ? Math.round(parseFloat(s) * 1000) : null)
    requests.forEach((e) => {
      const f = fn(e.resource.labels.service_name)
      const status = e.httpRequest && e.httpRequest.status
      f.requests++
      if (status >= 500) f.serverErrors++
      else if (status >= 400) f.clientErrors++
      const l = latencyMs(e.httpRequest && e.httpRequest.latency)
      if (l !== null) f.latenciesMs.push(l)
    })
    errors.forEach((e) => {
      const f = fn(e.resource.labels.service_name)
      f.errorLogs++
      if (!f.lastError) {
        const msg = typeof e.textPayload === 'string' ? e.textPayload : e.jsonPayload && (e.jsonPayload.message || e.jsonPayload.error) ? String(e.jsonPayload.message || e.jsonPayload.error) : ''
        f.lastError = { atMs: Date.parse(e.timestamp), message: clip(msg.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]'), 240) }
      }
    })
    const pct = (arr, p) => {
      if (!arr.length) return null
      const s = [...arr].sort((a, b) => a - b)
      return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
    }
    const functions = [...byFn.values()]
      .map(({ latenciesMs, ...f }) => ({ ...f, p50Ms: pct(latenciesMs, 50), p95Ms: pct(latenciesMs, 95) }))
      .sort((a, b) => b.serverErrors + b.errorLogs - (a.serverErrors + a.errorLogs) || b.requests - a.requests)
    return {
      available: true,
      windowHours: 24,
      sampled: { errorEntries: errors.length, requestEntries: requests.length, requestSampleCapped: requests.length >= 1000 },
      totals: {
        requests: functions.reduce((s, f) => s + f.requests, 0),
        serverErrors: functions.reduce((s, f) => s + f.serverErrors, 0),
        clientErrors: functions.reduce((s, f) => s + f.clientErrors, 0),
        errorLogs: errors.length
      },
      functions
    }
  }

  return { getDashboard, searchUsers, getUserDetail, getReportContext, getSystemHealth, _internal: { buildAlerts, safeUser, dailyCounts } }
}

module.exports = { makeAdminControlHandlers }
