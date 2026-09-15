import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Backpack,
  BarChart3,
  BookOpen,
  Briefcase,
  Laptop,
  Package,
  Plus,
  Search,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tag,
  UtensilsCrossed
} from 'lucide-react'
import ProductCard from '../components/ProductCard.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getMarketplaceProducts, CATEGORIES } from '../firebase/marketplaceService.js'
import { getCollegeById } from '../data/dummyColleges.js'
import { useAuth } from '../context/AuthContext.jsx'

// Real categories only (marketplaceService.CATEGORIES, the same list
// CreateProductPage already writes into every product) mapped to a
// safe, always-available lucide icon + tint — nothing here is invented.
const CATEGORY_META = {
  Fashion: { icon: Shirt, tint: 'bg-pink-50 text-pink-600' },
  Food: { icon: UtensilsCrossed, tint: 'bg-orange-50 text-orange-600' },
  Electronics: { icon: Laptop, tint: 'bg-blue-50 text-blue-600' },
  Books: { icon: BookOpen, tint: 'bg-amber-50 text-amber-600' },
  Services: { icon: Briefcase, tint: 'bg-purple-50 text-purple-600' },
  'College Essentials': { icon: Backpack, tint: 'bg-teal-50 text-teal-600' },
  Other: { icon: Package, tint: 'bg-gray-100 text-gray-500' }
}

/**
 * Full premium redesign of the Marketplace — same design system as the
 * finished Home / Lost & Found pages (clean white surfaces, blue accent,
 * no glassmorphism, no dark theme). Every existing capability is
 * preserved: real Firestore products, category filtering, Add Product
 * flow, product detail navigation.
 *
 * Deliberately does NOT show fake ads, fake distances, fake ratings or
 * a fake "stores" entity — none of that data exists in this app's real
 * backend. "Sponsored" and "From Your Campus" are both wired to real
 * fields (product.sponsored, product.collegeId) and simply render
 * nothing when there is no real data behind them yet, per the explicit
 * "advertising-ready architecture, never fake ads" instruction.
 */
