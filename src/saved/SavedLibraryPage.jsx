import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Bookmark, FolderPlus, Search, SearchX, Sparkles } from 'lucide-react'
import { Card, EmptyState, primaryPill, secondaryPill } from '../components/ui/Premium.jsx'
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
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'posts' | 'notes'
  const [searchTerm, setSearchTerm] = useState('')

  const [allItems, setAllItems] = useState([])
  const [allLoading, setAllLoading] = useState(true)
  const [allError, setAllError] = useState('')
  const [recentItems, setRecentItems] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState('')
  const [collections, setCollections] = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [collectionsError, setCollectionsError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [creating, setCreating] = useState(false)
  const [dismissedSuggestions, setDismissedSuggestions] = useState([])
  const [acceptingSuggestion, setAcceptingSuggestion] = useState(null)

  useEffect(() => {
    if (!currentUid) return
    setAllLoading(true)
    setAllError('')
    getAllSavedItems(currentUid)
      .then(({ items }) => setAllItems(items))
      .catch((err) => {
        console.error('Could not load saved items:', err)
        setAllError("Couldn't load your saved items.")
      })
      .finally(() => setAllLoading(false))

    setRecentLoading(true)
    setRecentError('')
    getRecentlySavedItems(currentUid)
      .then(setRecentItems)
      .catch((err) => {
        console.error('Could not load recently saved items:', err)
        setRecentError("Couldn't load recently saved items.")
      })
      .finally(() => setRecentLoading(false))
  }, [currentUid, reloadKey])

  useEffect(() => {
    if (!currentUid) return undefined
    setCollectionsLoading(true)
    setCollectionsError('')
    const unsubscribe = subscribeToCollections(
      currentUid,
      (data) => {
        setCollections(data)
        setCollectionsLoading(false)
      },
      () => {
        setCollectionsError("Couldn't load your collections.")
        setCollectionsLoading(false)
      }
    )
    return unsubscribe
  }, [currentUid, reloadKey])

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

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'recent', label: 'Recent' },
    { key: 'collections', label: 'Collections' }
  ]
  const retry = <button type="button" onClick={() => setReloadKey((k) => k + 1)} className={secondaryPill}>Try again</button>
  const gridSkeleton = (
    <div className="grid grid-cols-3 gap-2" role="status" aria-label="Loading saved items">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />)}
    </div>
  )
  const nothingSaved = (
    <EmptyState
      icon={Bookmark}
      title="Nothing saved yet"
      body="Tap the bookmark on any post, note or event to keep it here."
      action={<button type="button" onClick={() => navigate('/home')} className={primaryPill}>Explore your feed</button>}
    />
  )

  return (
    <div className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-gray-50 dark:bg-[#09090f]">
      <div className="mx-auto max-w-[480px] lg:max-w-[560px] min-h-[100dvh] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        <header className="sticky top-0 z-40 bg-gray-50/90 dark:bg-[#09090f]/90 backdrop-blur-md">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/10 active:scale-95 transition-all duration-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[17px] font-bold tracking-tight text-gray-900 dark:text-gray-50 flex-1">Saved</h1>
            <button type="button" onClick={() => { setTab('collections'); setCreatingNew(true) }} className="flex-shrink-0 h-9 inline-flex items-center gap-1.5 rounded-full bg-blue-600 text-white text-[13px] font-semibold px-3.5 shadow-sm shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all duration-200">
              <FolderPlus className="w-4 h-4" />
              New collection
            </button>
          </div>
          <div className="px-4 pb-3 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search your saved library"
                aria-label="Search your saved library"
                className="w-full h-11 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-10 pr-4 text-[15px] text-gray-900 dark:text-gray-50 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
              />
            </div>
            <div className="flex rounded-full bg-gray-200/60 dark:bg-white/[0.06] p-1" role="tablist" aria-label="Saved sections">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 h-9 rounded-full text-[13px] font-semibold transition-all duration-200 ${tab === t.key ? 'bg-white dark:bg-white/15 text-gray-900 dark:text-gray-50 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="px-4 space-y-4">
          {creatingNew && (
            <Card className="p-4 animate-[fadeIn_180ms_ease]">
              <p className="text-[14px] font-bold text-gray-900 dark:text-gray-50">New collection</p>
              <div className="mt-3 flex items-end gap-2">
                <div>
                  <label htmlFor="new-collection-emoji" className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Icon</label>
                  <input id="new-collection-emoji" type="text" value={newEmoji} onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))} placeholder="🎯" className="w-12 h-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-center text-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                </div>
                <div className="flex-1">
                  <label htmlFor="new-collection-name" className="block text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Name</label>
                  <input id="new-collection-name" type="text" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newName.trim() && handleCreate()} placeholder="e.g. Exam prep" autoFocus className="w-full h-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3.5 text-[15px] text-gray-900 dark:text-gray-50 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => setCreatingNew(false)} className={`${secondaryPill} flex-1`}>Cancel</button>
                <button type="button" onClick={handleCreate} disabled={!newName.trim() || creating} className={`${primaryPill} flex-1`}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </Card>
          )}

          {tab === 'all' && suggestions.length > 0 && (
            <section aria-label="Suggested collections" className="space-y-2.5">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-gray-900 dark:text-gray-50">
                <Sparkles className="w-4 h-4 text-indigo-500" aria-hidden="true" /> Suggested for you
              </p>
              {suggestions.map((s) => (
                <Card key={s.key} className="p-4 bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-500/10 dark:to-[#11131a] border-indigo-100 dark:border-indigo-500/20">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-50">{s.emoji} {s.label}</p>
                  <p className="text-[12.5px] text-gray-500 dark:text-gray-400">{s.count} saved items match</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => handleAcceptSuggestion(s)} disabled={acceptingSuggestion === s.key} className="h-9 rounded-full bg-indigo-600 text-white text-[13px] font-semibold px-4 hover:bg-indigo-700 active:scale-95 disabled:opacity-60 transition-all duration-200">
                      {acceptingSuggestion === s.key ? 'Creating…' : 'Create collection'}
                    </button>
                    <button type="button" onClick={() => setDismissedSuggestions((prev) => [...prev, s.key])} className="h-9 px-3 rounded-full text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
                      Not now
                    </button>
                  </div>
                </Card>
              ))}
            </section>
          )}

          <main>
            {tab === 'all' && (
              <div className="flex items-center gap-2 mb-3" role="group" aria-label="Filter saved items">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'notes', label: 'Notes & PDFs' },
                  { key: 'posts', label: 'Posts' }
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={typeFilter === f.key}
                    onClick={() => setTypeFilter(f.key)}
                    className={`h-9 rounded-full text-[13px] font-semibold px-4 active:scale-95 transition-all duration-200 ${typeFilter === f.key ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-gray-300'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {tab === 'all' &&
              (allLoading ? (
                gridSkeleton
              ) : allError ? (
                <EmptyState icon={AlertCircle} title="Couldn't load your library" body={allError} action={retry} />
              ) : allItems.length === 0 ? (
                nothingSaved
              ) : (
                (() => {
                  const filtered =
                    typeFilter === 'all'
                      ? allItems
                      : allItems.filter((item) => {
                          const title = (item.preview?.title || '').toLowerCase()
                          const looksLikeNote = title.endsWith('.pdf') || /chapter|pyq|notes|important questions/.test(title)
                          return typeFilter === 'notes' ? looksLikeNote : !looksLikeNote
                        })
                  return filtered.length === 0 ? (
                    <EmptyState icon={SearchX} title="Nothing in this filter" body="Try a different filter." action={<button type="button" onClick={() => setTypeFilter('all')} className={secondaryPill}>Show all</button>} />
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {filtered.map((item) => <SavedItemCard key={item.id} item={item} currentUid={currentUid} />)}
                    </div>
                  )
                })()
              ))}

            {tab === 'recent' &&
              (recentLoading ? (
                gridSkeleton
              ) : recentError ? (
                <EmptyState icon={AlertCircle} title="Couldn't load recent saves" body={recentError} action={retry} />
              ) : recentItems.length === 0 ? (
                nothingSaved
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {recentItems.map((item) => <SavedItemCard key={item.id} item={item} currentUid={currentUid} />)}
                </div>
              ))}

            {tab === 'collections' &&
              (collectionsLoading ? (
                <div className="grid grid-cols-2 gap-3" role="status" aria-label="Loading collections">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 rounded-3xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />)}
                </div>
              ) : collectionsError ? (
                <EmptyState icon={AlertCircle} title="Couldn't load collections" body={collectionsError} action={retry} />
              ) : filteredCollections.length === 0 ? (
                creatingNew ? null : (
                  <EmptyState
                    icon={FolderPlus}
                    title={searchTerm ? 'No collections match' : 'No collections yet'}
                    body={searchTerm ? 'Try a different search.' : 'Group saved posts and notes — e.g. one per subject.'}
                    action={!searchTerm && <button type="button" onClick={() => setCreatingNew(true)} className={primaryPill}>New collection</button>}
                  />
                )
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredCollections.map((coll) => (
                    <button
                      key={coll.id}
                      type="button"
                      onClick={() => navigate(`/saved/collection/${coll.id}`)}
                      className="rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] overflow-hidden text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all duration-200"
                    >
                      <div className="h-24 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-500/10 dark:to-indigo-500/20 flex items-center justify-center text-3xl">
                        {coll.coverImage ? <img src={coll.coverImage} alt="" className="w-full h-full object-cover" /> : coll.emoji || '📁'}
                      </div>
                      <div className="p-3">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-50 truncate">{coll.name}</p>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400">{coll.itemCount || 0} {coll.itemCount === 1 ? 'item' : 'items'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
          </main>
        </div>
      </div>
    </div>
  )
}
