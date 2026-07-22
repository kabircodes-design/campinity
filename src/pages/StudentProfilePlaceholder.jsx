import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav.jsx'
import ProfileHeader from '../components/ProfileHeader.jsx'
import PostCard from '../components/PostCard.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfileByUsername } from '../firebase/profileService.js'
import { getUserPosts } from '../firebase/postService.js'
import { getCollegeById } from '../firebase/collegeService.js'

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-600'
]

const COVER_GRADIENTS = [
  'from-blue-600 via-indigo-600 to-blue-700',
  'from-violet-600 via-purple-600 to-indigo-700',
  'from-emerald-600 via-teal-600 to-blue-700',
  'from-rose-600 via-pink-600 to-purple-700',
  'from-amber-600 via-orange-600 to-rose-700'
]

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

function pickBySeed(list, seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % list.length
  }
  return list[Math.abs(hash) % list.length]
}

function formatJoinedDate(timestamp) {
  if (!timestamp?.toDate) return ''
  return timestamp.toDate().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function StudentProfilePlaceholder() {
  const { username } = useParams()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [collegeName, setCollegeName] = useState('')
  const [posts, setPosts] = useState([])
  const [postsError, setPostsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setNotFound(false)

      let resolved = null
      try {
        resolved = await getUserProfileByUsername(username)
      } catch {
        resolved = null
      }

      if (cancelled) return

      if (!resolved) {
        setNotFound(true)
        setLoading(false)
        return
      }

      // Viewing your own profile via a student link goes to the real,
      // editable Profile page instead of this read-only public view.
      if (resolved.uid === auth.currentUser?.uid) {
        navigate('/profile', { replace: true })
        return
      }

      setProfile(resolved)

      if (resolved.collegeId) {
        try {
          const college = await getCollegeById(resolved.collegeId)
          if (!cancelled) setCollegeName(college?.name || '')
        } catch {
          if (!cancelled) setCollegeName('')
        }
      }

      try {
        const data = await getUserPosts(resolved.uid, auth.currentUser?.uid)
        if (!cancelled) setPosts(data)
      } catch (err) {
        if (!cancelled) setPostsError(err?.message || 'Could not load posts.')
      }

      if (!cancelled) setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [username, navigate])

  const seed = profile?.uid || profile?.username || ''

  const displayProfile = useMemo(() => {
    if (!profile) return null
    return {
      name: profile.displayName || '',
      username: profile.username || '',
      bio: profile.bio || '',
      college: collegeName || '',
      department: profile.course || '',
      year: profile.year || '',
      initials: getInitials(profile.displayName),
      colorClass: pickBySeed(AVATAR_COLORS, seed),
      coverGradient: pickBySeed(COVER_GRADIENTS, seed),
      coverPhoto: profile.coverPhoto || '',
      followers: 0,
      following: 0,
      postsCount: posts.length,
      joinedDate: formatJoinedDate(profile.createdAt)
    }
  }, [profile, collegeName, posts.length, seed])

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (notFound || !displayProfile) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400">Student not found.</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <ProfileHeader profile={displayProfile} isOwnProfile={false} />

        <main className="pb-24 border-t border-gray-100">
          {postsError ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">{postsError}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">No posts yet.</p>
            </div>
          ) : (
            <div>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}