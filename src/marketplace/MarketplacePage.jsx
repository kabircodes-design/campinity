import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Backpack,
  BarChart3,
  BookOpen,
  Briefcase,
  LayoutGrid,
  Laptop,
  Package,
  Plus,
  Search,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tag,
  UtensilsCrossed,
  X
} from 'lucide-react'
import ProductCard from '../components/ProductCard.jsx'
import { auth } from '../firebase/firebase.js'
import { getMarketplaceProducts, CATEGORIES } from '../firebase/marketplaceService.js'
import { getCollegeById } from '../data/dummyColleges.js'
import { useAuth } from '../context/AuthContext.jsx'

// Real categories only (marketplaceService.CATEGORIES, the same list
// CreateProductPage writes into every product) mapped to a lucide icon
// + tint — nothing here is invented.
const CATEGORY_META = {
  All: { icon: LayoutGrid, tint: 'bg-blue-50 text-blue-600' },
  Fashion: { icon: Shirt, tint: 'bg-pink-50 text-pink-600' },
  Food: { icon: UtensilsCrossed, tint: 'bg-orange-50 text-orange-600' },
  Electronics: { icon: Laptop, tint: 'bg-blue-50 text-blue-600' },
  Books: { icon: BookOpen, tint: 'bg-amber-50 text-amber-600' },
  Services: { icon: Briefcase, tint: 'bg-purple-50 text-purple-600' },
  'College Essentials': { icon: Backpack, tint: 'bg-teal-50 text-teal-600' },
  Other: { icon: Package, tint: 'bg-gray-100 text-gray-500' }
}

function SectionTitle({ children, aside }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h2 className="min-w-0 truncate text-[15px] font-bold text-gray-900 tracking-tight">{children}</h2>
      {aside && <span className="text-xs text-gray-400 flex-shrink-0">{aside}</span>}
    </div>
  )
}

function ProductSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden" aria-hidden="true">
      <div className="aspect-square bg-gray-100 animate-pulse" />
      <div className="p-2.5 space-y-2">
        <div className="h-4 w-1/2 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-3 w-5/6 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-3 w-2/3 rounded-full bg-gray-100 animate-pulse" />
      </div>
    </div>
  )
}

function ProductRail({ products, onOpen }) {
  return (
    <div className="-mx-4 px-4 flex gap-3 overflow-x-auto scroll-hidden pb-1">
      {products.map((product) => (
        <div key={product.id} className="w-[44%] max-w-[180px] min-w-[148px] flex-shrink-0">
          <ProductCard product={product} onOpen={() => onOpen(product)} />
        </div>
      ))}
    </div>
  )
}

/**
 * Marketplace. Every existing capability is preserved: real Firestore
 * products (getMarketplaceProducts — hidden/moderated products already
 * filtered out there), search, category filtering, the Sell (create
 * listing) flow, saving (in ProductCard) and product detail, where
 * contacting / messaging the seller lives.
 *
 * Nothing is faked: no ratings, distances, trust badges or ads.
 * "Sponsored" and "From your campus" are wired to real fields
 * (product.sponsored, product.collegeId) and render nothing without
 * real data behind them.
 */
