# Nasir Bespoke — System Architecture

This document is the current, authoritative architectural map of the Nasir Bespoke platform as of the end of Phase 4C. It supersedes the older `ARCHITECTURE.md`/`ROADMAP.md`/`SECURITY.md` files at the repo root, which describe an earlier (Phase 1-era) snapshot and were left in place only as historical record — do not treat them as current.

## What this system is

Nasir Bespoke is a private, staff-operated tool for a bespoke menswear atelier. It is used internally by showroom staff and (as of Phase 4C) atelier production staff — it is **not** a customer-facing storefront, and it is **not** an ERP, inventory, or supplier-management system. Every screen requires staff authentication; there is no public signup or customer login anywhere in the product.

The system has grown in two architectural eras:

1. **Visual try-on tool** (Phases 1-2) — a private staff utility for generating AI garment try-on visualizations from a customer photo and a fabric/garment reference, using OpenAI's image model as the sole generation provider.
2. **Bespoke business system** (Phases 3A-4C) — a persistent-memory layer built on top of the same UI shell: customer records, measurements, showroom sessions, curated outfit recommendations, orders, fabric selection, and now atelier production tracking.

These two eras coexist in the same codebase and the same running app. The visual try-on tool (Full Outfit and Split Outfit modes) is still the primary interactive workspace; the business-system domains (Customer/Order/Fabric/Production) are additive layers reached from within that same workspace via a "Showroom Memory" gate, not a separate application.

## Completed phases

| Phase | Name | What it added |
|---|---|---|
| 1 | Visual Try-On Foundation | Staff auth, photo/fabric capture, curated Level 1 garment catalogue, deterministic prompt compiler, OpenAI GPT Image 2 generation, per-user generation locking + idempotency, rate limiting, usage history (Redis + optional Vercel Blob), "Midnight Atelier" UI shell. |
| 2 | Split Outfit Architecture | A second generation workflow ("Split Outfit") alongside the original curated catalogue ("Full Outfit"): modular per-component selection (upper/lower/shirt/waistcoat/footwear/accessories) with a deterministic compatibility rule engine, server-side recipe re-validation, canonical material-group system, and a reference-asset registry with checksum/content-type verification. Gated behind `SPLIT_GENERATION_ENABLED` (server) and `NEXT_PUBLIC_ENABLE_SPLIT_OUTFIT` (client), independently. |
| 3A | Signature Looks | A curated recommendation layer on top of Split Outfit: human-curated "Signature Look" presets, a pure deterministic recommendation engine scoring looks against a declared occasion/style/formality profile, and a `/api/showroom/finalize-outfit` endpoint that reconstructs a validated `FinalOutfitSnapshot` server-side from a strict client field allow-list. |
| 3B | Customer Memory | The first PostgreSQL-backed domain: `Customer`, `MeasurementProfile` (append-only/versioned), `ShowroomSession` (state machine), `SavedOutfit` (preserves the full validated outfit snapshot). Introduced the 3-role staff authorization boundary (OWNER/MANAGER/STAFF) and the dependency-injectable repository pattern every later domain follows. Shipped database-gated-safe (every route 503s until `DATABASE_URL` is set) — no live database in this phase. |
| 3C | Database Activation | Activated Phase 3B against a real, user-provisioned Neon Postgres. Found and fixed a real migration-file corruption bug (stray CLI output captured by a shell redirect). No new domain logic — pure activation + live acceptance testing. |
| 4A | Orders | `Order` domain: converts an approved `SavedOutfit` into a persistent bespoke transaction record, with server-built `outfitSnapshot`/`measurementSnapshot` copies (never live references) and a validated order-status state machine (`DRAFT` → ... → `DELIVERED`/`CANCELLED`). |
| 4B | Fabric Intelligence | `Fabric`/`FabricVariant` curated catalogue plus `OrderMaterialSnapshot` — lets an order remember exactly which fabric (and optional colourway variant) was selected for it, as a server-built copy, not a live reference. |
| 4C | Atelier Production Foundation | `ProductionJob` (1:1 with Order) + append-only `ProductionStageHistory` — tracks how an accepted order moves through the workshop across a 10-stage state machine. Added three narrow atelier-operations roles (`STYLE_CONSULTANT`, `MASTER_TAILOR`, `QC_STAFF`) with resource-level scoping layered on top of the existing flat-grant permission model. Added the Atelier Dashboard. |

See `NASIR_ROADMAP.md` for what comes next.

## High-level system diagram

