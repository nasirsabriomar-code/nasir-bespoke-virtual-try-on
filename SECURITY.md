# Security and Privacy Notes

This file documents the current implementation, not a claim of formal compliance.

## Current protections

- Staff authentication is server-validated.
- Passwords are stored as bcrypt hashes in an environment-supplied allowlist.
- Sessions use signed JWTs plus an active-session record.
- Production cookies are HttpOnly, Secure, SameSite=Strict, and __Host__ prefixed.
- Login and generation requests are rate-limited.
- Generation requires authentication before upload parsing or OpenAI invocation.
- Same-origin and Fetch Metadata checks protect state-changing requests.
- Multipart fields are allowlisted.
- JPEG, PNG, and WebP signatures are checked server-side.
- Individual and declared request-size limits are enforced.
- Catalog IDs and bespoke configuration are resolved server-side.
- Arbitrary prompt, model, provider, endpoint, and remote reference fields are rejected.
- OPENAI_API_KEY is server-only.
- OpenAI errors are sanitized before reaching users.
- Private Vercel Blob mode is used when the Blob token is configured.
- Sensitive responses use private/no-store caching headers.
- CSP, HSTS, frame denial, MIME sniffing prevention, strict referrer policy, and permissions restrictions are configured.
- Robots metadata prevents search indexing.

## Current security boundaries

The application is an internal staff tool, not a public consumer service. All authenticated staff currently use the same broad access model: History and retained generation assets are not scoped by employee or showroom. The system has no MFA, password reset, password change, account disablement, or role administration yet.

If Blob storage is not configured, images are processed transiently and History is metadata-only. If Blob storage is configured, images are stored as private objects, but current history trimming does not automatically delete old or orphaned Blob objects.

Prototype catalog references live in public/catalog. Do not place confidential Nasir Bespoke designs there without first changing the storage/access model.

## Known future improvements

1. Resource-level authorization for History and image assets.
2. Explicit staff, manager, and administrator roles.
3. MFA or passkeys.
4. Per-username plus per-IP login throttling.
5. Password change/reset and session invalidation.
6. Blob retention, deletion, and orphan cleanup.
7. Server-side image decode/re-encode and pixel limits.
8. Per-IP generation limits, concurrency limits, idempotency, and spend alerts.
9. Security-event logging for authentication, authorization, and asset access.
10. Private storage for proprietary catalog references.
11. Watermarking, DLP, and export controls where business policy requires them.

## Secret handling

Never commit:

- OPENAI_API_KEY
- AUTH_SESSION_SECRET
- AUTH_USERS_JSON_BASE64
- UPSTASH_REDIS_REST_TOKEN
- NASIR_BLOB_READ_WRITE_TOKEN
- passwords, bcrypt hashes, session tokens, or production URLs containing credentials

Use .env.example for names and placeholders only. Use Vercel Sensitive Environment Variables for production secrets.

## Security review commands

    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm audit --omit=dev --audit-level=high

Do not run paid OpenAI generations as part of routine CI or security testing.
