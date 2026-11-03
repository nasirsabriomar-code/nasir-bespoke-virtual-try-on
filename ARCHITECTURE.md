# Nasir Bespoke — Technical Architecture

## Application shape

This is a Next.js App Router application. Server-rendered route protection is used for the private homepage; client components own the interactive upload and configuration workflow.

    Showroom browser
          │ HTTPS, same-origin requests
          ▼
    Next.js App Router
          ├── Server-rendered authentication gate
          ├── Client upload/configuration UI
          └── Route handlers
                ├── Auth and session validation
                ├── Catalog/history reads
                └── Try-on generation
                      ├── Upstash rate limits
                      ├── streamed body / image validation and upload ownership
                      ├── catalog/configuration resolution
                      ├── deterministic prompt compiler
                      ├── OpenAI GPT Image 2.5 Sunburst
                      ├── private Cloudflare R2 assets
                      ├── Neon upload ledger and permanent history
                      └── Upstash bounded history and account-scoped reviews

## Directory map

    app/
      api/auth/login/route.ts
      api/auth/logout/route.ts
      api/catalog/route.ts
      api/history/route.ts
      api/history/[id]/asset/[asset]/route.ts
      api/try-on/route.ts
      login/page.tsx
      page.tsx
      layout.tsx
      globals.css
      manifest.ts
      robots.ts

    components/
      TryOnApp.tsx
      ImageUpload.tsx
      BespokeConfigurator.tsx
      StylePicker.tsx
      VisualOptionCard.tsx
      GenerationState.tsx
      TryOnResult.tsx
      UsageHistory.tsx
      LoginForm.tsx
      LogoutButton.tsx

    lib/
      auth/
      catalog/
      bespoke/
      tryon/
      try-on-handler.ts
      openai.ts
      validation.ts
      request-security.ts
      rate-limit.ts
      generation-storage.ts
      usage-history.ts

    public/catalog/
    scripts/hash-password.mjs
    tests/

## Authentication and sessions

Authorized users are supplied through AUTH_USERS_JSON_BASE64 or AUTH_USERS_JSON. Passwords are represented by bcrypt hashes. The server verifies credentials, signs a JWT with HS256, and stores a hashed session identifier in Upstash Redis when configured.

Production cookies use the __Host- prefix, HttpOnly, Secure, SameSite=Strict, and Path=/. Session persistence is opt-in through AUTH_SESSION_PERSISTENT; browser-session cookies are the default.

Protected pages and protected APIs independently verify the session. Logout revokes the active session record and clears cookies.

## Request security

State-changing requests are checked with:

- same-origin Origin validation
- Fetch Metadata (Sec-Fetch-Site) checks
- strict same-site cookies
- allowlisted form fields

The server does not trust the browser to choose a provider, model, prompt, or arbitrary reference path.

## Generation pipeline

POST /api/try-on follows this order:

1. Validate same-origin request.
2. Authenticate the staff session.
3. Resolve the original generation key before starting duplicate work.
4. Enforce actual streamed body limits. JSON high-resolution requests reference owned, validated, unexpired upload slots; only the server can select the trusted internal handoff.
5. Validate images, controlled fabric/background settings, selected mode and catalogue IDs.
6. Resolve catalogue/configuration compatibility and generation readiness.
7. Acquire the generation guard and apply per-user/global limits.
8. Read only server-resolved private catalogue references.
9. Compose the hidden men's visualization instruction and prepare image roles, crops and optional mask.
10. Call the provider abstraction with paid retries disabled.
11. Save the private result first, then input/reference copies where possible.
12. Record permanent history, bounded metadata and idempotency outcome.
13. Return authenticated permanent result URLs for the full-resolution workflow (legacy multipart callers receive image bytes).

## AI provider abstraction

The frontend is not coupled to OpenAI. lib/tryon/index.ts selects the configured provider, while lib/tryon/providers/openai.ts implements the current provider.

