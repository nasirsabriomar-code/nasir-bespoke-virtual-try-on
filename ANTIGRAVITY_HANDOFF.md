# NASIR BESPOKE — ANTIGRAVITY HANDOFF

**Purpose:** factual takeover record for the next coding agent (Google Antigravity).

**Scope:** documentation only. This file records the current local working tree and known production-readiness state. It does not authorize code changes, Redis changes, deployment, or paid generation.

**Authority rule:** the current repository is authoritative for what is implemented. Earlier plans are identified as plans where they differ from the code.

---

## 1. Project overview

Nasir Bespoke Visual Try-On is an internal showroom tool for Nasir Bespoke staff. Staff use a customer/model photograph, a fabric photograph, and a controlled menswear design reference to request a photorealistic visualization through OpenAI GPT Image 2. It is not a public consumer editor and the employee does not write a prompt.

The product has an explicit two-level direction.

### Level 1 — current priority

```text
Customer photo → Fabric photo → Category → Curated design card → Generate
```

Level 1 is a simple curated catalogue experience. Staff choose a small number of approved design concepts; hidden server-side blueprints supply construction instructions.

### Level 2 — future advanced configurator

The existing advanced/legacy system contains detailed garment selection and Suit configuration (composition, closure, lapels, pockets, trousers, accessories, and structured outfit specifications). Level 2 is the future expert workflow for those controls. It must remain preserved, but it is not the Level 1 customer-facing workflow.

The current local implementation renders the Level 1 root flow while retaining legacy and deep-configurator code paths in the repository and server contracts.

---

## 2. Repository and Git state

Repository:

```text
/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web
```

At handoff creation:

- Branch: `main`
- `HEAD`: `4271f433501c43ebb0af7bd9931e4ebf7cc5ef76`
- `origin/main`: `4271f433501c43ebb0af7bd9931e4ebf7cc5ef76`
- Working tree: **dirty**
- Staged files: none observed
- Level 1 changes: uncommitted local working-tree changes
- Commit/push/deployment from this handoff task: none
- Production Redis migration: not performed
- OpenAI generation during this handoff task: not performed

**Critical takeover warning:** the Level 1 implementation exists in this local working tree. Do not run `git reset`, `git clean`, destructive checkout, stash/restore, or a fresh clone over this directory without preserving and reviewing the changes first.

### Modified tracked files already present

```text
app/api/history/[id]/asset/[asset]/route.ts
app/api/history/route.ts
app/globals.css
components/TryOnApp.tsx
components/UsageHistory.tsx
lib/catalog/types.ts
lib/generation-storage.ts
lib/try-on-handler.ts
lib/tryon/types.ts
lib/usage-history.ts
package.json
```

The `package.json` change adds Level 1 tests to `test:catalog`; it is existing Level 1 work, not a change from this handoff task.

### Untracked files already present

```text
LEVEL_1_CATALOGUE_SPECIFICATION.md
app/api/catalog-assets/[assetId]/route.ts
app/api/level1-catalog/route.ts
components/Level1Catalogue.tsx
lib/catalog/level1-assets.ts
lib/catalog/level1-prompt.ts
lib/catalog/level1-seed.ts
lib/catalog/level1-store.ts
lib/catalog/level1-types.ts
tests/level1-catalog.test.ts
tests/level1-try-on.test.ts
```

`ANTIGRAVITY_HANDOFF.md` is created by this task and will itself be untracked until deliberately committed.

The prior production URL is:

```text
https://nasir-bespoke-virtual-try-on.vercel.app
```

This task did not deploy. Treat production as potentially behind this uncommitted local implementation.

---

## 3. Original application architecture preserved

The application is a Next.js App Router application using TypeScript, React, Tailwind/PostCSS styling, Vercel-compatible route handlers, Upstash Redis, Vercel Blob, and the official OpenAI Node SDK.

Important existing components and server modules:

