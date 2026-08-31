# Resonance Project Structure

Resonance is currently a static PWA hosted from GitHub and deployed to Netlify/Vercel. The production app is intentionally simple to host:

- `index.html` - Main application shell, styles, UI, Firebase Auth/Firestore integration, audio/session logic, and PWA registration.
- `manifest.json` - PWA install metadata and shortcuts.
- `sw.js` - Service worker cache for offline app shell support.
- `icon-192.png`, `icon-512.png` - PWA icons.
- `scripts/stress-test.mjs` - Browser stress test across phone, tablet, and desktop viewports.
- `scripts/feature-smoke.mjs` - Deterministic core feature smoke test.
- `scripts/security-tests.mjs` - Static security and trust-boundary invariants.
- `scripts/repository-safety.py` - Current-tree, history, and commit-metadata privacy gate.
- `firestore.rules` - Firestore access rules for user-owned documents.
- `docs/FIREBASE_AUTH_USERS.md` - Firebase Auth, authorized domains, and user document notes.
- `design-system/resonance-777/MASTER.md` - UI/UX Pro Max design direction for future improvements.

## Stability Rules

1. Do not replace `index.html` wholesale unless there is a migration branch and a passing test run.
2. Treat Firebase Auth and Firestore functions as protected code paths.
3. Run `scripts/stress-test.mjs` after every UI or behavior change.
4. Run `scripts/feature-smoke.mjs` after changing navigation, modals, settings, auth, or privacy surfaces.
5. Keep `.netlify` and `.vercel` uncommitted because they are local deployment metadata.
6. Keep Gemini keys session-only and never add medical, biological, financial,
   or guaranteed-outcome claims.

## Refactor Direction

The app can be gradually split into `assets/css`, `assets/js`, and `assets/data` later, but only in small verified batches. The current priority is keeping production stable while tests and documentation create guardrails around future refactors.
