/**
 * New mascot component — CampusMascotPremium.jsx (the original,
 * referenced in the brief) was confirmed deliberately deleted in a
 * prior session; HeroPremium.jsx's own comment states this explicitly
 * ("Mascot removed entirely this pass... the old mascot component
 * file is now unused — delete it"). It is not present anywhere in
 * my sandbox and no other file references it. Per the brief's own
 * fallback ("if the original asset genuinely cannot be found, create
 * a new one"), this is a new, honest, CSS/SVG-based stylized
 * approximation of the reference — a rounded-square head with a
 * simple smiling face and a glowing orbital ring — not a
 * reproduction of the exact reference photo, since I have no
 * image-generation tool available to produce that. Pure CSS/SVG, no
 * image asset, so it costs nothing to load and never blurs.
 *
 * Orbital ring rotation is slow (26s) and respects
 * prefers-reduced-motion (handled entirely in CSS via the
 * animation-related media query in CampusMascot.css), matching the
 * brief's explicit 'very slow, no flashy looping, respect reduced
 * motion' requirement.
 */
export default function CampusMascot({ className = '' }) {
  return (
    <div className={`relative w-full max-w-[380px] aspect-square ${className}`}>
      {/* Orbital rings */}
      <svg
        viewBox="0 0 400 400"
        className="cm-mascot-ring absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <circle cx="200" cy="200" r="180" fill="none" stroke="url(#cmRingGrad1)" strokeWidth="1.2" opacity="0.5" />
        <circle cx="200" cy="200" r="150" fill="none" stroke="url(#cmRingGrad2)" strokeWidth="1" opacity="0.35" />
        <defs>
          <linearGradient id="cmRingGrad1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--theme-accentSecondary, #7b61ff)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--theme-accentSecondary, #7b61ff)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--theme-accent, #5b4dff)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cmRingGrad2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0" />
            <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--theme-accent, #5b4dff)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Ambient glow behind the head */}
      <div className="cm-mascot-glow absolute inset-[12%] rounded-full pointer-events-none" aria-hidden="true" />

      {/* Head */}
      <div className="cm-mascot-head absolute inset-[20%] rounded-[34%]">
        <svg viewBox="0 0 100 100" className="absolute inset-[16%] w-[68%] h-[68%]" aria-hidden="true">
          <rect x="0" y="0" width="100" height="100" rx="22" className="cm-mascot-screen-fill" />
          <rect x="18" y="30" width="9" height="22" rx="4.5" className="cm-mascot-eye-fill" />
          <rect x="73" y="30" width="9" height="22" rx="4.5" className="cm-mascot-eye-fill" />
          <path d="M 34 66 Q 50 78 66 66" fill="none" className="cm-mascot-mouth-stroke" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
        <div className="cm-mascot-highlight" aria-hidden="true" />
      </div>
    </div>
  )
}
