# Security remediation — 4 November 2026

Scope: Nasir Bespoke application. No production access, deployment, real customer photos or paid image generations were used.

## Findings and implemented behavior

1. Production dependencies: Next.js 16.4.5, Sharp 0.35.5, refreshed vulnerable transitive packages, and a patched Zod 4 override for the legacy Blob tooling. Production npm audit reports zero advisories. CI rejects high/critical production advisories.
2. Cross-account exposure: history queries filter ownership before pagination/counting; image views/downloads, reviews and deletion require the owner or an explicitly configured administrator. Missing roles default to staff. Redis fallback pagination now reads beyond the first 100 records.
3. Upload resource exhaustion: independent distributed account/global rate limits; atomic Neon slot/byte admission; expiring Redis concurrency leases using Redis server time; bounded body/R2/database/Redis operations. Failed cleanup leaves upload rows available for retry.
4. Session recovery after compromise: password-hash, role and authVersion changes invalidate existing JWTs, in addition to the existing shared session revocation. The JWT holds an HMAC fingerprint, not the password hash. Pre-release sessions fail closed.
5. Malformed images: server-only full decoding, single-frame enforcement, 40-megapixel/16,384-edge limits and header/decoder agreement. Original bytes remain unchanged. Tests now use decodable fixtures instead of truncated headers where an accepted image is intended.
6. Signed-URL replay after logout: both image views and downloads stream through authenticated routes with private/no-store headers. No new signed image URLs are sent to clients.
7. Retention/deletion: owner/admin deletion from History; default 30-day expiry; durable deletion tombstones prevent fallback/replay resurrection. Cleanup retries recorded R2 assets, Redis history, reviews (including removed accounts), replay caches and the permanent record. Legacy inline replay records without a generation ID are no longer replayed.

## Validation

- Lint and TypeScript checks passed.
- All 265 automated tests passed, including the new security remediation regressions.
- All 21 synthetic browser workflow checks passed, including cancelling and confirming deletion.
- Production build passed.
- Loopback HTTP security assessment passed.
- Production dependency audit: zero vulnerabilities. Full development-inclusive audit: 14 moderate findings in the lint dependency chain, rooted in minimatch versions below 11. These are build-tool findings, not demonstrated application endpoints. npm proposes incompatible tool downgrades; do not use audit fix --force. A compatible lint-tool migration remains separate follow-up work. There are no remaining high/critical dependency findings in either audit.

## Rollout notes

- Nothing is deployed. Runtime verification used memory stores, synthetic fetch fixtures and loopback services; live Neon/Upstash/R2 integration remains a staging acceptance check.
- Apply the additive SQL in migrations/2026-11-04-generation-deletions.sql after existing base tables are present, or allow the existing ledger initializer to create the deletion table. The additional indexes are recommended for owner queries, upload quotas and deletion backlog reads.
- Staff must sign in again. All existing allowlist entries become owner-scoped staff. Grant role "admin" only to intended cross-account administrators; the browser cannot grant roles. Increment a user's string authVersion to revoke all of their sessions.
- GENERATION_RETENTION_DAYS defaults to 30; allowed range 1–365. Confirm the business retention period before production rollout: deployment will hide expired history and the existing protected daily cleanup will delete recorded expired assets. Monitor cleanup failures and backlog; cleanup is bounded and may require extra runs to drain older data.
- The Neon database is authoritative for deletion tombstones. Persistent history/replay access fails closed if tombstones cannot be checked; legacy generation can still return its first transient image response without permanent history.
- Pre-release signed URLs can remain valid for their original five-minute lifetime. Images already downloaded, browser-cached or exported cannot be recalled by server deletion.
- History-based cleanup cannot discover objects orphaned before any history write. Storage-inventory reconciliation and infrastructure backup retention require a separate operational cleanup. No production bucket or backup policy was changed.
