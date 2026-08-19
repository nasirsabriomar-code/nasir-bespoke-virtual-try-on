# Grok Architecture Audit — Nasir Bespoke

**Auditor:** Grok (architecture takeover, no feature work)  
**Audit date:** 2026-08-20  
**Handoff commit verified:** `b8ab80762904993d0808d702258ce891e21dc7cc`  
**Source-of-truth documents read:** `GROK_HANDOFF.md`, `NASIR_ARCHITECTURE.md`, `DOMAIN_RULES.md`, `AI_ENGINEERING_GUIDE.md`, `API_REFERENCE.md`, `PERMISSIONS.md`, `NASIR_ROADMAP.md`  
**Source cross-check:** `prisma/schema.prisma`, all four migrations, `lib/customer/{permissions,validation,repository,http,prisma-repository}.ts`, every `lib/*-handler.ts` allow-list, `app/api/**`, `components/**`, `tests/**`, `.github/workflows/ci.yml`

This document records what was inherited. It does not propose architecture changes. Older root files (`ARCHITECTURE.md`, `ROADMAP.md`, `SECURITY.md`, `AI_AGENT_GUIDE.md`, `PROJECT_CONTEXT.md`, `ANTIGRAVITY_*`) describe a Phase 1/2-era snapshot and were **not** used as current truth.

---

## Repository Status

| Check | Result |
|---|---|
| Current branch | `feature/split-outfit` |
| Tracking | `origin/feature/split-outfit` (up to date at audit start) |
| `git rev-parse HEAD` | `b8ab80762904993d0808d702258ce891e21dc7cc` |
| Expected handoff commit | `b8ab80762904993d0808d702258ce891e21dc7cc` |
| Match | **YES** — continue |

Recent history (newest first):

```
b8ab807 docs: prepare architecture handoff for next engineering agent
71a2cef feat(atelier): add production workflow foundation
a5a53ba feat(fabric): add bespoke fabric foundation
60128a2 feat(order): add bespoke order foundation
0004352 feat(customer): activate showroom memory workflow
34bcda0 feat(customer): add bespoke customer memory layer
48c8158 feat(showroom): add hybrid signature look workflow
b3ee54a feat(split-outfit): add reference readiness and shirt materials
41b1fa6 feat(split-outfit): add secure suit generation foundation
9d79af5 feat(split-outfit): add deterministic suit compatibility engine
```

**Working tree at audit start:** clean of application changes. Untracked only: `.claude/` and `AI_TASK_REPORT.md`. Neither was modified or committed by this takeover.

**Handoff-doc freshness note:** `GROK_HANDOFF.md` states the package is accurate as of `71a2cef` (Phase 4C). Commit `b8ab807` added the handoff package itself and did not change application code. Cross-check of schema, permissions, handlers, routes, and tests against those documents found **no drift**.

**Graphify:** `graphify-out/GRAPH_REPORT.md` is stale (`Built from commit: 3c0a5dd3`). This audit did not rebuild it. Navigation used the handoff documents and targeted source reads.

---

## Existing Architecture

Nasir Bespoke is a **private, staff-only** Next.js 16.3 App Router application (React 19, Prisma 7 + `@prisma/adapter-pg`, Node `>=22.13.0`) used by one bespoke menswear atelier. There is no public signup, no customer login, and no storefront.

Two overlapping capabilities share one codebase and one UI shell:

1. **Visual try-on generator (Phases 1–2).** Staff upload a customer photo and fabric reference, pick a garment (curated Level 1 catalogue *or* modular Split Outfit builder), and receive an AI visualization. The only AI call in the entire system lives here: `lib/tryon/index.ts` → `lib/tryon/providers/openai.ts` (OpenAI GPT Image 2). Paid routes (`POST /api/try-on`, `POST /api/split-try-on`) are rate-limited, lock-guarded, and idempotency-protected. Split generation is independently gated by `SPLIT_GENERATION_ENABLED` (server) and `NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT` (client). This domain never touches Postgres.

2. **Bespoke business system (Phases 3A–4C).** Additive memory/workflow reached from inside the same workspace via `CustomerGate` (showroom) and `/atelier` (production dashboard). Chain:

   `Customer → MeasurementProfile* → ShowroomSession* → SavedOutfit* → Order* → OrderMaterialSnapshot* → ProductionJob (1:1) → ProductionStageHistory*`

   Every commitment copies what was true at that moment. Historical records stay readable even if the live catalogue or later measurements change.

