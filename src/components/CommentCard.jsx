import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Heart, MoreHorizontal, Pin } from 'lucide-react'
import Avatar from './Avatar.jsx'
import MentionText from './MentionText.jsx'
import CommentComposer from './CommentComposer.jsx'
import { formatTimeAgo } from '../firebase/postService.js'
import {
  addComment,
  deleteComment,
  editComment,
  getReplies,
  likeComment,
  pinComment,
  unlikeComment,
  unpinComment
} from '../firebase/engagementService.js'

/**
 * Recursive by design (a reply can itself be re-rendered as a
 * CommentCard for its own replies), but the DATA model is flat
 * (parentCommentId points at a top-level comment, not at another
 * reply) — matching Instagram/Reddit's actual visual convention where
 * deep reply chains still visually nest only one level, not
 * infinitely. `depth` controls the indentation/connector-line
 * styling, not the data structure.
 *
 * Delete uses an inline confirm (expand/replace the three-dot menu
 * with a Yes/Cancel row) rather than a modal — matches "smooth delete
 * animation" better than a jarring native browser confirm() would,
 * without the complexity of a full modal component this task didn't
 * specifically ask for.
 *
 * Author display (name/avatar/username) uses what's stored directly
 * on the comment document at write time, NOT live re-enriched via
 * useAuthorEnrichment.js (unlike posts/notifications elsewhere in
 * this project). Deliberate: a comment thread can have dozens of
 * authors visible at once, and live-enriching all of them would be
 * one profile read per unique commenter every time a thread opens —
 * a real cost this task's own "avoid unnecessary Firestore reads"
 * requirement argues against, for a field (a name/avatar at the
 * moment of comment) that's also reasonably expected to reflect what
 * it looked like when written, not necessarily right now.
 */
