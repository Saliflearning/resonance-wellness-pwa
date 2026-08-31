# Firebase Auth And Users

Resonance uses Firebase Authentication for accounts and a Firestore document at `users/{uid}` for synced app data.

## Firebase Console Checklist

1. Authentication -> Sign-in method: enable Email/Password.
2. Authentication -> Settings -> Authorized domains: add every production domain:
   - `resonance-777.vercel.app`
   - any Netlify domain you still use
   - any future custom domain
3. Firestore Database -> Rules: publish `firestore.rules` from this repo.
4. Firestore Database -> Data: user documents should live only under `users/{uid}`.

## User Document Shape

Each signed-in user owns exactly one document:

```text
users/{firebaseAuthUid}
```

The app stores a `profile` object plus synced local app keys:

- `profile.uid`, `profile.email`, `profile.displayName`, `profile.emailVerified`
- `profile.providerIds`, `profile.createdAt`, `profile.lastLoginAt`
- `schemaVersion`, `updatedAt`, `lastSynced`
- app state fields such as `prog`, `stats`, `journal`, `favs`, `reminders`, `custom-plan`

## Safety Rules

- Never store passwords, Firebase tokens, or Gemini API keys in Firestore.
- Keep optional Gemini keys local to the browser.
- Do not create shared/global user documents unless a separate rules review is done first.
- Any new collection should default to denied until a rule and test are added.
- Keep client writes limited to the allowlisted `users/{uid}` fields in `firestore.rules`.
- Keep every synced field type-checked and size-bounded in both the browser and
  Firestore rules. Validate rule changes in a non-production Firebase project
  before deployment.
- Client-side deletes are denied for `users/{uid}` to reduce accidental or malicious account data loss.