**Infrastructure split (must not be crossed):**

| Store | Holds |
|---|---|
| PostgreSQL (Neon) | Permanent business records only — Customer through Production |
| Upstash Redis | Rate limits, generation locks, idempotency, usage-history metadata, Level 1 catalogue store |
| Vercel Blob (optional, private) | Generated images + Split reference assets |
| Env allowlist (`AUTH_USERS_JSON` / `_BASE64`) | Staff identities and roles — **there is no Staff/User table** |

**Deployment posture:** work from 3B onward lives exclusively on `feature/split-outfit` and is verified against Preview. Production has **no `DATABASE_URL`**, deliberately. CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build on `main` pushes and all PRs.

**Handler pattern (every business domain):**

```
types.ts → repository.ts interface + prisma-repository.ts
        → permissions.ts grant
        → validation.ts (+ state machine if status/stage)
        → lib/*-handler.ts (allow-list, server-derived identity, try/catch → 503)
        → app/api/**/route.ts (thin wrapper)
        → tests/customer-fake-repository.ts + domain test file
```

One `CustomerRepository` interface and one in-memory fake cover every business domain, including Production. Handlers take injectable `dependencies` so `npm test` never needs Postgres, Redis, or an OpenAI key.

**UI pattern:** `"use client"` components; local `isRecord` / `readResponseError` helpers (deliberately not extracted); `fetch(..., { credentials: "same-origin" })`; `useEffect` + `active` unmount guard; existing CSS class families in `app/globals.css`. Two staff surfaces:

- `/` → `TryOnApp` (Full Outfit / Split Outfit + Showroom Memory gate)
- `/atelier` → `AtelierDashboard` (read-only production status board)

Both pages are `force-dynamic` auth gates. In `NODE_ENV=development` only, a missing session falls back to `{ username: "showroom", displayName: "Showroom Staff" }` so local QA can run against the live Preview/dev database.

---

## Database Understanding

**Entities (from `prisma/schema.prisma`, confirmed against all four migrations):**

| Model | Table | Permanence rule |
|---|---|---|
| `Customer` | `customers` | Unique `phone`. Preferences are closed-vocabulary arrays, not free text. |
| `MeasurementProfile` | `measurement_profiles` | Append-only. `@@unique([customerId, version])`. No update/delete path. |
| `ShowroomSession` | `showroom_sessions` | State machine. `finalOutfitSnapshotId` is a denormalized pointer, not an FK. |
| `SavedOutfit` | `saved_outfits` | `outfitSnapshot` is a full `FinalOutfitSnapshot` copy. `sessionId` SET NULL on session delete. |
| `Order` | `orders` | Copies `outfitSnapshot` + `measurementSnapshot` at create. `savedOutfitId` ON DELETE RESTRICT. |
| `Fabric` | `fabrics` | Curated catalogue. `ACTIVE` / `INACTIVE`. No stock, no price. |
| `FabricVariant` | `fabric_variants` | Colour + `isAvailable` flag only. Cascade from Fabric. |
| `OrderMaterialSnapshot` | `order_material_snapshots` | One row per `(orderId, role)`. Descriptive fields copied. FKs ON DELETE RESTRICT. |
| `ProductionJob` | `production_jobs` | 1:1 with Order (`orderId` unique, ON DELETE RESTRICT). |
| `ProductionStageHistory` | `production_stage_history` | Append-only. `fromStage` is null only on the create row. |

**Relationships:**

```
Customer ──1:*── MeasurementProfile
Customer ──1:*── ShowroomSession ──1:*── SavedOutfit ──1:*── Order ──1:1── ProductionJob
                                                          │            │
                                                          └─1:*── OrderMaterialSnapshot ──*:1── Fabric ──1:*── FabricVariant
                                                                       ProductionJob ──1:*── ProductionStageHistory
```

Customer deletion **cascades** to measurements, sessions, saved outfits, and orders. Order delete is restricted once a production job exists. Fabric/variant delete is restricted once referenced by a material snapshot. Saved outfits that have been ordered cannot be deleted (`ON DELETE RESTRICT`).