- `components/TryOnApp.tsx` — main client workflow/state, uploads, generation state, result, reset/retry, and now Level 1 catalogue UI.
- `components/BespokeConfigurator.tsx` — advanced visual Suit/customization UI retained for Level 2.
- `lib/bespoke/engine.ts`, `lib/bespoke/suit-profile.ts` — structured advanced outfit specification and dependency/conflict validation.
- `lib/catalog/seed.ts`, `lib/catalog/store.ts`, `lib/catalog/types.ts`, `lib/catalog/compatibility.ts` — legacy/advanced catalogue and compatibility.
- `lib/try-on-handler.ts` — server generation lifecycle and strict FormData validation.
- `lib/tryon/prompt.ts` — legacy permanent hidden prompt composition.
- `lib/catalog/level1-prompt.ts` — Level 1 hidden prompt compiler.
- `lib/tryon/providers/openai.ts` — GPT Image 2 provider adapter.
- `lib/tryon/index.ts` — provider selection (currently OpenAI only).
- `lib/openai.ts` — server-only OpenAI client, timeout, and retry policy.
- `lib/generation-storage.ts` — private Vercel Blob storage for person, fabric, references, and result.
- `lib/usage-history.ts` — Redis-backed history events and client-safe redaction.
- `lib/auth/*` — credentials, sessions, cookies, and auth configuration.
- `lib/rate-limit.ts` — Redis-backed generation/login limits; memory fallback only outside production.
- `lib/generation-guard.ts` — generation lock, idempotency, replay protection, fail-closed Redis behavior.
- `lib/request-security.ts` — same-origin/origin validation.
- `app/api/try-on/route.ts` — delegates to the handler.
- `app/api/history/route.ts`, `app/api/history/[id]/asset/[asset]/route.ts` — authenticated history and private history asset access.

Preserved controls include authentication, same-origin protection, upload validation, GPT Image 2 model control, Redis rate limiting, locks, idempotency/replay protection, fail-closed Redis behavior, private history/result storage, legacy catalogue, and the deep Suit engine.

Added Level 1 code is isolated in `lib/catalog/level1-*`, `components/Level1Catalogue.tsx`, the two Level 1 API routes, and the Level 1 branch of the handler. Legacy source and contracts remain present.

---

## 4. Level 1 architecture implemented

### Client request

`TryOnApp.tsx` fetches `/api/level1-catalog`, validates the projection, renders `Level1Catalogue`, and submits only:

```text
selectionMode=level1
person=<validated image file>
fabric=<validated image file>
categoryId=suit
designId=<one trusted Suit ID>
```

Level 1 does not send prompt text, blueprint text, storage paths, model, quality, provider, or arbitrary reference URLs.

`components/Level1Catalogue.tsx` renders active category tabs and visual cards. Active cards use protected application asset routes. Pending cards show a neutral “Catalogue image awaiting approval” placeholder. Designs can be reviewed, but generation remains unavailable until the primary construction asset is ready.

### Server request path

```text
Authenticated browser
  → GET /api/level1-catalog
  → choose category/design IDs
  → POST /api/try-on
  → auth + same-origin + upload validation
  → exact ID/category validation
  → server-owned design and private asset resolution
  → pending/unavailable asset rejection
  → Redis lock + idempotency + rate checks
  → private construction reference read
  → hidden Level 1 prompt compilation
  → OpenAI GPT Image 2 provider
  → private Blob history storage
  → Redis usage event
  → browser result/history state
```

### Catalogue projection

`app/api/level1-catalog/route.ts` is authenticated, dynamic, private/no-store, and returns only category/design customer information plus an application asset route when active. It never returns blueprints, prompt fragments, negative constraints, private paths, or raw Blob URLs.

### Private catalogue asset route

`app/api/catalog-assets/[assetId]/route.ts` authenticates, validates the asset ID shape, resolves it through the server catalogue, reads private Blob with the server token, and streams bytes with private/no-store and `nosniff` headers. Unauthenticated, invalid, inactive, or unavailable assets return “Not found”.

### Asset pending

`resolveLevel1Design()` requires an active primary construction asset with trusted private path and content type. `asset_pending` is raised before generation locks, rate checks, private reference reads, or an OpenAI call. The local seed has the five approved assets active; production Redis may still hold older state until migration.

### History

Level 1 success events record `mode: "level1"`, category ID/name, curated design ID/name/version, `curatedAssetStatus: "ready"`, timestamp, user, device/browser/OS, duration, provider/model/quality/status, and private asset references where storage is configured. Client responses redact private pathnames.

