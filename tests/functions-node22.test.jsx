// Node.js 22 runtime compatibility for the Cloud Functions codebase.
// Run it under the runtime being evaluated (e.g. a Node 22 binary). Offline:
// no credentials, no network, no deploy.
//
// The crypto reference values were generated on Node v20.20.2 — the runtime
// production uses today — so a match proves that hashes already stored in
// production (admin passcodes: scrypt; email-verification tokens: sha256)
// still verify after the runtime upgrade.
import { describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import { promisify } from 'node:util'

const require = createRequire(import.meta.url)
const FUNCTIONS_DIR = `${process.env.SRC_DIR}/../functions/functions`

const NODE20 = {
  scryptSync64:
    'f6503180133c5866a0128d169a19873afdbe5d33e24508f3b243b7741c46d31c530643354185fd3e12ee10a516c8c2fa8973269f6e827512500f8aaf9649182b',
  scryptAsync64:
    'f6503180133c5866a0128d169a19873afdbe5d33e24508f3b243b7741c46d31c530643354185fd3e12ee10a516c8c2fa8973269f6e827512500f8aaf9649182b',
  sha256: '09f23e74fc5e3bebc1bf395d8d22f09a75998bfc33a93963e698fa3499d6de8c'
}
const SALT = '0123456789abcdef0123456789abcdef'

// The 39 functions committed at HEAD (deployed today) plus the 2 prepared ones.
const COMMITTED = [
  'adminDeleteAnnouncement', 'adminGetOverviewCounts', 'adminGetVerificationDocumentUrl', 'adminListAchievementSubmissions',
  'adminListAuditLog', 'adminListCollegeRequests', 'adminListCommunities', 'adminListCommunityMembers', 'adminListLostFound',
  'adminListMarketplaceProducts', 'adminListReports', 'adminListVerificationRequests', 'adminLogin', 'adminLogout',
  'adminModerateCommunityMember', 'adminModerateContent', 'adminModerateLostFoundItem', 'adminModerateProduct',
  'adminResolveReport', 'adminReviewAchievementSubmission', 'adminReviewCollegeRequest', 'adminReviewVerificationRequest',
  'adminSendNotification', 'adminSetAnnouncementPinned', 'adminSetUserModerationStatus', 'adminSetUserVerification',
  'checkAdminPasscodeExists', 'checkAdminPasswordExists', 'checkAdminStatus', 'createCallPushNotification',
  'createEmailVerification', 'createGroupCallPushNotifications', 'moderateProfilePhoto', 'resendEmailVerification',
  'sendPushForNotification', 'setAdminPasscode', 'setAdminPassword', 'verifyAdminPasscode', 'verifyEmailVerificationToken'
]
const PREPARED = ['radarNearby', 'getTurnCredentials']
// Admin Control Center: new read-only endpoints (not deployed).
const ADMIN_CONTROL = ['adminGetDashboard', 'adminSearchUsers', 'adminGetUserDetail', 'adminGetReportContext', 'adminGetSystemHealth']
// Admin device authorization (API v2): new endpoints (not deployed).
// Notice Board (notices.js): new admin endpoints (not deployed).
const NOTICES = ['adminListNotices', 'adminSaveNotice', 'adminSetNoticeState', 'adminDeleteNotice', 'adminUploadNoticeImage']
const DEVICE_AUTH = ['adminLoginFinish', 'adminGetCapabilities', 'adminEnrollDeviceStart', 'adminEnrollDeviceFinish', 'adminListDevices', 'adminRevokeDevice', 'adminCreateEnrollmentCode']

describe(`crypto output is identical to Node 20 (running on ${process.version})`, () => {
  test('scryptSync(passcode, salt, 64) — admin passcode hashing', () => {
    expect(crypto.scryptSync('correct horse', SALT, 64).toString('hex')).toBe(NODE20.scryptSync64)
  })
  test('promisify(crypto.scrypt)(value, salt, 64) — async passcode check', async () => {
    const out = await promisify(crypto.scrypt)('correct horse', SALT, 64)
    expect(out.toString('hex')).toBe(NODE20.scryptAsync64)
  })
  test('sha256 token hashing — email verification tokens', () => {
    expect(crypto.createHash('sha256').update('raw-token-example').digest('hex')).toBe(NODE20.sha256)
  })
  test('timingSafeEqual still throws on length mismatch (callers guard with a length check)', () => {
    expect(() => crypto.timingSafeEqual(Buffer.from('ab'), Buffer.from('abc'))).toThrow()
    expect(crypto.timingSafeEqual(Buffer.from('abc'), Buffer.from('abc'))).toBe(true)
  })
  test('randomBytes hex lengths used for salts, session and email tokens', () => {
    expect(crypto.randomBytes(16).toString('hex')).toHaveLength(32)
    expect(crypto.randomBytes(32).toString('hex')).toHaveLength(64)
  })
})

describe('runtime built-ins the functions rely on', () => {
  test('global fetch / Response / AbortController (Resend, OpenAI, Cloudflare calls)', () => {
    expect(typeof fetch).toBe('function')
    expect(typeof Response).toBe('function')
    expect(typeof AbortController).toBe('function')
  })
})

describe('Functions codebase loads and is unchanged in shape', () => {
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-node22-audit'
  process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || JSON.stringify({ projectId: 'demo-node22-audit' })
  const mod = require(`${FUNCTIONS_DIR}/index.js`)
  const names = Object.keys(mod).sort()

  test('exports exactly the 39 committed functions plus the 2 prepared, 5 Admin Control Center, 7 device-auth and 5 Notice Board ones', () => {
    expect(names).toEqual([...COMMITTED, ...PREPARED, ...ADMIN_CONTROL, ...DEVICE_AUTH, ...NOTICES].sort())
  })
  test('every export is a 2nd-gen function in us-central1', () => {
    for (const name of names) {
      const ep = mod[name].__endpoint
      expect(ep, name).toBeTruthy()
      expect(ep.platform, name).toBe('gcfv2')
      expect(ep.region, name).toEqual(['us-central1'])
    }
  })
  test('trigger mix: 55 callable + 3 Firestore onCreate', () => {
    const callable = names.filter((n) => mod[n].__endpoint.callableTrigger).length
    const events = names.filter((n) => mod[n].__endpoint.eventTrigger).length
    expect({ callable, events }).toEqual({ callable: 55, events: 3 })
  })
})
