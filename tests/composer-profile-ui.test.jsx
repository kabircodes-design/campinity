// Post composer improvements + Edit Profile unsaved-changes guard — the real
// pages with Firebase-backed services mocked. Existing post schema / upload
// path are asserted unchanged.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const m = vi.hoisted(() => ({ calls: [], uploadFails: false }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: { currentUser: { uid: 'u1' } }, db: {}, storage: {}, default: {} }))
vi.mock(`${SRC}/theme/useTheme.js`, () => ({ useTheme: () => ({ mode: 'light', resolvedIsDark: false, setMode: () => {}, theme: { id: 'default' } }) }))
vi.mock(`${SRC}/firebase/profileService.js`, () => ({
  getUserProfile: async () => ({ uid: 'u1', displayName: 'Asha Rao', username: 'asha', collegeId: 'c1', verifiedCampus: true, bio: 'Hi', course: 'CSE', year: '2nd Year', skills: ['js'], interests: ['music'] }),
  updateUserProfile: async (...a) => m.calls.push(['updateUserProfile', ...a])
}))
vi.mock(`${SRC}/firebase/postService.js`, () => ({
  computeExpiresAt: () => null,
  getAvatarColor: () => 'from-blue-500 to-indigo-500',
  getInitials: (n) => (n || '?').slice(0, 2).toUpperCase(),
  createPost: async (args) => {
    m.calls.push(['createPost', args])
    return 'p1'
  },
  uploadPostImage: async (uid, file, opts) => {
    m.calls.push(['uploadPostImage', uid, file.name, typeof opts?.onProgress])
    opts?.onProgress?.(40)
    if (m.uploadFails) throw new Error('storage/unauthorized')
    opts?.onProgress?.(100)
    return 'https://img.test/p.jpg'
  }
}))
vi.mock(`${SRC}/firebase/documentService.js`, () => ({ uploadDocument: async () => ({}) }))
vi.mock(`${SRC}/firebase/communityService.js`, () => ({ getUserCommunityMemberships: async () => [], getCommunityById: async () => null, getCommunityChannels: async () => [] }))
vi.mock(`${SRC}/firebase/notificationService.js`, () => ({ createMentionNotification: async () => {} }))
vi.mock(`${SRC}/firebase/engagementService.js`, () => ({ searchUsersForMention: async () => [] }))
vi.mock(`${SRC}/gamification/xpService.js`, () => ({ awardXP: async () => {}, getUserProgress: async () => ({}), hasReachedDailyCap: async () => false }))
vi.mock(`${SRC}/gamification/badgeService.js`, () => ({ checkAndAwardBadges: async () => [] }))
vi.mock(`${SRC}/access/useMyVerification.js`, () => ({ useMyVerification: () => true }))
vi.mock(`${SRC}/data/dummyColleges.js`, () => ({ getCollegeById: async () => ({ id: 'c1', name: 'North Campus' }) }))
vi.mock(`${SRC}/firebase/usernameService.js`, async (orig) => ({ ...(await orig()), checkUsernameAvailable: async () => true, reserveUsername: async () => 'asha' }))

const { MemoryRouter, Route, Routes, useLocation } = await import('react-router-dom')
const { PostingStatusProvider, usePostingStatus } = await import(`${SRC}/context/PostingStatusContext.jsx`)
const { default: CreatePostPage } = await import(`${SRC}/pages/CreatePostPage.jsx`)
const { default: EditProfilePage } = await import(`${SRC}/pages/EditProfilePage.jsx`)

function Status() {
  const { status, message } = usePostingStatus()
  const loc = useLocation()
  return <p data-testid="status">{`${loc.pathname}|${status}|${message}`}</p>
}
const renderPage = (el, path) =>
  render(
    <PostingStatusProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={el} />
          <Route path="*" element={<Status />} />
        </Routes>
      </MemoryRouter>
    </PostingStatusProvider>
  )
const file = (name, type, size) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

beforeEach(() => {
  m.calls = []
  m.uploadFails = false
  localStorage.clear()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview')
  globalThis.URL.revokeObjectURL = vi.fn()
})
afterEach(cleanup)