The current provider calls the official SDK image edit operation with:

- model: gpt-image-2.5-sunburst
- quality: fixed medium in the current provider
- size: aspect-preserving custom dimensions within supported edge/pixel limits, with a size-rejection fallback
- output: one opaque PNG
- provider timeout: 165 seconds; route maxDuration: 300 seconds; browser request deadline: 285 seconds
- retries: disabled in the current client

Image order is explicit:

    Person first, then optional outfit.
    Full/Split: construction references, then active fabric roles.
    Legacy catalogue/outfit: fabrics, then construction references.
    Opt-in fabric-detail images append after all existing base inputs.

The server builds image-index guidance from the actual parts array. Full swatches supply pattern context; appended detail crops supply weave/edge evidence. Optional centimetre repeats are guidance, not physical-fit guarantees. Prompt and input-count bounds are enforced before the SDK call. An opt-in mask is always PNG, matching the first person's normalized PNG dimensions, including compatibility fallbacks. Composite mode blends generated pixels inside the approved rectangle and retains the normalized original outside it. The original may be resampled to the output canvas.

## Prompt architecture

lib/tryon/prompt.ts contains the permanent men's-only role and realism instruction. lib/bespoke/engine.ts deterministically appends the resolved Outfit Specification and selected priority-aware prompt fragments.

The prompt compiler distinguishes:

- person identity/body/pose authority
- outfit construction/style authority
- fabric colour/pattern/texture authority
- catalog/accessory reference roles
- visible configuration options
- negative constraints

No second language model is used to write prompts.

## Catalog and configuration

Catalog data is seeded in lib/catalog/seed.ts and typed in lib/catalog/types.ts. The current application uses controlled catalog records rather than arbitrary client-provided names or URLs.

Suit configuration is defined in lib/bespoke/suit-profile.ts. The resolver in lib/bespoke/engine.ts applies required groups, sequential visibility, requires rules, conflicts, default options, visual priority, and target-view relevance.

The resolved configuration becomes the source of truth for both the prompt and history metadata.

## Storage and history

Upstash Redis stores authoritative session state, rate limits, bounded recent history and account-isolated feedback. Cloudflare R2 stores private catalogue references, chunk uploads, customer inputs and PNG results; authenticated routes proxy assets. Neon PostgreSQL stores upload ownership/status/checksums and permanent generation records. These paths do not use Vercel Blob.

Permanent history is paginated; bounded Redis history is a fallback. Abandoned uploads have a cleanup path. Completed generations default to 30-day retention. Owners/admins can delete from History; durable tombstones hide queued work and the daily cleanup retries asset, history, review and replay-cache removal. See SECURITY.md.

## Deployment

Vercel builds with:

    npm run build:next

The production deployment must contain server-only values for OpenAI, authentication, Upstash, R2 and Neon. Do not expose them through NEXT_PUBLIC_* variables.

## Staff review metadata and browser continuity

`GET/PUT /api/history/[id]/review` authenticates the caller, verifies the generation exists under the owner/admin history policy and stores only the caller's review. PUT requires the origin check and a 4 KB bounded body. Reviews/favourites use Redis metadata keys scoped to a hashed username and generation ID; local development uses process memory. A feedback-store failure does not hide generation history. No SQL migration is introduced for reviews.

Pending generation keys and bounded look summaries survive a tab refresh in account-scoped session storage. No photo bytes or session tokens are persisted for recovery. Logout clears this tracking. Upload checkpoints contain only a content fingerprint, slot ID, expiry and next acknowledged chunk. Client retries reuse the same slot/index; server completion cannot revive consumed slots.

Catalogue readiness uses a 30-second, bounded process-local cache keyed by storage realm and path. Writes invalidate matching entries in that process; other processes expire within the TTL. Errors are not cached as absent assets. Generation still reads actual references and fails closed when they cannot be loaded.
