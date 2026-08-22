export default function Divider({ label = 'or' }) {
  return (
    <div className="flex items-center gap-3 my-6" role="separator">
      <span className="h-px flex-1 bg-lineSoft" />
      <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">{label}</span>
      <span className="h-px flex-1 bg-lineSoft" />
    </div>
  )
}
