// Email verification UI (Firebase built-in flow active) — real SignupPage,
// LoginPage, VerifyEmailPage, ProtectedRoute and Google routing, with
// Firebase mocked (no network, no email).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const SRC = vi.hoisted(() => process.env.SRC_DIR)
const m = vi.hoisted(() => ({
  auth: { currentUser: null },
  send: null,
  apply: null,
  calls: [],
  profile: null,
  docFails: false,
  signupUser: null,
  loginUser: null
}))

vi.mock(`${SRC}/firebase/firebase.js`, () => ({ auth: m.auth, db: {}, storage: {}, googleProvider: {}, default: {} }))
vi.mock(`${SRC}/firebase/emailVerificationService.js`, () => ({
  EMAIL_VERIFICATION_PROVIDER: 'firebase',
  RESEND_COOLDOWN_SECONDS: 60,
  sendVerificationEmail: async (user) => {
    m.calls.push(['send', user?.uid])
    if (m.send instanceof Error) throw m.send
    return m.send
  },
  applyFirebaseVerificationCode: async (code) => {
    m.calls.push(['apply', code])
    if (m.apply instanceof Error) throw m.apply
    return { ok: true }
  },
  verifyEmailVerificationToken: async () => {
    m.calls.push(['customVerify'])
    return { ok: true }
  }
}))
vi.mock(`${SRC}/auth/utils/userProfile.js`, () => ({
  ensureUserDoc: async () => {
    m.calls.push(['ensureUserDoc'])
    return m.profile
  },
  getUserProfile: async () => m.profile,
  createInitialUserDoc: async () => {
    m.calls.push(['createInitialUserDoc'])
    if (m.docFails) throw new Error('permission-denied')
  }
}))
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig()),
  signOut: async () => {
    m.calls.push(['signOut'])
    m.auth.currentUser = null
  },
  createUserWithEmailAndPassword: async (_a, email) => {
    m.calls.push(['createUser', email])
    if (m.signupUser instanceof Error) throw m.signupUser
    m.auth.currentUser = m.signupUser
    return { user: m.signupUser }
  },
  signInWithEmailAndPassword: async () => {
    if (m.loginUser instanceof Error) throw m.loginUser
    m.auth.currentUser = m.loginUser
    return { user: m.loginUser }
  },
  setPersistence: async () => {},
  updateProfile: async () => {}
}))
vi.mock(`${SRC}/components/SignupCelebration.jsx`, () => ({ default: () => null }))
vi.mock(`${SRC}/theme/useTheme.js`, () => ({ useTheme: () => ({ mode: 'light', resolvedIsDark: false, setMode: () => {}, theme: { id: 'default' } }) }))
const authState = vi.hoisted(() => ({ value: { user: null, profile: null, loading: false } }))
vi.mock(`${SRC}/context/AuthContext.jsx`, () => ({ useAuth: () => authState.value }))
vi.mock(`${SRC}/hooks/useIsAdmin.js`, () => ({ useIsAdmin: () => ({ isAdmin: false, loading: false }) }))

const { MemoryRouter, Route, Routes, useLocation, useNavigate } = await import('react-router-dom')
const { default: VerifyEmailPage } = await import(`${SRC}/auth/pages/VerifyEmailPage.jsx`)
const { default: SignupPage } = await import(`${SRC}/auth/pages/SignupPage.jsx`)
const { default: LoginPage } = await import(`${SRC}/auth/pages/LoginPage.jsx`)
const { default: ProtectedRoute } = await import(`${SRC}/auth/components/ProtectedRoute.jsx`)
const { routeAfterGoogleSignIn } = await import(`${SRC}/auth/utils/googleAuth.js`)

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname + loc.search + (loc.state ? JSON.stringify(loc.state) : '')}</p>
}
function renderAt(entry, element = <VerifyEmailPage />, path = '/verify-email') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}
const where = () => screen.getByTestId('where').textContent
const mkUser = (over = {}) => {
  const u = { uid: 'u1', email: 'new.student@example.test', emailVerified: false, getIdToken: vi.fn(async () => 'x'), ...over }
  u.reload = over.reload || vi.fn(async () => {})
  return u
}
const verifyOnReload = (u) => {
  u.reload = vi.fn(async () => {
    u.emailVerified = true
  })
  return u
}
const fbErr = (code) => Object.assign(new Error(code), { code })

beforeEach(() => {
  m.auth.currentUser = null
  m.send = { ok: true, provider: 'firebase', resendAvailableInSeconds: 60, expiresInMinutes: null }
  m.apply = null
  m.calls = []
  m.profile = { verificationStatus: 'not_started' }
  m.docFails = false
  m.loginUser = null
  authState.value = { user: null, profile: null, loading: false }
  sessionStorage.clear()
})
afterEach(cleanup)

