import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from './Avatar.jsx'
import VerifiedBadge from './VerifiedBadge.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { auth } from '../firebase/firebase.js'
import { checkIsFollowing, followUser, unfollowUser } from '../firebase/profileService.js'

/**
 * Renders a user search result. searchAll() (searchService.js) returns
 * student objects carrying { uid, displayName, username, course, year,
 * division, rollNumber, collegeId, college, verifiedCampus }.
 *
 * ROOT-CAUSE FIX for every result previously showing the generic
 * "Student" secondary label: searchService.js's mapUserDoc() computed
 * the display name correctly but returned it under a `name` key this
 * component never read (fixed there); this component's own
 * `student.displayName || 'Student'` line — the actual NAME fallback
 * for a genuinely unnamed profile — was never the bug and is kept
 * as-is. What's new here is showing real profile context (college,
 * course/division, roll number) instead of just course+year, so a
 * result reads like an actual campus person, not a bare account
 * record — using only whatever fields are actually present, never
 * inventing a field that's empty.
 *
 * Follow button, new this pass — a real, confirmed gap (this component
 * previously had none at all). Reuses the existing followUser/
 * unfollowUser/checkIsFollowing functions directly, no duplicate logic.
 * Toggles live via local state, no page reload, matching "Follow →
 * Following without page reload."
 */
export default function StudentCard({ student }) {
  const navigate = useNavigate()
  const displayName = student.displayName || 'Student'
  const identityImage = getProfileIdentityImage(student)

  // Class/division on one line (falls back to just the year level if
  // course/division aren't set), roll number on its own when present —
  // matches the brief's card mockup without forcing every field to
  // render when the data is sparse.
  const classLine = [student.course, student.division].filter(Boolean).join(' • ') || student.year || ''
  const rollLine = student.rollNumber ? `Roll No. ${student.rollNumber}` : ''
  const metaLine = [classLine, rollLine].filter(Boolean).join(' · ')

  const currentUid = auth.currentUser?.uid
  const isSelf = currentUid && currentUid === student.uid

  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!currentUid || isSelf || !student.uid) return
    checkIsFollowing(currentUid, student.uid).then(setFollowing).catch(() => {})
  }, [currentUid, isSelf, student.uid])

  const handleFollow = async (event) => {
    event.stopPropagation()
    if (!currentUid || busy) return
    setBusy(true)
    try {
      if (following) {
        await unfollowUser(currentUid, student.uid)
        setFollowing(false)
      } else {
        await followUser(currentUid, student.uid)
        setFollowing(true)
      }
    } catch {
      // best-effort — button stays in its current state on failure
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/student/${student.username || student.uid}`)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-all duration-200"
    >
      <Avatar
        initials={getInitials(displayName)}
        colorClass={getAvatarColor(student.uid)}
        size="md"
        src={identityImage || undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
          <VerifiedBadge verified={student.verifiedCampus} size="sm" />
        </div>
        {student.username && <p className="text-[11px] text-gray-400 truncate">@{student.username}</p>}
        {student.college && <p className="text-[11px] text-gray-500 truncate">{student.college}</p>}
        {metaLine && <p className="text-[11px] text-gray-400 truncate">{metaLine}</p>}
      </div>
      {currentUid && !isSelf && (
        <span
          role="button"
          tabIndex={0}
          onClick={handleFollow}
          onKeyDown={(e) => e.key === 'Enter' && handleFollow(e)}
          className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
            following ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white hover:bg-blue-700'
          } ${busy ? 'opacity-60' : ''}`}
        >
          {following ? 'Following' : 'Follow'}
        </span>
      )}
    </button>
  )
}
