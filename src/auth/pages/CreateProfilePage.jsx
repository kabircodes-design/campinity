import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, Check, X } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Icon from '../../components/Icon.jsx'
import { auth } from '../../firebase/firebase.js'
import { saveUserProfile } from '../utils/userProfile.js'
import { uploadProfileImage } from '../utils/storage.js'
import { reserveUsername } from '../../firebase/usernameService.js'
import { useUsernameAvailability } from '../../hooks/useUsernameAvailability.js'
import { markJustOnboarded } from '../../onboarding/campusIntroFlag.js'

const years = ['FYJC', 'SYJC', 'FY', 'SY', 'TY', 'Final Year']

const fieldLabelClass = 'block text-[13px] font-medium text-ink-soft dark:text-gray-400 mb-1.5'
const fieldInputClass =
  'w-full rounded-xl2 border bg-bg dark:bg-white/5 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint dark:text-gray-50 dark:placeholder:text-gray-500 outline-none transition-colors duration-200 focus:ring-4 focus:ring-accent-tint dark:focus:ring-blue-500/15 border-line dark:border-white/10 focus:border-accent'

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
      <label className={fieldLabelClass}>{label}</label>
      <input
        type="text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={fieldInputClass}
      />
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint dark:bg-blue-500/15 text-accent text-xs font-medium pl-3 pr-2 py-1.5"
            >
              {value}
              <button
                type="button"
                onClick={() => onRemove(value)}
                aria-label={`Remove ${value}`}
                className="hover:text-accent-deep transition-colors duration-200"
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
  const [justSaved, setJustSaved] = useState(false)

  // A brand-new profile has no existing username yet, so there is
  // nothing to compare against or release — pass '' as currentUsername.
  const usernameCheck = useUsernameAvailability(username, '')

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
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

      // ROOT CAUSE FIX (part of the profile-photo consistency pass):
      // this used to write the uploaded photo to a `photoURL` field,
      // while every other surface in the app resolves the real photo
      // from `avatar` (getProfileIdentityImage's priority: avatarMode
      // -> campusAvatarUrl, else avatar, else campusAvatarUrl). A
      // brand-new user's very first photo landed in a field nothing
      // else treated as primary — mapProfileDoc's own `data.avatar ??
      // data.photoURL` fallback happened to still surface it almost
      // everywhere, but not universally, and not as the one
      // authoritative field. Writing `avatar` directly here closes that
      // gap for every NEW signup going forward; existing users who only
      // have `photoURL` set keep resolving correctly via that same
      // fallback (unchanged, nothing migrated).
      let avatarUrl = ''
      if (photoFile) {
        avatarUrl = await uploadProfileImage(uid, photoFile)
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
        avatar: avatarUrl,
        role: 'student',
        profileCompleted: true
      })

      // Brief, satisfying success moment on the button itself before
      // handing off to the full-screen welcome intro — markJustOnboarded()
      // is what makes HomePage.jsx show that intro exactly once, right
      // after this specific transition (see campusIntroFlag.js).
      setJustSaved(true)
      markJustOnboarded()
      window.setTimeout(() => navigate('/home'), 350)
      return
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
    <AuthLayout
      eyebrow="Make your campus profile"
      title="Let's build your profile"
      subtitle="Tell your campus a little about you."
      maxWidthClass="max-w-[400px] xl:max-w-[500px]"
      brandHeading={<>One last step.</>}
      brandBody="Add a few details so your campus can find and recognize you."
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="flex flex-col items-center pb-1">
          <div className="relative group">
            <label
              htmlFor="create-profile-photo"
              className="relative block w-24 h-24 rounded-full cursor-pointer overflow-hidden ring-4 ring-accent-tint dark:ring-blue-500/10 bg-accent-tint dark:bg-white/5"
            >
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Profile preview"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-7 h-7 text-accent/40" strokeWidth={1.5} />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="text-white text-[11px] font-semibold">{photoPreview ? 'Change photo' : 'Add photo'}</span>
              </div>
            </label>

            <span className="pointer-events-none absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent flex items-center justify-center border-2 border-surface dark:border-[#11131a]">
              <Camera className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
            </span>

            {photoPreview && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                aria-label="Remove photo"
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-surface dark:bg-[#11131a] border border-line dark:border-white/10 flex items-center justify-center text-ink-faint hover:text-red-500 shadow-card transition-colors duration-200"
              >
                <X className="w-3 h-3" strokeWidth={2.2} />
              </button>
            )}

            <input
              id="create-profile-photo"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handlePhotoChange}
            />
          </div>
          <p className="mt-2.5 text-[12.5px] text-ink-faint dark:text-gray-500">
            {photoPreview ? 'Looking good' : 'Add a profile photo'}
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          <Input
            id="fullName"
            label="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            error={errors.fullName}
            disabled={isSubmitting}
          />

          <div>
            <label htmlFor="username" className={fieldLabelClass}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isSubmitting}
              placeholder="yourname"
              className={`w-full rounded-xl2 border bg-bg dark:bg-white/5 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint dark:text-gray-50 dark:placeholder:text-gray-500 outline-none transition-colors duration-200 focus:ring-4 focus:ring-accent-tint dark:focus:ring-blue-500/15 ${
                errors.username ? 'border-red-400 focus:border-red-500 dark:border-red-500/60' : 'border-line dark:border-white/10 focus:border-accent'
              }`}
            />
            {errors.username && <p className="mt-1.5 text-[12.5px] text-red-500 dark:text-red-400">{errors.username}</p>}
            {!errors.username && usernameCheck.message && (
              <p
                className={`mt-1.5 text-[12.5px] ${
                  usernameCheck.status === 'available' ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-faint dark:text-gray-500'
                }`}
              >
                {usernameCheck.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          <Input
            id="college"
            label="College"
            value={college}
            onChange={(event) => setCollege(event.target.value)}
            error={errors.college}
            disabled={isSubmitting}
          />
          <Input id="course" label="Course" value={course} onChange={(event) => setCourse(event.target.value)} disabled={isSubmitting} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="year" className={fieldLabelClass}>
              Year
            </label>
            <select
              id="year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              disabled={isSubmitting}
              className={fieldInputClass}
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <Input id="division" label="Division" value={division} onChange={(event) => setDivision(event.target.value)} disabled={isSubmitting} />
        </div>

        <div>
          <label htmlFor="bio" className={fieldLabelClass}>
            Bio
          </label>
          <textarea
            id="bio"
            rows={2}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            disabled={isSubmitting}
            className={`${fieldInputClass} resize-none`}
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
          <p role="alert" className="rounded-xl2 bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400 text-[13px] px-4 py-3">
            {submitError}
          </p>
        )}

        {justSaved && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className="flex items-center justify-center gap-2 rounded-xl2 bg-accent-tint dark:bg-blue-500/15 text-accent text-[13px] font-medium px-4 py-3"
          >
            <Icon name="check" className="w-4 h-4" strokeWidth={2.4} />
            You're in. Welcome to Campinity.
          </motion.p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting || justSaved || usernameCheck.status === 'checking'}
          loading={isSubmitting}
          icon={justSaved ? <Check className="w-4 h-4" strokeWidth={2.6} /> : null}
        >
          {justSaved ? (
            'Welcome!'
          ) : isSubmitting ? (
            'Joining…'
          ) : (
            <span className="inline-flex items-center gap-1.5">
              Join Campinity
              <Icon name="arrow" className="w-4 h-4" strokeWidth={2} />
            </span>
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}
