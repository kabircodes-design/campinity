// Android hardware Back: the pure rules (backNavigation.js) and the real
// hook (useAndroidBackButton.js) with the Capacitor App plugin mocked.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

const SRC = vi.hoisted(() => process.env.SRC_DIR) // absolute path to ../src, set in vitest.config.mjs
const mocks = vi.hoisted(() => ({
  native: true,
  listeners: [],
  removed: 0,
  minimizeApp: vi.fn(() => Promise.resolve()),
  exitApp: vi.fn(() => Promise.resolve())
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native } }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event, fn) => {
      const entry = { event, fn }
      mocks.listeners.push(entry)
      return Promise.resolve({
        remove: () => {
          mocks.removed++
          mocks.listeners = mocks.listeners.filter((l) => l !== entry)
        }
      })
    },
    minimizeApp: mocks.minimizeApp,
    exitApp: mocks.exitApp
  }
}))

const { resolveBackAction, getLogicalParent } = await import(`${SRC}/navigation/backNavigation.js`)
const { useAndroidBackButton } = await import(`${SRC}/navigation/useAndroidBackButton.js`)
const { useBackToClose, pushOverlay, closeTopOverlay, openOverlayCount } = await import(`${SRC}/navigation/overlayBackStack.js`)

describe('resolveBackAction', () => {
  test.each(['/home', '/', '/login', '/signup', '/verify-email', '/campus-verification', '/create-profile'])('%s exits the app', (path) => {
    expect(resolveBackAction(path, 5)).toEqual({ type: 'exit' })
  })
  test.each(['/communities', '/marketplace', '/messages', '/profile'])('main tab %s goes to Home', (path) => {
    expect(resolveBackAction(path, 3)).toEqual({ type: 'navigate', to: '/home', replace: true })
  })
  test('nested screen with in-app history goes back to where the user came from', () => {
    expect(resolveBackAction('/progress', 2)).toEqual({ type: 'history' })
    expect(resolveBackAction('/messages/abc', 1)).toEqual({ type: 'history' })
  })
  test('not a blanket "go Home": without history, nested screens go to their parent', () => {
    expect(resolveBackAction('/messages/abc', 0)).toEqual({ type: 'navigate', to: '/messages', replace: true })
    expect(resolveBackAction('/messages/requests', 0).to).toBe('/messages')
    expect(resolveBackAction('/profile/edit', 0).to).toBe('/profile')
    expect(resolveBackAction('/progress', 0).to).toBe('/profile')
  })
})

describe('getLogicalParent', () => {
  test.each([
    ['/messages/abc', '/messages'],
    ['/messages/requests', '/messages'],
    ['/messages/abc/info', '/messages/abc'],
    ['/settings', '/profile'],
    ['/settings/appearance', '/settings'],
    ['/profile/edit', '/profile'],
    ['/followers', '/profile'],
    ['/following/kabir', '/profile'],
    ['/saved', '/profile'],
    ['/saved/collection/c1', '/saved'],
    ['/progress', '/profile'],
    ['/badges', '/profile'],
    ['/reputation', '/profile'],
    ['/leaderboard', '/progress'],
    ['/community/c1', '/communities'],
    ['/community/c1/settings', '/community/c1'],
    ['/club/k1', '/communities'],
    ['/marketplace/p1', '/marketplace'],
    ['/marketplace/create', '/marketplace'],
    ['/notifications/n1', '/notifications'],
    ['/post/p1', '/home'],
    ['/create', '/home'],
    ['/radar', '/home']
  ])('%s -> %s', (path, parent) => {
    expect(getLogicalParent(path)).toBe(parent)
  })
})

describe('useAndroidBackButton', () => {
  function Harness() {
    useAndroidBackButton()
    const location = useLocation()
    const navigate = useNavigate()
    return (
      <>
        <output data-testid="loc">{location.pathname}</output>
        <button type="button" data-testid="go-progress" onClick={() => navigate('/progress')} />
        <button type="button" data-testid="go-chat" onClick={() => navigate('/messages/abc')} />
      </>
    )
  }
  const renderAt = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Harness />} />
        </Routes>
      </MemoryRouter>
    )
  const loc = () => screen.getByTestId('loc').textContent
  const pressBack = async () => {
    await act(async () => {
      mocks.listeners.filter((l) => l.event === 'backButton').forEach((l) => l.fn({ canGoBack: true }))
      await Promise.resolve()
    })
  }
  const settle = () => act(async () => { await Promise.resolve() })

  beforeEach(() => {
    mocks.native = true
    mocks.listeners = []
    mocks.removed = 0
    mocks.minimizeApp.mockClear()
    mocks.exitApp.mockClear()
    window.history.replaceState(null, '')
  })
  afterEach(() => cleanup())

  test('registers exactly one listener, and keeps it across navigation', async () => {
    renderAt('/home')
    await settle()
    expect(mocks.listeners.filter((l) => l.event === 'backButton')).toHaveLength(1)
    act(() => screen.getByTestId('go-progress').click())
    await settle()
    expect(mocks.listeners).toHaveLength(1)
    expect(mocks.removed).toBe(0)
  })

  test('removes its listener on unmount', async () => {
    renderAt('/home')
    await settle()
    cleanup()
    await settle()
    expect(mocks.listeners).toHaveLength(0)
    expect(mocks.removed).toBe(1)
  })

  test('Back on Home sends the app to the background', async () => {
    renderAt('/home')
    await settle()
    await pressBack()
    expect(mocks.minimizeApp).toHaveBeenCalledTimes(1)
    expect(loc()).toBe('/home')
  })

  test('Back on a main tab goes to Home', async () => {
    renderAt('/messages')
    await settle()
    await pressBack()
    expect(loc()).toBe('/home')
    expect(mocks.minimizeApp).not.toHaveBeenCalled()
  })

  test('Back from a chat opened via deep link (no history) goes to Messages', async () => {
    renderAt('/messages/abc')
    await settle()
    await pressBack()
    expect(loc()).toBe('/messages')
  })

  test('an open sheet closes first; Back navigates only once nothing is open', async () => {
    function SheetHarness() {
      useAndroidBackButton()
      const location = useLocation()
      const [open, setOpen] = useState(true)
      useBackToClose(open, () => setOpen(false))
      return (
        <>
          <output data-testid="loc">{location.pathname}</output>
          <output data-testid="sheet">{open ? 'open' : 'closed'}</output>
        </>
      )
    }
    render(
      <MemoryRouter initialEntries={['/messages']}>
        <Routes>
          <Route path="*" element={<SheetHarness />} />
        </Routes>
      </MemoryRouter>
    )
    await settle()
    await pressBack()
    expect(screen.getByTestId('sheet').textContent).toBe('closed')
    expect(loc()).toBe('/messages') // page untouched
    expect(openOverlayCount()).toBe(0)
    await pressBack()
    expect(loc()).toBe('/home')
  })

  test('stacked overlays close top-most first', () => {
    const closed = []
    const releaseA = pushOverlay(() => closed.push('A'))
    const releaseB = pushOverlay(() => closed.push('B'))
    expect(closeTopOverlay()).toBe(true)
    expect(closed).toEqual(['B'])
    releaseB()
    expect(closeTopOverlay()).toBe(true)
    expect(closed).toEqual(['B', 'A'])
    releaseA()
    expect(closeTopOverlay()).toBe(false)
  })

  test('web: never registers anything', async () => {
    mocks.native = false
    renderAt('/home')
    await settle()
    expect(mocks.listeners).toHaveLength(0)
  })
})
