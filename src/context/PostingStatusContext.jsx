import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const PostingStatusContext = createContext(null)

/**
 * Global, lightweight posting-status context — separate from
 * PostsProvider (usePosts.jsx), which is confirmed dead-for-this-
 * purpose: it's a dummy-data-only store seeded from dummyFeed.js,
 * never touched by the real, Firebase-backed HomePage.jsx feed. This
 * context is new, self-contained, and deliberately not built on top
 * of that unrelated provider.
 *
 * Survives navigation because it's mounted once in main.jsx, above
 * <App/> and its <Routes/> — exactly the same reason ThemeProvider/
 * PostsProvider already survive route changes.
 *
 * Shape: { status: 'idle'|'posting'|'success'|'error', message,
 * newPost (the real post object once created, for optimistic feed
 * insertion), error }. No Redux/Zustand — plain useState + Context,
 * per the explicit instruction.
 */
export function PostingStatusProvider({ children }) {
  const [state, setState] = useState({ status: 'idle', message: '', newPost: null, error: null })

  const startPosting = useCallback((message = 'Posting…') => {
    setState({ status: 'posting', message, newPost: null, error: null })
  }, [])

  const markSuccess = useCallback((newPost, message = 'Posted') => {
    setState({ status: 'success', message, newPost, error: null })
  }, [])

  const markError = useCallback((message = "Couldn't post") => {
    setState((prev) => ({ status: 'error', message, newPost: null, error: message, draft: prev.draft }))
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle', message: '', newPost: null, error: null })
  }, [])

  const value = useMemo(
    () => ({ ...state, startPosting, markSuccess, markError, reset }),
    [state, startPosting, markSuccess, markError, reset]
  )

  return <PostingStatusContext.Provider value={value}>{children}</PostingStatusContext.Provider>
}

export function usePostingStatus() {
  const context = useContext(PostingStatusContext)
  if (!context) {
    throw new Error('usePostingStatus must be used within a PostingStatusProvider')
  }
  return context
}
