# AI Task Report — Phase 4G Consolidated Preview Acceptance

## TASK_STATUS

**INCOMPLETE as live Preview acceptance.** Source contract for 4D–4F is green. Preview/dev migration is still pending. Preview staff roles were not created (no TTY). Live Preview UI/API is blocked by Vercel Deployment Protection. Production was not touched. No application-code defects found, so no product commit.

## STARTING_SHA

`be37eed90518e96a9cd3861ff15fff9257c5d109`

## ENDING_SHA

Same as starting unless this report commit is added.

## REMOTE_SHA

`be37eed90518e96a9cd3861ff15fff9257c5d109` at acceptance start.

## SUBAGENTS_LAUNCHED

| ID | Role |
|---|---|
| `01a01bce-f315-7692-a168-6d6d24e139fe` | A — Database / migration safety |
| `01a01bce-f315-7692-a168-6d75a1d3bf12` | B — Auth / Preview role configuration |
| `01a01bce-f315-7692-a168-6d9584183969` | C — Functional acceptance QA |
| `01a01bce-f315-7692-a168-6d852e0c235c` | D — Security / regression (static) |

`SUBAGENTS_UNAVAILABLE` = false

## SUBAGENT_RESPONSIBILITIES

- **A:** Inspect and apply `20260820120000_add_production_notes`; verify `production_notes`; refuse Production.
- **B:** Inspect `auth:create-user` / allowlist parser; Preview-only MANAGER / MASTER_TAILOR / QC_STAFF setup; never touch Production auth.
- **C:** Drive Preview 4D–4F if authenticated; otherwise map routes and write the human QA script.
- **D:** Static attack review of 4D–4F contracts and tests.

## SUBAGENT_RESULTS

See sections below. All four returned. No source patches.

## PARALLEL_WORK_PERFORMED

A/B/C/D launched together. Lead also listed GitHub Preview deployments and probed the Preview URL unauthenticated.

## LEAD_INTEGRATION_WORK

- Confirmed HEAD/origin = `be37eed`.
- Confirmed Preview deployment for that SHA is `success` and non-Production.
- Confirmed Vercel Deployment Protection intercepts `/login`, `/atelier`, and APIs (SSO 302 / 401 `Protected deployment`) — this is **not** the app login 401.
- Did not apply migration (same policy block Agent A hit).
- Did not generate or set allowlist hashes (no TTY; must not invent passwords).
- No contract defects to fix.

## MIGRATION_STATUS

Pending: `20260820120000_add_production_notes`. Four earlier migrations already applied on the Preview/dev datasource.

SQL is additive only: CREATE TABLE `production_notes`, CREATE INDEX, ADD FK. No DROP.

Command (verified in `package.json`): `npm run db:migrate:deploy` → `prisma migrate deploy`.

## MIGRATION_APPLIED

**No.** Auto-mode blocked `prisma migrate deploy` as a remote-cluster mutation. Not retried. Not `db push`. Not reset.

## MIGRATION_TARGET

Preview/dev Postgres (`neondb` / `public` via `.env.local` `DATABASE_URL`). Architecture: Production has **no** `DATABASE_URL`. Production was not targeted.

## SCHEMA_VERIFICATION

Read-only counts (no customer dump): `customers` 0, `orders` 0, `production_jobs` 0. Table `production_notes` **does not exist** until deploy.

## PREVIEW_AUTH_SETUP

**Not completed.** `scripts/hash-password.mjs` requires an interactive TTY and emits a **one-user** array. Repeat runs overwrite; they do not merge.

Exact one-user command:

```bash
npm run auth:create-user -- manager "Showroom Manager" MANAGER
npm run auth:create-user -- master.tailor "Master Tailor" MASTER_TAILOR
npm run auth:create-user -- qc.staff "QC Staff" QC_STAFF
```

Merge locally (decode each `AUTH_USERS_JSON_BASE64`, concat user objects, re-encode). Parser: `lib/auth/config.ts` — BASE64 wins over `AUTH_USERS_JSON`; array 1–50; `{ username, displayName, passwordHash, role? }`; missing role → STAFF.

Vercel CLI: `npx vercel` authenticated as the project owner. `AUTH_USERS_JSON_BASE64` already exists as **Sensitive Preview (`feature/split-outfit`)** **and a separate Production row**. Do not overwrite Production. Update the **branch-scoped Preview** row only, then redeploy `feature/split-outfit`.

