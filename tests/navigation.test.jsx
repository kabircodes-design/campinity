// Main-tab navigation: shared tab order, swipe decision logic, the real
// BottomNav, and the real useTabSwipe hook driven by touch events.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

const SRC = vi.hoisted(() => process.env.SRC_DIR) // absolute path to ../src, set in vitest.config.mjs
const mocks = vi.hoisted(() => ({ unread: 0, unsubscribe: vi.fn(), prefetch: vi.fn() }))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: { currentUser: { uid: 'u1' } }, db: {}, default: {} }))
vi.mock(`${SRC}/firebase/chatService.js`, () => ({
  subscribeToUnreadChatsCount: (uid, cb) => {
    cb(mocks.unread)
    return mocks.unsubscribe
  }
}))
vi.mock(`${SRC}/routePrefetch.js`, () => ({ prefetchRoute: mocks.prefetch }))

const tabs = await import(`${SRC}/navigation/mainTabs.js`)
const gesture = await import(`${SRC}/navigation/swipeGesture.js`)
const { useTabSwipe } = await import(`${SRC}/navigation/useTabSwipe.js`)
const { default: BottomNav } = await import(`${SRC}/components/BottomNav.jsx`)
const rule = await import(`${SRC}/navigation/useCreateButtonVisibility.js`)

const ORDER = ['/home', '/communities', '/marketplace', '/messages', '/profile']

function Probe() {
  const location = useLocation()
  return <output data-testid="loc">{location.pathname}</output>
}
const loc = () => screen.getByTestId('loc').textContent

beforeEach(() => {
  mocks.unread = 0
  mocks.prefetch.mockClear()
  window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 400 })
})
afterEach(() => cleanup())

describe('mainTabs', () => {
  test('one explicit order, Marketplace included, Create Post not a tab', () => {
    expect(tabs.MAIN_TABS.map((t) => t.to)).toEqual(ORDER)
    expect(tabs.MAIN_TABS.map((t) => t.label)).toEqual(['Home', 'Communities', 'Marketplace', 'Messages', 'Profile'])
    expect(tabs.CREATE_POST_PATH).toBe('/create')
  })
  test('adjacent tabs follow that order and stop at both ends', () => {
    expect(tabs.getAdjacentTabPath('/home', 1)).toBe('/communities')
    expect(tabs.getAdjacentTabPath('/home', -1)).toBeNull()
    expect(tabs.getAdjacentTabPath('/messages', 1)).toBe('/profile')
    expect(tabs.getAdjacentTabPath('/profile', 1)).toBeNull()
    expect(tabs.getAdjacentTabPath('/profile', -1)).toBe('/messages')
  })
  test('non-tab routes are not part of swipe navigation', () => {
    expect(tabs.getMainTabIndex('/messages/abc')).toBe(-1)
    expect(tabs.getAdjacentTabPath('/settings', 1)).toBeNull()
  })
})

