# Local security assessment — 2026-11-02

Status: all four local fixes accepted after expanded verification; Shannon remains a separate, provider-blocked assessment milestone.

## Scope and execution

The owner authorized testing and patching this application in local/staging environments only. The live target used here was exclusively `http://127.0.0.1:3147`, running the supplied checkout. No staging address was supplied. No production target, external application service, external callback, model API, real customer data, or production credential was used. No deployment or database migration was performed.

Baseline commit: `6b4ed8dbca799f74cf64383a7214fac5799088b0`.

The development server was launched with a minimal environment, external integration credentials omitted, and Next telemetry disabled. The repeatable HTTP regression script also refuses checkouts containing `.env` files, creates temporary random credentials, waits for its own child to acquire the loopback listener, disables redirect following, and stops its server afterward. Production session-store branches were exercised only in local tests with mocked Redis responses; no live production Redis was contacted.

## Shannon 3.5.0 execution — blocked by provider access

The latest npm `@keygraph/shannon` version resolved to **3.5.0**. Its matching worker image was pulled successfully: `keygraph/shannon:3.5.0`, digest `sha256:7824cff7c54d63836d321a057bdc59c54d85dc0dde7fe486f837592a36a58c4e`. Docker Desktop 29.9.2 was available at its explicit application path. The existing Pi authentication contained the `openai-codex` subscription provider; no token was displayed, copied into the application, or committed.

The application was started on **127.0.0.1:3147** using two synthetic staff accounts, a random session secret, disabled telemetry, and no external application integration credentials. An actual worker-image request to `http://host.docker.internal:3147/login` returned 200. No LAN binding change was required. Local requests independently confirmed unauthenticated history returned 401 and synthetic staff login and authenticated history returned 200.

The full scan was launched with authenticated engagement rules, Agentic SAST, exploitation enabled, the read-only application repository, and the Codex subscription model `openai-codex:gpt-6-sol`. Unrelated host forwarding was disabled. An initial redundant Git-directory exclusion was removed after scope preflight rejected it; the final configuration passed preflight.

| Run property | Value |
| --- | --- |
| Workspace | `bespoke-local-20261102-scan` |
| Workflow | `bespoke-local-20261102-scan_shannon-1793636659523` |
| Target | `http://host.docker.internal:3147` |
| Started | 2026-11-02 21:54:20 IST |
| Ended | 2026-11-02 21:54:39 IST |
| Duration | 18.6 seconds |
| Configuration, model authentication, target connectivity | Passed |
| Cyber-access verification | Failed |
| Terminal error | `PROVIDER_CYBER_ACCESS_REQUIRED` |
| Analysis/exploitation agents run | 0 |
| Shannon assessment report/findings | Not produced; no assessment occurred |

Shannon's exact terminal diagnostic:

> The AI provider declined the security workload; your organization needs cyber-access approval.

This is a provider access gate, not a Docker, networking, application-login, or subscription-authentication failure. No model downgrade, probe removal, provider substitution, or other workaround was attempted. Shannon's documentation directs OpenAI users to [cyber-access verification](https://chatgpt.com/cyber). [Official OpenAI documentation](https://developers.openai.com/api/docs/guides/safety-checks/cybersecurity) explains that cyber access is reviewed and applies to the approved identity, workspace or organization, model, and product surface. Approval for a different surface cannot be assumed to apply to this subscription-backed tool.

The scan was monitored to its terminal failed state. Its sanitized workflow log is preserved in `security/shannon-2026-11-02-workflow.log` and its version, scope, and result metadata in `security/shannon-2026-11-02-run.json`. Checksums confirmed Shannon changed none of the 136 application/source files recorded before launch. The local server and the idle Temporal container created for this attempt were stopped; saved workflow data and the user's Docker/authentication setup were preserved.

After this attempt, `node scripts/verify.mjs` passed lint, type checking, and all 169 regression tests for the existing fixes. No new application vulnerability findings or scan-derived patches were produced.

A completed Shannon scan and exploit retest remain outstanding until the provider approves this workload for the exact account/workspace/product surface. The saved local engagement can then be relaunched without changing its target or bypassing the access gate. The supplied source ZIP is retained beside the application, but the scan used the latest npm CLI rather than its previously unbuilt launcher.

