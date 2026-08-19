# Nasir Bespoke — API Reference

Every route below is a Next.js App Router route handler (`app/api/**/route.ts`). All are private/staff-only — there is no public API. Unless noted otherwise, every route:

- Requires an authenticated staff session (`requireRequestUser`); returns **401** if absent/expired.
- Enforces same-origin on state-changing methods (`POST`/`PATCH`); returns **403** on a cross-origin request.
- Returns JSON, `Cache-Control: no-store, private`.
- Business-domain routes (Customer through Production) return **503** if `DATABASE_URL` is not configured, rather than crashing.

Route handler logic lives in `lib/*-handler.ts`; route files themselves are thin wrappers that unwrap `params` and call the handler. Permission names below refer to the `CustomerAction` grant table in `lib/customer/permissions.ts` — see `PERMISSIONS.md` for the full role matrix.

---

## Auth domain

Handler: `lib/auth/*`. No `CustomerAction` permission model — this domain predates it and governs session issuance itself.

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Validates credentials against the `AUTH_USERS_JSON`/`AUTH_USERS_JSON_BASE64` staff allowlist (bcrypt), rate-limited (`checkLoginRateLimit`), issues a signed session cookie. Body: `{ username, password }`. |
| `/api/auth/logout` | POST | Clears the session cookie / invalidates the active-session record. |

---

## Generation domain (Phase 1 / Phase 2 — visual try-on)

No `CustomerAction` permission model — gated purely by authentication, rate limits, and the generation lock/idempotency guard (`lib/generation-guard.ts`). This domain never touches Postgres.

| Route | Method | Purpose |
|---|---|---|
| `/api/catalog` | GET | Legacy/general catalog read (Phase 1). |
| `/api/level1-catalog` | GET | Reads the curated Level 1 garment catalogue (Redis-backed, `lib/catalog/level1-store.ts`). |
| `/api/catalog-assets/{assetId}` | GET | Streams a private catalogue reference image/asset by ID. |
| `/api/try-on` | POST | **Paid.** Generates a Level 1 (Full Outfit) try-on visualization: multipart body (person photo, fabric photo, catalogue design ID, optional bespoke config). Server-side deterministic prompt compiler + OpenAI GPT Image 2. Rate-limited per user/hour/day/global-day; requires an `Idempotency-Key` header (UUID) plus the per-user distributed lock — a second concurrent call for the same user is rejected, and a retried request with the same idempotency key replays the prior result rather than re-billing. |
| `/api/split-try-on` | POST | **Paid.** Generates a Split Outfit try-on visualization: a client-submitted modular recipe (upper/lower/shirt/waistcoat/footwear/accessories + materials) is **independently re-validated server-side** against the same deterministic compatibility rules the UI uses (`lib/split-outfit/generation-compiler.ts`) before any provider call — a client can never submit a pre-built prompt or force an invalid combination through. Gated additionally by the server-only `SPLIT_GENERATION_ENABLED` flag (defaults off); same rate-limit/lock/idempotency protections as `/api/try-on`. |
| `/api/history` | GET | Lists the caller's own generation history (Redis-backed metadata). |
| `/api/history/{id}/asset/{asset}` | GET | Streams a specific generated-image asset from a history entry (private Vercel Blob, if configured). |

---

## Showroom domain (Phase 3A — Signature Looks)

| Route | Method | Purpose |
|---|---|---|
| `/api/showroom/finalize-outfit` | POST | Reconstructs and server-validates a `FinalOutfitSnapshot` from a strict client field allow-list (declared source + component selection IDs — never a pre-built snapshot object). Reuses `validateSplitRecipe` as the sole compatibility authority. No permission check beyond authentication (predates the `CustomerAction` model; called from within the showroom UI flow before a customer/session necessarily exists). |

---

## Customer domain (Phase 3B)