```
                         Staff browser (private, authenticated)
                                       │
                          HTTPS, same-origin requests
                                       ▼
                         Next.js 16 App Router (single app)
        ┌──────────────────────────────┼──────────────────────────────┐
        │                               │                              │
   Server-rendered                Client UI (React)              Route handlers
   auth gate (app/page.tsx,             │                        (app/api/**/route.ts)
   app/atelier/page.tsx)         TryOnApp.tsx shell                    │
        │                       ├─ Full Outfit / Split Outfit  ┌───────┴────────┐
        └── redirect /login     ├─ Showroom Memory gate        │                │
             if unauthenticated │   (CustomerGate.tsx)     Generation domain  Business domain
                                 └─ Atelier Dashboard          (try-on, split-  (customer, order,
                                     (AtelierDashboard.tsx)     try-on, showroom  fabric, production)
                                                                 finalize)         │
                                                                    │              │
                                                          OpenAI GPT Image 2   Prisma ORM
                                                          (sole AI provider,   (@prisma/adapter-pg)
                                                           server-only key)         │
                                                                    │         PostgreSQL (Neon)
                                                          Upstash Redis        (Customer/Order/Fabric/
                                                          (rate limits,        Production tables)
                                                           generation locks,
                                                           idempotency,
                                                           usage history)
                                                                    │
                                                          Vercel Blob (optional,
                                                          private generated-
                                                          image storage)
```

## Directory map (by domain)

```
app/
  page.tsx                       — root auth gate + TryOnApp shell (Full/Split Outfit workspace)
  atelier/page.tsx                — auth gate + Atelier Dashboard (Phase 4C)
  login/                          — staff login page
  api/
    auth/{login,logout}/          — session issuance/teardown
    try-on/                       — Phase 1 Level 1 catalogue generation
    split-try-on/                 — Phase 2 Split Outfit generation
    catalog/, level1-catalog/, catalog-assets/[assetId]/  — Level 1 curated catalogue reads
    history/, history/[id]/asset/[asset]/                — usage history + generated-image retrieval
    showroom/finalize-outfit/     — Phase 3A: server-validated FinalOutfitSnapshot construction
    customers/, customers/[id]/{measurements,outfits,sessions,orders}/  — Phase 3B/4A
    sessions/[id]/                — showroom session status updates
    orders/[id]/, orders/[id]/{materials,production}/     — Phase 4A/4B/4C
    fabrics/, fabrics/[id]/variants/                       — Phase 4B
    production/, production/[id]/                          — Phase 4C

components/
  TryOnApp.tsx                    — the whole Full Outfit / Split Outfit workspace shell
  Level1Catalogue.tsx, StylePicker.tsx, BespokeConfigurator.tsx, VisualOptionCard.tsx,
  ImageUpload.tsx, TryOnResult.tsx, GenerationState.tsx, UsageHistory.tsx  — Phase 1 UI
  split-outfit/                   — Phase 2 Split Outfit UI (ModeSelector, SplitOutfitWorkspace, ...)
  showroom/                       — Phase 3A Signature Looks UI (ShowroomJourney, RecommendationProfileForm, ...)
  customer/                       — Phase 3B-4C business-domain UI:
    CustomerSearch.tsx, CustomerGate.tsx, CustomerProfile.tsx, PreferencesEditor.tsx,
    MeasurementWorkflow.tsx, OrderDetail.tsx, OrderMaterials.tsx, OrderProduction.tsx
  AtelierDashboard.tsx            — Phase 4C dashboard

lib/
  auth/                           — session issuance, JWT/cookie handling, staff allowlist (config.ts)
  request-security.ts             — same-origin / Fetch Metadata check shared by every state-changing route
  rate-limit.ts                   — Upstash-backed (memory fallback in dev/test) request rate limiting
  generation-guard.ts             — per-user distributed lock + idempotency for paid OpenAI calls
  generation-storage.ts, usage-history.ts  — generated-image storage (Blob) + history metadata (Redis)
  openai.ts, tryon/                — OpenAI client + provider abstraction (tryon/providers/openai.ts)
  catalog/                        — Phase 1 Level 1 curated catalogue (Redis-backed store + seed data)
  bespoke/                        — Level 1 bespoke configuration engine
  split-outfit/                   — Phase 2 domain: catalogue, compatibility rules, generation compiler,
                                     reference-asset registry/policy/ingestion
  showroom/                       — Phase 3A domain: look library, recommendation engine, scoring config,
                                     final-outfit snapshot construction, look application/validation
  customer/                       — Phase 3B-4C business-domain core:
    types.ts                      — every shared domain type (Customer, Order, Fabric, ProductionJob, ...)
    permissions.ts                — the CustomerAction/StaffRole grant table + resource-level scoping helpers
    validation.ts                 — field validators + every state machine (session/order/production)
    repository.ts                 — the CustomerRepository interface + domain error classes (contract)
    prisma-repository.ts          — the real Postgres-backed implementation of that interface
    db.ts                         — lazy Prisma client singleton, DATABASE_URL-gated
    http.ts                       — shared route-handler primitives (auth, permission check, error mapping)
    measurement-fields.ts         — versioned allow-list of measurement field names
  *-handler.ts (repo root of lib/) — one handler file per domain, each exporting the route-level functions:
    customer-handler.ts, measurement-handler.ts, session-handler.ts, saved-outfit-handler.ts,
    showroom-finalize-handler.ts, order-handler.ts, order-material-handler.ts, fabric-handler.ts,
    production-handler.ts, try-on-handler.ts, split-try-on-handler.ts

prisma/
  schema.prisma                   — the single source of truth for every database table
  migrations/                     — one additive migration per phase that touched the database

tests/
  one *.test.ts per domain, plus shared fixtures: customer-fake-repository.ts (in-memory
  CustomerRepository implementation used by every test), customer-test-http.ts (role fixtures,
  jsonRequest helper)
```

