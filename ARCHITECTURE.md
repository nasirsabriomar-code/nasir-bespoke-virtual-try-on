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
                      ├── multipart/image validation
                      ├── catalog/configuration resolution
                      ├── deterministic prompt compiler
                      ├── OpenAI GPT Image 2
                      ├── optional private Vercel Blob assets
                      └── Upstash history metadata

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
3. Apply per-user and global generation limits.
4. Require multipart/form-data.
5. Validate person, fabric, and optional outfit uploads.
6. Validate the selected mode and catalog IDs.
7. Resolve catalog records from server-controlled seed data.
8. Resolve sequential bespoke configuration and compatibility rules.
9. Read only server-controlled reference images from public/catalog.
10. Compose the hidden men's visualization instruction.
11. Call the provider abstraction.
12. Store optional private assets.
13. Record history metadata.
14. Return the generated JPEG.

## AI provider abstraction

The frontend is not coupled to OpenAI. lib/tryon/index.ts selects the configured provider, while lib/tryon/providers/openai.ts implements the current provider.

The current provider calls the official SDK image edit operation with:

- model: gpt-image-2
- quality: server-controlled low, medium, or high, default medium
- size: auto
- output: one JPEG, compression 90
- timeout: 165 seconds at the client/request boundary
- retries: disabled in the current client

Image order is explicit:

    Catalog mode:  person, fabric, selected references...
    Outfit mode:   person, outfit, fabric, selected references...

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

Upstash Redis stores session state, rate-limit state, and bounded history metadata. Vercel Blob is optional. If NASIR_BLOB_READ_WRITE_TOKEN is configured, person, outfit, fabric, selected references, and result images are uploaded as private Blob objects and served through the authenticated asset route.

History currently keeps the latest bounded metadata records and an all-time counter. Image deletion and retention are not yet coupled to history expiry; see SECURITY.md.

## Deployment

Vercel builds with:

    npm run build:next

The production deployment must contain server-only values for OpenAI, authentication, Upstash, and optional Blob storage. Do not expose them through NEXT_PUBLIC_* variables.