describe('signup → Firebase verification email', () => {
  async function submit() {
    renderAt('/signup', <SignupPage />, '/signup')
    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Asha Rao' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'new.student@example.test' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Str0ng!Passw0rd#' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'Str0ng!Passw0rd#' } })
    fireEvent.click(screen.getByRole('button', { name: /Create account/i }))
  }

  test('creates the account + profile doc, sends the email for THAT user, shows the inbox screen as "sent"', async () => {
    m.signupUser = mkUser()
    await submit()
    await waitFor(() => expect(where()).toContain('/verify-email'))
    expect(where()).toContain('"verificationSent":true')
    expect(m.calls).toEqual(expect.arrayContaining([['createUser', 'new.student@example.test'], ['createInitialUserDoc'], ['send', 'u1']]))
  })

  test('profile-doc failure does not strand the user', async () => {
    m.signupUser = mkUser()
    m.docFails = true
    await submit()
    await waitFor(() => expect(where()).toContain('"verificationSent":true'))
  })

  test('Firebase send failure: account kept, honest "not sent" state', async () => {
    m.signupUser = mkUser()
    m.send = fbErr('auth/too-many-requests')
    await submit()
    await waitFor(() => expect(where()).toContain('"verificationSent":false'))
  })

  test('duplicate signup / existing account: told to log in instead', async () => {
    m.signupUser = fbErr('auth/email-already-in-use')
    await submit()
    expect(await screen.findByText(/already exists\. Log in instead/)).toBeTruthy()
  })
})

describe('inbox screen (pending verification)', () => {
  test('right after signup: account email, Pending, sent notice, resend countdown', async () => {
    m.auth.currentUser = mkUser()
    renderAt({ pathname: '/verify-email', state: { verificationSent: true, resendAvailableInSeconds: 60 } })
    expect(screen.getByText('new.student@example.test')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('We sent a verification link to new.student@example.test.')).toBeTruthy()
    expect(screen.getByText(/noreply@campinity-app\.firebaseapp\.com/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Resend email in \d+s/ }).disabled).toBe(true)
  })

  test('existing unverified account arriving from login (recovery): no false "sent" claim; can send a Firebase email', async () => {
    m.auth.currentUser = mkUser()
    renderAt('/verify-email')
    expect(screen.queryByText(/We sent a verification link/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }))
    expect(await screen.findByText("Verification email sent to new.student@example.test. Only the newest email's link is guaranteed to work.")).toBeTruthy()
    expect(m.calls).toContainEqual(['send', 'u1'])
    expect(screen.getByRole('button', { name: /Resend email in \d+s/ }).disabled).toBe(true)
    expect(m.calls).toContainEqual(['ensureUserDoc']) // missing profile doc is recovered
  })

  test('Firebase rate limit and network errors are explained; rate limit starts a long cooldown', async () => {
    m.auth.currentUser = mkUser()
    m.send = fbErr('auth/too-many-requests')
    renderAt('/verify-email')
    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }))
    expect(await screen.findByText(/Too many emails requested/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /in (29\d|300)s/ }).disabled).toBe(true)
    cleanup()
    sessionStorage.clear()
    m.send = fbErr('auth/network-request-failed')
    renderAt('/verify-email')
    fireEvent.click(screen.getByRole('button', { name: 'Send verification email' }))
    expect(await screen.findByText(/No connection/)).toBeTruthy()
  })

  test('already verified user is never left on the pending screen (checked on open)', async () => {
    m.auth.currentUser = verifyOnReload(mkUser())
    renderAt('/verify-email')
    await waitFor(() => expect(where()).toBe('/campus-verification'))
  })

  test('"I\'ve verified": reload() decides — not yet → hint; verified → onboarding with a fresh token', async () => {
    const u = mkUser()
    m.auth.currentUser = u
    renderAt('/verify-email')
    fireEvent.click(screen.getByRole('button', { name: "I've verified my email" }))
    expect(await screen.findByText(/Not verified yet/)).toBeTruthy()
    verifyOnReload(u)
    fireEvent.click(screen.getByRole('button', { name: "I've verified my email" }))
    await waitFor(() => expect(where()).toBe('/campus-verification'))
    expect(u.getIdToken).toHaveBeenCalledWith(true)
  })

  test('verified on the phone: returning to the tab moves on automatically', async () => {
    const u = mkUser()
    m.auth.currentUser = u
    renderAt('/verify-email')
    verifyOnReload(u)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(where()).toBe('/campus-verification'))
  })

  test('"Use a different email" signs out and returns to signup', async () => {
    m.auth.currentUser = mkUser()
    renderAt('/verify-email')
    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }))
    await waitFor(() => expect(where()).toBe('/signup'))
  })
})

