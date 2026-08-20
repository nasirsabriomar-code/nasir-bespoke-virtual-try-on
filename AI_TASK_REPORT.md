# AI Task Report — Phase 4G: Live Preview Acceptance (in progress)

## TASK_STATUS

BLOCKED ON OPERATOR ACTION — everything independently doable from Claude Code Cloud is complete. Live role-based Preview acceptance itself has not yet happened; it genuinely requires two operator-side actions this environment cannot perform for itself (see `REMAINING_BLOCKERS`). No Phase 4H work started.

## TASK_NAME

Phase 4G completion attempt: consolidated Preview acceptance + role validation.

## WORKING_BRANCH

`claude/nasir-bespoke-handoff-iaal0e`

## CANONICAL_BRANCH

`feature/split-outfit` — **not modified this session.** Still at `2c84205f211ede07344362fd265e23322b52c56b`. The working branch is currently 2 commits ahead of canonical (the prior takeover-report commit `7b025a0`, plus this session's dev-tooling + report commit). Nothing has been merged back into `feature/split-outfit`; do not treat the working branch as canonical until an explicit landing action is taken (see `RECOMMENDED_NEXT_ACTION`).

## STARTING_SHA

`7b025a044bad1c909a5764b6f29602d85d3a0417`

## ENDING_SHA

See `COMMIT_SHA` below (this report's own commit).

## CANONICAL_REMOTE_SHA

`origin/feature/split-outfit` = `2c84205f211ede07344362fd265e23322b52c56b` (verified via `git fetch` + `git rev-parse`, unchanged). `origin/main` not touched.

## MIGRATION_OPERATOR_CONFIRMED

`true`, per instruction — `20260820120000_add_production_notes` was reported operator-applied via `npm run db:migrate:deploy`. This session has no `DATABASE_URL`/`.env.local` (fresh container), so no live `prisma migrate status` check was possible or attempted. Not treated as a blocker, per instructions. Production database configuration untouched.

## AUTH_TOOLING_FINDINGS

Verified directly from source (`lib/auth/config.ts`, `scripts/hash-password.mjs`):

- `getAuthorizedUsers()` accepts a JSON array of **1–50** users from `AUTH_USERS_JSON_BASE64` (preferred) or `AUTH_USERS_JSON` (fallback) — `AUTH_USERS_JSON_BASE64` wins when both are set, confirmed in code (not just docs).
- Each entry: `{ username, displayName, passwordHash, role? }`. `username` must match `/^[a-z0-9._-]{2,64}$/`, `passwordHash` must be a real bcrypt hash (`/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/`), duplicate usernames in one array are rejected outright, a missing `role` defaults to least-privilege `STAFF`.
- `scripts/hash-password.mjs` (`npm run auth:create-user -- <username> "<Display Name>" <ROLE>`) requires an interactive TTY, prompts for a password twice (hidden input, never echoed/logged), bcrypt-hashes it (cost 12), and prints **one-user-array** `AUTH_USERS_JSON_BASE64=...` to stdout. Confirmed: it does not merge with any existing allowlist — each run is a fresh one-user array.
- **The schema already supports multiple users in one array; only the generator was one-user-at-a-time.** Per the task's explicit authorization to add small, safe dev tooling for this gap, added:
  - `lib/auth/merge-users.ts` — pure `mergeAuthUserBlobs(base64Blobs: string[]): string`. Decodes each already-hashed blob, re-validates every entry against the exact same rules `lib/auth/config.ts` enforces at read time (username pattern, bcrypt-hash pattern, valid `StaffRole`, 50-user cap), and merges by username (last blob wins on a duplicate — matches the existing single-user "rerun overwrites" behavior, i.e. supports credential rotation). **Never touches, generates, derives, or logs a plaintext password** — every input already carries a bcrypt hash the operator generated locally and interactively.
  - `scripts/merge-auth-users.mjs` — thin CLI wrapper: `npm run auth:merge-users -- <blob1> <blob2> ...`. Accepts each argument with or without the `AUTH_USERS_JSON_BASE64=` prefix so the operator can paste `auth:create-user`'s exact output lines directly.
  - `tests/auth-merge-users.test.ts` — 10 new tests (merge, dedupe/rotation, missing-role default, and every validation rejection path), using a syntactically-valid-but-fake bcrypt fixture (`$2b$12$` + 53 `N`s) — never a real hash. Wired into `test:security`.
  - This is dev-only tooling, alters no runtime auth behavior (`lib/auth/config.ts` is untouched), and introduces no Production behavior.

## PREVIEW_ROLES_STATUS

Still **not created** — that step needs the operator to run `auth:create-user` interactively (their own TTY, their own password entry) once per role, then `auth:merge-users` on the outputs. Nothing here required receiving a password, hash, or the merged allowlist value in this chat — see `OPERATOR_ACTIONS_COMPLETED` / `RECOMMENDED_NEXT_ACTION` for the exact procedure.

## PREVIEW_ENV_STATUS

Unchanged. No Preview environment variables were read, set, or requested via chat this session. `AUTH_USERS_JSON_BASE64` precedence over `AUTH_USERS_JSON` reconfirmed from source (see above), not just from docs.

## VERCEL_PROTECTION_FINDINGS

Inspected live via Vercel MCP tooling (`get_project_deployment_protection`, project `nasir-bespoke-virtual-try-on` / `prj_JtOYYO3NTr32lGZfJ70ftkxLutXN`, team `nasir-bespoke`):

- `passwordProtection.enabled = false`
- `ssoProtection.enabled = true`, `deploymentType = "all_except_custom_domains"` — this is what intercepts every Preview URL (including `feature/split-outfit`'s own Preview deployment) before Nasir's app-level `/login` is ever reached.
- `trustedIps.enabled = false`

Attempted two Vercel MCP-native bypass paths against the live `feature/split-outfit` Preview deployment (`https://nasir-bespoke-virtual-try-nj1xkv8io-nasir-bespoke.vercel.app`, commit `2c84205`):
- `web_fetch_vercel_url` on `/login` → `302` to `vercel.com/sso-api` (Vercel's own interactive browser SSO flow; this tool cannot complete it headlessly).
- `get_access_to_vercel_url` → issued a 23-hour `_vercel_share` link, but fetching that link still 302'd to `vercel.com/sso-api` rather than completing auth — the share-link flow requires an actual authenticated browser session, which this Cloud environment does not have.

**Conclusion (checked against Vercel's own documentation via `search_vercel_documentation`):** the correct, safest mechanism here is **Protection Bypass for Automation** (`x-vercel-protection-bypass` header / `VERCEL_AUTOMATION_BYPASS_SECRET`) — it is purpose-built for exactly this (CI/agent access to a protected Preview) and, critically, does **not** disable or weaken Deployment Protection for anyone else; it is a separate, revocable, project-scoped secret. However, **generating or reading that secret requires the Vercel project dashboard** (Project Settings → Deployment Protection → Protection Bypass for Automation) or the `PATCH /v1/projects/{id}/protection-bypass` REST endpoint — neither is exposed by the Vercel MCP tools available in this session, and this session holds no Vercel Personal Access Token to call that endpoint directly. This is a genuine Vercel account-level authorization boundary, not a workaround-able tooling gap. **Deployment Protection was not disabled, weakened, or reconfigured.**

## PREVIEW_DEPLOYMENT_STATUS

Confirmed via `list_deployments`: the `feature/split-outfit` branch has a `READY` Preview deployment at commit `2c84205f211ede07344362fd265e23322b52c56b` (deployment `dpl_6JqTj8VQViJEScvz9T35Bzsfbfz6`, matching the return-handoff commit and containing the full Phase 4F baseline). No redeploy was needed or triggered — no Preview environment variables changed this session. (This session's own working-branch commits also auto-deployed a separate Preview at `7b025a0`, since Vercel's GitHub integration deploys every pushed branch; the canonical Phase 4F acceptance target remains the `feature/split-outfit` deployment above, not the working-branch one.)

## PHASE_4D_LIVE_QA

Not run — blocked on `VERCEL_PROTECTION_FINDINGS` + `PREVIEW_ROLES_STATUS` (no route past SSO, no MANAGER/MASTER_TAILOR identities exist yet). Source-level contract re-verified unchanged from the prior takeover audit: `production:assign` OWNER/MANAGER-only, `staff-directory.ts` safe MASTER_TAILOR-only projection, no Staff table.

## PHASE_4E_LIVE_QA / PHASE_4E_SNAPSHOT_QA

Not run — same blockers. Source-level contract re-verified unchanged: `fabric-handler.ts` 503-gated on every path, `OrderMaterialSnapshot` descriptive fields are copies (no live join), confirmed by re-reading `lib/order-material-handler.ts`'s snapshot construction during the prior takeover session.

## PHASE_4F_LIVE_QA

Not run — same blockers. Source-level contract re-verified unchanged: append-only `ProductionNote`, `{ body }`-only allow-list, `canReadProductionJob`/`canCreateProductionNote` scoping, additive-only migration SQL.

## ROLE_MATRIX_QA / SECURITY_QA / REGRESSION_QA

Not run live (same blockers). All exercised **statically** via the full automated test suite instead (515 tests, see below) — every role-permission boundary, state-machine transition, and security-header/allow-list rule for 4D–4F already has dedicated automated coverage exercised against the in-memory fake repository, per `AI_ENGINEERING_GUIDE.md`'s testing pattern. This is not a substitute for live Preview acceptance (real HTTP, real Vercel edge, real Postgres) but confirms the source-level contracts are internally consistent and unchanged.

## DEFECTS_FOUND

None. No Phase 4D–4F contract violation was found in source (re-audited `lib/production-handler.ts`, `lib/production-notes-handler.ts`, `lib/fabric-handler.ts`, `lib/customer/staff-directory.ts`, `lib/customer/permissions.ts`, the notes migration SQL — all match `PERMISSIONS.md`/`DOMAIN_RULES.md`/`API_REFERENCE.md` exactly, same conclusion as the prior takeover session).

## DEFECTS_FIXED

None (none found).

## TESTS_ADDED

10 — `tests/auth-merge-users.test.ts` (new dev-tooling coverage for `lib/auth/merge-users.ts`, added to `test:security`).

## TEST_RESULTS

`npm test` — **515 pass, 0 fail** (388 security + 117 catalog + 4 bespoke + 6 render). This is the prior 505-test baseline plus the 10 new merge-tool tests; no baseline test was modified or weakened.

## LINT

PASS.

## TYPECHECK

PASS.

## BUILD

PASS. All previously-documented routes still present in the build output.

## OPENAI_CALLED

NO.

## PRODUCTION_AFFECTED

NO. Production database/auth/deployment configuration untouched. No Production deploy performed or requested.

## OPERATOR_ACTIONS_COMPLETED

None yet this session — this report is handed off *before* any operator action, per instructions to stop at the first genuinely required one rather than assume completion.

## REMAINING_BLOCKERS

Two independent, genuine external-authorization boundaries — neither is resolvable from Claude Code Cloud tooling:

1. **Preview role credentials don't exist yet.** Needs the operator's own TTY + interactively-entered passwords (this session must never receive a password, hash, or the merged `AUTH_USERS_JSON_BASE64` value in chat).
2. **Vercel Deployment Protection (SSO) blocks every Preview request before Nasir's own login**, including from this Cloud session's tooling. Needs a Protection Bypass for Automation secret generated in the Vercel dashboard — no available tool can generate, read, or apply that secret from here.

See `RECOMMENDED_NEXT_ACTION` for the exact single next step.

## GIT_STATUS

Clean at commit time (build-artifact-only diffs from local tooling, e.g. `next-env.d.ts`, discarded rather than committed, same as the prior session).

## COMMITTED

Yes.

## PUSHED

Yes — to `origin/claude/nasir-bespoke-handoff-iaal0e` (working branch only; `feature/split-outfit` not touched).

## COMMIT_SHA

See final chat response (recorded after push).

## RECOMMENDED_NEXT_ACTION

**Single next action for the operator, right now:**

Generate Preview-only QA identities using the tooling verified/extended this session. From a terminal with this repo checked out (any machine — does not need to be this Cloud session):

```
npm run auth:create-user -- manager-qa "Manager QA" MANAGER
npm run auth:create-user -- tailor-qa "Tailor QA" MASTER_TAILOR
npm run auth:create-user -- qc-qa "QC QA" QC_STAFF
```

Each run prompts for a password interactively (hidden input, 12+ characters) and prints one `AUTH_USERS_JSON_BASE64=...` line. **Do not paste any of those lines, or the passwords, into this chat.** Then merge the three outputs locally:

```
npm run auth:merge-users -- "<line 1>" "<line 2>" "<line 3>"
```

That prints a single combined `AUTH_USERS_JSON_BASE64=...` — set that value as a **Vercel Sensitive environment variable, scoped to Preview + git branch `feature/split-outfit` only** (Project Settings → Environment Variables), without ever sharing it here. If an existing Preview `AUTH_USERS_JSON_BASE64` already holds a STAFF/showroom identity you want to keep, decode-and-include it as a fourth argument to `auth:merge-users` before setting the new value, so it isn't dropped.

Separately (can happen in parallel, not blocking the step above): generate a **Protection Bypass for Automation** secret for this project in the Vercel dashboard (Project Settings → Deployment Protection → Protection Bypass for Automation). Once you have it, add it to **this Claude Code Cloud environment's own environment-variable configuration** (not this chat) as `VERCEL_AUTOMATION_BYPASS_SECRET` — that is the one channel that keeps it out of the conversation entirely. With that in place, a future session can send `x-vercel-protection-bypass` on requests to the `feature/split-outfit` Preview URL and run the full Phase 4D–4F live QA script (Sections 12–15 of the task) autonomously over HTTP, without needing a human to click through SSO for each check.

Once either or both of those are done, resume this session (or a new one) to continue Phase 4G — the live QA script is fully specified and ready to execute the moment credentials + bypass access exist.

## NEXT_AGENT_CONTEXT

- Working branch `claude/nasir-bespoke-handoff-iaal0e` is 2 commits ahead of canonical `feature/split-outfit` (`2c84205`): the takeover-report commit and this session's dev-tooling + report commit. Canonical branch is untouched; do not claim it contains this work.
- New dev tooling this session: `npm run auth:merge-users -- <blob> <blob> ...` merges already-hashed `AUTH_USERS_JSON_BASE64` outputs into one multi-user allowlist. It is pure/offline, never touches plaintext, and is covered by `tests/auth-merge-users.test.ts`.
- The two remaining Phase 4G blockers are both genuine operator/account-authorization boundaries, not tooling gaps this environment can close itself: (1) Preview role credentials must be generated interactively by the operator and merged/set by them directly into Vercel — never routed through chat; (2) Vercel SSO Deployment Protection has no available bypass from this session's Vercel MCP tools short of a Protection Bypass for Automation secret, which only the Vercel dashboard (or an API token this session doesn't hold) can generate.
- Do not attempt to disable, weaken, or reconfigure Vercel Deployment Protection as a workaround — it was deliberately left untouched this session and should stay that way unless the owner explicitly asks for a different approach.
- The full Phase 4D–4F live-QA script (Sections 12–15 of the Phase 4G task) is unchanged and ready to execute step-by-step the moment both blockers clear — no need to re-derive it.
- No product code defect was found or fixed this session. `npm test` is now 515 (was 505); the delta is exactly the 10 new merge-tool tests, not a baseline change.
