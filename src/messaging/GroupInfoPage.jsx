import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Crown, LogOut, Search, UserMinus, UserPlus, Users, X } from 'lucide-react'
import Avatar from '../components/Avatar.jsx'
import { auth } from '../firebase/firebase.js'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getUserProfile, searchUsersForShare } from '../firebase/profileService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { getChat, addGroupMembers, removeGroupMember, leaveGroup } from '../firebase/chatService.js'

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
    await leaveGroup(chatId, currentUid)
    navigate('/messages')
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
          {chat.groupAvatar ? (
            <img src={chat.groupAvatar} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
              <Users className="w-8 h-8 text-white" />
            </div>
          )}
          <p className="mt-3 text-lg font-bold text-gray-900">{chat.groupName}</p>
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
                {isAdmin && !isSelf && !memberIsAdmin && (
                  <button type="button" onClick={() => handleRemoveMember(memberUid)} aria-label="Remove member" className="text-gray-300 hover:text-red-500">
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-2">
          <button type="button" onClick={handleLeave} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50">
            <LogOut className="w-4 h-4" />
            Leave Group
          </button>
        </div>
      </div>
    </div>
  )
}
