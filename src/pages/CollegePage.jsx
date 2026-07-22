import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, GraduationCap, MapPin } from 'lucide-react'
import BottomNav from '../components/BottomNav.jsx'
import Loader from '../auth/components/Loader.jsx'
import { getCollegeById } from '../firebase/collegeService.js'

export default function CollegePage() {
  const { collegeId } = useParams()
  const navigate = useNavigate()

  const [college, setCollege] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const data = await getCollegeById(collegeId)
        if (cancelled) return
        if (!data) {
          setNotFound(true)
        } else {
          setCollege(data)
        }
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [collegeId])

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (notFound || !college) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <p className="text-sm text-gray-400">College not found.</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">College</span>
          </div>
        </header>

        <main className="px-4 py-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <GraduationCap className="w-8 h-8" strokeWidth={1.7} />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">{college.name}</h1>
            {college.verified && <BadgeCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />}
          </div>

          <p className="mt-1 flex items-center gap-1 text-sm text-gray-400">
            <MapPin className="w-3.5 h-3.5" />
            {college.city}, {college.state}
          </p>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}