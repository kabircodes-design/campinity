import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Search, Sparkles } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { subscribeToCollections, getRecentlySavedItems, getAllSavedItems, createCollection, toggleItemInCollection } from './savedService.js'
import { suggestCollections } from './suggestCollections.js'
import SavedItemCard from './SavedItemCard.jsx'

/**
 * "Not a list — a Library." Top: search + new collection. Below: All
 * Saved / Recently Saved (both derived queries, not real collections
 * — see SAVED_SCHEMA.md) / Collections grid. Search filters by
 * collection name client-side (collection counts are always small
 * enough that this is cheap — a dedicated search index would be
 * disproportionate for what's typically a handful to a few dozen
 * collections).
 */
export default function SavedLibraryPage() {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [tab, setTab] = useState('all') // 'all' | 'recent' | 'collections'
  const [searchTerm, setSearchTerm] = useState('')

  const [allItems, setAllItems] = useState([])
  const [allLoading, setAllLoading] = useState(true)
  const [recentItems, setRecentItems] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [collections, setCollections] = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)

  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [creating, setCreating] = useState(false)
  const [dismissedSuggestions, setDismissedSuggestions] = useState([])
  const [acceptingSuggestion, setAcceptingSuggestion] = useState(null)

  useEffect(() => {
    if (!currentUid) return
    getAllSavedItems(currentUid).then(({ items }) => {
      setAllItems(items)
      setAllLoading(false)
    })
    getRecentlySavedItems(currentUid).then((items) => {
      setRecentItems(items)
      setRecentLoading(false)
    })
  }, [currentUid])

  useEffect(() => {
    if (!currentUid) return undefined
    const unsubscribe = subscribeToCollections(currentUid, (data) => {
      setCollections(data)
      setCollectionsLoading(false)
    })
    return unsubscribe
  }, [currentUid])

  const handleCreate = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      await createCollection(currentUid, { name: newName, emoji: newEmoji })
      setCreatingNew(false)
      setNewName('')
      setNewEmoji('')
    } finally {
      setCreating(false)
    }
  }

  const filteredCollections = searchTerm.trim()
    ? collections.filter((c) => c.name.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    : collections

  const suggestions = suggestCollections(allItems, collections).filter((s) => !dismissedSuggestions.includes(s.key))

  const handleAcceptSuggestion = async (suggestion) => {
    if (acceptingSuggestion) return
    setAcceptingSuggestion(suggestion.key)
    try {
      const collectionId = await createCollection(currentUid, { name: suggestion.label, emoji: suggestion.emoji })
      await Promise.all(
        suggestion.items.map((item) => toggleItemInCollection(currentUid, item.entityType, item.entityId, item.preview, collectionId))
      )
      setDismissedSuggestions((prev) => [...prev, suggestion.key])
    } catch (err) {
      console.error('Could not create suggested collection:', err)
    } finally {
      setAcceptingSuggestion(null)
    }
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-10">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900 flex-1">Saved</span>
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="flex-shrink-0 flex items-center gap-1 rounded-full bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-blue-700 transition-all duration-300"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-2.5">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search your saved library..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
            </div>
          </div>
          <nav className="flex items-center px-4 gap-5 border-t border-gray-50">
            {[
              { key: 'all', label: 'All Saved' },
              { key: 'recent', label: 'Recently Saved' },
              { key: 'collections', label: 'Collections' }
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`py-2.5 text-[13px] font-semibold border-b-2 transition-all duration-300 ${
                  tab === t.key ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        {creatingNew && (
          <div className="mx-4 mt-3 p-3 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center gap-2">
              <input type="text" value={newEmoji} onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))} placeholder="🎯" className="w-11 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none focus:border-blue-500" />
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Collection name" autoFocus className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCreatingNew(false)} className="flex-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold py-2">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={!newName.trim() || creating} className="flex-1 rounded-lg bg-blue-600 text-white text-xs font-semibold py-2 disabled:opacity-50">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {tab === 'all' && suggestions.length > 0 && (
          <div className="px-4 pt-4 space-y-2.5">
            <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
              <Sparkles className="w-4 h-4 text-indigo-500" /> Suggested for you
            </p>
            {suggestions.map((s) => (
              <div key={s.key} className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {s.emoji} {s.label}
                    </p>
                    <p className="text-xs text-gray-400">{s.count} items found</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAcceptSuggestion(s)}
                    disabled={acceptingSuggestion === s.key}
                    className="rounded-full bg-indigo-600 text-white text-xs font-semibold px-3.5 py-1.5 hover:bg-indigo-700 disabled:opacity-60 transition-all duration-200"
                  >
                    {acceptingSuggestion === s.key ? 'Creating...' : 'Create collection'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissedSuggestions((prev) => [...prev, s.key])}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Not now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <main className="px-4 pt-4">
          {tab === 'all' &&
            (allLoading ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : allItems.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {allItems.map((item) => <SavedItemCard key={item.id} item={item} currentUid={currentUid} />)}
              </div>
            ))}

          {tab === 'recent' &&
            (recentLoading ? (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : recentItems.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {recentItems.map((item) => <SavedItemCard key={item.id} item={item} currentUid={currentUid} />)}
              </div>
            ))}

          {tab === 'collections' &&
            (collectionsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />)}
              </div>
            ) : filteredCollections.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-12">No collections yet — tap New to create one.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredCollections.map((coll) => (
                  <button
                    key={coll.id}
                    type="button"
                    onClick={() => navigate(`/saved/collection/${coll.id}`)}
                    className="rounded-2xl border border-gray-100 overflow-hidden text-left hover:border-gray-200 transition-all duration-200"
                  >
                    <div className="h-20 bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-2xl">
                      {coll.coverImage ? <img src={coll.coverImage} alt="" className="w-full h-full object-cover" /> : coll.emoji || '📁'}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-gray-900 truncate">{coll.name}</p>
                      <p className="text-[10px] text-gray-400">{coll.itemCount || 0} items</p>
                    </div>
                  </button>
                ))}
              </div>
            ))}
        </main>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <p className="text-2xl">📚</p>
      <p className="mt-2 text-sm font-semibold text-gray-900">Nothing Saved Yet</p>
      <p className="mt-1 text-xs text-gray-400 max-w-[240px] mx-auto leading-relaxed">
        Save your favourite posts, events and communities.
      </p>
    </div>
  )
}
