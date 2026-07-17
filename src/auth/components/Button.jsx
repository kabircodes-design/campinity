import Loader from './Loader.jsx'

const variants = {
  primary: 'bg-ink text-white hover:bg-accent-deep',
  secondary: 'border border-line bg-surface text-ink hover:border-ink/30'
}

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  loading = false,
  disabled = false,
  icon = null,
  className = '',
  ...props
}) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-semibold px-6 py-3.5 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader size="sm" tone={variant === 'primary' ? 'light' : 'dark'} />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
