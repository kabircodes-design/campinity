# Gamification Firestore Schema — Design Rationale

## Collections

### `userProgress/{uid}` (one doc per user)
Fields: `xp`, `level`, `campusPoints`, `currentStreak`, `longestStreak`,
`lastActivityDate` (a date string, not a timestamp — see below),
`reputationScore`, `profileCompletionPct`, `updatedAt`.

**Why its own collection, not fields on `users/{uid}`:** the brief
explicitly says "do not randomly store everything inside users
document." Concretely: `users/{uid}` is read constantly (every post
render, every profile view, every mention) by every part of the app
that already exists. XP/streak fields change on nearly every user
action (every like, every comment). Putting fast-changing gamification
counters on the same document as slow-changing profile data means
every XP-earning action would trigger a write to a document dozens of
unrelated reads are watching, and any `onSnapshot` listener on a user
profile (if one exists anywhere) would re-fire on every XP gain for no
reason. Separate document = separate write/read traffic, zero
interference with existing profile reads.

`lastActivityDate` as a `'YYYY-MM-DD'` string, not a Timestamp:
streak logic needs "is this a new calendar day," which a Timestamp
requires timezone-aware date math to determine correctly and a string
comparison answers directly and unambiguously.

### `userBadges/{uid}/earned/{badgeId}`
Fields: `badgeId`, `earnedAt`, `seen` (boolean — for a "new badge!" UI
indicator).

**Why a subcollection, not an array field:** a badge list can grow
to 20+ over a user's lifetime (matches the brief's own extensible
badge list). An array on `userProgress` would need a full-document
read to check "does this user have badge X," while a subcollection
lets a single badge be checked or written independently — critical
for badge-award transactions that shouldn't need to read/rewrite the
user's entire progress document just to add one badge.

### `userAchievements/{uid}/unlocked/{achievementId}`
Same subcollection reasoning as badges — kept as a SEPARATE collection
from badges (not merged) because badges and secret achievements have
different unlock semantics (badges are milestone-based and often
visible/aspirational; achievements are hidden until unlocked, per the
brief's own "Secret Achievements" framing) and different UI treatment
(achievement unlock gets a full popup + confetti; badge award is
typically quieter). Keeping them separate now avoids a schema
migration later if their behavior diverges further.

### `xpLog/{uid}/entries/{entryId}`
Fields: `activityType`, `xpAwarded`, `pointsAwarded`, `createdAt`,
`metadata` (e.g. `{ postId }` for a "Post Created" entry).

**Why this exists at all:** the Weekly Recap feature (item 12) needs
"XP earned this week" — without a log, that number doesn't exist
anywhere; `userProgress.xp` is only ever a running total, never a
per-period delta. A log is also what makes idempotency
possible (see XP service below) and gives future admin tooling an
audit trail ("why does this user have 4,000 XP") without needing to
reconstruct it from raw action history across posts/comments/etc.

### `dailyMissions/{uid}/{dateString}` and `weeklyMissions/{uid}/{weekString}`
Doc id is the date/week itself (e.g. `2026-08-05`,
`2026-W32`) — structurally guarantees exactly one mission set per
user per period, and makes "has today's mission set been generated
yet" a single-document existence check rather than a query.

### `leaderboards/{scope}/entries/{uid}`
`scope` is a composite key like `overall`, `college_<collegeId>`,
`department_<dept>`, `year_<year>`, `weekly_<weekString>`,
`monthly_<monthString>`. Each entry: `xp` (or the relevant metric),
`rank` (denormalized, updated by a periodic recompute — see below),
`displayName`/`avatar` (denormalized for the leaderboard UI to avoid
N+1 profile reads per row, mirroring how `posts` already denormalizes
`author` onto each post rather than joining against `users` per
render).

**Why not compute leaderboards live from `userProgress` with a sorted
query:** Firestore can `orderBy('xp', 'desc')` on `userProgress`
directly for the *overall* leaderboard — no separate collection
needed for that one case. But college/department/year/weekly/monthly
scopes each need their own filtered, sorted view, and "weekly" or
"monthly" specifically need a value that ISN'T `userProgress.xp`
(which is all-time) — they need a windowed sum, which only `xpLog`
could answer via an expensive aggregation query repeated on every
leaderboard view. Precomputing into `leaderboards/{scope}/entries`
(refreshed by a scheduled job, not on every read) is the standard
trade: cheap, paginated reads for users; the expensive aggregation
happens once per period, not once per page view.

## What this schema deliberately does NOT include yet

Season Pass, Rewards Shop, and Ranked Competitions (item 18, "future
ready") aren't modeled with their own collections now — the brief
asks for an architecture that *doesn't require restructuring* to add
them later, not for them to be pre-built. `campusPoints` already being
a separate currency from `xp` (item 3) is what makes a future Rewards
Shop addable later without touching this schema at all — it would
just be a new collection that debits `userProgress.campusPoints`
through the same transactional pattern the XP service already
establishes.
