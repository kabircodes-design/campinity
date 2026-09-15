export default function Divider({ label = 'or' }) {
  return (
    <div className="flex items-center gap-3 my-6" role="separator">
      <span className="h-px flex-1 bg-lineSoft dark:bg-white/10" />
      <span className="font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint dark:text-gray-500">{label}</span>
      <span className="h-px flex-1 bg-lineSoft dark:bg-white/10" />
    </div>
  )
}
