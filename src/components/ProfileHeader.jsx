import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCheck, UserPlus } from 'lucide-react'
import Avatar from './Avatar.jsx'

export default function ProfileHeader({
  profile,
  onEdit,
  isOwnProfile = true,
  isFollowing = false,
  isFollowLoading = false,
  onToggleFollow
}) {
  const navigate = useNavigate()
  const [shareCopied, setShareCopied] = useState(false)

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/student/${profile.username}`
    const shareData = { title: profile.name, text: `Check out ${profile.name} on Campinity`, url: shareUrl }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
      }
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1500)
    } catch {
    }
  }

  return (
    <div>
      {profile.coverPhoto ? (
        <div className="h-28 sm:h-32 overflow-hidden">
          <img src={profile.coverPhoto} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`h-28 sm:h-32 bg-gradient-to-br ${profile.coverGradient}`} />
      )}

      <div className="px-4 -mt-10">
        <div className="flex items-end justify-between">
          <div className="rounded-full ring-4 ring-white">
            <Avatar initials={profile.initials} colorClass={profile.colorClass} size="xl" />
          </div>

          {isOwnProfile && (
            <div className="flex items-center gap-2 pb-1">
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full bg-blue-600 text-white text-xs font-semibold px-4 py-2 hover:bg-blue-700 transition-all duration-300"
              >
                Edit Profile
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="rounded-full border border-gray-200 text-gray-600 text-xs font-semibold px-4 py-2 hover:border-gray-300 transition-all duration-300"
              >
                {shareCopied ? 'Copied' : 'Share'}
              </button>
            </div>
          )}

          {!isOwnProfile && (
            <div className="flex items-center gap-2 pb-1">
              <button
                type="button"
                onClick={onToggleFollow}
                disabled={isFollowLoading}
                className={`flex items-center gap-1.5 rounded-full text-xs font-semibold px-4 py-2 transition-all duration-300 disabled:opacity-60 ${
                  isFollowing ? 'bg-gray-100 text-gray-700' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {isFollowLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="rounded-full border border-gray-200 text-gray-600 text-xs font-semibold px-4 py-2 hover:border-gray-300 transition-all duration-300"
              >
                {shareCopied ? 'Copied' : 'Share'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-3">
          <h1 className="text-lg font-bold text-gray-900">{profile.name}</h1>
          <p className="text-sm text-gray-400">@{profile.username}</p>
          <p className="mt-1 text-xs text-gray-500">
            {profile.department} · {profile.year} · {profile.college}
          </p>
          {profile.bio && <p className="mt-2 text-[13.5px] text-gray-700 leading-relaxed">{profile.bio}</p>}
          {profile.joinedDate && <p className="mt-1 text-xs text-gray-400">Joined {profile.joinedDate}</p>}
        </div>

        <div className="mt-4 flex items-center gap-6 pb-4">
          <div className="text-center">
            <p className="text-sm font-bold text-gray-900">{profile.postsCount}</p>
            <p className="text-[11px] text-gray-400">Posts</p>
          </div>
          <button type="button" onClick={() => navigate('/followers')} className="text-center">
            <p className="text-sm font-bold text-gray-900">{profile.followers}</p>
            <p className="text-[11px] text-gray-400">Followers</p>
          </button>
          <button type="button" onClick={() => navigate('/following')} className="text-center">
            <p className="text-sm font-bold text-gray-900">{profile.following}</p>
            <p className="text-[11px] text-gray-400">Following</p>
          </button>
        </div>
      </div>
    </div>
  )
}