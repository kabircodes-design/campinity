import { Bookmark, Flag, Heart, MessageCircle, Share } from 'lucide-react'

/**
 * The one definition of a post action's look — icon, size, stroke,
 * colour states, touch height and press feedback — shared by PostCard
 * (feed, Profile, communities, search, hashtags) and PostDetailPage, so
 * the same action can't drift between surfaces again (the feed used
 * Lucide `Share` at 18px while the post page used `Send` at 20px).
 * Layout (spacing, flex-1, label visibility) stays with each surface
 * via `className`.
 */
export const POST_ACTION_ICONS = {
  like: Heart,
  comment: MessageCircle,
  share: Share,
  save: Bookmark,
  report: Flag
}

const ACTIVE_CLASS = {
  like: 'text-red-500 dark:text-red-400',
  save: 'text-blue-600 dark:text-blue-400'
}

export default function PostActionButton({
  action,
  active = false,
  label,
  showLabel = true,
  count,
  onClick,
  className = '',
  iconClassName = '',
  ariaLabel,
  children,
  ...rest
}) {
  const Icon = POST_ACTION_ICONS[action]
  const filled = active && (action === 'like' || action === 'save')
  const tone = active && ACTIVE_CLASS[action]
    ? ACTIVE_CLASS[action]
    : action === 'report'
      ? 'text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400'
      : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || (showLabel ? undefined : label)}
      aria-pressed={action === 'like' || action === 'save' ? active : undefined}
      className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium active:scale-95 transition-all duration-200 ${tone} ${className}`}
      {...rest}
    >
      <Icon className={`w-5 h-5 ${iconClassName}`} strokeWidth={1.9} fill={filled ? 'currentColor' : 'none'} />
      {showLabel && label}
      {count !== undefined && count !== null && <span>{count}</span>}
      {children}
    </button>
  )
}
