import { useState } from 'react'
import Logo from "../components/Logo";
import {
  Bell,
  Search,
  Plus,
  Home,
  MessageCircle,
  User,
  Heart,
  Share2,
  FileText,
  CalendarDays,
  ShoppingBag,
  PackageSearch,
  Megaphone,
  MoreHorizontal,
  Download,
  MapPin,
  Clock
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Sample / static data — no backend, no Firebase, no API calls.      */
/*  These placeholders will later be swapped for live Firebase data.   */
/* ------------------------------------------------------------------ */

const currentUser = {
  name: 'Aarav Sharma',
  initials: 'AS',
  colorClass: 'from-blue-500 to-blue-600'
}

const stories = [
  { id: 'write', label: 'Your Note', initials: currentUser.initials, colorClass: currentUser.colorClass, isAdd: true },
  { id: 's1', label: 'Priya P.', initials: 'PP', colorClass: 'from-violet-500 to-purple-600', ringClass: 'from-pink-500 via-red-500 to-yellow-500' },
  { id: 's2', label: 'Rahul M.', initials: 'RM', colorClass: 'from-emerald-500 to-teal-600', ringClass: 'from-pink-500 via-red-500 to-yellow-500' },
  { id: 's3', label: 'Coding Club', initials: 'CC', colorClass: 'from-blue-600 to-indigo-600', ringClass: 'from-blue-400 via-blue-500 to-indigo-500' },
  { id: 's4', label: 'Tech Fest', initials: 'TF', colorClass: 'from-orange-500 to-pink-600', ringClass: 'from-orange-400 via-pink-500 to-rose-500' },
  { id: 's5', label: 'Neha V.', initials: 'NV', colorClass: 'from-pink-500 to-rose-500', ringClass: 'from-pink-500 via-red-500 to-yellow-500' },
  { id: 'more', label: 'More', isMore: true }
]

const feedTabs = ['For You', 'Following', 'Campus', 'Clubs']

const typeConfig = {
  notes: { label: 'Notes', icon: FileText, color: 'text-blue-600 bg-blue-50' },
  event: { label: 'Event', icon: CalendarDays, color: 'text-orange-600 bg-orange-50' },
  club: { label: 'Club update', icon: Megaphone, color: 'text-indigo-600 bg-indigo-50' },
  marketplace: { label: 'Marketplace', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50' },
  lostfound: { label: 'Lost & Found', icon: PackageSearch, color: 'text-pink-600 bg-pink-50' }
}

const posts = [
  {
    id: 1,
    type: 'notes',
    name: 'Aarav Sharma',
    initials: 'AS',
    avatarColor: 'from-blue-500 to-blue-600',
    department: 'Computer Science',
    year: 'FY · B',
    college: 'Xavier Institute of Engineering',
    time: '2h ago',
    text: "Sharing my complete DBMS Unit 4 notes — covers normalization, trees and indexing. Hope this helps before tomorrow's viva.",
    file: { name: 'DBMS_Unit4_Trees.pdf', size: '2.4 MB' },
    likes: 214,
    comments: 38
  },
  {
    id: 2,
    type: 'event',
    name: 'Student Council',
    initials: 'SC',
    avatarColor: 'from-indigo-500 to-blue-600',
    department: 'Official',
    year: '',
    college: 'Xavier Institute of Engineering',
    time: '4h ago',
    text: 'Freshers Party is here — food, music and a lineup of performances. Tickets go live tonight at 8 PM.',
    event: { title: 'Freshers Party 2026', date: 'Aug 18 · 6:00 PM', location: 'Main Auditorium' },
    likes: 482,
    comments: 96
  },
  {
    id: 3,
    type: 'club',
    name: 'Coding Club',
    initials: 'CC',
    avatarColor: 'from-blue-600 to-indigo-600',
    department: 'Official Club',
    year: '',
    college: 'Xavier Institute of Engineering',
    time: '5h ago',
    text: 'Hackathon registrations close this Friday. Teams of up to 4 — sign up on the Events tab before slots run out.',
    likes: 156,
    comments: 24
  },
  {
    id: 4,
    type: 'marketplace',
    name: 'Priya Patel',
    initials: 'PP',
    avatarColor: 'from-violet-500 to-purple-600',
    department: 'Electronics',
    year: 'SY · A',
    college: 'Xavier Institute of Engineering',
    time: '7h ago',
    text: "Selling my barely-used drafter set and lab coat — moved to a branch that doesn't need them. Good condition.",
    marketplace: { item: 'Drafter Set + Lab Coat', price: '₹450' },
    likes: 32,
    comments: 11
  },
  {
    id: 5,
    type: 'lostfound',
    name: 'Rahul Mehta',
    initials: 'RM',
    avatarColor: 'from-emerald-500 to-teal-600',
    department: 'Mechanical',
    year: 'TY · C',
    college: 'Xavier Institute of Engineering',
    time: '9h ago',
    text: "Found a black wired earphone near the library entrance this morning. DM if it's yours with a description.",
    lostFound: { status: 'Found', location: 'Library Entrance' },
    likes: 19,
    comments: 6
  }
]

const bottomNavItems = [
  { id: 'home', label: 'Home', icon: Home, active: true },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'create', label: 'Create', icon: Plus, isCreate: true },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: User }
]

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                       */
/* ------------------------------------------------------------------ */

function Avatar({ initials, colorClass = 'from-blue-500 to-blue-600', size = 'md' }) {
  const sizes = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base'
  }

  return (
    <div
      className={`flex-shrink-0 rounded-full bg-gradient-to-br ${colorClass} ${sizes[size]} flex items-center justify-center text-white font-semibold select-none`}
    >
      {initials}
    </div>
  )
}

