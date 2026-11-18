# Campinity release checklist (`release/approved-ui`)

Every step below that touches GitHub, Vercel or the `campinity-app` Firebase project needs the owner's explicit approval. Nothing here has been run against production.

## 0. State of the branch

- The branch is in the worktree `campinity-ui-restore` and is 20 commits ahead of `main`. Nothing has been pushed.
- The untouched original folder `campinity/` is not part of this release.
- No secrets are tracked. `.env` and `.env.*` are gitignored. `android/app/google-services.json` is tracked, as it already is on `main`; it holds only the public Firebase client config.
- Tests at the last run:
  - Unit/UI/backend: 287/287.
  - Firestore emulator: 246/246.
  - Local E2E (emulators): every check passed in at least one full run. See "Known test-environment flakiness".

## 1. GitHub push (approval needed)

```bash
cd campinity-ui-restore
git status            # must be clean
git push -u origin release/approved-ui
```

Open a PR `release/approved-ui → main`. Do not merge until steps 2–4 pass.

## 2. Vercel preview (approval needed)

1. Pushing the branch triggers a Vercel preview deployment, if the GitHub integration is connected.
2. In Vercel → Project → Settings → Environment Variables (Preview and Production), check these are set:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
3. Leave these unset or off:
   - `VITE_USE_FIREBASE_EMULATORS` (dev-only, and ignored by production builds anyway)
   - `VITE_SECURE_RADAR`, `VITE_SECURE_PRESENCE`, `VITE_TURN_*`, `VITE_ENABLE_ADS_PROTOTYPE`
4. Optional: set `VITE_PUBLIC_APP_URL` to the production URL so share links point there.
5. `vercel.json` already rewrites all routes to `index.html`.
6. Smoke test the preview: log in, Home, a profile, Messages, Marketplace, Settings → Privacy / Notifications / About, Saved, Notifications, Campus Rank.

## 3. Firebase deploy order (approval needed for each)

Target project: `campinity-app`. Run from the release workspace with the Firebase CLI logged in as the owner.

### 3a. Firestore indexes (safe, additive)

```bash
firebase deploy --only firestore:indexes --project campinity-app
```

This adds `notices (audienceKeys CONTAINS, publishAt DESC, expiresAt DESC)` and `noticeGroups (status ASC, updatedAt DESC)`. Wait until both show **Enabled** in the console before step 3b.

### 3b. Firestore rules (changes production security rules)

- **Before:** Firebase console → Firestore → Rules → note the current version. The rules history there is the rollback point.
- Run:

  ```bash
  firebase deploy --only firestore:rules --project campinity-app
  ```

- What changes versus live, all covered by emulator tests:
  - Notice Board collections: clients get read-only access to published notices for their audience; all writes go through the functions.
  - Settings hardening hunks, as reviewed earlier.
  - **groupCalls fix:** the in-app "incoming group call" listener was always denied, so group calls never rang in-app. Members can now list by `participantUids`, and create checks that `participantUids` is a subset of the real chat roster.
- `storage.rules`: unchanged, no deploy needed. Notice images are written by the function and served by download-token URL.

### 3c. Notice Board functions (5 new callables)

```bash
firebase deploy --project campinity-app --only functions:adminListNotices,functions:adminSaveNotice,functions:adminSetNoticeState,functions:adminDeleteNotice,functions:adminUploadNoticeImage
```

- **Do not** run a bare `firebase deploy --only functions`. It would also try to deploy `getTurnCredentials`, which needs Cloudflare secrets that don't exist yet. It would also redeploy every other function.
- After deploying, check:
  1. Admin app → Notice Board → create a draft, publish it to a test audience, unpublish it, then delete it.
  2. The main app's profile Notice Board shows a published notice to its audience and nothing to other users.
  3. Each action appears in Audit Logs.

### 3d. Not in this release

- `getTurnCredentials`: needs the `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN` secrets, which may cost money.
- `VITE_SECURE_RADAR` / `VITE_SECURE_PRESENCE`: stay off.

## 4. Android

- Debug APKs are built from this branch and installed on the Samsung A15:
  - Main app: `android/app/build/outputs/apk/debug/app-debug.apk`
  - Admin app: `admin-app/android/app/build/outputs/apk/debug/app-debug.apk`
- Play Store / signed release: needs the owner's keystore, which is not in the repo. Use `./gradlew assembleRelease` or `bundleRelease` with `keystore.properties`, which is gitignored.

## 5. Merge and production web

1. Merge the PR into `main` after the preview and 3a–3c pass.
2. Vercel production deploys from `main`.
3. Re-run the step 2 smoke test on production.

## 6. Rollback

| What | How |
|---|---|
| Web | Vercel → Deployments → previous production deployment → *Promote* / *Instant Rollback* |
| Firestore rules | Console → Firestore → Rules → history → previous version → *Publish*, or re-deploy `firestore.rules` from `main` |
| Notice functions | `firebase functions:delete adminListNotices adminSaveNotice adminSetNoticeState adminDeleteNotice adminUploadNoticeImage --project campinity-app`. The app already shows a calm "Notice Board unavailable" state when they are missing. |
| Indexes | Harmless to keep; delete in the console if needed |
| Android | Reinstall the previous APK |

## 7. Admin password rotation (only when the owner decides)

`functions/scripts/admin-device-owner.cjs rotate-password`:

```bash
node functions/scripts/admin-device-owner.cjs rotate-password --project=campinity-app --confirm=campinity-app --end-sessions
```

- Run it in an interactive terminal on the owner's laptop. It asks for the new password twice with hidden input.
  - It refuses passwords given as arguments or through pipes, files or environment variables.
  - It refuses passwords shorter than 12 characters and reuse of the current password.
- It updates the existing `adminSession/config` inside a transaction:
  - It never creates, deletes or recreates the document.
  - It keeps `createdAt` and `createdByUid` and adds `rotatedAt`.
- Enrolled devices are untouched, so the A15 stays enrolled.
- `--end-sessions` signs out active admin sessions so the next unlock needs the new password.
- It writes an `admin_password_rotated` audit entry that contains no secret.
- Tested on the emulator only (`tests/rules/admin-password-rotation.emulator.test.mjs`), including a real device-bound login with the new password.

## Known test-environment flakiness (not app bugs)

Against the local Firebase emulators, the browser's Firestore connection sometimes goes `unavailable` or stalls for 20–45 s, and Storage-emulator uploads can take up to ~45 s.

- The same queries take 0.1 s when measured directly.
- The app now handles these stalls better: profile-listener retry, Home feed timeout with "Try again", and a group-call listener error handler.
- Sign-in, Home, profile, settings, Notifications and Marketplace were checked on the A15 against production and were fast. That check was read-only; no posts, chats, stories or listings were created there.
