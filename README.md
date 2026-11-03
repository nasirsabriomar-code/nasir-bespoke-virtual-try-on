# Nasir Bespoke AI Virtual Try-On

Private AI visualization software for luxury men's bespoke tailoring.

Authorized Nasir Bespoke staff can upload a male customer/model photo, upload a physical fabric photo, optionally upload an outfit photo or choose a visual men's garment configuration, and generate a try-on visualization with OpenAI's GPT Image 2.5 Sunburst.

## Product principle

    SEE → SELECT → CUSTOMIZE → REVIEW → GENERATE

The employee never writes an AI prompt. The server resolves catalog selections and composes the hidden instruction.

## Technology

- Next.js 16.3 App Router
- React 19.2
- TypeScript 5.9
- Tailwind CSS 4
- Node.js 22.13+
- OpenAI Node SDK 7.4
- GPT Image 2.5 Sunburst (gpt-image-2.5-sunburst), fixed medium effort and private PNG masters
- Upstash Redis and Ratelimit
- Private Cloudflare R2 image storage and Neon permanent history
- Vercel deployment

## Repository orientation

Read these first:

1. PROJECT_CONTEXT.md
2. ARCHITECTURE.md
3. SECURITY.md
4. ROADMAP.md
5. AI_AGENT_GUIDE.md

Important source areas:

- app/ — routes and route handlers
- components/ — interactive UI
- lib/auth/ — authentication and sessions
- lib/catalog/ — men's catalog and compatibility
- lib/bespoke/ — suit configuration and compiler
- lib/tryon/ — provider abstraction and hidden prompt
- lib/try-on-handler.ts — generation request lifecycle
- lib/validation.ts — upload validation
- lib/generation-storage.ts — private R2 generation assets
- lib/usage-history.ts — history adapter
- tests/ — security, catalog, compiler, and rendered HTML tests

## Requirements

- Node.js 22.13 or newer
- npm
- An OpenAI API project with GPT Image access
- Upstash Redis for production rate limits and metadata
- Private R2 storage and a Neon database for the full-resolution generation/history workflow

## Local setup

    npm ci
    cp .env.example .env.local

Generate a staff password hash interactively:

    npm run auth:create-user -- showroom "Showroom Staff"

Generate a session secret:

    openssl rand -base64 48

Place only the generated placeholder values in .env.local. Never commit .env.local or paste real secrets into an issue, pull request, screenshot, or chat.

Start the development server:

    npm run dev

Open http://localhost:3000.

The login UI works without an OpenAI key. Generation safely reports a configuration error until the key is present. Production intentionally fails closed if persistent Redis rate limiting is not configured.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| OPENAI_API_KEY | Production | Server-only OpenAI project key |
| AUTH_SESSION_SECRET | Yes | At least 32 random bytes for signed sessions |
| AUTH_USERS_JSON_BASE64 | Yes | Base64-encoded username/display-name/bcrypt allowlist |
| UPSTASH_REDIS_REST_URL | Production | Redis endpoint |
| UPSTASH_REDIS_REST_TOKEN | Production | Redis credential |
| DATABASE_URL | Full-resolution workflow | Neon PostgreSQL upload ledger and permanent history |
| R2_ACCOUNT_ID | Full-resolution workflow | Cloudflare account identifier for private storage |
| R2_BUCKET_NAME | Full-resolution workflow | Private bucket containing catalogue and generation assets |
| R2_ACCESS_KEY_ID | Full-resolution workflow | Server-only R2 access key identifier |
| R2_SECRET_ACCESS_KEY | Full-resolution workflow | Server-only R2 signing credential |
| CRON_SECRET | Cleanup | Authorizes abandoned-upload cleanup |
| AUTH_SESSION_TTL_HOURS | Optional | Session TTL; default 12, maximum 168 |
| AUTH_SESSION_PERSISTENT | Optional | Persistent cookie opt-in; default false |
| AUTH_LOGIN_RATE_LIMIT_PER_15_MINUTES | Optional | Login attempt limit; default 10 |
| DEV_ALLOWED_ORIGIN | Local network | LAN origin allowed by Next.js development tooling |
| AUTH_ALLOWED_ORIGINS | Optional | Additional trusted HTTPS origins |
| TRY_ON_PROVIDER | Optional | Provider selector; currently openai |
| TRY_ON_QUALITY | Legacy documentation | Runtime provider currently fixes quality to medium |
| TRYON_RATE_LIMIT_PER_MINUTE | Optional | Per-user generation limit; default 2 |
| TRYON_RATE_LIMIT_PER_HOUR | Optional | Per-user generation limit; default 10 |
| TRYON_RATE_LIMIT_PER_DAY | Optional | Per-user generation limit; default 30 |
| TRYON_GLOBAL_RATE_LIMIT_PER_DAY | Optional | Application-wide daily limit; default 50 |
| TRYON_HISTORY_MAX_EVENTS | Optional | Metadata history bound; default 1000 |
| NEXT_PUBLIC_SITE_URL | Optional | Canonical metadata URL only; never place secrets here |