describe('swipeGesture', () => {
  test('small movement is not classified (taps, jitter)', () => {
    expect(gesture.classifyIntent(6, 3)).toBeNull()
  })
  test('vertical and diagonal movement stays a scroll', () => {
    expect(gesture.classifyIntent(5, 40)).toBe('vertical')
    expect(gesture.classifyIntent(30, 25)).toBe('vertical')
  })
  test('clearly horizontal movement is a swipe', () => {
    expect(gesture.classifyIntent(-40, 8)).toBe('horizontal')
  })
  const base = { viewportWidth: 400, canGoNext: true, canGoPrev: true }
  test('long drag left -> next, right -> previous', () => {
    expect(gesture.resolveSwipe({ ...base, dx: -150, elapsedMs: 600 })).toBe(1)
    expect(gesture.resolveSwipe({ ...base, dx: 150, elapsedMs: 600 })).toBe(-1)
  })
  test('short slow drag snaps back', () => {
    expect(gesture.resolveSwipe({ ...base, dx: -60, elapsedMs: 600 })).toBe(0)
  })
  test('quick flick completes, but a tiny fast twitch does not', () => {
    expect(gesture.resolveSwipe({ ...base, dx: -70, elapsedMs: 90 })).toBe(1)
    expect(gesture.resolveSwipe({ ...base, dx: -30, elapsedMs: 20 })).toBe(0)
  })
  test('cannot go past the first or last tab', () => {
    expect(gesture.resolveSwipe({ ...base, dx: 200, elapsedMs: 300, canGoPrev: false })).toBe(0)
    expect(gesture.resolveSwipe({ ...base, dx: -200, elapsedMs: 300, canGoNext: false })).toBe(0)
    expect(Math.abs(gesture.dragOffset(100, { canGoNext: true, canGoPrev: false }))).toBeLessThan(20)
    expect(gesture.dragOffset(-100, { canGoNext: true, canGoPrev: false })).toBe(-100)
  })

  describe('shouldIgnoreSwipeStart', () => {
    const mount = (html) => {
      const root = document.createElement('div')
      root.innerHTML = html
      document.body.appendChild(root)
      return root
    }
    test('plain content is swipeable', () => {
      const root = mount('<div><p id="t">hello</p></div>')
      expect(gesture.shouldIgnoreSwipeStart(root.querySelector('#t'), root)).toBe(false)
    })
    test.each([
      ['text input', '<input id="t" />'],
      ['textarea', '<textarea id="t"></textarea>'],
      ['contenteditable', '<div contenteditable="true"><span id="t">x</span></div>'],
      ['slider', '<div role="slider"><span id="t"></span></div>'],
      ['video', '<video id="t"></video>'],
      ['opt-out attribute', '<div data-no-tab-swipe><span id="t"></span></div>']
    ])('%s is ignored', (_, html) => {
      const root = mount(html)
      expect(gesture.shouldIgnoreSwipeStart(root.querySelector('#t'), root)).toBe(true)
    })
    test('content inside a horizontally scrollable row is ignored (carousels, chip rows)', () => {
      const root = mount('<div id="row" style="overflow-x:auto"><span id="t">chip</span></div><p id="outside">x</p>')
      const row = root.querySelector('#row')
      Object.defineProperty(row, 'scrollWidth', { value: 900 })
      Object.defineProperty(row, 'clientWidth', { value: 300 })
      expect(gesture.shouldIgnoreSwipeStart(root.querySelector('#t'), root)).toBe(true)
      expect(gesture.shouldIgnoreSwipeStart(root.querySelector('#outside'), root)).toBe(false)
    })
    test('a row that fits (nothing to scroll) does not block the swipe', () => {
      const root = mount('<div id="row" style="overflow-x:auto"><span id="t">chip</span></div>')
      const row = root.querySelector('#row')
      Object.defineProperty(row, 'scrollWidth', { value: 300 })
      Object.defineProperty(row, 'clientWidth', { value: 300 })
      expect(gesture.shouldIgnoreSwipeStart(root.querySelector('#t'), root)).toBe(false)
    })
  })
})

describe('BottomNav', () => {
  const renderNav = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <BottomNav />
        <Probe />
      </MemoryRouter>
    )

  test('five labelled destinations in the shared order', () => {
    renderNav('/home')
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(ORDER)
    for (const label of ['Home', 'Communities', 'Marketplace', 'Messages', 'Profile']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })
  test.each(ORDER)('active item follows the route: %s', (path) => {
    renderNav(path)
    const active = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page')
    expect(active.map((l) => l.getAttribute('href'))).toEqual([path])
  })
  test('no item is active on a non-tab page', () => {
    renderNav('/leaderboard')
    expect(screen.getAllByRole('link').some((l) => l.getAttribute('aria-current') === 'page')).toBe(false)
  })
  test('tapping an item navigates to it', () => {
    renderNav('/home')
    fireEvent.click(screen.getByRole('link', { name: 'Marketplace' }))
    expect(loc()).toBe('/marketplace')
  })
  test('five tabs in the bar; the + floats above it, centred, as an action not a tab', () => {
    renderNav('/home')
    const slots = [...screen.getByRole('navigation').querySelector('.grid').children]
    expect(slots.map((el) => el.getAttribute('aria-label'))).toEqual(['Home', 'Communities', 'Marketplace', 'Messages', 'Profile'])
    const plus = screen.getByRole('button', { name: 'Create post' })
    expect(slots).not.toContain(plus)
    expect(plus.className).toContain('bottom-full') // floats above the bar
    expect(plus.className).toContain('left-1/2')
    expect(plus.hasAttribute('aria-current')).toBe(false)
  })
  test('the + never shows as the selected item, even on Create Post', () => {
    renderNav('/create')
    expect(screen.getAllByRole('link').some((l) => l.getAttribute('aria-current') === 'page')).toBe(false)
    // On Create Post itself the + is hidden (not a selected tab, not focusable).
    const plusOnCreate = screen.getByLabelText('Create post')
    expect(plusOnCreate.hasAttribute('aria-current')).toBe(false)
    expect(plusOnCreate.dataset.visible).toBe('false')
  })
  test('the + button opens the existing Create Post route', () => {
    renderNav('/home')
    fireEvent.click(screen.getByRole('button', { name: 'Create post' }))
    expect(loc()).toBe('/create')
  })
  test('unread message count badge', () => {
    mocks.unread = 3
    renderNav('/home')
    expect(screen.getByRole('link', { name: 'Messages — 3 unread' })).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })
  test('unread badge caps at 9+ and is absent at zero', () => {
    mocks.unread = 14
    renderNav('/home')
    expect(screen.getByText('9+')).toBeTruthy()
    cleanup()
    mocks.unread = 0
    renderNav('/home')
    expect(screen.getByRole('link', { name: 'Messages' })).toBeTruthy()
  })
  test('respects the Android gesture-area inset', () => {
    renderNav('/home')
    expect(screen.getByRole('navigation').style.paddingBottom).toContain('safe-')
  })
})

