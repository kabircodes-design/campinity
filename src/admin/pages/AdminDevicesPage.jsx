import { useCallback, useEffect, useState } from 'react'
import { Copy, Globe, KeyRound, Plus, ShieldOff, Smartphone } from 'lucide-react'
import { useAdminSession } from '../hooks/useAdminSession.jsx'
import { callAdmin } from '../services/adminCallable.js'
import AdminToast from '../components/AdminToast.jsx'
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, Skeleton, fmtDateTime, fmtRelative } from '../components/ui.jsx'

/**
 * Authorized admin devices (adminListDevices / adminRevokeDevice /
 * adminCreateEnrollmentCode — all device-signed and audited).
 * Revoking takes effect immediately: the device's sessions are deleted
 * and every later call from it is refused.
 */
function CodePanel({ code, expiresAtMs, onDone }) {
  const [left, setLeft] = useState(expiresAtMs - Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setLeft(expiresAtMs - Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [expiresAtMs])
  const expired = left <= 0
  const mm = Math.max(0, Math.floor(left / 60000))
  const ss = String(Math.max(0, Math.floor((left % 60000) / 1000))).padStart(2, '0')
  return (
    <Card title="One-time enrollment code" subtitle="Enter it in CAMPINITY ADMIN on the new device, with your Firebase login and admin password." className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className={`font-mono text-[26px] tracking-[0.18em] ${expired ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{code}</p>
        {!expired && (
          <Button onClick={() => navigator.clipboard?.writeText(code)}>
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-500">{expired ? 'Expired — create a new one if you still need it.' : `Valid for ${mm}:${ss}, single use. Only your account can redeem it. It is not shown again.`}</p>
      <Button variant="ghost" className="mt-3 -ml-2" onClick={onDone}>
        Hide
      </Button>
    </Card>
  )
}

export default function AdminDevicesPage() {
  const { sessionToken, logout } = useAdminSession()
  const [devices, setDevices] = useState(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [confirmCode, setConfirmCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(() => {
    setError('')
    callAdmin('adminListDevices', { sessionToken })
      .then((d) => setDevices(d?.devices || []))
      .catch((err) => setError(err?.message || 'Could not load devices.'))
  }, [sessionToken])
  useEffect(load, [load])

  const revoke = async () => {
    setBusy(true)
    try {
      const res = await callAdmin('adminRevokeDevice', { sessionToken, deviceId: confirm.id })
      setConfirm(null)
      if (res?.revokedCurrent) return logout('This device was revoked. Enroll it again to continue.')
      setToast({ tone: 'success', message: `Revoked "${confirm.label || 'device'}" and ended ${res?.sessionsEnded ?? 0} session(s).` })
      load()
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not revoke. Nothing was changed.' })
    } finally {
      setBusy(false)
    }
  }

  const createCode = async () => {
    setBusy(true)
    try {
      setCode(await callAdmin('adminCreateEnrollmentCode', { sessionToken }))
      setConfirmCode(false)
    } catch (err) {
      setToast({ tone: 'error', message: err?.message || 'Could not create a code.' })
    } finally {
      setBusy(false)
    }
  }

  const active = (devices || []).filter((d) => d.status === 'active')
  return (
    <div>
      <PageHeader
        title="Devices"
        description="Only these devices can open an admin session — even with the correct password."
        actions={
          <Button variant="primary" onClick={() => setConfirmCode(true)}>
            <Plus className="w-3.5 h-3.5" /> Approve a new device
          </Button>
        }
      />
      {code && <CodePanel code={code.code} expiresAtMs={code.expiresAtMs} onDone={() => setCode(null)} />}

      <Card padded={false}>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !devices ? (
          <div className="p-4 space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <EmptyState icon={KeyRound} title="No devices" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {devices.map((d) => {
              const Icon = d.platform === 'android' ? Smartphone : Globe
              return (
                <li key={d.id} className="px-4 py-3.5 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold text-gray-900 truncate">{d.label || 'Unnamed device'}</p>
                      {d.isCurrent && <Badge tone="blue">This device</Badge>}
                      {d.status === 'revoked' ? <Badge tone="rose">Revoked</Badge> : <Badge tone="emerald">Active</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {d.platform === 'android' ? 'Android app' : 'Browser'} · enrolled {fmtDateTime(d.enrolledAtMs)}
                      {d.status === 'active' ? ` · last used ${fmtRelative(d.lastUsedAtMs)}` : d.revokedAtMs ? ` · revoked ${fmtDateTime(d.revokedAtMs)}` : ''}
                    </p>
                    <p className="text-[11px] text-gray-400 font-mono">key {d.fingerprint}</p>
                  </div>
                  {d.status === 'active' && (
                    <Button variant="ghost" onClick={() => setConfirm(d)}>
                      <ShieldOff className="w-3.5 h-3.5" /> Revoke
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.isCurrent ? 'Revoke THIS device?' : `Revoke "${confirm?.label || 'device'}"?`}
        body={
          <>
            Its sessions end immediately and it can never sign in again unless re-enrolled with a new code.
            {confirm?.isCurrent && ' You will be signed out now.'}
            {active.length <= 1 && ' This is your last active device — afterwards only the owner script on your laptop can approve a device.'}
          </>
        }
        confirmLabel="Revoke"
        tone="danger"
        busy={busy}
        onConfirm={revoke}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirmCode}
        title="Create a one-time enrollment code?"
        body="Anyone who has this code AND your Campinity login AND the admin password could authorize a device in the next 10 minutes. Only create it when you're about to enroll your own device."
        confirmLabel="Create code"
        busy={busy}
        onConfirm={createCode}
        onCancel={() => setConfirmCode(false)}
      />
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
