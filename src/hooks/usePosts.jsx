import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { posts as seedPosts } from '../data/dummyFeed.js'

const PostsContext = createContext(null)

/**
 * Wraps the app so Create Post, Home Feed, and Post Detail all read/write
 * the same in-memory post list. Seeded once from dummyFeed.js's static
 * `posts` export (never mutated directly — dummyFeed.js stays untouched
 * as a read-only seed). This is a client-only, session-lived store; no
 * backend, matching the rest of the project's dummy-data-only scope.
 */
export function PostsProvider({ children }) {
  const [posts, setPosts] = useState(seedPosts)

  const addPost = useCallback((newPost) => {
    setPosts((prev) => [newPost, ...prev])
  }, [])

  const getPostById = useCallback(
    (id) => posts.find((post) => String(post.id) === String(id)),
    [posts]
  )

  const value = useMemo(() => ({ posts, addPost, getPostById }), [posts, addPost, getPostById])

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>
}

export function usePosts() {
  const context = useContext(PostsContext)
  if (!context) {
    throw new Error('usePosts must be used within a PostsProvider')
  }
  return context
}