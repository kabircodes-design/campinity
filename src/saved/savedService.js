import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from '../firebase/firebase.js'

/**
 * New system, built on top of the existing users/{uid}/savedPosts
 * (kept, untouched, backward compatible — see this feature's own chat
 * explanation for why the two aren't merged automatically). Schema
 * fully documented in SAVED_SCHEMA.md.
 */

function itemDocId(entityType, entityId) {
  return `${entityType}_${entityId}`
}

function itemDoc(uid, entityType, entityId) {
  return doc(db, 'savedItems', uid, 'items', itemDocId(entityType, entityId))
}

function itemsCollection(uid) {
  return collection(db, 'savedItems', uid, 'items')
}

function collectionDoc(uid, collectionId) {
  return doc(db, 'savedCollections', uid, 'collections', collectionId)
}

function collectionsCollection(uid) {
  return collection(db, 'savedCollections', uid, 'collections')
}

/* ============================================================
   SAVE / UNSAVE — the bookmark button's core action. Saving with no
   collectionIds still creates the item (it's in "All Saved" and
   "Recently Saved" by virtue of existing at all — those aren't real
   collections, see schema doc), matching "✓ All Saved" as the always-
   available first option in the save sheet.
   ============================================================ */

export async function saveItem(uid, entityType, entityId, preview, collectionIds = []) {
  if (!uid) throw new Error('You need to be signed in to save.')
  await setDoc(itemDoc(uid, entityType, entityId), {
    entityType,
    entityId,
    preview: preview || null,
    collectionIds,
    savedAt: serverTimestamp()
  })
}

export async function unsaveItem(uid, entityType, entityId) {
  if (!uid) throw new Error('You need to be signed in.')
  await deleteDoc(itemDoc(uid, entityType, entityId))
}

export async function isItemSaved(uid, entityType, entityId) {
  if (!uid) return false
  const snap = await getDoc(itemDoc(uid, entityType, entityId))
  return snap.exists()
}

export function subscribeToIsItemSaved(uid, entityType, entityId, callback) {
  if (!uid) {
    callback(false)
    return () => {}
  }
  return onSnapshot(itemDoc(uid, entityType, entityId), (snap) => callback(snap.exists()))
}

/**
 * Toggles membership in ONE collection without touching whether the
 * item is saved at all or which OTHER collections it's in — this is
 * what "multi-save, all simultaneously" actually calls, once per
 * tapped collection in the save sheet. Creates the savedItems doc if
 * it doesn't exist yet (tapping a collection directly, without first
 * tapping "All Saved," should still save the item).
 */
export async function toggleItemInCollection(uid, entityType, entityId, preview, collectionId) {
  const ref = itemDoc(uid, entityType, entityId)
  const collRef = collectionDoc(uid, collectionId)

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    const alreadyIn = snap.exists() && (snap.data().collectionIds || []).includes(collectionId)

    if (!snap.exists()) {
      transaction.set(ref, {
        entityType,
        entityId,
        preview: preview || null,
        collectionIds: [collectionId],
        savedAt: serverTimestamp()
      })
      transaction.update(collRef, { itemCount: increment(1), updatedAt: serverTimestamp() })
      return
    }

    if (alreadyIn) {
      transaction.update(ref, { collectionIds: arrayRemove(collectionId) })
      transaction.update(collRef, { itemCount: increment(-1), updatedAt: serverTimestamp() })
    } else {
      transaction.update(ref, { collectionIds: arrayUnion(collectionId) })
      transaction.update(collRef, { itemCount: increment(1), updatedAt: serverTimestamp() })
    }
  })
}

/** Move — replaces collection membership entirely (removes from source, adds to destination). Copy/duplicate — see copyItemToCollection below, which adds without removing. */
export async function moveItemToCollection(uid, entityType, entityId, fromCollectionId, toCollectionId) {
  const ref = itemDoc(uid, entityType, entityId)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists()) return
    transaction.update(ref, { collectionIds: arrayUnion(toCollectionId) })
    if (fromCollectionId) {
      transaction.update(ref, { collectionIds: arrayRemove(fromCollectionId) })
      transaction.update(collectionDoc(uid, fromCollectionId), { itemCount: increment(-1) })
    }
    transaction.update(collectionDoc(uid, toCollectionId), { itemCount: increment(1), updatedAt: serverTimestamp() })
  })
}

