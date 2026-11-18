# CAMPINITY ADMIN — private admin app

A separate Android app (`com.campinity.admin`, debug builds `com.campinity.admin.debug`) that contains **only** the Admin Control Center. It installs side by side with the public **Campinity** app (`com.campinity.app`), which it does not change.

## How access works

You need all four of these to get an admin session. Every one of them is checked **on the server**.

1. **Firebase sign-in** with the owner's Campinity account (email + password; Google pop-ups don't work in the app).
2. **An enrolled device.** The phone holds a P-256 key generated inside Android Keystore (StrongBox or TEE). The key can't be exported, and the server stores only the public key.
3. **The admin password.** It's stored on the server only as a salted scrypt hash.
4. **A signature from the device key.** The key signs a single-use 2-minute challenge at login, and then **every admin request**: the session-token hash, a timestamp, a fresh nonce, and a hash of the request body.

A copied APK on another phone has no key, so it's refused, even with the correct password. A stolen session token is useless on its own, because each call needs the phone's signature and the same Firebase account. Old or repeated requests are rejected.

| Limit | Value |
|---|---|
| Session length | 8 hours absolute, 30 minutes idle. Reopening the app inside that window resumes the session without the password. |
| Failed attempts | 5 per 15 minutes per account, then a 15-minute lock |
| Enrollment code | 10 minutes, single use, bound to your account, dies after 3 wrong passwords |
| Revocation | Immediate: all of the device's sessions end |

**What isn't stopped:** someone who has your *unlocked* phone, your Campinity login and the admin password. Revoke the device as soon as a phone is lost.

**Other protections in the app:**
- Screenshots, screen recording and the recent-apps preview are blocked (`FLAG_SECURE`).
- Android backup and device-to-device transfer are disabled.
- WebView debugging is off.

The browser panel at `/admin` follows the same rules: a laptop browser must be enrolled as a device too. Its key is a non-exportable WebCrypto key in that browser, which is software-protected, not hardware.

## Build

```sh
# from the repo root
npx vite build --config admin-app/vite.config.mjs        # web bundle -> admin-app/dist
cd admin-app && node ../node_modules/@capacitor/cli/bin/capacitor sync android
cd android && ./gradlew assembleDebug                      # needs JAVA_HOME = a JDK 21 (e.g. ~/.jdks/jbr-21.0.11)
# APK: admin-app/android/app/build/outputs/apk/debug/app-debug.apk
```

Do not run `npm install` inside `admin-app/`; it uses the repo root's `node_modules`.

**Signed release build (when you have a keystore):** create `admin-app/android/keystore.properties` with `storeFile`, `storePassword`, `keyAlias` and `keyPassword`, then run `./gradlew assembleRelease`. That file and `*.jks` / `*.keystore` are gitignored; never commit them. Use a keystore that is separate from the public app's Play Store key. Keep a backup: updates must be signed with the same key.

## Install on your phone

1. Copy the APK to the phone, or with USB/wireless debugging: `adb install -r app-debug.apk`.
2. When asked, allow installing from that source.
3. The launcher shows **CAMPINITY ADMIN** (debug: "CAMPINITY ADMIN (debug)"): the Campinity mark on a dark tile with an amber lock badge.

## First-device enrollment (after the backend is deployed)

1. On your laptop (with `firebase login` already done):
   ```sh
   node functions/scripts/admin-device-owner.cjs create-code --project=campinity-app --email=<your owner email> --confirm=campinity-app
   ```
   It prints a one-time code like `K7Q2-9XMD-4WVH`, valid for 10 minutes.
2. On the phone, open CAMPINITY ADMIN and sign in with your Campinity email and password.
3. Enter the code and the admin password, name the device, then tap **Authorize this device**.

**To add another device later** (a second phone or a laptop browser): on an already-authorized device, open **Admin → Devices → Approve a new device**. Enter the code it shows on the new device.

## Lost phone / recovery

- **From another authorized device:** Admin → Devices → **Revoke** the lost phone.
- **No other device:**
  ```sh
  node functions/scripts/admin-device-owner.cjs list --project=campinity-app
  node functions/scripts/admin-device-owner.cjs revoke --device=<id> --project=campinity-app --confirm=campinity-app
  # or: revoke-all
  ```
  Then enroll your new phone with a fresh code (see above).

**Other cases:**
- **Uninstalling the app or clearing its data** destroys the key. The device then needs a new code; revoke the old entry.
- **Changing the admin password** isn't available in the app yet (it was never built). Rotating it requires a backend change.

## Deployment still required (nothing has been deployed)

1. **Cloud Functions:** deploy them together, then deploy the web/Vercel frontend.
   - **12 new:**
     - `adminGetCapabilities`, `adminLoginFinish`, `adminEnrollDeviceStart`, `adminEnrollDeviceFinish`
     - `adminListDevices`, `adminRevokeDevice`, `adminCreateEnrollmentCode`
     - `adminGetDashboard`, `adminSearchUsers`, `adminGetUserDetail`, `adminGetReportContext`, `adminGetSystemHealth`
   - **27 changed:** all 26 existing `admin*` functions (device-bound session check, new login flow, read-only verification list, paging, audit entries) plus `checkAdminPasswordExists` (no longer leaks internal errors).
   - **Once the new functions are live, the current admin web panel stops working** until the new frontend is deployed and that browser is enrolled.
   - Existing admin sessions become invalid.
2. **Firestore:** no rules change and no composite indexes are needed. The new collections (`adminDevices`, `adminEnrollmentCodes`, `adminAuthChallenges`, `adminAuthAttempts`) are covered by the existing catch-all deny rule. Optional: a TTL policy on `adminAuthChallenges.expiresAt` and `adminEnrollmentCodes.expiresAt` for cleanup.
3. **IAM (System Health only):** grant the functions' runtime service account `roles/logging.viewer`.
4. **Firebase Auth:** the owner account must have an email/password sign-in method.
