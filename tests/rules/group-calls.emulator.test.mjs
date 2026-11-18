// groupCalls rules: the in-app incoming-ring LIST query must be allowed for
// real members and nobody else, and participantUids can't be spoofed.
// Local Firestore emulator only (demo project).
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeApp, deleteApp } from 'firebase/app'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, setDoc, where } from 'firebase/firestore'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', '..', 'functions', 'functions', 'index.js'))
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8089)
const PROJECT = 'demo-campinity-rules'
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORT}`
const admin = require('firebase-admin')
const adminApp = admin.initializeApp({ projectId: PROJECT }, 'group-calls-seed')
const adb = adminApp.firestore()

const apps = []
function clientFor(uid) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key' }, `gc-${uid}-${apps.length}`)
  apps.push(app)
  const db = getFirestore(app)
  connectFirestoreEmulator(db, '127.0.0.1', PORT, { mockUserToken: { user_id: uid, sub: uid } })
  return db
}
const ringQuery = (db, uid) => getDocs(query(collection(db, 'groupCalls'), where('participantUids', 'array-contains', uid)))
const MEMBERS = ['ana', 'ben', 'cy']

beforeAll(async () => {
  await fetch(`http://127.0.0.1:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' })
  await adb.doc('chats/g1').set({ type: 'group', participants: MEMBERS, groupName: 'Study group' })
  await adb.doc('chats/g2').set({ type: 'group', participants: ['zed', 'yan'], groupName: 'Other' })
  await adb.doc('chats/ana_ben').set({ type: 'direct', participants: ['ana', 'ben'] })
  await adb.doc('groupCalls/c1').set({ chatId: 'g1', hostUid: 'ana', type: 'voice', status: 'ringing', participantUids: MEMBERS })
  await adb.doc('groupCalls/c2').set({ chatId: 'g2', hostUid: 'zed', type: 'voice', status: 'ringing', participantUids: ['zed', 'yan'] })
})
afterAll(async () => {
  await Promise.all(apps.map((a) => deleteApp(a)))
  await adminApp.delete()
})

describe('incoming group-call ring listener (list query)', () => {
  test('a member can run the ring query and sees only their own group calls', async () => {
    const snap = await ringQuery(clientFor('ben'), 'ben')
    expect(snap.docs.map((d) => d.id)).toEqual(['c1'])
  })
  test('querying for someone else is denied', async () => {
    await expect(ringQuery(clientFor('mallory'), 'ben')).rejects.toMatchObject({ code: 'permission-denied' })
  })
  test('an unfiltered list of all group calls is denied', async () => {
    await expect(getDocs(collection(clientFor('ben'), 'groupCalls'))).rejects.toMatchObject({ code: 'permission-denied' })
  })
  test('direct get: members yes, outsiders no', async () => {
    expect((await getDoc(doc(clientFor('cy'), 'groupCalls/c1'))).exists()).toBe(true)
    await expect(getDoc(doc(clientFor('mallory'), 'groupCalls/c1'))).rejects.toMatchObject({ code: 'permission-denied' })
  })
})

describe('creating a group call', () => {
  const base = { chatId: 'g1', hostUid: 'ana', type: 'video', status: 'ringing', groupName: 'Study group', groupAvatar: '', createdAt: serverTimestamp() }
  test('host with the real roster can create', async () => {
    await expect(setDoc(doc(clientFor('ana'), 'groupCalls/new1'), { ...base, participantUids: MEMBERS })).resolves.toBeUndefined()
  })
  test('participantUids may not include outsiders (no spoofed rings / pushes)', async () => {
    await expect(setDoc(doc(clientFor('ana'), 'groupCalls/new2'), { ...base, participantUids: [...MEMBERS, 'mallory'] })).rejects.toMatchObject({ code: 'permission-denied' })
  })
  test('participantUids must be a list', async () => {
    await expect(setDoc(doc(clientFor('ana'), 'groupCalls/new3'), { ...base, participantUids: 'ana' })).rejects.toMatchObject({ code: 'permission-denied' })
  })
  test('non-members and direct chats are still refused', async () => {
    await expect(setDoc(doc(clientFor('mallory'), 'groupCalls/new4'), { ...base, hostUid: 'mallory', participantUids: MEMBERS })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(setDoc(doc(clientFor('ana'), 'groupCalls/new5'), { ...base, chatId: 'ana_ben', participantUids: ['ana', 'ben'] })).rejects.toMatchObject({ code: 'permission-denied' })
  })
})
