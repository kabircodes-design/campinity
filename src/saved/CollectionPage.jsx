import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, Trash2, Edit2, Copy, X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import {
  getCollection,
  getItemsInCollection,
  updateCollection,
  deleteCollection,
  toggleItemInCollection,
  copyItemToCollection,
  subscribeToCollections
} from './savedService.js'
import SavedItemCard from './SavedItemCard.jsx'
import { getCanonicalUrl } from '../sharing/shareTypes.js'

/**
 * Per-item actions use a three-dot menu (see chat explanation for why
 * long-press wasn't the right call here) — Open/Copy To/Remove/
 * Details, which together cover "Move" too (remove from here + copy
 * to elsewhere accomplishes a move without a separate code path).
 */
export default function CollectionPage() {
  const { collectionId } = useParams()
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [collection, setCollection] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [allCollections, setAllCollections] = useState([])

  const [menuItemId, setMenuItemId] = useState(null)
  const [copyPickerItemId, setCopyPickerItemId] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)

  useEffect(() => {
    if (!currentUid) return
    let cancelled = false
    Promise.all([getCollection(currentUid, collectionId), getItemsInCollection(currentUid, collectionId)]).then(
      ([coll, { items: fetchedItems }]) => {
        if (cancelled) return
        setCollection(coll)
        setRenameValue(coll?.name || '')
        setItems(fetchedItems)
        setLoading(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [currentUid, collectionId])

  useEffect(() => {
    if (!currentUid) return undefined
    return subscribeToCollections(currentUid, setAllCollections)
  }, [currentUid])

  const handleRemove = async (item) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setMenuItemId(null)
    try {
      // The item is known to be in this collection (it's rendered on
      // this page), so toggling removes it — moveItemToCollection
      // would need a real destination collectionId, not null.
      await toggleItemInCollection(currentUid, item.entityType, item.entityId, null, collectionId)
    } catch {
      setItems((prev) => [...prev, item])
    }
  }

  const handleCopyTo = async (item, targetCollectionId) => {
    setCopyPickerItemId(null)
    setMenuItemId(null)
    await copyItemToCollection(currentUid, item.entityType, item.entityId, targetCollectionId)
  }

  const handleRename = async () => {
    if (!renameValue.trim()) return
    await updateCollection(currentUid, collectionId, { name: renameValue.trim() })
    setCollection((prev) => ({ ...prev, name: renameValue.trim() }))
    setRenaming(false)
    setHeaderMenuOpen(false)
  }

  const handleDelete = async () => {
    await deleteCollection(currentUid, collectionId)
    navigate('/saved')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <p className="text-sm text-gray-400">This collection no longer exists.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-10">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate('/saved')} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 flex-1 truncate">
              {collection.emoji} {collection.name}
            </span>
            <div className="relative">
              <button type="button" onClick={() => setHeaderMenuOpen((v) => !v)} aria-label="Collection options" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300">
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {headerMenuOpen && (
                <div className="absolute right-0 top-11 w-40 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-30">
                  <button type="button" onClick={() => { setRenaming(true); setHeaderMenuOpen(false) }} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                    <Edit2 className="w-3.5 h-3.5" /> Rename
                  </button>
                  <button type="button" onClick={handleDelete} className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" /> Delete Collection
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {renaming && (
          <div className="mx-4 mt-3 flex items-center gap-2">
            <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            <button type="button" onClick={handleRename} className="rounded-lg bg-blue-600 text-white text-xs font-semibold px-3 py-2">Save</button>
            <button type="button" onClick={() => setRenaming(false)} className="rounded-lg border border-gray-200 text-xs font-semibold px-3 py-2">Cancel</button>
          </div>
        )}

        <main className="px-4 pt-4">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-16">No items in this collection yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {items.map((item) => (
                <div key={item.id} className="relative">
                  <SavedItemCard item={item} currentUid={currentUid} />
                  <button
                    type="button"
                    onClick={() => setMenuItemId(menuItemId === item.id ? null : item.id)}
                    aria-label="Item options"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {menuItemId === item.id && (
                    <div className="absolute top-8 right-1 w-32 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-30">
                      <button
                        type="button"
                        onClick={() => {
                          const path = getCanonicalUrl(item.entityType, item.entityId)
                          if (path) navigate(path)
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        Open
                      </button>
                      <button type="button" onClick={() => setCopyPickerItemId(item.id)} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                        <Copy className="w-3 h-3" /> Copy To
                      </button>
                      <button type="button" onClick={() => handleRemove(item)} className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">
                        Remove
                      </button>
                    </div>
                  )}

                  {copyPickerItemId === item.id && (
                    <div className="absolute top-8 right-1 w-40 rounded-xl border border-gray-100 bg-white shadow-lg py-1 z-30 max-h-40 overflow-y-auto">
                      <div className="flex items-center justify-between px-3 py-1">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase">Copy to</span>
                        <button type="button" onClick={() => setCopyPickerItemId(null)}><X className="w-3 h-3 text-gray-400" /></button>
                      </div>
                      {allCollections.filter((c) => c.id !== collectionId).map((c) => (
                        <button key={c.id} type="button" onClick={() => handleCopyTo(item, c.id)} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                          {c.emoji} {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
