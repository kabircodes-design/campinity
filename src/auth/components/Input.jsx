import { forwardRef } from 'react'

const Input = forwardRef(function Input(
  { label, id, error, hint, className = '', containerClassName = '', ...props },
  ref
) {
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div className={`w-full ${containerClassName}`}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-soft dark:text-gray-400 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={!!error}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        className={`w-full rounded-xl2 border bg-bg dark:bg-white/5 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint dark:text-gray-50 dark:placeholder:text-gray-500 outline-none transition-colors duration-200 focus:ring-4 focus:ring-accent-tint dark:focus:ring-blue-500/15 ${
          error ? 'border-red-400 focus:border-red-500 dark:border-red-500/60' : 'border-line dark:border-white/10 focus:border-accent'
        } ${className}`}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-ink-faint dark:text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[12.5px] text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
})

export default Input
