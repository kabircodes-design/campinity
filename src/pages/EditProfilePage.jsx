import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import CollegeSearch from '../components/CollegeSearch.jsx'
import Loader from '../auth/components/Loader.jsx'
import { dummyProfileStats } from '../data/dummyProfileStats.js'
import { getCollegeById } from '../firebase/collegeService.js'
import { auth } from '../firebase/firebase.js'
import { getUserProfile, updateUserProfile } from '../firebase/profileService.js'
import { reserveUsername } from '../firebase/usernameService.js'
import { useUsernameAvailability } from '../hooks/useUsernameAvailability.js'

const years = ['FYJC', 'SYJC', 'FY', 'SY', 'TY', 'Final Year']

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

function TagInput({ label, values, onAdd, onRemove, placeholder }) {
  const [input, setInput] = useState('')

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      const clean = input.trim()
      if (clean && !values.includes(clean)) onAdd(clean)
      setInput('')
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <input
        type="text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
      />
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-600 text-xs font-medium pl-3 pr-2 py-1.5"
            >
              {value}
              <button
                type="button"
                onClick={() => onRemove(value)}
                aria-label={`Remove ${value}`}
                className="hover:text-blue-800 transition-colors duration-300"
              >
                <X className="w-3 h-3" strokeWidth={2.4} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EditProfilePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [photoPreview, setPhotoPreview] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')
  const [bio, setBio] = useState('')
  const [selectedCollege, setSelectedCollege] = useState(null)
  const [department, setDepartment] = useState('')
  const [year, setYear] = useState(years[0])
  const [skills, setSkills] = useState([])
  const [interests, setInterests] = useState([])

  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const uid = auth.currentUser?.uid
      if (!uid) {
        if (!cancelled) {
          setLoadError('Not signed in.')
          setLoading(false)
        }
        return
      }
      try {
        const profile = await getUserProfile(uid)
        if (cancelled) return
        if (profile) {
          setName(profile.displayName || '')
          setUsername(profile.username || '')
          setOriginalUsername(profile.username || '')
          setBio(profile.bio || '')
          setSelectedCollege(await getCollegeById(profile.collegeId))
          setDepartment(profile.course || '')
          setYear(profile.year || years[0])
          setSkills(profile.skills || [])
          setInterests(profile.interests || [])
        }
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || 'Could not load your profile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const usernameCheck = useUsernameAvailability(username, originalUsername)

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
  }

  const validate = () => {
    const next = {}
    if (!name.trim()) next.name = 'Full name is required'
    if (!username.trim()) {
      next.username = 'Username is required'
    } else if (usernameCheck.status === 'invalid') {
      next.username = usernameCheck.message
    } else if (usernameCheck.status === 'taken') {
      next.username = 'Username already taken'
    } else if (usernameCheck.status === 'checking') {
      next.username = 'Still checking username — please wait'
    } else if (usernameCheck.status === 'error') {
      next.username = 'Network error — try again'
    }
    if (!selectedCollege) next.college = 'Please select your college from the list'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!validate() || isSaving) return

    const uid = auth.currentUser?.uid
    if (!uid) {
      setErrors({ form: 'Not signed in.' })
      return
    }

    setIsSaving(true)
    try {
      const reservedUsername = await reserveUsername({
        uid,
        newUsername: username,
        oldUsername: originalUsername
      })

      await updateUserProfile(uid, {
        displayName: name.trim(),
        bio: bio.trim(),
        collegeId: selectedCollege.id,
        course: department.trim(),
        year,
        skills,
        interests
      })

      setOriginalUsername(reservedUsername)
      setUsername(reservedUsername)
      navigate('/profile')
    } catch (err) {
      if (err?.code === 'username-taken') {
        setErrors({ username: 'Username already taken' })
      } else if (err?.code === 'invalid-username') {
        setErrors({ username: err.message })
      } else {
        setErrors({ form: err?.message || 'Could not save your profile. Please try again.' })
      }
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

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Edit Profile</span>
          </div>
        </header>

        <form onSubmit={handleSave} className="px-4 py-5 space-y-5 pb-10">
          {loadError && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {loadError}
            </p>
          )}

          <div className="flex flex-col items-center">
            <label htmlFor="edit-photo" className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-full bg-blue-50 border border-gray-200 overflow-hidden flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <Avatar initials={getInitials(name)} colorClass={dummyProfileStats.colorClass} size="xl" />
                )}
              </div>
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white group-hover:bg-blue-700 transition-colors duration-300">
                <Camera className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
              </span>
              <input
                id="edit-photo"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handlePhotoChange}
              />
            </label>
            <p className="mt-2 text-xs text-gray-400">Change profile photo</p>
          </div>

          <div>
            <label htmlFor="edit-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Full name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
              className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                errors.name ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="edit-username" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Username
            </label>
            <input
              id="edit-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSaving}
              className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                errors.username ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
            {!errors.username && usernameCheck.message && (
              <p
                className={`mt-1 text-xs ${
                  usernameCheck.status === 'available' ? 'text-emerald-600' : 'text-gray-400'
                }`}
              >
                {usernameCheck.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="edit-bio" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Bio
            </label>
            <textarea
              id="edit-bio"
              rows={3}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              disabled={isSaving}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <CollegeSearch
            id="edit-college"
            label="College"
            value={selectedCollege}
            onChange={setSelectedCollege}
            error={errors.college}
            disabled={isSaving}
          />

          <div>
            <label htmlFor="edit-department" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Department
            </label>
            <input
              id="edit-department"
              type="text"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              disabled={isSaving}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <div>
            <label htmlFor="edit-year" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Year
            </label>
            <select
              id="edit-year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              disabled={isSaving}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <TagInput
            label="Skills"
            values={skills}
            placeholder="Type a skill, press Enter"
            onAdd={(value) => setSkills((prev) => [...prev, value])}
            onRemove={(value) => setSkills((prev) => prev.filter((item) => item !== value))}
          />

          <TagInput
            label="Interests"
            values={interests}
            placeholder="Type an interest, press Enter"
            onAdd={(value) => setInterests((prev) => [...prev, value])}
            onRemove={(value) => setInterests((prev) => prev.filter((item) => item !== value))}
          />

          {errors.form && (
            <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
              {errors.form}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              disabled={isSaving}
              className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || usernameCheck.status === 'checking'}
              className="flex-1 rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-50 transition-all duration-300"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}