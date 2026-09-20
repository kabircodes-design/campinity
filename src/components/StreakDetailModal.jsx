import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Flame, X } from 'lucide-react'
import { getRecentActivityDates } from '../gamification/xpService.js'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Real trailing-7-day calendar — derived from actual xpLog entry dates
 * (the same activity that advances the streak in awardXP), not a
 * fabricated tracker. Portal-based, matching the established fix for
 * modals getting trapped behind BottomNav inside SwipeablePage.
 */
export default function StreakDetailModal({ open, onClose, uid, streak, longestStreak }) {
  const [activeDates, setActiveDates] = useState(null)

  useEffect(() => {
    if (!open || !uid) return
    let cancelled = false
    getRecentActivityDates(uid, 7)
      .then((dates) => {
        if (!cancelled) setActiveDates(dates)
      })
      .catch(() => {
        if (!cancelled) setActiveDates(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [open, uid])

  if (!open) return null

  const today = new Date()
  const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return { label: DAY_LABELS[d.getDay()], active: activeDates?.has(toKey(d)) || false, isToday: i === 6 }
  })

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastActiveLabel = activeDates?.has(toKey(today))
    ? 'Today'
    : activeDates?.has(toKey(yesterday))
      ? 'Yesterday'
      : activeDates?.size > 0
        ? 'This week'
        : '—'

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 [animation:fadeIn_200ms_ease-out]" />
      <div className="relative w-full sm:max-w-[380px] rounded-t-2xl sm:rounded-2xl bg-white p-5 pb-8 sm:pb-5 shadow-xl [animation:modalIn_250ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-gray-900">Your Streak</p>
          <button type="button" aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
            <Flame className="w-6 h-6 text-orange-500" fill="currentColor" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{streak} {streak === 1 ? 'day' : 'days'}</p>
            <p className="text-xs text-gray-400">Current streak</p>
          </div>
        </div>

        <div className="mt-5">
          {activeDates === null ? (
            <div className="h-14 animate-pulse bg-gray-100 rounded-xl" />
          ) : (
            <div className="flex items-center justify-between gap-1.5">
              {days.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-gray-400">{day.label}</span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      day.active
                        ? 'bg-orange-500 text-white'
                        : day.isToday
                          ? 'border-2 border-dashed border-orange-300 text-orange-300'
                          : 'bg-gray-100 text-gray-300'
                    }`}
                  >
                    {day.active && <Flame className="w-3.5 h-3.5" fill="currentColor" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <div className="flex-1 rounded-xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-base font-bold text-gray-900">{longestStreak}</p>
            <p className="text-[10px] text-gray-400">Longest streak</p>
          </div>
          <div className="flex-1 rounded-xl border border-gray-100 px-3 py-2.5 text-center">
            <p className="text-base font-bold text-gray-900">{activeDates === null ? '…' : lastActiveLabel}</p>
            <p className="text-[10px] text-gray-400">Last active</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-gray-400 leading-relaxed text-center">
          Stay active on Campinity each day — posting, commenting, liking, or joining a community all count — to keep
          your streak alive.
        </p>
      </div>
    </div>,
    document.body
  )
}