Handler: `lib/customer-handler.ts`. Base path: `/api/customers`.

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/customers` | GET | `customer:read` | Search customers by name/phone (`?q=`), or list recent. |
| `/api/customers` | POST | `customer:create` | Create a customer. Body: `{ name, phone, email?, preferences? }`. 409 on duplicate phone. |
| `/api/customers/{customerId}` | GET | `customer:read` | Fetch one customer by ID. 404 if unknown. |
| `/api/customers/{customerId}` | PATCH | `customer:update` | Update `name`/`email`/`preferences`. Field allow-list enforced; preferences validated against closed vocabularies. |

## Measurement domain (Phase 3B)

Handler: `lib/measurement-handler.ts`. Base path: `/api/customers/{customerId}/measurements`.

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/customers/{customerId}/measurements` | GET | `measurement:read` | Full version history for the customer, newest first. |
| `/api/customers/{customerId}/measurements` | POST | `measurement:create` | Records the **next** version (append-only — never an edit). Body: `{ jacketMeasurements, trouserMeasurements, shirtMeasurements }`, each validated against a versioned field allow-list. |

## Session domain (Phase 3B)

Handlers: `lib/customer-handler.ts` (create/list, nested under customers) + `lib/session-handler.ts` (update, top-level).

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/customers/{customerId}/sessions` | GET | `session:read` | Lists the customer's showroom sessions. |
| `/api/customers/{customerId}/sessions` | POST | `session:create` | Opens a new session (`status: OPEN`). Body: `{ occasion? }`. |
| `/api/sessions/{sessionId}` | PATCH | `session:update` | Advances session status per `SESSION_TRANSITIONS` (`OPEN → EXPLORING → OUTFIT_SELECTED → COMPLETED`, `CANCELLED` from any non-terminal state). Also used internally to set `finalOutfitSnapshotId` when an outfit is saved. |

## Saved Outfit domain (Phase 3B)

Handler: `lib/saved-outfit-handler.ts`. Base path: `/api/customers/{customerId}/outfits`.

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/customers/{customerId}/outfits` | GET | `outfit:read` | Lists the customer's saved outfits. |
| `/api/customers/{customerId}/outfits` | POST | `outfit:create` | Saves an outfit to customer history. Body: the same minimal field set `/api/showroom/finalize-outfit` accepts (`sessionId?`, `source`, `lookId`/component IDs) — the full `FinalOutfitSnapshot` is always reconstructed server-side via `resolveFinalOutfitSnapshot()`, never accepted directly from the client. If `sessionId` is given, the session must belong to this customer and be open; saving auto-advances the session to `OUTFIT_SELECTED`. |

## Order domain (Phase 4A)

Handlers: `lib/order-handler.ts`. Base paths: `/api/customers/{customerId}/orders` (create/list) and `/api/orders/{orderId}` (get/update — top-level, not customer-nested).

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/customers/{customerId}/orders` | GET | `order:read` | Lists the customer's orders, newest first. |
| `/api/customers/{customerId}/orders` | POST | `order:create` | Creates an order from a saved outfit. Body: `{ savedOutfitId }` **only**. Server independently re-fetches the outfit (must belong to this customer) and the customer's latest measurement (required — 400 if none), builds both snapshots itself, sets `status: DRAFT`. |
| `/api/orders/{orderId}` | GET | `order:read` | Fetch one order by ID. |
| `/api/orders/{orderId}` | PATCH | `order:update` | Advances order status per `ORDER_STATUS_TRANSITIONS`. Body: `{ status }` only. |

## Fabric domain (Phase 4B)

Handler: `lib/fabric-handler.ts`. Base paths: `/api/fabrics` and `/api/fabrics/{fabricId}/variants`.

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/fabrics` | GET | `fabric:read` | Lists the fabric catalogue. |
| `/api/fabrics` | POST | `fabric:create` | Creates a fabric. Body: `{ name, composition, weight, season, colour, supplier?, status? }` (`status` defaults `ACTIVE`). Curated data entry — never AI-generated. |
| `/api/fabrics/{fabricId}/variants` | GET | `fabric:read` | Lists a fabric's colourway/availability variants. |
| `/api/fabrics/{fabricId}/variants` | POST | `fabric:create` | Creates a variant. Body: `{ colour, isAvailable? }` (defaults `true`). 404 if the fabric doesn't exist. |