function StoryCircle({ story }) {
  if (story.isMore) {
    return (
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px]">
        <div className="w-16 h-16 rounded-full border-2 border-gray-200 bg-gray-50 flex items-center justify-center">
          <MoreHorizontal className="w-5 h-5 text-gray-400" />
        </div>
        <span className="text-[11px] text-gray-500 font-medium truncate w-full text-center">{story.label}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px]">
      <div
        className={`relative w-16 h-16 rounded-full p-[2.5px] ${
          story.isAdd ? 'border-2 border-dashed border-gray-300' : `bg-gradient-to-tr ${story.ringClass}`
        }`}
      >
        <div className="w-full h-full rounded-full bg-white p-[2px]">
          <div
            className={`w-full h-full rounded-full bg-gradient-to-br ${story.colorClass} flex items-center justify-center text-white text-sm font-semibold`}
          >
            {story.initials}
          </div>
        </div>
        {story.isAdd && (
          <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
            <Plus className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
        )}
      </div>
      <span className="text-[11px] text-gray-600 font-medium truncate w-full text-center">{story.label}</span>
    </div>
  )
}

function NavItem({ icon: ItemIcon, label, active, isCreate }) {
  return (
    <button type="button" aria-label={label} className="flex flex-col items-center justify-center py-1.5">
      {isCreate ? (
        <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
          <ItemIcon className="w-5 h-5 text-white" strokeWidth={2.4} />
        </span>
      ) : (
        <ItemIcon
          className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-400'} transition-all duration-300`}
          strokeWidth={active ? 2.3 : 1.8}
        />
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Home Page                                                          */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('For You')

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
              <Logo withwordnark className="w-8 h-8" />
            </div>

            <button
              type="button"
              aria-label="Notifications"
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
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Good morning, {currentUser.name.split(' ')[0]}
          </h1>
          <p className="mt-0.5 text-[13px] text-gray-400">Catch up on what's happening across campus.</p>

          <div className="relative mt-3.5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Campinity"
              className="w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Stories row                                               */}
        {/* -------------------------------------------------------- */}
        <section className="pb-3 border-b border-gray-100">
          <div className="flex items-start gap-3.5 px-4 overflow-x-auto scroll-hidden">
            {stories.map((story) => (
              <StoryCircle key={story.id} story={story} />
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- */}
        {/* Feed tabs                                                 */}
        {/* -------------------------------------------------------- */}
        <nav className="sticky top-14 z-30 flex items-center bg-white border-b border-gray-100">
          {feedTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[13px] font-semibold text-center border-b-2 transition-all duration-300 ${
                activeTab === tab
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-400 border-transparent hover:text-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* -------------------------------------------------------- */}
        {/* Feed                                                      */}
        {/* -------------------------------------------------------- */}
        <main className="pb-24">
          {posts.map((post) => {
            const config = typeConfig[post.type]
            const TypeIcon = config.icon

            return (
              <article key={post.id} className="border-b border-gray-100 hover:bg-gray-50/40 transition-all duration-300">
                <div className="flex items-start gap-3 px-4 pt-4">
                  <Avatar initials={post.initials} colorClass={post.avatarColor} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{post.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {post.department}
                          {post.year && ` · ${post.year}`} · {post.college}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Post options"
                        className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-all duration-300"
                      >
                        <MoreHorizontal className="w-[18px] h-[18px]" />
                      </button>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${config.color}`}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                      <span className="text-[11px] text-gray-400">{post.time}</span>
                    </div>
                  </div>
                </div>

                <p className="px-4 mt-3 text-[14.5px] text-gray-700 leading-relaxed">{post.text}</p>

                {post.type === 'notes' && (
                  <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{post.file.name}</p>
                      <p className="text-xs text-gray-400">{post.file.size}</p>
                    </div>
                    <Download className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </div>
                )}

                {post.type === 'event' && (
                  <div className="mx-4 mt-3 rounded-xl overflow-hidden border border-gray-100">
                    <div className="h-28 bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                      <CalendarDays className="w-8 h-8 text-white/80" />
                    </div>
                    <div className="p-3 bg-white">
                      <p className="text-sm font-semibold text-gray-900">{post.event.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {post.event.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {post.event.location}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {post.type === 'marketplace' && (
                  <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-gray-100 p-3">
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-6 h-6 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{post.marketplace.item}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{post.marketplace.price}</p>
                    </div>
                  </div>
                )}

                {post.type === 'lostfound' && (
                  <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-pink-100 bg-pink-50/50 p-3">
                    <PackageSearch className="w-5 h-5 text-pink-500 flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-900 min-w-0">
                      {post.lostFound.status} near {post.lostFound.location}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-5 px-4 py-3 mt-1">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-all duration-300"
                  >
                    <Heart className="w-[18px] h-[18px]" />
                    {post.likes}
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-all duration-300"
                  >
                    <MessageCircle className="w-[18px] h-[18px]" />
                    {post.comments}
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-all duration-300 ml-auto"
                  >
                    <Share2 className="w-[18px] h-[18px]" />
                    Share
                  </button>
                </div>
              </article>
            )
          })}
        </main>
      </div>

      {/* -------------------------------------------------------- */}
      {/* Bottom mobile navigation — sticky, centered to match column */}
      {/* -------------------------------------------------------- */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-[480px] lg:max-w-[520px] bg-white/95 backdrop-blur-md border-t border-gray-100"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5 items-center px-2 py-2">
          {bottomNavItems.map((item) => (
            <NavItem key={item.id} icon={item.icon} label={item.label} active={item.active} isCreate={item.isCreate} />
          ))}
        </div>
      </nav>
    </div>
  )
}