`security/shannon-local.json` remains a credential-free engagement template. Runtime synthetic credentials live only in the private local assessment directory outside the application repository. Scope rules are guidance, not a network firewall. The findings below come from the prior local review, executable regressions, and loopback HTTP tests; they are not attributed to Shannon.

## Implementation completion and acceptance

All four behavior contracts are verified locally. Existing patches were retained, and five additional regression tests bring the full suite from 169 to **174 passing tests**. The original 13 assessment regressions remain present; that file now contains 16 tests. Additional coverage includes a two-process session integration test and a large-original JSON handoff test.

- Two separate Node processes execute the production session-store branches against one loopback Redis REST fixture. A session created in one process is valid in the other; shared revocation makes both reject it. Immediate errors and hanging responses cover activation, validation and logout, with bounded completion and sanitized failures. Failed login activation sets no cookie. Storage recovery and confirmed logout preserve normal behavior.
- Byte-boundary tests cover exact limits and one-byte-over bodies at each configured size, UTF-8 multibyte content, and missing/understated lengths. The HTTP checker covers actual chunked transfer. Expired/revoked sessions are rejected and unrelated malformed cookies do not damage a valid session.
- A mocked-storage/provider test preserves the complete original bytes of a valid PNG larger than the legacy multipart cap through the trusted JSON handoff. Existing chunk upload and 50 MB image validation regressions remain passing. No paid generation occurred.
- `npm run test:security:http` is now available and CI runs it sequentially after the production build. The HTTP checker cleans up its server on completion, error, SIGINT and SIGTERM; fixture workers exit if their parent disconnects.

Final checks passed: lint, type checking, 174 tests, production build, local HTTP security checks and diff whitespace validation. These are local results; CI configuration was updated but no remote CI run or deployment was triggered. Cross-process tests validate this application's REST adapter and failure handling against a fixture, not live Upstash behavior.

Redis outages intentionally deny session-dependent access until recovery. Cookie formats, the shared-staff history policy, database schema and production configuration are unchanged. Shannon completion is not an acceptance gate for these four fixes, as agreed; its broader assessment remains open.

## Confirmed findings and fixes

### A-01 — High: development authentication bypass

`requireRequestUser` supplied the `showroom` identity when no verified session existed in development. Both protected pages duplicated the fallback. Any client reaching that development server could access staff routes without signing in. The impact depends on what data and integrations the development environment contains; real customer data was not accessed during this assessment.

Unauthenticated live requests before and after patching:

| Route | Before | After |
| --- | --- | --- |
| `/api/history` | 200 | 401 |
| `/api/catalog` | 200 | 401 |
| `/` | 200 | 307 to `/login` |
| `/catalogue-recovery` | 200 | 307 to `/login` |

Removed all three fallback identities. Regression tests cover missing and forged cookies in development. HTTP checks additionally verify the Level 1 and split catalogues, recovery API, generation status, valid sign-in, and protected-page access with a legitimate session. Local development now requires the authentication configuration already described in the README.

### A-02 — High: session-store errors undermine shared revocation

Persistent session activation and revocation swallowed Redis errors and timeouts; validation could fall back to an instance's remembered session. A session revoked elsewhere could therefore remain usable during an outage, while logout could return success without deleting the shared active-session record. An attacker would need a captured session and the corresponding outage/revocation conditions; no production exploitation is claimed.

Before patching, local mocked-outage regressions demonstrated all three behaviors: a remembered session remained active, activation returned a token despite failed persistence, and logout returned 303 rather than reporting failure.

Persistent operations now fail closed with a sanitized configuration error, a 2.5-second deadline, disabled SDK retries, and a per-request abort signal. Persistent sessions do not maintain a fallback shadow in memory. Logout returns 503 and retains the cookie when shared revocation cannot be confirmed, allowing a retry. Development/test sessions still use local memory. The prior regression that required outage fallback was updated to enforce the corrected policy.

Tests verify errors, a hanging read, absent shared sessions, failed activation, failed logout, and a successful persistent session lifecycle through revocation. The availability tradeoff is intentional: a Redis outage denies session-dependent access instead of accepting potentially revoked credentials.

