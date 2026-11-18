import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Inbox, RefreshCw, X } from 'lucide-react'
import { useBackToClose } from '../../navigation/overlayBackStack.js'

/**
 * Shared Admin Control Center primitives. Built on the app's existing
 * Tailwind vocabulary (bg-white, text-gray-*, border-gray-*), which the
 * theme layer remaps for Dark Mode — so the admin panel follows the
 * existing palette in both modes without its own colour system.
 */

// ---------- formatting (never invents values) ----------
export const fmtNumber = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : null)

export function fmtRelative(ms, now = Date.now()) {
  if (!ms) return '—'
  const s = Math.round((now - ms) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fmtDateTime = (ms) =>
  ms ? new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export function fmtDuration(ms) {
  if (ms === null || ms === undefined) return '—'
  const h = Math.floor(ms / 3600000)
  if (h < 1) return `${Math.max(1, Math.round(ms / 60000))} min`
  if (h < 48) return `${h} h`
  return `${Math.floor(h / 24)} days`
}

// ---------- layout ----------
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, action, children, className = '', padded = true }) {
  return (
    <section className={`rounded-2xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

/** KPI stat tile. `value` null => "Unavailable" with the reason, never a fake 0. */
export function StatTile({ label, value, hint, icon: Icon, tone = 'blue', onClick, unavailableReason }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-100 text-gray-600'
  }
  const Wrapper = onClick ? 'button' : 'div'
  const formatted = fmtNumber(value)
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`group text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        onClick ? 'hover:border-blue-200 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-h-[32px]">
        <p className="text-[12.5px] font-medium text-gray-500">{label}</p>
        {Icon && (
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${tones[tone] || tones.blue}`}>
            <Icon className="w-4 h-4" strokeWidth={2} />
          </span>
        )}
      </div>
      {formatted !== null ? (
        <p className="mt-2 text-[26px] font-bold tracking-tight text-gray-900 tabular-nums leading-none">{formatted}</p>
      ) : (
        <p className="mt-2 text-sm font-semibold text-gray-400" title={unavailableReason || 'Could not be measured'}>
          Unavailable
        </p>
      )}
      {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </Wrapper>
  )
}

export function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600'
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone] || tones.gray}`}>{children}</span>
}

export function Skeleton({ className = '' }) {
  return <div className={`rounded-lg bg-gray-100 animate-pulse ${className}`} aria-hidden="true" />
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="py-12 px-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-900">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="py-10 px-6 text-center" role="alert">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-gray-900">Couldn't load this</p>
      <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto break-words">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:border-gray-300"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  )
}

export function Button({ children, variant = 'secondary', className = '', ...rest }) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-gray-200 text-gray-700 hover:border-gray-300 bg-white',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-gray-600 hover:bg-gray-100'
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Confirmation for every destructive/irreversible admin action. */
export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', tone = 'primary', busy = false, onConfirm, onCancel }) {
  useBackToClose(open, () => !busy && onCancel?.())
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
      <button type="button" aria-label="Close dialog" tabIndex={-1} className="absolute inset-0 bg-black/40" onClick={() => !busy && onCancel?.()} />
      <div className="relative w-full max-w-[400px] rounded-2xl bg-white p-5 shadow-xl">
        <p id="admin-confirm-title" className="text-[15px] font-semibold text-gray-900">{title}</p>
        {body && <div className="mt-2 text-sm text-gray-500 leading-relaxed">{body}</div>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Right-side panel for investigating a user/report without leaving the list. */
export function Drawer({ open, title, onClose, children, width = 'max-w-[560px]' }) {
  useBackToClose(open, onClose)
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[900] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative h-full w-full ${width} bg-white shadow-2xl flex flex-col`}>
        <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-gray-100 flex-shrink-0">
          <p className="text-[15px] font-semibold text-gray-900 truncate">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500">{k}</dt>
          <dd className="text-gray-900 min-w-0 break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
