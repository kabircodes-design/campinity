import { forwardRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'

const PasswordInput = forwardRef(function PasswordInput(
  { label, id, error, hint, className = '', containerClassName = '', ...props },
  ref
) {
  const [visible, setVisible] = useState(false)
  const errorId = error ? `${id}-error` : undefined
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div className={`w-full ${containerClassName}`}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-soft mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          className={`w-full rounded-xl2 border bg-bg pl-4 pr-12 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none transition-colors duration-200 focus:ring-4 focus:ring-accent-tint ${
            error ? 'border-red-400 focus:border-red-500' : 'border-line focus:border-accent'
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={0}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-ink-faint hover:text-ink-soft transition-colors duration-200"
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[12.5px] text-ink-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[12.5px] text-red-500">
          {error}
        </p>
      )}
    </div>
  )
})

export default PasswordInput
