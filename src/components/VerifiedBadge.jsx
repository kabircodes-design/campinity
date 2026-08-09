import { BadgeCheck } from 'lucide-react'

/**
 * Extracted from the identical inline pattern already duplicated in
 * ProfileHeader.jsx and FollowUserCard.jsx — same icon, same colors,
 * same fillOpacity, just different sizes. Renders ONLY when
 * verifiedCampus === true; every caller passes the exact boolean
 * field, never inferring it, so pending/rejected/false/missing all
 * correctly render nothing.
 */
export default function VerifiedBadge({ verified, size = 'sm' }) {
  if (!verified) return null
  const sizeClass = size === 'lg' ? 'w-4 h-4' : size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'
  return <BadgeCheck className={`${sizeClass} text-blue-600 flex-shrink-0`} fill="currentColor" fillOpacity={0.15} />
}
