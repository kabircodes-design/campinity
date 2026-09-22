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
  badge: 'Award',
  level_up: 'Star',
  streak: 'Flame',
  achievement_verified: 'BadgeCheck',
  achievement_rejected: 'FileWarning',
  invite: 'Mail',
  announcement: 'Megaphone',
  message_request: 'Mail',
  message_request_accepted: 'MessageCircle',
  community_join_approved: 'Users',
  community_role_changed: 'ShieldCheck',
  story_like: 'Heart',
  story_comment: 'MessageCircle',
  call: 'Phone',
  group_call: 'Phone'
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
    case 'badge':
      return { lead: `${notification.badgeEmoji || '🏆'} Badge Unlocked`, action: notification.badgeLabel || 'New badge', preview: null }
    case 'level_up':
      return { lead: `⭐ Level ${notification.newLevel}`, action: notification.levelTitle ? `You're now ${notification.levelTitle}` : 'Level up!', preview: null }
    case 'streak':
      return { lead: `🔥 ${notification.streakDays}-Day Streak`, action: "You're on a roll — keep it going", preview: null }
    case 'achievement_verified':
      return { lead: '🎉 Achievement Verified', action: `${notification.achievementTitle || 'Your achievement'} is now part of your Campinity profile.`, preview: null }
    case 'achievement_rejected':
      return {
        lead: 'Achievement Submission',
        action: 'needs attention',
        preview: notification.rejectionReason || null
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
    case 'message_request':
      return { lead: name, action: 'sent you a message request', preview: null }
    case 'message_request_accepted':
      return { lead: name, action: 'accepted your message request', preview: null }
    case 'lostFoundClaim':
      return { lead: name, action: 'thinks they found your lost item', preview: null }
    case 'community_join_approved':
      return {
        lead: notification.communityName || 'A community',
        action: 'approved your request to join',
        preview: null
      }
    case 'community_role_changed':
      return {
        lead: notification.communityName || 'A community',
        action: notification.newRole ? `made you ${notification.newRole === 'admin' ? 'an' : 'a'} ${notification.newRole}` : 'updated your role',
        preview: null
      }
    case 'story_like':
      return { lead: name, action: 'liked your story', preview: null }
    case 'story_comment':
      return { lead: name, action: 'replied to your story', preview: notification.commentPreview || null }
    case 'call':
      return { lead: name, action: notification.callType === 'video' ? 'is video calling you' : 'is calling you', preview: null }
    case 'group_call':
      return { lead: name, action: `started a group ${notification.callType === 'video' ? 'video' : 'voice'} call`, preview: null }
    default:
      return { lead: name, action: 'sent you a notification', preview: null }
  }
}

/**
 * Extracted verbatim from NotificationCard.jsx's own handleClick — same
 * routes, same fallback field priority, same "no match → no
 * navigation" behavior (returns null rather than guessing). Pulled out
 * here (Phase 3) so a push-notification tap and an in-app notification-
 * list tap share exactly one source of truth for "where does this
 * notification type go" — not two implementations that could quietly
 * drift apart. NotificationCard.jsx now calls this instead of
 * duplicating the logic; the resulting behavior is unchanged.
 */
export function getNotificationRoute(notification) {
  if (!notification) return null

  if (notification.type === 'badge' || notification.type === 'achievement_verified' || notification.type === 'achievement_rejected') {
    return '/badges'
  }
  if (notification.type === 'level_up' || notification.type === 'streak') {
    return '/progress'
  }
  if (notification.type === 'message_request' && notification.chatId) {
    return '/messages/requests'
  }
  if (notification.type === 'message_request_accepted' && notification.chatId) {
    return `/messages/${notification.chatId}`
  }
  if ((notification.type === 'call' || notification.type === 'group_call') && notification.chatId) {
    // Lands the tap in the relevant chat either way: CallProvider is
    // mounted globally (main.jsx), so if the call is still ringing its
    // own live Firestore listener shows the real incoming-call UI the
    // instant the app opens, on top of whatever route this resolves
    // to. If the call already ended, this is just a sensible landing
    // spot — not a stale/stuck incoming-call screen.
    return `/messages/${notification.chatId}`
  }
  if (notification.type === 'follow' && notification.actorUsername) {
    return `/student/${notification.actorUsername}`
  }
  if (notification.type === 'lostFoundClaim' && notification.itemId) {
    return `/lost-found?item=${notification.itemId}`
  }
  if (notification.type === 'story_like' || notification.type === 'story_comment') {
    return '/home'
  }
  if (notification.postId && notification.commentId) {
    return `/post/${notification.postId}#comment-${notification.commentId}`
  }
  if (notification.postId) {
    return `/post/${notification.postId}`
  }
  if (notification.communityId) {
    return `/community/${notification.communityId}`
  }
  return null
}
