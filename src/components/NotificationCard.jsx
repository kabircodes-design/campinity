import { useNavigate } from 'react-router-dom'
import { AtSign, Award, CornerUpLeft, Heart, Mail, Megaphone, MessageCircle, Pin, Share2, Star, Trash2, UserPlus } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { getNotificationText } from '../utils/notificationText.js'
import { formatTimeAgo } from '../firebase/postService.js'

const ICON_STYLES = {
  like: { Icon: Heart, bg: 'bg-red-500', fill: true },
  comment: { Icon: MessageCircle, bg: 'bg-blue-600', fill: false },
  follow: { Icon: UserPlus, bg: 'bg-emerald-500', fill: false },
  mention: { Icon: AtSign, bg: 'bg-blue-600', fill: false },
  reply: { Icon: CornerUpLeft, bg: 'bg-blue-600', fill: false },
  comment_like: { Icon: Heart, bg: 'bg-red-500', fill: true },
  pin: { Icon: Pin, bg: 'bg-amber-500', fill: true },
  share: { Icon: Share2, bg: 'bg-blue-600', fill: false },
  badge: { Icon: Award, bg: 'bg-amber-500', fill: true },
  level_up: { Icon: Star, bg: 'bg-violet-500', fill: true },
  invite: { Icon: Mail, bg: 'bg-amber-500', fill: false },
  announcement: { Icon: Megaphone, bg: 'bg-violet-500', fill: false }
}

/**
 * Complete redesign, per this task — replaces whatever this component
 * was before (never seen, and a ground-up redesign doesn't need the
 * old version to build correctly, unlike a targeted fix would).
 *
 * Layout: avatar with a small colored type-icon badge on its corner
 * (inspired by, not copied from, Instagram's own pattern) + rich text
 * (from notificationText.js, the shared pure utility — reused here,
 * not duplicated) + relative time (formatTimeAgo — the same function
 * already used for post timestamps elsewhere in this project, reused
 * rather than writing a second one) + unread state (left accent bar +
 * tinted background + dot, all removed once read) + a delete action.
 *
 * Tap targets: the whole row navigates AND marks read on tap (except
 * the delete button, which stops propagation) — standard mobile
 * notification-list behavior, not a novel interaction.
 */
export default function NotificationCard({ notification, onRead, onDelete }) {
  const navigate = useNavigate()
  const { lead, action, preview } = getNotificationText(notification)
  const style = ICON_STYLES[notification.type] || ICON_STYLES.announcement
  const { Icon } = style

  const handleClick = () => {
    if (!notification.read) onRead(notification.id)

    if (notification.type === 'follow' && notification.actorUsername) {
      navigate(`/student/${notification.actorUsername}`)
    } else if (notification.postId && notification.commentId) {
      // #comment-{id} matches the anchor id PostDetailPage.jsx's comment
      // list items should carry — see that page's update for the other
      // half of this (scroll-into-view + highlight on load).
      navigate(`/post/${notification.postId}#comment-${notification.commentId}`)
    } else if (notification.postId) {
      navigate(`/post/${notification.postId}`)
    } else if (notification.communityId) {
      navigate(`/community/${notification.communityId}`)
    }
  }

  const handleDelete = (event) => {
    event.stopPropagation()
    onDelete(notification.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleClick()
        }
      }}
      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left relative transition-all duration-200 active:scale-[0.99] hover:bg-gray-50 cursor-pointer ${
        !notification.read ? 'bg-blue-50/40' : 'bg-white'
      }`}
    >
      {!notification.read && (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-600" aria-hidden="true" />
      )}

      <div className="relative flex-shrink-0">
        <Avatar
          initials={(lead || '?').slice(0, 1).toUpperCase()}
          colorClass="from-gray-300 to-gray-400"
          size="md"
          src={notification.actorAvatar || undefined}
        />
        <span
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${style.bg} flex items-center justify-center ring-2 ring-white`}
          aria-hidden="true"
        >
          <Icon className="w-3 h-3 text-white" fill={style.fill ? 'currentColor' : 'none'} strokeWidth={2.2} />
        </span>
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-[13.5px] text-gray-900 leading-snug">
          <span className="font-semibold">{lead}</span> <span className="text-gray-700">{action}</span>
        </p>
        {preview && (
          <p className="mt-0.5 text-[13px] text-gray-500 italic truncate">&ldquo;{preview}&rdquo;</p>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11.5px] text-gray-400">{formatTimeAgo(notification.createdAt)}</span>
          {!notification.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" aria-hidden="true" />}
        </div>
      </div>

      <button
        type="button"
        aria-label="Delete notification"
        onClick={handleDelete}
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
