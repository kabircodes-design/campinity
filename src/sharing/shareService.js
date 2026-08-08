import { getOrCreateChat, sendMessage } from '../firebase/chatService.js'
import { incrementShareCount } from '../firebase/engagementService.js'
import { createShareNotification } from '../firebase/notificationService.js'
import { awardXP, hasReachedDailyCap } from '../gamification/xpService.js'
import { POINTS_REWARDS } from '../gamification/config.js'

/**
 * Orchestrates a share to one or more recipients — reuses
 * getOrCreateChat and sendMessage exactly as they exist (no
 * duplicated chat-creation or message-sending logic), running the
 * per-recipient work in parallel via Promise.all rather than a
 * sequential loop, per "one request, parallel execution."
 *
 * "Message Request Sent" for a brand-new pending chat needs zero new
 * code here — ChatPage.jsx already renders that badge whenever
 * chat.status === 'pending' && chat.requestedBy === currentUid, which
 * getOrCreateChat already sets correctly. This function doesn't need
 * to know or care whether a given recipient's chat came out pending
 * or accepted; the existing chat screen already handles both.
 *
 * shareCount increments exactly ONCE per share action, not once per
 * recipient — sharing to 3 people is one share of the post, matching
 * "Owner sees Shares: 83" as a real count of share actions, not an
 * inflated per-recipient number.
 */
/**
 * recipientUids is now recipients: an array of either
 * { type: 'user', uid } (needs getOrCreateChat, exactly as before) or
 * { type: 'group', chatId } (the chat already exists — send directly,
 * no chat-creation step). This is what makes "Recent Chats can contain
 * both 1-to-1 and group chats" actually work end-to-end — a group has
 * no otherUid to resolve through getOrCreateChat, it has an existing
 * chatId to send into directly.
 */
export async function shareContentToRecipients({
  currentUid,
  currentUserProfile,
  recipients,
  type,
  referenceId,
  referenceType,
  preview,
  message = ''
}) {
  if (!currentUid) throw new Error('You need to be signed in to share.')
  if (!recipients?.length) throw new Error('Select at least one person to share with.')

  const sharedPayload = { referenceId, referenceType, preview }

  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      const chatId = recipient.type === 'group' ? recipient.chatId : (await getOrCreateChat(currentUid, recipient.uid)).chatId

      await sendMessage(chatId, currentUid, message, { type, sharedPayload })

      if (recipient.type === 'user') {
        await createShareNotification({
          targetUid: recipient.uid,
          actorUid: currentUid,
          actorName: currentUserProfile?.displayName,
          actorAvatar: currentUserProfile?.avatar,
          entityType: referenceType,
          entityId: referenceId
        }).catch(() => {}) // a notification failure shouldn't fail the share itself
      }
      // Group shares don't fire a per-member notification here — the
      // existing notification system has no "shared with your group"
      // concept, and fanning out one notification per member would be
      // inventing new notification behavior beyond what was asked for
      // ("Kabir shared a post with you" is framed as a 1-to-1 concept
      // in the brief this feature was built from).

      return { recipient, chatId }
    })
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
  const failed = results.filter((r) => r.status === 'rejected')

  // Only counts as a real share if it reached at least one person —
  // matches "no fake values": a share that failed for every recipient
  // shouldn't inflate the count.
  if (succeeded.length > 0 && referenceType === 'post') {
    await incrementShareCount(referenceId).catch(() => {})
  }

  // Gamification — once per share ACTION (not once per recipient,
  // same reasoning already established for the share count above:
  // sharing one post to 3 people is one share). No per-target
  // dedupeKey makes sense here — sharing the same post to different
  // people on different occasions are genuinely separate, legitimate
  // actions, unlike a like/save which are binary per-post states.
  // Daily-capped instead (same mechanism as message_sent) since
  // that's the actual anti-farming concern for an action with no
  // natural one-time-per-target identity.
  if (succeeded.length > 0) {
    const capped = await hasReachedDailyCap(currentUid, 'share', 15).catch(() => true)
    if (!capped) {
      await awardXP(currentUid, 'share', { campusPoints: POINTS_REWARDS.share || 0 }).catch(() => {})
    }
  }

  return { succeeded, failedCount: failed.length }
}