### A-03 — Medium: request-size checks trust client declarations

Login and legacy multipart handlers checked `Content-Length` but parsed the body without enforcing its actual size. Upload authorization and generation JSON also lacked streamed byte bounds. Requests without the header could bypass application limits.

Before patching, a login JSON body exceeding 8 KB authenticated successfully despite the intended 4,096-byte limit. A multipart body above 4,200,000 bytes was parsed and reached field validation (400 rather than an early 413). No memory-exhaustion attack or destructive load test was run.

Added `lib/request-body.ts` to count actual streamed bytes, reject excess with 413, and cancel the remaining stream. Applied limits:

| Input | Maximum bytes |
| --- | ---: |
| Login JSON | 4,096 |
| Upload authorization JSON | 4,096 |
| Generation JSON containing upload IDs | 65,536 |
| Legacy multipart HTTP input | 4,200,000 |

The larger internal high-resolution handoff now uses a private server function instead of the client-controlled `X-Nasir-High-Resolution` header. Original 50 MB image limits and chunked upload behavior remain intact. This preserves high-resolution processing while applying the HTTP limit to every external multipart request.

Regressions cover absent/understated lengths, oversized JSON entry points with zero storage/provider requests, early stream cancellation, the exact byte boundary, and inability to select the trusted handoff using a header. Actual chunked-transfer login and multipart HTTP requests both return 413 after patching.

### A-04 — Low: malformed session cookies throw during authentication

A malformed percent-encoded session cookie caused `decodeURIComponent` to throw before authentication could reject the request, producing avoidable error responses. A local test reproduced the `URIError` using synthetic input. This is a robustness issue; no cross-user outage is claimed.

Malformed encodings now return no token. Direct and HTTP regressions verify rejection as unauthenticated (401), while normal signed sessions and logout replay checks still work.

## Verification

Seven initial assessment regressions failed against the original code, demonstrating the behaviors above. The expanded assessment suite now contains 16 passing regressions and is included in `npm run test:security`.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 174 passed; 0 failed across all five test groups |
| `npm run build` | Passed; build only, no deployment |
| `node scripts/security-local.mjs` | Passed; synthetic, loopback-only HTTP checks |
| Shannon runtime engagement configuration and preflight | Passed |
| `git diff --check` | Passed |
| Shannon autonomous scan/retest | Launched; failed at provider cyber-access gate before analysis |

The test groups contain 54 security, 67 catalogue, 4 bespoke, 8 rendered-source, and 41 storage/client/history tests. Existing provider and storage tests use fixtures/mocks. One existing Redis-timeout regression needs an ephemeral loopback listener; the test suite was rerun with that local permission after the filesystem sandbox blocked the initial listener.

The source-based rendered-page tests are not presented as browser tests. The separate HTTP checks exercise the actual running server. No paid generation was performed.

## Remaining coverage limits

- Shannon's full analysis, exploitation, report, and post-patch replay remain pending.
- Real staging integrations, actual distributed Redis behavior, and deployed proxy behavior were not tested. Session failure cases use local mocks.
- The documented shared-staff history policy is preserved; cross-staff reads are intentional under the current product authorization model.
- Image decoding/pixel controls and broader dependency advisories were not fully assessed. No external dependency-audit service was contacted under the requested scope.
- This bounded local review does not establish that the application is free of other vulnerabilities.

## Subsequent improvement verification

The original security milestone above retains its 174-test evidence. Subsequent improvement work expanded the complete suite to **204 passing tests** and added **13 synthetic browser workflow checks**, including real local login/logout and expired-session recovery behavior. Browser testing found and fixed a compatibility issue where logout could redirect to Next's internal host: it now returns relative `/login` with the same 303 status, revocation and cookie-clearing contract. Local HTTP checks verify the redirect and revoked-token replay; unconfirmed revocation still fails closed.

Current verification and limitations are recorded in [the improvement report](../research/IMPROVEMENT_REPORT.md). These results do not change Shannon's blocked status, establish live Upstash/Neon/R2 validation, or prove visual-quality improvements. No paid image calls or production access occurred.
