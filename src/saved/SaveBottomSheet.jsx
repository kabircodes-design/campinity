import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Plus } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import {
  subscribeToCollections,
  isItemSaved,
  saveItem,
  unsaveItem,
  toggleItemInCollection,
  createCollection
} from './savedService.js'

/**
 * Same portal pattern as ShareBottomSheet.jsx, applied from the start
 * this time — any position:fixed sheet rendered inside a page wrapped
 * by SwipeablePage.jsx breaks without it (verified root cause from
 * the Sharing System bug fix, not re-learned the hard way here).
 */
export default function SaveBottomSheet({ open, onClose, entityType, entityId, preview }) {
  const currentUid = auth.currentUser?.uid

  const [allSavedChecked, setAllSavedChecked] = useState(false)
  const [itemCollectionIds, setItemCollectionIds] = useState([])
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)

  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open || !currentUid) return undefined
    setLoading(true)
    let cancelled = false

    isItemSaved(currentUid, entityType, entityId).then((saved) => {
      if (!cancelled) setAllSavedChecked(saved)
    })

    const unsubscribe = subscribeToCollections(currentUid, (data) => {
      if (!cancelled) {
        setCollections(data)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [open, currentUid, entityType, entityId])

  useEffect(() => {
    if (!open) {
      setCreatingNew(false)
      setNewName('')
      setNewEmoji('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const toggleAllSaved = async () => {
    const next = !allSavedChecked
    setAllSavedChecked(next)
    try {
      if (next) {
        await saveItem(currentUid, entityType, entityId, preview, itemCollectionIds)
      } else {
        await unsaveItem(currentUid, entityType, entityId)
        setItemCollectionIds([])
      }
    } catch {
      setAllSavedChecked(!next)
    }
  }

  const toggleCollection = async (collectionId) => {
    const wasIn = itemCollectionIds.includes(collectionId)
    setItemCollectionIds((prev) => (wasIn ? prev.filter((id) => id !== collectionId) : [...prev, collectionId]))
    setAllSavedChecked(true) // saving into any collection also means the item is saved at all
    try {
      await toggleItemInCollection(currentUid, entityType, entityId, preview, collectionId)
    } catch {
      setItemCollectionIds((prev) => (wasIn ? [...prev, collectionId] : prev.filter((id) => id !== collectionId)))
    }
  }

  const handleCreateCollection = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const newId = await createCollection(currentUid, { name: newName, emoji: newEmoji })
      await toggleCollection(newId)
      setCreatingNew(false)
      setNewName('')
      setNewEmoji('')
    } finally {
      setCreating(false)
    }
  }

  const sheet = (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" />

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose()
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
        className="relative w-full max-w-[480px] lg:max-w-[520px] bg-white rounded-t-3xl max-h-[80vh] flex flex-col"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-4 pt-1 pb-3">
          <span className="text-base font-bold text-gray-900">Save</span>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all duration-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <button
            type="button"
            onClick={toggleAllSaved}
            className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-gray-50 transition-all duration-200"
          >
            <span className="text-sm font-semibold text-gray-900">All Saved</span>
            {allSavedChecked && (
              <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
            )}
          </button>

          <p className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Collections</p>

          {loading ? (
            <div className="space-y-1 px-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            collections.map((coll) => {
              const isChecked = itemCollectionIds.includes(coll.id)
              return (
                <button
                  key={coll.id}
                  type="button"
                  onClick={() => toggleCollection(coll.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    {coll.emoji && <span>{coll.emoji}</span>}
                    {coll.name}
                  </span>
                  {isChecked && (
                    <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })
          )}

          {creatingNew ? (
            <div className="mx-3 mt-2 p-3 rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newEmoji}
                  onChange={(event) => setNewEmoji(event.target.value.slice(0, 2))}
                  placeholder="🎯"
                  className="w-11 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Collection name"
                  autoFocus
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCreatingNew(false)} className="flex-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold py-2">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCollection}
                  disabled={!newName.trim() || creating}
                  className="flex-1 rounded-lg bg-blue-600 text-white text-xs font-semibold py-2 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              New Collection
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )

  return createPortal(<AnimatePresence>{open && sheet}</AnimatePresence>, document.body)
}