There is **no Staff/User table**. `createdBy`, `recordedBy`, `selectedBy`, `changedBy`, and `assignedStaffId` are plain username strings, server-derived, validated against `/^[a-z0-9._-]{2,64}$/` where assigned.

**Migration approach (additive only):**

| Migration | What it added |
|---|---|
| `20260819000000_init` | Customer, MeasurementProfile, ShowroomSession, SavedOutfit + enums |
| `20260819120000_add_orders` | Order + `OrderStatus` |
| `20260819180000_add_fabric_domain` | Fabric, FabricVariant, OrderMaterialSnapshot + enums |
| `20260819190000_add_production_domain` | ProductionJob, ProductionStageHistory + `ProductionStage` |

Every `ALTER TABLE` in these files is `ADD CONSTRAINT` (FKs). No `DROP TABLE`, `DROP COLUMN`, or destructive `ALTER`. Generate future diffs with `prisma migrate diff … -o <file>` — never a shell redirect (`>` once corrupted a migration and was cleaned up in Phase 3C).

Prisma client is generated to `lib/generated/prisma` (gitignored). `postinstall` runs `prisma generate`.

---

## Domain Understanding

### Customer (Phases 3B–3C)

- Identity is unique phone. Name required; email optional.
- Preferences (`preferredStyles`, `preferredColours`, `preferredFit`, `preferredOccasions`) are closed vocabularies in `lib/customer/validation.ts`. Never free text. Never inferred appearance, ethnicity, or personality. Never written by an LLM.
- Measurements are append-only versions; each garment block is JSON validated against `lib/customer/measurement-fields.ts` (finite numbers strictly between 0 and 200). `recordedBy` is the authenticated username.
- Showroom sessions: `OPEN → EXPLORING → OUTFIT_SELECTED → COMPLETED`, `CANCELLED` from any non-terminal state (`SESSION_TRANSITIONS`).
- Saved outfits reconstruct `FinalOutfitSnapshot` server-side via `resolveFinalOutfitSnapshot()` — the client never submits the snapshot object. Saving into an open session advances that session to `OUTFIT_SELECTED`.
- Customer records are never AI-generated.
- `CustomerGate` can skip customer attachment entirely (`Continue without a customer`) so Phase 1/2 try-on still works when `DATABASE_URL` is unset.

### Order (Phase 4A)

- Created from `{ savedOutfitId }` only. Server re-fetches the outfit (must belong to this customer) and the latest measurement (required — `MeasurementRequiredError` → 400 if none), then copies both snapshots itself.
- Cross-customer or missing `savedOutfitId` both return the same 404 (`SavedOutfitNotFoundError`).
- Status machine (`ORDER_STATUS_TRANSITIONS`):

  `DRAFT → CONFIRMED → TAILORING → TRIAL ⇄ ALTERATION → QUALITY_CHECK ⇄ ALTERATION → READY → DELIVERED`

  `CANCELLED` from any non-terminal state. `DELIVERED` / `CANCELLED` terminal.
- `order:create` is STAFF-permitted (end of the showroom flow). `order:update` is MANAGER/OWNER-only.
- Not an ERP: no price, payment, invoice, or inventory fields.

### Fabric (Phase 4B)

- Staff-curated catalogue. Never AI-generated.
- `Fabric.status = INACTIVE` blocks **new** selections (`InvalidMaterialSelectionError`) but never rewrites existing order snapshots.
- Material attach body is `{ role, fabricId, fabricVariantId? }` only. Server re-validates ACTIVE fabric + belonging/available variant, then copies `fabricName`, `composition`, `weight`, `season`, `colour`, `supplier`, `variantColour`.
- Roles are a closed enum: `SUIT_FABRIC | SHIRT_FABRIC`.
- One snapshot per `(orderId, role)` — upsert replaces, it is not append-only history.
- `isAvailable` is a boolean flag, not a stock count.
- API-only create/list today. No edit/retire UI.

### Production (Phase 4C)

- One `ProductionJob` per Order (`ProductionJobAlreadyExistsError` → 409).
- Stage machine (`PRODUCTION_STAGE_TRANSITIONS`):

  `CONFIRMED → FABRIC_READY → CUTTING → STITCHING → FIRST_TRIAL ⇄ ALTERATION`

  `FIRST_TRIAL → FINAL_QC ⇄ ALTERATION → READY_FOR_DELIVERY → COMPLETED`

  `CANCELLED` from any non-terminal stage. `COMPLETED` / `CANCELLED` terminal.
