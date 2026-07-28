/**
 * Vector recreation of the provided reference wordmark — every letter
 * built from SVG geometry (no <text>, no font), with a two-layer
 * front/depth construction approximating the reference's 3D-extruded
 * look, plus the blue circular accent inside the C and the blue square
 * accents above both i's.
 *
 * Honest limitation: the reference was rendered in a 3D tool with true
 * lighting and bevels. This is a flat-SVG approximation of that
 * language (an offset "depth" layer behind a bright front layer, soft
 * outer glow) — it matches the same letter sequence, proportions, and
 * accent placement, but won't be a pixel-identical render of a 3D
 * scene.
 */
function WordmarkSVG() {
  return (
    <svg
      className="chp-wordmark-svg"
      height="30"
      viewBox="0 0 880 260"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Campinity"
    >
      <defs>
        <filter id="chp-wordmark-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Depth layer — offset copy suggesting extruded thickness */}
      <g
        transform="translate(4,7)"
        fill="none"
        stroke="#d7e2f2"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 122 60 C 72 60, 34 90, 34 135 C 34 180, 72 210, 118 210 C 146 210, 166 200, 182 182" />
        <circle cx="226" cy="148" r="33" />
        <line x1="257" y1="99" x2="257" y2="182" />
        <line x1="301" y1="99" x2="301" y2="182" />
        <path d="M 301 118 C 301 101, 339 101, 339 118 L 339 182" />
        <path d="M 339 118 C 339 101, 377 101, 377 118 L 377 182" />
        <line x1="419" y1="99" x2="419" y2="222" />
        <circle cx="450" cy="140" r="39" />
        <line x1="514" y1="99" x2="514" y2="182" />
        <line x1="572" y1="99" x2="572" y2="182" />
        <path d="M 572 118 C 572 101, 610 101, 610 118 L 610 182" />
        <line x1="654" y1="72" x2="654" y2="160" />
        <path d="M 654 158 C 654 173, 667 179, 682 173" />
        <line x1="633" y1="109" x2="682" y2="109" />
        <line x1="714" y1="99" x2="714" y2="182" />
        <line x1="745" y1="99" x2="770" y2="182" />
        <path d="M 798 99 L 770 182 C 764 201, 749 207, 734 203" />
      </g>

      {/* Front layer */}
      <g
        filter="url(#chp-wordmark-glow)"
        fill="none"
        stroke="#ffffff"
        strokeWidth="15"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 118 53 C 68 53, 30 83, 30 128 C 30 173, 68 203, 114 203 C 142 203, 162 193, 178 175" />
        <circle cx="222" cy="141" r="33" />
        <line x1="253" y1="92" x2="253" y2="175" />
        <line x1="297" y1="92" x2="297" y2="175" />
        <path d="M 297 111 C 297 94, 335 94, 335 111 L 335 175" />
        <path d="M 335 111 C 335 94, 373 94, 373 111 L 373 175" />
        <line x1="415" y1="92" x2="415" y2="215" />
        <circle cx="446" cy="133" r="39" />
        <line x1="510" y1="92" x2="510" y2="175" />
        <line x1="568" y1="92" x2="568" y2="175" />
        <path d="M 568 111 C 568 94, 606 94, 606 111 L 606 175" />
        <line x1="650" y1="65" x2="650" y2="153" />
        <path d="M 650 151 C 650 166, 663 172, 678 166" />
        <line x1="629" y1="102" x2="678" y2="102" />
        <line x1="710" y1="92" x2="710" y2="175" />
        <line x1="741" y1="92" x2="766" y2="175" />
        <path d="M 794 92 L 766 175 C 760 194, 745 200, 730 196" />
      </g>

      {/* Blue accents — circle inside the C, squares above both i's */}
      <circle cx="86" cy="132" r="16" fill="#4c8bf5" filter="url(#chp-wordmark-glow)" />
      <rect
        x="242"
        y="60"
        width="18"
        height="18"
        rx="4"
        fill="#4c8bf5"
        transform="rotate(10 251 69)"
        filter="url(#chp-wordmark-glow)"
      />
      <rect
        x="500"
        y="60"
        width="18"
        height="18"
        rx="4"
        fill="#4c8bf5"
        transform="rotate(10 509 69)"
        filter="url(#chp-wordmark-glow)"
      />
    </svg>
  )
}

export default function Logo({ className = 'w-8 h-8', withWordmark = false, light = false, premium = false }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <img
        src="/logo.png"
        alt="Campinity"
        className={`${className} object-contain`}
        width={512}
        height={512}
        decoding="async"
      />
      {withWordmark &&
        (premium ? (
          <WordmarkSVG />
        ) : (
          <span
            className={`font-display font-bold text-lg tracking-tight transition-colors duration-300 ${
              light ? 'text-white' : 'text-ink'
            }`}
          >
            Campinity
          </span>
        ))}
    </div>
  )
}