describe('post composer', () => {
  async function open() {
    renderPage(<CreatePostPage />, '/create')
    return screen.findByPlaceholderText(/What's happening on campus/)
  }

  test('text-only post publishes through the existing createPost with the same schema', async () => {
    const box = await open()
    fireEvent.change(box, { target: { value: 'Study group at 6 #exams' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1))
    await waitFor(() => expect(m.calls.some((c) => c[0] === 'createPost')).toBe(true))
    const post = m.calls.find((c) => c[0] === 'createPost')[1]
    expect(post).toMatchObject({ uid: 'u1', text: 'Study group at 6 #exams', imageUrl: null, author: { displayName: 'Asha Rao', username: 'asha' } })
    expect(post.extra.hashtags).toEqual(['exams'])
  })

  test('live preview shows the post as it will appear (text, author, photo)', async () => {
    const box = await open()
    fireEvent.change(box, { target: { value: 'Preview me @someone' } })
    fireEvent.change(document.querySelector('input[type=file][accept="image/*"]'), { target: { files: [file('a.jpg', 'image/jpeg', 2e6)] } })
    fireEvent.click(screen.getByRole('button', { name: 'Show preview' }))
    const preview = screen.getByRole('region', { name: 'Post preview' })
    expect(preview.textContent).toContain('Asha Rao')
    expect(preview.textContent).toContain('Preview me')
    expect(preview.querySelector('img[src="blob:preview"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide preview' }))
    expect(screen.queryByRole('region', { name: 'Post preview' })).toBeNull()
  })

  test('rejects unsupported and oversized photos before upload', async () => {
    await open()
    const input = document.querySelector('input[type=file][accept="image/*"]')
    fireEvent.change(input, { target: { files: [file('doc.pdf', 'application/pdf', 1000)] } })
    expect(await screen.findByText(/file type isn’t supported/)).toBeTruthy()
    fireEvent.change(input, { target: { files: [file('big.jpg', 'image/jpeg', 12 * 1024 * 1024)] } })
    expect(await screen.findByText(/the limit is 10 MB/)).toBeTruthy()
    expect(screen.queryByAltText('Selected preview')).toBeNull()
  })

  test('photo post: same upload function and path owner, with progress shown in the posting status', async () => {
    const box = await open()
    fireEvent.change(box, { target: { value: 'Sunset at the quad' } })
    fireEvent.change(document.querySelector('input[type=file][accept="image/*"]'), { target: { files: [file('sun.jpg', 'image/jpeg', 2e6)] } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1))
    await waitFor(() => expect(m.calls.some((c) => c[0] === 'createPost')).toBe(true))
    expect(m.calls.find((c) => c[0] === 'uploadPostImage')).toEqual(['uploadPostImage', 'u1', 'sun.jpg', 'function'])
    expect(m.calls.find((c) => c[0] === 'createPost')[1].imageUrl).toBe('https://img.test/p.jpg')
  })

  test('upload failure is reported, never "Posted"', async () => {
    m.uploadFails = true
    const box = await open()
    fireEvent.change(box, { target: { value: 'Will fail' } })
    fireEvent.change(document.querySelector('input[type=file][accept="image/*"]'), { target: { files: [file('x.jpg', 'image/jpeg', 2e6)] } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Publish' }).at(-1))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toMatch(/\|error\|/))
    expect(m.calls.some((c) => c[0] === 'createPost')).toBe(false)
  })

  test('Ctrl+Enter publishes; the counter warns near the limit', async () => {
    const box = await open()
    fireEvent.change(box, { target: { value: 'x'.repeat(460) } })
    expect(screen.getByText('40 left')).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(m.calls.some((c) => c[0] === 'createPost')).toBe(true))
  })
})

describe('edit profile — unsaved changes', () => {
  test('leaving with edits asks first; keep editing stays; discard leaves without saving', async () => {
    renderPage(<EditProfilePage />, '/profile/edit')
    const nameInput = await screen.findByDisplayValue('Asha Rao')
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
    await waitFor(() => expect(screen.getByTestId('status').textContent).toMatch(/^\/profile\|/))
    cleanup()
    renderPage(<EditProfilePage />, '/profile/edit')
    fireEvent.change(await screen.findByDisplayValue('Asha Rao'), { target: { value: 'Asha R.' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
    expect(screen.getByText('Discard your changes?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByDisplayValue('Asha R.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toMatch(/^\/profile\|/))
    expect(m.calls.some((c) => c[0] === 'updateUserProfile')).toBe(false)
    expect(nameInput).toBeTruthy()
  })
})