export default function CommentCard({
  comment,
  postId,
  postOwnerUid,
  currentUid,
  currentUser,
  depth = 0,
  onDeleted,
  canModerate = false
}) {
  const navigate = useNavigate()

  const [liked, setLiked] = useState((comment.likedBy || []).includes(currentUid))
  const [likeCount, setLikeCount] = useState(comment.likesCount || 0)
  const [likeAnimating, setLikeAnimating] = useState(false)

  const [showMenu, setShowMenu] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [currentText, setCurrentText] = useState(comment.text)
  const [isEdited, setIsEdited] = useState(comment.edited)

  const [isPinned, setIsPinned] = useState(comment.pinned)
  const [pinBusy, setPinBusy] = useState(false)

  const [isReplying, setIsReplying] = useState(false)
  const [replies, setReplies] = useState([])
  const [repliesLoaded, setRepliesLoaded] = useState(false)
  const [repliesExpanded, setRepliesExpanded] = useState(false)
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [replyCount, setReplyCount] = useState(comment.replyCount || 0)

  const isOwnComment = comment.userId === currentUid
  const isPostOwner = currentUid === postOwnerUid

  const toggleLike = async () => {
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((prev) => (nextLiked ? prev + 1 : prev - 1))
    if (nextLiked) {
      setLikeAnimating(true)
      window.setTimeout(() => setLikeAnimating(false), 300)
    }
    try {
      if (nextLiked) {
        await likeComment(postId, comment.id, currentUid, currentUser)
      } else {
        await unlikeComment(postId, comment.id, currentUid)
      }
    } catch {
      setLiked(!nextLiked)
      setLikeCount((prev) => (nextLiked ? prev - 1 : prev + 1))
    }
  }

  const loadReplies = async () => {
    if (repliesLoaded) {
      setRepliesExpanded((prev) => !prev)
      return
    }
    setRepliesLoading(true)
    try {
      const { replies: data } = await getReplies(postId, comment.id)
      setReplies(data)
      setRepliesLoaded(true)
      setRepliesExpanded(true)
    } finally {
      setRepliesLoading(false)
    }
  }

  const handleReplySubmit = async ({ text, mentionedUids }) => {
    const replyId = await addComment(postId, {
      uid: currentUid,
      displayName: currentUser?.displayName,
      username: currentUser?.username,
      avatar: currentUser?.avatar,
      text,
      parentCommentId: comment.id,
      mentionedUids
    })
    setReplyCount((prev) => prev + 1)
    setReplies((prev) => [
      ...prev,
      {
        id: replyId,
        userId: currentUid,
        displayName: currentUser?.displayName || 'Student',
        username: currentUser?.username || '',
        avatar: currentUser?.avatar || '',
        text,
        mentions: mentionedUids,
        parentCommentId: comment.id,
        replyCount: 0,
        likedBy: [],
        likesCount: 0,
        edited: false,
        pinned: false,
        createdAt: { toMillis: () => Date.now() } // optimistic — real value arrives on next real fetch
      }
    ])
    setRepliesLoaded(true)
    setRepliesExpanded(true)
    setIsReplying(false)
  }

  const handleEditSubmit = async ({ text, mentionedUids }) => {
    await editComment(postId, comment.id, currentUid, text, mentionedUids)
    setCurrentText(text)
    setIsEdited(true)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    try {
      await deleteComment(postId, comment.id, currentUid)
      setIsDeleted(true)
      onDeleted?.(comment.id)
    } catch {
      setConfirmingDelete(false)
    }
  }

  const togglePin = async () => {
    setPinBusy(true)
    try {
      if (isPinned) {
        await unpinComment(postId, comment.id, currentUid, postOwnerUid)
        setIsPinned(false)
      } else {
        await pinComment(postId, comment.id, currentUid, postOwnerUid, currentUser)
        setIsPinned(true)
      }
    } finally {
      setPinBusy(false)
      setShowMenu(false)
    }
  }

  if (isDeleted) return null

  return (
    <div
      id={`comment-${comment.id}`}
      className={`transition-all duration-300 ${depth > 0 ? 'ml-9 pl-3 border-l-2 border-gray-100' : ''} ${
        isPinned ? 'bg-amber-50/60 -mx-4 px-4 rounded-xl' : ''
      }`}
    >
      <div className="flex items-start gap-2.5 py-2.5">
        <button type="button" onClick={() => navigate(`/student/${comment.username}`)} className="flex-shrink-0">
          <Avatar
            initials={(comment.displayName || '?').slice(0, 1).toUpperCase()}
            colorClass="from-gray-300 to-gray-400"
            size="sm"
            src={comment.avatar || undefined}
          />
        </button>

        <div className="flex-1 min-w-0">
          {isPinned && (
            <p className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-600 mb-0.5">
              <Pin className="w-2.5 h-2.5" fill="currentColor" />
              Pinned by creator
            </p>
          )}

          {isEditing ? (
            <CommentComposer
              currentUser={currentUser}
              editingComment={{ text: currentText, mentions: comment.mentions }}
              onCancelEdit={() => setIsEditing(false)}
              onSubmit={handleEditSubmit}
              autoFocus
            />
          ) : (
            <>
              <div className="rounded-2xl bg-gray-50 px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => navigate(`/student/${comment.username}`)}
                  className="text-xs font-semibold text-gray-900"
                >
                  {comment.displayName}
                </button>
                <MentionText text={currentText} className="block text-sm text-gray-700 mt-0.5" />
              </div>

              <div className="mt-1 flex items-center gap-3 pl-1">
                <span className="text-[11px] text-gray-400">
                  {formatTimeAgo(comment.createdAt)}
                  {isEdited && <span className="ml-1 text-gray-300">· Edited</span>}
                </span>

                <button
                  type="button"
                  onClick={toggleLike}
                  className={`flex items-center gap-1 text-[11px] font-medium transition-all duration-200 ${
                    liked ? 'text-red-500' : 'text-gray-400 hover:text-blue-600'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${likeAnimating ? 'scale-125' : 'scale-100'}`}
                    fill={liked ? 'currentColor' : 'none'}
                  />
                  {likeCount > 0 ? likeCount : 'Like'}
                </button>

                {depth === 0 && (
                  <button
                    type="button"
                    onClick={() => setIsReplying((v) => !v)}
                    className="text-[11px] font-medium text-gray-400 hover:text-blue-600 transition-all duration-200"
                  >
                    Reply
                  </button>
                )}

                {(isOwnComment || isPostOwner || canModerate) && (
                  <div className="relative ml-auto">
                    <button
                      type="button"
                      aria-label="Comment options"
                      onClick={() => setShowMenu((v) => !v)}
                      className="text-gray-300 hover:text-gray-500 transition-all duration-200"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                  {showMenu && (
                    <div className="absolute right-0 top-6 w-36 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-30">
                      {isPostOwner && depth === 0 && (
                        <button
                          type="button"
                          onClick={togglePin}
                          disabled={pinBusy}
                          className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-all duration-150"
                        >
                          {isPinned ? 'Unpin comment' : 'Pin comment'}
                        </button>
                      )}
                      {isOwnComment && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditing(true)
                            setShowMenu(false)
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 transition-all duration-150"
                        >
                          Edit
                        </button>
                      )}
                      {(isOwnComment || isPostOwner || canModerate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingDelete(true)
                            setShowMenu(false)
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-all duration-150"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                )}
              </div>

              {confirmingDelete && (
                <div className="mt-2 flex items-center gap-2 pl-1">
                  <span className="text-[11px] text-gray-500">Delete this comment?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="text-[11px] font-semibold text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {isReplying && (
                <div className="mt-2">
                  <CommentComposer
                    currentUser={currentUser}
                    replyingTo={comment}
                    onCancelReply={() => setIsReplying(false)}
                    onSubmit={handleReplySubmit}
                    placeholder={`Reply to ${comment.displayName}...`}
                    autoFocus
                  />
                </div>
              )}

              {depth === 0 && replyCount > 0 && (
                <button
                  type="button"
                  onClick={loadReplies}
                  disabled={repliesLoading}
                  className="mt-2 ml-1 flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-blue-600 transition-all duration-200"
                >
                  {repliesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {repliesLoading
                    ? 'Loading...'
                    : repliesExpanded
                    ? 'Hide replies'
                    : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {repliesExpanded && (
        <div className="space-y-0.5">
          {replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              postId={postId}
              postOwnerUid={postOwnerUid}
              currentUid={currentUid}
              currentUser={currentUser}
              depth={depth + 1}
              onDeleted={() => {
                setReplies((prev) => prev.filter((r) => r.id !== reply.id))
                setReplyCount((prev) => Math.max(0, prev - 1))
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
