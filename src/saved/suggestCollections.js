/**
 * Feature 1/2 (Smart Collection Suggestions / Clustering) — pure,
 * deterministic, client-side keyword grouping over data ALREADY in
 * memory (SavedLibraryPage.jsx's own allItems, already fetched for
 * the "All Saved" tab). No additional Firestore reads, no AI/API
 * calls, matching the explicit "prefer deterministic client/server
 * logic using existing metadata... do not implement expensive AI/API
 * calls." The only signal available without an N+1 fetch per item is
 * preview.title (cached on every savedItems doc already) — so
 * clustering works on title text, same approach already used for
 * subject detection in NotesView.jsx.
 */
const TOPICS = [
  { key: 'physics', label: 'Physics', emoji: '⚡', keywords: ['physics', 'electrostatics', 'mechanics', 'thermodynamics', 'kinematics'] },
  { key: 'chemistry', label: 'Chemistry', emoji: '🧪', keywords: ['chemistry', 'chem', 'organic', 'inorganic'] },
  { key: 'placements', label: 'Placements', emoji: '💼', keywords: ['placement', 'internship', 'interview', 'resume', 'job'] },
  { key: 'events', label: 'Events', emoji: '🎉', keywords: ['event', 'fest', 'hackathon', 'workshop'] }
]

const MIN_ITEMS_FOR_SUGGESTION = 3

/**
 * Groups already-loaded saved items by topic keyword found in their
 * cached preview.title, then filters to groups with enough items to
 * be worth suggesting (Feature 4: "when enough related items
 * accumulate") that aren't already covered by an existing collection
 * name (never suggest a duplicate of something the user already
 * made).
 */
export function suggestCollections(items, existingCollections) {
  const existingNames = new Set(existingCollections.map((c) => c.name.trim().toLowerCase()))

  return TOPICS.map((topic) => {
    const matched = items.filter((item) => {
      const title = (item.preview?.title || '').toLowerCase()
      return topic.keywords.some((kw) => title.includes(kw))
    })
    return { ...topic, items: matched, count: matched.length }
  })
    .filter((group) => group.count >= MIN_ITEMS_FOR_SUGGESTION)
    .filter((group) => !existingNames.has(group.label.toLowerCase()))
}
