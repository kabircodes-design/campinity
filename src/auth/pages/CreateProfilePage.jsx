import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, X } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import { auth } from '../../firebase/firebase.js'
import { saveUserProfile } from '../utils/userProfile.js'
import { uploadProfileImage } from '../utils/storage.js'
import { reserveUsername } from '../../firebase/usernameService.js'
import { useUsernameAvailability } from '../../hooks/useUsernameAvailability.js'

const years = ['FYJC', 'SYJC', 'FY', 'SY', 'TY', 'Final Year']

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

export default function CreateProfilePage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [college, setCollege] = useState('')
  const [course, setCourse] = useState('')
  const [year, setYear] = useState(years[0])
  const [division, setDivision] = useState('')
  const [bio, setBio] = useState('')
  const [interests, setInterests] = useState([])

  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // A brand-new profile has no existing username yet, so there is
  // nothing to compare against or release — pass '' as currentUsername.
  const usernameCheck = useUsernameAvailability(username, '')

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const validate = () => {
    const next = {}
    if (!fullName.trim()) next.fullName = 'Full name is required'
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
    if (!college.trim()) next.college = 'College is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate() || isSubmitting || !auth.currentUser) return

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const uid = auth.currentUser.uid

      const reservedUsername = await reserveUsername({
        uid,
        newUsername: username,
        oldUsername: ''
      })

      let photoURL = null
      if (photoFile) {
        photoURL = await uploadProfileImage(uid, photoFile)
      }

      await saveUserProfile(uid, {
        uid,
        fullName: fullName.trim(),
        username: reservedUsername,
        college: college.trim(),
        course: course.trim(),
        year,
        division: division.trim(),
        bio: bio.trim(),
        interests,
        photoURL,
        role: 'student',
        profileCompleted: true
      })

      navigate('/home')
    } catch (err) {
      if (err?.code === 'username-taken') {
        setErrors((prev) => ({ ...prev, username: 'Username already taken' }))
      } else if (err?.code === 'invalid-username') {
        setErrors((prev) => ({ ...prev, username: err.message }))
      } else {
        setSubmitError(err?.message || 'Could not save your profile. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Create your profile" subtitle="This is how other students on campus will see you.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col items-center">
          <label htmlFor="create-profile-photo" className="relative cursor-pointer group">
            <div className="w-20 h-20 rounded-full bg-blue-50 border border-gray-200 overflow-hidden flex items-center justify-center">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-blue-300" strokeWidth={1.6} />
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white group-hover:bg-blue-700 transition-colors duration-300">
              <Camera className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
            </span>
            <input
              id="create-profile-photo"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoChange}
            />
          </label>
          <p className="mt-2 text-xs text-gray-400">Add a profile photo</p>
        </div>

        <Input
          id="fullName"
          label="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={errors.fullName}
        />

        <div>
          <label htmlFor="username" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={isSubmitting}
            placeholder="yourname"
            className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all duration-300 ${
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

        <Input id="college" label="College" value={college} onChange={(event) => setCollege(event.target.value)} error={errors.college} />
        <Input id="course" label="Course" value={course} onChange={(event) => setCourse(event.target.value)} />

        <div>
          <label htmlFor="year" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Year
          </label>
          <select
            id="year"
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

        <Input id="division" label="Division" value={division} onChange={(event) => setDivision(event.target.value)} />

        <div>
          <label htmlFor="bio" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Bio
          </label>
          <textarea
            id="bio"
            rows={3}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
          />
        </div>

        <TagInput
          label="Interests"
          values={interests}
          placeholder="Type an interest, press Enter"
          onAdd={(value) => setInterests((prev) => [...prev, value])}
          onRemove={(value) => setInterests((prev) => prev.filter((item) => item !== value))}
        />

        {submitError && (
          <p role="alert" className="rounded-xl bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
            {submitError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting || usernameCheck.status === 'checking'}>
          {isSubmitting ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </AuthLayout>
  )
}