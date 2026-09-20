/**
 * The ONE file admin/design values live in — per the brief's explicit
 * "everything configurable from one file, never hardcode values inside
 * components." Every other file in this system imports from here
 * rather than embedding a number directly.
 */

export const XP_REWARDS = {
  daily_login: 10,
  post_created: 25,
  story_uploaded: 10,
  notes_uploaded: 15,
  comment_created: 5,
  comment_received: 6,
  like_given: 2,
  like_received: 2,
  share: 5,
  save: 2,
  follow: 3,
  followed: 5,
  message_sent: 1,
  club_joined: 20,
  lostfound_resolved: 10,
  event_attended: 40,
  profile_completed: 50,
  campus_verified: 100,
  contest_winner: 300
}

/**
 * Daily caps — one place for every "how many times a day can this
 * activity earn XP" number, consolidating what used to be inline
 * magic numbers at each awardXP call site (like_given/share/
 * message_sent) plus new caps for previously-uncapped, high-volume
 * activities (post_created/comment_created were the biggest real spam
 * gap found in the pre-overhaul audit — a user could otherwise farm
 * unlimited XP by creating and deleting posts/comments in a loop).
 * Checked via hasReachedDailyCap in xpService.js before the award.
 */
export const DAILY_CAPS = {
  like_given: 30,
  share: 15,
  message_sent: 20,
  post_created: 10,
  comment_created: 30,
  notes_uploaded: 5,
  story_uploaded: 5,
  club_joined: 5
}

/**
 * Campus Points — a distinct currency, not xp aliased under a
 * different name (per the explicit "do not simply make points = xp").
 * Only meaningful actions earn points; small/frequent actions
 * (like_given, follow) earn XP but no points, matching "receiving
 * likes/reactions" being worth more toward points than the act of
 * giving one.
 */
export const POINTS_REWARDS = {
  post_created: 10,
  comment_created: 4,
  share: 5,
  like_received: 2,
  save: 1
}

/**
 * Reputation — reflects quality/contribution received FROM others,
 * not activity you personally perform. Deliberately does NOT include
 * like_given, save, or message_sent — reputation is about what the
 * community thinks of your contributions, not how much you do
 * yourself (per "avoid making reputation increase infinitely from
 * trivial actions" and "should reflect quality/community
 * contribution"). Only comment_received and like_received (both
 * signals from OTHER people about YOUR content) award reputation.
 */
export const REPUTATION_ACTION_REWARDS = {
  comment_received: 2,
  like_received: 1
}

/**
 * Level thresholds — cumulative XP required to REACH that level, not
 * XP required per-level. Deliberately sparse (not every level 1-100
 * needs its own named tier) — getLevelForXP below finds the highest
 * threshold the user's XP has crossed and interpolates progress
 * toward the next named tier or the next integer level, whichever the
 * UI needs (see LEVEL_STEP_XP for the between-tier curve).
 */
export const LEVEL_TIERS = [
  { level: 1, xp: 0, title: 'Fresher', emoji: '🌱' },
  { level: 5, xp: 500, title: 'Explorer', emoji: '🧭' },
  { level: 10, xp: 1500, title: 'Contributor', emoji: '✍️' },
  { level: 20, xp: 4000, title: 'Influencer', emoji: '⭐' },
  { level: 35, xp: 9000, title: 'Campus Star', emoji: '🌟' },
  { level: 50, xp: 16000, title: 'Legend', emoji: '👑' },
  { level: 75, xp: 30000, title: 'Icon', emoji: '💎' },
  { level: 100, xp: 50000, title: 'Hall of Fame', emoji: '🏆' }
]

/** XP required per single level, between named tiers — a smooth linear ramp between each tier's threshold, not a flat number, so leveling doesn't feel identical at level 2 and level 90. */
export function getLevelStepXP(level) {
  const tierIndex = LEVEL_TIERS.findIndex((t, i) => level >= t.level && (i === LEVEL_TIERS.length - 1 || level < LEVEL_TIERS[i + 1].level))
  const tier = LEVEL_TIERS[tierIndex]
  const nextTier = LEVEL_TIERS[tierIndex + 1]
  if (!nextTier) return 1000 // past the last named tier, flat step
  const levelSpan = nextTier.level - tier.level
  const xpSpan = nextTier.xp - tier.xp
  return Math.round(xpSpan / levelSpan)
}

