# Contributing

1. Create a focused branch and avoid unrelated content or generated local state.
2. Never use real user, owner, client, journal, birth, location, email, or phone data.
3. Keep medical, biological, financial, and guaranteed-outcome claims out of the UI.
4. Run `npm ci`, `npm test`, `npm run test:smoke`, and the repository safety scans.
5. Run `npm run test:stress` for layout, navigation, settings, storage, or modal changes.
6. Open a pull request and wait for all required CI, CodeQL, and dependency checks.

Do not deploy Firestore rule or authentication changes without an explicit
review of the production Firebase project and rollback plan.