---

## 5. Full Level 1 taxonomy

Intended categories:

1. Suits
2. Sherwanis
3. Bandhgalas
4. Nehru Jackets
5. Kurta Sets
6. Indo-Western
7. Achkans

Jodhpuri is a style/synonym within Bandhgala. Achkan remains separate because of its longer ceremonial silhouette.

**Actual implementation:** only `suit` contains designs. The other six categories are draft records in the seed but have no active designs or generation blueprints.

---

## 6. Five authoritative Suit designs

Source of truth: `lib/catalog/level1-seed.ts`.

### `SUIT_01_CLASSIC`

- Customer name: **Classic**
- Description: **Timeless everyday elegance**
- Intent: Business meetings, professional occasions, and versatile formal wear.
- Sort order: 1
- Garment family: Modern tailored suit
- Silhouette: balanced, premium tailored
- Included pieces: single-breasted jacket, matching tailored trousers
- Construction: single-breasted; two-button closure; notch lapel; natural structured shoulder; flap hip pockets; double vent preferred; matching tailored trousers.
- Generation identity: professional, timeless, versatile.
- Negative: do not make it ceremonial or exaggerated.

### `SUIT_02_TUXEDO`

- Customer name: **Tuxedo**
- Description: **Refined evening formality**
- Intent: Black-tie events, luxury evenings, weddings, and formal celebrations.
- Sort order: 2
- Garment family: Formal evening suit
- Silhouette: refined, formal evening
- Included pieces: dinner jacket, matching formal trousers
- Construction: single-breasted one-button dinner jacket; **satin peak lapel**; satin facing; jetted hip pockets; matching formal trousers with satin stripe.
- Generation identity: luxury eveningwear.
- Negative: do not turn it into a normal business suit.

### `SUIT_03_STATEMENT`

- Customer name: **Statement**
- Description: **Bold celebratory tailoring**
- Intent: Weddings, receptions, and luxury occasions.
- Sort order: 3
- Garment family: Fashion-forward formal suit
- Silhouette: strong, expressive, tailored
- Included pieces: formal jacket, matching trousers
- Construction: expressive formal tailoring; stronger/elevated premium proportions; peak lapel preferred; matching tailored trousers.
- Generation identity: confident, expressive, memorable.
- Negative: avoid costume appearance and unrealistic fashion shapes.

### `SUIT_04_DOUBLE_BREASTED`

- Customer name: **Double-Breasted**
- Description: **Strong and commanding**
- Intent: Executive dressing and luxury formalwear.
- Sort order: 4
- Garment family: Structured double-breasted suit
- Silhouette: structured, authoritative, classic luxury
- Included pieces: double-breasted jacket, matching trousers
- Construction: double-breasted jacket; six-button configuration; peak lapels; structured shoulder; overlapping front panels; flap pockets; matching tailored trousers.
- Generation identity: authority, confidence, classic luxury.
- Negative: do not convert the jacket to single-breasted.

### `SUIT_05_THREE_PIECE`

- Customer name: **Three-Piece**
- Description: **Complete formal look**
- Intent: Weddings, premium celebrations, and important occasions.
- Sort order: 5
- Garment family: Three-piece tailored suit
- Silhouette: sophisticated, complete, formal
- Included pieces: single-breasted jacket, matching waistcoat, matching tailored trousers
- Construction: single-breasted two-button jacket; **notch lapel**; matching five-button waistcoat visibly layered below jacket; matching tailored trousers.
- Generation identity: sophisticated complete formal ensemble.
- Negative: do not omit the waistcoat or convert it to a two-piece suit.

All five records are version 1, category `suit`, active, and sorted 1–5 in the local seed.

---

## 7. Generation authority model

### Customer photo — sole person/scene authority

Controls identity and face; skin tone, age appearance, hair and facial hair; actual body size/build/proportions/height/width; pose, posture, expression and hands; camera perspective, framing, lighting, shadows, background and source scene.

### Curated design — construction authority only

Controls garment family, construction, silhouette, layering, included pieces, and visible structural architecture. It is not authority for body, identity, scene, colour, fabric, material, footwear, or accessories.

### Fabric photo — material authority only

