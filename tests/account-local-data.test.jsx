// Account-scoped local data is cleared on sign-out and on account switch,
// device preferences are kept, and an existing user upgrading keeps their draft.
import { beforeEach, describe, expect, test } from 'vitest'

const SRC = process.env.SRC_DIR
const { syncAccountLocalData } = await import(`${SRC}/auth/utils/accountLocalData.js`)

const seed = () => {
  localStorage.setItem('campinity:postDraft', '{"text":"old draft"}')
  localStorage.setItem('campinity:recentSearches', '["old search"]')
  localStorage.setItem('campinity:mascotGreeted', 'true')
  localStorage.setItem('campinity_verification_modal_seen', 'true')
  localStorage.setItem('campinity_verification_banner_dismissed', 'true')
  localStorage.setItem('campinity:pendingEmailChange:olduid', '{"to":"x"}')
  sessionStorage.setItem('campinity:justOnboarded', '1')
  sessionStorage.setItem('campinity:verifyResendAt:olduid', '123')
  // device preferences
  localStorage.setItem('campinity:appearanceMode', 'dark')
  localStorage.setItem('campinity:themePack', 'ocean')
  localStorage.setItem('campinity:recentEmojis', '["🔥"]')
  localStorage.setItem('campinity:deviceId', 'dev-1')
}
const accountKeysLeft = () =>
  [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => /postDraft|recentSearches|mascotGreeted|verification_|pendingEmailChange|justOnboarded|verifyResendAt/.test(k))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('account-scoped local data', () => {
  test('first run for an existing signed-in user keeps their draft and records the owner', () => {
    seed()
    syncAccountLocalData('olduid')
    expect(localStorage.getItem('campinity:postDraft')).toContain('old draft')
    expect(localStorage.getItem('campinity:lastAccountUid')).toBe('olduid')
  })

  test('same account again: nothing cleared', () => {
    seed()
    syncAccountLocalData('olduid')
    syncAccountLocalData('olduid')
    expect(accountKeysLeft()).toHaveLength(8)
  })

  test('sign-out (incl. a deleted account being signed out by Firebase) clears account data, keeps device prefs', () => {
    seed()
    syncAccountLocalData('olduid')
    syncAccountLocalData(null)
    expect(accountKeysLeft()).toEqual([])
    expect(localStorage.getItem('campinity:lastAccountUid')).toBeNull()
    expect(localStorage.getItem('campinity:appearanceMode')).toBe('dark')
    expect(localStorage.getItem('campinity:themePack')).toBe('ocean')
    expect(localStorage.getItem('campinity:recentEmojis')).toBe('["🔥"]')
    expect(localStorage.getItem('campinity:deviceId')).toBe('dev-1')
  })

  test('a different account signing in on the same device never sees the previous account’s data', () => {
    seed()
    syncAccountLocalData('olduid')
    syncAccountLocalData('newuid')
    expect(accountKeysLeft()).toEqual([])
    expect(localStorage.getItem('campinity:lastAccountUid')).toBe('newuid')
    expect(localStorage.getItem('campinity:appearanceMode')).toBe('dark')
  })
})
