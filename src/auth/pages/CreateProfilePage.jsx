import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Facebook, Ghost, Instagram, Linkedin, X } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import { auth } from '../../firebase/firebase.js'
import { saveUserProfile } from '../utils/userProfile.js'
import { uploadProfileImage } from '../utils/storage.js'
import { sanitizeText } from '../utils/sanitize.js'

const years = ['FY', 'SY', 'TY', 'Final Year']


export default function CreateProfilePage() {
  const navigate = useNavigate()
  const nameRef = useRef(null)

  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [college, setCollege] = useState('')
  const [course, setCourse] = useState('')
  const [year, setYear] = useState(years[0])
  const [division, setDivision] = useState("")
  const [bio, setBio] = useState('')

  const [interestInput, setInterestInput] = useState('')
  const [interests, setInterests] = useState([])

  const [instagram, setInstagram] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [facebook, setFacebook] = useState('')
  const [snapchat, setSnapchat] = useState('')

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const addInterest = () => {
    const clean = sanitizeText(interestInput).trim()
    if (!clean) return
    if (interests.includes(clean)) {
      setInterestInput('')
      return
    }
    setInterests((prev) => [...prev, clean])
    setInterestInput('')
  }

  const removeInterest = (value) => {
    setInterests((prev) => prev.filter((item) => item !== value))
  }

  const handleInterestKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addInterest()
    }
  }

  const validate = () => {
    const next = {}
    if (!fullName.trim()) next.fullName = 'Full name is required'
    if (!username.trim()) next.username = 'Username is required'
    else if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username.trim())) {
      next.username = '3-20 characters — letters, numbers, "." or "_" only'
    }
    if (!college.trim()) next.college = 'College name is required'
    if (!course.trim()) next.course = 'Course is required'
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
      let photoURL = null
      if (photoFile) {
        photoURL = await uploadProfileImage(uid, photoFile)
      }

      await saveUserProfile(uid, {
        uid,
        fullName: sanitizeText(fullName).trim(),
        username: sanitizeText(username).trim(),
        college: sanitizeText(college).trim(),
        course: sanitizeText(course).trim(),
        year,
        division,
        bio: sanitizeText(bio).trim(),
        interests,
        photoURL,
        instagram: sanitizeText(instagram).trim(),
        linkedin: sanitizeText(linkedin).trim(),
        facebook: sanitizeText(facebook).trim(),
        snapchat: sanitizeText(snapchat).trim(),
        role: 'student',
        profileCompleted: true
      })

      navigate('/home')
    } catch (err) {
      setSubmitError(err?.message || 'Could not save your profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Almost there"
      title="Create your profile"
      subtitle="This is how classmates will find and recognize you."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Photo */}
        <div className="flex flex-col items-center">
          <label htmlFor="profile-photo" className="relative cursor-pointer group">
            <div className="w-20 h-20 rounded-full bg-accent-tint border border-line overflow-hidden flex items-center justify-center">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-accent font-semibold text-lg">
                  {fullName ? fullName.trim().charAt(0).toUpperCase() : '+'}
                </span>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-ink flex items-center justify-center border-2 border-surface group-hover:bg-accent-deep transition-colors duration-200">
              <Camera className="w-3.5 h-3.5 text-white" strokeWidth={1.8} />
            </span>
            <input id="profile-photo" type="file" accept="image/*" className="sr-only" onChange={handlePhotoChange} />
          </label>
          <p className="mt-2 text-[12.5px] text-ink-faint">Profile photo</p>
        </div>

        <Input
          ref={nameRef}
          id="profile-fullname"
          label="Full name"
          autoComplete="name"
          placeholder="Aarav Sharma"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          disabled={isSubmitting}
          required
        />

        <Input
          id="profile-username"
          label="Username"
          autoComplete="username"
          placeholder="aarav.sharma"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={errors.username}
          disabled={isSubmitting}
          required
        />

        <Input
          id="profile-college"
          label="College name"
          autoComplete="organization"
          placeholder="Xavier Institute of Engineering"
          value={college}
          onChange={(e) => setCollege(e.target.value)}
          error={errors.college}
          disabled={isSubmitting}
          required
        />

        <Input
          id="profile-course"
          label="Course"
          placeholder="Computer Science"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
          error={errors.course}
          disabled={isSubmitting}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="profile-year" className="block text-[13px] font-medium text-ink-soft mb-1.5">
              Year
            </label>
            <select
              id="profile-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl2 border border-line bg-bg px-4 py-3 text-[15px] text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition-colors duration-200"
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="profile-division" className="block text-[13px] font-medium text-ink-soft mb-1.5">
              Division
            </label>
            <input
              id="profile-division"
              type="text"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              placeholder="e.g. A, B, C, S1, C1, IT-A"
              className="w-full rounded-xl2 border border-line bg-bg px-4 py-3 text-[15px] text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition-colors duration-200"
            >
              {divisions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </input>
          </div>
        </div>

        <div>
          <label htmlFor="profile-bio" className="block text-[13px] font-medium text-ink-soft mb-1.5">
            Bio
          </label>
          <textarea
            id="profile-bio"
            rows={3}
            placeholder="A line about yourself..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={isSubmitting}
            className="w-full resize-none rounded-xl2 border border-line bg-bg px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition-colors duration-200"
          />
        </div>

        <div>
          <label htmlFor="profile-interests" className="block text-[13px] font-medium text-ink-soft mb-1.5">
            Interests
          </label>
          <input
            id="profile-interests"
            type="text"
            placeholder="Type an interest, press Enter"
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={handleInterestKeyDown}
            disabled={isSubmitting}
            className="w-full rounded-xl2 border border-line bg-bg px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition-colors duration-200"
          />
          {interests.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent-tint text-accent text-[12.5px] font-medium pl-3 pr-2 py-1.5"
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => removeInterest(interest)}
                    aria-label={`Remove ${interest}`}
                    className="hover:text-accent-deep transition-colors duration-200"
                  >
                    <X className="w-3 h-3" strokeWidth={2.4} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Optional socials */}
        <div className="pt-1">
          <p className="text-[13px] font-medium text-ink-soft mb-3">Social links (optional)</p>
          <div className="space-y-3">
            <div className="relative">
              <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                type="text"
                placeholder="Instagram username"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl2 border border-line bg-bg pl-11 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition-colors duration-200"
              />
            </div>
            <div className="relative">
              <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                type="text"
                placeholder="LinkedIn username"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl2 border border-line bg-bg pl-11 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition-colors duration-200"
              />
            </div>
            <div className="relative">
              <Facebook className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                type="text"
                placeholder="Facebook username"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl2 border border-line bg-bg pl-11 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition-colors duration-200"
              />
            </div>
            <div className="relative">
              <Ghost className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
              <input
                type="text"
                placeholder="Snapchat username"
                value={snapchat}
                onChange={(e) => setSnapchat(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl2 border border-line bg-bg pl-11 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-4 focus:ring-accent-tint transition-colors duration-200"
              />
            </div>
          </div>
        </div>

        {submitError && (
          <p role="alert" className="rounded-xl2 bg-red-50 border border-red-200 text-red-600 text-[13px] px-4 py-3">
            {submitError}
          </p>
        )}

        <Button type="submit" loading={isSubmitting}>
          Continue
        </Button>
      </form>
    </AuthLayout>
  )
}