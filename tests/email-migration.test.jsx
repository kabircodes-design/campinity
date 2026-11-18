// The REVIEW-ONLY email migration script's decision logic
// (functions/scripts/migrate-public-email.cjs). Pure — never connects to
// Firestore. Proves the safety properties: copy never overwrites,
// remove only happens with a matching private copy, restore is exact.
import { describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { planUser, parseArgs } = require(`${process.env.SRC_DIR}/../functions/scripts/migrate-public-email.cjs`)

const A = 'a@example.test'
const B = 'b@example.test'

describe('copy phase', () => {
  test.each([
    [A, undefined, 'copy'],
    [A, A, 'skip'],
    [A, B, 'conflict'],
    [undefined, undefined, 'skip'],
    ['', undefined, 'skip']
  ])('public=%s private=%s -> %s', (pub, priv, action) => {
    expect(planUser('copy', pub, priv).action).toBe(action)
  })
})

describe('remove phase never loses an address', () => {
  test('removes only when the private copy exists and matches', () => {
    expect(planUser('remove', A, A).action).toBe('remove')
  })
  test('blocked without a private copy', () => {
    expect(planUser('remove', A, undefined)).toEqual({ action: 'blocked', reason: 'no-private-copy' })
  })
  test('blocked when the copy differs', () => {
    expect(planUser('remove', A, B)).toEqual({ action: 'blocked', reason: 'copy-mismatch' })
  })
  test('already removed is a no-op', () => {
    expect(planUser('remove', undefined, A).action).toBe('skip')
  })
})

describe('restore phase (rollback)', () => {
  test('puts the address back from the private copy', () => {
    expect(planUser('restore', undefined, A).action).toBe('restore')
  })
  test('never overwrites a different public address', () => {
    expect(planUser('restore', B, A).action).toBe('conflict')
  })
  test('no-op when already public or no copy', () => {
    expect(planUser('restore', A, A).action).toBe('skip')
    expect(planUser('restore', undefined, undefined).action).toBe('skip')
  })
})

describe('arguments', () => {
  test('dry run unless --execute', () => {
    expect(parseArgs(['node', 's', '--project=p', '--phase=copy'])).toMatchObject({ execute: false, confirm: null })
    expect(parseArgs(['node', 's', '--project=p', '--phase=copy', '--execute', '--confirm=p'])).toMatchObject({ execute: true, confirm: 'p' })
  })
  test('unknown phase is rejected', () => {
    expect(() => planUser('wipe', A, A)).toThrow()
  })
})
