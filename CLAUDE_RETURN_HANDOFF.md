# Return handoff — Grok → Claude Code

You are picking up Nasir Bespoke from GitHub, not from a local Grok filesystem. Read this file first, then `NASIR_ARCHITECTURE.md`, `DOMAIN_RULES.md`, `PERMISSIONS.md`, `API_REFERENCE.md`, `AI_ENGINEERING_GUIDE.md`, `NASIR_ROADMAP.md`.

`GROK_HANDOFF.md` is the original Claude→Grok package (accurate through Phase 4C). It is kept. Do not treat it as current for 4D–4G.

Older root docs (`ARCHITECTURE.md`, `ROADMAP.md`, `SECURITY.md`, `AI_AGENT_GUIDE.md`, `PROJECT_CONTEXT.md`, `ANTIGRAVITY_*`) are Phase 1/2-era. Do not treat them as current.

## Exact repository state

| Item | Value |
|---|---|
| Branch | `feature/split-outfit` |
| `origin/main` | `160f71ce6d0d47a4709723be68cfe52062785c6f` — **do not touch** |
| Working tree at freeze | clean except untracked `.claude/` (local launcher; do not commit) |
| Latest product commit | `be37eed` — `feat(atelier): add append-only production notes` |
| Phase 4G report commit | `69ce238` — `docs: record phase 4G preview acceptance blockers` |
| HEAD at this handoff | see `TRANSFER_CHECKSUM.md` (must match `origin/feature/split-outfit`) |

Recent Grok-era commits (newest first):

```
docs: prepare return handoff to claude code   (this package)
69ce238 docs: record phase 4G preview acceptance blockers
be37eed feat(atelier): add append-only production notes
0087bc1 feat(fabric): add catalogue management workflow
db91564 feat(atelier): add production assignment workflow
ad2ed73 docs: add grok architecture audit
b8ab807 docs: prepare architecture handoff for next engineering agent
```

GitHub is the source of truth for Claude Code Cloud.

## What Grok completed

### Architecture takeover

`ad2ed73` / `GROK_ARCHITECTURE_AUDIT.md`. No product code. Confirmed `feature/split-outfit` at Claude handoff `b8ab807`.

### Phase 4D — Atelier Assignment (`db91564`)

- Permission `production:assign`: OWNER/MANAGER only. Not bundled with `production:update`.
- `assignedStaffId` remains a username string. No Staff table. No assignment-history table.
- Non-null assignees must be `MASTER_TAILOR` via `lib/customer/staff-directory.ts` (allowlist projection: `username`, `displayName`, `role` only — never hashes).
- `GET /api/production/assignees` → `{ assignees: [...] }`.
- Reassign: `PATCH /api/production/{jobId}` `{ toStage, assignedStaffId? }` (`toStage` may equal current stage).
- UI: Order Production + Atelier Dashboard Incoming column. Unauthorized roles: assignees GET 403 → read-only label.
- MASTER_TAILOR cannot assign/self-assign. STAFF / STYLE_CONSULTANT / QC cannot assign.

### Phase 4E — Fabric Catalogue Management (`0087bc1`)

- Permission `fabric:update`: OWNER/MANAGER.
- `PATCH /api/fabrics/{fabricId}` allow-list: `name`, `composition`, `weight`, `season`, `colour`, `supplier`, `status`.
- Retirement: `ACTIVE` ↔ `INACTIVE`. No hard-delete API.
- `PATCH /api/fabrics/{fabricId}/variants/{variantId}`: `colour`, `isAvailable`. Cross-fabric variant → 404.
- UI: `/atelier/fabrics`. Order material picker only offers ACTIVE fabrics and available variants.
- **Invariant:** live catalogue edits never rewrite `OrderMaterialSnapshot` (`fabricName`, `composition`, `weight`, `season`, `colour`, `supplier`, `variantColour`).
- Not inventory, pricing, or procurement. No migration (status / isAvailable already existed).

### Phase 4F — Production Notes (`be37eed`)

- Model `ProductionNote`: `id`, `productionJobId`, `body`, `createdBy`, `createdAt`. Append-only. No PATCH/DELETE.
- `GET/POST /api/production/{jobId}/notes`. POST body `{ body }` only (trimmed, 1–2000). Server sets author/timestamp.
- Grants: `production:note:read` / `create` for OWNER, MANAGER, MASTER_TAILOR, QC_STAFF. **Not** STAFF or STYLE_CONSULTANT.
- MASTER_TAILOR: assigned jobs only (else 404). QC create only at `FINAL_QC` (else 403). Notes readable after COMPLETED/CANCELLED.
- UI: Order Production list + dashboard Notes `<details>`. Body is React text (escaped). No `dangerouslySetInnerHTML`.
- Migration: `prisma/migrations/20260820120000_add_production_notes/` (CREATE TABLE / INDEX / FK only).
- **Operator has applied this migration to the shared Preview/dev database. Do not re-run it unnecessarily. Do not apply it to Production. Do not point Production at this database.**

