import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ImagePlus } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getUserProfile } from '../firebase/profileService.js'
import { createProduct, uploadProductImage, CATEGORIES } from '../firebase/marketplaceService.js'

export default function CreateProductPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handlePublish = async () => {
    const uid = auth.currentUser?.uid
    if (!uid || !name.trim() || !price || publishing) return
    setPublishing(true)
    setError('')
    try {
      let imageUrl = ''
      if (imageFile) imageUrl = await uploadProductImage(uid, imageFile)

      const profile = await getUserProfile(uid).catch(() => null)

      const productId = await createProduct({
        uid,
        name,
        price,
        description,
        category,
        imageUrl,
        sellerName: profile?.displayName || 'Student'
      })
      navigate(`/marketplace/${productId}`)
    } catch (err) {
      console.error('Could not publish product:', err)
      setError("Couldn't publish your product. Please try again.")
    } finally {
      setPublishing(false)
    }
  }

  const canPublish = name.trim().length > 0 && Number(price) > 0 && !publishing

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center justify-between px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Add Product</span>
            <button
              type="button"
              onClick={handlePublish}
              disabled={!canPublish}
              className="rounded-full bg-blue-600 text-white text-sm font-semibold px-4 py-2 disabled:opacity-40 transition-all duration-300"
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {error && <p className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">{error}</p>}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center">
                <ImagePlus className="w-6 h-6 text-gray-400 mx-auto" />
                <p className="mt-1 text-xs text-gray-400">Add a product photo</p>
              </div>
            )}
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleImageChange} />

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oversized Campus Hoodie"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Price (₹)</p>
            <input
              type="number"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="799"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-200 ${
                    category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Tell students about this product..."
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all duration-300 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
