import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { createCommunity } from '../firebase/communityService.js'
import { useMyVerification } from '../access/useMyVerification.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'

// Club "category" reuses the community schema's existing free-form
// `tags` field (communityService.js) rather than inventing a new
// category field — these are just suggested starting tags specific to
// what a club actually is, picked from (not a hardcoded enum the
// backend enforces). A club can still type its own tags too.
const CLUB_CATEGORIES = [
  'Academic', 'Sports', 'Arts & Culture', 'Technology', 'Social', 'Volunteering', 'Music', 'Gaming'
]

const accessOptions = [
  { key: 'public', label: 'Open to join', description: 'Anyone can join instantly and jump into the discussion.' },
  { key: 'private', label: 'Approval required', description: 'New members request to join; an admin approves them.' }
]

/**
 * Create Club — deliberately its OWN page, not CreateCommunityPage
 * with a query flag. Clubs and Communities are two distinct product
 * concepts now (Clubs = focused ongoing discussion groups; Communities
 * = broader campus/discovery spaces), so this needed its own identity,
 * not a relabeled community form. It still calls the exact same
 * createCommunity() backend as CreateCommunityPage — 'official_club'
 * was already a real, pre-existing COMMUNITY_TYPES value before this
 * page existed, so a club really IS a community of that type under the
 * hood; only the type is now fixed here (never shown/pickable — the
 * whole point of this page IS that type), and the fields/copy/visual
 * language are club-specific instead of generic community fields.
 */
export default function CreateClubPage() {
  const navigate = useNavigate()
  const verified = useMyVerification()

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategories, setSelectedCategories] = useState([])
  const [access, setAccess] = useState('public')
  const [rules, setRules] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleCategory = (cat) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat].slice(0, 4)))
  }

  const validate = () => {
    const next = {}
    if (!name.trim()) next.name = 'Give your club a name'
    if (!handle.trim()) next.handle = 'A handle is required'
    else if (!/^[a-z0-9_]{3,24}$/.test(handle.trim().toLowerCase())) {
      next.handle = '3-24 characters, lowercase letters, numbers, underscores only'
    }
    if (!description.trim()) next.description = "Tell people what this club is about"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate() || isSubmitting) return

    const uid = auth.currentUser?.uid
    if (!uid) {
      setSubmitError('You need to be signed in to create a club.')
      return
    }

    setSubmitError('')
    setIsSubmitting(true)

    try {
      const clubId = await createCommunity({
        uid,
        name: name.trim(),
        handle: handle.trim(),
        description: description.trim(),
        type: 'official_club',
        privacy: access,
        tags: selectedCategories,
        rules: rules.trim()
      })

      navigate(`/club/${clubId}`)
    } catch (err) {
      setSubmitError(err?.message || 'Could not create this club. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (verified === false) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
            <div className="h-14 flex items-center px-3">
              <button
                type="button"
                aria-label="Back"
                onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </header>
          <VerificationGate open onClose={() => navigate(-1)} feature={FEATURES.CREATE_COMMUNITY} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[840px] bg-white min-h-screen lg:min-h-0 lg:my-8 lg:rounded-2xl lg:border lg:border-gray-100 lg:shadow-sm">
        <header className="sticky top-0 lg:relative z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 lg:rounded-t-2xl">
          <div className="h-14 lg:h-16 flex items-center gap-2 px-3 lg:px-8">
            <button
              type="button"
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base lg:text-lg font-bold tracking-tight text-gray-900">Create Club</span>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="px-4 py-5 lg:px-8 lg:py-8 pb-10 lg:pb-12">
          <div className="lg:flex lg:items-start lg:gap-10 space-y-5 lg:space-y-0">
            <div className="lg:w-[280px] lg:flex-shrink-0 space-y-5">
              <div
                className="flex flex-col items-center text-center gap-3 rounded-2xl p-5 lg:sticky lg:top-24"
                style={{ background: 'linear-gradient(135deg, #eef4ff 0%, #f3ecff 100%)' }}
              >
                <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Sparkles className="w-7 h-7 lg:w-9 lg:h-9 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{name.trim() || 'Your club name'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{handle.trim() ? `@${handle.trim()}` : 'your-handle'}</p>
                </div>
                <p className="text-[12.5px] text-gray-500 leading-relaxed">
                  You'll be the owner. Clubs are built for ongoing discussion — a logo and cover can be added right after
                  creation.
                </p>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-5">
              <div>
                <label htmlFor="clb-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Club name
                </label>
                <input
                  id="clb-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. Debate Club"
                  className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                    errors.name ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                  }`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="clb-handle" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Handle
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
                  <input
                    id="clb-handle"
                    type="text"
                    value={handle}
                    onChange={(event) => setHandle(event.target.value.toLowerCase())}
                    disabled={isSubmitting}
                    placeholder="debate-club"
                    className={`w-full rounded-xl border bg-gray-50 pl-8 pr-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                      errors.handle ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                    }`}
                  />
                </div>
                {errors.handle && <p className="mt-1 text-xs text-red-500">{errors.handle}</p>}
              </div>

              <div>
                <label htmlFor="clb-description" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  What's this club about?
                </label>
                <textarea
                  id="clb-description"
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="What will members discuss here? What's the club's purpose?"
                  className={`w-full resize-none rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                    errors.description ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                  }`}
                />
                {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Category <span className="normal-case font-normal text-gray-400">(pick up to 4)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {CLUB_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      disabled={isSubmitting}
                      className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 ${
                        selectedCategories.includes(cat)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Access</p>
                <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                  {accessOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAccess(option.key)}
                      disabled={isSubmitting}
                      className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-300 ${
                        access === option.key ? 'border-indigo-500 bg-indigo-50/60' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${access === option.key ? 'text-indigo-600' : 'text-gray-900'}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="clb-rules" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Club rules <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="clb-rules"
                  rows={2}
                  value={rules}
                  onChange={(event) => setRules(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="Stay on topic, be respectful, no spam..."
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
                />
              </div>

              {submitError && (
                <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
                  {submitError}
                </p>
              )}

              <div className="flex items-center gap-3 lg:justify-end">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  disabled={isSubmitting}
                  className="flex-1 lg:flex-none lg:w-auto lg:px-8 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 lg:flex-none lg:w-auto lg:px-8 rounded-full bg-indigo-600 text-white text-sm font-semibold py-3 hover:bg-indigo-700 disabled:opacity-50 transition-all duration-300"
                >
                  {isSubmitting ? 'Creating…' : 'Create Club'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
