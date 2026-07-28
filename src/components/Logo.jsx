export default function Logo({ className = 'w-8 h-8', withWordmark = false, light = false }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img
        src="/logo.png"
        alt="Campinity"
        className={`${className} object-contain`}
        width={512}
        height={512}
        decoding="async"
      />
      {withWordmark && (
        <span
          className={`font-display font-bold text-lg tracking-tight transition-colors duration-300 ${
            light ? 'text-white' : 'text-ink'
          }`}
        >
          Campinity
        </span>
      )}
    </div>
  )
}