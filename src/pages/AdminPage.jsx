import { ShieldCheck } from 'lucide-react'

/**
 * Placeholder only — role gating (role === 'admin') is already enforced by
 * ProtectedRoute(stage="admin") before this component ever renders, so no
 * auth logic lives here. Real admin tooling (verification review, role
 * management, moderation) is future work per the spec.
 */
export default function AdminPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-accent-tint flex items-center justify-center mx-auto text-accent">
          <ShieldCheck className="w-6 h-6" strokeWidth={1.7} />
        </div>
        <h1 className="mt-4 font-display font-bold text-xl text-ink">Admin console</h1>
        <p className="mt-2 text-sm text-ink-soft leading-relaxed">
          Structure is in place — verification review, role management and moderation tools land here next.
        </p>
      </div>
    </div>
  )
}