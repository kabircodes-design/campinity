import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import ProfileHeader from '../components/ProfileHeader.jsx'
import PostCard from '../components/PostCard.jsx'
import PDFCard from '../components/PDFCard.jsx'
import EventCard from '../components/EventCard.jsx'
import { currentUserProfile, myEventIds, profileTabs } from '../data/dummyProfile.js'
import { posts } from '../data/dummyFeed.js'
import { notes, events } from '../data/dummySearch.js'

export default function ProfilePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(profileTabs[0].key)

  const myPosts = useMemo(
    () => posts.filter((post) => post.username === currentUserProfile.username && post.type !== 'marketplace'),
    []
  )
  const myMarketplace = useMemo(
    () => posts.filter((post) => post.username === currentUserProfile.username && post.type === 'marketplace'),
    []
  )
  const myNotes = useMemo(() => notes.filter((note) => note.uploader === currentUserProfile.name), [])
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

        <ProfileHeader profile={currentUserProfile} onEdit={() => navigate('/profile/edit')} />

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