describe('floating + hides while scrolling down', () => {
  const plus = () => screen.getByLabelText('Create post')
  const scrollTo = (y) =>
    act(() => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
      document.dispatchEvent(new Event('scroll'))
    })
  const renderNav = (path = '/home') =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <BottomNav />
        <Probe />
      </MemoryRouter>
    )
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  })

  test('pure rule: down hides, up shows, top zone always shows, jitter ignored', () => {
    expect(rule.nextCreateButtonVisibility(true, { position: 400, delta: 20 })).toBe(false)
    expect(rule.nextCreateButtonVisibility(false, { position: 400, delta: -20 })).toBe(true)
    expect(rule.nextCreateButtonVisibility(false, { position: 10, delta: 5 })).toBe(true)
    expect(rule.nextCreateButtonVisibility(true, { position: 400, delta: 3 })).toBe(true)
    expect(rule.nextCreateButtonVisibility(false, { position: 400, delta: -3 })).toBe(false)
  })

  test('scroll down hides it (not clickable, not focusable); scroll up brings it back', () => {
    renderNav()
    expect(plus().dataset.visible).toBe('true')
    scrollTo(10)
    scrollTo(300)
    expect(plus().dataset.visible).toBe('false')
    expect(plus().className).toContain('pointer-events-none')
    expect(plus().tabIndex).toBe(-1)
    scrollTo(250)
    expect(plus().dataset.visible).toBe('true')
    expect(plus().tabIndex).toBe(0)
  })

  test('slow scrolling (small steps) still accumulates past the threshold', () => {
    renderNav()
    scrollTo(100)
    for (let y = 103; y <= 130; y += 3) scrollTo(y)
    expect(plus().dataset.visible).toBe('false')
  })

  test('the tab bar itself never hides, and a route change shows the + again', () => {
    renderNav()
    scrollTo(10)
    scrollTo(500)
    expect(plus().dataset.visible).toBe('false')
    expect(screen.getAllByRole('link')).toHaveLength(5)
    fireEvent.click(screen.getByRole('link', { name: 'Communities' }))
    expect(loc()).toBe('/communities')
    expect(plus().dataset.visible).toBe('true')
  })

  test('the + only appears where creating a post is the natural action (never over forms, settings or pages with their own primary button)', () => {
    for (const path of ['/home', '/communities', '/profile']) expect(rule.isCreateButtonRoute(path)).toBe(true)
    for (const path of ['/create', '/profile/edit', '/settings', '/settings/account', '/messages', '/marketplace', '/notifications', '/lost-found', '/progress', '/search', '/student/asha']) expect(rule.isCreateButtonRoute(path)).toBe(false)
    renderNav('/messages')
    expect(plus().dataset.visible).toBe('false')
    expect(plus().getAttribute('aria-hidden')).toBe('true')
  })

  test('horizontal scrolling (chip rows, carousels) never toggles it', () => {
    renderNav()
    scrollTo(10)
    scrollTo(400)
    scrollTo(300) // visible again
    const row = document.createElement('div')
    document.body.appendChild(row)
    act(() => {
      row.scrollLeft = 200
      row.dispatchEvent(new Event('scroll'))
    })
    expect(plus().dataset.visible).toBe('true')
  })
})

