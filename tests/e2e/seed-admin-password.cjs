// EMULATOR ONLY: creates adminSession/config with a throwaway test password, using the same
// scrypt(value, salt, 64) hex format as hashSecret() in functions/functions/index.js.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8189'
const path = require('path')
const crypto = require('crypto')
const admin = require(path.resolve(__dirname, '../../functions/functions/node_modules/firebase-admin'))
const PROJECT = 'demo-campinity-e2e'
if (!PROJECT.startsWith('demo-')) throw new Error('refusing: not a demo project')
admin.initializeApp({ projectId: PROJECT })
const password = process.argv[2]
const salt = crypto.randomBytes(16).toString('hex')
crypto.scrypt(password, salt, 64, async (err, key) => {
  if (err) throw err
  await admin.firestore().doc('adminSession/config').set({ hash: key.toString('hex'), salt, createdByUid: 'alice', createdAt: admin.firestore.Timestamp.now() })
  console.log('emulator admin password record created')
  process.exit(0)
})
