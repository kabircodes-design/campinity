import { useMemo } from 'react'
import { getPasswordChecks, getPasswordScore, passwordRules } from '../validation/authValidation.js'

const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']

/**
 * Derives a live strength reading from a password string.
 * Pure/derived state — no internal state of its own, so it never goes
 * stale relative to the field it's reading from.
 */
export function usePasswordStrength(password = '') {
  return useMemo(() => {
    const checks = getPasswordChecks(password)
    const score = getPasswordScore(password)
    const percent = Math.round((score / passwordRules.length) * 100)
    return {
      checks,
      score,
      percent,
      label: password ? LABELS[Math.min(score, LABELS.length - 1)] : '',
      isValid: score === passwordRules.length
    }
  }, [password])
}
