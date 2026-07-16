const paths = {
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M15.5 5.5a3 3 0 0 1 0 5.9" />
      <path d="M17.5 14.6c2.6.5 4.5 2.5 4.5 5.4" />
    </>
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="8" opacity="0.55" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5V5.5Z" />
      <path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H12v16h6.5A1.5 1.5 0 0 0 20 18.5V5.5Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3.2M16 3v3.2" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14 2.5 9.5Z" />
      <path d="M6.5 11.6v4.1c0 1.6 2.5 2.8 5.5 2.8s5.5-1.2 5.5-2.8v-4.1" />
      <path d="M21.5 9.5v5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="11.5" rx="2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  masks: (
    <>
      <circle cx="9" cy="10" r="5" />
      <circle cx="15" cy="14" r="5" />
    </>
  ),
  enter: (
    <>
      <path d="M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13" />
      <path d="M3 12h12.5" />
      <path d="M11.5 8 15.5 12l-4 4" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="15" r="5.5" />
      <path d="M9.5 4 12 9.5 14.5 4" />
      <path d="M12 12.5v5" />
    </>
  ),
  shield: (
    <path d="M12 3.5 19 6.3v5.4c0 4.8-3 8.3-7 9.3-4-1-7-4.5-7-9.3V6.3L12 3.5Z" />
  ),
  heart: (
    <path d="M12 20s-7.2-4.4-9.4-9C1 7.7 2.6 4.7 5.7 4.1c1.9-.4 3.8.5 5 2 .8-1.5 2.6-2.6 4.6-2.2 3.2.6 4.8 3.6 3.3 6.9C16.3 15.6 12 20 12 20Z" />
  ),
  arrow: <path d="M5 12h13.5M13 6.5 18.5 12 13 17.5" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  whatsapp: (
    <path d="M12 3.5a8.4 8.4 0 0 0-7.2 12.7L3.5 20.5l4.4-1.2A8.4 8.4 0 1 0 12 3.5Zm4.5 11.9c-.2.5-1.1 1-1.6 1.1-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.2-4.3-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.5.7 1.8.8 1.9.1.2.1.3 0 .5-.1.2-.1.3-.3.5-.1.2-.3.3-.4.5-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.8.8.3.1.5.2.5.3.1.2.1.6-.1 1.1Z" />
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <circle cx="8" cy="8.2" r="1.1" fill="currentColor" stroke="none" />
      <path d="M8 11v6" />
      <path d="M12 17v-3.5c0-1.4 1-2.5 2.3-2.5s2.2 1 2.2 2.5V17" />
    </>
  ),
  x: (
    <>
      <path d="M4.5 4.5 19.5 19.5" />
      <path d="M19.5 4.5 4.5 19.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 1 1 8 0v2.5" />
    </>
  ),
  spark: (
    <path d="M12 3.5 13.6 9l5.4 1.5-5.4 1.5L12 17.5 10.4 12l-5.4-1.5L10.4 9 12 3.5Z" />
  )
}

export default function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.6 }) {
  const path = paths[name]
  if (!path) return null
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  )
}
