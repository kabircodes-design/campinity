import { useEffect, useState } from 'react'
import { getUserProfile } from '../firebase/profileService.js'

/**
 * The ONE shared author/actor enrichment utility — Following feed, For
 * You/Campus/Clubs feed, and Notifications all go through this now,
 * per this task's explicit "never two different implementations"
 * requirement. Root cause this exists to fix: every feed/notification
 * was reading the `author`/actor snapshot written onto a post or
 * notification AT CREATION TIME (denormalized display fields). That
 * can never satisfy "if sender data changed later, it should still
 * display correctly" — a stale write-time snapshot is exactly what
 * would keep showing an old avatar after a profile photo change. This
 * hook fetches the CURRENT profile document instead.
 *
 * Module-level cache (uidProfileCache): shared across every component
 * using this hook, for the lifetime of the page/tab (cleared on full
 * reload). This is the "avoid repeated fetching of the same user"
 * requirement — if Following feed, For You feed, and Notifications are
 * all open/rendered in the same session and reference the same uid,
 * that uid is fetched once, not three times. Deliberately NOT
 * persisted beyond a reload and NOT time-invalidated: a short TTL
 * would still show stale data for part of its window, and a
 * real-time onSnapshot-per-unique-author would be a listener per
 * distinct person in a feed — expensive for a photo that changes
 * rarely. A plain in-memory cache that's fresh again on next load is
 * the honest middle ground between "always current" and "avoid
 * hammering Firestore."
 *
 * Batching: all unique uids in one input array are fetched in
 * parallel (Promise.all), not sequentially, and any uid already in
 * the cache is skipped entirely — this is what "avoid N+1" and "batch
 * author lookups" resolve to here, given getUserProfile (the only
 * profile-read function actually available in this project) is a
 * per-uid fetch, not a batch `in`-query API.
 *
 * Missing profile handling: getUserProfile rejecting or returning
 * null/undefined for a uid is treated as "this user no longer
 * exists," and cached as an explicit fallback object rather than
 * retried on every subsequent render — same performance reasoning as
 * the cache itself, and exactly the "gracefully show Student + default
 * avatar" behavior asked for, applied once and remembered.
 */

const uidProfileCache = new Map()

const FALLBACK_PROFILE = {
  displayName: 'Student',
  username: '',
  avatar: '',
  verified: false
}

async function fetchProfile(uid) {
  if (uidProfileCache.has(uid)) return uidProfileCache.get(uid)

  const fetchPromise = (async () => {
    try {
      const profile = await getUserProfile(uid)
      if (!profile) return FALLBACK_PROFILE
      return {
        displayName: profile.displayName || FALLBACK_PROFILE.displayName,
        username: profile.username || '',
        avatar: profile.avatar || '',
        campusAvatarUrl: profile.campusAvatarUrl || '',
        avatarMode: profile.avatarMode || 'photo',
        verified: Boolean(profile.verified)
      }
    } catch {
      return FALLBACK_PROFILE
    }
  })()

  uidProfileCache.set(uid, fetchPromise)
  const resolved = await fetchPromise
  uidProfileCache.set(uid, resolved) // replace the in-flight promise with its resolved value
  return resolved
}

/**
 * Call once per uid you need enriched right now, memoized per-uid by
 * the caller passing a stable uid — for a LIST of items (a feed, a
 * notifications page), use enrichAuthors() below instead, which
 * batches the whole list in one pass rather than one hook per item.
 */
export function useAuthorProfile(uid) {
  const [profile, setProfile] = useState(() => (uid ? uidProfileCache.get(uid) : null) || null)

  useEffect(() => {
    if (!uid) {
      setProfile(null)
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
 * `getUid(item)`, returns a NEW array with the enrichment merged onto
 * each item via `applyProfile(item, profile)`. Deduplicates uids
 * before fetching (a feed with 20 posts from 3 people fetches 3
 * profiles, not 20).
 */
export async function enrichWithAuthors(items, getUid, applyProfile) {
  const uniqueUids = Array.from(new Set(items.map(getUid).filter(Boolean)))
  const profiles = await Promise.all(uniqueUids.map((uid) => fetchProfile(uid)))
  const profileByUid = new Map(uniqueUids.map((uid, index) => [uid, profiles[index]]))

  return items.map((item) => {
    const uid = getUid(item)
    const profile = uid ? profileByUid.get(uid) || FALLBACK_PROFILE : FALLBACK_PROFILE
    return applyProfile(item, profile)
  })
}
