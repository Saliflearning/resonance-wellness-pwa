# Security Policy

## Supported version

Only the current default branch is supported.

## Report a vulnerability

Use GitHub private vulnerability reporting. Do not open a public issue with a
credential, personal record, exploit payload, or account detail.

## Security boundaries

- Firebase client configuration is public; deployed Firestore rules enforce
  authenticated owner access.
- Never commit Firebase admin credentials, AI keys, tokens, private keys, user
  exports, journal entries, birth records, or contact information.
- Keep Gemini keys session-only and out of URLs, logs, Firestore, and durable
  browser storage.
- Treat browser storage, Firebase documents, and AI responses as untrusted.
- Changes to authentication, Firestore authorization, CSP, or external data
  flows require focused tests and deployment verification.
