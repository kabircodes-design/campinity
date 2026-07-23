import { useEffect, useState } from 'react'

const LAST_SHOWN_KEY = 'campinity:campusReminder:lastShown'
const FIRST_SEEN_KEY = 'campinity:campusReminder:firstSeen'
const BANNER_DISMISSED_KEY = 'campinity:campusReminder:bannerDismissed'

const DAY_MS = 24 * 60 * 60 * 1000

function readLocal(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — the reminder just won't be throttled across
    // sessions for this browser; it will still behave correctly within
    // this one.
  }
}

/**
 * Resolves "day 0" for the reminder frequency tiers from the profile's
 * existing signup timestamp (createdAt, already set by onboarding — no
 * duplicate field created for this feature).
 *
 * Production-safe fallback: if createdAt is genuinely missing (should
 * never happen for a real account, since onboarding always sets it via
 * serverTimestamp(), but this defends against it rather than crashing
 * or silently treating every day as day 0 forever), day 0 is anchored
 * to the first time THIS browser ever evaluated this reminder for this
 * user, persisted locally so the tiers still progress sensibly.
 */
function getSignupTimestampMs(profile) {
  const createdAt = profile?.createdAt
  if (createdAt?.toMillis) return createdAt.toMillis()

  let firstSeen = readLocal(FIRST_SEEN_KEY)
  if (!firstSeen) {
    firstSeen = String(Date.now())
    writeLocal(FIRST_SEEN_KEY, firstSeen)
  }
  return Number(firstSeen)
}

/**
 * Day 0-3: 'daily' (once per 24h). Day 4-7: 'every-open' (no
 * throttling). Day 8+: back to 'daily'.
 */
function getFrequencyTier(daysSinceSignup) {
  if (daysSinceSignup >= 4 && daysSinceSignup <= 7) return 'every-open'
  return 'daily'
}

function moreThanADayAgo(isoString) {
  if (!isoString) return true
  const elapsed = Date.now() - new Date(isoString).getTime()
  return elapsed >= DAY_MS
}

/**
 * Business logic for the Campus Verification reminder system.
 *
 * Takes the profile HomePage has already loaded (via profileService's
 * getUserProfile) — no additional Firestore read is issued here.
 * verificationStatus is reused as-is; nothing new is written to
 * Firestore by this hook.
 *
 * Returns whether the full-screen modal and the persistent banner
 * should currently be visible, plus the handlers to close/dismiss them.
 * Verified users (verificationStatus === 'verified') never see either.
 */
export function useCampusVerificationReminder(profile) {
  const isVerified = profile?.verificationStatus === 'verified'

  const [showModal, setShowModal] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!profile || isVerified) {
      setShowModal(false)
      setShowBanner(false)
      return
    }

    const signupMs = getSignupTimestampMs(profile)
    const daysSinceSignup = Math.max(0, Math.floor((Date.now() - signupMs) / DAY_MS))
    const tier = getFrequencyTier(daysSinceSignup)

    const lastShown = readLocal(LAST_SHOWN_KEY)
    const modalIsDue = tier === 'every-open' ? true : moreThanADayAgo(lastShown)

    if (modalIsDue) {
      setShowModal(true)
      writeLocal(LAST_SHOWN_KEY, new Date().toISOString())
    }

    // Banner-dismissed state lives in sessionStorage specifically —
    // "dismiss only hides the banner until next app launch" is exactly
    // what sessionStorage already does on its own (cleared when the
    // browser/tab session ends), with no date math required.
    let bannerDismissed = false
    try {
      bannerDismissed = window.sessionStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
    } catch {
      bannerDismissed = false
    }
    setShowBanner(!bannerDismissed)
  }, [profile, isVerified])

  const closeModal = () => setShowModal(false)

  const dismissBanner = () => {
    setShowBanner(false)
    try {
      window.sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true')
    } catch {
      // Storage unavailable — banner just won't stay dismissed for this
      // session, not a functional break.
    }
  }

  return { isVerified, showModal, showBanner, closeModal, dismissBanner }
}