export default function MarketplacePage() {
  const navigate = useNavigate()
  // profile now comes from the shared AuthContext (see AppShell.jsx) —
  // this page previously fetched it independently just to feed a
  // header/sidebar it no longer renders itself.
  const { profile } = useAuth()
  const [myCollegeName, setMyCollegeName] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!profile?.collegeId) return
    let cancelled = false
    getCollegeById(profile.collegeId)
      .then((college) => {
        if (!cancelled && college?.name) setMyCollegeName(college.name)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [profile?.collegeId])

  const load = () => {
    setLoading(true)
    setError('')
    getMarketplaceProducts()
      .then(setProducts)
      .catch((err) => {
        console.error('Could not load marketplace:', err)
        setError("Couldn't load the marketplace.")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const searched = useMemo(() => {
    if (!normalizedSearch) return products
    return products.filter((p) => {
      const haystack = `${p.name} ${p.description} ${p.sellerName} ${p.category}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [products, normalizedSearch])

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return searched
    return searched.filter((p) => p.category === activeCategory)
  }, [searched, activeCategory])

  const sponsoredProducts = useMemo(() => products.filter((p) => p.sponsored), [products])

  const uid = auth.currentUser?.uid
  const campusProducts = useMemo(() => {
    if (!profile?.collegeId) return []
    return products.filter((p) => p.collegeId === profile.collegeId && p.sellerId !== uid).slice(0, 8)
  }, [products, profile?.collegeId, uid])

  const categoryCounts = useMemo(() => {
    const counts = new Map()
    products.forEach((p) => counts.set(p.category, (counts.get(p.category) || 0) + 1))
    return counts
  }, [products])

  const quickStats = useMemo(
    () => [
      { key: 'total', label: 'Listings', value: products.length, tint: 'bg-blue-50 text-blue-600', icon: ShoppingBag },
      { key: 'categories', label: 'Categories', value: categoryCounts.size, tint: 'bg-emerald-50 text-emerald-600', icon: Tag },
      {
        key: 'today',
        label: 'Listed Today',
        value: products.filter((p) => p.createdAtMs && Date.now() - p.createdAtMs < 86400000).length,
        tint: 'bg-pink-50 text-pink-600',
        icon: Sparkles
      }
    ],
    [products, categoryCounts]
  )

  const popularCategories = useMemo(
    () =>
      Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    [categoryCounts]
  )

  const recentListings = useMemo(
    () => [...products].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, 4),
    [products]
  )

  const gridTitle = normalizedSearch
    ? `Results for "${searchTerm.trim()}"`
    : activeCategory === 'All'
      ? 'All Products'
      : activeCategory

  return (
    <div className="h-full lg:grid lg:gap-3 lg:[grid-template-columns:minmax(0,1fr)_minmax(260px,320px)] lg:overflow-hidden">
      <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden">
          <div className="mx-auto max-w-[560px] lg:max-w-[860px] px-4 lg:px-6 pt-5 pb-24">
            {/* Hero — compact, per the explicit "not giant" instruction */}
            <div
              className="relative overflow-hidden rounded-2xl lg:rounded-3xl px-5 py-5 lg:px-7 lg:py-6 mb-4"
              style={{ background: 'linear-gradient(120deg, #eaf3ff 0%, #dcecff 45%, #e7f7f7 100%)' }}
            >
              <div
                className="absolute -top-10 -right-6 w-40 h-40 rounded-full opacity-60 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(59,155,255,0.35), transparent 70%)' }}
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-12 right-10 w-32 h-32 rounded-full opacity-50 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.30), transparent 70%)' }}
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-blue-700/70 uppercase">
                    <ShoppingBag className="w-3.5 h-3.5" /> Marketplace
                  </p>
                  <h1 className="mt-1.5 text-2xl lg:text-[28px] font-bold text-gray-900 tracking-tight leading-tight max-w-sm">
                    Discover. Shop. Support.
                  </h1>
                  <p className="mt-2 text-[13px] lg:text-sm text-gray-500 max-w-sm leading-relaxed">
                    Find products, deals and sellers from students around your campus.
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => navigate('/marketplace/create')}
                      className="flex items-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200"
                    >
                      <Plus className="w-4 h-4" /> Add Product
                    </button>
                  </div>
                </div>

                <div className="relative hidden sm:flex flex-shrink-0 items-end gap-2 pb-1">
                  <span className="w-11 h-11 rounded-2xl bg-white/70 border border-white flex items-center justify-center text-blue-600 shadow-sm -rotate-6">
                    <Backpack className="w-5 h-5" />
                  </span>
                  <span className="w-14 h-14 rounded-2xl bg-white/80 border border-white flex items-center justify-center text-blue-700 shadow-md">
                    <ShoppingBag className="w-6 h-6" />
                  </span>
                  <span className="w-11 h-11 rounded-2xl bg-white/70 border border-white flex items-center justify-center text-teal-600 shadow-sm rotate-6">
                    <Laptop className="w-5 h-5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products, stores, categories..."
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200"
              />
            </div>

            {/* Categories */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto scroll-hidden">
              {['All', ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                    activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sponsored — reserved, advertising-ready slot. Only renders
                when a product actually carries a real `sponsored` field;
                nothing writes that field today, so in practice this stays
                hidden rather than showing a fake ad. */}
            {sponsoredProducts.length > 0 && (
              <div className="mb-5">
                <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Sponsored
                </p>
                <div className="flex gap-3 overflow-x-auto scroll-hidden pb-1">
                  {sponsoredProducts.map((product) => (
                    <div key={product.id} className="w-36 lg:w-40 flex-shrink-0">
                      <ProductCard product={product} onOpen={() => navigate(`/marketplace/${product.id}`)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* From Your Campus — real, filtered by the viewer's own
                collegeId (denormalized on each product at creation time). */}
            {campusProducts.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-bold text-gray-900 mb-2.5">
                  From {myCollegeName || 'Your Campus'}
                </p>
                <div className="flex gap-3 overflow-x-auto scroll-hidden pb-1">
                  {campusProducts.map((product) => (
                    <div key={product.id} className="w-36 lg:w-40 flex-shrink-0">
                      <ProductCard product={product} onOpen={() => navigate(`/marketplace/${product.id}`)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main grid */}
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-sm font-bold text-gray-900">{gridTitle}</p>
              {!loading && !error && <p className="text-xs text-gray-400">{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</p>}
            </div>

            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader size="md" tone="dark" />
              </div>
            ) : error ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-gray-900">{error}</p>
                <button type="button" onClick={load} className="mt-3 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-300">
                  Try Again
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-blue-500" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">
                  {normalizedSearch ? 'No matches found' : activeCategory === 'All' ? 'No products yet' : `No ${activeCategory} products yet`}
                </p>
                <p className="mt-1 text-sm text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                  {normalizedSearch ? 'Try a different search term or category.' : 'Be the first to list something on Campinity.'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/marketplace/create')}
                  className="mt-5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
                >
                  Add Product
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} onOpen={() => navigate(`/marketplace/${product.id}`)} />
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
              {quickStats.map(({ key, icon: Icon, value, label, tint }) => (
                <div key={key} className="rounded-xl bg-gray-50/70 px-2 py-3 text-center">
                  <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center ${tint}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <p className="mt-1.5 text-base font-bold text-gray-900 leading-none">{value}</p>
                  <p className="mt-1 text-[10px] text-gray-400 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sponsored / Promoted — the explicit "reserved ad slot" module.
              Shows a tasteful, honest empty state rather than a fake
              business when (as today) no promoted listing exists. */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Promoted
            </p>
            {sponsoredProducts.length > 0 ? (
              <div className="space-y-1.5">
                {sponsoredProducts.slice(0, 3).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => navigate(`/marketplace/${product.id}`)}
                    className="w-full flex items-center gap-2.5 text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {product.imageUrl && <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                      <p className="text-[11px] text-amber-600 font-medium">{product.sponsored.label || 'Sponsored'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 leading-relaxed">No sponsored deals yet. Campus businesses will appear here soon.</p>
            )}
          </div>

          {popularCategories.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
              <p className="text-sm font-bold text-gray-900 mb-3">Top Categories</p>
              <div className="space-y-1">
                {popularCategories.map(({ category, count }) => {
                  const meta = CATEGORY_META[category] || CATEGORY_META.Other
                  const Icon = meta.icon
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
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

          {recentListings.length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
              <p className="text-sm font-bold text-gray-900 mb-3">Recent Listings</p>
              <div className="space-y-2">
                {recentListings.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => navigate(`/marketplace/${product.id}`)}
                    className="w-full flex items-center gap-2.5 text-left rounded-xl px-2 py-1.5 -mx-2 hover:bg-gray-50 transition-all duration-200"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                      <p className="text-[11px] text-gray-400">₹{product.price} · {product.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl p-4 text-white relative overflow-hidden" style={{ backgroundColor: '#1677ff' }}>
            <p className="relative flex items-center gap-1.5 text-sm font-bold">
              <ShoppingBag className="w-4 h-4" /> Have something to sell?
            </p>
            <p className="relative mt-1.5 text-xs text-blue-100 leading-relaxed">
              Reach students around your campus in a few taps.
            </p>
            <button
              type="button"
              onClick={() => navigate('/marketplace/create')}
              className="relative mt-3 w-full rounded-full bg-white text-blue-700 text-xs font-semibold py-2.5 hover:bg-blue-50 active:scale-[0.98] transition-all duration-200"
            >
              Add Product →
            </button>
          </div>
        </aside>
    </div>
  )
}
