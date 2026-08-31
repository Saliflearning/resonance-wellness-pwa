# Release Evidence

The public portfolio release is built from a fresh Git history rather than the
legacy development repository. This prevents unrelated historical branches,
old commit metadata, and private-source artifacts from becoming part of the
showcase.

## Verified gates

- Repository safety scanner self-tests pass.
- Current tracked content passes legal-name, contact-data, private-path, and
  credential checks.
- Every reachable Git blob and commit identity passes the same history gate.
- `npm audit` reports zero known vulnerabilities.
- Content and security invariant suites pass.
- Playwright functional smoke testing passes against both loopback and the
  production deployment.
- Four viewport stress runs complete 560 interactions with no page-level
  horizontal overflow, console errors, or page errors.
- Production returns the configured CSP, HSTS, COOP, and CORP headers.
- Firebase writes remain owner-scoped, field-allowlisted, type-checked, and
  size-bounded; rule deployment is intentionally handled separately from this
  static-site release.

## Canonical locations

- Source: <https://github.com/Saliflearning/resonance-wellness-pwa>
- Production: <https://resonance-wellness-pwa.vercel.app>

The legacy development repository remains private and is not a release source.
