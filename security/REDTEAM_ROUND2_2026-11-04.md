# Red-team review, round 2 — 4 November 2026

Target: current Nasir Bespoke working tree, including the uncommitted first-round patches. This was local source review and bounded synthetic reproduction, not a live penetration test. No production credentials, real customer photos, live storage calls or paid generations were used. Application behavior was not changed in this round.

## RT2-01 — High: legacy multipart requests bypass preprocessing admission controls

Threat: an authenticated or compromised staff account can repeatedly trigger expensive image decoding despite an existing in-flight generation. The new upload controls protect the chunked-upload endpoints, but the legacy POST /api/try-on multipart path remains available directly.

Source: lib/try-on-handler.ts, lines 738–754 perform complete image decoding. The account lock is acquired at line 849 and generation rate limits are checked at line 872. Legacy multipart has neither the new upload admission limit nor a preprocessing concurrency lease before this work.

Reproduction: hold the synthetic account's generation lock. Submit three valid 6,000 × 6,000 PNGs, each compressed to 488,730 bytes, through the actual route handler with a synthetic authenticated-user dependency. The request still processes 108 million decoded pixels before returning 409, taking approximately 324 ms on this machine. The rate-limit dependency is never invoked and no provider call occurs. A truncated counterpart returns an image-validation error rather than the busy-account rejection, independently confirming validation precedes admission.

Impact: CPU/memory pressure and function-cost amplification. This does not bypass paid-call quotas or expose another account's photos. Production edge/WAF limits were not inspected and could limit exploitation.

Fix: protect every ingestion path with an early, independently metered preprocessing admission/concurrency guard before body parsing and decoding, or explicitly disable the obsolete multipart endpoint. Do not simply move paid-generation quota charging ahead of malformed-input validation. Preserve trusted internal handoff handling without accepting a client-controlled bypass header.

## RT2-02 — Medium: catalogue recovery bypasses body deadlines and upload throttles

Threat: a staff session can hold recovery requests open while sending very little data. POST /api/catalogue-recovery uses its own reader loop and does not use readBoundedBody, upload rate limits or upload concurrency leases.

Source: app/api/catalogue-recovery/route.ts, lines 17–38. The SHA-256 check occurs only after the entire body is read, at lines 39–41. The approved-reference checksum correctly prevents arbitrary content replacement, but does not limit slow-body resource consumption.

Reproduction: create a real synthetic staff session, select an approved fixture reference from the actual recovery manifest, send one byte and hold the stream open. The handler is still awaiting the body after 31 seconds, exceeding the 30-second application deadline imposed on normal uploads. Closing the stream returns 400 due to the checksum mismatch. No R2 request occurs.

Impact: concurrent slow-body requests can consume function occupancy/concurrency and cost. This is authenticated resource abuse, not arbitrary catalogue poisoning. Platform-enforced deadlines still apply where configured; there is no application-level read deadline on this path.

Fix: reuse bounded body reading with an absolute deadline; add account/global recovery throttling and concurrency caps. Decide whether shared catalogue restoration should require the explicit admin role.

## RT2-03 — Medium: failed deletions can permanently starve later cleanup work

Threat condition: persistent failures among the earliest queued deletions prevent unrelated healthy records from being processed. This is a retention/privacy reliability defect; the reproduction does not establish that an ordinary staff user can force a specific R2 object to fail permanently.

Source: lib/highres/ledger.ts, lines 279–284 always select the earliest pending records by requested_at. lib/history/deletion.ts, lines 39–42 process at most 100 and log failures without rescheduling their next attempt or advancing a cursor.

Reproduction: queue 101 synthetic generations with canonical paths. Make storage fail only for the first 100; the final item would succeed. Run cleanup twice. Both runs return removed=0, failed=100. The healthy item is never attempted and remains queued. No live storage is contacted.

Impact: customer images can remain physically stored indefinitely even though deletion tombstones correctly block application access. The same ordering pattern exists in abandoned-upload cleanup; only the generation queue was reproduced in this round.

Fix: persist attempt count/next-attempt time, apply backoff and fair scheduling, and expose backlog/oldest-pending alerts. A failed batch must not monopolize every future run. Preserve tombstones and retry payloads; do not mark failed deletions complete.

## Boundaries checked and limitations

The existing 12 security-remediation regression tests passed in this round. They cover owner/admin assets, scoped history, session version invalidation, upload quotas, deleted-result replay and deletion fail-closed behavior. No new cross-account read, authentication bypass or arbitrary paid provider invocation was demonstrated by these probes. This is not proof those classes are absent.

Production deployment protection, real Redis/Neon concurrency, R2 policies and live infrastructure limits remain untested. The known development-tool dependency advisories and historical orphan-object reconciliation remain tracked in REMEDIATION_2026-11-04.md; they are not counted as new findings here.

## Reproduction

Run only against the local checkout:

    NODE_ENV=test NODE_OPTIONS=--conditions=react-server node --import=tsx security/redteam-round2-probes.mts

The script refuses other NODE_ENV values, clears service credential variables in its own process, uses synthetic images/accounts, stubs storage, and injects a provider dependency that cannot generate an image. It deliberately waits 31 seconds for the recovery deadline probe. It does not start a public server, alter production data or modify application code.

Recommended repair order: RT2-01, RT2-02, RT2-03.

## Remediation verification

All three findings are patched in the current worktree. The probe script now asserts the corrected outcomes: busy legacy requests reject before validation, the second deletion batch reaches the healthy record, and stalled recovery returns 408 within the 30-second deadline. Findings above preserve the original pre-fix observations. No production deployment was performed.
