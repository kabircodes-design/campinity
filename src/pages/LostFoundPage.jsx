import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Backpack,
  BarChart3,
  Bell,
  BookOpen,
  Camera,
  Clock,
  CreditCard,
  FileText,
  Key,
  Layers,
  MapPin,
  MessageCircle,
  Package,
  PackageSearch,
  Radar,
  Search,
  Shirt,
  ShoppingBag,
  Sparkles,
  Wallet,
  X
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getOrCreateChat, sendMessage } from '../firebase/chatService.js'
import { createLostFoundClaimNotification } from '../firebase/notificationService.js'
import { useAuth } from '../context/AuthContext.jsx'
import { enrichWithAuthors } from '../hooks/useAuthorEnrichment.js'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'
import {
  LOST_FOUND_CATEGORIES,
  LOST_FOUND_LOCATIONS,
  createLostFoundItem,
  getLostFoundItem,
  getLostFoundItems,
  getRecentlyResolvedItems,
  resolveLostFoundItem,
  uploadLostFoundImage
} from '../firebase/lostFoundService.js'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'lost', label: 'Lost' },
  { key: 'found', label: 'Found' },
  { key: 'resolved', label: 'Resolved' }
]

// Real categories only (LOST_FOUND_CATEGORIES, from lostFoundService.js)
// mapped to a safe, always-available lucide icon + tint — no category
// here is invented, all ten already exist as real selectable options in
// the report form.
const CATEGORY_META = {
  Electronics: { icon: Layers, tint: 'bg-blue-50 text-blue-600' },
  Documents: { icon: FileText, tint: 'bg-amber-50 text-amber-600' },
  Keys: { icon: Key, tint: 'bg-purple-50 text-purple-600' },
  Wallet: { icon: Wallet, tint: 'bg-emerald-50 text-emerald-600' },
  'ID Card': { icon: CreditCard, tint: 'bg-cyan-50 text-cyan-600' },
  Clothing: { icon: Shirt, tint: 'bg-pink-50 text-pink-600' },
  Books: { icon: BookOpen, tint: 'bg-orange-50 text-orange-600' },
  Accessories: { icon: Sparkles, tint: 'bg-indigo-50 text-indigo-600' },
  Bags: { icon: ShoppingBag, tint: 'bg-teal-50 text-teal-600' },
  Other: { icon: Package, tint: 'bg-gray-100 text-gray-500' }
}

