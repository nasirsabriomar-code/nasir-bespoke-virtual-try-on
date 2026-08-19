# Handoff to the Next Engineering Agent

You're picking up Nasir Bespoke after Phases 1 through 4C, done by a prior Claude agent working turn-by-turn with the project owner over several sessions. This document is written directly to you — read it before touching anything, and use it to decide how to work, not just what exists.

## Read order

1. This document, in full.
2. `NASIR_ARCHITECTURE.md` — the system map. Directory layout, database schema, domain relationships, and the 8 architecture principles every phase has followed.
3. `DOMAIN_RULES.md` — the actual business rules per domain, with the enforcing file named for each one.
4. `PERMISSIONS.md` — the full role/action grant table plus the one place (Production) that has resource-level scoping.
5. `API_REFERENCE.md` — every route, verified directly against the route files (not reconstructed from memory).
6. `AI_ENGINEERING_GUIDE.md` — how work here is actually done: coding/testing/migration conventions, and a list of things to never do, each with the real incident that taught the lesson.
7. `NASIR_ROADMAP.md` — what's done, what's next, what's speculative.

The root also still has older docs (`ARCHITECTURE.md`, `ROADMAP.md`, `SECURITY.md`, `AI_AGENT_GUIDE.md`, `PROJECT_CONTEXT.md`, and a couple of `ANTIGRAVITY_*` files from an even earlier handoff). They describe a Phase 1/2-era snapshot and were **not** deleted, only superseded — do not treat them as current, and don't be misled by them describing a simpler system than what's actually here now.

## What exists

A single Next.js 16 App Router application, deployed on Vercel, used privately by one bespoke menswear atelier's staff. It has grown two overlapping capabilities in the same codebase:

- **A visual try-on generator** (Phases 1-2): staff upload a customer photo and a fabric reference, pick a garment (from a curated catalogue or a modular Split Outfit builder), and get an AI-generated visualization via OpenAI's image model. This is the original product and is still the primary interactive workspace.
- **A bespoke business system** (Phases 3A-4C): built as an additive memory/workflow layer reached from inside that same workspace. Customer records → measurements → showroom sessions → saved outfits → orders → fabric selection → production tracking. Every layer snapshots what came before it rather than referencing it live, so historical records stay true forever even as the underlying catalogue/customer data changes.

Everything runs against one PostgreSQL database (Neon, Preview-environment only right now — Production has no database configured, deliberately) for the business domains, and Upstash Redis + optional Vercel Blob for everything ephemeral (rate limits, generation locks, idempotency, usage history, generated images). There is no user-facing product here — every screen is behind staff authentication.

The full, verified list of what's been built is in `NASIR_ARCHITECTURE.md`'s phase table and directory map. Don't take my summary as exhaustive — read that document.

## What must not change

These are architectural commitments, not style preferences. Changing any of them is a large, deliberate decision that should be flagged and confirmed before doing it, not something to drift into while implementing something else:

- **The snapshot-at-commitment pattern.** `SavedOutfit.outfitSnapshot`, `Order.outfitSnapshot`, `Order.measurementSnapshot`, `OrderMaterialSnapshot`'s descriptive fields — all full copies, never live references. This is the core guarantee the whole business-domain side of the app exists to provide.
- **No staff/user database table.** Every "who did this" field is a plain username string, server-derived from the session, validated against the same username pattern the auth allowlist uses — never a foreign key. A large amount of code assumes this.
- **The permission model stays flat-grant-first.** `StaffRole` × `CustomerAction` × `canPerform()` is the one system. Production's resource-level scoping is a deliberate, narrow exception (see `PERMISSIONS.md`) — don't generalize it into a pattern for every domain without being asked to.
- **OpenAI is reachable from exactly one place** (`lib/tryon/` → the provider abstraction), for image generation only. No business-domain code calls it, and none should.
- **`main` and Production are off-limits by default.** Every phase from 3B onward has worked exclusively on `feature/split-outfit`, pushed only that branch, and verified only against Preview deployments. Do not merge to `main` or deploy to Production unless the user asks for that specific action in that specific turn.
- **Migrations are additive-only**, generated with the `-o` flag (never a shell redirect — that exact mistake corrupted a migration file once already and cost real cleanup time).
- **This is not an ERP.** Order/Fabric/Production have all been explicitly, repeatedly kept free of pricing, invoicing, inventory/stock, supplier ordering, and scheduling/capacity-planning logic. If a task seems to want one of those, that's a scope question worth surfacing, not something to infer your way into.

`AI_ENGINEERING_GUIDE.md`'s "Things future agents must never do" list is the fuller, more literal version of this section — treat it as binding.

## How to continue safely

- **Mirror before you invent.** Every new domain so far was built by finding the most similar existing domain and copying its file structure, naming, and conventions closely (types → repository interface + Prisma impl → permissions → validation/state-machine → handler → routes → fake-repository extension → tests). If you're adding something new, find its nearest sibling in the codebase first.
- **Extend the one repository interface and the one fake.** `lib/customer/repository.ts`'s `CustomerRepository` interface and `tests/customer-fake-repository.ts`'s in-memory implementation cover every business domain, including Production. A new domain adds methods to both — it does not create a parallel interface or a parallel test double.
- **Run the full test suite, not just your new file, before considering anything done.** Shared files (`permissions.ts`, `http.ts`, the fake repository) affect every domain at once; this has mattered in practice.
- **Every new mutating endpoint needs, at minimum**: an explicit field allow-list, server-derived IDs/timestamps/identity, a `try`/`catch` around the repository call mapping `DatabaseConfigurationError` to 503, and the full security test list in `AI_ENGINEERING_GUIDE.md`. Two real bugs shipped in this codebase's history from skipping the try/catch specifically — check for it explicitly on anything you write.
- **When you're not sure whether something is in scope, ask or flag it — don't guess and proceed.** Every phase so far has treated "this is NOT an ERP / NOT inventory / NOT a scheduler" boundaries as load-bearing instructions, not vague guidance, and has stayed inside them even when a broader interpretation would have been easy to justify.
- **Verify against a live database when the task calls for it, but don't fabricate Preview-UI access you don't have.** The Preview-only STAFF test account's password is not recoverable through available tooling (see `NASIR_ROADMAP.md`'s known limitations). Prior phases have consistently substituted full local-dev browser QA against the same live database instead of skipping verification — do the same rather than skipping verification or inventing a result.
- **Read the actual current file before describing or extending it.** The docs in this handoff package were written by reading the real source (schema, handlers, permissions, route files) directly, not from memory of what was asked for — do the same when you pick up from here, especially since this package itself will start going stale the moment new work lands on top of it.

## One honest note

This handoff package (`NASIR_ARCHITECTURE.md`, `DOMAIN_RULES.md`, `AI_ENGINEERING_GUIDE.md`, `API_REFERENCE.md`, `PERMISSIONS.md`, `NASIR_ROADMAP.md`, and this file) is accurate as of commit `71a2cef08ba2424b29a96738fca5b15a872fc861` on `feature/split-outfit`. It will drift the moment anything changes. Treat it as a strong starting map, not a substitute for reading the code — and if you find it's wrong about something, that's worth fixing in the docs as part of whatever change made it wrong, so the next handoff after yours starts from an accurate baseline too.
