# Nasir Bespoke — Roadmap

This supersedes the root `ROADMAP.md`, which reflects a Phase 1/2-era plan and is now stale. Status markers: ✅ shipped, 🔜 next, 🗺️ future/not yet designed.

## Completed work

| Phase | Status | Summary |
|---|---|---|
| 1 — Visual Try-On Foundation | ✅ | Staff auth, Level 1 curated catalogue, deterministic prompt compiler, OpenAI GPT Image 2 generation, generation-abuse protections (rate limits, per-user lock, idempotency), usage history. |
| 2 — Split Outfit Architecture | ✅ | Modular per-component outfit building with a deterministic compatibility engine, server-side recipe re-validation, canonical material-group system, reference-asset registry. |
| 3A — Signature Looks | ✅ | Curated look presets + deterministic recommendation engine + server-validated `FinalOutfitSnapshot` construction. |
| 3B — Customer Memory | ✅ | `Customer`/`MeasurementProfile`/`ShowroomSession`/`SavedOutfit`, database-gated-safe. 3-role authorization boundary established. |
| 3C — Database Activation | ✅ | Live Postgres (Neon) activated; Phase 3B's domain proven end-to-end against real data. |
| 4A — Orders | ✅ | `Order` domain with server-built snapshots and a validated status state machine. |
| 4B — Fabric Intelligence | ✅ | `Fabric`/`FabricVariant` curated catalogue + `OrderMaterialSnapshot`. |
| 4C — Atelier Production Foundation | ✅ | `ProductionJob`/`ProductionStageHistory`, 10-stage workflow, 3 new atelier roles with resource-level scoping, Atelier Dashboard. |
| 4D — Atelier Assignment | ✅ | Owner/Manager assign/reassign UI; allowlist-projected assignees (`GET /api/production/assignees`); `assignedStaffId` must be a `MASTER_TAILOR` identity. No Staff table, no migration. |
| 4E — Fabric Catalogue Management | ✅ | Edit/retire/reactivate fabrics; variant colour + availability; historical `OrderMaterialSnapshot` unchanged. No migration, not inventory. |
| 4F — Production Notes | ✅ | Append-only `ProductionNote` on `ProductionJob`. Atelier operational context only; never mutates measurements, preferences, or snapshots. |
| 4G — Preview Acceptance | ⚠️ | Source contracts green. Live Preview QA **incomplete**. Operator has applied `20260820120000_add_production_notes` to Preview/dev. Preview multi-role credentials still incomplete. Vercel Deployment Protection intercepts Preview before app auth. |

See `NASIR_ARCHITECTURE.md` for what each phase actually built, and `CLAUDE_RETURN_HANDOFF.md` for the Grok→Claude return.

## Recurring known limitations (carried forward from every recent phase report)

These are not phase-specific bugs — they are standing gaps that should be closed by whichever future work naturally touches them, or deliberately scheduled:

- **Only one Postgres database exists**, serving both local development and the Preview deployment. Production must **never** use this same `DATABASE_URL`. A dedicated Production database must be provisioned before Production is ever activated.
- **Preview role credentials are incomplete.** `npm run auth:create-user` emits a one-user `AUTH_USERS_JSON_BASE64` array and does not merge. Needed Preview identities for live QA: `MANAGER`, `MASTER_TAILOR`, `QC_STAFF`. This is an operator action (TTY + Vercel Sensitive Preview/`feature/split-outfit` only). Do not change Production auth.
- **Vercel Deployment Protection** intercepts unauthenticated Preview requests (SSO 302 / `Protected deployment`) before Nasir app login. This is not an application login defect. Live Preview QA cannot be marked complete until an operator authenticates through protection or intentionally changes Preview protection settings. Do not disable it as part of engineering work unless the owner asks.
- **Assignment history is not recorded** beyond current `ProductionJob.assignedStaffId`.
- **ProductionNote.createdBy** is a username string, not a display-name lookup.
- **No inventory, pricing/costing, procurement, or scheduling.**

## Next immediate operator / QA work (not a product phase)

1. Finish multi-role Preview `AUTH_USERS_JSON_BASE64` (MANAGER / MASTER_TAILOR / QC_STAFF), Preview branch only.
2. Authenticate through Vercel Deployment Protection (or change it deliberately).
3. Run live 4D–4F Preview QA (assignment, QA-named fabric only, notes scoping). Do not call paid try-on generation.

## Next engineering milestone

No next product phase is committed. Before new feature work, Claude should do a short planning pass with the owner. Speculative directions remain in the section below — they are **not** a queue.

## Future architecture (🗺️ — plausible, not designed, not committed)

Speculative directions consistent with what the atelier domain naturally grows into next, explicitly **not yet scoped or approved** — do not start building any of these without a task that names them explicitly:

- **Delivery/completion detail.** `ProductionJob` currently ends at `COMPLETED`; there is no delivery-confirmation record, no customer sign-off, no post-delivery follow-up tracking.
- **Costing and pricing**, if the business ever wants it — every phase through 4C has explicitly kept the Order/Fabric/Production domains free of pricing/invoicing fields ("this is NOT an ERP"). If a future phase is asked to add pricing, it is a deliberate, explicit scope expansion, not a natural extension of the current schema — treat it with the same care as any other irreversible business-data decision.
- **Supplier/inventory management**, if the atelier ever wants to track fabric stock/reorder — Phase 4B explicitly declined to build this ("this is NOT inventory or supplier management"). Would likely warrant its own phase and its own careful scope boundary, exactly like Fabric Intelligence did for the catalogue itself.
- **Scheduling/capacity planning** for the workshop (which tailor is free when, how many jobs are in flight at once) — Phase 4C explicitly declined to build this. The Atelier Dashboard today is a status board, not a scheduler.
- **Soft-delete/archival for customers**, if customer deletion is ever exposed more broadly — today, deleting a `Customer` cascades destructively to every downstream record (measurements, sessions, outfits, orders). This has never been a problem because nothing in the current UI exposes customer deletion at all, but it's worth resolving deliberately before any UI does.
- **Multi-location or multi-atelier support**, if the business ever expands beyond one workshop — nothing in the current schema assumes a single location, but nothing supports multiple either; this would be a genuinely new dimension, not an extension of any existing table.

None of the above should be inferred as "the next task" — they are context for whoever scopes that task, not a queue.
