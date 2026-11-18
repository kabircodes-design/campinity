// Seeds the LOCAL emulator project only (demo-campinity-e2e). Refuses to run otherwise.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8189'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9199'
const PROJECT = 'demo-campinity-e2e'
const path = require('path')
const admin = require(path.resolve(__dirname, '../../functions/functions/node_modules/firebase-admin'))
if (!PROJECT.startsWith('demo-')) throw new Error('refusing: not a demo project')
admin.initializeApp({ projectId: PROJECT })
const db = admin.firestore()
const { Timestamp } = admin.firestore
const COLLEGE = 'thakur-college-science-commerce'
const people = [
  { uid: 'alice', email: 'alice@e2e.test', name: 'Alice Mehta', username: 'alice_m', bio: 'Robotics club lead.' },
  { uid: 'bob', email: 'bob@e2e.test', name: 'Bob Dsouza', username: 'bob_d', bio: 'Chess and chai.' }
]
;(async () => {
  await db.doc(`colleges/${COLLEGE}`).set({ name: 'Thakur College of Science and Commerce', nameLower: 'thakur college of science and commerce', city: 'Mumbai', state: 'Maharashtra', verified: true })
  for (const p of people) {
    await admin.auth().createUser({ uid: p.uid, email: p.email, password: 'e2e-password-1', emailVerified: true, displayName: p.name }).catch(() => {})
    await db.doc(`users/${p.uid}`).set({
      uid: p.uid, fullName: p.name, displayName: p.name, displayNameLower: p.name.toLowerCase(), username: p.username, usernameReserved: true,
      bio: p.bio, collegeId: COLLEGE, college: 'Thakur College of Science and Commerce', course: 'Computer science', year: 'SY',
      verifiedCampus: true, profileCompleted: true, role: 'student', radarVisible: true, createdAt: Timestamp.now()
    })
    await db.doc(`usernames/${p.username}`).set({ uid: p.uid, createdAt: Timestamp.now() })
  }
  // A post whose author account no longer exists -> must render as "Student".
  await db.doc('posts/ghost-post').set({ userId: 'ghost-deleted-user', displayName: 'Former Student', username: 'former', text: 'Post from a deleted account', category: 'general', visibility: 'public', likesCount: 0, commentsCount: 0, likedBy: [], collegeId: COLLEGE, createdAt: Timestamp.now() })
  console.log('seeded: 2 users, 1 college, 1 ghost post')
  process.exit(0)
})().catch((e) => { console.error('SEED ERROR', e.message); process.exit(1) })
