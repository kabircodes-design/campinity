# Campinity email verification — which flow is active

## Active now: Firebase built-in verification (no domain needed)

- **Switch:** `VITE_EMAIL_VERIFICATION_PROVIDER` is unset or anything other than `custom`, which means `firebase`. It's read in `src/firebase/emailVerificationService.js`, the only place that decides.
- **Sending:** `sendEmailVerification(user, { url: <app>/verify-email?verified=1 })`.
  - Firebase sends it from `noreply@campinity-app.firebaseapp.com`, using the project's "Email address verification" template (Firebase Console → Authentication → Templates).
  - If the continue URL is ever rejected (not an authorized domain), the email is sent without it rather than failing.
- **The link:** opens Firebase's hosted action page (`https://campinity-app.firebaseapp.com/__/auth/action?...`). That page marks the account verified and shows **Continue**, which returns to `/verify-email?verified=1`.
- **The app:** reloads the user (`user.reload()`) and grants access **only** if Firebase reports `emailVerified === true`. Nothing in the app marks an account verified.
- **Recovery for existing unverified accounts:** log in, which routes to `/verify-email`, then tap **Send verification email**.
- **Cooldown:** 60 s in the app. Firebase's own limit (`auth/too-many-requests`) also applies and is shown clearly.
- **Signup:**
  1. `createUserWithEmailAndPassword`
  2. `users/{uid}` default doc (non-blocking; recreated by `ensureUserDoc` if it failed)
  3. `sendVerificationEmail`
  4. `/verify-email`

The Resend Cloud Functions (`createEmailVerification`, `resendEmailVerification`, `verifyEmailVerificationToken`) are **not called** by the app in this mode. They stay deployed or deployable and untouched. Old `?token=` links show "This link is from an older email" with a way to get a new one.

## Later: switch back to the custom Resend flow

Once you own a domain:

1. **Resend:** add the domain or subdomain (e.g. `mail.yourdomain`), create the DKIM / SPF / DMARC DNS records Resend shows, and wait for **Verified**.
2. **Functions config:** add `functions/functions/.env.campinity-app` with
   `EMAIL_FROM_ADDRESS=Campinity <verify@mail.yourdomain>` (plain config, not a secret).
   `RESEND_API_KEY` already exists in Secret Manager. Make sure the key may send from the new domain.
3. **Deploy:** `createEmailVerification`, `resendEmailVerification` and `verifyEmailVerificationToken`. Their code is in `functions/functions/index.js` and `functions/functions/email/*`; the branded template is in `mailer.js`.
4. **Frontend:** build with `VITE_EMAIL_VERIFICATION_PROVIDER=custom`, then deploy. Links become `/verify-email?token=…` and are verified server-side.
5. **Test** with a fresh account before announcing.

Only one mechanism is ever active: the frontend flag decides which sender is called and which link format `/verify-email` accepts. Firebase's `?mode=verifyEmail&oobCode=` links remain handled in both modes, in case the Console action URL is ever pointed at the app.
