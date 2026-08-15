/**
 * Preset "Campinity Avatar" library — Phase 1, no AI generation.
 *
 * CRITICAL design constraint: getProfileIdentityImage's return value
 * is used directly as <img src={...}> in every avatar-rendering
 * location across the entire app (Home, posts, comments, chat,
 * sidebar, etc — confirmed by reading getProfileIdentityImage.js
 * directly). Storing a bare avatar id like 'ca-tech-1' as
 * campusAvatarUrl would break every one of those locations, since
 * that string isn't a renderable image source.
 *
 * The fix: each avatar's `url` is a real, self-contained SVG data URI
 * — generated locally from a gradient + emoji glyph, never a remote
 * URL that could break (Section 14's explicit requirement), and
 * genuinely valid wherever an <img> tag already expects a URL. This
 * is what makes "same avatar everywhere" (Section 11) work with zero
 * changes needed to any existing avatar-rendering component — they
 * already all just do <img src={getProfileIdentityImage(profile)}>.
 */
function buildAvatarDataUrl(glyph, [from, to]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${from}" />
        <stop offset="100%" stop-color="${to}" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="100" fill="url(#g)" />
    <text x="100" y="118" font-size="90" text-anchor="middle" dominant-baseline="middle">${glyph}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const AVATAR_CATEGORIES = [
  { key: 'tech', label: 'Tech', emoji: '💻' },
  { key: 'study', label: 'Study', emoji: '📚' },
  { key: 'sports', label: 'Sports', emoji: '⚽' },
  { key: 'music', label: 'Music', emoji: '🎵' },
  { key: 'creative', label: 'Creative', emoji: '🎨' },
  { key: 'gaming', label: 'Gaming', emoji: '🎮' },
  { key: 'business', label: 'Business', emoji: '🚀' },
  { key: 'campus', label: 'Campus', emoji: '🏫' },
  { key: 'general', label: 'General', emoji: '✨' }
]

/**
 * `id` is permanent and stored nowhere — only `url` (the actual SVG
 * data URI) is ever persisted as campusAvatarUrl, so this list can be
 * safely reordered or extended later without invalidating anyone's
 * existing selection. Visually one coherent family (consistent
 * circular gradient + centered glyph treatment) — not five genuinely
 * distinct art styles, kept honest to what a locally-generated SVG
 * can actually produce without real bundled art assets.
 */
const RAW_AVATARS = [
  { id: 'tech-1', category: 'tech', glyph: '💻', gradient: ['#6366f1', '#8b5cf6'] },
  { id: 'tech-2', category: 'tech', glyph: '🖥️', gradient: ['#3b82f6', '#6366f1'] },
  { id: 'tech-3', category: 'tech', glyph: '⌨️', gradient: ['#0ea5e9', '#6366f1'] },
  { id: 'study-1', category: 'study', glyph: '📚', gradient: ['#f59e0b', '#f97316'] },
  { id: 'study-2', category: 'study', glyph: '🎓', gradient: ['#eab308', '#f59e0b'] },
  { id: 'study-3', category: 'study', glyph: '✏️', gradient: ['#fb923c', '#f59e0b'] },
  { id: 'sports-1', category: 'sports', glyph: '⚽', gradient: ['#22c55e', '#16a34a'] },
  { id: 'sports-2', category: 'sports', glyph: '🏀', gradient: ['#f97316', '#ea580c'] },
  { id: 'sports-3', category: 'sports', glyph: '🏸', gradient: ['#10b981', '#059669'] },
  { id: 'music-1', category: 'music', glyph: '🎵', gradient: ['#ec4899', '#db2777'] },
  { id: 'music-2', category: 'music', glyph: '🎸', gradient: ['#d946ef', '#ec4899'] },
  { id: 'music-3', category: 'music', glyph: '🎧', gradient: ['#a855f7', '#d946ef'] },
  { id: 'creative-1', category: 'creative', glyph: '🎨', gradient: ['#f43f5e', '#ec4899'] },
  { id: 'creative-2', category: 'creative', glyph: '🖌️', gradient: ['#fb7185', '#f43f5e'] },
  { id: 'creative-3', category: 'creative', glyph: '📸', gradient: ['#e879f9', '#a855f7'] },
  { id: 'gaming-1', category: 'gaming', glyph: '🎮', gradient: ['#7c3aed', '#6366f1'] },
  { id: 'gaming-2', category: 'gaming', glyph: '🕹️', gradient: ['#8b5cf6', '#7c3aed'] },
  { id: 'gaming-3', category: 'gaming', glyph: '👾', gradient: ['#6d28d9', '#8b5cf6'] },
  { id: 'business-1', category: 'business', glyph: '🚀', gradient: ['#0891b2', '#0e7490'] },
  { id: 'business-2', category: 'business', glyph: '📈', gradient: ['#0d9488', '#0891b2'] },
  { id: 'business-3', category: 'business', glyph: '💼', gradient: ['#0369a1', '#0284c7'] },
  { id: 'campus-1', category: 'campus', glyph: '🏫', gradient: ['#5b4dff', '#7b61ff'] },
  { id: 'campus-2', category: 'campus', glyph: '🎒', gradient: ['#4f46e5', '#5b4dff'] },
  { id: 'campus-3', category: 'campus', glyph: '📖', gradient: ['#4338ca', '#4f46e5'] },
  { id: 'general-1', category: 'general', glyph: '✨', gradient: ['#64748b', '#475569'] },
  { id: 'general-2', category: 'general', glyph: '🌟', gradient: ['#94a3b8', '#64748b'] },
  { id: 'general-3', category: 'general', glyph: '🔥', gradient: ['#f97316', '#64748b'] }
]

export const CAMPINITY_AVATARS = RAW_AVATARS.map((a) => ({
  ...a,
  url: buildAvatarDataUrl(a.glyph, a.gradient)
}))

export function getAvatarByUrl(url) {
  return CAMPINITY_AVATARS.find((a) => a.url === url) || null
}
