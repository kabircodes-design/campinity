import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, ShoppingBag } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import DesktopSidebar from '../components/DesktopSidebar.jsx'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { getMarketplaceProducts, CATEGORIES } from '../firebase/marketplaceService.js'

/**
 * Real, honest first slice of Marketplace — students browse real
 * products sellers actually created via the Add Product flow. No
 * fake distance/offer-badge/campus-relevance fields, since this app
 * has no real location or offers data to back them (per explicit
 * 'do not create fake data').
 */
export default function MarketplacePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (uid) getUserProfile(uid).then(setProfile).catch(() => {})
  }, [])

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

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return products
    return products.filter((p) => p.category === activeCategory)
  }, [products, activeCategory])

  return (
    <div className="lg:flex lg:h-screen lg:overflow-hidden">
      <DesktopSidebar profile={profile} />
      <div className="min-h-screen w-full max-w-[100vw] lg:max-w-none lg:h-screen lg:overflow-y-auto overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[760px] min-h-screen lg:min-h-0 bg-white lg:shadow-sm lg:border-x lg:border-gray-100">
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
            <div className="h-14 flex items-center justify-between px-3">
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Back" onClick={() => navigate('/home')} className="lg:hidden w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-base font-bold tracking-tight text-gray-900">Marketplace</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/marketplace/create')}
                className="flex items-center gap-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold px-3.5 py-2 hover:bg-blue-700 transition-all duration-200"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product
              </button>
            </div>
          </header>

          <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scroll-hidden">
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

          <main className="px-4 pb-24">
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
                <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-gray-300" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">
                  {activeCategory === 'All' ? 'No products yet' : `No ${activeCategory} products yet`}
                </p>
                <p className="mt-1 text-sm text-gray-400">Add your first product and start reaching students.</p>
                <button
                  type="button"
                  onClick={() => navigate('/marketplace/create')}
                  className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
                >
                  Add Product
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => navigate(`/marketplace/${product.id}`)}
                    className="text-left rounded-2xl border border-gray-100 overflow-hidden hover:border-blue-200 hover:shadow-sm hover:-translate-y-[1px] transition-all duration-200"
                  >
                    <div className="aspect-square bg-gray-100">
                      {product.imageUrl && (
                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                      <p className="text-sm font-bold text-blue-600">₹{product.price}</p>
                      <p className="text-xs text-gray-400 truncate">{product.sellerName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
