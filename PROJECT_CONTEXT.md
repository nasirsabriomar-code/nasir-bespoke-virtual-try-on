# Nasir Bespoke AI Virtual Try-On — Project Context

## What this project is

Nasir Bespoke AI Virtual Try-On is an internal luxury menswear visualization tool. Authorized showroom staff can photograph a male customer/model, photograph a physical fabric, optionally photograph an outfit, choose a men's garment blueprint and accessories, and request a photorealistic visualization.

The product is not a consumer social app or a general-purpose AI editor. The core experience is:

    Person + fabric + optional outfit or men's garment configuration
                             ↓
                     Server-side compiler
                             ↓
                  GPT Image 2.5 Sunburst
                             ↓
                     Try-on visualization

The app is designed for showroom computers, iPads, and phones. It is deployed as a private Vercel application and requires staff authentication.

## Current capabilities

- Private username/password staff authentication.
- Person/model image upload with device picker, camera capture support, drag-and-drop, preview, replacement, and removal.
- Fabric image upload with the same workflow.
- Optional outfit-photo mode. The outfit photo supplies garment construction and style; the fabric photo supplies material appearance.
- Men's garment-library mode with visual blueprints.
- Men's-only catalog including suits, coats/blazers, shirts, Nehru jackets, waistcoats, sherwanis, Indo-Western looks, kurta/pajama, trousers, shoes, and turbans.
- Explicit No Change and Keep Existing choices where appropriate.
- Sequential, data-driven suit configuration with dependencies, conflicts, visual references, and prompt fragments.
- Deterministic server-side prompt compilation. Employees never write prompts and the browser cannot submit arbitrary prompts or model parameters.
- GPT Image 2.5 Sunburst image editing at fixed medium quality through the official OpenAI Node SDK, returning private PNG masters.
- Generation loading states, result comparison, download, Try Again, and Start Over.
- Usage/history metadata in Upstash Redis.
- Private Cloudflare R2 customer-image/result storage with a Neon upload ledger and permanent history.
- Account-scoped pending-generation recovery, resumable chunk uploads, staff feedback/favourites and fabric/result inspection.
- Opt-in full-swatch/detail repeat guidance and background mask/compositing prototypes. Visual improvements await output evaluation; established reference/background defaults remain available.
- Responsive Midnight Atelier user interface for desktop, iPad, and iPhone layouts.

## Current boundaries

The application is a visualization tool, not a measurement, sizing, ordering, CRM, inventory, payment, or customer-account system. AI output can vary and must not be described as a guaranteed physical fit.

The current history model is shared among authenticated staff. Fine-grained user/showroom permissions, MFA, password reset, image-retention automation, and advanced insider-threat controls remain future work.

## Technology baseline

- Next.js 16.3 App Router
- React 19.2
- TypeScript 5.9
- Tailwind CSS 4
- Node.js 22.13 or newer
- OpenAI Node SDK 7.4
- GPT Image 2.5 Sunburst (gpt-image-2.5-sunburst)
- Upstash Redis and Ratelimit
- Cloudflare R2 for private images; Neon PostgreSQL for permanent history/upload state
- Vercel deployment

## Product roadmap

### Phase 1 — Simple private AI try-on

Completed foundation: authenticated person/fabric uploads, optional outfit input, visual men's catalogue, image generation, history and responsive showroom workflow. See research/IMPROVEMENT_BATCHES.md for the ten-batch improvement scope and its remaining acceptance gates.

### Phase 2 — Expanded garment intelligence

Deeply configure more garment families beyond the current suit-first system. Add official Nasir Bespoke reference photography, stronger compatibility rules, per-user history authorization, retention controls, MFA, and operational audit tools.

### Phase 3 — 2D preview engine

Add a non-generative preview workspace for controlled front, back, three-quarter, and detail views while keeping GPT Image 2 as a visualization provider.

### Phase 4 — 3D digital tailoring engine

Potential future work includes measurement-aware garment construction, body models, and interactive 3D tailoring. This is not part of the current application and must not be assumed by future contributors.

## How to orient yourself

Read these files before changing code:

1. PROJECT_CONTEXT.md
2. ARCHITECTURE.md
3. SECURITY.md
4. ROADMAP.md
5. AI_AGENT_GUIDE.md

The older PROJECT_CONTEXT_HANDOFF.md is retained as a detailed historical handoff and audit record. When it conflicts with source code, current source code wins.
