# Nasir Bespoke — Permissions

Source of truth: `lib/customer/permissions.ts` (the grant table) plus, for Production, the resource-level scoping functions in that same file, applied inside `lib/production-handler.ts`. This is a **minimal, flat action → role-set model**, not a general RBAC platform — deliberately kept small (task instructions across Phases 3B-4C have consistently said "do not create unnecessary RBAC complexity," and the design has honored that every time).

## Roles

Six `StaffRole` values exist, in two groups:

**Original showroom/admin roles** (Phase 3B):
- `OWNER` and `MANAGER` — intentionally identical to each other. There is no owner-only operation yet (no user management, no deletion, no billing); the two are kept distinct in the type system only so a genuinely owner-only action can be added later without a redesign.
- `STAFF` — the general showroom-staff role. Can run the full customer-facing flow end-to-end (create a session, save an outfit, create an order, select fabric) but cannot create/edit a customer record, record a measurement, change an order's status, create/edit a fabric, or touch production.

**Atelier-operations roles** (Phase 4C — narrow, purpose-built, additive):
- `STYLE_CONSULTANT` — read-only "customer/order visibility." Every `*:read` action across every domain; zero create/update actions anywhere.
- `MASTER_TAILOR` — `production:read` + `production:update` only. No customer/order/fabric access of any kind. Works from the Atelier Dashboard (a production-domain-only view), not the Customer Profile tree.
- `QC_STAFF` — same isolation as Master Tailor (`production:read` + `production:update` only), but scoped differently — see Resource-level scoping below.

There is no staff/user database table (see `NASIR_ARCHITECTURE.md`) — a staff identity's role is read directly from the `AUTH_USERS_JSON`/`AUTH_USERS_JSON_BASE64` allowlist entry at authentication time. An allowlist entry with no `role` field defaults to `STAFF` (`DEFAULT_STAFF_ROLE`), the least-privilege default — never an elevated role.

## Actions (`CustomerAction`)

Grouped by domain, in the order they were introduced:

| Domain | Actions |
|---|---|
| Customer | `customer:create`, `customer:read`, `customer:update` |
| Measurement | `measurement:create`, `measurement:read` |
| Session | `session:create`, `session:read`, `session:update` |
| Saved Outfit | `outfit:create`, `outfit:read` |
| Order | `order:create`, `order:read`, `order:update` |
| Fabric | `fabric:create`, `fabric:read` |
| Order Material | `order:material:update` (reading materials reuses `order:read` — there is no separate `order:material:read`) |
| Production | `production:create`, `production:read`, `production:update` |

## Grant table

| Action | OWNER | MANAGER | STAFF | STYLE_CONSULTANT | MASTER_TAILOR | QC_STAFF |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `customer:create` | ✓ | ✓ | | | | |
| `customer:read` | ✓ | ✓ | ✓ | ✓ | | |
| `customer:update` | ✓ | ✓ | | | | |
| `measurement:create` | ✓ | ✓ | | | | |
| `measurement:read` | ✓ | ✓ | ✓ | ✓ | | |
| `session:create` | ✓ | ✓ | ✓ | | | |
| `session:read` | ✓ | ✓ | ✓ | ✓ | | |
| `session:update` | ✓ | ✓ | ✓ | | | |
| `outfit:create` | ✓ | ✓ | ✓ | | | |
| `outfit:read` | ✓ | ✓ | ✓ | ✓ | | |
| `order:create` | ✓ | ✓ | ✓ | | | |
| `order:read` | ✓ | ✓ | ✓ | ✓ | | |
| `order:update` | ✓ | ✓ | | | | |
| `fabric:create` | ✓ | ✓ | | | | |
| `fabric:read` | ✓ | ✓ | ✓ | ✓ | | |
| `order:material:update` | ✓ | ✓ | ✓ | | | |
| `production:create` | ✓ | ✓ | | | | |
| `production:read` | ✓ | ✓ | ✓ | ✓ | ✓ (scoped) | ✓ |
| `production:update` | ✓ | ✓ | | | ✓ (scoped) | ✓ (scoped) |