Controls colour/shade, pattern/scale, texture/weave, sheen, finish, motif/checks/stripes, and visible material appearance. It does not control identity, pose, garment construction, or scene.

---

## 8. Permanent body-preservation rule

Hard product invariant:

> **The garment must adapt to the customer. The customer must never be altered to match the garment or mannequin.**

`lib/catalog/level1-prompt.ts` explicitly preserves natural body size, build, proportions, height, visible physical characteristics, identity, pose, and scene. It prohibits slimming, enlarging, reshaping, lengthening, shortening, beautifying, replacing, or adopting mannequin/reference-person proportions.

The mannequin controls construction only. A broader, shorter, taller, slimmer, or differently proportioned customer retains that real body while the selected suit is realistically tailored around it. Do not move this rule to client copy only; keep it server-owned and tested.

Enforcement locations:

- `lib/catalog/level1-prompt.ts` (Level 1 server compiler);
- `lib/tryon/prompt.ts` (legacy permanent prompt);
- `tests/level1-try-on.test.ts` (authority/prompt assertions).

---

## 9. Approved catalogue assets

Five images were supplied manually in this order:

| Supplied file | Design ID | Visual identity |
|---|---|---|
| `/Users/omar/Downloads/A20AFC69-3823-40C1-B051-5CC14766ADAF.PNG` | `SUIT_01_CLASSIC` | Grey single-breasted two-button suit |
| `/Users/omar/Downloads/6418B6CE-3E43-4AE2-A4E0-63FF703AE423.PNG` | `SUIT_02_TUXEDO` | Black tuxedo with satin facing and bow tie |
| `/Users/omar/Downloads/E4F96F30-E042-44A6-9AE2-748DA559D3EF.PNG` | `SUIT_03_STATEMENT` | Expressive black formal suit |
| `/Users/omar/Downloads/BE28ECAC-8578-4508-8730-D9457E89FEB7.PNG` | `SUIT_04_DOUBLE_BREASTED` | Navy pinstripe double-breasted suit |
| `/Users/omar/Downloads/4CCB9556-F774-48A3-87C4-269F4811A24F.PNG` | `SUIT_05_THREE_PIECE` | Navy three-piece suit with waistcoat |

The same approved file serves as both card image and primary construction reference. No detail reference is active. Do not regenerate, restyle, replace, or substitute these files.

### Asset IDs and private paths

| Design | Card asset ID | Primary asset ID | Private path |
|---|---|---|---|
| `SUIT_01_CLASSIC` | `SUIT_01_CLASSIC_CARD_V1` | `SUIT_01_CLASSIC_PRIMARY_V1` | `nasir-bespoke/catalogue/level1/v1/SUIT_01_CLASSIC/approved.png` |
| `SUIT_02_TUXEDO` | `SUIT_02_TUXEDO_CARD_V1` | `SUIT_02_TUXEDO_PRIMARY_V1` | `nasir-bespoke/catalogue/level1/v1/SUIT_02_TUXEDO/approved.png` |
| `SUIT_03_STATEMENT` | `SUIT_03_STATEMENT_CARD_V1` | `SUIT_03_STATEMENT_PRIMARY_V1` | `nasir-bespoke/catalogue/level1/v1/SUIT_03_STATEMENT/approved.png` |
| `SUIT_04_DOUBLE_BREASTED` | `SUIT_04_DOUBLE_BREASTED_CARD_V1` | `SUIT_04_DOUBLE_BREASTED_PRIMARY_V1` | `nasir-bespoke/catalogue/level1/v1/SUIT_04_DOUBLE_BREASTED/approved.png` |
| `SUIT_05_THREE_PIECE` | `SUIT_05_THREE_PIECE_CARD_V1` | `SUIT_05_THREE_PIECE_PRIMARY_V1` | `nasir-bespoke/catalogue/level1/v1/SUIT_05_THREE_PIECE/approved.png` |

The browser receives protected application routes based on asset IDs, not these paths.

### Verified SHA-256 checksums