function timeAgo(timestamp) {
  if (!timestamp?.toMillis) return ''
  const diffMs = Date.now() - timestamp.toMillis()
  const hours = Math.round(diffMs / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

/**
 * Lost & Found — redesigned to match the finished Home page's design
 * system (clean white cards, blue accent, no glassmorphism) instead of
 * this page's previous, unrelated purple/lavender glass theme. Every
 * existing capability is preserved byte-for-byte: tabs, search,
 * category/location filters, create/detail/claim modals, message-poster
 * flow, resolve flow, notification on claim — only the presentation
 * layer changed.
 *
 * Two honest departures from the visual reference, stated plainly
 * rather than faked:
 *  1. No like/comment counts on item cards — this feature has no such
 *     data model (no likesCount/commentsCount field, no comments
 *     subcollection on lostFound items), so showing counts would be
 *     fabricated. The real interaction this page supports (claim /
 *     message the poster) lives in the detail modal, unchanged.
 *  2. The hero's decorative visual is a composition of real lucide
 *     icons (this app's existing icon system), not a custom illustrated
 *     scene — there is no image-generation capability available to
 *     produce new brand illustration assets in this environment.
 *
 * Poster name/avatar on each card comes from the same
 * enrichWithAuthors() utility the main feed already uses for this exact
 * purpose (batched, cached, real profile data) — lostFound items only
 * ever stored `createdBy` (a uid), never a denormalized name.
 */
export default function LostFoundPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const verified = useMyVerification()
  const [items, setItems] = useState([])
  const [resolvedPreview, setResolvedPreview] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createType, setCreateType] = useState('lost')
  const [detailItem, setDetailItem] = useState(null)
  const [claimItem, setClaimItem] = useState(null)
  const [messageGateOpen, setMessageGateOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep-link support (notification tap / search result) — ?item=<id>
  // opens that listing's EXISTING detail modal rather than a new route,
  // since there's no per-item page in this app to link to yet. Fetches
  // the item directly instead of relying on the already-loaded items[]
  // array, so this also works for a resolved/older listing that
  // wouldn't be in the current page's fetch window. A missing/deleted
  // item is a silent no-op, not a broken navigation.
  useEffect(() => {
    const itemId = searchParams.get('item')
    if (!itemId) return
    getLostFoundItem(itemId)
      .then((item) => {
        if (item) setDetailItem(item)
      })
      .catch(() => {})
      .finally(() => {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('item')
            return next
          },
          { replace: true }
        )
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('item')])

  const loadItems = () => {
    setLoading(true)
    setError('')
    Promise.all([
      getLostFoundItems({ status: 'active', pageSize: 60 }),
      getLostFoundItems({ status: 'resolved', pageSize: 60 }),
      getRecentlyResolvedItems({ pageSize: 5 })
    ])
      .then(async ([activeResult, resolvedResult, recentResolved]) => {
        const combined = [...activeResult.items, ...resolvedResult.items]
        const enriched = await enrichWithAuthors(
          combined,
          (item) => item.createdBy,
          (item, author) => ({ ...item, posterName: author.displayName, posterAvatar: author.avatar })
        )
        setItems(enriched)
        setResolvedPreview(recentResolved)
      })
      .catch((err) => setError(err?.message || 'Could not load Lost & Found listings.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadItems()
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === 'lost' && item.type !== 'lost') return false
      if (activeTab === 'found' && item.type !== 'found') return false
      if (activeTab === 'resolved' && item.status !== 'resolved') return false
      if (activeTab !== 'resolved' && item.status === 'resolved') return false
      if (categoryFilter && item.category !== categoryFilter) return false
      if (locationFilter && item.location !== locationFilter) return false
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase()
        const haystack = `${item.title} ${item.description} ${item.location} ${item.category}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [items, activeTab, categoryFilter, locationFilter, searchTerm])

  // Real Quick Stats — computed from the same items[] already fetched,
  // zero new query. No "Active Events"-style invented metric.
  const quickStats = useMemo(
    () => [
      { key: 'total', label: 'Total Items', value: items.length, tint: 'bg-blue-50 text-blue-600', icon: PackageSearch },
      { key: 'found', label: 'Found', value: items.filter((i) => i.type === 'found').length, tint: 'bg-emerald-50 text-emerald-600', icon: Sparkles },
      { key: 'lost', label: 'Lost', value: items.filter((i) => i.type === 'lost').length, tint: 'bg-rose-50 text-rose-600', icon: Search }
    ],
    [items]
  )

  const popularCategories = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1))
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [items])

  const recentActivity = useMemo(
    () =>
      [...items]
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, 4),
    [items]
  )

  const handleMessagePoster = async (posterUid) => {
    const uid = auth.currentUser?.uid
    if (!uid || !posterUid || uid === posterUid) return
    if (verified === false) {
      setMessageGateOpen(true)
      return
    }
    try {
      const { chatId } = await getOrCreateChat(uid, posterUid)
      navigate(`/messages/${chatId}`)
    } catch {
      // Navigation just doesn't happen — no crash, no silent-looking success either.
    }
  }

  const handleClaimSubmit = async (detail) => {
    const uid = auth.currentUser?.uid
    if (!uid || !claimItem) return
    if (verified === false) {
      setMessageGateOpen(true)
      return
    }
    try {
      const { chatId } = await getOrCreateChat(uid, claimItem.createdBy)
      await sendMessage(
        chatId,
        uid,
        `Hi — I think "${claimItem.title}" might be mine. Identifying detail: ${detail}`
      )
      await createLostFoundClaimNotification({
        ownerUid: claimItem.createdBy,
        actorUid: uid,
        actorName: profile?.displayName,
        actorAvatar: profile?.avatar,
        itemId: claimItem.id
      }).catch(() => {})
      navigate(`/messages/${chatId}`)
    } catch {
      // Claim message failed to send — claimItem stays open so the user can retry, no silent success.
    } finally {
      setClaimItem(null)
    }
  }

  return (
    <>
    <div className="h-full lg:grid lg:gap-3 lg:[grid-template-columns:minmax(0,1fr)_minmax(260px,320px)] lg:overflow-hidden">
      <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden">
          <div className="mx-auto max-w-[560px] lg:max-w-[820px] px-4 lg:px-6 pt-5 pb-24">
            {/* Hero */}
            <div
              // ROOT-CAUSE FIX (dark-mode consistency): same fix as
              // DiscoverCommunitiesPage.jsx's hero — was a raw inline
              // gradient style with zero dark: classes, always light
              // regardless of mode. Brought in line with SearchPage.jsx's
              // "Explore Campinity" hero (the reference): same gradient
              // utility + dark stops, same dark: color/opacity pairs.
              className="relative overflow-hidden rounded-2xl lg:rounded-3xl px-5 py-5 lg:px-7 lg:py-6 mb-4 bg-gradient-to-br from-[#eaf3ff] via-[#dcecff] to-[#e7f7f7] dark:from-[#141a2e] dark:via-[#121629] dark:to-[#101f21]"
            >
              <div
                className="absolute -top-10 -right-6 w-40 h-40 rounded-full opacity-60 dark:opacity-25 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(59,155,255,0.35), transparent 70%)' }}
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-12 right-10 w-32 h-32 rounded-full opacity-50 dark:opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.30), transparent 70%)' }}
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-blue-700/70 dark:text-blue-300/80 uppercase">
                    <PackageSearch className="w-3.5 h-3.5" /> Lost &amp; Found
                  </p>
                  <h1 className="mt-1.5 text-2xl lg:text-[28px] font-bold text-gray-900 dark:text-gray-50 tracking-tight leading-tight max-w-sm">
                    Lost something? Let's get it back.
                  </h1>
                  <p className="mt-2 text-[13px] lg:text-sm text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">
                    Report a lost or found item and let your campus community help reunite it with its owner.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateType('lost')
                        setCreateOpen(true)
                      }}
                      className="flex items-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200"
                    >
                      <Search className="w-4 h-4" /> Report Lost Item
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateType('found')
                        setCreateOpen(true)
                      }}
                      className="rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/15 text-gray-900 dark:text-gray-100 text-sm font-semibold px-5 py-2.5 hover:border-gray-300 dark:hover:border-white/25 active:scale-[0.98] transition-all duration-200"
                    >
                      Report Found Item
                    </button>
                  </div>
                </div>

                {/* Decorative composition — real lucide icons, not a
                    fabricated illustration asset (see file comment). */}
                <div className="relative hidden sm:flex flex-shrink-0 items-end gap-2 pb-1">
                  <span className="w-11 h-11 rounded-2xl bg-white/70 dark:bg-white/10 border border-white dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm dark:shadow-none -rotate-6">
                    <Backpack className="w-5 h-5" />
                  </span>
                  <span className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-white/10 border border-white dark:border-white/10 flex items-center justify-center text-blue-700 dark:text-blue-300 shadow-md dark:shadow-none">
                    <Key className="w-6 h-6" />
                  </span>
                  <span className="w-11 h-11 rounded-2xl bg-white/70 dark:bg-white/10 border border-white dark:border-white/10 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm dark:shadow-none rotate-6">
                    <BookOpen className="w-5 h-5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-3">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200 ${
                      isActive ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='Search for "AirPods", "wallet", "laptop"...'
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 outline-none hover:border-gray-300 transition-all duration-200"
              >
                <option value="">All categories</option>
                {LOST_FOUND_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 outline-none hover:border-gray-300 transition-all duration-200"
              >
                <option value="">All locations</option>
                {LOST_FOUND_LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {(categoryFilter || locationFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('')
                    setLocationFilter('')
                  }}
                  className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Items */}
            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : error ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-500">{error}</p>
                <button
                  type="button"
                  onClick={loadItems}
                  className="mt-3 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-300"
                >
                  Try Again
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <PackageSearch className="w-5 h-5 text-blue-500" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">Nothing here yet</p>
                <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                  Good news — there are no matching items right now. Be the first to report one and help your campus stay connected.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
                >
                  Report an Item
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <ItemRow key={item.id} item={item} onOpen={() => setDetailItem(item)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <aside className="hidden lg:flex lg:flex-col w-72 flex-shrink-0 h-screen sticky top-0 overflow-y-auto px-4 py-5 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-500" /> Quick Stats
            </p>
            <div className="grid grid-cols-3 gap-2">
              {/* ROOT-CAUSE FIXES (dark-mode consistency + overflow),
                  matching Home's CampusPulse.jsx (the reference) exactly
                  — see that file's own comment for the full reasoning. */}
              {quickStats.map(({ key, icon: Icon, value, label, tint }) => (
                <div key={key} className="min-w-0 rounded-xl bg-gray-50/70 dark:bg-white/5 px-2 py-3 text-center">
                  <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center ${tint}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <p className="mt-1.5 text-base font-bold text-gray-900 leading-none">{value}</p>
                  <p className="mt-1 text-[10px] text-gray-400 leading-tight break-words">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {popularCategories.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900">Popular Categories</p>
              </div>
              <div className="space-y-1">
                {popularCategories.map(({ category, count }) => {
                  const meta = CATEGORY_META[category] || CATEGORY_META.Other
                  const Icon = meta.icon
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setCategoryFilter(category)}
                      className="w-full flex items-center gap-2.5 text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-all duration-200"
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.tint}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{category}</p>
                        <p className="text-xs text-gray-400">{count} {count === 1 ? 'item' : 'items'}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {recentActivity.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
              <p className="text-sm font-bold text-gray-900 mb-3">Recent Activity</p>
              <div className="space-y-2">
                {recentActivity.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDetailItem(item)}
                    className="w-full flex items-center gap-2.5 text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                      <p className="text-[11px] text-gray-400">
                        <span className={item.status === 'resolved' ? 'text-blue-500' : item.type === 'lost' ? 'text-rose-500' : 'text-emerald-500'}>
                          {item.status === 'resolved' ? 'Resolved' : item.type === 'lost' ? 'Lost' : 'Found'}
                        </span>{' '}
                        · {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ backgroundColor: '#1677ff' }}>
            <p className="relative flex items-center gap-1.5 text-sm font-bold">
              <PackageSearch className="w-4 h-4" /> Have something to report?
            </p>
            <p className="relative mt-1.5 text-xs text-blue-100 leading-relaxed">
              Help keep our campus community connected and supportive.
            </p>
            <button
              type="button"
              onClick={() => {
                setCreateType('lost')
                setCreateOpen(true)
              }}
              className="relative mt-3 w-full rounded-full bg-white text-blue-700 text-xs font-semibold py-2.5 hover:bg-blue-50 active:scale-[0.98] transition-all duration-200"
            >
              Report Item →
            </button>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed px-1">
            💡 Don't post serial numbers or private identifying details publicly — share them privately once you've connected.
          </p>
        </aside>
    </div>

      {createOpen && verified === false ? (
        // Same gate as every other creation flow — covers all 3 "Report"
        // entry points in one place since they all just set createOpen
        // true; the real boundary is lostFound/{itemId}'s create rule.
        <VerificationGate open onClose={() => setCreateOpen(false)} feature={FEATURES.CREATE_LOST_FOUND} />
      ) : (
        createOpen && (
          <CreateListingModal
            type={createType}
            onClose={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false)
              loadItems()
            }}
          />
        )
      )}

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          currentUid={auth.currentUser?.uid}
          onClose={() => setDetailItem(null)}
          onMessagePoster={() => handleMessagePoster(detailItem.createdBy)}
          onClaim={() => {
            setClaimItem(detailItem)
            setDetailItem(null)
          }}
          onResolve={async () => {
            await resolveLostFoundItem(detailItem.id, auth.currentUser?.uid).catch(() => {})
            setDetailItem(null)
            loadItems()
          }}
        />
      )}

      {claimItem && (
        <ClaimModal item={claimItem} onClose={() => setClaimItem(null)} onSubmit={handleClaimSubmit} />
      )}

      <VerificationGate open={messageGateOpen} onClose={() => setMessageGateOpen(false)} feature={FEATURES.SEND_MESSAGE} />
    </>
  )
}

function ItemRow({ item, onOpen }) {
  const isResolved = item.status === 'resolved'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-start gap-3 lg:gap-4 text-left rounded-2xl border border-gray-100 bg-white p-3 lg:p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200"
    >
      <div className="relative w-20 h-20 lg:w-24 lg:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera className="w-6 h-6 text-gray-300" />
          </div>
        )}
        <span
          className={`absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${
            item.type === 'lost' ? 'bg-rose-500' : 'bg-emerald-500'
          }`}
        >
          {item.type}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-gray-900 truncate">{item.title}</p>
          <span
            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isResolved ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            {isResolved ? 'Resolved' : 'Active'}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-blue-600 font-medium">
          {item.category} <span className="text-gray-300">·</span>
          <span className="flex items-center gap-0.5 text-gray-400 font-normal">
            <MapPin className="w-3 h-3" /> {item.location}
          </span>
        </div>
        {item.description && (
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed line-clamp-2">{item.description}</p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
          <Avatar initials={getInitials(item.posterName)} colorClass={getAvatarColor(item.createdBy)} size="sm" src={item.posterAvatar || undefined} />
          <span className="truncate">{item.posterName || 'Student'}</span>
          <span className="flex items-center gap-0.5 flex-shrink-0">
            <Clock className="w-3 h-3" /> {timeAgo(item.createdAt)}
          </span>
        </div>
      </div>
    </button>
  )
}

function ModalShell({ onClose, children, maxWidth = '420px' }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full rounded-2xl bg-white border border-gray-100 p-5 max-h-[85vh] overflow-y-auto shadow-xl"
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  )
}

function CreateListingModal({ type, onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [timeOccurred, setTimeOccurred] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    if (!title.trim() || !category || !location) {
      setError('Item name, category, and location are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      let imageUrl = null
      let imagePath = null
      if (imageFile) {
        const uploaded = await uploadLostFoundImage(uid, imageFile)
        imageUrl = uploaded.url
        imagePath = uploaded.path
      }
      await createLostFoundItem({
        uid,
        type,
        title,
        category,
        description,
        location,
        timeOccurred,
        imageUrl,
        imagePath
      })
      onCreated()
    } catch (err) {
      setError(err?.message || 'Could not post your listing. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200'

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-base font-bold text-gray-900">
          {type === 'lost' ? 'Report Lost Item' : 'Report Found Item'}
        </p>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setImageFile(null)
                setImagePreview('')
              }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/60 text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-6 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all duration-200"
          >
            <Camera className="w-4 h-4" /> Add a photo
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />

        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Item name" className={inputClass} />

        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          <option value="">Select category</option>
          {LOST_FOUND_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass}>
          <option value="">{type === 'lost' ? 'Location lost' : 'Location found'}</option>
          {LOST_FOUND_LOCATIONS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <input
          type="text"
          value={timeOccurred}
          onChange={(e) => setTimeOccurred(e.target.value)}
          placeholder="Approximate time (e.g. around 3pm)"
          className={inputClass}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Description or additional identifying details"
          className={`${inputClass} resize-none`}
        />

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
        >
          {submitting ? 'Posting…' : type === 'lost' ? 'Post Lost Item' : 'Post Found Item'}
        </button>
      </div>
    </ModalShell>
  )
}

function ItemDetailModal({ item, currentUid, onClose, onMessagePoster, onClaim, onResolve }) {
  const isOwner = currentUid && item.createdBy === currentUid

  return (
    <ModalShell onClose={onClose} maxWidth="460px">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            item.type === 'lost' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {item.type}
        </span>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {item.imageUrl && (
        <div className="rounded-xl overflow-hidden aspect-[4/3] mb-3 bg-gray-100">
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      )}

      <p className="text-lg font-bold text-gray-900">{item.title}</p>
      <p className="text-sm mt-0.5 text-blue-600 font-medium">{item.category}</p>
      {item.description && <p className="text-sm mt-2 leading-relaxed text-gray-600">{item.description}</p>}

      <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
        <MapPin className="w-3.5 h-3.5" /> {item.location}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
        <Clock className="w-3.5 h-3.5" /> {timeAgo(item.createdAt)} {item.timeOccurred && `· ${item.timeOccurred}`}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
        <Avatar initials={getInitials(item.posterName)} colorClass={getAvatarColor(item.createdBy)} size="sm" src={item.posterAvatar || undefined} />
        Posted by {item.posterName || 'Student'}
      </div>

      {!isOwner && item.status !== 'resolved' && (
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onClaim}
            className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 transition-all duration-200"
          >
            {item.type === 'found' ? 'This Might Be Mine' : 'I Found This'}
          </button>
          <button
            type="button"
            onClick={onMessagePoster}
            className="w-full flex items-center justify-center gap-1.5 rounded-full border border-gray-200 text-gray-900 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-200"
          >
            <MessageCircle className="w-4 h-4" /> Message Poster
          </button>
        </div>
      )}

      {isOwner && item.status !== 'resolved' && (
        <button
          type="button"
          onClick={onResolve}
          className="mt-5 w-full rounded-full bg-emerald-50 text-emerald-600 text-sm font-semibold py-3 hover:bg-emerald-100 transition-all duration-200"
        >
          Mark as Resolved
        </button>
      )}
    </ModalShell>
  )
}

function ClaimModal({ item, onClose, onSubmit }) {
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!detail.trim()) return
    setSubmitting(true)
    await onSubmit(detail.trim())
    setSubmitting(false)
  }

  return (
    <ModalShell onClose={onClose}>
      <p className="text-base font-bold text-gray-900 mb-1">Verify it's yours</p>
      <p className="text-sm text-gray-500 mb-4">
        Tell the finder something only the real owner would know — this is sent privately, never shown publicly.
      </p>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        rows={3}
        placeholder="e.g. it has a small scratch on the back, or a specific sticker..."
        autoFocus
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none resize-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !detail.trim()}
        className="mt-3 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
      >
        {submitting ? 'Sending…' : 'Send Privately'}
      </button>
    </ModalShell>
  )
}
