const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Individual password rules, exposed separately so the strength meter can render each one. */
export const passwordRules = [
  { id: 'length', label: '8+ characters', test: (v) => v.length >= 8 },
  { id: 'uppercase', label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'Lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'Number', test: (v) => /[0-9]/.test(v) },
  { id: 'special', label: 'Special character', test: (v) => /[^A-Za-z0-9]/.test(v) }
]

export function getPasswordChecks(password = '') {
  return passwordRules.map((rule) => ({ ...rule, passed: rule.test(password) }))
}

export function getPasswordScore(password = '') {
  return getPasswordChecks(password).filter((c) => c.passed).length
}

export function isPasswordValid(password = '') {
  return getPasswordScore(password) === passwordRules.length
}

export function validateEmail(value = '') {
  if (!value.trim()) return 'Email is required'
  if (!EMAIL_PATTERN.test(value.trim())) return 'Enter a valid email address'
  return ''
}

export function validateName(value = '') {
  if (!value.trim()) return 'Full name is required'
  if (value.trim().length < 2) return 'Name is too short'
  return ''
}

export function validateLoginPassword(value = '') {
  if (!value) return 'Password is required'
  return ''
}

export function validateSignupPassword(value = '') {
  if (!value) return 'Password is required'
  if (!isPasswordValid(value)) return 'Password does not meet all requirements'
  return ''
}

export function validateConfirmPassword(password = '', confirm = '') {
  if (!confirm) return 'Confirm your password'
  if (password !== confirm) return 'Passwords do not match'
  return ''
}

export function validateLoginForm({ email, password }) {
  return {
    email: validateEmail(email),
    password: validateLoginPassword(password)
  }
}

export function validateSignupForm({ fullName, email, password, confirmPassword }) {
  return {
    fullName: validateName(fullName),
    email: validateEmail(email),
    password: validateSignupPassword(password),
    confirmPassword: validateConfirmPassword(password, confirmPassword)
  }
}

export function validateForgotPasswordForm({ email }) {
  return {
    email: validateEmail(email)
  }
}

/** True when every field in an errors map is empty. */
export function isFormValid(errors) {
  return Object.values(errors).every((message) => !message)
}
