import { useAuthorProfile } from '../hooks/useAuthorEnrichment.js'
import { resolveIdentity } from '../identity/identity.js'

/**
 * Sender name above the first bubble of a run of received messages in a
 * group chat — without it, group conversations didn't say who wrote
 * what. Uses the shared, deduplicated author cache (no per-message read).
 */
export default function GroupSenderLabel({ uid }) {
  const profile = useAuthorProfile(uid)
  // Loading/failed lookups render nothing (no misleading "Student");
  // deleted/suspended senders show "Student" (identity policy).
  const name = resolveIdentity(profile).name
  if (!name) return null
  return <p className="ml-1 -mb-1.5 text-[12px] font-semibold text-gray-500 truncate max-w-[70%]">{name}</p>
}
