/**
 * Shared with AdminAuditLogPage.jsx (the full log) and
 * AdminOverviewPage.jsx's "Recent Activity" widget (a small slice of
 * the same data, via the same adminListAuditLog function) — extracted
 * so the action-label vocabulary and timestamp formatting exist in
 * exactly one place instead of being copy-pasted into the new widget.
 */
export const ACTION_LABELS = {
  verification_approved: 'Verification approved',
  verification_rejected: 'Verification rejected',
  verification_auto_resolved: 'Stale verification request auto-resolved',
  college_request_approved: 'College request approved',
  college_request_rejected: 'College request rejected',
  user_verified_manual: 'User manually verified',
  user_unverified_manual: 'User verification revoked',
  resolved: 'Report resolved',
  dismissed: 'Report dismissed',
  content_removed: 'Content removed',
  restricted: 'User restricted',
  suspended: 'User suspended',
  lostfound_removed: 'Lost & Found listing removed',
  lostfound_restored: 'Lost & Found listing restored',
  product_hidden: 'Marketplace listing hidden',
  product_unhidden: 'Marketplace listing unhidden',
  notification_sent: 'Notification sent',
  announcement_pinned: 'Announcement pinned',
  announcement_unpinned: 'Announcement unpinned',
  announcement_removed: 'Announcement removed',
  user_restored: 'User restored to good standing',
  community_member_removed: 'Community member removed',
  community_member_banned: 'Community member banned',
  community_member_unbanned: 'Community member unbanned'
}

export function formatAuditWhen(ts) {
  if (!ts?._seconds && !ts?.seconds) return ''
  const ms = (ts._seconds ?? ts.seconds) * 1000
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
