const sizes = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-2xl',
  // Fills whatever pixel size its parent already computed (e.g. a story
  // ring's padded inner circle) instead of forcing one of the fixed
  // presets above — the ROOT CAUSE of the story-ring overflow bug was
  // exactly this: `lg` (56px) rendering inside a ring container whose
  // real available space (after the ring stroke + white gap padding)
  // was only ~51px, so the avatar visually overflowed/crowded the ring
  // instead of sitting inside it cleanly.
  fill: 'w-full h-full text-base'
}

export default function Avatar({ initials, colorClass = 'from-blue-500 to-blue-600', size = 'md', src }) {
  if (src) {
    return (
      <div className={`flex-shrink-0 rounded-full overflow-hidden ${sizes[size]}`}>
        <img src={src} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={`flex-shrink-0 rounded-full bg-gradient-to-br ${colorClass} ${sizes[size]} flex items-center justify-center text-white font-semibold select-none`}
    >
      {initials}
    </div>
  )
}