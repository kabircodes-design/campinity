import { motion } from 'framer-motion'
import Icon from '../../components/Icon.jsx'
import { usePasswordStrength } from '../hooks/usePasswordStrength.js'

const barColors = ['bg-red-400', 'bg-red-400', 'bg-amber-400', 'bg-amber-400', 'bg-emerald-500']

export default function PasswordStrengthMeter({ password }) {
  const { checks, score, percent, label } = usePasswordStrength(password)

  if (!password) return null

  return (
    <div className="mt-3" aria-live="polite">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 h-1.5 rounded-full bg-lineSoft overflow-hidden mr-3">
          <motion.div
            className={`h-full rounded-full ${barColors[Math.max(score - 1, 0)]}`}
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'width' }}
          />
        </div>
        <span className="font-mono text-2xs text-ink-faint whitespace-nowrap">{label}</span>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {checks.map((check) => (
          <li
            key={check.id}
            className={`flex items-center gap-1.5 text-[12px] transition-colors duration-200 ${
              check.passed ? 'text-ink' : 'text-ink-faint'
            }`}
          >
            <span
              className={`flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors duration-200 ${
                check.passed ? 'bg-emerald-500 text-white' : 'bg-lineSoft text-transparent'
              }`}
            >
              <Icon name="check" className="w-2.5 h-2.5" strokeWidth={2.4} />
            </span>
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
