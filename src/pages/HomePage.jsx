import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Logo from '../components/Logo.jsx'
import StoryBubble from '../components/StoryBubble.jsx'
import PostCard from '../components/PostCard.jsx'
import BottomNav from '../components/BottomNav.jsx'
import { currentUser, stories, feedTabs, posts } from '../data/dummyFeed.js'

export default function HomePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(feedTabs[0].key)

  const visiblePosts = useMemo(
    () => posts.filter((post) => post.feedCategories.includes(activeTab)),
    [activeTab]
  )

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      {/* Centered mobile-first column — desktop simply centers this same layout */}
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        {/* -------------------------------------------------------- */}
        {/* Top header — logo + notifications, stays pinned          */}
        {/* -------------------------------------------------------- */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center justify-between px-4">

            <div className="flex items-center gap-2">
             <Logo />
            </div>

            <button
              type="button"
              aria-label="Notifications"
              onClick={() => navigate('/notifications')}
              className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
            </button>
          </div>
        </header>

        {/* -------------------------------------------------------- */}
        {/* Greeting + search                                        */}
        {/* -------------------------------------------------------- */}
        <section className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Avatar initials={currentUser.initials} colorClass={currentUser.colorClass} size="md" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Good morning, {currentUser.name.split(' ')[0]}
              </h1>
              <p className="mt-0.5 text-[13px] text-gray-400">Catch up on what's happening across campus.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/search')}
            className="relative mt-3.5 w-full text-left"
            aria-label="Search Campinity"
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <span className="block w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-400 hover:bg-white hover:border-gray-300 transition-all duration-300">
              Search Campinity
            </span>
          </button>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Stories row                                               */}
        {/* -------------------------------------------------------- */}
        <section className="pb-3 border-b border-gray-100">
          <div className="flex items-start gap-3.5 px-4 overflow-x-auto scroll-hidden">
            {stories.map((story) => (
              <StoryBubble key={story.id} story={story} />
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Feed tabs                                                 */}
        {/* -------------------------------------------------------- */}
        <nav className="sticky top-14 z-30 flex items-center bg-white border-b border-gray-100">
          {feedTabs.map((tab) => (
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

        {/* -------------------------------------------------------- */}
        {/* Feed                                                      */}
        {/* -------------------------------------------------------- */}
        <main className="pb-24">
          {visiblePosts.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-gray-400">Nothing here yet — check back soon.</p>
            </div>
          ) : (
            visiblePosts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </main>
      </div>

      {/* -------------------------------------------------------- */}
      {/* Bottom mobile navigation — sticky, centered to match column */}
      {/* -------------------------------------------------------- */}
      <BottomNav />
    </div>
  )
}