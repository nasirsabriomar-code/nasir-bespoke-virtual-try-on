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

## Upload and image controls

- Complete single-frame JPEG/PNG/WebP decoding is required before acceptance. Header-only/truncated containers, images above 40 megapixels or 16,384 pixels per edge, and animated images are rejected. Originals are preserved.
- Upload-slot admission is atomic across instances: at most 12 unconsumed active slots and 200 MiB per account, with a 2 GiB application cap. Neon transaction locks serialize quota checks.
- Upload creation is capped at 50/account/day and 250/application/day. Chunk writes are capped at 180/account/minute and 1,800/application/minute; completion at 12/account/minute and 120/application/minute.
- Shared Redis leases allow four active chunk writes and one completion per account. Production fails closed when shared controls are unavailable. Leases expire after 330 seconds; the routes have a 300-second maximum duration.
- Request body reads have a 30-second total deadline and R2 operations a 15-second deadline. Images are streamed through authenticated same-origin routes with private/no-store headers; no new R2 bearer URLs are sent to the browser.
- Production packages are audited separately from development-tool advisories. CI must reject high/critical production advisories.

## Current security boundaries

The application is an internal staff tool, not a public consumer service. History, image views/downloads, reviews and deletion are scoped to the generating username. Allowlist entries default to `role: "staff"`; only explicit `role: "admin"` entries can access other accounts. There is no showroom-level sharing, MFA, account-management UI or password-reset UI yet. Changing a password hash, role or string `authVersion` invalidates existing sessions; removing an account also revokes access. This release invalidates pre-versioned sessions, requiring staff to sign in again.

The full-resolution workflow requires private R2 image storage and a Neon upload/history ledger. Legacy multipart callers can operate transiently when generation storage is absent. Completed generations are retained for 30 days by default (`GENERATION_RETENTION_DAYS`, integer 1–365). Expired records are denied immediately even when cleanup is delayed. Authenticated owners/admins can delete through History. A durable Neon tombstone hides queued deletions before storage operations; the protected daily cleanup retries R2 assets, Redis history/reviews and generation replay caches, then removes the permanent record. Finished tombstones retain only UUID and request time. Abandoned-upload rows remain until all object cleanup succeeds. Already downloaded images and previously issued signed links cannot be recalled; links issued before this release expire within five minutes. Objects orphaned before any history record was written require storage inventory reconciliation; they are not discoverable through the history-based cleanup. Monitor cleanup failures/backlogs.

The active curated catalogue resolves approved private R2 references on the server. Legacy prototype assets under public/catalog remain public; do not place confidential designs there.

## Known future improvements

1. Showroom-level sharing and delegated access beyond owner/admin.
2. Managed staff/manager/administrator account lifecycle.
3. MFA or passkeys.
4. Operational alerts for login throttling (per-account and per-IP limits are implemented).
5. Password change/reset UI and administrative session controls.
6. Storage-inventory reconciliation for assets orphaned before a history write.
7. Optional metadata-stripped derivative storage; validated originals are preserved.
8. Per-IP generation limits and spend alerts.
9. Security-event logging for authentication, authorization, and asset access.
10. Remove obsolete public prototype references once no longer needed.
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

See [the remediation record](security/REMEDIATION_2026-11-04.md) for verification, additive schema, rollout behavior and remaining development-tool/inventory limitations.

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

## Second-round controls

Legacy multipart generation now uses independent preprocessing throttling and acquires the account generation lock before reading/decoding images; malformed attempts do not consume paid-generation quota. Catalogue recovery uses the same account/global validation throttle, one recovery lease per account, a 4 MiB cap and a 30-second absolute body deadline. It remains available to authenticated staff with approved-file checksum enforcement.

Failed generation deletions now persist attempt counts and next-attempt times with exponential backoff (one minute initially, capped at one hour). Cleanup only selects due records, so failing entries cannot monopolize future batches. Cron responses/logs expose pending backlog and its oldest request time in production. Apply the added retry columns/index in the additive migration before rollout, or permit the existing initializer to add the columns.