describe('returning from the Firebase verification link', () => {
  test('?verified=1 while signed in: reload confirms → Email verified → continue', async () => {
    m.auth.currentUser = verifyOnReload(mkUser())
    renderAt('/verify-email?verified=1')
    expect(await screen.findByText('Email verified')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Campinity' }))
    await waitFor(() => expect(where()).toBe('/campus-verification'))
  })

  test('?verified=1 but Firebase still says unverified: "Not verified yet", no access granted', async () => {
    m.auth.currentUser = mkUser()
    renderAt('/verify-email?verified=1')
    expect(await screen.findByText('Not verified yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Continue to Campinity' })).toBeNull()
  })

  test('?verified=1 opened in another browser (no session): asks to log in', async () => {
    renderAt('/verify-email?verified=1')
    expect(await screen.findByText('Verification complete')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => expect(where()).toBe('/login{"emailJustVerified":true}'))
  })

  test('in-app action link (?mode=verifyEmail&oobCode=…): applyActionCode, then success', async () => {
    renderAt('/verify-email?mode=verifyEmail&oobCode=OOB123')
    expect(await screen.findByText('Email verified')).toBeTruthy()
    expect(m.calls).toContainEqual(['apply', 'OOB123'])
  })

  test.each([
    ['auth/expired-action-code', 'This link has expired'],
    ['auth/invalid-action-code', "This link isn't valid"]
  ])('action code %s → %s', async (code, title) => {
    m.apply = fbErr(code)
    renderAt('/verify-email?mode=verifyEmail&oobCode=OOB')
    expect(await screen.findByText(title)).toBeTruthy()
  })

  test('old Resend ?token= link while Firebase is active: never redeemed, offers a new email', async () => {
    renderAt(`/verify-email?token=${'a'.repeat(64)}`)
    expect(screen.getByText('This link is from an older email')).toBeTruthy()
    expect(m.calls.some((c) => c[0] === 'customVerify')).toBe(false)
  })
})

describe('login', () => {
  async function login() {
    renderAt('/login', <LoginPage />, '/login')
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'a@b.test' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'whatever123' } })
    fireEvent.click(screen.getByRole('button', { name: /^Log in$/i }))
  }
  test('unverified account: reloaded, then sent to /verify-email (not into the app)', async () => {
    m.loginUser = mkUser()
    await login()
    await waitFor(() => expect(where()).toBe('/verify-email'))
    expect(m.loginUser.reload).toHaveBeenCalled()
  })
  test('verified account: straight into onboarding / home', async () => {
    m.loginUser = mkUser({ emailVerified: true })
    m.profile = { profileCompleted: true }
    await login()
    await waitFor(() => expect(where()).toBe('/home'))
  })
  test('arriving after verifying elsewhere shows a confirmation', () => {
    renderAt({ pathname: '/login', state: { emailJustVerified: true } }, <LoginPage />, '/login')
    expect(screen.getByText(/Your email is verified/)).toBeTruthy()
  })
})

describe('Google sign-in', () => {
  function GoogleProbe({ user }) {
    const navigate = useNavigate()
    return <button onClick={() => routeAfterGoogleSignIn(user, navigate)}>go</button>
  }
  test('Google accounts (verified by Google) skip email verification; an unverified one is sent to verify', async () => {
    m.profile = { profileCompleted: true }
    renderAt('/g', <GoogleProbe user={{ uid: 'g1', email: 'g@gmail.test', emailVerified: true }} />, '/g')
    fireEvent.click(screen.getByRole('button', { name: 'go' }))
    await waitFor(() => expect(where()).toBe('/home'))
    cleanup()
    renderAt('/g', <GoogleProbe user={{ uid: 'g2', email: 'g2@x.test', emailVerified: false }} />, '/g')
    fireEvent.click(screen.getByRole('button', { name: 'go' }))
    await waitFor(() => expect(where()).toBe('/verify-email'))
  })
})

describe('route protection', () => {
  const guarded = (stage) => (
    <ProtectedRoute stage={stage}>
      <p>inside</p>
    </ProtectedRoute>
  )
  test('verification result links render without a session; the inbox screen alone needs login', () => {
    for (const q of ['?verified=1', '?mode=verifyEmail&oobCode=x', `?token=${'a'.repeat(64)}`]) {
      renderAt(`/verify-email${q}`, guarded('verify-email'))
      expect(screen.getByText('inside')).toBeTruthy()
      cleanup()
    }
    renderAt('/verify-email', guarded('verify-email'))
    expect(where()).toContain('/login')
  })
  test('unverified users cannot reach protected pages; verified users skip /verify-email', () => {
    authState.value = { user: { emailVerified: false }, profile: { profileCompleted: true }, loading: false }
    renderAt('/home', guarded('home'), '/home')
    expect(where()).toBe('/verify-email')
    cleanup()
    authState.value = { user: { emailVerified: true }, profile: { profileCompleted: true }, loading: false }
    renderAt('/verify-email', guarded('verify-email'))
    expect(where()).toBe('/home')
  })
})
