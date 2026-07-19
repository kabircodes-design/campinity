import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { currentUserProfile } from '../data/dummyProfile.js'

const years = ['FY', 'SY', 'TY', 'Final Year']

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

  const [photoPreview, setPhotoPreview] = useState('')
  const [name, setName] = useState(currentUserProfile.name)
  const [username, setUsername] = useState(currentUserProfile.username)
  const [bio, setBio] = useState(currentUserProfile.bio)
  const [college, setCollege] = useState(currentUserProfile.college)
  const [department, setDepartment] = useState(currentUserProfile.department)
  const [year, setYear] = useState(currentUserProfile.year)
  const [skills, setSkills] = useState(currentUserProfile.skills)
  const [interests, setInterests] = useState(currentUserProfile.interests)

  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
  }

  const validate = () => {
    const next = {}
    if (!name.trim()) next.name = 'Full name is required'
    if (!username.trim()) next.username = 'Username is required'
    else if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username.trim())) {
      next.username = '3-20 characters — letters, numbers, "." or "_" only'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async (event) => {
    event.preventDefault()
    if (!validate() || isSaving) return

    setIsSaving(true)
    // TODO(firebase): persist to Firestore users/{uid} once Firebase is wired up.
    await new Promise((resolve) => setTimeout(resolve, 600))
    setIsSaving(false)
    navigate('/profile')
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
          <div className="flex flex-col items-center">
            <label htmlFor="edit-photo" className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-full bg-blue-50 border border-gray-200 overflow-hidden flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <Avatar initials={currentUserProfile.initials} colorClass={currentUserProfile.colorClass} size="xl" />
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
              className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
                errors.username ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-500'
              }`}
            />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
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
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <div>
            <label htmlFor="edit-college" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              College
            </label>
            <input
              id="edit-college"
              type="text"
              value={college}
              onChange={(event) => setCollege(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <div>
            <label htmlFor="edit-department" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Department
            </label>
            <input
              id="edit-department"
              type="text"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
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

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-3 hover:border-gray-300 transition-all duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
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