## Database entities

All business-domain tables live in one PostgreSQL database (Neon-hosted in this deployment), accessed exclusively through Prisma via `@prisma/adapter-pg`. Redis (Upstash) and Vercel Blob are used only for ephemeral/operational state (locks, rate limits, idempotency, history metadata, generated images) — **never** for permanent business records. This boundary has held since Phase 3B and must not be crossed.

```
Customer
 ├─ id, name, phone (unique), email?
 ├─ preferredStyles[], preferredColours[], preferredFit?, preferredOccasions[]   (closed vocabularies)
 ├─ 1─* MeasurementProfile   (append-only, versioned)
 ├─ 1─* ShowroomSession
 ├─ 1─* SavedOutfit
 └─ 1─* Order

MeasurementProfile
 ├─ id, customerId → Customer (cascade delete)
 ├─ version (unique per customer, strictly increasing, never mutated)
 ├─ jacketMeasurements / trouserMeasurements / shirtMeasurements  (Json, allow-listed field names)
 └─ recordedBy, createdAt

ShowroomSession
 ├─ id, customerId → Customer (cascade delete)
 ├─ status: OPEN | EXPLORING | OUTFIT_SELECTED | COMPLETED | CANCELLED
 ├─ occasion?, selectedLookId?, finalOutfitSnapshotId?  (denormalized pointer, not an FK)
 ├─ createdBy, createdAt, updatedAt
 └─ 1─* SavedOutfit (via SavedOutfit.sessionId)

SavedOutfit
 ├─ id, customerId → Customer (cascade delete)
 ├─ sessionId? → ShowroomSession (set null on session delete)
 ├─ sourceType: MANUAL | SIGNATURE_LOOK, sourceLookId?
 ├─ outfitSnapshot (Json)   — the FULL validated FinalOutfitSnapshot, not just catalogue IDs
 ├─ tryOnResultUrl?   (reserved, always null — no generation occurs in this domain)
 ├─ createdBy, createdAt
 └─ 1─* Order (via Order.savedOutfitId, restrict delete)

Order
 ├─ id, customerId → Customer (cascade delete)
 ├─ savedOutfitId → SavedOutfit (restrict delete — an ordered outfit can never be deleted)
 ├─ outfitSnapshot (Json)         — COPIED from SavedOutfit at order-creation time
 ├─ measurementSnapshot (Json)    — COPIED from the customer's latest MeasurementProfile at that time
 ├─ status: DRAFT | CONFIRMED | TAILORING | TRIAL | ALTERATION | QUALITY_CHECK | READY | DELIVERED | CANCELLED
 ├─ createdBy, createdAt, updatedAt
 ├─ 1─* OrderMaterialSnapshot
 └─ 1─1 ProductionJob

Fabric
 ├─ id, name, composition, weight, season, colour, supplier?
 ├─ status: ACTIVE | INACTIVE
 ├─ createdAt
 ├─ 1─* FabricVariant
 └─ 1─* OrderMaterialSnapshot

FabricVariant
 ├─ id, fabricId → Fabric (cascade delete)
 ├─ colour, isAvailable
 └─ createdAt

OrderMaterialSnapshot
 ├─ id, orderId → Order (cascade delete), role: SUIT_FABRIC | SHIRT_FABRIC   [unique per (orderId, role)]
 ├─ fabricId → Fabric (restrict delete), fabricVariantId? → FabricVariant (restrict delete)
 ├─ fabricName, composition, weight, season, colour, supplier?, variantColour?   — COPIED, not re-derived
 └─ selectedBy, selectedAt

ProductionJob
 ├─ id, orderId → Order (restrict delete)   [unique — 1:1 with Order]
 ├─ currentStage: CONFIRMED | FABRIC_READY | CUTTING | STITCHING | FIRST_TRIAL | ALTERATION |
 │                FINAL_QC | READY_FOR_DELIVERY | COMPLETED | CANCELLED
 ├─ assignedStaffId?   (plain staff username string — no staff table exists, see below)
 ├─ createdAt, updatedAt
 └─ 1─* ProductionStageHistory

ProductionStageHistory   (append-only, never updated or deleted)
 ├─ id, productionJobId → ProductionJob (cascade delete)
 ├─ fromStage? (null only for the job-creation row), toStage
 └─ changedBy, createdAt
```

