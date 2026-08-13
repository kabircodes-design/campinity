import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Bell, ChevronDown, Compass, Grid3x3, Heart, Home, MapPin, MessageCircle,
  Package, Search, Settings, ShoppingBag, Sparkles, Star, Tag, TrendingUp
} from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import {
  MOCK_CAMPUS, MOCK_CATEGORIES, MOCK_FLASH_DEALS, MOCK_SPONSORED, MOCK_STORES, MOCK_STUDENT_NAME
} from './mockAdsData.js'

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'explore', label: 'Explore Stores', icon: Compass },
  { key: 'categories', label: 'Categories', icon: Grid3x3 },
  { key: 'deals', label: 'Top Deals', icon: Tag },
  { key: 'orders', label: 'My Orders', icon: Package },
  { key: 'wishlist', label: 'Wishlist', icon: Heart },
  { key: 'messages', label: 'Messages', icon: MessageCircle }
]

/**
 * PROTOTYPE ONLY — visual/interactive mockup, no real backend. Every
 * card here reads from mockAdsData.js, isolated mock data. This is a
 * deliberately separate route (/ads) from the real, working
 * /marketplace built in the previous session — that feature has a
 * genuine Firestore-backed products collection and must not be
 * overwritten by dummy UI.
 */
export default function AdsDiscoveryPage() {
  const navigate = useNavigate()
  const [savedIds, setSavedIds] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [toast, setToast] = useState('')

  const toggleSave = (id) => {
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const showToast = (msg) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2000)
  }

  const categoryPills = ['all', ...MOCK_CATEGORIES.map((c) => c.key)]
  const categoryLabel = (key) => (key === 'all' ? 'All' : MOCK_CATEGORIES.find((c) => c.key === key)?.label.split(' ')[0])

  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden bg-gray-50">
      {/* Desktop sidebar — local to this prototype, deliberately not
          reusing the real DesktopSidebar.jsx since these nav items
          are entirely ads/marketplace-specific, not the real app's
          navigation. */}
      <nav className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 h-screen sticky top-0 border-r border-gray-100 px-3 py-5">
        <div className="flex items-center gap-2 px-3 mb-6">
          <span className="text-lg font-bold text-blue-600 tracking-tight">Campinity Ads</span>
        </div>
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 text-left ${
                key === 'home' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
        <div className="mt-auto space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-4 text-white">
            <p className="text-sm font-bold">Earn with Campinity</p>
            <p className="mt-1 text-xs text-indigo-100 leading-relaxed">Promote stores, earn commissions through affiliate links.</p>
            <button type="button" onClick={() => showToast('Prototype only — affiliate program coming soon')} className="mt-3 w-full rounded-full bg-white text-indigo-700 text-xs font-semibold py-2 hover:bg-indigo-50 transition-all duration-200">
              Start Earning
            </button>
          </div>
          <button type="button" className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <Settings className="w-5 h-5" /> Settings
          </button>
        </div>
      </nav>

      <div className="flex-1 min-h-screen lg:h-screen lg:overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-[480px] lg:max-w-[900px] bg-white lg:bg-transparent min-h-screen lg:min-h-0">
          {/* Mobile header */}
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 lg:hidden">
            <div className="h-14 flex items-center gap-2 px-3">
              <button type="button" aria-label="Back" onClick={() => navigate('/home')} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-base font-bold tracking-tight text-blue-600">Campinity Ads</span>
              <div className="ml-auto flex items-center gap-1">
                <button type="button" aria-label="Search" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
                  <Search className="w-5 h-5" />
                </button>
                <button type="button" aria-label="Notifications" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
                  <Bell className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-3 pb-2 flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5" /> {MOCK_CAMPUS} <ChevronDown className="w-3 h-3" />
            </div>
          </header>

          <div className="px-4 lg:px-0 py-4">
            <h1 className="text-xl font-bold text-gray-900">Hey {MOCK_STUDENT_NAME}! 👋</h1>
            <p className="text-sm text-gray-400">Explore stores near your campus</p>

            <div className="relative mt-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search stores, products..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
              />
            </div>

            <div className="flex items-center gap-2 mt-4 overflow-x-auto scroll-hidden">
              {categoryPills.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                    activeCategory === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {categoryLabel(key)}
                </button>
              ))}
            </div>

            {/* Hero banner */}
            <div className="relative mt-4 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <span className="inline-block rounded-full bg-white/20 text-[11px] font-semibold px-2.5 py-1">Limited Time Offer!</span>
              <p className="mt-2 text-2xl font-bold">Up to 40% OFF</p>
              <p className="mt-1 text-sm text-indigo-100">On selected products from top campus stores</p>
              <button type="button" onClick={() => showToast('Prototype only')} className="mt-4 rounded-full bg-white text-indigo-700 text-sm font-semibold px-4 py-2 hover:bg-indigo-50 transition-all duration-200">
                Shop Now
              </button>
            </div>

            {/* Near College Stores */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900">Near College Stores</p>
                <button type="button" className="text-xs font-semibold text-blue-600">See all</button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {MOCK_STORES.map((store) => (
                  <div key={store.id} className="rounded-2xl border border-gray-100 overflow-hidden hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200">
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl">
                      {store.emoji}
                      <span className="absolute top-2 left-2 rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">🔥 {store.offer}</span>
                      <button
                        type="button"
                        aria-label="Save"
                        onClick={() => toggleSave(store.id)}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center"
                      >
                        <Heart className="w-3.5 h-3.5" fill={savedIds.includes(store.id) ? '#ef4444' : 'none'} stroke={savedIds.includes(store.id) ? '#ef4444' : '#9ca3af'} />
                      </button>
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{store.name}</p>
                      <p className="text-[11px] text-gray-400">{store.distance}</p>
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-500">
                        <Star className="w-3 h-3 text-amber-400" fill="#fbbf24" /> {store.rating} ({store.reviews}) · {store.category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Flash Deals */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Flash Deals
                </p>
                <button type="button" className="text-xs font-semibold text-blue-600">View all</button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {MOCK_FLASH_DEALS.map((deal) => (
                  <div key={deal.id} className="rounded-2xl border border-gray-100 p-3 hover:shadow-sm transition-all duration-200">
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-3xl mb-2">
                      {deal.emoji}
                    </div>
                    <p className="text-xs font-semibold text-gray-900 truncate">{deal.name}</p>
                    <p className="text-[11px] text-gray-400">{deal.brand}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-bold text-gray-900">₹{deal.price.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] text-gray-400 line-through">₹{deal.originalPrice.toLocaleString('en-IN')}</span>
                    </div>
                    <span className="inline-block mt-1 text-[10px] font-semibold text-green-600">{deal.discount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right rail — desktop only */}
      <aside className="hidden lg:flex lg:flex-col w-80 flex-shrink-0 h-screen sticky top-0 overflow-y-auto px-4 py-5 gap-4">
        <div className="rounded-2xl border border-gray-100 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" /> Sponsored Stores
          </p>
          <div className="space-y-2.5">
            {MOCK_SPONSORED.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">{s.emoji}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-900 truncate">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{s.distance}</p>
                </div>
                <span className="text-[10px] font-semibold text-red-500 flex-shrink-0">{s.offer}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-900 mb-2">Top Categories</p>
          <div className="space-y-2">
            {MOCK_CATEGORIES.map((c) => (
              <div key={c.key} className="flex items-center gap-2.5 text-xs text-gray-600">
                <span>{c.emoji}</span> {c.label}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white relative overflow-hidden">
          <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <p className="relative flex items-center gap-1.5 text-sm font-bold">
            <ShoppingBag className="w-4 h-4" /> Sell on Campinity
          </p>
          <p className="relative mt-1.5 text-xs text-blue-100 leading-relaxed">Reach thousands of students near your store.</p>
          <button
            type="button"
            onClick={() => navigate('/ads/dashboard')}
            className="relative mt-3 w-full rounded-full bg-white text-blue-700 text-xs font-semibold py-2.5 hover:bg-blue-50 transition-all duration-200"
          >
            Partner With Us
          </button>
        </div>
      </aside>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[9999] rounded-full bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