| Design ID | Approved checksum |
|---|---|
| `SUIT_01_CLASSIC` | `cf4e5dea515afa9dc94d7947c6edf2122bbb6d07f553a3dd5a2acd38e2f0fcbd` |
| `SUIT_02_TUXEDO` | `10fd0e1334141b8fb2a3e690844356339b5b3623f8a7e11a7e561c4590591268` |
| `SUIT_03_STATEMENT` | `73182b8de106a7002d899a946a1f75a821b1005295ed4e035354b5c8343bd351` |
| `SUIT_04_DOUBLE_BREASTED` | `6f34662fb556da3a55f3a214955d5d21e0fd4020d5172433bad0e3ee9ddb958d` |
| `SUIT_05_THREE_PIECE` | `9bc20a752be80c0095f9cdcbff7058f374564829c5c16c2c4d7b3937b2363142` |

### Double-Breasted metadata discrepancy

**The typo still exists in the current working tree.** The actual approved Blob hash is:

```text
6f34662fb556da3a55f3a214955d5d21e0fd4020d5172433bad0e3ee9ddb958d
```

The current `lib/catalog/level1-seed.ts` value is missing the final `d`:

```text
6f34662fb556da3a55f3a214955d5d21e0fd4020d5172433bad0e3ee9ddb958
```

Image/design mapping is correct and the Blob object exists; metadata integrity needs a later authorized correction. Do not silently ignore this during migration.

Prior read-only Blob inspection found exactly five private approved PNG objects. Four checksums matched local metadata. The fifth mismatch is this seed truncation, not an image mismatch.

---

## 10. Private asset architecture

`lib/catalog/level1-assets.ts` uses `NASIR_BLOB_READ_WRITE_TOKEN` server-side with `@vercel/blob`.

- Approved images are private Vercel Blob objects.
- Canonical paths derive from trusted design IDs.
- `getPrivateLevel1Asset()` resolves an active trusted asset before calling private Blob `get()`.
- The authenticated asset route streams bytes with private/no-store and `nosniff` headers.
- The catalogue projection emits `/api/catalog-assets/<assetId>`, never a Blob URL or pathname.
- `lib/try-on-handler.ts` reads the private asset into a server `File` before provider invocation.
- Generation history uses private paths under `nasir-bespoke/generations/<generationId>/...`.
- History redaction exposes content type/availability only; private pathnames remain server-side.

The server-only `storeApprovedLevel1DesignImage()` helper writes an approved file and metadata, but it performs full catalogue replacement and is not a safe production migration tool by itself.

---

## 11. OpenAI generation pipeline

### Provider and model

- SDK: official `openai` package, version 7.4.0 in the current install.
- Provider adapter: `lib/tryon/providers/openai.ts`.
- Model identifier: `gpt-image-2`.
- Operation: `client.images.edit()`.
- Quality: server-controlled `TRY_ON_QUALITY`, validated to `low`, `medium`, or `high`; default `medium`.
- Size: server-controlled `auto`.
- Output: one JPEG, compression 90.
- Background: `auto`.
- OpenAI timeout: 165 seconds.
- Retries: disabled (`maxRetries: 0`) to avoid duplicate paid work.

### Level 1 input order

The provider receives:

1. customer/person image;
2. fabric image;
3. approved primary construction reference;
4. optional approved detail reference(s), currently none for the five Suit designs.

`lib/catalog/level1-prompt.ts` builds the hidden Level 1 instruction with image-role mapping, authority separation, body preservation, the selected blueprint, styling policy, negative constraints, and photographic realism requirements.

### Browser trust boundary

The browser cannot choose an OpenAI model, quality, size, output format, provider, prompt, blueprint, storage path, reference URL, or API endpoint. The Level 1 FormData allowlist is restricted to `person`, `fabric`, `selectionMode`, `categoryId`, and `designId`; extra fields are rejected. `OPENAI_API_KEY` is read only by server-only `lib/openai.ts`.

---

## 12. Security architecture

Do not weaken these controls while extending Level 1.

### Authentication and sessions

- Authorized users are configured through `AUTH_USERS_JSON_BASE64` or `AUTH_USERS_JSON`.
- Passwords are bcrypt hashes, not plaintext.
- Sessions/cookies live in `lib/auth/session.ts` and `lib/auth/session-store.ts`.
- Production cookies use secure, HttpOnly, SameSite-strict settings in the existing implementation.
- Protected routes call `requireRequestUser()`.

### Request and input security