export default function MarketplacePage() {
  const navigate = useNavigate()
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

  const browsing = !normalizedSearch && activeCategory === 'All'
  const gridTitle = normalizedSearch
    ? `Results for “${searchTerm.trim()}”`
    : activeCategory === 'All'
      ? 'Latest listings'
      : activeCategory
  const openProduct = (product) => navigate(`/marketplace/${product.id}`)
  const goSell = () => navigate('/marketplace/create')

  return (
    <div className="h-full lg:grid lg:gap-3 lg:[grid-template-columns:minmax(0,1fr)_minmax(260px,320px)] lg:overflow-hidden">
      <div className="h-full w-full max-w-[100vw] lg:max-w-none lg:overflow-y-auto lg:min-w-0 overflow-x-hidden">
        <div className="mx-auto max-w-[560px] lg:max-w-[860px] px-4 lg:px-6 pt-5 pb-32 lg:pb-8">
          {/* Header — same heading/subtitle/action pattern as Messages */}
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight leading-tight">Marketplace</h1>
              <p className="mt-0.5 text-[13px] text-gray-500 truncate">Buy and sell with students on campus</p>
            </div>
            <button
              type="button"
              onClick={goSell}
              aria-label="Sell an item"
              className="flex-shrink-0 h-10 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white text-sm font-semibold pl-3 pr-4 shadow-sm shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all duration-200"
            >
              <Plus className="w-4 h-4" strokeWidth={2.6} /> Sell
            </button>
          </header>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items, sellers, categories..."
              aria-label="Search marketplace"
              enterKeyHint="search"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-10 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-200 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Categories */}
          <div className="-mx-4 px-4 mt-3 flex items-center gap-2 overflow-x-auto scroll-hidden" role="tablist" aria-label="Categories">
            {['All', ...CATEGORIES].map((cat) => {
              const isActive = activeCategory === cat
              const Icon = (CATEGORY_META[cat] || CATEGORY_META.Other).icon
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 rounded-full text-[13px] font-semibold pl-2.5 pr-3.5 py-1.5 transition-all duration-200 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                  {cat}
                </button>
              )
            })}
          </div>

          <div className="mt-5 space-y-6">
            {/* Sponsored — only when a product carries a real `sponsored`
                field; nothing writes it today, so it stays hidden. */}
            {browsing && !loading && sponsoredProducts.length > 0 && (
              <section>
                <SectionTitle>
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Sponsored
                  </span>
                </SectionTitle>
                <ProductRail products={sponsoredProducts} onOpen={openProduct} />
              </section>
            )}

            {/* From your campus — real, filtered by the viewer's collegeId. */}
            {browsing && !loading && campusProducts.length > 0 && (
              <section>
                <SectionTitle>From {myCollegeName || 'your campus'}</SectionTitle>
                <ProductRail products={campusProducts} onOpen={openProduct} />
              </section>
            )}

            <section>
              <SectionTitle aside={!loading && !error ? `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}` : null}>
                {gridTitle}
              </SectionTitle>

              {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading listings">
                  {Array.from({ length: 4 }, (_, i) => (
                    <ProductSkeleton key={i} />
                  ))}
                </div>
              ) : error ? (
                <div className="py-12 px-6 text-center">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-gray-900">{error}</p>
                  <p className="mt-1 text-sm text-gray-500">Check your connection and try again.</p>
                  <button type="button" onClick={load} className="mt-4 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-200">
                    Try again
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    {normalizedSearch ? <Search className="w-6 h-6" /> : <ShoppingBag className="w-6 h-6" />}
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-gray-900">
                    {normalizedSearch ? 'No matches found' : activeCategory === 'All' ? 'No listings yet' : `No ${activeCategory} listings yet`}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed">
                    {normalizedSearch ? 'Try a different search or category.' : 'Be the first to list something on Campinity.'}
                  </p>
                  {normalizedSearch ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('')
                        setActiveCategory('All')
                      }}
                      className="mt-4 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold px-5 py-2 hover:border-gray-300 transition-all duration-200"
                    >
                      Clear filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goSell}
                      className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-200"
                    >
                      <Plus className="w-4 h-4" /> Sell an item
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map((product) => (
                    <ProductCard key={product.id} product={product} onOpen={() => openProduct(product)} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Right rail (desktop) */}
      <aside className="hidden lg:flex lg:flex-col w-72 flex-shrink-0 h-screen sticky top-0 overflow-y-auto px-4 py-5 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900 mb-3">
            <BarChart3 className="w-4 h-4 text-blue-500" /> Quick Stats
          </p>
          <div className="grid grid-cols-3 gap-2">
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

        {/* Sponsored / Promoted — honest empty state when none exist. */}
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
                  onClick={() => openProduct(product)}
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
                  onClick={() => openProduct(product)}
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
            onClick={goSell}
            className="relative mt-3 w-full rounded-full bg-white text-blue-700 text-xs font-semibold py-2.5 hover:bg-blue-50 active:scale-[0.98] transition-all duration-200"
          >
            Add Product →
          </button>
        </div>
      </aside>
    </div>
  )
}
