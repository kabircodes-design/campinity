import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  AtSign,
  BookOpen,
  Camera,
  Check,
  GraduationCap,
  Hash,
  Heart,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserRound,
  X,
  XCircle
} from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import CollegeSearch from '../components/CollegeSearch.jsx'
import Loader from '../auth/components/Loader.jsx'
import CampusAvatarFlow from '../avatar/CampusAvatarFlow.jsx'
import ProfilePhotoEditor from '../avatar/ProfilePhotoEditor.jsx'
import { deleteCampusAvatarFile } from '../avatar/avatarStorage.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getCollegeById } from '../data/dummyColleges.js'
import { auth } from '../firebase/firebase.js'
import { getUserProfile, updateUserProfile } from '../firebase/profileService.js'
import { getAvatarColor } from '../firebase/postService.js'
import { reserveUsername } from '../firebase/usernameService.js'
import { useUsernameAvailability } from '../hooks/useUsernameAvailability.js'
import { awardXP } from '../gamification/xpService.js'
import { POINTS_REWARDS } from '../gamification/config.js'
import { DIVISION_FORMAT_HINT, normalizeDivision, normalizeRollNumber } from '../utils/profileValidation.js'

const years = ['FYJC', 'SYJC', 'FY', 'SY', 'TY', 'Final Year']
const NAME_MAX = 60
const BIO_MAX = 300

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

const inputCls = (hasError) =>
  `w-full rounded-xl border bg-white dark:bg-white/[0.04] px-3.5 py-3 text-[15px] text-gray-900 dark:text-gray-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-all duration-200 focus:ring-4 disabled:opacity-60 ${
    hasError
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10 dark:border-red-500/50'
      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/10 dark:border-white/10 dark:focus:border-blue-400'
  }`

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section className="rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <header className="flex items-start gap-3 mb-4">
        <span className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
          <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h2>
          {hint && <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug">{hint}</p>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ id, label, error, helper, counter, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={id} className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {counter}
      </div>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12.5px] text-red-600 dark:text-red-400">{error}</p>
      ) : helper ? (
        <div className="mt-1.5 text-[12.5px] text-gray-500 dark:text-gray-400">{helper}</div>
      ) : null}
    </div>
  )
}

