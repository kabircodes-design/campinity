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
  comment_created: 5,
  comment_received: 6,
  like_received: 2,
  club_joined: 20,
  event_attended: 40,
  profile_completed: 50,
  campus_verified: 100,
  contest_winner: 300
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
  early_bird: { label: 'Early Bird', emoji: '🐦', criteria: { type: 'joined_before', value: '2026-01-01' } },
  campus_legend: { label: 'Campus Legend', emoji: '🏛️', criteria: { type: 'level_reached', value: 50 } },
  academic_genius: { label: 'Academic Genius', emoji: '🎓', criteria: { type: 'manual' } },
  knowledge_king: { label: 'Knowledge King', emoji: '📚', criteria: { type: 'manual' } },
  conversation_starter: { label: 'Conversation Starter', emoji: '💬', criteria: { type: 'comments_received', value: 50 } },
  event_lover: { label: 'Event Lover', emoji: '🎉', criteria: { type: 'events_attended', value: 10 } },
  helpful_student: { label: 'Helpful Student', emoji: '🤝', criteria: { type: 'manual' } },
  most_loved: { label: 'Most Loved', emoji: '❤️', criteria: { type: 'likes_received', value: 500 } },
  top_writer: { label: 'Top Writer', emoji: '✍️', criteria: { type: 'posts_created', value: 100 } },
  story_master: { label: 'Story Master', emoji: '📸', criteria: { type: 'stories_uploaded', value: 100 } },
  streak_master: { label: 'Streak Master', emoji: '🔥', criteria: { type: 'streak_reached', value: 100 } },
  rising_star: { label: 'Rising Star', emoji: '🌠', criteria: { type: 'level_reached', value: 10 } },
  verified_campus: { label: 'Verified Campus', emoji: '✅', criteria: { type: 'campus_verified' } },
  club_founder: { label: 'Club Founder', emoji: '🏗️', criteria: { type: 'manual' } },
  event_organizer: { label: 'Event Organizer', emoji: '📅', criteria: { type: 'manual' } },
  hackathon_winner: { label: 'Hackathon Winner', emoji: '💻', criteria: { type: 'manual' } },
  placement_champion: { label: 'Placement Champion', emoji: '🎯', criteria: { type: 'manual' } },
  // Streak-reward badges referenced by STREAK_REWARDS above
  week_streak: { label: '7-Day Streak', emoji: '🔥', criteria: { type: 'streak_reached', value: 7 } },
  legend_streak: { label: 'Legend Streak', emoji: '🔥', criteria: { type: 'streak_reached', value: 100 } },
  weekly_champion: { label: 'Weekly Champion', emoji: '🏅', criteria: { type: 'manual' } }
}

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
