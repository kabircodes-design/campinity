# Saved Library — Schema

## `savedItems/{uid}/items/{itemId}`
Doc id: `{entityType}_{entityId}` (e.g. `post_abc123`) — structurally
prevents saving the same item twice, same composite-id pattern as
`follows`, `savedPosts` before it.

Fields: `entityType`, `entityId`, `collectionIds: [collectionId]`
(which NAMED collections this item is in — empty array is valid and
means "saved, but not filed into any custom collection"), `preview`
(cache only, matching the Sharing System's own principle — the real
data is always live-fetched by `entityId` at render time), `savedAt`.

## `savedCollections/{uid}/collections/{collectionId}`
Fields: `name`, `emoji`, `coverImage`, `isPrivate`, `pinned`,
`itemCount` (denormalized, updated transactionally alongside
add/remove), `createdAt`, `updatedAt`.

**"All Saved" and "Recently Saved" are NOT documents here** — they're
queries over `savedItems` (all items; all items ordered by `savedAt`
desc), not real collections with membership to track. This is
simpler and structurally guarantees "cannot delete, cannot edit" for
both — there's nothing to delete or edit, they're derived views. Only
user-created collections get a real document.

## Why references, not duplicated data
`preview` exists purely as an instant-render cache, identical
principle to the Sharing System's `sharedPayload.preview` — the saved
library always re-fetches the real entity by `entityId` when rendering
a collection, so a renamed community or an edited post is never stale
in your saved library. Storing full post/profile data here would mean
every edit to a post needs to also update every saved-item copy of
it — this way there's only ever one source of truth.

## Multi-collection save
One `savedItems` doc's `collectionIds` array can contain multiple
collection ids simultaneously — saving to "Coding," "Placements," and
"Projects" at once is one document with `collectionIds: ['coding_id',
'placements_id', 'projects_id']`, not three separate saves. Move
replaces the array; Copy/duplicate adds to it.

## Extensibility
Adding a new saveable entity type later needs zero schema changes —
`entityType` is just a string field. The renderer registry (in
`SavedItemCard.jsx`) is the only place a new type needs an entry,
same "one registry, not new components" principle as `SharedCard.jsx`.
