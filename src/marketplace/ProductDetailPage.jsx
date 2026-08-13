import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { getProductById } from '../firebase/marketplaceService.js'

export default function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'notfound' | 'error'

  useEffect(() => {
    let cancelled = false
    getProductById(productId)
      .then((data) => {
        if (cancelled) return
        if (!data) setStatus('notfound')
        else {
          setProduct(data)
          setStatus('success')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
        </header>

        {status === 'loading' && (
          <div className="py-16 flex justify-center">
            <Loader size="md" tone="dark" />
          </div>
        )}

        {status === 'notfound' && (
          <div className="py-16 text-center px-6">
            <p className="text-sm font-semibold text-gray-900">Product not found</p>
            <p className="mt-1 text-sm text-gray-400">It may have been removed by the seller.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-16 text-center px-6">
            <p className="text-sm font-semibold text-gray-900">Couldn't load this product.</p>
          </div>
        )}

        {status === 'success' && product && (
          <div>
            <div className="aspect-square bg-gray-100">
              {product.imageUrl && <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{product.category}</p>
              <h1 className="mt-1 text-lg font-bold text-gray-900">{product.name}</h1>
              <p className="mt-1 text-xl font-bold text-gray-900">₹{product.price}</p>
              <p className="mt-1 text-sm text-gray-400">{product.sellerName}</p>
              {product.description && (
                <p className="mt-3 text-sm text-gray-700 leading-relaxed">{product.description}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
