import { useEffect, useState } from 'react'
import { getUserProfile } from '../firebase/profileService.js'
import { FALLBACK_NAME, profileName } from '../identity/identity.js'

/**
 * The ONE shared author/actor enrichment utility — feeds, comments,
 * notifications, chat lists and typing indicators all go through this, so
 * every surface shows the CURRENT profile instead of a stale write-time
 * snapshot, and each uid is fetched once per session (module-level cache,
 * cleared on reload; deduped + parallel for lists).
 *
 * Identity states (see src/identity/identity.js for the display policy):
 *   status 'active'      — users/{uid} exists and isn't suspended
 *   status 'deleted'     — users/{uid} does not exist  -> "Student", no photo
 *   status 'suspended'   — moderationStatus 'suspended' -> "Student", no photo
 *   status 'unavailable' — the lookup FAILED (offline, timeout, transient
 *                          permission error). Callers fall back to the name
 *                          stored on the content. NOT cached as deleted.
 *
 * ROOT CAUSE FIXED HERE ("active accounts show Student"):
 *  1. any failed fetch used to be cached as a deleted "Student" profile for
 *     the rest of the session;
 *  2. primeAuthorCache() stored the signed-in user's RAW users/{uid} doc,
 *     which (from onboarding) has `fullName` but no `displayName`, so the
 *     user's own posts/comments rendered as "Student".
 */

const uidProfileCache = new Map()
// Failed lookups are remembered only briefly (no request storm on a broken
// network) and then retried — never promoted to "deleted".
const FAILURE_RETRY_MS = 30 * 1000
const failedAt = new Map()

/** Shown for deleted or suspended accounts (privacy: no username/photo). */
const hiddenProfile = (status) => ({
  status,
  displayName: FALLBACK_NAME,
  username: '',
  avatar: '',
  campusAvatarUrl: '',
  avatarMode: 'photo',
  verifiedCampus: false
})

/** Lookup failed — callers fall back to the name stored on the content. */
export const UNAVAILABLE_PROFILE = Object.freeze({
  status: 'unavailable',
  displayName: '',
  username: '',
  avatar: '',
  campusAvatarUrl: '',
  avatarMode: 'photo',
  verifiedCampus: false
})

function toCachedProfile(profile) {
  if (!profile) return hiddenProfile('deleted')
  if (profile.moderationStatus === 'suspended') return hiddenProfile('suspended')
  return {
    status: 'active',
    displayName: profileName(profile),
    username: profile.username || '',
    avatar: profile.avatar || '',
    campusAvatarUrl: profile.campusAvatarUrl || '',
    avatarMode: profile.avatarMode || 'photo',
    verifiedCampus: Boolean(profile.verifiedCampus),
    moderationStatus: profile.moderationStatus || 'active'
  }
}

async function fetchProfile(uid) {
  if (uidProfileCache.has(uid)) return uidProfileCache.get(uid)
  const lastFailure = failedAt.get(uid)
  if (lastFailure && Date.now() - lastFailure < FAILURE_RETRY_MS) return UNAVAILABLE_PROFILE

  const fetchPromise = (async () => {
    try {
      // getUserProfile resolves null ONLY when users/{uid} does not exist
      // (deleted account). A thrown error is a failed request, not a deletion.
      return toCachedProfile(await getUserProfile(uid))
    } catch {
      return null
    }
  })()

  uidProfileCache.set(uid, fetchPromise)
  const resolved = await fetchPromise
  if (resolved) {
    failedAt.delete(uid)
    uidProfileCache.set(uid, resolved) // replace the in-flight promise with its resolved value
    return resolved
  }
  uidProfileCache.delete(uid)
  failedAt.set(uid, Date.now())
  return UNAVAILABLE_PROFILE
}

/** Test hook: forget everything cached. */
export function _resetAuthorCacheForTests() {
  uidProfileCache.clear()
  failedAt.clear()
}

/**
 * Keeps the cache honest for the CURRENT signed-in user, whose users/{uid}
 * doc useAuthUser.js already watches live (so their own posts/comments
 * update immediately after a profile edit). The raw document is normalized
 * here (fullName fallback, suspended masking) — this was where the
 * signed-in user's own name got lost.
 */
export function primeAuthorCache(uid, profileData) {
  if (!uid || !profileData) return
  failedAt.delete(uid)
  uidProfileCache.set(uid, toCachedProfile(profileData))
}

/**
 * One profile by uid. Returns `undefined` while loading (so callers can
 * tell "not loaded yet" apart from a deleted account), then the cached
 * profile object (with `status`).
 */
export function useAuthorProfile(uid) {
  const [profile, setProfile] = useState(() => {
    const cached = uid ? uidProfileCache.get(uid) : undefined
    return cached && typeof cached.then !== 'function' ? cached : undefined
  })

  useEffect(() => {
    if (!uid) {
      setProfile(undefined)
      return undefined
    }
    let cancelled = false
    fetchProfile(uid).then((result) => {
      if (!cancelled) setProfile(result)
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  return profile
}

/**
 * Batch entry point — takes an array of items that each have a uid at
 * `getUid(item)`, returns a NEW array with the profile merged onto each item
 * via `applyProfile(item, profile)`. Deduplicates uids before fetching.
 * Items without a uid get UNAVAILABLE_PROFILE, so the item's own stored
 * name is used rather than "Student".
 */
export async function enrichWithAuthors(items, getUid, applyProfile) {
  const uniqueUids = Array.from(new Set(items.map(getUid).filter(Boolean)))
  const profileByUid = await getProfilesByUids(uniqueUids)

  return items.map((item) => {
    const uid = getUid(item)
    const profile = uid ? profileByUid.get(uid) || UNAVAILABLE_PROFILE : UNAVAILABLE_PROFILE
    return applyProfile(item, profile)
  })
}

/** Same cache/dedup, returned as a uid -> profile Map. */
export async function getProfilesByUids(uids) {
  const uniqueUids = Array.from(new Set((uids || []).filter(Boolean)))
  const profiles = await Promise.all(uniqueUids.map((uid) => fetchProfile(uid)))
  return new Map(uniqueUids.map((uid, index) => [uid, profiles[index]]))
}
