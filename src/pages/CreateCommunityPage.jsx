import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { COMMUNITY_TYPES, createCommunity } from '../firebase/communityService.js'

const typeLabels = {
  official_club: 'Official Club',
  study_group: 'Study Group',
  hostel: 'Hostel',
  branch: 'Branch',
  batch: 'Batch',
  society: 'Society',
  event: 'Event',
  custom: 'Custom'
}

const privacyOptions = [
  { key: 'public', label: 'Public', description: 'Anyone can find and join instantly.' },
  { key: 'private', label: 'Private', description: 'Anyone can find it, but joining needs approval.' }
]

/**
 * Form pattern follows AddCollegePage.jsx (labeled fields, inline
 * validation, disabled-while-submitting), category selection follows
 * CreatePostPage.jsx's chip-row pattern. Talks directly to
 * communityService.createCommunity — no duplicate Firestore logic
 * here, this page is UI + validation only.
 *
 * Invite-only privacy from the brief isn't implemented: Phase 1's
 * communityService only supports 'public' | 'private' (join-instantly
 * vs request-to-join). A third invite-only mode needs its own
 * membership path (an invite document a user redeems, distinct from a
 * request an owner approves) that doesn't exist yet — surfaced here
 * rather than added as an option that would silently behave like
 * private.
 */
export default function CreateCommunityPage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('official_club')
  const [privacy, setPrivacy] = useState('public')
  const [tagsInput, setTagsInput] = useState('')
  const [rules, setRules] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const next = {}
    if (!name.trim()) next.name = 'Community name is required'
    if (!handle.trim()) next.handle = 'A handle is required'
    else if (!/^[a-z0-9_]{3,24}$/.test(handle.trim().toLowerCase())) {
      next.handle = '3-24 characters, lowercase letters, numbers, underscores only'
    }
    if (!description.trim()) next.description = 'A short description helps people know what this is'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate() || isSubmitting) return

    const uid = auth.currentUser?.uid
    if (!uid) {
      setSubmitError('You need to be signed in to create a community.')
      return
    }

    setSubmitError('')
    setIsSubmitting(true)

    try {
      const tags = tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8)

      const communityId = await createCommunity({
        uid,
        name: name.trim(),
        handle: handle.trim(),
        description: description.trim(),
        type,
        privacy,
        tags,
        rules: rules.trim()
      })

      navigate(`/community/${communityId}`)
    } catch (err) {
      setSubmitError(err?.message || 'Could not create this community. Please try again.')
      setIsSubmitting(false)
    }
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
            <span className="text-base font-bold tracking-tight text-gray-900">Create Community</span>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5 pb-10">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed">
              You'll be the owner. Cover image and logo can be added after creation.
            </p>
          </div>

          <div>
            <label htmlFor="cc-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Community name
            </label>
            <input
              id="cc-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Photography Club"
              className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                errors.name ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="cc-handle" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Handle
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
              <input
                id="cc-handle"
                type="text"
                value={handle}
                onChange={(event) => setHandle(event.target.value.toLowerCase())}
                disabled={isSubmitting}
                placeholder="photography-club"
                className={`w-full rounded-xl border bg-gray-50 pl-8 pr-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                  errors.handle ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
                }`}
              />
            </div>
            {errors.handle && <p className="mt-1 text-xs text-red-500">{errors.handle}</p>}
          </div>

          <div>
            <label htmlFor="cc-description" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              id="cc-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
              placeholder="What's this community about?"
              className={`w-full resize-none rounded-xl border bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                errors.description ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
            />
            {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type</p>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_TYPES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  disabled={isSubmitting}
                  className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 ${
                    type === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {typeLabels[key]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Privacy</p>
            <div className="space-y-2">
              {privacyOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPrivacy(option.key)}
                  disabled={isSubmitting}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-300 ${
                    privacy === option.key ? 'border-blue-500 bg-blue-50/60' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-semibold ${privacy === option.key ? 'text-blue-600' : 'text-gray-900'}`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="cc-tags" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Tags <span className="normal-case font-normal text-gray-400">(comma-separated, optional)</span>
            </label>
            <input
              id="cc-tags"
              type="text"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              disabled={isSubmitting}
              placeholder="photography, arts, weekend-meetups"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <div>
            <label htmlFor="cc-rules" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Rules <span className="normal-case font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="cc-rules"
              rows={3}
              value={rules}
              onChange={(event) => setRules(event.target.value)}
              disabled={isSubmitting}
              placeholder="Be respectful, stay on topic..."
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          {submitError && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
          >
            {isSubmitting ? 'Creating…' : 'Create Community'}
          </button>
        </form>
      </div>
    </div>
  )
}