### Phase 4G — Preview acceptance investigation (`69ce238`)

Honest status: **live acceptance incomplete**. Source contracts remained green. No 4D–4F product defects found.

- Migration apply from the agent was blocked; **operator later applied it** to Preview/dev.
- Preview MANAGER / MASTER_TAILOR / QC_STAFF identities were **not** created (hash helper needs TTY; one-user output; must not invent passwords).
- Vercel Deployment Protection intercepts Preview (SSO 302 / `Protected deployment`) **before** Nasir login. Not an app auth bug.
- Production auth and Production deploy: untouched.
- OpenAI: not called.

## Current database state

Shared Preview/dev Neon is the only Postgres. Tables through Phase 4F exist there, including `production_notes` after the operator migrate.

Production currently has **no** `DATABASE_URL` by design. Never copy Preview DB to Production. Never set Production `DATABASE_URL` to this instance.

Do not run `prisma migrate deploy` again for `20260820120000_add_production_notes` unless status shows it pending on a **new** database.

## Auth / Preview state

Allowlist-based. No Staff table.

```bash
npm run auth:create-user -- <username> "Display Name" <ROLE>
```

TTY required. Emits `AUTH_USERS_JSON_BASE64=` of a **one-user** array. Repeated runs **overwrite**, they do not merge. `AUTH_USERS_JSON_BASE64` wins over `AUTH_USERS_JSON`. Missing `role` → `STAFF`.

Live QA still needs Preview-only identities: MANAGER, MASTER_TAILOR, QC_STAFF. Merge JSON arrays locally; set Vercel Sensitive **Preview + git branch `feature/split-outfit` only**. There is a **separate Production** `AUTH_USERS_JSON_BASE64` row — do not overwrite it.

Do not put passwords, hashes, or allowlist blobs in the repo.

## Vercel Preview state

`feature/split-outfit` Preview deployments exist (including SHA `be37eed`). Unauthenticated GETs to `/login`, `/atelier`, APIs 302 to Vercel SSO. Login POST can return Vercel `{ protection: { vercel_auth_enabled: true } }`.

Do **not** disable Deployment Protection as part of this handoff. Do **not** change Production Vercel settings.

Preview role QA is not complete until the operator authenticates through protection (or intentionally changes Preview protection) **and** finishes the multi-role allowlist.

## Test baseline (verified this handoff)

`npm test` **505** pass (378 security + 117 catalog + 4 bespoke + 6 render).  
`npm run lint` PASS. `npm run typecheck` PASS. `npm run build` PASS. `git diff --check` PASS.

Prior counts: 4D 444 → 4E 466 → 4F 505.

## Architectural invariants you must preserve

- Server owns IDs, timestamps, identity, snapshots, status/stage.
- Measurements are append-only versions.
- Saved outfits preserve `FinalOutfitSnapshot`.
- Orders preserve outfit + measurement snapshots.
- `OrderMaterialSnapshot` preserves historical material truth. Live Fabric edits never rewrite it.
- Production is a state machine. `ProductionStageHistory` is append-only.
- `ProductionNote` is append-only and does **not** mutate Customer preferences, Measurements, Orders, or Fabric snapshots.
- No Staff/User table. Auth is env allowlist.
- Production resource scoping is the **narrow exception** to the flat grant table.
- Not an ERP: no inventory, pricing/costing, procurement, scheduling.
- Work on `feature/split-outfit`. No `main` merge, no Production deploy unless the owner asks in that turn.
- OpenAI only via `lib/tryon/` for image generation.

## Known limitations

- Shared Preview/dev database; Production database not provisioned.
- Preview role credentials incomplete.
- Vercel Deployment Protection blocks unauthenticated live QA.
- Assignment history not recorded beyond current `assignedStaffId`.
- Note author is a username string.
- No inventory / pricing / procurement / scheduling.

## What you should do next

**Operator/QA (not a product phase):** Preview allowlist + Vercel protection + live 4D–4F QA.

**Engineering:** no next product milestone is committed. Do a short planning pass with the owner before building anything new. Do not invent Phase 4H.

## How to work here

Same as `GROK_HANDOFF.md` / `AI_ENGINEERING_GUIDE.md`: mirror the previous domain; extend one `CustomerRepository` + one fake; full `npm test`; field allow-lists; 503 gates; additive migrations with `-o`; fail closed; never weaken red tests.
