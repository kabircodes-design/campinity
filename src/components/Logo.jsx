import { useTheme } from '../theme/useTheme.js'

/**
 * Centralized brand component — the single source every place that
 * renders Campinity's icon and/or wordmark should import, rather than
 * duplicating <img> tags per-file.
 *
 * Brand switching is automatic and driven entirely by the existing
 * theme system (useTheme()'s resolvedIsDark, already computed from
 * mode + system preference): dark mode renders the white wordmark +
 * dark-mode logo variant; light mode renders the black wordmark +
 * light-mode logo variant. No manual prop needed to control this, and
 * no duplicated switching logic anywhere else — every consumer just
 * renders <Logo withWordmark /> and gets the correct pair for
 * whatever theme is currently active.
 */
export default function Logo({ className = 'w-8 h-8', withWordmark = false }) {
  const { resolvedIsDark } = useTheme()

  const logoSrc = resolvedIsDark ? '/logo-dark.webp' : '/logo-light.webp'
  const wordmarkSrc = resolvedIsDark ? '/wordmark-dark.webp' : '/wordmark-light.webp'

  return (
    <div className="flex items-center gap-3 select-none">
      <img
        src={logoSrc}
        alt="Campinity"
        className={`${className} object-contain flex-shrink-0`}
        decoding="async"
      />
      {withWordmark && (
        <img
          src={wordmarkSrc}
          alt="Campinity"
          className="chp-wordmark-asset"
          decoding="async"
        />
      )}
    </div>
  )
}