describe('useTabSwipe (touch gestures)', () => {
  function Shell() {
    const ref = useTabSwipe()
    return (
      <div ref={ref} data-testid="shell">
        <p data-testid="content">page</p>
        <input data-testid="field" />
        <Probe />
      </div>
    )
  }
  const renderShell = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Shell />} />
        </Routes>
      </MemoryRouter>
    )
  const touch = (x, y) => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] })
  function swipe(target, points) {
    act(() => {
      fireEvent.touchStart(target, touch(...points[0]))
      for (const p of points.slice(1)) fireEvent.touchMove(target, touch(...p))
      fireEvent.touchEnd(target, { touches: [], changedTouches: [{ clientX: points.at(-1)[0], clientY: points.at(-1)[1] }] })
    })
  }
  const LEFT = [[300, 300], [270, 302], [200, 304], [120, 305]]
  const RIGHT = [[100, 300], [130, 302], [200, 304], [290, 305]]

  test('swipe left on Home opens the next tab; swipe right returns', () => {
    renderShell('/home')
    swipe(screen.getByTestId('content'), LEFT)
    expect(loc()).toBe('/communities')
    swipe(screen.getByTestId('content'), RIGHT)
    expect(loc()).toBe('/home')
  })
  test('swiping walks the whole tab order in both directions', () => {
    renderShell('/home')
    for (const next of ORDER.slice(1)) {
      swipe(screen.getByTestId('content'), LEFT)
      expect(loc()).toBe(next)
    }
    for (const prev of [...ORDER].reverse().slice(1)) {
      swipe(screen.getByTestId('content'), RIGHT)
      expect(loc()).toBe(prev)
    }
  })
  test('no wrap-around at the first and last tab, and the drag transform is cleared', () => {
    renderShell('/home')
    swipe(screen.getByTestId('content'), RIGHT)
    expect(loc()).toBe('/home')
    cleanup()
    renderShell('/profile')
    swipe(screen.getByTestId('content'), LEFT)
    expect(loc()).toBe('/profile')
  })
  test('vertical scrolling never navigates', () => {
    renderShell('/messages')
    swipe(screen.getByTestId('content'), [[200, 500], [202, 460], [205, 380], [207, 200]])
    expect(loc()).toBe('/messages')
  })
  test('a short horizontal movement snaps back', () => {
    renderShell('/messages')
    swipe(screen.getByTestId('content'), [[200, 300], [180, 301], [160, 302]])
    expect(loc()).toBe('/messages')
  })
  test('swipes that start in a text input are ignored', () => {
    renderShell('/messages')
    swipe(screen.getByTestId('field'), LEFT)
    expect(loc()).toBe('/messages')
  })
  test('two-finger gestures are ignored', () => {
    renderShell('/home')
    const el = screen.getByTestId('content')
    act(() => {
      fireEvent.touchStart(el, { touches: [{ clientX: 300, clientY: 300 }, { clientX: 320, clientY: 300 }] })
      fireEvent.touchMove(el, { touches: [{ clientX: 100, clientY: 300 }, { clientX: 120, clientY: 300 }] })
      fireEvent.touchEnd(el, { touches: [] })
    })
    expect(loc()).toBe('/home')
  })
  test('non-tab pages do not respond to swipes', () => {
    renderShell('/settings')
    swipe(screen.getByTestId('content'), LEFT)
    expect(loc()).toBe('/settings')
  })
  test('the page follows the finger during a drag and no transform is left behind', () => {
    renderShell('/communities')
    const shell = screen.getByTestId('shell')
    const el = screen.getByTestId('content')
    act(() => {
      fireEvent.touchStart(el, touch(300, 300))
      fireEvent.touchMove(el, touch(260, 301))
      fireEvent.touchMove(el, touch(220, 302))
    })
    expect(shell.style.transform).toContain('translate3d(-80px')
    act(() => {
      fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: 100, clientY: 302 }] })
    })
    // completed (flick): navigates and clears immediately
    expect(shell.style.transform).toBe('')
    expect(shell.style.willChange).toBe('')
  })
  test('reduced motion: gesture still navigates but nothing follows the finger', () => {
    window.matchMedia = (query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} })
    renderShell('/home')
    const shell = screen.getByTestId('shell')
    const el = screen.getByTestId('content')
    act(() => {
      fireEvent.touchStart(el, touch(300, 300))
      fireEvent.touchMove(el, touch(200, 301))
    })
    expect(shell.style.transform).toBe('')
    act(() => {
      fireEvent.touchMove(el, touch(120, 302))
      fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientX: 120, clientY: 302 }] })
    })
    expect(loc()).toBe('/communities')
  })
})