const Counter = ({ value, max }) => {
  const near = value > max * 0.9
  return <span className={`text-[11.5px] tabular-nums ${near ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>{value}/{max}</span>
}

function TagInput({ id, label, icon: Icon, values, onAdd, onRemove, placeholder, disabled }) {
  const [input, setInput] = useState('')
  const add = () => {
    const clean = input.trim().replace(/,$/, '').trim()
    if (clean && !values.some((v) => v.toLowerCase() === clean.toLowerCase())) onAdd(clean.slice(0, 30))
    setInput('')
  }
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      add()
    } else if (event.key === 'Backspace' && !input && values.length) {
      onRemove(values[values.length - 1])
    }
  }
  return (
    <Field id={id} label={label} counter={<span className="text-[11.5px] text-gray-400 dark:text-gray-500">{values.length} added</span>}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id={id}
            type="text"
            value={input}
            disabled={disabled}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            enterKeyHint="done"
            className={`${inputCls(false)} pl-10`}
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={disabled || !input.trim()}
          aria-label={`Add ${label.toLowerCase().replace(/s$/, '')}`}
          className="flex-shrink-0 w-12 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center active:scale-95 transition-all duration-200 disabled:opacity-30"
        >
          <Plus className="w-5 h-5" strokeWidth={2.4} />
        </button>
      </div>
      {values.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-2" aria-label={label}>
          {values.map((value) => (
            <li key={value} className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[13px] font-medium pl-3 pr-1 py-1 animate-[fadeIn_180ms_ease]">
              {value}
              <button
                type="button"
                onClick={() => onRemove(value)}
                disabled={disabled}
                aria-label={`Remove ${value}`}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors duration-200"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2.4} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  )
}

/** Real completeness (same fields the profile_completed XP award checks, plus photo/department). */
function profileStrength({ avatarUrl, name, username, bio, selectedCollege, department, skills, interests }) {
  const steps = [
    { ok: Boolean(avatarUrl), tip: 'Add a profile photo' },
    { ok: Boolean(name.trim()), tip: 'Add your full name' },
    { ok: Boolean(username.trim()), tip: 'Pick a username' },
    { ok: Boolean(bio.trim()), tip: 'Write a short bio' },
    { ok: Boolean(selectedCollege), tip: 'Choose your college' },
    { ok: Boolean(department.trim()), tip: 'Add your department' },
    { ok: skills.length > 0, tip: 'Add at least one skill' },
    { ok: interests.length > 0, tip: 'Add at least one interest' }
  ]
  const done = steps.filter((s) => s.ok).length
  return { percent: Math.round((done / steps.length) * 100), next: steps.find((s) => !s.ok)?.tip || null }
}

/**
 * Gamification wiring, added this pass: profile_completed awards once
 * the profile genuinely meets a completeness bar (name + username +
 * bio + college + at least one skill and one interest) — checked
 * AFTER a successful save, deduped by uid alone (a user can only
 * complete their profile once; subsequent edits to an already-complete
 * profile correctly award nothing again, since the dedupeKey would
 * already exist).
 */
function isProfileComplete({ name, username, bio, selectedCollege, skills, interests }) {
  return Boolean(
    name.trim() && username.trim() && bio.trim() && selectedCollege && skills.length > 0 && interests.length > 0
  )
}

export default function EditProfilePage() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [avatarUrl, setAvatarUrl] = useState('') // the real uploaded photo — profile.avatar, resolved for display via getProfileIdentityImage
  const [verifiedCampus, setVerifiedCampus] = useState(false)
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false)
  const [campusAvatarUrl, setCampusAvatarUrl] = useState('')
  const [avatarMode, setAvatarMode] = useState('photo')
  const [avatarFlowOpen, setAvatarFlowOpen] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const [avatarActionError, setAvatarActionError] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')
  const [bio, setBio] = useState('')
  const [selectedCollege, setSelectedCollege] = useState(null)
  const [department, setDepartment] = useState('')
  const [year, setYear] = useState(years[0])
  const [division, setDivision] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [skills, setSkills] = useState([])
  const [interests, setInterests] = useState([])

  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  // Unsaved-changes guard: a snapshot of the editable fields taken once the
  // profile has loaded; leaving with a different snapshot asks first.
  const formSnapshot = JSON.stringify({ name, username, bio, collegeId: selectedCollege?.id || null, department, year, division, rollNumber, skills, interests })
  const initialSnapshotRef = useRef(null)
  const isDirty = initialSnapshotRef.current !== null && formSnapshot !== initialSnapshotRef.current
  const requestLeave = () => (isDirty ? setConfirmLeave(true) : navigate('/profile'))

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
          // Real, previously-absent fields — EditProfilePage had no
          // Division/Roll Number inputs at all before this pass, so a
          // division set once at onboarding could never be viewed or
          // corrected here, and roll number didn't exist anywhere yet.
          setDivision(profile.division || '')
          setRollNumber(profile.rollNumber || '')
          setSkills(profile.skills || [])
          setInterests(profile.interests || [])
          setCampusAvatarUrl(profile.campusAvatarUrl || '')
          setAvatarMode(profile.avatarMode || 'photo')
          setAvatarUrl(getProfileIdentityImage(profile) || '')
          setVerifiedCampus(profile.verifiedCampus === true)
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

  useEffect(() => {
    if (!loading && !loadError && initialSnapshotRef.current === null) initialSnapshotRef.current = formSnapshot
  }, [loading, loadError, formSnapshot])
  useEffect(() => {
    if (!isDirty) return undefined
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const usernameCheck = useUsernameAvailability(username, originalUsername)

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
    const { error: divisionError } = normalizeDivision(division)
    if (divisionError) next.division = divisionError
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // Same casing-only auto-correct as CreateProfilePage's own division
  // field (s-3 -> S-3, a -> A) — shared logic via normalizeDivision, not
  // a second implementation.
  const handleDivisionBlur = () => {
    const { value, error } = normalizeDivision(division)
    if (!error) setDivision(value)
  }

  const handleUseMode = async (mode) => {
    setAvatarActionError('')
    const uid = auth.currentUser?.uid
    if (!uid) return
    const previousMode = avatarMode
    setAvatarMode(mode) // optimistic — reverted below on failure
    try {
      await updateUserProfile(uid, { avatarMode: mode })
    } catch (err) {
      setAvatarMode(previousMode)
      setAvatarActionError(err?.message || 'Could not switch — please try again.')
    }
  }

  const handleRemoveAvatar = async () => {
    if (removingAvatar) return
    setRemovingAvatar(true)
    setAvatarActionError('')
    const uid = auth.currentUser?.uid
    try {
      await updateUserProfile(uid, { campusAvatarUrl: '', avatarMode: 'photo', campusAvatarUpdatedAt: null })
      // Storage cleanup is best-effort (deleteCampusAvatarFile already
      // swallows its own errors) and happens AFTER the Firestore write
      // succeeds — the user's real photo is never touched by this
      // path, matching "do not accidentally delete the user's real
      // profile photo."
      await deleteCampusAvatarFile(campusAvatarUrl)
      setCampusAvatarUrl('')
      setAvatarMode('photo')
      setConfirmingRemove(false)
    } catch (err) {
      setAvatarActionError(err?.message || 'Could not remove your Campus Avatar. Please try again.')
    } finally {
      setRemovingAvatar(false)
    }
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
        // Denormalized name alongside collegeId — real gap found during
        // audit: this call never wrote a plain `college` string at all,
        // so search results/other surfaces reading `profile.college`
        // directly stayed stale (still the onboarding-time value, or
        // blank) after a user changed their college here.
        college: selectedCollege.name,
        course: department.trim(),
        year,
        division: normalizeDivision(division).value,
        rollNumber: normalizeRollNumber(rollNumber),
        skills,
        interests
      })

      if (isProfileComplete({ name, username: reservedUsername, bio, selectedCollege, skills, interests })) {
        await awardXP(uid, 'profile_completed', {
          campusPoints: POINTS_REWARDS.profile_completed || 0,
          dedupeKey: `profile_completed_${uid}`
        }).catch(() => {})
      }

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-[#09090f]">
        <Loader size="lg" tone="dark" />
      </div>
    )
  }

  const strength = profileStrength({ avatarUrl, name, username, bio, selectedCollege, department, skills, interests })
  const previewName = name.trim() || 'Your name'
  const previewMeta = [selectedCollege?.name, year].filter(Boolean).join(' · ')
  const usernameStatus = usernameCheck.status
  const canSave = isDirty && !isSaving && usernameStatus !== 'checking'

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] lg:overflow-y-auto lg:min-w-0 overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
      <div className="relative mx-auto max-w-[480px] lg:max-w-[640px]">
        <header className="sticky top-0 z-40 bg-gray-50/90 dark:bg-[#09090f]/90 backdrop-blur-md">
          <div className="h-14 flex items-center gap-2 px-3">
            <button
              type="button"
              aria-label="Cancel"
              onClick={requestLeave}
              className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/10 active:scale-95 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-gray-50 leading-tight">Edit profile</h1>
              <p className={`text-[11.5px] leading-tight transition-opacity duration-200 ${isDirty ? 'text-amber-600 dark:text-amber-400 opacity-100' : 'opacity-0'}`} aria-live="polite">
                {isDirty ? '● Unsaved changes' : ' '}
              </p>
            </div>
            <button
              type="submit"
              form="edit-profile-form"
              disabled={!canSave}
              className="h-10 px-5 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-sm shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all duration-200 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-gray-500 inline-flex items-center gap-1.5"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Saving' : 'Save'}
            </button>
          </div>
        </header>

        <form id="edit-profile-form" onSubmit={handleSave} noValidate className="px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] space-y-4">
          {loadError && (
            <p role="alert" className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-[13px] px-4 py-3">
              {loadError}
            </p>
          )}

          {/* Identity hero — live preview of how you appear across Campinity. */}
          <section className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#11131a] border border-gray-100 dark:border-white/10 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="h-24 bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600" aria-hidden="true">
              <div className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            </div>
            <div className="px-5 pb-5 -mt-12 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => setPhotoEditorOpen(true)}
                aria-label="Change profile photo"
                className="relative group rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30"
              >
                <div className="w-24 h-24 rounded-full ring-4 ring-white dark:ring-[#11131a] bg-blue-50 overflow-hidden flex items-center justify-center shadow-lg shadow-blue-900/10 transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-95">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Avatar initials={getInitials(name)} colorClass={getAvatarColor(auth.currentUser?.uid)} size="xl" />
                  )}
                </div>
                <span className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center ring-[3px] ring-white dark:ring-[#11131a] group-hover:bg-blue-700 transition-colors duration-200">
                  <Camera className="w-4 h-4 text-white" strokeWidth={2} />
                </span>
              </button>
              <p className="mt-3 text-[19px] font-bold tracking-tight text-gray-900 dark:text-gray-50 max-w-full truncate">{previewName}</p>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 max-w-full truncate">
                {username.trim() ? `@${username.trim()}` : '@username'}
                {previewMeta && <span> · {previewMeta}</span>}
              </p>

              <div className="mt-4 w-full rounded-2xl bg-gray-50 dark:bg-white/[0.04] px-4 py-3 text-left">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">Profile strength</span>
                  <span className={`font-bold tabular-nums ${strength.percent === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>{strength.percent}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={strength.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile strength">
                  <div className={`h-full rounded-full transition-[width] duration-500 ${strength.percent === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} style={{ width: `${strength.percent}%` }} />
                </div>
                <p className="mt-1.5 text-[12px] text-gray-500 dark:text-gray-400">
                  {strength.next ? `Next: ${strength.next}` : 'Your profile is complete — nice work!'}
                </p>
              </div>
            </div>
          </section>

          <Section icon={Sparkles} title="Campus Avatar" hint="An illustrated look made from a selfie — no real photo shown.">
            {avatarActionError && <p role="alert" className="text-[12.5px] text-red-600 dark:text-red-400">{avatarActionError}</p>}
            {campusAvatarUrl ? (
              <div className="flex items-center gap-3">
                <img src={campusAvatarUrl} alt="Your Campus Avatar" className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-white/10" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-50">
                    {avatarMode === 'avatar' ? 'In use as your identity' : 'Saved, not in use'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {avatarMode !== 'avatar' ? (
                      <button type="button" onClick={() => handleUseMode('avatar')} className="h-8 px-3 rounded-full bg-blue-600 text-white text-[12.5px] font-semibold active:scale-95 transition-all duration-200">
                        Use avatar
                      </button>
                    ) : (
                      avatarUrl && (
                        <button type="button" onClick={() => handleUseMode('photo')} className="h-8 px-3 rounded-full bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 text-[12.5px] font-semibold active:scale-95 transition-all duration-200">
                          Use photo instead
                        </button>
                      )
                    )}
                    <button type="button" onClick={() => setAvatarFlowOpen(true)} className="h-8 px-3 rounded-full bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 text-[12.5px] font-semibold inline-flex items-center gap-1 active:scale-95 transition-all duration-200">
                      <RefreshCw className="w-3.5 h-3.5" /> Change
                    </button>
                    <button type="button" onClick={() => setConfirmingRemove(true)} className="h-8 px-3 rounded-full text-red-600 dark:text-red-400 text-[12.5px] font-semibold inline-flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-500/10 active:scale-95 transition-all duration-200">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAvatarFlowOpen(true)}
                className="w-full rounded-2xl border border-dashed border-blue-300 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-500/5 px-4 py-3.5 text-left flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 active:scale-[0.99] transition-all duration-200"
              >
                <span className="w-10 h-10 rounded-2xl bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-blue-700 dark:text-blue-300">Create your Campus Avatar</span>
                  <span className="block text-[12.5px] text-blue-600/80 dark:text-blue-300/70">Takes about a minute</span>
                </span>
              </button>
            )}
            {confirmingRemove && (
              <div role="alertdialog" aria-labelledby="remove-avatar-title" className="rounded-2xl border border-red-100 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3.5 animate-[fadeIn_180ms_ease]">
                <p id="remove-avatar-title" className="text-sm font-semibold text-gray-900 dark:text-gray-50">Remove Campus Avatar?</p>
                <p className="mt-1 text-[12.5px] text-gray-600 dark:text-gray-300">Your profile photo isn't affected.</p>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => setConfirmingRemove(false)} disabled={removingAvatar} className="flex-1 h-10 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 text-[13px] font-semibold disabled:opacity-50">
                    Keep it
                  </button>
                  <button type="button" onClick={handleRemoveAvatar} disabled={removingAvatar} className="flex-1 h-10 rounded-full bg-red-600 text-white text-[13px] font-semibold disabled:opacity-50">
                    {removingAvatar ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section icon={UserRound} title="About you" hint="How students find and recognise you.">
            <Field id="edit-name" label="Full name" error={errors.name} counter={<Counter value={name.length} max={NAME_MAX} />}>
              <input id="edit-name" type="text" autoComplete="name" maxLength={NAME_MAX} value={name} onChange={(event) => setName(event.target.value)} disabled={isSaving} className={inputCls(errors.name)} />
            </Field>

            <Field
              id="edit-username"
              label="Username"
              error={errors.username}
              helper={
                usernameCheck.message ? (
                  <span className={`inline-flex items-center gap-1 ${usernameStatus === 'available' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{usernameCheck.message}</span>
                ) : (
                  '3–20 characters: lowercase letters, numbers and underscores.'
                )
              }
            >
              <div className="relative">
                <AtSign className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="edit-username"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLowerCase())}
                  disabled={isSaving}
                  aria-describedby="edit-username-status"
                  className={`${inputCls(errors.username)} pl-10 pr-10`}
                />
                <span id="edit-username-status" className="absolute right-3.5 top-1/2 -translate-y-1/2" aria-live="polite">
                  {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" aria-label="Checking" />}
                  {usernameStatus === 'available' && <Check className="w-4 h-4 text-emerald-500" aria-label="Available" />}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <XCircle className="w-4 h-4 text-red-500" aria-label="Not available" />}
                </span>
              </div>
            </Field>

            <Field id="edit-bio" label="Bio" counter={<Counter value={bio.length} max={BIO_MAX} />} helper="A line about what you study, build or love.">
              <textarea id="edit-bio" rows={3} maxLength={BIO_MAX} value={bio} onChange={(event) => setBio(event.target.value)} disabled={isSaving} placeholder="CSE ’27 · robotics, chess and too much chai." className={`${inputCls(false)} resize-none leading-relaxed`} />
            </Field>
          </Section>

          <Section icon={GraduationCap} title="Campus" hint="Used for campus feeds, course-mates and verification.">
            <CollegeSearch id="edit-college" label="College" value={selectedCollege} onChange={setSelectedCollege} error={errors.college} disabled={isSaving} />

            <Field id="edit-department" label="Department / course">
              <div className="relative">
                <BookOpen className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input id="edit-department" type="text" value={department} onChange={(event) => setDepartment(event.target.value)} disabled={isSaving} placeholder="e.g. Computer Science" className={`${inputCls(false)} pl-10`} />
              </div>
            </Field>

            <div>
              <p id="edit-year-label" className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Year</p>
              <div role="radiogroup" aria-labelledby="edit-year-label" className="grid grid-cols-3 gap-2">
                {years.map((option) => {
                  const on = year === option
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={isSaving}
                      onClick={() => setYear(option)}
                      className={`h-11 rounded-xl text-[13.5px] font-semibold border transition-all duration-200 active:scale-95 ${
                        on
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20'
                          : 'bg-white dark:bg-white/[0.04] border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-white/20'
                      }`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field id="edit-division" label="Division" error={errors.division} helper={DIVISION_FORMAT_HINT}>
                <input id="edit-division" type="text" value={division} onChange={(event) => setDivision(event.target.value)} onBlur={handleDivisionBlur} placeholder="A or S-3" disabled={isSaving} className={inputCls(errors.division)} />
              </Field>
              <Field id="edit-rollNumber" label="Roll number">
                <input id="edit-rollNumber" type="text" inputMode="text" value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} disabled={isSaving} className={inputCls(false)} />
              </Field>
            </div>
          </Section>

          <Section icon={Heart} title="Skills & interests" hint="Help people with the same interests find you.">
            <TagInput
              id="edit-skills"
              label="Skills"
              icon={Hash}
              values={skills}
              disabled={isSaving}
              placeholder="e.g. React, Public speaking"
              onAdd={(value) => setSkills((prev) => [...prev, value])}
              onRemove={(value) => setSkills((prev) => prev.filter((item) => item !== value))}
            />
            <TagInput
              id="edit-interests"
              label="Interests"
              icon={Heart}
              values={interests}
              disabled={isSaving}
              placeholder="e.g. Chess, Robotics"
              onAdd={(value) => setInterests((prev) => [...prev, value])}
              onRemove={(value) => setInterests((prev) => prev.filter((item) => item !== value))}
            />
          </Section>

          {errors.form && (
            <p role="alert" className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-[13px] px-4 py-3">
              {errors.form}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={requestLeave} disabled={isSaving} className="flex-1 h-12 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-gray-700 dark:text-gray-200 text-sm font-semibold hover:border-gray-300 active:scale-[0.98] transition-all duration-200 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={!canSave} className="flex-[1.4] h-12 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-sm shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all duration-200 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-white/10 dark:disabled:text-gray-500 inline-flex items-center justify-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Saving…' : isDirty ? 'Save changes' : 'No changes yet'}
            </button>
          </div>
        </form>
      </div>

      <CampusAvatarFlow
        open={avatarFlowOpen}
        onClose={() => setAvatarFlowOpen(false)}
        onSaved={(url) => {
          setCampusAvatarUrl(url)
          setAvatarMode('avatar')
        }}
      />

      {confirmLeave && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="discard-title">
          <button type="button" aria-label="Dismiss" tabIndex={-1} onClick={() => setConfirmLeave(false)} className="absolute inset-0 bg-black/45 animate-[fadeIn_200ms_ease]" />
          <div className="relative w-full max-w-[380px] rounded-3xl bg-white dark:bg-[#161821] p-5 shadow-2xl animate-[modalIn_260ms_cubic-bezier(0.16,1,0.3,1)]">
            <p id="discard-title" className="text-[17px] font-bold text-gray-900 dark:text-gray-50">Discard your changes?</p>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">You have edits that haven't been saved.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmLeave(false)} className="flex-1 h-11 rounded-full border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 text-sm font-semibold">
                Keep editing
              </button>
              <button type="button" onClick={() => navigate('/profile')} className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      <ProfilePhotoEditor
        open={photoEditorOpen}
        onClose={() => setPhotoEditorOpen(false)}
        currentPhotoUrl={avatarUrl}
        verifiedCampus={verifiedCampus}
        onSaved={(url) => setAvatarUrl(url)}
      />
    </div>
  )
}
