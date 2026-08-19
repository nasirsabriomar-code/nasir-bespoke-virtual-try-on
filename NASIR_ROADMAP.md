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

See `NASIR_ARCHITECTURE.md` for what each phase actually built, and each phase's `AI_TASK_REPORT.md`-era snapshot (in git history) for verification detail — reports are overwritten each phase, so only the latest is present in the working tree at any time; prior ones are recoverable from commit history if needed.

## Recurring known limitations (carried forward from every recent phase report)

These are not phase-specific bugs — they are standing gaps that should be closed by whichever future work naturally touches them, or deliberately scheduled:

- **Only one Postgres database exists**, serving both local development and the Preview deployment. It currently holds no Production data (fine for now), but a **separate, dedicated database must be provisioned before Production is ever activated** — never point Production at this same Preview/dev database.
- **The Preview-only STAFF test account's credentials are not recoverable by an agent** (stored as a write-only Vercel "Sensitive" env var). This has meant Preview-UI interactive QA has been substituted with local-UI QA against the identical live database for every phase since 3C. A future session should either rotate that account (recording the new password somewhere retrievable, outside the repo) or provision dedicated Preview identities for the newer roles (`MANAGER`/`OWNER`, and now `MASTER_TAILOR`/`QC_STAFF`) so a future Preview pass can exercise the full role matrix through the deployed UI directly.
- **No fabric edit/retire UI** — only create + list exist through the API; `Fabric.status` is settable at creation time only for now.

## Next milestones (🔜 — natural next steps, not yet started)

These follow from the standing gaps above — pick based on what the atelier actually needs next, not necessarily in this order:

1. **Preview role credentials.** Rotate or provision proper `MANAGER`/`OWNER`/`MASTER_TAILOR`/`QC_STAFF` Preview identities (see limitations above) so future Preview QA doesn't have to fall back to local verification every time.
2. **Dedicated Production database provisioning**, whenever Production activation is actually planned — this is infrastructure work, not a code change, but should happen before any Production deploy of the business domains.
3. **Fabric catalogue management UI** (edit/retire an existing fabric or variant) — currently API-only.

## Future architecture (🗺️ — plausible, not designed, not committed)

Speculative directions consistent with what the atelier domain naturally grows into next, explicitly **not yet scoped or approved** — do not start building any of these without a task that names them explicitly:

- **Delivery/completion detail.** `ProductionJob` currently ends at `COMPLETED`; there is no delivery-confirmation record, no customer sign-off, no post-delivery follow-up tracking.
- **Costing and pricing**, if the business ever wants it — every phase through 4C has explicitly kept the Order/Fabric/Production domains free of pricing/invoicing fields ("this is NOT an ERP"). If a future phase is asked to add pricing, it is a deliberate, explicit scope expansion, not a natural extension of the current schema — treat it with the same care as any other irreversible business-data decision.
- **Supplier/inventory management**, if the atelier ever wants to track fabric stock/reorder — Phase 4B explicitly declined to build this ("this is NOT inventory or supplier management"). Would likely warrant its own phase and its own careful scope boundary, exactly like Fabric Intelligence did for the catalogue itself.
- **Scheduling/capacity planning** for the workshop (which tailor is free when, how many jobs are in flight at once) — Phase 4C explicitly declined to build this. The Atelier Dashboard today is a status board, not a scheduler.
- **Soft-delete/archival for customers**, if customer deletion is ever exposed more broadly — today, deleting a `Customer` cascades destructively to every downstream record (measurements, sessions, outfits, orders). This has never been a problem because nothing in the current UI exposes customer deletion at all, but it's worth resolving deliberately before any UI does.
- **Multi-location or multi-atelier support**, if the business ever expands beyond one workshop — nothing in the current schema assumes a single location, but nothing supports multiple either; this would be a genuinely new dimension, not an extension of any existing table.

None of the above should be inferred as "the next task" — they are context for whoever scopes that task, not a queue.
