import { useMemo, useState } from 'react'
import { Zap } from 'lucide-react'
import { useMyVerification } from '../access/useMyVerification.js'
import { useOpenPostDocument } from '../hooks/useOpenPostDocument.js'
import VerificationGate from '../access/VerificationGate.jsx'
import { FEATURES } from '../access/permissions.js'
import { auth } from '../firebase/firebase.js'
import { getDisplayFileName } from '../utils/postFile.js'

const SUBJECT_META = {
  physics: { label: 'Physics', emoji: '⚡' },
  chemistry: { label: 'Chemistry', emoji: '🧪' }
}

/**
 * Compact Home preview — reuses the exact same real signals as
 * NotesView.jsx's own Last Minute section (user-marked 'important' OR
 * uploaded within 48h), computed here from data HomePage.jsx already
 * fetches for CampusPulse, zero new query. Deliberately capped at 2
 * items and rendered only when real data qualifies, per the explicit
 * 'do not overwhelm Home' instruction — Home stays a hub, not a second
 * Notes page.
 *
 * Visual upgrade this pass: signature amber/orange urgency treatment
 * (gradient strip, Zap icon), subject badge shown when known, and the
 * real reason each item qualifies ("Marked important" vs "New") shown
 * honestly instead of a fabricated exam-date/time the app has no real
 * data for.
 */
export default function LastMinutePreview({ notes, onViewAll }) {
  const verified = useMyVerification()
  const [gateOpen, setGateOpen] = useState(false)
  const { openDocument, opening: openingDocument, error: documentError, clearError: clearDocumentError } = useOpenPostDocument()
  const currentUid = auth.currentUser?.uid
  const items = useMemo(() => {
    const now = Date.now()
    const twoDaysMs = 48 * 60 * 60 * 1000
    return notes
      .filter((n) => n.collection === 'important' || (n.createdAtMs && now - n.createdAtMs < twoDaysMs))
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 2)
  }, [notes])

  if (items.length === 0) return null

  return (
    <div className="px-4 lg:px-0 mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          <Zap className="w-4 h-4 text-amber-500" fill="currentColor" /> Last Minute
        </p>
        <button type="button" onClick={onViewAll} className="text-xs font-semibold text-blue-600">
          View all →
        </button>
      </div>
      <div className="space-y-2">
        {items.map((note) => {
          const subject = SUBJECT_META[note.subject]
          const isImportant = note.collection === 'important'
          const isOwner = Boolean(note.userId) && note.userId === currentUid
          return (
            <button
              key={note.id}
              type="button"
              disabled={openingDocument}
              onClick={() => {
                // Same isOwner exemption as the other document-open sites —
                // the uploader could otherwise never open their own note.
                if (verified === false && !isOwner) {
                  setGateOpen(true)
                  return
                }
                clearDocumentError()
                openDocument(note)
              }}
              className="w-full flex items-center gap-3 rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50/60 to-white px-3.5 py-2.5 text-left hover:border-amber-200 disabled:opacity-60 transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-lg bg-white border border-amber-100 flex items-center justify-center flex-shrink-0 text-base">
                {subject?.emoji || '📄'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {subject && <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">{subject.label}</span>}
                  {isImportant && <span className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">Important</span>}
                </div>
                <p className="text-xs font-semibold text-gray-900 truncate">{note.file ? getDisplayFileName(note.file) : note.text || 'Note'}</p>
                <p className="text-[10px] text-gray-400">Uploaded {note.time}</p>
              </div>
              <span className="text-[10px] font-semibold text-blue-600 flex-shrink-0">{openingDocument ? 'Opening…' : 'Open →'}</span>
            </button>
          )
        })}
      </div>

      {documentError && <p role="alert" className="mt-2 text-[11px] text-red-500">{documentError}</p>}

      <VerificationGate open={gateOpen} onClose={() => setGateOpen(false)} feature={FEATURES.VIEW_CAMPUS_PDF} />
    </div>
  )
}
