import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getMyPollVote, getPollResults, votePoll } from '../firebase/pollService.js'

/**
 * Shared by PostCard.jsx and PostDetailPage.jsx — one render+vote
 * implementation, not duplicated per surface. Options are shown before
 * voting; results (real counts from getPollResults, never a
 * client-tallied guess) after. Vote is optimistic (bar fills
 * immediately) with a rollback if the write actually fails — the
 * underlying write itself is already the real enforcement point
 * (firestore.rules' pollVotes/{uid}: create-only), this is just UI
 * responsiveness on top of that, not a second source of truth.
 */
export default function PostPoll({ postId, poll }) {
  const currentUid = auth.currentUser?.uid
  const [myVote, setMyVote] = useState(undefined) // undefined = loading, null = hasn't voted, else optionId
  const [results, setResults] = useState(null)
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!postId || !currentUid) {
      setMyVote(null)
      return
    }
    let cancelled = false
    getMyPollVote(postId, currentUid)
      .then((optionId) => {
        if (!cancelled) setMyVote(optionId)
      })
      .catch(() => {
        if (!cancelled) setMyVote(null)
      })
    return () => {
      cancelled = true
    }
  }, [postId, currentUid])

  const optionIds = (poll?.options || []).map((o) => o.id)

  useEffect(() => {
    if (!myVote) return undefined
    let cancelled = false
    getPollResults(postId, optionIds)
      .then((data) => {
        if (!cancelled) setResults(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, myVote])

  const handleVote = async (optionId) => {
    if (!currentUid || voting || myVote) return
    setVoting(true)
    setError('')
    setMyVote(optionId) // optimistic — reveals results immediately
    try {
      await votePoll(postId, currentUid, optionId)
    } catch (err) {
      setMyVote(null) // rollback — vote genuinely didn't land
      setError(err?.message || 'Could not submit your vote.')
    } finally {
      setVoting(false)
    }
  }

  if (!poll) return null

  const totalVotes = results ? Object.values(results).reduce((sum, n) => sum + n, 0) : 0
  const hasVoted = Boolean(myVote)

  return (
    <div className="mx-4 lg:mx-6 mt-3 rounded-xl border border-gray-100 dark:border-white/10 p-3.5">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{poll.question}</p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <div className="mt-2.5 space-y-1.5">
        {(poll.options || []).map((option) => {
          const count = results?.[option.id] || 0
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          const isMine = myVote === option.id

          if (!hasVoted) {
            return (
              <button
                key={option.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleVote(option.id)
                }}
                disabled={myVote === undefined || voting}
                className="w-full text-left rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 disabled:opacity-60 transition-all duration-200"
              >
                {option.text}
              </button>
            )
          }

          return (
            <div key={option.id} className="relative overflow-hidden rounded-lg border border-gray-100 dark:border-white/10">
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${
                  isMine ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-gray-100 dark:bg-white/5'
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200 truncate">
                  {isMine && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                  {option.text}
                </span>
                <span className="flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>
      {hasVoted && (
        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </p>
      )}
    </div>
  )
}