export const STREAK_REWARDS = {
  3: { xp: 50 },
  7: { badgeId: 'week_streak' },
  15: { frameId: 'streak_15_frame' },
  30: { campusPoints: 500 },
  100: { badgeId: 'legend_streak' }
}

export const DAILY_MISSION_TEMPLATES = [
  { id: 'daily_login', label: 'Log in today', xp: 10, campusPoints: 5, target: 1, activityType: 'daily_login' },
  { id: 'like_5_posts', label: 'Like 5 posts', xp: 15, campusPoints: 5, target: 5, activityType: 'like_given' },
  { id: 'comment_once', label: 'Leave a comment', xp: 10, campusPoints: 5, target: 1, activityType: 'comment_created' },
  { id: 'upload_story', label: 'Upload a story', xp: 15, campusPoints: 10, target: 1, activityType: 'story_uploaded' },
  { id: 'create_post', label: 'Create a post', xp: 20, campusPoints: 10, target: 1, activityType: 'post_created' }
]

export const WEEKLY_MISSION_TEMPLATES = [
  { id: 'create_2_posts', label: 'Create 2 posts', xp: 100, campusPoints: 50, target: 2, activityType: 'post_created' },
  { id: 'comment_10_times', label: 'Comment 10 times', xp: 100, campusPoints: 50, target: 10, activityType: 'comment_created' },
  { id: 'like_30_posts', label: 'Like 30 posts', xp: 80, campusPoints: 40, target: 30, activityType: 'like_given' },
  { id: 'upload_story_weekly', label: 'Upload a story', xp: 60, campusPoints: 30, target: 1, activityType: 'story_uploaded' },
  { id: 'join_club_weekly', label: 'Join a club', xp: 80, campusPoints: 40, target: 1, activityType: 'club_joined' },
  { id: 'attend_event_weekly', label: 'Attend an event', xp: 80, campusPoints: 40, target: 1, activityType: 'event_attended' }
]
export const WEEKLY_COMPLETION_BONUS = { xp: 500, campusPoints: 300, badgeId: 'weekly_champion' }

/**
 * Badges — extensible via config only, per the brief's explicit
 * "future badges should require only config updates." `criteria` is a
 * declarative description for the (future) badge-evaluation job to
 * read, not executable code — keeps this file pure data, no logic
 * that could itself need a rewrite to add a badge.
 */
