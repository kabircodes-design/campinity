import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Search, Check, ArrowLeft, Camera, Users } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { searchUsersForShare } from '../firebase/profileService.js'
import { createGroupChat } from '../firebase/chatService.js'

const MIN_MEMBERS = 2 // + creator = 3 total, matching chatService.js's MIN_GROUP_MEMBERS

/**
 * Portal-based from the start (the SwipeablePage transform lesson,
 * applied consistently since it was found). Two-step flow exactly as
 * specified: select members -> name/photo -> create. No group avatar
 * upload wired to Storage here — groupAvatar accepts a URL field but
 * this pass doesn't add an upload flow, since no existing avatar-
 * upload utility was available to reuse without guessing at Storage
 * path conventions I haven't verified for this project.
 */
export default function CreateGroupFlow({ open, onClose }) {
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [step, setStep] = useState('members') // 'members' | 'details'
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState([])
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = (value) => {
    setSearchTerm(value)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    setSearching(true)
    searchUsersForShare(value, currentUid)
      .then(setSearchResults)
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false))
  }

  const toggleMember = (user) => {
    setSelectedMembers((prev) =>
      prev.some((m) => m.uid === user.uid) ? prev.filter((m) => m.uid !== user.uid) : [...prev, user]
    )
  }

  const handleCreate = async () => {
    if (!groupName.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const chatId = await createGroupChat(
        currentUid,
        selectedMembers.map((m) => m.uid),
        groupName
      )
      handleClose()
      navigate(`/messages/${chatId}`)
    } catch (err) {
      setError(err?.message || 'Could not create the group.')
      setCreating(false)
    }
  }

  const handleClose = () => {
    setStep('members')
    setSearchTerm('')
    setSearchResults([])
    setSelectedMembers([])
    setGroupName('')
    setError('')
    onClose()
  }

  if (!open) return null

  const sheet = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] bg-white flex flex-col"
    >
      <div className="h-14 flex items-center gap-2 px-3 border-b border-gray-100 flex-shrink-0">
        <button
          type="button"
          aria-label={step === 'details' ? 'Back' : 'Close'}
          onClick={() => (step === 'details' ? setStep('members') : handleClose())}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300"
        >
          {step === 'details' ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
        <span className="text-base font-bold text-gray-900 flex-1">
          {step === 'members' ? 'Select Members' : 'New Group'}
        </span>
        {step === 'members' && (
          <button
            type="button"
            onClick={() => setStep('details')}
            disabled={selectedMembers.length < MIN_MEMBERS}
            className="text-sm font-semibold text-blue-600 disabled:text-gray-300 transition-all duration-300"
          >
            Next{selectedMembers.length > 0 ? ` (${selectedMembers.length})` : ''}
          </button>
        )}
      </div>

      {step === 'members' ? (
        <>
          <div className="px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-2.5">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Search people..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
            </div>
            {selectedMembers.length > 0 && selectedMembers.length < MIN_MEMBERS && (
              <p className="mt-2 text-[11px] text-gray-400">
                Select at least {MIN_MEMBERS} people to create a group.
              </p>
            )}
          </div>

          {selectedMembers.length > 0 && (
            <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto scroll-hidden flex-shrink-0">
              {selectedMembers.map((m) => (
                <span
                  key={m.uid}
                  className="flex-shrink-0 flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 pl-1.5 pr-2.5 py-1 text-xs font-medium"
                >
                  <Avatar initials={getInitials(m.displayName)} colorClass={getAvatarColor(m.uid)} size="sm" src={m.avatar || undefined} />
                  {m.displayName}
                  <button type="button" onClick={() => toggleMember(m)} aria-label={`Remove ${m.displayName}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {searching ? (
              <div className="space-y-1 px-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                {searchTerm.trim() ? 'No one found.' : 'Search for people to add.'}
              </p>
            ) : (
              searchResults.map((user) => {
                const isSelected = selectedMembers.some((m) => m.uid === user.uid)
                return (
                  <button
                    key={user.uid}
                    type="button"
                    onClick={() => toggleMember(user)}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-all duration-200"
                  >
                    <div className="relative">
                      <Avatar initials={getInitials(user.displayName)} colorClass={getAvatarColor(user.uid)} size="md" src={user.avatar || undefined} />
                      {isSelected && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>
                      {user.username && <p className="text-[11px] text-gray-400 truncate">@{user.username}</p>}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white">
                <Camera className="w-3.5 h-3.5 text-gray-500" />
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-400">Group photo (optional, coming soon)</p>
          </div>

          <div className="mt-6">
            <label htmlFor="group-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Group name
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="e.g. Study Squad"
              autoFocus
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all duration-300"
            />
          </div>

          <p className="mt-4 text-xs text-gray-400">{selectedMembers.length + 1} members (including you)</p>

          {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

          <button
            type="button"
            onClick={handleCreate}
            disabled={!groupName.trim() || creating}
            className="mt-6 w-full rounded-full bg-blue-600 text-white text-sm font-semibold py-3 hover:bg-blue-700 disabled:opacity-40 transition-all duration-300"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      )}
    </motion.div>
  )

  return createPortal(<AnimatePresence>{open && sheet}</AnimatePresence>, document.body)
}