- Every stage change, including create (`null → CONFIRMED`), writes a history row in the same `$transaction` as the `currentStage` update.
- `assignedStaffId` is an optional username string. Backend already accepts it on create and on `PATCH /api/production/{jobId}`. Reassignment is OWNER/MANAGER-only. The UI currently **displays** assignment and does **not** expose a control (`AtelierDashboard`, `OrderProduction`).
- Resource-level scoping (Production only):
  - `MASTER_TAILOR` reads/updates only jobs assigned to their username; cannot decide `FINAL_QC`; cannot cancel; cannot reassign. Out-of-scope reads return 404, not 403.
  - `QC_STAFF` may update only when `currentStage === FINAL_QC`.
  - List endpoint filters Master Tailor results server-side, not just in the response.
- Atelier Dashboard is a four-column status board (Cutting / Stitching / Trial / QC). Stage transitions live on Order Detail's Production section. This is not a scheduler.

---

## Security Understanding

**Validation boundaries (every mutating business endpoint):**

| Endpoint family | Client may send | Server always sets |
|---|---|---|
| Customer create/update | `name`, `phone` (create only), `email`, `preferences` | `id`, timestamps |
| Measurement create | three garment blocks | `version`, `recordedBy`, `createdAt` |
| Session create/update | `occasion`; update also `status`, `selectedLookId` | `createdBy`, timestamps; `finalOutfitSnapshotId` is system-only |
| Saved outfit create | same minimal field set as finalize-outfit | full `outfitSnapshot`, `createdBy`, `createdAt` |
| Order create | `savedOutfitId` | both snapshots, `status=DRAFT`, `createdBy`, timestamps |
| Order update | `status` | `updatedAt` |
| Fabric / variant create | descriptive fields (+ optional `status` / `isAvailable`) | `id`, `createdAt` |
| Material attach | `role`, `fabricId`, `fabricVariantId?` | every descriptive snapshot field, `selectedBy`, `selectedAt` |
| Production create | `assignedStaffId?` | `currentStage=CONFIRMED`, first history row, timestamps |
| Production update | `toStage`, `assignedStaffId?` | history row, `changedBy`, timestamps |

`hasUnexpectedFields()` in `lib/customer/http.ts` rejects any other key with 400. Generation routes have their own FormData / recipe allow-lists and independently re-validate Split recipes via `validateSplitRecipe` before any provider call.

**Shared preflight** (`authorizeStaffRequest`):

1. Same-origin (`isSameOriginRequest` — `Sec-Fetch-Site` + `Origin` vs host / `AUTH_ALLOWED_ORIGINS`) on state-changing methods → 403
2. Authenticate (`requireRequestUser`) → 401
3. Flat `canPerform(role, action)` → 403
4. Production additionally applies `canReadProductionJob` / `canUpdateProductionJob`

Missing `DATABASE_URL` maps to 503 via `DatabaseConfigurationError`. Missing generation-lock Redis fails closed (503) before a paid call. Default role for an allowlist entry with no `role` is `STAFF`.

**Permission model (flat grant; Production is the only resource-scoped exception):**

| Action | OWNER | MANAGER | STAFF | STYLE_CONSULTANT | MASTER_TAILOR | QC_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `customer:create` / `update` | ✓ | ✓ | | | | |
| `customer:read` | ✓ | ✓ | ✓ | ✓ | | |
| `measurement:create` | ✓ | ✓ | | | | |
| `measurement:read` | ✓ | ✓ | ✓ | ✓ | | |
| `session:create` / `update` | ✓ | ✓ | ✓ | | | |
| `session:read` | ✓ | ✓ | ✓ | ✓ | | |
| `outfit:create` | ✓ | ✓ | ✓ | | | |
| `outfit:read` | ✓ | ✓ | ✓ | ✓ | | |
| `order:create` | ✓ | ✓ | ✓ | | | |
| `order:read` | ✓ | ✓ | ✓ | ✓ | | |
| `order:update` | ✓ | ✓ | | | | |
| `fabric:create` | ✓ | ✓ | | | | |
| `fabric:read` | ✓ | ✓ | ✓ | ✓ | | |
| `order:material:update` | ✓ | ✓ | ✓ | | | |
| `production:create` | ✓ | ✓ | | | | |
| `production:read` | ✓ | ✓ | ✓ | ✓ | scoped | ✓ |
| `production:update` | ✓ | ✓ | | | scoped | scoped |

