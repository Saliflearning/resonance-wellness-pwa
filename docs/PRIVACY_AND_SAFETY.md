# Privacy And Safety Notes

Resonance has three data modes:

- Guest mode: stores app data in the browser with `localStorage`.
- Account mode: uses Firebase Authentication and syncs app data to Firestore.
- Optional AI mode: holds a user-provided Gemini API key in `sessionStorage`
  for the current tab only. It is removed when the tab closes.

## User Data Stored Locally

The app may store:

- Theme, accent, language, output, and volume preferences.
- Session progress, streak, stats, favorites, reminders, journal entries, and custom plans.
- Selected zodiac sign and optional birth/location inputs used for insight features.
- The Gemini key is not part of durable local data and is never synced.

## Safety Boundaries

Resonance is a wellness and mindfulness app. It should never present frequency sessions, astrology-style guidance, or Benner-cycle content as medical treatment, diagnosis, emergency support, or financial advice.

## Implementation Rules

1. Do not log secrets, Firebase tokens, or Gemini keys.
2. Send Gemini keys only to the intended Google AI endpoint, in the
   `x-goog-api-key` header rather than the URL.
3. Keep password fields using `type="password"` and appropriate autocomplete values.
4. Keep the Privacy & Safety center reachable from the drawer.
5. Any reset/delete flow must clearly indicate what will be removed before it runs.
6. Keep Firestore account data scoped to `users/{uid}` and publish `firestore.rules` before public account use.
7. Escape user-controlled content before rendering with `innerHTML`.
8. Keep deployment security headers active in `vercel.json`.
9. Do not allow client-side Firestore deletes for account documents unless a dedicated recovery/export flow exists.