`canPerform(role, action)` in `lib/customer/permissions.ts` is the single function every route handler calls (via `authorizeStaffRequest()` in `lib/customer/http.ts`) to check this table. A `false` result is a 403.

## Rationale behind the grant boundaries

- **`order:create` is STAFF-permitted; `order:update` is not.** Creating an order is the natural conclusion of the showroom flow STAFF already owns end-to-end. Everything that happens to an order *after* creation (status changes toward delivery) is treated as a hard-to-undo, managerial-consequence action.
- **`order:material:update` is STAFF-permitted**, for the same reason as `order:create` — it's a selection made as part of the same showroom finalization, not a production-lifecycle change. It is deliberately *not* bundled with `order:update`.
- **`fabric:create` is MANAGER/OWNER-only** — fabric catalogue entries are curated business data with the same "wrong entry has real consequences" rationale as `customer:create`. `fabric:read` is open to STAFF because they need to browse the catalogue while placing an order.
- **`production:create` is MANAGER/OWNER-only**, same rationale as `order:update` — starting a production job is a managerial decision, not part of the showroom flow.
- **The three atelier roles are each granted only what their one job requires**, not "STAFF plus a bit more." This was a deliberate structural choice to satisfy "do not allow production staff to edit customer truth": Master Tailor and QC Staff have *zero* access to Customer/Measurement/Outfit/Order/Fabric data through the permission table — they cannot even read a customer record.

## Resource-level scoping (Production only)

Every other domain in this codebase uses **flat, non-resource-scoped** grants — if a role has `order:read`, it can read *any* order, full stop. Production is the one deliberate exception, because the task requirements ("Master Tailor: assigned production jobs" / "QC Staff: quality stage updates") are specific enough to require it. This scoping is implemented as two functions in `lib/customer/permissions.ts`, consulted by `lib/production-handler.ts` **after** the flat `canPerform()` check has already passed:

**`canReadProductionJob(role, username, assignedStaffId)`**
- `MASTER_TAILOR`: only if `assignedStaffId === username`. A job assigned to someone else — or unassigned — returns 404 (not 403; consistent with the "never leak cross-tenant existence" rule).
- Every other role with `production:read` (`OWNER`, `MANAGER`, `STAFF`, `STYLE_CONSULTANT`, `QC_STAFF`): unrestricted.
- Applied to `GET /api/orders/{id}/production`, `GET /api/production/{jobId}`, and (as a query filter, not just a response filter) `GET /api/production`.

**`canUpdateProductionJob(role, username, currentStage, assignedStaffId, toStage)`**
- If `toStage === "CANCELLED"`: only `OWNER`/`MANAGER`, regardless of every other rule below.
- Else if `role === "QC_STAFF"`: only if `currentStage === "FINAL_QC"` — i.e. QC Staff may only make the FINAL_QC outcome decision (`FINAL_QC → READY_FOR_DELIVERY` or `FINAL_QC → ALTERATION`), nothing else.
- Else if `role === "MASTER_TAILOR"`: only if `assignedStaffId === username` **and** `currentStage !== "FINAL_QC"` — a tailor can drive every stage of their own assigned job except the FINAL_QC decision itself, which is QC Staff's call.
- Else (`OWNER`/`MANAGER`): unrestricted.
- Reassignment is a separate check inside `handleUpdateProductionJobStageRequest`: if the request body includes `assignedStaffId` at all (even `null`, to clear it), the caller must be `OWNER`/`MANAGER` — this holds even for an otherwise-valid Master Tailor stage update that also tries to change the assignment in the same request.

No other domain has resource-level scoping. Do not add it elsewhere without a specific, explicit requirement — see `AI_ENGINEERING_GUIDE.md` on avoiding unnecessary RBAC complexity.