See .env.example for placeholders and comments.

## Development commands

    npm run dev
    npm run lint
    npm run typecheck
    npm test
    npm run build
    npm run start

## Deployment

The existing production application is deployed to Vercel. Import this repository as a Next.js project, preserve the existing build command, and configure secrets in Vercel Environment Variables as Sensitive server-only values.

Build command:

    npm run build:next

Required production integrations:

- OpenAI API project/key
- Upstash Redis
- Private Cloudflare R2 storage
- Neon PostgreSQL for upload ownership/consumption and permanent history

After changing environment variables, create a new deployment. Do not expose any secret as a NEXT_PUBLIC_* variable.

The repository includes a GitHub Actions workflow at .github/workflows/ci.yml. It runs install, lint, typecheck, tests, production build and local HTTP security checks sequentially. It does not call OpenAI.

## Security and privacy

Read SECURITY.md before changing authentication, upload handling, history, storage, rate limits, or OpenAI integration. Customer images may be sensitive. The current application has strong server-side boundaries, but shared authenticated history access and image-retention cleanup remain known future improvements.

## Contribution

See CONTRIBUTING.md. This project is internal and men's-only by design. Do not add generic fashion taxonomy, women's categories, arbitrary prompts, or unaudited public storage.


## Generation quality and evaluation

The current runtime selects `gpt-image-2.5-sunburst` at fixed medium effort, producing one opaque PNG. It preserves the customer's aspect ratio within supported pixel and edge limits; high-resolution requests have a lower-resolution fallback for provider size rejections. Image-format normalization is a separate compatibility fallback. No ambiguous paid-call retry is enabled.

History retains sanitized provider usage and generation provenance when available. Staff feedback and favourites are private to each signed-in account, persisted as small metadata records in Redis in production; local development uses memory. Review records contain controlled categories and no customer images or free-form prompts. They have no automatic expiry, like permanent history; a future generation-deletion workflow must also remove associated review keys. Image retention is unchanged.

Use `npm run quality:prepare` to generate ten deterministic technical swatch cases and twenty reference PNGs locally: different repeat sizes, three wide/close pairs of the same declared cloth, and a plain control. The manifest includes checksums and renderer versions; it authorizes no pilot and plans no calls automatically. These `.cache/quality-baseline` files are not a visual-quality benchmark and make no paid calls. `npm run quality:summary -- /absolute/path/to/scored-results.json` summarizes observed scores, timings and supplied billing costs offline. Missing cost remains unknown. See [evaluation protocol](research/QUALITY_EVALUATION_PROTOCOL.md) for scoring and acceptance gates. Paid image calls are currently disallowed by the owner.

Full-swatch/detail guidance and measured repeats are opt-in controls; the established centre crop remains the default. Background control likewise defaults to prompt-only. Mask/composite options require an explicit garment rectangle and boundary inspection; compositing preserves the normalized original outside that rectangle, rather than promising unchanged native-resolution source bytes. Updated construction instructions distinguish garment proportions from fabric repeat scale and allow legitimate seam/grain changes. Visual gains from these changes remain unproven pending matched outputs and staff/tailor review.

Instruction recipe `atelier-v4-scoped-authority` distinguishes single/double-breasted button layouts, base cloth from selected facings/trim/embroidery, and intrinsic cloth repeat from photo zoom. Shared image ordering drives prompt roles and provider arrays; the final request includes a manifest of its prepared images and rejects invalid image indices before calling the SDK. Bespoke rules carry actual priority labels and selected constraints are preserved. See [instruction implementation](research/INSTRUCTION_ENGINE_PROGRESS.md) for coverage and verification.

`npm run test:improvements:browser` exercises the staff workflow with real loopback login and synthetic service responses. It requires installed Playwright and Chrome. If Playwright is installed elsewhere, set the test-only `BESPOKE_PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. This does not configure production. The checker refuses environment files, starts/stops its own local server, blocks external browser requests and passes no image-service credentials. Run it sequentially with builds and HTTP checks. Screenshots/results stay under ignored `.cache/improvement-browser`.
