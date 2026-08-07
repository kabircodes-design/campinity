import { getOrCreateChat, sendMessage } from '../firebase/chatService.js'
import { incrementShareCount } from '../firebase/engagementService.js'
import { createShareNotification } from '../firebase/notificationService.js'

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
export async function shareContentToRecipients({
  currentUid,
  currentUserProfile,
  recipientUids,
  type,
  referenceId,
  referenceType,
  preview,
  message = ''
}) {
  if (!currentUid) throw new Error('You need to be signed in to share.')
  if (!recipientUids?.length) throw new Error('Select at least one person to share with.')

  const sharedPayload = { referenceId, referenceType, preview }

  const results = await Promise.allSettled(
    recipientUids.map(async (recipientUid) => {
      const { chatId } = await getOrCreateChat(currentUid, recipientUid)
      await sendMessage(chatId, currentUid, message, { type, sharedPayload })

      await createShareNotification({
        targetUid: recipientUid,
        actorUid: currentUid,
        actorName: currentUserProfile?.displayName,
        actorAvatar: currentUserProfile?.avatar,
        entityType: referenceType,
        entityId: referenceId
      }).catch(() => {}) // a notification failure shouldn't fail the share itself

      return { recipientUid, chatId }
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

  return { succeeded, failedCount: failed.length }
}