`DATABASE_URL` is Preview-only (no Production row). Production auth vars were not modified.

## PREVIEW_ROLES_CREATED

**No.** MANAGER / MASTER_TAILOR / QC_STAFF were not generated or written to Vercel.

## PRODUCTION_AUTH_CHANGED

**No.**

## PREVIEW_DEPLOYMENT

GitHub deployment id `5990825433`, environment Preview, `production_environment: false`, state **success**.

## PREVIEW_SHA

`be37eed90518e96a9cd3861ff15fff9257c5d109`

## PREVIEW_READY

Deployment **READY**, but **not reachable as the app** without Vercel SSO. Unauthenticated GETs 302 to `vercel.com/sso-api`. Login POST returns Vercel `{ protection: { vercel_auth_enabled: true } }`, not the app’s username/password JSON.

## PHASE_4D_ASSIGNMENT_QA

Not executed on Preview (SSO + no staff credentials). Static/tests: OWNER/MANAGER assign; MASTER_TAILOR cannot assign/self-assign; assignees leak no hashes.

## PHASE_4E_FABRIC_QA

Not executed on Preview. Static/tests: `fabric:update` OWNER/MANAGER; retire/unavailable block new selection.

## PHASE_4E_SNAPSHOT_QA

Not executed on Preview. Tests: live fabric/variant edits do not rewrite `OrderMaterialSnapshot`.

## PHASE_4F_NOTES_QA

Not executed on Preview (table missing until migrate deploy; SSO). Static/tests: append-only, 404 hide, QC FINAL_QC, XSS escaped.

## ROLE_MATRIX_QA

Live matrix **blocked**. Automated handler matrix remains green from Phases 4D–4F.

## SECURITY_QA

Static pass: no contract defects. Live adversarial pass blocked by Vercel Deployment Protection and missing Preview staff identities.

## FULL_OUTFIT_REGRESSION

Source/tests unchanged. Preview UI not reachable. No OpenAI call.

## SPLIT_OUTFIT_REGRESSION

Same.

## CUSTOMER_REGRESSION

Preview/dev DB currently has 0 customers (empty; intact).

## ORDER_REGRESSION

0 orders.

## PRODUCTION_REGRESSION

0 production jobs. Notes table not created yet.

## DEFECTS_FOUND

None in 4D–4F source.

Operational blockers (not app bugs):

1. Pending additive migration not applied.
2. No TTY → cannot build Preview allowlist hashes.
3. Vercel Deployment Protection on Preview.

## DEFECTS_FIXED

None (no product code change).

## TEST_RESULTS

Inherited **505** tests remain the source of truth. No code change this phase; suite not re-run solely for this report.

## LINT / TYPECHECK / BUILD

Not re-run (no application diff). Last green: Phase 4F commit.

## TEST_DATA_CREATED

None.

## TEST_DATA_CLEANUP

N/A.

## OPENAI_CALLED

No.

## PRODUCTION_AFFECTED

No.

## KNOWN_LIMITATIONS

- One shared Preview/dev database; Production must never use it.
- Preview Deployment Protection sits in front of app auth.
- `auth:create-user` is TTY + single-user only.
- Existing Preview `AUTH_USERS_JSON_BASE64` is Hidden/Sensitive and branch-scoped.

## NEXT_RECOMMENDED_TASK

Operator, in order:

1. `npm run db:migrate:deploy` (Preview/dev only). Confirm `production_notes` exists.
2. In a real terminal, generate MANAGER / MASTER_TAILOR / QC_STAFF hashes; merge; set **Preview `feature/split-outfit` only** `AUTH_USERS_JSON_BASE64` Sensitive; do not change Production.
3. Bypass or complete Vercel Deployment Protection for this Preview (SSO as a human, or temporarily disable protection for QA).
4. Redeploy `feature/split-outfit`.
5. Run the Preview QA script (MANAGER assign; QA-named fabric only; notes; tailor 404 hide; QC FINAL_QC).

Until those five steps, Phase 4G cannot honestly mark live acceptance complete.

---

## Operator Preview QA script (after 1–4)

MANAGER: `/atelier` assign picker; assign MASTER_TAILOR; persist; `/atelier/fabrics` only mutate fabrics named `QA Phase4G*`; notes add/reload.

MASTER_TAILOR: assigned jobs only; no assign UI; notes on assigned job; other job notes 404.

QC_STAFF: notes readable; append only at FINAL_QC.

Never call try-on generation. Never PATCH real catalogue names.