OWNER and MANAGER are intentionally identical today. Master Tailor and QC Staff have **zero** customer/order/fabric access — they work from `/atelier`, not the Customer Profile tree.

Generation is **not** on the `CustomerAction` table. It is gated by session + rate limit + lock + idempotency + (for Split) `SPLIT_GENERATION_ENABLED`.

---

## Testing Understanding

`npm test` is four suites, all in-process Node test runner, no live infrastructure:

| Script | Files | Count (this audit) |
|---|---|---|
| `test:security` | security, generation-guard, split-try-on, showroom-finalize, customer, measurement, session, saved-outfit, customer-database-gate, customer-acceptance, order, fabric, order-material, production | 303 |
| `test:catalog` | catalog, level1-*, split-outfit*, showroom-look*, showroom-recommendation | 117 |
| `test:bespoke` | bespoke | 4 |
| `test:render` | rendered-html | 6 |
| **Total** | | **430 pass / 0 fail** |

**Coverage that already exists and must be extended, not replaced, on any new mutating endpoint:**

- Happy-path create/retrieve
- Full state-machine walk + every illegal/terminal rejection
- Per-role grant and (for Production) resource-scope tests
- Unauthenticated → 401
- Cross-origin → 403 (`origin: https://evil.example`, `sec-fetch-site: cross-site`)
- Unknown IDs → 404
- Client-supplied `id` / timestamps / identity (`createdBy`, `recordedBy`, `selectedBy`, `changedBy`) → 400
- Unauthorized role → 403
- Invalid transition → 400
- Database-gate 503 on list/get/create (`tests/customer-database-gate.test.ts` currently covers customers, fabrics, materials, production-by-order, production list)

Snapshot immutability is explicitly tested (order measurement snapshot survives a later measurement version; material snapshot survives independently of the live fabric row).

`tests/customer-fake-repository.ts` is the single test double. A new repository method is not done until the fake implements it.

CI runs the same four commands this audit ran: lint, typecheck, test, build.

---

## Risks

These are inherited standing risks, not regressions introduced by this audit. None were “fixed” here.

1. **Single Postgres database serves local dev and Preview.** It holds no Production data today. Production must never be pointed at this same database. A dedicated Production database must be provisioned before any Production activation of the business domains.

2. **Production has no `DATABASE_URL` by design.** All Customer/Order/Fabric/Production routes 503 there. Do not “fix” this as a bug.

3. **Preview STAFF test credentials are not recoverable** (Vercel Sensitive env, write-only). Preview-UI role-matrix QA has been substituted with local-dev QA against the same live database since Phase 3C. Newer roles (`MANAGER`, `OWNER`, `MASTER_TAILOR`, `QC_STAFF`) have no dedicated Preview identities.

4. **Assignment is implemented on the API and unexposed in the UI.** `PATCH /api/production/{jobId}` already accepts `assignedStaffId` (OWNER/MANAGER). `AtelierDashboard` and `OrderProduction` only render the current value. A Manager must currently reassign via a direct API call. This is the smallest, safest next increment.

5. **No fabric edit/retire UI.** Catalogue create/list exist; `Fabric.status` is settable at creation only through the current UI surface.

6. **Customer delete is hard cascade** with no soft-delete or archival. Nothing in the current UI exposes deletion, so this is latent, not live. It must be resolved before any UI ever offers delete.

7. **`assignedStaffId` is a username string, not a live staff lookup.** A typo assigns a job to a username that will never log in. This is consistent with the no-Staff-table decision; do not “fix” it by introducing a Staff table without an explicit architectural decision.

8. **Dev auth fallback on `/` and `/atelier`** grants a `showroom` identity without a role field when `NODE_ENV=development` and no cookie is present. Callers that need a role default to STAFF. Local-only; must not leak into Preview/Production.

9. **Superseded Phase 1/2 docs remain at the repo root.** Easy to follow by accident. Current truth is the `NASIR_*` / `GROK_HANDOFF` / `DOMAIN_RULES` / `PERMISSIONS` / `API_REFERENCE` / `AI_ENGINEERING_GUIDE` set.