**Important: there is no `Staff`/`User` table in Postgres.** Staff identities live entirely outside the database, in the `AUTH_USERS_JSON`/`AUTH_USERS_JSON_BASE64` environment-variable allowlist (see `lib/auth/config.ts`). Every "who did this" field across the schema (`createdBy`, `recordedBy`, `selectedBy`, `changedBy`, `assignedStaffId`) is a plain string holding a staff **username**, server-derived from the authenticated session — never a foreign key, never client-suppliable. Do not introduce a Staff table without a deliberate, explicit decision to change this — every domain from 3B through 4C depends on this boundary staying exactly where it is.

## Domain relationships

```
Customer ──1:*── MeasurementProfile   (append-only history; an order snapshots the LATEST version)
Customer ──1:*── ShowroomSession ──1:*── SavedOutfit ──1:*── Order ──1:1── ProductionJob
                                                          │            │
                                                          └─1:*── OrderMaterialSnapshot ──*:1── Fabric ──1:*── FabricVariant
                                                                                                              (└ referenced by OrderMaterialSnapshot too)
                                                                       ProductionJob ──1:*── ProductionStageHistory
```

Reading this chain end to end: a **Customer** accumulates **MeasurementProfile** versions over time; a **ShowroomSession** is one visit during which a **SavedOutfit** may be created (either from a curated Signature Look or built manually); a **SavedOutfit** may later become an **Order** (a business commitment, snapshotting the outfit and the customer's current measurements at that moment); an **Order** may have **Fabric** selections attached per role via **OrderMaterialSnapshot**; and an **Order** may have exactly one **ProductionJob** tracking its progress through the workshop, with every stage change preserved in **ProductionStageHistory**.

## Architecture principles (established across all phases — do not violate)

1. **Snapshot, don't reference, at every business-commitment boundary.** `SavedOutfit.outfitSnapshot`, `Order.outfitSnapshot`, `Order.measurementSnapshot`, and `OrderMaterialSnapshot`'s descriptive fields are all full copies taken at the moment of commitment. None of them are re-derived from live catalogue/customer data on read. This is the single most important invariant in the codebase — see `DOMAIN_RULES.md`.
2. **The server is the sole authority for every derived or sensitive field.** IDs, timestamps, ownership, snapshots, status/stage values, and identity fields (`createdBy` etc.) are always server-computed. Every domain uses an explicit field allow-list (`hasUnexpectedFields`) on every mutating request — an unrecognized field is a 400, not a silently-ignored extra.
3. **Every domain ships "safe by default."** A domain that depends on infrastructure that might not be configured (Postgres for Customer/Order/Fabric/Production, Upstash for rate-limiting/generation-guard, the real OpenAI provider for Split generation) fails closed — a clean, typed error response (503 for missing infra) — rather than crashing or silently degrading. `SPLIT_GENERATION_ENABLED` and `DATABASE_URL`'s absence are both deliberate, reversible off-switches, not bugs.
4. **State machines, not free-form status fields.** Every status-like field (`ShowroomSession.status`, `Order.status`, `ProductionJob.currentStage`) has an explicit transition table in `lib/customer/validation.ts`, checked server-side on every write, with the same table exported for client-side "which buttons to show" rendering — but the client table is never the authority.
5. **Dependency-injectable route handlers, one in-memory fake, zero real database in `npm test`.** Every `*-handler.ts` function takes a `dependencies` parameter defaulting to the real Postgres-backed repository; every test in `tests/` injects `tests/customer-fake-repository.ts` instead. This is what makes `npm test` fast, deterministic, and safe to run without any live infrastructure.
6. **One authorization model, extended not replaced.** `StaffRole` + `CustomerAction` + `canPerform()` in `lib/customer/permissions.ts` is the single permission system for every business domain (Customer through Production). New roles/actions are additive extensions to this table, never a parallel system. See `PERMISSIONS.md`.
7. **OpenAI is the only AI/model call anywhere in this app, and it is narrowly scoped.** It is reached only through `lib/tryon/index.ts` → `lib/tryon/providers/openai.ts`, only for image generation (Level 1 catalogue try-on and Split Outfit try-on), gated by rate limits and the generation lock/idempotency guard. No business-domain code (Customer/Order/Fabric/Production) calls any AI provider, and none should ever.
8. **Additive migrations only.** Every Postgres migration since Phase 3B has been additive (`CREATE TABLE`/`CREATE TYPE`/`CREATE INDEX`/`ADD CONSTRAINT`); nothing has ever been dropped or destructively altered. See `AI_ENGINEERING_GUIDE.md`.
