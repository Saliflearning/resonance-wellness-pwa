# Architecture

## Runtime

`index.html` contains the UI, CSS, translation dictionaries, audio/session
logic, Firebase integration, storage adapters, and rendering functions. The app
registers `sw.js` and `manifest.json` for installation and offline app-shell
behavior. No bundler or server runtime is required.

## Data boundaries

1. Guest mode writes preferences, progress, plans, journal entries, reminders,
   and optional birth inputs to browser `localStorage`.
2. Account mode uses Firebase Authentication. Allowlisted local values are size
   bounded before being copied to the authenticated user's `users/{uid}`
   Firestore document.
3. The optional Gemini key is held in `sessionStorage`, excluded from sync, and
   sent directly to Google's API in a request header. The app falls back to an
   offline keyword recommender when no key is present or a request fails.
4. User-authored and model-returned text is bounded and encoded before entering
   HTML templates. Structured frequency and duration values are allowlisted and
   clamped.

## Trust model

- The browser and static assets are public.
- Firebase browser configuration is a public client identifier, not an admin
  secret. Firestore rules and authenticated ownership are the authorization
  boundary.
- Browser storage is user-controlled and may be malformed or malicious; parsing
  uses safe fallbacks and rendering treats values as untrusted.
- Gemini output is untrusted external input.
- Wellness, astrology, lunar, and market-cycle content is interpretive and must
  not be converted into medical, scientific, or financial claims.

## Delivery controls

- Vercel headers define CSP, HSTS, framing, referrer, resource, and permissions
  policies.
- CI runs repository-history safety, dependency audit, content assertions,
  security invariants, and a deterministic Playwright flow.
- CodeQL, dependency review, and Dependabot provide independent maintenance
  signals.

## Deliberate tradeoffs

The single-file architecture keeps the PWA deployable as static files and
preserves the current product, but it increases review and refactoring cost.
Future modularization should be incremental and browser-tested. A production AI
feature should use a server-side proxy rather than asking users for browser-held
keys.
