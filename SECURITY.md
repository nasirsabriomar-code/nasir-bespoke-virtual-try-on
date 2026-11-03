# Security and Privacy Notes

This file documents the current implementation, not a claim of formal compliance.

## Current protections

- Staff authentication is server-validated.
- Passwords are stored as bcrypt hashes in an environment-supplied allowlist.
- Sessions use signed JWTs plus an active-session record.
- Development pages and APIs require the same verified staff session as other environments; no preview identity is supplied for signed-out requests.
- Persistent session activation, validation, and logout fail closed on Redis errors or a 2.5-second timeout. A local cached session cannot override shared revocation state. An unconfirmed logout returns 503 without claiming success or clearing the cookie.
- Production cookies are HttpOnly, Secure, SameSite=Strict, and __Host__ prefixed.
- Login and generation requests are rate-limited.
- Paid try-on generation uses a per-user distributed in-flight lock and user-scoped idempotency keys so one account cannot run two OpenAI calls at once and retries cannot double-charge. A leftover in-progress record for the same user and key is treated as in-flight while its lease is alive, or settled to a terminal failure after the lease expires, and never starts another paid call. Generation-guard Redis calls use a 3-second timeout and fail closed.
- Generation requires authentication before upload parsing or OpenAI invocation.
- Same-origin and Fetch Metadata checks protect state-changing requests.
- Multipart fields are allowlisted.
- JPEG, PNG, and WebP signatures are checked server-side.
- Individual and declared request-size limits are enforced.
- Incoming bodies are also bounded while streaming, including requests without Content-Length: login and upload authorization JSON 4,096 bytes, generation JSON 65,536 bytes, and legacy multipart 4,200,000 bytes. The larger internal high-resolution handoff is selected by server code, never a client header.
- Catalog IDs and bespoke configuration are resolved server-side.
- Arbitrary prompt, model, provider, endpoint, and remote reference fields are rejected.
- OPENAI_API_KEY is server-only.
- OpenAI errors are sanitized before reaching users.
- Cloudflare R2 catalogue and generation assets use private server-controlled paths and authenticated proxy routes.
- Sensitive responses use private/no-store caching headers.
- CSP, HSTS, frame denial, MIME sniffing prevention, strict referrer policy, and permissions restrictions are configured.
- Robots metadata prevents search indexing.

## Current security boundaries

The application is an internal staff tool, not a public consumer service. All authenticated staff currently use the same broad access model: History and retained generation assets are not scoped by employee or showroom. The system has no MFA, password reset, password change, account disablement, or role administration yet.

The full-resolution workflow requires private R2 image storage and a Neon upload/history ledger. Legacy multipart callers can operate transiently when generation storage is absent. History trimming does not delete completed R2 images or account-scoped review keys; completed-image retention/deletion is still a separate operational requirement. Abandoned upload cleanup is implemented.

The active curated catalogue resolves approved private R2 references on the server. Legacy prototype assets under public/catalog remain public; do not place confidential designs there.

## Known future improvements

1. Resource-level authorization for History and image assets.
2. Explicit staff, manager, and administrator roles.
3. MFA or passkeys.
4. Per-username plus per-IP login throttling.
5. Password change/reset and session invalidation.
6. Completed-image/review retention, deletion, and orphan cleanup.
7. Server-side image decode/re-encode and pixel limits.
8. Per-IP generation limits and spend alerts.
9. Security-event logging for authentication, authorization, and asset access.
10. Private storage for proprietary catalog references.
11. Watermarking, DLP, and export controls where business policy requires them.

## Secret handling

Never commit:

- OPENAI_API_KEY
- AUTH_SESSION_SECRET
- AUTH_USERS_JSON_BASE64
- UPSTASH_REDIS_REST_TOKEN
- R2_SECRET_ACCESS_KEY, R2_ACCESS_KEY_ID, DATABASE_URL and CRON_SECRET
- passwords, bcrypt hashes, session tokens, or production URLs containing credentials

Use .env.example for names and placeholders only. Use Vercel Sensitive Environment Variables for production secrets.

## Security review commands

    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm audit --omit=dev --audit-level=high

Do not run paid OpenAI generations as part of routine CI or security testing.

For a loopback-only HTTP regression check with temporary synthetic credentials and no external service configuration:

    npm run test:security:http

This starts and stops its own development server at 127.0.0.1:3147, refuses checkouts containing environment files, and checks authentication, CSRF, streamed size limits, and logout replay. See security/ASSESSMENT.md for the assessment evidence and the separate Shannon execution status.

The normal security suite includes two-process session revocation and outage checks against a loopback REST fixture. It does not contact live Upstash. CI runs local HTTP checks after the production build.
