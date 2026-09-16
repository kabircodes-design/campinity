import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { auth } from '../firebase/firebase.js'
import { getMyPollVote, getPollResults, unvotePoll, votePoll } from '../firebase/pollService.js'

/**
 * Shared by PostCard.jsx and PostDetailPage.jsx — one render+vote
 * implementation, not duplicated per surface. Options are shown before
 * voting; results (real counts from getPollResults, never a
 * client-tallied guess) after.
 *
 * Vote / change vote / unvote are all the SAME interaction: tap any
 * option. Tapping the option you already picked removes your vote;
 * tapping a different one moves it there — no separate "unvote" mode
 * to learn. A small "Remove vote" link is also shown for discoverability,
 * doing the exact same thing as re-tapping the selected option.
 *
 * Counts are optimistic (the tapped option's bar moves immediately,
 * with the previous selection's count given back if this was a change,
 * not just an addition) and rolled back to the last known-good state on
 * a failed write — but the counts you see immediately after a mutation
 * SUCCEEDS are always replaced by a fresh getPollResults() server read,
 * never left as a permanent client guess. Firestore remains the source
 * of truth; this is responsiveness layered on top of it, not a second
 * one.
 */
export default function PostPoll({ postId, poll }) {
  const currentUid = auth.currentUser?.uid
  const [myVote, setMyVote] = useState(undefined) // undefined = loading, null = hasn't voted, else optionId
  const [results, setResults] = useState(null)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState('')

  const optionIds = (poll?.options || []).map((o) => o.id)

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

  // Fetches once we know whether/how the viewer voted (not on every
  // mutation — mutation handlers below refetch themselves once their
  // own write actually lands, which is more precise than re-running off
  // a dependency array here).
  useEffect(() => {
    if (myVote === undefined || !myVote) return undefined
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
  }, [postId, myVote !== undefined && Boolean(myVote)])

  const refreshResults = () => {
    getPollResults(postId, optionIds)
      .then(setResults)
      .catch(() => {})
  }

  const adjustLocal = (prevOptionId, nextOptionId) => {
    setResults((prev) => {
      const base = prev || {}
      const next = { ...base }
      if (prevOptionId) next[prevOptionId] = Math.max(0, (next[prevOptionId] || 0) - 1)
      if (nextOptionId) next[nextOptionId] = (next[nextOptionId] || 0) + 1
      return next
    })
  }

  const handleSelect = async (optionId) => {
    if (!currentUid || mutating) return
    const previousVote = myVote
    const removing = previousVote === optionId

    setMutating(true)
    setError('')
    adjustLocal(previousVote, removing ? null : optionId)
    setMyVote(removing ? null : optionId)

    try {
      if (removing) {
        await unvotePoll(postId, currentUid)
      } else {
        await votePoll(postId, currentUid, optionId)
      }
      refreshResults() // reconcile with the real server count, not just the local guess
    } catch (err) {
      // Roll back both the selection AND the optimistic count adjustment.
      adjustLocal(removing ? null : optionId, previousVote)
      setMyVote(previousVote)
      setError(err?.message || 'Could not update your vote.')
    } finally {
      setMutating(false)
    }
  }

  if (!poll || !Array.isArray(poll.options) || poll.options.length === 0) return null

  const totalVotes = results ? Object.values(results).reduce((sum, n) => sum + n, 0) : 0
  const hasVoted = Boolean(myVote)

  return (
    <div className="mx-4 lg:mx-6 mt-3 rounded-xl border border-gray-100 dark:border-white/10 p-3.5">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{poll.question}</p>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      <div className="mt-2.5 space-y-1.5">
        {poll.options.map((option) => {
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
                  handleSelect(option.id)
                }}
                disabled={myVote === undefined || mutating}
                className="w-full text-left rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 disabled:opacity-60 transition-all duration-200"
              >
                {option.text}
              </button>
            )
          }

          return (
            <button
              key={option.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                handleSelect(option.id)
              }}
              disabled={mutating}
              className={`relative w-full overflow-hidden rounded-lg border text-left disabled:opacity-70 transition-colors duration-200 ${
                isMine ? 'border-blue-200 dark:border-blue-500/30' : 'border-gray-100 dark:border-white/10 hover:border-gray-200 dark:hover:border-white/20'
              }`}
            >
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
            </button>
          )
        })}
      </div>
      {hasVoted && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              handleSelect(myVote)
            }}
            disabled={mutating}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors duration-200"
          >
            <X className="w-3 h-3" /> Remove vote
          </button>
        </div>
      )}
    </div>
  )
}
