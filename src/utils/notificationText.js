/**
 * Pure text/icon mapping for a notification — no Firebase calls, no
 * state, just notification data in, display strings out.
 *
 * All seven types below are now real — engagementService.js's
 * comment system creates every one of them (like, comment, follow,
 * mention, reply, comment_like, pin all have real creator functions
 * in notificationService.js). 'invite' remains display-ready but not
 * yet wired to a creator — no invite feature exists to trigger it.
 */

export const NOTIFICATION_ICONS = {
  like: 'Heart',
  comment: 'MessageCircle',
  follow: 'UserPlus',
  mention: 'AtSign',
  reply: 'CornerUpLeft',
  comment_like: 'Heart',
  pin: 'Pin',
  share: 'Share2',
  invite: 'Mail',
  announcement: 'Megaphone'
}

export function getNotificationText(notification) {
  const name = notification.actorName || 'Someone'

  switch (notification.type) {
    case 'like':
      return { lead: name, action: 'liked your post', preview: null }
    case 'comment':
      return {
        lead: name,
        action: 'commented',
        preview: notification.commentPreview || null
      }
    case 'follow':
      return { lead: name, action: 'started following you', preview: null }
    case 'mention':
      return { lead: name, action: 'mentioned you', preview: notification.commentPreview || null }
    case 'reply':
      return { lead: name, action: 'replied to your comment', preview: notification.commentPreview || null }
    case 'comment_like':
      return { lead: name, action: 'liked your comment', preview: null }
    case 'pin':
      return { lead: name, action: 'pinned your comment', preview: null }
    case 'share': {
      const entityLabel = { post: 'post', profile: 'profile', event: 'event', community: 'community', club: 'club' }[notification.entityType] || 'content'
      return { lead: name, action: `shared your ${entityLabel}`, preview: null }
    }
    case 'invite':
      return {
        lead: notification.communityName || 'A club',
        action: 'invited you to join',
        preview: null
      }
    case 'announcement':
      return {
        lead: notification.communityName || 'A community',
        action: 'posted an update',
        preview: notification.message || null
      }
    default:
      return { lead: name, action: 'sent you a notification', preview: null }
  }
}