- Same-origin checks: `lib/request-security.ts`.
- Upload validation: `lib/validation.ts` and the handler.
- FormData field names are allowlisted.
- Level 1 IDs are resolved from server-owned data.
- User-supplied prompts, model controls, paths, and references are rejected.
- Errors are sanitized; bounded provider metadata may be logged.

### Generation abuse controls

`lib/generation-guard.ts` implements per-user locks, 210-second leases, 900-second idempotency records, replay protection, user ownership binding, bounded Redis timeouts, and fail-closed behavior when production Redis is absent/unavailable. Paid OpenAI calls are not retried.

`lib/rate-limit.ts` implements Redis-backed per-user minute/hour/day and global-day generation limits plus login throttling. Production does not silently use memory fallbacks for these controls.

### Private data controls

- Catalogue asset and history routes require authentication.
- History asset requests are validated against the generation/asset relationship.
- Blob objects are private.
- Client payloads redact private pathnames.
- No intentional public customer-photo URLs exist.

Relevant files: `lib/auth/*`, `lib/request-security.ts`, `lib/validation.ts`, `lib/rate-limit.ts`, `lib/generation-guard.ts`, `lib/generation-storage.ts`, `lib/usage-history.ts`, and the authenticated API routes.

---

## 13. Redis architecture

Redis responsibilities include sessions (when configured), rate limits, generation locks, idempotency/replay records, usage history, legacy catalogue persistence, and Level 1 catalogue persistence.

### Level 1 key

```text
nasir-tryon:catalog:level1:v1
```

### Local seed

`lib/catalog/level1-seed.ts` exports `DEFAULT_LEVEL1_CATALOGUE`, including seven category records, five active Suit designs, and approved asset metadata. Without Redis variables locally, `lib/catalog/level1-store.ts` uses an in-memory clone.

### Production behavior

