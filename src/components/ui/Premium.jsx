/**
 * Campinity premium UI primitives — the same visual language as Edit
 * Profile (rounded-3xl cards, icon tiles, focus rings, full dark mode), so
 * every redesigned page looks and behaves consistently.
 */
import { ChevronRight } from 'lucide-react'

const TONES = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  slate: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
}

export function IconTile({ icon: Icon, tone = 'blue', size = 'md' }) {
  const box = size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-9 h-9 rounded-xl'
  const ico = size === 'lg' ? 'w-6 h-6' : 'w-[18px] h-[18px]'
  return (
    <span className={`${box} ${TONES[tone] || TONES.blue} flex items-center justify-center flex-shrink-0`} aria-hidden="true">
      <Icon className={ico} strokeWidth={2} />
    </span>
  )
}

export function Card({ children, className = '', as: Tag = 'section', ...rest }) {
  return (
    <Tag className={`rounded-3xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#11131a] shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/** Card with a titled header (icon + title + hint), like Edit Profile sections. */
export function SectionCard({ icon, tone, title, hint, children, className = '', bodyClassName = '' }) {
  return (
    <Card className={`p-4 sm:p-5 ${className}`}>
      {(title || icon) && (
        <header className="flex items-start gap-3 mb-3">
          {icon && <IconTile icon={icon} tone={tone} />}
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h2>}
            {hint && <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug">{hint}</p>}
          </div>
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </Card>
  )
}

/** A tappable or static row inside a card list. */
export function ListRow({ icon, tone, title, description, trailing, onClick, href, chevron = Boolean(onClick || href), className = '' }) {
  const inner = (
    <>
      {icon && <IconTile icon={icon} tone={tone} />}
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[14.5px] font-semibold text-gray-900 dark:text-gray-50 truncate">{title}</span>
        {description && <span className="block text-[12.5px] text-gray-500 dark:text-gray-400 leading-snug">{description}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" aria-hidden="true" />}
    </>
  )
  const cls = `w-full flex items-center gap-3 px-4 py-3.5 min-h-[60px] ${onClick || href ? 'hover:bg-gray-50 dark:hover:bg-white/[0.03] active:bg-gray-100 dark:active:bg-white/[0.05] transition-colors duration-150' : ''} ${className}`
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

/** Rows grouped in one card with hairline dividers. */
export function RowGroup({ children, label, className = '' }) {
  return (
    <div className={className}>
      {label && <h2 className="px-1 pb-2 text-[11.5px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.08em]">{label}</h2>}
      <Card className="overflow-hidden divide-y divide-gray-100 dark:divide-white/10">{children}</Card>
    </div>
  )
}

/** Accessible switch (role="switch"); 44px touch target. */
export function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative flex-shrink-0 w-12 h-11 flex items-center justify-center disabled:opacity-50 focus-visible:outline-none group"
    >
      <span className={`relative w-11 h-6 rounded-full transition-colors duration-200 group-focus-visible:ring-4 group-focus-visible:ring-blue-500/25 ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-white/15'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

export function EmptyState({ icon: Icon, title, body, action, className = '' }) {
  return (
    <div className={`py-12 px-6 text-center animate-[fadeIn_220ms_ease] ${className}`}>
      {Icon && (
        <span className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center" aria-hidden="true">
          <Icon className="w-6 h-6" strokeWidth={1.8} />
        </span>
      )}
      <p className="mt-4 text-[16px] font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</p>
      {body && <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Soft gradient hero used at the top of feature pages. */
export function PageHero({ icon, eyebrow, title, subtitle, children }) {
  return (
    <Card className="relative overflow-hidden p-5 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-500/10 dark:via-[#11131a] dark:to-indigo-500/10">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" aria-hidden="true" />
      <div className="relative flex items-start gap-3">
        {icon && <IconTile icon={icon} size="lg" />}
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-400">{eyebrow}</p>}
          <h1 className="text-[22px] leading-tight font-bold tracking-tight text-gray-900 dark:text-gray-50">{title}</h1>
          {subtitle && <p className="mt-1 text-[13.5px] text-gray-600 dark:text-gray-300 leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </Card>
  )
}

export const primaryPill =
  'h-11 px-5 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-sm shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 inline-flex items-center justify-center gap-2'
export const secondaryPill =
  'h-11 px-5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-gray-700 dark:text-gray-200 text-sm font-semibold hover:border-gray-300 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 inline-flex items-center justify-center gap-2'

/** Announced toast that sits above the bottom navigation. */
export function Toast({ message, tone = 'neutral' }) {
  if (!message) return null
  const cls = tone === 'error' ? 'bg-red-600' : 'bg-gray-900 dark:bg-white dark:text-gray-900'
  return (
    <div role="status" aria-live="polite" className={`fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[999] rounded-full ${cls} text-white text-[13px] font-semibold px-4 py-2.5 shadow-lg animate-[fadeIn_180ms_ease]`}>
      {message}
    </div>
  )
}
