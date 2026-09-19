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
  verifiedCampus: false
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
        verifiedCampus: Boolean(profile.verifiedCampus)
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
 * ROOT CAUSE FIX for "I changed my photo and my profile/sidebar/composer
 * updated, but my own old posts/comments still show the old avatar":
 * this cache is deliberately NOT time-invalidated (see the module
 * comment above) — a uid already in uidProfileCache is never re-fetched
 * for the rest of the tab's session, by design, to avoid a read storm
 * for a value that "changes rarely." That tradeoff is fine for OTHER
 * people's avatars, but it's actively wrong for the CURRENT signed-in
 * user: useAuthUser.js already keeps a live onSnapshot(users/{uid})
 * listener on their own profile document for the entire session (how
 * Profile/sidebar/composer stay live in the first place) — this cache
 * just never learned about those updates, so every post/comment by that
 * same uid kept rendering whatever got cached the first time it was
 * enriched, potentially for the rest of the session, until a full page
 * reload wiped uidProfileCache clean.
 *
 * Call this from useAuthUser.js's onSnapshot callback with every
 * profile write for the CURRENT user — the one uid this app always has
 * fresh, authoritative data for. This keeps enrichWithAuthors'/
 * useAuthorProfile's shared cache honest for that uid without adding a
 * listener per author (which is exactly the cost this cache exists to
 * avoid for everyone else), and without any individual screen/component
 * needing its own invalidation logic — one write path (the profile
 * document itself, via the one listener that already watches it) keeps
 * every consumer of this cache in sync.
 */
export function primeAuthorCache(uid, profileData) {
  if (!uid || !profileData) return
  uidProfileCache.set(uid, {
    displayName: profileData.displayName || FALLBACK_PROFILE.displayName,
    username: profileData.username || '',
    avatar: profileData.avatar || '',
    campusAvatarUrl: profileData.campusAvatarUrl || '',
    avatarMode: profileData.avatarMode || 'photo',
    verifiedCampus: Boolean(profileData.verifiedCampus)
  })
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
  const profileByUid = await getProfilesByUids(uniqueUids)

  return items.map((item) => {
    const uid = getUid(item)
    const profile = uid ? profileByUid.get(uid) || FALLBACK_PROFILE : FALLBACK_PROFILE
    return applyProfile(item, profile)
  })
}

/**
 * Same shared cache/dedup as enrichWithAuthors, returned as a plain
 * uid -> profile Map instead of merged onto a list — for callers that
 * keep their own `profiles` lookup state rather than a mapped item
 * array (e.g. MessagesPage.jsx's chat list, which looks up
 * `profiles[chat.otherUid]` both for rendering AND for search
 * filtering). Consolidates what used to be a page-local
 * getUserProfile()-per-chat effect with its own ad hoc dedup ref into
 * this one already-shared, already-current-user-fresh mechanism —
 * exactly the "no independent avatar logic per screen" requirement.
 */
export async function getProfilesByUids(uids) {
  const uniqueUids = Array.from(new Set((uids || []).filter(Boolean)))
  const profiles = await Promise.all(uniqueUids.map((uid) => fetchProfile(uid)))
  return new Map(uniqueUids.map((uid, index) => [uid, profiles[index]]))
}