export async function copyItemToCollection(uid, entityType, entityId, toCollectionId) {
  await toggleItemInCollection(uid, entityType, entityId, null, toCollectionId)
}

/* ============================================================
   READS — All Saved / Recently Saved are queries, not real
   collections (see schema doc). Both paginated.
   ============================================================ */

export async function getAllSavedItems(uid, { pageSize = 20, cursor = null } = {}) {
  const constraints = [orderBy('savedAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(itemsCollection(uid), ...constraints))
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

/** "Recently Saved" — the same underlying data as All Saved, capped smaller, no separate storage. */
export async function getRecentlySavedItems(uid, { pageSize = 12 } = {}) {
  const snap = await getDocs(query(itemsCollection(uid), orderBy('savedAt', 'desc'), limit(pageSize)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getItemsInCollection(uid, collectionId, { pageSize = 30, cursor = null } = {}) {
  const constraints = [where('collectionIds', 'array-contains', collectionId), orderBy('savedAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(itemsCollection(uid), ...constraints))
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null
  }
}

/* ============================================================
   COLLECTIONS — create/rename/delete/pin/cover, plus real-time
   subscription for the library page's grid.
   ============================================================ */

export async function createCollection(uid, { name, emoji = '', coverImage = '', isPrivate = true }) {
  if (!name?.trim()) throw new Error('Give your collection a name.')
  const ref = doc(collectionsCollection(uid))
  await setDoc(ref, {
    name: name.trim(),
    emoji,
    coverImage,
    isPrivate,
    pinned: false,
    itemCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ref.id
}

export async function updateCollection(uid, collectionId, data) {
  await updateDoc(collectionDoc(uid, collectionId), { ...data, updatedAt: serverTimestamp() })
}

export async function togglePinCollection(uid, collectionId, currentlyPinned) {
  await updateDoc(collectionDoc(uid, collectionId), { pinned: !currentlyPinned, updatedAt: serverTimestamp() })
}

/**
 * Deletes a collection — removes the collectionId from every item
 * that referenced it (items themselves are NOT deleted, they simply
 * fall back to being in "All Saved" only), then deletes the
 * collection document itself.
 */
export async function deleteCollection(uid, collectionId) {
  const snap = await getDocs(query(itemsCollection(uid), where('collectionIds', 'array-contains', collectionId)))
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { collectionIds: arrayRemove(collectionId) })))
  await deleteDoc(collectionDoc(uid, collectionId))
}

/**
 * Merges sourceCollectionId into targetCollectionId — every item in
 * source gets targetCollectionId added, source's own collectionIds
 * entry is removed from all of them, then source is deleted. Items
 * already in both end up simply staying in target (arrayUnion is
 * idempotent), not duplicated.
 */
export async function mergeCollections(uid, sourceCollectionId, targetCollectionId) {
  const snap = await getDocs(query(itemsCollection(uid), where('collectionIds', 'array-contains', sourceCollectionId)))
  await Promise.all(
    snap.docs.map((d) =>
      updateDoc(d.ref, { collectionIds: arrayUnion(targetCollectionId) }).then(() =>
        updateDoc(d.ref, { collectionIds: arrayRemove(sourceCollectionId) })
      )
    )
  )
  await updateDoc(collectionDoc(uid, targetCollectionId), { itemCount: increment(snap.size), updatedAt: serverTimestamp() })
  await deleteDoc(collectionDoc(uid, sourceCollectionId))
}

export function subscribeToCollections(uid, callback) {
  return onSnapshot(query(collectionsCollection(uid), orderBy('updatedAt', 'desc')), (snap) => {
    const collections = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    // Pinned first, per "pinned always appear first" — same sort
    // pattern already used for pinned chats in the Sharing System.
    collections.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
    callback(collections)
  })
}

export async function getCollection(uid, collectionId) {
  const snap = await getDoc(collectionDoc(uid, collectionId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}
