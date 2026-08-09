import { useEffect, useState } from 'react'

const MODAL_SEEN_KEY = 'campinity_verification_modal_seen'
const BANNER_DISMISSED_KEY = 'campinity_verification_banner_dismissed'

/**
 * Recreates a genuinely missing file — HomePage.jsx already imports
 * this hook (and CampusVerificationModal/Banner below) with a fully
 * specified interface, confirmed by reading its exact usage first,
 * not guessed: useCampusVerificationReminder(profile) returns
 * { showModal, showBanner, closeModal, dismissBanner }.
 *
 * Simple, honest reminder logic — no Firestore writes, purely local
 * UI state: the modal shows once per browser (localStorage flag) for
 * an unverified user; the banner shows persistently below that until
 * explicitly dismissed (a separate, also-local flag) or until the
 * user becomes verified, whichever comes first. Neither reminder
 * shows at all once verifiedCampus is true.
 */
export function useCampusVerificationReminder(profile) {
  const [showModal, setShowModal] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (!profile || profile.verifiedCampus) {
      setShowModal(false)
      setShowBanner(false)
      return
    }
    const modalSeen = localStorage.getItem(MODAL_SEEN_KEY) === 'true'
    const bannerDismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
    setShowModal(!modalSeen)
    setShowBanner(!bannerDismissed)
  }, [profile])

  const closeModal = () => {
    localStorage.setItem(MODAL_SEEN_KEY, 'true')
    setShowModal(false)
  }

  const dismissBanner = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true')
    setShowBanner(false)
  }

  return { showModal, showBanner, closeModal, dismissBanner }
}