export const BADGES = {
  early_bird: { label: 'Early Bird', emoji: '🐦', category: 'campus', description: 'One of the first students to join Campinity.', criteria: { type: 'joined_before', value: '2026-01-01' } },
  campus_legend: { label: 'Campus Legend', emoji: '🏛️', category: 'special', description: 'Reached Level 50 — a true Campinity veteran.', criteria: { type: 'level_reached', value: 50 } },
  academic_genius: { label: 'Academic Genius', emoji: '🎓', category: 'academic', description: 'Recognized by the Campinity team for outstanding academic contribution.', criteria: { type: 'manual' } },
  knowledge_king: { label: 'Knowledge King', emoji: '📚', category: 'academic', description: 'Recognized by the Campinity team as a top knowledge contributor.', criteria: { type: 'manual' } },
  conversation_starter: { label: 'Conversation Starter', emoji: '💬', category: 'community', description: 'Your posts sparked 50 replies from other students.', criteria: { type: 'comments_received', value: 50 } },
  campus_helper: { label: 'Campus Helper', emoji: '🤝', category: 'community', description: 'Your replies helped other students 10 times.', criteria: { type: 'comments_received', value: 10 } },
  event_lover: { label: 'Event Lover', emoji: '🎉', category: 'activity', description: 'Attended 10 campus events.', criteria: { type: 'events_attended', value: 10 } },
  helpful_student: { label: 'Helpful Student', emoji: '🫶', category: 'community', description: 'Recognized by the Campinity team for consistently helping other students.', criteria: { type: 'manual' } },
  most_loved: { label: 'Most Loved', emoji: '❤️', category: 'community', description: 'Your content has received 500 likes from the campus community.', criteria: { type: 'likes_received', value: 500 } },
  top_writer: { label: 'Top Writer', emoji: '✍️', category: 'academic', description: 'Created 100 posts on Campinity.', criteria: { type: 'posts_created', value: 100 } },
  notes_contributor: { label: 'Notes Contributor', emoji: '📝', category: 'academic', description: 'Shared 5 useful study notes with your campus.', criteria: { type: 'notes_uploaded', value: 5 } },
  knowledge_sharer: { label: 'Knowledge Sharer', emoji: '🧠', category: 'academic', description: 'Recognized for consistently sharing useful study notes.', criteria: { type: 'notes_uploaded', value: 20 } },
  community_builder: { label: 'Community Builder', emoji: '🌐', category: 'community', description: 'Joined 3 communities and got involved on campus.', criteria: { type: 'communities_joined', value: 3 } },
  lostfound_hero: { label: 'Lost & Found Hero', emoji: '🔎', category: 'community', description: 'Successfully resolved 3 Lost & Found listings.', criteria: { type: 'lostfound_resolved', value: 3 } },
  story_master: { label: 'Story Master', emoji: '📸', category: 'activity', description: 'Shared 100 stories with your campus.', criteria: { type: 'stories_uploaded', value: 100 } },
  streak_master: { label: 'Streak Master', emoji: '🔥', category: 'activity', description: 'Maintained a 100-day activity streak.', criteria: { type: 'streak_reached', value: 100 } },
  rising_star: { label: 'Rising Star', emoji: '🌠', category: 'special', description: 'Reached Level 10 — you\'re on your way up.', criteria: { type: 'level_reached', value: 10 } },
  verified_campus: { label: 'Verified Campus', emoji: '✅', category: 'campus', description: 'Verified your campus identity on Campinity.', criteria: { type: 'campus_verified' } },
  club_founder: { label: 'Club Founder', emoji: '🏗️', category: 'community', description: 'Recognized by the Campinity team for founding a club.', criteria: { type: 'manual' } },
  event_organizer: { label: 'Event Organizer', emoji: '📅', category: 'community', description: 'Recognized by the Campinity team for organizing a campus event.', criteria: { type: 'manual' } },
  hackathon_winner: { label: 'Hackathon Winner', emoji: '💻', category: 'special', description: 'Recognized by the Campinity team for winning a hackathon.', criteria: { type: 'manual' } },
  placement_champion: { label: 'Placement Champion', emoji: '🎯', category: 'special', description: 'Recognized by the Campinity team for a placement achievement.', criteria: { type: 'manual' } },
  // Streak-reward badges referenced by STREAK_REWARDS above
  week_streak: { label: '7-Day Streak', emoji: '🔥', category: 'activity', description: 'Stayed active on Campinity for 7 days in a row.', criteria: { type: 'streak_reached', value: 7 } },
  legend_streak: { label: 'Legend Streak', emoji: '🔥', category: 'activity', description: 'Stayed active on Campinity for 100 days in a row.', criteria: { type: 'streak_reached', value: 100 } },
  weekly_champion: { label: 'Weekly Champion', emoji: '🏅', category: 'special', description: 'Recognized by the Campinity team for a standout week.', criteria: { type: 'manual' } }
}

export const BADGE_CATEGORY_LABELS = {
  academic: 'Academic',
  community: 'Community',
  activity: 'Activity',
  campus: 'Campus',
  special: 'Special'
}