## Order Material domain (Phase 4B)

Handler: `lib/order-material-handler.ts`. Base path: `/api/orders/{orderId}/materials`.

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/orders/{orderId}/materials` | GET | `order:read` | Lists the order's current material selections (one per role). |
| `/api/orders/{orderId}/materials` | POST | `order:material:update` | Attaches/replaces a fabric selection for one role. Body: `{ role, fabricId, fabricVariantId? }` **only** — never the descriptive fabric fields. Server re-validates the fabric is `ACTIVE` and the variant (if given) belongs to it and is available, then builds the snapshot itself. Upserts on `(orderId, role)`. |

## Production domain (Phase 4C)

Handler: `lib/production-handler.ts`. Base paths: `/api/orders/{orderId}/production` (create/get-by-order), `/api/production/{jobId}` (get-by-id/update), `/api/production` (list, for the Atelier Dashboard).

| Route | Method | Permission | Purpose |
|---|---|---|---|
| `/api/orders/{orderId}/production` | GET | `production:read` | Fetches the order's production job (if any) plus full stage history: `{ job, history }`. 404 if no job exists yet, or if the job exists but is outside the caller's scope (e.g. a Master Tailor viewing a job assigned to someone else). |
| `/api/orders/{orderId}/production` | POST | `production:create` | Creates the job (one per order — 409 if one already exists). Body: `{ assignedStaffId? }` only. Sets `currentStage: CONFIRMED` and writes the first history row (`null → CONFIRMED`). |
| `/api/production/{jobId}` | GET | `production:read` | Same shape as get-by-order, addressed by job ID directly. |
| `/api/production/{jobId}` | PATCH | `production:update` | Advances the stage per `PRODUCTION_STAGE_TRANSITIONS`, **plus** role-based resource scoping (see `PERMISSIONS.md`): a Master Tailor may only act on a job assigned to them and never on the FINAL_QC decision; a QC Staff member may only act when the job is currently at FINAL_QC; moving to `CANCELLED` or reassigning (`assignedStaffId` in the body) requires `production:assign` (Owner/Manager). `assignedStaffId` must be `null` or a `MASTER_TAILOR` username from the auth allowlist — never a free-form string. Body: `{ toStage, assignedStaffId? }`. Returns `{ job, history }`. |
| `/api/production` | GET | `production:read` | Lists production jobs for the Atelier Dashboard, optionally filtered by `?stage=`. A Master Tailor's list is automatically filtered server-side to only jobs assigned to them (not just filtered in the response). |
| `/api/production/assignees` | GET | `production:assign` | Lists assignable atelier workers as `{ assignees: [{ username, displayName, role }] }` — a safe projection of the auth allowlist, `MASTER_TAILOR` only. Never includes password hashes or secrets. OWNER/MANAGER only. |

---

## Contract conventions used throughout

- **Errors**: `{ error: string }`, with the HTTP status carrying the meaning (400 validation, 401 unauthenticated, 403 unauthorized/cross-origin, 404 not-found-or-not-yours, 409 conflict, 503 infrastructure-not-configured).
- **Success bodies**: the created/updated resource directly (e.g. `Order`, `ProductionJob`), or `{ <plural>: [...] }` for list endpoints, or a small composite object where a detail view needs more than one resource (`{ job, history }`).
- **Every mutating body has an explicit allow-list** — any field not named in this reference for a given route is rejected with 400 "Unexpected field...".
- **IDs are UUIDs** (Postgres `@default(uuid())`), timestamps are ISO-8601 strings (Prisma `DateTime` mapped through `.toISOString()` in each domain's `prisma-repository.ts` mapper functions).
