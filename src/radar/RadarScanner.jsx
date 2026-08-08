import { useMemo } from 'react'
import { motion } from 'framer-motion'
import Avatar from '../components/Avatar.jsx'
import { getAvatarColor, getInitials } from '../firebase/postService.js'
import { getProfileIdentityImage } from '../avatar/profileIdentity.js'
import { matchTier } from './radarService.js'

const TIER_RING_COLOR = {
  high: 'ring-emerald-400',
  medium: 'ring-blue-400',
  low: 'ring-gray-300'
}

/**
 * Positions avatars by polar coordinates: radius from rank (best match
 * closest to center, matching "closest matches appear closer"), angle
 * deterministically derived from uid (same hash approach
 * getAvatarColor already uses elsewhere in this project) so layout is
 * stable across re-renders rather than jumping around on every score
 * recompute.
 */
function angleForUid(uid) {
  let hash = 0
  for (let i = 0; i < uid.length; i += 1) hash = (hash * 31 + uid.charCodeAt(i)) % 360
  return hash
}

export default function RadarScanner({ matches, onSelectMatch, size = 320 }) {
  const center = size / 2
  const minRadius = size * 0.22
  const maxRadius = size * 0.46

  const MAX_TRACKED_DISTANCE = 10 // meters — matches RADAR_RADIUS_METERS in radarLocationService.js; anything beyond this was already filtered out server-query-side, this is just the positioning scale

const positioned = useMemo(() => {
    return matches.map((match) => {
      const clampedDistance = Math.min(match.distanceMeters ?? MAX_TRACKED_DISTANCE, MAX_TRACKED_DISTANCE)
      const radiusFraction = clampedDistance / MAX_TRACKED_DISTANCE
      const radius = minRadius + radiusFraction * (maxRadius - minRadius)
      const angleDeg = angleForUid(match.uid)
      const angleRad = (angleDeg * Math.PI) / 180
      return {
        ...match,
        x: center + radius * Math.cos(angleRad),
        y: center + radius * Math.sin(angleRad)
      }
    })
  }, [matches, center, minRadius, maxRadius])

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Rotating scan beam */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'conic-gradient(from 0deg, rgba(16,185,129,0.35), transparent 35%)'
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
      />

      {/* Concentric rings */}
      {[0.33, 0.66, 1].map((f) => (
        <div
          key={f}
          className="absolute rounded-full border border-emerald-500/15"
          style={{
            width: size * f,
            height: size * f,
            top: center - (size * f) / 2,
            left: center - (size * f) / 2
          }}
        />
      ))}

      {/* Ripple pulses */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-emerald-400/40"
          style={{ top: center, left: center, width: 0, height: 0 }}
          animate={{ width: size, height: size, top: 0, left: 0, opacity: [0.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: 'easeOut' }}
        />
      ))}

      {/* Center — YOU */}
      <div
        className="absolute w-11 h-11 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold"
        style={{ top: center - 22, left: center - 22 }}
      >
        YOU
      </div>

      {/* Discovered avatars, breathing + fade-in */}
      {positioned.map((match, index) => (
        <motion.button
          key={match.uid}
          type="button"
          onClick={() => onSelectMatch(match)}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: [1, 1.06, 1] }}
          transition={{
            opacity: { duration: 0.4, delay: index * 0.05 },
            scale: { duration: 2.4 + (index % 3) * 0.3, repeat: Infinity, ease: 'easeInOut' }
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ top: match.y, left: match.x }}
        >
          <div className={`relative rounded-full ring-2 ${TIER_RING_COLOR[matchTier(match.score)]}`}>
            <Avatar
              initials={getInitials(match.displayName)}
              colorClass={getAvatarColor(match.uid)}
              size="sm"
              src={getProfileIdentityImage(match) || undefined}
            />
          </div>
        </motion.button>
      ))}
    </div>
  )
}