10. **OWNER and MANAGER are identical.** The type distinction exists so an owner-only action can be added later. Do not invent owner-only behavior without being asked.

11. **Two prior shipped bugs were missing `try`/`catch` → 503 gates** (`handleListFabricsRequest`, `handleListProductionJobsRequest`). Any new list/get/create/update handler must be checked for this pattern explicitly.

12. **This is not an ERP.** Pricing, invoicing, inventory/stock, supplier ordering, costing, and scheduling/capacity planning are out of scope unless a future task names them. Easy to drift into while extending Order/Fabric/Production.

---

## Recommended Next Milestone

Verified against `NASIR_ROADMAP.md` (not invented).

The roadmap does **not** currently name a “Phase 4D.” Its next-milestones list, in order:

1. **Assign/reassign tailor UI** — Owner/Manager-only control on the Atelier Dashboard or Order Detail Production section, calling the already-supported `assignedStaffId` field. No schema change.
2. Preview role credentials (infrastructure / env, not application architecture).
3. Dedicated Production database provisioning (infrastructure; blocking for any Production deploy).
4. Fabric catalogue management UI (edit/retire).

**Recommendation: start with roadmap item 1.**

This is the natural continuation of Phase 4C. If phase numbering is kept, it can be labeled **Phase 4D — Atelier Assignment**. Scope should stay at the assignment UI plus the tests that already exist for the API contract. It should **not** expand into “operational intelligence,” scheduling, capacity, costing, or a second permission system.

Out of scope for that milestone (roadmap “future / not designed”):

- Delivery/completion detail beyond `COMPLETED`
- Costing and pricing
- Supplier / inventory management
- Scheduling / capacity planning
- Soft-delete / archival
- Multi-location / multi-atelier
- Any OpenAI / LLM call from business-domain code
- Merge to `main` or Production deploy

When that work starts, mirror `OrderProduction` / `production-handler` / `tests/production.test.ts`. Do not add a parallel repository, a Staff table, or resource-level scoping to any other domain.

---

## Baseline Validation (this audit)

Run on 2026-08-20 against `b8ab807`. No application code was changed to influence these results.

| Command | Result | Notes |
|---|---|---|
| `npm test` | **PASS** | 430 tests, 0 fail, 0 skip (303 + 117 + 4 + 6) |
| `npm run lint` | **PASS** | `eslint app components lib tests scripts` |
| `npm run typecheck` | **PASS** | `next typegen && tsc --noEmit` |
| `npm run build` | **PASS** | Next.js 16.3.0 webpack. All documented routes present. Inherited `DEP0205` `module.register()` deprecation warning only — not a failure. |

No failures to hide. No feature drift. The inherited system is in a clean, extendable state.

---

## What Must Never Change

Restated from the handoff as binding constraints for every future change:

1. Snapshot-at-commitment: `SavedOutfit.outfitSnapshot`, `Order.outfitSnapshot`, `Order.measurementSnapshot`, and `OrderMaterialSnapshot` descriptive fields are copies, never live joins.
2. No Staff/User database table unless explicitly decided.
3. One flat `StaffRole` × `CustomerAction` × `canPerform()` model. Production resource-scoping stays a narrow exception.
4. OpenAI is reachable only from `lib/tryon/` for image generation.
5. Work stays on `feature/split-outfit`. Never merge to `main` or deploy Production unless the user asks in that turn.
6. Migrations are additive only; generate with `-o`, never `>`.
7. This is not an ERP.
8. Server owns IDs, timestamps, identity, snapshots, and status/stage. Field allow-lists on every mutating endpoint.
9. Measurements are append-only. Workflows are state machines.
10. Fail closed (503) when Postgres / Redis / the provider is missing. Never skip the handler `try`/`catch` → `mapDomainErrorToResponse` guard.
11. Do not weaken a red test to make it pass.
12. Do not treat superseded Phase 1/2 root docs as current.

---

## Takeover Status

| Criterion | Status |
|---|---|
| Repository verified | Yes — `feature/split-outfit` @ `b8ab807` |
| Handoff documents understood | Yes — seven current docs + source cross-check |
| Architecture understood | Yes — two eras, one app, snapshot chain intact |
| Tests validated | Yes — 430/430, lint, typecheck, build green |
| No feature drift | Yes — documentation only |
| Safe continuation plan | Yes — roadmap item 1, assign/reassign UI |
