# Nasir Bespoke AI Virtual Try-On

Private AI visualization software for luxury men's bespoke tailoring.

Authorized Nasir Bespoke staff can upload a male customer/model photo, upload a physical fabric photo, optionally upload an outfit photo or choose a visual men's garment configuration, and generate a try-on visualization with OpenAI's GPT Image 2.

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
- GPT Image 2 (gpt-image-2)
- Upstash Redis and Ratelimit
- Optional private Vercel Blob storage
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
- lib/generation-storage.ts — private Blob adapter
- lib/usage-history.ts — history adapter
- tests/ — security, catalog, compiler, and rendered HTML tests

## Requirements

- Node.js 22.13 or newer
- npm
- An OpenAI API project with GPT Image access
- Upstash Redis for production rate limits and metadata
- Optional private Vercel Blob store for image History

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
| NASIR_BLOB_READ_WRITE_TOKEN | Optional | Private Vercel Blob token for persistent images |
| AUTH_SESSION_TTL_HOURS | Optional | Session TTL; default 12, maximum 168 |
| AUTH_SESSION_PERSISTENT | Optional | Persistent cookie opt-in; default false |
| AUTH_LOGIN_RATE_LIMIT_PER_15_MINUTES | Optional | Login attempt limit; default 10 |
| DEV_ALLOWED_ORIGIN | Local network | LAN origin allowed by Next.js development tooling |
| AUTH_ALLOWED_ORIGINS | Optional | Additional trusted HTTPS origins |
| TRY_ON_PROVIDER | Optional | Provider selector; currently openai |
| TRY_ON_QUALITY | Optional | Server-controlled low, medium, or high |
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
- Optional private Vercel Blob store

After changing environment variables, create a new deployment. Do not expose any secret as a NEXT_PUBLIC_* variable.

The repository includes a GitHub Actions workflow at .github/workflows/ci.yml. It runs install, lint, typecheck, tests, and production build. It does not call OpenAI.

## Security and privacy

Read SECURITY.md before changing authentication, upload handling, history, storage, rate limits, or OpenAI integration. Customer images may be sensitive. The current application has strong server-side boundaries, but shared authenticated history access and image-retention cleanup remain known future improvements.

## Contribution

See CONTRIBUTING.md. This project is internal and men's-only by design. Do not add generic fashion taxonomy, women's categories, arbitrary prompts, or unaudited public storage.

