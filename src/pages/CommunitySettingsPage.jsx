import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'
import Loader from '../auth/components/Loader.jsx'
import { auth } from '../firebase/firebase.js'
import {
  COMMUNITY_TYPES,
  getCommunityById,
  updateCommunityDetails,
  uploadCommunityAsset
} from '../firebase/communityService.js'

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

/**
 * Owner/admin only — access guarded by checking membership role after
 * load, same pattern CommunityDetailPage.jsx already uses. Name/type/
 * privacy are only enabled for the OWNER (an admin sees them disabled
 * with a note why) — matches updateCommunityDetails's own server-side
 * restriction, so the UI doesn't offer a control that would just fail
 * with a permission error for a non-owner admin.
 *
 * "Username" from the brief means the community's handle — not
 * editable here. Changing a handle means releasing the old
 * communityHandles/{oldHandle} reservation and creating a new one
 * atomically, which createCommunity's transaction does at creation
 * time but no equivalent "rename" transaction exists yet. Left out
 * rather than built as a plain field update that would silently leave
 * the old handle reservation orphaned forever.
 */
export default function CommunitySettingsPage() {
  const { communityId } = useParams()
  const navigate = useNavigate()
  const coverInputRef = useRef(null)
  const iconInputRef = useRef(null)

  const [community, setCommunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [type, setType] = useState('custom')
  const [privacy, setPrivacy] = useState('public')
  const [coverImage, setCoverImage] = useState('')
  const [icon, setIcon] = useState('')

  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [isUploadingIcon, setIsUploadingIcon] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const uid = auth.currentUser?.uid
  const isOwner = community?.ownerId === uid

  useEffect(() => {
    let cancelled = false

    getCommunityById(communityId)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setAccessDenied(true)
          return
        }
        const isAdmin = data.ownerId === uid || data.admins.includes(uid)
        if (!isAdmin) {
          setAccessDenied(true)
          return
        }
        setCommunity(data)
        setName(data.name)
        setDescription(data.description)
        setRules(data.rules)
        setType(data.type)
        setPrivacy(data.privacy)
        setCoverImage(data.coverImage)
        setIcon(data.icon)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [communityId, uid])

  const handleAssetUpload = async (file, kind) => {
    const setUploading = kind === 'cover' ? setIsUploadingCover : setIsUploadingIcon
    const setUrl = kind === 'cover' ? setCoverImage : setIcon
    setUploading(true)
    setSaveError('')
    try {
      const url = await uploadCommunityAsset(communityId, file, kind)
      setUrl(url)
    } catch (err) {
      setSaveError(err?.message || `Could not upload the ${kind === 'cover' ? 'cover image' : 'logo'}.`)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (isSaving) return
    setIsSaving(true)
    setSaveError('')
    setSaved(false)

    try {
      const updates = { description: description.trim(), rules: rules.trim(), coverImage, icon }
      if (isOwner) {
        updates.name = name.trim()
        updates.type = type
        updates.privacy = privacy
      }
      await updateCommunityDetails(communityId, uid, updates)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSaveError(err?.message || 'Could not save these changes.')
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50 flex items-center justify-center">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
        <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm flex items-center justify-center px-6 text-center">
          <div>
            <p className="text-sm font-semibold text-gray-900">You don't have access to this page</p>
            <p className="mt-1 text-sm text-gray-400">Only the owner or an admin can edit community settings.</p>
            <button
              type="button"
              onClick={() => navigate(`/community/${communityId}`)}
              className="mt-4 rounded-full bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-blue-700 transition-all duration-300"
            >
              Back to Community
            </button>
          </div>
        </div>
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
            <span className="text-base font-bold tracking-tight text-gray-900">Community Settings</span>
          </div>
        </header>

        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => navigate(`/community/${communityId}/requests`)}
            className="w-full flex items-center justify-between rounded-xl border border-gray-100 px-3.5 py-3 hover:border-gray-200 transition-all duration-300"
          >
            <span className="text-sm font-semibold text-gray-900">Join Requests</span>
            <span className="text-xs text-gray-400">Manage pending requests</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="px-4 py-5 space-y-5 pb-10">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cover Image</p>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={isUploadingCover}
              className="w-full h-24 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden relative hover:border-blue-200 transition-all duration-300"
            >
              {coverImage ? (
                <img src={coverImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="flex items-center gap-2 text-sm text-gray-400">
                  <ImageIcon className="w-4 h-4" />
                  {isUploadingCover ? 'Uploading…' : 'Add cover image'}
                </span>
              )}
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => event.target.files?.[0] && handleAssetUpload(event.target.files[0], 'cover')}
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Logo</p>
            <button
              type="button"
              onClick={() => iconInputRef.current?.click()}
              disabled={isUploadingIcon}
              className="w-16 h-16 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden hover:border-blue-200 transition-all duration-300"
            >
              {icon ? (
                <img src={icon} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <input
              ref={iconInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => event.target.files?.[0] && handleAssetUpload(event.target.files[0], 'icon')}
            />
          </div>

          <div>
            <label htmlFor="cs-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Community name {!isOwner && <span className="normal-case font-normal">(owner only)</span>}
            </label>
            <input
              id="cs-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!isOwner}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:opacity-60 transition-all duration-300"
            />
          </div>

          <div>
            <label htmlFor="cs-description" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              id="cs-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <div>
            <label htmlFor="cs-rules" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Rules
            </label>
            <textarea
              id="cs-rules"
              rows={3}
              value={rules}
              onChange={(event) => setRules(event.target.value)}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Type {!isOwner && <span className="normal-case font-normal">(owner only)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMUNITY_TYPES.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => isOwner && setType(key)}
                  disabled={!isOwner}
                  className={`rounded-full text-xs font-semibold px-3.5 py-1.5 transition-all duration-300 disabled:opacity-50 ${
                    type === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {typeLabels[key]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Privacy {!isOwner && <span className="normal-case font-normal">(owner only)</span>}
            </p>
            <div className="flex gap-2">
              {['public', 'private'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => isOwner && setPrivacy(key)}
                  disabled={!isOwner}
                  className={`rounded-full text-xs font-semibold px-3.5 py-1.5 capitalize transition-all duration-300 disabled:opacity-50 ${
                    privacy === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {saveError && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {saveError}
            </p>
          )}
          {saved && (
            <p className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-[13px] px-4 py-3">
              Saved.
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving || isUploadingCover || isUploadingIcon}
            className="w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
