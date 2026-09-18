import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera, Check, Crown, LogOut, Pencil, Search, ShieldMinus, ShieldPlus, UserMinus, UserPlus, Users, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile, searchUsersForShare } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import {
  getChat,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  promoteToGroupAdmin,
  demoteGroupAdmin,
  updateGroupInfo,
  uploadGroupAvatar
} from '../firebase/chatService.js'

/**
 * Client-side admin checks here are a UX convenience (hide buttons a
 * non-admin can't use) — the actual enforcement is in firestore.rules'
 * admin-gated update branch, so a non-admin can't bypass this by
 * calling the service functions directly; addGroupMembers/
 * removeGroupMember also re-check admin status themselves before
 * attempting the write, per "server-side, not just hidden UI buttons."
 */
export default function GroupInfoPage() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const currentUid = auth.currentUser?.uid

  const [chat, setChat] = useState(null)
  const [memberProfiles, setMemberProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [addingMembers, setAddingMembers] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [error, setError] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [promotingUid, setPromotingUid] = useState(null)
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)

  const loadChat = async () => {
    const data = await getChat(chatId, currentUid)
    setChat(data)
    if (data?.participants) {
      const profiles = await Promise.all(data.participants.map((uid) => getUserProfile(uid).then((p) => [uid, p])))
      setMemberProfiles(Object.fromEntries(profiles))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  const isAdmin = (chat?.admins || []).includes(currentUid)

  const handleSearch = (value) => {
    setSearchTerm(value)
    if (!value.trim()) {
      setSearchResults([])
      return
    }
    searchUsersForShare(value, currentUid).then((results) =>
      setSearchResults(results.filter((r) => !chat?.participants?.includes(r.uid)))
    )
  }

  const handleAddMember = async (user) => {
    setError('')
    try {
      await addGroupMembers(chatId, currentUid, [user.uid])
      setSearchTerm('')
      setSearchResults([])
      setAddingMembers(false)
      await loadChat()
    } catch (err) {
      setError(err?.message || 'Could not add member.')
    }
  }

  const handleRemoveMember = async (memberUid) => {
    setError('')
    try {
      await removeGroupMember(chatId, currentUid, memberUid)
      await loadChat()
    } catch (err) {
      setError(err?.message || 'Could not remove member.')
    }
  }

  const handleLeave = async () => {
    if (leaving) return
    setLeaving(true)
    try {
      await leaveGroup(chatId, currentUid)
      navigate('/messages')
    } catch (err) {
      setError(err?.message || 'Could not leave this group.')
      setLeaving(false)
    }
  }

  const handleDemote = async (memberUid) => {
    setError('')
    setPromotingUid(memberUid)
    try {
      await demoteGroupAdmin(chatId, currentUid, memberUid)
      await loadChat()
    } catch (err) {
      setError(err?.message || 'Could not demote this admin.')
    } finally {
      setPromotingUid(null)
    }
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !isAdmin) return
    setError('')
    setUploadingAvatar(true)
    try {
      const url = await uploadGroupAvatar(chatId, currentUid, file)
      await updateGroupInfo(chatId, currentUid, { groupAvatar: url })
      await loadChat()
    } catch (err) {
      setError(err?.message || 'Could not update the group photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const startEditingName = () => {
    setGroupNameDraft(chat.groupName || '')
    setEditingName(true)
  }

  const handleSaveName = async () => {
    const trimmed = groupNameDraft.trim()
    if (!trimmed || trimmed === chat.groupName) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    setError('')
    try {
      await updateGroupInfo(chatId, currentUid, { groupName: trimmed })
      setEditingName(false)
      await loadChat()
    } catch (err) {
      setError(err?.message || 'Could not rename this group.')
    } finally {
      setSavingName(false)
    }
  }

  const handlePromote = async (memberUid) => {
    setError('')
    setPromotingUid(memberUid)
    try {
      await promoteToGroupAdmin(chatId, currentUid, memberUid)
      await loadChat()
    } catch (err) {
      setError(err?.message || 'Could not promote this member.')
    } finally {
      setPromotingUid(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!chat || chat.type !== 'group') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <p className="text-sm text-gray-400">This group no longer exists.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-gray-50">
      <div className="mx-auto max-w-[480px] lg:max-w-[520px] bg-white min-h-screen lg:shadow-sm pb-10">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="h-14 flex items-center gap-2 px-3">
            <button type="button" aria-label="Back" onClick={() => navigate(`/messages/${chatId}`)} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-all duration-300">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-base font-bold tracking-tight text-gray-900">Group Info</span>
          </div>
        </header>

        <div className="flex flex-col items-center py-6">
          <div className="relative">
            {chat.groupAvatar ? (
              <img src={chat.groupAvatar} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
            )}
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  aria-label="Change group photo"
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center border-2 border-white disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="sr-only" />
              </>
            )}
          </div>
          {editingName ? (
            <div className="mt-3 flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={groupNameDraft}
                onChange={(event) => setGroupNameDraft(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleSaveName()}
                maxLength={60}
                disabled={savingName}
                className="rounded-lg border border-gray-200 px-2.5 py-1 text-center text-lg font-bold text-gray-900 outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName}
                aria-label="Save group name"
                className="w-7 h-7 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                aria-label="Cancel"
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-1.5">
              <p className="text-lg font-bold text-gray-900">{chat.groupName}</p>
              {isAdmin && (
                <button type="button" onClick={startEditingName} aria-label="Rename group" className="text-gray-300 hover:text-gray-500">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-gray-400">{chat.participants?.length || 0} members</p>
        </div>

        {error && <p className="mx-4 mb-3 text-xs text-red-500">{error}</p>}

        <div className="px-4 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Members</p>
          {isAdmin && (
            <button type="button" onClick={() => setAddingMembers((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-blue-600">
              <UserPlus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>

        {addingMembers && (
          <div className="mx-4 mt-2">
            <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3.5 py-2.5">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Search people to add..."
                className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 outline-none"
              />
              <button type="button" onClick={() => setAddingMembers(false)} aria-label="Close">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            {searchResults.map((user) => (
              <button
                key={user.uid}
                type="button"
                onClick={() => handleAddMember(user)}
                className="w-full flex items-center gap-3 px-2 py-2 mt-1 rounded-xl hover:bg-gray-50"
              >
                <Avatar initials={getInitials(user.displayName)} colorClass={getAvatarColor(user.uid)} size="sm" src={getProfileIdentityImage(user) || undefined} />
                <span className="text-sm font-medium text-gray-800">{user.displayName}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-2">
          {(chat.participants || []).map((memberUid) => {
            const profile = memberProfiles[memberUid]
            const memberIsAdmin = (chat.admins || []).includes(memberUid)
            const isSelf = memberUid === currentUid
            return (
              <div key={memberUid} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar
                  initials={getInitials(profile?.displayName || 'Student')}
                  colorClass={getAvatarColor(memberUid)}
                  size="sm"
                  src={getProfileIdentityImage(profile) || undefined}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {profile?.displayName || 'Student'} {isSelf && <span className="text-gray-400">(You)</span>}
                  </p>
                </div>
                {memberIsAdmin && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                    <Crown className="w-3 h-3" fill="currentColor" />
                    Admin
                  </span>
                )}
                {isAdmin && !isSelf && memberIsAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDemote(memberUid)}
                    disabled={promotingUid === memberUid}
                    aria-label="Remove admin"
                    title="Remove admin"
                    className="text-gray-300 hover:text-amber-600 disabled:opacity-50"
                  >
                    <ShieldMinus className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && !isSelf && !memberIsAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handlePromote(memberUid)}
                      disabled={promotingUid === memberUid}
                      aria-label="Make admin"
                      title="Make admin"
                      className="text-gray-300 hover:text-amber-500 disabled:opacity-50"
                    >
                      <ShieldPlus className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => handleRemoveMember(memberUid)} aria-label="Remove member" className="text-gray-300 hover:text-red-500">
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-2">
          <button
            type="button"
            onClick={() => setConfirmLeaveOpen(true)}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Leave Group
          </button>
        </div>
      </div>

      {confirmLeaveOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => !leaving && setConfirmLeaveOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-[340px] rounded-2xl bg-white p-5 [animation:modalIn_200ms_cubic-bezier(0.16,1,0.3,1)]">
            <p className="text-sm font-semibold text-gray-900">Leave this group?</p>
            <p className="mt-1.5 text-sm text-gray-400">
              You won't be able to send or receive messages in "{chat.groupName || 'this group'}" unless someone adds you
              back.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeaveOpen(false)}
                disabled={leaving}
                className="flex-1 rounded-full border border-gray-200 text-gray-600 text-sm font-semibold py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeave}
                disabled={leaving}
                className="flex-1 rounded-full bg-red-600 text-white text-sm font-semibold py-2 disabled:opacity-50"
              >
                {leaving ? 'Leaving…' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
