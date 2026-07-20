import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import ProfileHeader from '../components/ProfileHeader.jsx'
import PostCard from '../components/PostCard.jsx'
import PDFCard from '../components/PDFCard.jsx'
import EventCard from '../components/EventCard.jsx'
import Loader from '../auth/components/Loader.jsx'
import { myEventIds, profileTabs } from '../data/dummyProfile.js'
import { dummyProfileStats } from '../data/dummyProfileStats.js'
import { posts } from '../data/dummyFeed.js'
import { notes, events } from '../data/dummySearch.js'
import { getCollegeById } from '../data/dummyColleges.js'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getUserPosts } from '../firebase/postService.js'

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(profileTabs[0].key)
  const [profile, setProfile] = useState(null)
  const [myPosts, setMyPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const uid = auth.currentUser?.uid

    /**
     * Profile and Posts are fetched independently — a Firestore error on
     * one (e.g. a missing composite index on the posts query) must never
     * wipe out data that loaded successfully on the other.
     */
    const loadProfile = async () => {
      if (!uid) {
        if (!cancelled) setError('Not signed in.')
        return
      }
      try {
        const data = await getUserProfile(uid)
        if (!cancelled) setProfile(data)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load your profile.')
      }
    }

    const loadPosts = async () => {
      if (!uid) return
      try {
        const data = await getUserPosts(uid, uid)
        if (!cancelled) setMyPosts(data)
      } catch {
        // Posts tab just falls back to its empty state if this fails;
        // the profile above still loads independently.
      }
    }

    Promise.all([loadProfile(), loadPosts()]).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const username = profile?.username || ''

  const myMarketplace = useMemo(
    () => posts.filter((post) => post.username === username && post.type === 'marketplace'),
    [username]
  )
  const myNotes = useMemo(
    () => notes.filter((note) => note.uploader === profile?.displayName),
    [profile]
  )
  const myEvents = useMemo(() => events.filter((event) => myEventIds.includes(event.id)), [])

  const tabContent = {
    posts: myPosts,
    notes: myNotes,
    events: myEvents,
    marketplace: myMarketplace
  }[activeTab]

  const emptyMessage = {
    posts: "You haven't posted anything yet.",
    notes: 'No notes uploaded yet.',
    events: 'No events yet — RSVP to something from the feed.',
    marketplace: 'No marketplace listings yet.'
  }[activeTab]

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400">{error || 'Profile not found.'}</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  const college = getCollegeById(profile.collegeId)

  const displayProfile = {
    name: profile.displayName,
    username: profile.username,
    bio: profile.bio,
    college: college?.name || '',
    department: profile.course,
    year: profile.year,
    initials: getInitials(profile.displayName),
    colorClass: dummyProfileStats.colorClass,
    coverGradient: dummyProfileStats.coverGradient,
    followers: dummyProfileStats.followers,
    following: dummyProfileStats.following,
    postsCount: dummyProfileStats.postsCount
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center justify-between px-4">
            <span className="text-base font-bold tracking-tight text-gray-900">Profile</span>
            <button
              type="button"
              aria-label="Settings"
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <ProfileHeader profile={displayProfile} onEdit={() => navigate('/profile/edit')} />

        <nav className="sticky top-14 z-30 flex items-center bg-white border-b border-gray-100">
          {profileTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-[13px] font-semibold text-center border-b-2 transition-all duration-300 ${
                activeTab === tab.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="pb-24">
          {tabContent.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">{emptyMessage}</p>
            </div>
          ) : (
            <div>
              {tabContent.map((item) => {
                if (activeTab === 'posts' || activeTab === 'marketplace') {
                  return <PostCard key={item.id} post={item} />
                }
                if (activeTab === 'notes') return <PDFCard key={item.id} note={item} />
                if (activeTab === 'events') return <EventCard key={item.id} event={item} />
                return null
              })}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  )
}