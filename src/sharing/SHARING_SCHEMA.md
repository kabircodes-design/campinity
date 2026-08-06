# Sharing System — Schema & Architecture (Phase 1)

## Message schema extension

Existing message doc (unchanged fields): `senderId`, `text`, `read`,
`edited`, `editedAt`, `deletedFor`, `createdAt`.

New, additive, all optional:
```
type: 'text' | 'image' | 'shared_post' | 'shared_profile' |
      'shared_story' | 'shared_event' | 'shared_community' |
      'shared_club' | 'shared_radar_profile' | 'forwarded_message'
imageUrl: string | null          // only for type: 'image'
sharedPayload: {
  referenceId: string,           // the original document's real id
  referenceType: string,         // 'post' | 'profile' | 'event' | ...
  preview: {                     // fast-render cache ONLY
    title, subtitle, username, image, metadata
  },
  originalSenderId: string | null,  // only for forwarded_message
  originalMessageId: string | null  // only for forwarded_message
}
```

**Backward compatibility, verified against the real rule, not
assumed:** the existing `create` rule checks `senderId` and pending-
chat status — it has no `hasOnly()` restricting which fields a new
message may contain, so these new fields need zero rules change to
start appearing. Every existing message in Firestore has no `type`
field at all; every read path treats `message.type || 'text'` as the
type, so old messages render exactly as they always have, through the
exact same code path, not a special-cased "legacy" branch.

**Why `preview` is a cache, not the source of truth:** per the
brief's own "if the original changes, the preview updates
automatically" — this is only true if the renderer re-fetches the
real document by `referenceId` at render time and uses `preview` only
as an instant-paint placeholder while that fetch is in flight. A
stored preview that had to be kept in sync would need a write
back into every message referencing a post whenever that post
changes — expensive and fragile. Fetch-on-render is simpler AND is
what makes "automatically" actually true rather than eventually-true.

## `<SharedCard />` — one component, registry-driven

A single component keyed by `message.type`, backed by a plain object
mapping type → `{ fetch(referenceId), render(data) }`. Adding a new
shareable type later means adding one entry to this registry — no
new component, no changes to `MessageBubble.jsx`, matching "future
message types should require almost zero code."

Phase 1 implements the registry architecture plus a complete, real
`shared_post` entry (since Phase 2 is post sharing specifically, this
gives it a working target to build the send-side UI against). Every
other type gets a registry entry that fetches nothing and renders a
"coming in a later phase" state — not a crash, not a fake card, an
honest placeholder that's visually consistent with the loading/error
states real entries will eventually show.

## Notifications — reused, not duplicated

One new function, `createShareNotification`, added to the existing
`notificationService.js`, following the exact same shape every other
notification creator in that file already uses (own `type` value, own
field set, same `createNotification` internal call). Not a new
notification system — an extension of the one that already exists,
per the brief's own explicit instruction.

## Canonical URLs — designed now, wired up in Phase 5

`/post/:id`, `/profile/:username`, `/community/:id`, `/club/:id`,
`/event/:id`, `/story/:id` — a single `getCanonicalUrl(type, id)`
helper is included in Phase 1 so `SharedCard`'s "View Post"/"Open
Club"/etc. actions have one real function to call rather than each
type inventing its own path logic. Copy Link and the native Web Share
API integration (Phase 5) will call this same helper — not duplicated
there either.

## Share analytics — schema designed, NOT incremented yet

`shareAnalytics/{entityType}_{entityId}` — one doc per shared entity,
fields `internalChatShares`, `externalShares`, `totalShares`,
`updatedAt`. Doc id is a composite of type+id (e.g.
`post_abc123`), same structural pattern as this project's other
composite-id collections (`follows`, `communityHandles`). Designed now
because "architecture should support this" was explicit; the actual
increment calls are Phase 7 per the user's own phasing — building them
now would mean incrementing counters no send-flow exists yet to call
from.

## What Phase 1 deliberately does NOT include

The Share Bottom Sheet UI, the actual "Share to Chat" send flow, the
Share button on posts, forwarding UI, external share, and copy-link UI
are Phases 2 through 6 respectively. Building UI ahead of its
architecture usually means rebuilding the UI once the architecture
turns out to need one more field — this order avoids that.