/** Real, countable activities that make up the "Contributions" leaderboard metric and the Profile's "Your Campus Impact" card — deliberately excludes passive/self actions (like_given, follow, message_sent) so it reflects things a user actually created or committed to, not incidental clicks. */
export const CONTRIBUTION_ACTIVITY_TYPES = [
  'post_created',
  'comment_created',
  'notes_uploaded',
  'share',
  'club_joined',
  'story_uploaded',
  'lostfound_resolved'
]

/** Human labels for xpLog activityType keys, used by XP History / Recent XP / Your Campus Impact — one place so new activity types don't need per-component label logic. */
export const ACTIVITY_LABELS = {
  daily_login: 'Daily activity',
  post_created: 'Created a post',
  story_uploaded: 'Shared a story',
  notes_uploaded: 'Uploaded study notes',
  comment_created: 'Left a comment',
  comment_received: 'Received a helpful reply',
  like_given: 'Liked a post',
  like_received: 'Received a like',
  share: 'Shared a post',
  save: 'Saved a post',
  follow: 'Followed a student',
  followed: 'Gained a follower',
  message_sent: 'Sent a message',
  club_joined: 'Joined a community',
  lostfound_resolved: 'Resolved a Lost & Found item',
  event_attended: 'Attended an event',
  profile_completed: 'Completed your profile',
  campus_verified: 'Verified your campus',
  campus_verified_bonus: 'Verified campus member bonus',
  moderation_penalty: 'Moderation adjustment',
  contest_winner: 'Won a contest'
}

/**
 * Reputation-only signals — kept separate from XP_REWARDS since these
 * don't award XP, only reputation, and one (moderation_penalty) is
 * negative. See applyReputationAdjustment in xpService.js and the
 * Cloud Functions in functions/functions/index.js that call the
 * equivalent Admin-SDK logic (duplicated there since Cloud Functions
 * can't import this client file — see that file's own comment).
 */
export const REPUTATION_CATEGORY_LABELS = {
  comment_received: 'Helpful contributions',
  like_received: 'Helpful contributions',
  campus_verified_bonus: 'Verified campus member',
  moderation_penalty: 'Moderation adjustment'
}
export const REPUTATION_VERIFIED_CAMPUS_BONUS = 50
export const REPUTATION_MODERATION_PENALTY = { restricted: -30, suspended: -75 }

export const SECRET_ACHIEVEMENTS = {
  night_owl: { label: 'Night Owl', description: 'Posted after 2AM', xp: 50, campusPoints: 25, criteria: { type: 'posted_after_hour', value: 2 } },
  meme_lord: { label: 'Meme Lord', description: '100 memes posted', xp: 200, campusPoints: 100, criteria: { type: 'manual' } },
  social_butterfly: { label: 'Social Butterfly', description: '1000 comments made', xp: 300, campusPoints: 150, criteria: { type: 'comments_created', value: 1000 } },
  fire_starter: { label: 'Fire Starter', description: 'First viral post', xp: 250, campusPoints: 125, criteria: { type: 'manual' } },
  peoples_favorite: { label: "People's Favorite", description: '1000 likes received', xp: 300, campusPoints: 150, criteria: { type: 'likes_received', value: 1000 } },
  scholar: { label: 'Scholar', description: '500 answers given', xp: 300, campusPoints: 150, criteria: { type: 'manual' } }
}

export const PROFILE_COMPLETION_CHECKLIST = [
  { key: 'bio', label: 'Add Bio', weight: 15 },
  { key: 'skills', label: 'Add Skills', weight: 15 },
  { key: 'coverPhoto', label: 'Upload Cover', weight: 20 },
  { key: 'avatar', label: 'Upload Avatar', weight: 20 },
  { key: 'verifiedCampus', label: 'Verify Campus', weight: 20 },
  { key: 'joinedClub', label: 'Join a Club', weight: 10 }
]
export const PROFILE_COMPLETION_BONUS = { xp: 50, campusPoints: 25 }

export const REPUTATION_REWARDS = {
  best_answer: 10,
  helpful_comment: 3,
  club_moderator: 15,
  event_organizer: 20,
  report_accepted: 5
}
