import { useCallback, useMemo, useState } from 'react'
import { isFormValid } from '../validation/authValidation.js'

/**
 * @param {Object} config
 * @param {Object} config.initialValues - field name -> initial string value
 * @param {Object} config.sanitizers - field name -> (value) => sanitizedValue
 * @param {(values: Object) => Object} config.validate - returns an errors map
 */
export function useAuthForm({ initialValues, sanitizers = {}, validate }) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const errors = useMemo(() => validate(values), [values, validate])
  const valid = useMemo(() => isFormValid(errors), [errors])

  const handleChange = useCallback(
    (field) => (event) => {
      const raw = event.target.value
      const sanitize = sanitizers[field]
      const next = sanitize ? sanitize(raw) : raw
      setValues((prev) => ({ ...prev, [field]: next }))
      if (submitError) setSubmitError('')
    },
    [sanitizers, submitError]
  )

  const handleBlur = useCallback(
    (field) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }))
    },
    []
  )

  const touchAll = useCallback(() => {
    const allTouched = Object.keys(initialValues).reduce((acc, key) => {
      acc[key] = true
      return acc
    }, {})
    setTouched(allTouched)
  }, [initialValues])

  /**
   * Wraps a submit handler with duplicate-submission protection and a
   * loading/error lifecycle. `onValid` receives the sanitized values and
   * should return a promise — this is where a real Firebase call will
   * plug in later without touching any of the surrounding UI.
   */
  const handleSubmit = useCallback(
    (onValid) => async (event) => {
      event.preventDefault()
      touchAll()

      if (!valid || isSubmitting) return

      setIsSubmitting(true)
      setSubmitError('')
      setSubmitSuccess(false)

      try {
        await onValid(values)
        setSubmitSuccess(true)
      } catch (err) {
        setSubmitError(err?.message || 'Something went wrong. Please try again.')
      } finally {
        setIsSubmitting(false)
      }
    },
    [valid, isSubmitting, values, touchAll]
  )

  const fieldError = useCallback(
    (field) => (touched[field] ? errors[field] : ''),
    [touched, errors]
  )

  return {
    values,
    setValues,
    errors,
    fieldError,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isValid: valid,
    isSubmitting,
    submitError,
    submitSuccess
  }
}