With `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, `getLevel1Catalogue()` reads the key. If the value passes a shallow shape check, it is returned. If missing or shallow-invalid, the current code writes the complete default seed. `replaceLevel1Catalogue()` replaces the entire value.

This is why production synchronization remains required: a valid older Redis value can continue showing pending designs even after the code seed changes, while a missing/invalid value can trigger an uncontrolled full-seed write that may overwrite unrelated records. Production Redis has not been read or modified for this handoff.

---

## 14. Production Redis migration still required

Do not execute without explicit authorization.

The controlled migration must:

1. Read `nasir-tryon:catalog:level1:v1` before any write.
2. Store an exact secure backup and SHA-256 hash.
3. Validate version, array structure, IDs, duplicate absence, and mappings.
4. Refuse unexpected, incompatible, or concurrently changed state.
5. Patch only the ten approved card/primary asset records.
6. Preserve all unrelated categories, designs, assets, and fields.
7. Use the correct approved checksums and private paths.
8. Compare desired state before writing and report “already applied” without rewriting when equal.
9. Use optimistic/atomic semantics where supported; otherwise re-read and compare the pre-write hash immediately before a guarded write.
10. Create a separate audit marker with migration version, hashes, IDs, checksums, operator, and commit.
11. Read back and resolve all five through the application resolver.
12. Verify all five report ready and the browser projection contains only protected application routes.

### Preconditions

- Production Upstash URL/token are available securely.
- Production Blob token is configured.
- The Double-Breasted checksum typo is corrected/approved for migration.
- All five private Blob objects/checksums are independently verified.
- A secure backup and rollback operator are available.
- No unreviewed production catalogue writes are occurring.

### Rollback

Restore the exact pre-migration JSON only after checking its hash and confirming the key has not changed unexpectedly. Read back and verify the pre-migration hash. Preserve the migration audit record. Do not delete approved Blob objects.

---

## 15. Tests and validation

Latest non-paid validation used Node 22.14.0 as the preferred runtime.

```text
Full suite: 53 passed, 0 failed
Security/generation guard: 33 passed
Catalogue/Level 1: 13 passed
Bespoke engine: 4 passed
Rendered HTML: 3 passed
```

Level 1 tests cover the five exact seed IDs, sanitized projection, unknown/mismatched/pending selections, authority-separated prompt compilation, protected asset access, pending blocking before provider work, controlled references, injection rejection, and history metadata. Security tests cover auth, secure cookies, logout, same-origin rejection, upload validation, rate limits, locks, idempotency, replay, fail-closed Redis, and provider controls.

Other checks:

- `npm run typecheck` under Node 22.14.0: passed.
- `npm run lint` under Node 22.14.0: passed.
- `npm run lint` under Node 24.18.0: passed.
- `git diff --check --no-ext-diff`: passed.
- Clean `npm run build` under Node 22.14.0: passed.
- Prior clean Node 24 production build: passed.
- No real OpenAI generation was performed for these checks.

### Previous build stall

The Next.js build appeared stalled because stale local Next/TypeScript processes and offloaded `.next` files existed in the macOS Documents/FileProvider environment. After stopping stale processes and removing only `.next`, a clean Node 22 build completed. Node 24 also completed. No application defect was identified.

### Previous ESLint stall

The flat config was valid. The local dependency tree contained approximately 23,000 macOS “dataless” offloaded files. Direct reads/imports of ESLint plugins blocked in filesystem reads. `npm ci --offline --no-audit --no-fund` restored the lockfile-defined dependency tree, removed the dataless dependency condition, and ESLint passed under Node 22 and Node 24. No lint rules/configuration were loosened.

---

## 16. Production infrastructure and environment variables

Values are intentionally omitted.

### AI/storage

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Server-only OpenAI credential |
| `NASIR_BLOB_READ_WRITE_TOKEN` | Server-only private Vercel Blob access |
| `TRY_ON_PROVIDER` | Provider selector; defaults to OpenAI |
| `TRY_ON_QUALITY` | Server quality (`low`, `medium`, `high`), default medium |

### Redis

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Upstash endpoint for sessions, limits, guards, history, catalogue |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash credential |

### Authentication/session

| Variable | Purpose |
|---|---|
| `AUTH_USERS_JSON_BASE64` | Preferred encoded authorized-user records |
| `AUTH_USERS_JSON` | Alternate raw JSON authorized-user records |
| `AUTH_SESSION_SECRET` | Session signing/encryption secret |
| `AUTH_SESSION_TTL_HOURS` | Session lifetime |
| `AUTH_SESSION_PERSISTENT` | Session persistence behavior |
| `AUTH_ALLOWED_ORIGINS` | Allowed origins |
| `AUTH_LOGIN_RATE_LIMIT_PER_15_MINUTES` | Login throttling limit |

### Site/dev/history/limits

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL |
| `VERCEL_URL` | Vercel deployment URL fallback |
| `DEV_ALLOWED_ORIGIN` | Development LAN origin allowance |
| `TRYON_RATE_LIMIT_PER_MINUTE` | Per-user minute limit |
| `TRYON_RATE_LIMIT_PER_HOUR` | Per-user hour limit |
| `TRYON_RATE_LIMIT_PER_DAY` | Per-user day limit |
| `TRYON_GLOBAL_RATE_LIMIT_PER_DAY` | Global day limit |
| `TRYON_HISTORY_MAX_EVENTS` | Retained history cap |

Never print values of these variables.

---

## 17. What has not happened yet

- The Level 1 implementation has not been committed as a final Level 1 commit.
- No Level 1 push has been performed from this working tree.
- No Level 1 deployment has been performed from this working tree.
- Production Redis has not been modified or migrated.
- No real Level 1 OpenAI generation has been performed during this handoff/readiness work.
- The Double-Breasted checksum metadata typo remains in the seed.
- The six non-Suit catalogue categories have no active designs or generation blueprints.
- No official detail reference images are active; card and primary construction use the same approved image.
- No safe compare-and-set Redis migration script exists yet.
- Level 2 remains preserved source functionality, not a separately deployed route/product boundary.

---

## 18. Recommended next steps

1. Open this same local working directory.
2. Perform a read-only takeover audit against this document.
3. Review `git status` and preserve every uncommitted Level 1 file.
4. Correct the Double-Breasted checksum typo only after confirming the approved hash.
5. Re-run the full test suite.
6. Re-run ESLint.
7. Re-run TypeScript.
8. Run `git diff --check`.
9. Run a clean Node 22 production build.
10. Review the complete Level 1 diff, especially handler security boundaries and seed metadata.
11. Create a deliberate Level 1 commit.
12. Push to the intended branch/repository.
13. Create a Vercel preview deployment.
14. Verify the Level 1 UI and all five cards.
15. Verify authenticated private catalogue asset routes.
16. Prepare and review the controlled Redis migration.
17. Execute Redis migration only after explicit authorization.
18. Verify production catalogue read-back and five ready states.
19. Promote/deploy production only after migration verification.
20. Smoke-test authentication, cards, protected assets, and history.
21. Perform one real OpenAI Level 1 generation only after explicit authorization.
22. Review body preservation, garment construction, and fabric authority honestly.
23. Only after Suit stability, plan the remaining six categories.

---

## 19. Takeover safety rules

The next agent must not:

- reset the working tree;
- run `git clean`;
- overwrite or discard uncommitted Level 1 work;
- clone an older GitHub revision over this directory;
- modify, regenerate, or substitute approved catalogue images;
- expose private Blob URLs or paths to the browser;
- expose hidden prompt fragments or blueprint internals;
- allow browser-controlled model, prompt, reference, or OpenAI parameters;
- weaken authentication, same-origin checks, upload validation, rate limits, locks, idempotency, replay protection, or fail-closed Redis behavior;
- casually change the `gpt-image-2` model or provider settings;
- migrate production Redis without explicit authorization;
- deploy without explicit authorization;
- run paid OpenAI generation without explicit authorization.

Use additive, reviewable changes. Preserve legacy history and security tests.

---

## 20. First task for the next agent

Begin with a **READ-ONLY TAKEOVER AUDIT**.

Compare this document against `git status`, branch/commit, every Level 1 seed/store/prompt/asset file, the current `TryOnApp` and handler, environment variable names (without printing values), latest checks, and any safely inspectable production/Blob/Redis state.

Report discrepancies before modifying anything. The repository wins when it conflicts with this document. Do not “clean up” a discrepancy by deleting local work.

---

## Quick code-location reference

| Functionality | Current location |
|---|---|
| Main workflow and Level 1 root UI | `components/TryOnApp.tsx` |
| Level 1 design cards | `components/Level1Catalogue.tsx` |
| Level 1 types | `lib/catalog/level1-types.ts` |
| Five Suit seed records/assets | `lib/catalog/level1-seed.ts` |
| Level 1 store/resolver | `lib/catalog/level1-store.ts` |
| Private catalogue Blob helper | `lib/catalog/level1-assets.ts` |
| Level 1 prompt compiler | `lib/catalog/level1-prompt.ts` |
| Catalogue projection route | `app/api/level1-catalog/route.ts` |
| Protected catalogue asset route | `app/api/catalog-assets/[assetId]/route.ts` |
| Generation lifecycle | `lib/try-on-handler.ts`, `app/api/try-on/route.ts` |
| OpenAI client | `lib/openai.ts` |
| GPT Image 2 adapter | `lib/tryon/providers/openai.ts` |
| Legacy prompt | `lib/tryon/prompt.ts` |
| Upload validation | `lib/validation.ts` |
| Same-origin checks | `lib/request-security.ts` |
| Authentication/session | `lib/auth/config.ts`, `lib/auth/session.ts`, `lib/auth/session-store.ts` |
| Redis rate limits | `lib/rate-limit.ts` |
| Locks/idempotency/replay | `lib/generation-guard.ts` |
| Private generation storage | `lib/generation-storage.ts` |
| Usage/history | `lib/usage-history.ts`, `components/UsageHistory.tsx`, `app/api/history/route.ts` |
| Level 1 tests | `tests/level1-catalog.test.ts`, `tests/level1-try-on.test.ts` |
| Security tests | `tests/security.test.ts`, `tests/generation-guard.test.ts` |
| Advanced Suit engine | `lib/bespoke/engine.ts`, `lib/bespoke/suit-profile.ts`, `components/BespokeConfigurator.tsx` |

---

## Handoff conclusion

The local implementation is ready for deliberate review/commit after the checksum metadata discrepancy is addressed. Local non-paid checks are clean. The two material production blockers are:

1. correct/verify the Double-Breasted checksum metadata;
2. perform the separately authorized, backup-first production Redis catalogue synchronization.

No part of this document authorizes either action.
