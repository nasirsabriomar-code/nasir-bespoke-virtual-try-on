# PROJECT CONTEXT HANDOFF

Read-only audit completed. No code, deployment, database, environment variable, package, or production changes were made. No paid image generation was triggered.

Evidence labels:

- `[CODE VERIFIED]` — directly confirmed in the repository
- `[CONFIG VERIFIED]` — confirmed from configuration files
- `[DEPLOYMENT VERIFIED]` — confirmed from previous deployment/runtime verification
- `[CONVERSATION DECISION]` — explicitly agreed during the Work conversation
- `[INFERRED]` — reasoned from implementation
- `[UNKNOWN]` — not verifiable from the current repository/context

---

## 1. Executive project summary

**Project name:** Nasir Bespoke Virtual Try-On  
`[CODE VERIFIED]`

**Purpose:** An internal men’s bespoke visualization tool. Staff upload a male customer/model photo, fabric photo, and optionally an outfit photo or visual garment selections. The server sends the images and hidden instructions to OpenAI’s GPT Image 2 model and returns a generated visualization.

**Designed for:** Nasir Bespoke showroom employees, tailors, salespeople, and business staff.  
`[CONVERSATION DECISION]`

**Public or internal:** Internal/private staff application protected by username/password authentication. It is not intended as a public consumer app.  
`[CODE VERIFIED]`

**Current stage:** Working V1/V1.5 prototype with:

- authentication
- person, fabric, and optional outfit uploads
- men’s visual garment library
- deep sequential suit configurator
- accessories
- server-side prompt composition
- GPT Image 2 integration
- usage/history logging
- private image storage when configured
- responsive desktop/iPad/iPhone layout

`[CODE VERIFIED]`

**Production URL:**  
[https://nasir-bespoke-virtual-try-on.vercel.app](https://nasir-bespoke-virtual-try-on.vercel.app)  
`[DEPLOYMENT VERIFIED — prior conversation]`

**Hosting:** Vercel project `nasir-bespoke-virtual-try-on`, under the Nasir Bespoke Vercel team.  
`[CONFIG VERIFIED]`

**Primary devices:**

- desktop Mac/Windows browsers
- iPad Safari
- iPhone Safari
- Android browsers are structurally supported but less specifically verified

`[CODE VERIFIED]`

**Current user workflow:**

```text
Open application
    ↓
Authenticate
    ↓
Upload customer/model photo
    ↓
Optionally upload outfit photo
    ↓
Upload fabric photo
    ↓
Choose either:
  - uploaded outfit mode
  - garment library mode
    ↓
Select/configure men’s garments and accessories
    ↓
Generate Try-On
    ↓
Server validates and composes hidden instruction
    ↓
GPT Image 2
    ↓
Generated image
    ↓
Download / Try Again / Start Over / History
```

---

## 2. Product vision already established

### Implemented now

- Men’s-only bespoke visualization tool. `[CODE VERIFIED]`
- Internal staff authentication. `[CODE VERIFIED]`
- Customer/model photo upload. `[CODE VERIFIED]`
- Fabric photo upload. `[CODE VERIFIED]`
- Optional uploaded outfit photo. `[CODE VERIFIED]`
- Two generation modes:
  - **Use Garment Library**
  - **Use Uploaded Outfit**
- Visual men’s garment cards. `[CODE VERIFIED]`
- “No Change” upper and lower garment options. `[CODE VERIFIED]`
- Suit composition choices. `[CODE VERIFIED]`
- Sequential suit customization engine. `[CODE VERIFIED]`
- Conditional compatibility rules. `[CODE VERIFIED]`
- Turban and shoe selection. `[CODE VERIFIED]`
- Hidden server-side prompt composition. `[CODE VERIFIED]`
- GPT Image 2 server integration. `[CODE VERIFIED]`
- History metadata logging. `[CODE VERIFIED]`
- Optional private Vercel Blob image storage. `[CODE VERIFIED]`
- Responsive mobile/tablet layout. `[CODE VERIFIED]`
- Login/logout flow. `[CODE VERIFIED]`
- Download, Try Again, Start Over, Original/Try-On comparison. `[CODE VERIFIED]`

### Agreed but not fully implemented

- Deep customization for every garment family. Suit has the deepest implementation; other garment families remain simpler. `[CONVERSATION DECISION]`
- Permanent official Nasir Bespoke reference photography replacing prototype internet references. `[CONVERSATION DECISION]`
- More refined fabric fidelity and garment-only editing. `[CONVERSATION DECISION]`
- More granular history filtering and administrative reporting. `[CONVERSATION DECISION]`
- More rigorous per-user history authorization. `[INFERRED — current implementation exposes global authenticated history]`
- Stronger retention/deletion controls for stored customer images. `[CONVERSATION DECISION]`

### Discussed/future work

- 30–40+ configurable tailoring attributes for each garment family.
- Deep configuration for Sherwani, Nehru Jacket, Kurta Pajama, Indo-Western, shirts, waistcoats, and accessories.
- Multi-view generation:
  - front
  - back
  - three-quarter
  - detail
- Automatic requested-versus-generated-image verification.
- Correction loops.
- Official Nasir catalog integration.
- Draft/autosave recovery.
- Admin history dashboards.
- Better retention/deletion management.
- More robust image privacy controls.
- Customer accounts, CRM, measurements, inventory, orders, payments, and subscriptions were explicitly deferred.

`[CONVERSATION DECISION]`

---

## 3. Complete current user experience

### Opening

The user opens:

`https://nasir-bespoke-virtual-try-on.vercel.app`

If no valid session cookie exists, the application redirects to `/login`.  
`[CODE VERIFIED]`

If a valid session cookie exists, the server redirects directly to the application. This is why a browser or iCloud Keychain may appear to “log in automatically”: the existing authenticated session is still valid, and the browser may also autofill credentials. The application itself does not randomly authorize users.  
`[CODE VERIFIED]`

### Authentication

The login screen shows:

- NASIR BESPOKE
- Virtual Try-On
- Private staff access
- Username
- Password
- Sign In

Login submits to:

`POST /api/auth/login`

The server:

1. validates request origin
2. validates JSON and request size
3. rate-limits login attempts
4. verifies the username/password
5. creates a signed session token
6. stores the session server-side
7. sets an HttpOnly cookie
8. returns a safe response

`[CODE VERIFIED]`

### Main application

The main page shows:

- Nasir Bespoke branding
- staff identity
- logout control
- history control
- three image inputs:
  - Your Photo
  - Outfit Photo
  - Fabric

### Your Photo

Supports:

- Choose From Device
- Use Camera
- drag and drop where supported
- image preview
- Change
- Camera
- Remove
- keyboard-accessible activation
- JPEG, PNG, WebP, HEIC, and HEIF client input

The customer/model image is treated as the identity and body reference.

### Outfit Photo

The outfit photo is optional.

If supplied, the app switches to uploaded-outfit mode and instructs the server to use the outfit image for:

- garment style
- silhouette
- construction
- cut
- collar/lapel structure
- visible pockets
- seams
- closures
- buttons
- cuffs
- vents
- layering
- proportions

The outfit image is not treated as the person identity source.

### Fabric

The fabric image is required in both modes.

The fabric image is treated as authoritative for:

- colour
- shade
- pattern
- texture
- visible weave
- sheen
- finish
- stripes
- checks
- motifs

The fabric image is explicitly instructed not to determine the customer’s identity or scene.

### Mode selection

The interface allows:

- **Use Garment Library**
- **Use Uploaded Outfit**

In uploaded-outfit mode, the library selections are not required.

In catalog mode, the employee chooses the garment and accessories from the visual catalog.

### Garment library

Current catalog includes visual cards for:

- No Change
- Suit
- Coat / Blazer
- Shirt
- Nehru Jacket
- Waistcoat
- Sherwani
- Indo-Western
- Kurta
- Kurta Pajama
- Trousers
- Men’s Pajama

`[CODE VERIFIED]`

### Suit flow

Selecting the deep `Suit` blueprint reveals the sequential suit configurator.

The current behavior is progressive:

1. Suit composition
2. Jacket closure
3. Button configuration
4. Fit and silhouette
5. Jacket length
6. Shoulder construction
7. Lapel type
8. Lapel width
9. Gorge
10. Lapel finish
11. Button stance
12. Chest pocket
13. Hip pockets
14. Ticket pocket
15. Vents
16. Button material
17. Sleeve buttons
18. Sleeve arrangement
19. Sleeve buttonholes
20. Buttonhole thread
21. Pick stitching
22. Lining
23. Waistcoat controls if three-piece
24. Trousers
25. Shoes
26. Turban

Only compatible options are displayed after prerequisite choices are made.

### Accessories

Current accessories:

- Turban:
  - None
  - Safa Turban
- Shoes:
  - Keep Existing
  - Oxford
  - Derby
  - Loafer
  - Monk Strap
  - Brogue
  - Mojari
  - Jutti

`[CODE VERIFIED]`

### Generate

Generate is disabled until required inputs/selections are complete.

The browser sends multipart form data to:

`POST /api/try-on`

The browser sends:

- person image
- optional outfit image
- fabric image
- selection mode
- controlled catalog IDs
- controlled style IDs
- controlled bespoke configuration JSON

It does not send an arbitrary prompt or model choice.

### Loading state

The generation state rotates through:

- Preparing images…
- Fitting the garment…
- Rendering result…

This is presentation language, not actual provider progress percentages.

### Result

The result screen provides:

- Original / Try-On toggle
- generated image
- Download
- Try Again
- Start Over
- History
- disclaimer:
  - “AI visualization. Actual garment fit may vary.”

The result is returned as JPEG bytes and held in a browser object URL. It is not automatically a permanent public URL.

### History

History opens as a panel from the main page.

It displays:

- preview
- time
- look
- account
- device
- model
- result status
- duration

Selecting an entry opens generation details and, if private Blob storage exists, retrieves private source/result assets through authenticated routes.

### Logout

The current UI logout button uses a POST request to:

`POST /api/auth/logout`

The server revokes the active server-side session and clears the cookie.

The earlier browser error happened when `/api/auth/logout` was opened as a GET request. The current implementation expects POST. `[CODE VERIFIED]`

---

## 4. Repository/project structure

### Stack

- Framework: Next.js 16.3.0
- UI: React 19.2.6
- Language: TypeScript 5.9.3
- Runtime: Node.js, minimum `22.13.0`
- Package manager: npm
- Styling: custom global CSS, Tailwind dependency present
- Database: no SQL database or ORM
- Data store: Upstash Redis
- Object storage: Vercel Blob
- Authentication: custom JWT/session system using `jose`, `bcryptjs`
- Image generation: official OpenAI Node SDK
- Validation: custom TypeScript validation
- Testing: Node test runner, TypeScript/TSX tests, rendered HTML tests
- Deployment: Vercel

`[CODE VERIFIED]`

### Important tree

```text
/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web
├── app
│   ├── page.tsx
│   ├── layout.tsx
│   ├── globals.css
│   ├── login/page.tsx
│   ├── manifest.ts
│   ├── robots.ts
│   └── api
│       ├── auth/login/route.ts
│       ├── auth/logout/route.ts
│       ├── catalog/route.ts
│       ├── history/route.ts
│       ├── history/[id]/asset/[asset]/route.ts
│       └── try-on/route.ts
├── components
│   ├── TryOnApp.tsx
│   ├── ImageUpload.tsx
│   ├── BespokeConfigurator.tsx
│   ├── VisualOptionCard.tsx
│   ├── StylePicker.tsx
│   ├── GenerationState.tsx
│   ├── TryOnResult.tsx
│   ├── UsageHistory.tsx
│   ├── LoginForm.tsx
│   └── LogoutButton.tsx
├── lib
│   ├── openai.ts
│   ├── validation.ts
│   ├── rate-limit.ts
│   ├── request-security.ts
│   ├── generation-storage.ts
│   ├── usage-history.ts
│   ├── try-on-handler.ts
│   ├── tryon
│   │   ├── index.ts
│   │   ├── prompt.ts
│   │   ├── types.ts
│   │   └── providers/openai.ts
│   ├── auth
│   │   ├── config.ts
│   │   ├── credentials.ts
│   │   ├── session.ts
│   │   └── session-store.ts
│   ├── catalog
│   │   ├── seed.ts
│   │   ├── store.ts
│   │   ├── types.ts
│   │   └── compatibility.ts
│   └── bespoke
│       ├── engine.ts
│       └── suit-profile.ts
├── public/catalog
│   └── SOURCES.md
├── tests
│   ├── security.test.ts
│   ├── catalog.test.ts
│   ├── bespoke.test.ts
│   └── rendered-html.test.mjs
├── scripts/hash-password.mjs
├── next.config.ts
├── vercel.json
├── package.json
├── package-lock.json
├── .env.example
└── README.md
```

The working tree appeared to contain untracked project files according to the previous `git status` inspection. A meaningful Git commit history could not be verified.

---

## 5. Frontend architecture

The principal workflow is implemented in:

`/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/components/TryOnApp.tsx`

It is a client-side React component using ordinary React state. No Redux or global state library is used.

Tracked state includes:

- person image
- outfit image
- fabric image
- preview URLs
- selection mode
- catalog
- upper garment
- lower garment
- garment subtype
- styles
- turban
- shoes
- bespoke selections
- generation state
- result URL
- error state

### Upload handling

`ImageUpload.tsx` handles:

- file chooser
- camera capture input
- drag and drop
- previews
- replacement
- removal
- accessibility
- client-side compression/conversion

The browser accepts HEIC/HEIF input, but the server only accepts JPEG, PNG, and WebP. Client-side conversion is intended to convert unsupported images before submission.

### Responsive behavior

At widths below approximately 820px:

- upload panels stack vertically
- generation mode controls stack
- catalog layouts reduce columns
- result presentation expands vertically

At widths below approximately 560px:

- history becomes a mobile card/table layout
- catalog cards become two-column
- buttons become full width
- result and upload cards adapt to phone dimensions

`[CODE VERIFIED]`

### Camera implementation

The app uses a file input with:

```text
accept="image/*"
capture="environment"
```

It does not use a custom `getUserMedia` camera interface. This is simpler and works with iOS Safari’s camera/photo chooser behavior.

---

## 6. Backend architecture

### API routes

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/catalog`
- `GET /api/history`
- `GET /api/history/[id]/asset/[asset]`
- `POST /api/try-on`

### Generation lifecycle

```text
Browser
  ↓
POST /api/try-on
  ↓
Origin validation
  ↓
Session authentication
  ↓
Rate-limit checks
  ↓
Multipart field allowlist
  ↓
Image validation
  ↓
Catalog/configuration resolution
  ↓
Compatibility validation
  ↓
Hidden prompt construction
  ↓
Reference image resolution
  ↓
OpenAI GPT Image 2
  ↓
Private Blob storage, if configured
  ↓
Upstash history event
  ↓
JPEG response to browser
```

### Authentication ordering

The generation endpoint rejects:

1. invalid origin
2. unauthenticated users
3. rate-limited requests
4. invalid uploads
5. invalid selection IDs

before any OpenAI call occurs.

`[CODE VERIFIED]`

### Error handling

User-facing errors are sanitized. Detailed internal errors are logged server-side with request IDs, provider/model/quality/duration metadata, but not credentials or image contents.

---

## 7. OpenAI/GPT Image integration

### SDK

Package:

`openai@7.4.0`

The server-only client is created in:

`/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/openai.ts`

### Exact current model identifier

```text
gpt-image-2
```

`[CODE VERIFIED]`

This is the configured image model. The application does not send requests through the Codex conversational model or GPT-5.6 Sol. The frontend cannot choose the model.

### API method

Current provider file:

`/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/tryon/providers/openai.ts`

Uses:

```text
client.images.edit(...)
```

### Current request parameters

- model: `gpt-image-2`
- quality: `low`, `medium`, or `high`
- default quality: `medium`
- size: `auto`
- output format: `jpeg`
- output compression: `90`
- background: `auto`
- number of outputs: `1`
- retries: `0`
- SDK timeout: approximately 165 seconds
- route maximum duration: approximately 180 seconds

`[CODE VERIFIED]`

### Input order

Uploaded-outfit mode:

```text
Image 1: customer/person
Image 2: uploaded outfit
Image 3: fabric
Image 4+: selected reference images
```

Catalog mode:

```text
Image 1: customer/person
Image 2: fabric
Image 3+: selected garment/accessory references
```

### Output

The provider extracts `b64_json` from the first returned image and converts it to JPEG bytes.

### Important README discrepancy

The README describes:

- `1024x1536`
- approximately 150-second timeout
- approximately 1.9 MB input handling

The current code instead uses:

- `size: "auto"`
- approximately 165-second timeout
- 1.25 MB server-side image limit

The current code is authoritative. `[CODE VERIFIED]`

### Retry behavior

There is no provider retry. Browser and route timeouts are the primary timeout protections.

### Real generation verification

Previous conversation evidence confirms that a real generation occurred and consumed OpenAI credits. However, this extraction did not trigger a new paid generation. Current code-level integration is verified; a fresh end-to-end GPT Image 2 test is not part of this audit.

---

## 8. Current hidden AI instruction/prompt system

Prompt code is located at:

`/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/tryon/prompt.ts`

The prompt is assembled from modules rather than being a single frontend-editable string.

### Static modules

- `NASIR_MENS_INSTRUCTION`
- `EDIT_PRIORITY_MODULE`
- `PERSON_MODULE`
- `REALISM_MODULE`
- `REFERENCE_IMAGE_MODULE`
- dynamic fabric module
- dynamic outfit module
- catalog-selection modules
- bespoke compiler output

### Current prompt intent

A normalized representation is:

```text
You are the visualization engine for NASIR BESPOKE,
a luxury men's bespoke tailoring business.

This is exclusively a men's clothing visualization system.
Do not introduce women's clothing or women's fashion styling.

Edit the supplied customer photograph rather than creating
an unrelated editorial image.

Preserve the customer's:
- identity
- face
- skin tone
- hairstyle
- facial hair
- apparent age
- body proportions
- pose
- posture
- expression
- hands
- camera perspective
- framing
- lighting
- shadows
- background
- location

Do not slim, reshape, replace, or redesign the person.

The uploaded fabric image is authoritative for:
- colour
- shade
- pattern
- pattern scale
- visible weave
- texture
- sheen
- finish
- checks
- stripes
- motifs

The garment or selected blueprint is authoritative for:
- garment category
- construction
- silhouette
- cut
- length
- collar
- lapels
- buttons
- pockets
- seams
- cuffs
- vents
- layering
- proportions

Do not copy the reference model's face, body, pose, scene,
lighting, or identity onto the customer.

Produce one photorealistic finished photograph.
Do not add extra limbs, duplicate garments, invented embroidery,
random accessories, altered identity, changed hairstyle,
changed body shape, unnecessary background changes, text,
borders, or collage layouts.
```

`[CODE VERIFIED — normalized from the prompt modules]`

### Uploaded outfit role

When an outfit photo exists, the prompt explicitly tells the model:

- Image 1 is the person
- Image 2 is the outfit-style reference
- Image 3 is the fabric
- Image 2 should control construction/style
- Image 3 should override the outfit’s colour/material details

### Catalog role

When no outfit photo exists:

- Image 1 is the person
- Image 2 is the physical fabric
- later images are selected blueprint/accessory references

### Fabric specificity

The current prompt deliberately separates:

```text
person identity
outfit construction
fabric appearance
```

This is the intended behavior requested in the conversation.

### Negative constraints

The prompt includes constraints such as:

- do not alter identity
- do not alter background unnecessarily
- do not convert single-breasted to double-breasted
- do not omit a selected waistcoat
- do not add a ticket pocket if “None” is selected
- do not add a turban when None is selected
- do not replace existing shoes when Keep Existing is selected

### Deep configuration compiler

For deep suit selections, the bespoke engine adds structured sections:

- OUTFIT STRUCTURE
- JACKET
- LAPELS
- POCKETS
- SLEEVES
- WAISTCOAT
- TROUSERS
- SHOES
- TURBAN
- DO NOT CHANGE / NEGATIVE CONSTRAINTS

---

## 9. API keys and secrets

### OpenAI key

Variable:

```text
OPENAI_API_KEY
```

Purpose: server-side OpenAI authentication.

It is not referenced by client components and is not prefixed with `NEXT_PUBLIC_`.

`[CODE VERIFIED]`

### Local environment

Local development uses `.env.local`.

`.env.example` contains placeholders only.

### Production environment

Production secrets are intended to be configured as sensitive Vercel environment variables.

The OpenAI key is not embedded in JavaScript sent to browsers.

### Other secret classes

- `AUTH_SESSION_SECRET`
- encoded or JSON authentication user allowlist
- `UPSTASH_REDIS_REST_TOKEN`
- `NASIR_BLOB_READ_WRITE_TOKEN`

No secret values are included in this report.

---

## 10. Authentication

### Login method

Username/password with bcrypt password hashes.

### Account model

Authorized users are loaded from:

- `AUTH_USERS_JSON_BASE64`, preferred
- `AUTH_USERS_JSON`, fallback

Each record contains:

- username
- display name
- bcrypt password hash

The password itself is never stored in plaintext.

### Password verification

`bcryptjs` is used.

Invalid users receive a dummy bcrypt comparison to reduce timing differences.

### Session token

JWT created with `jose` using:

- HS256
- issuer: Nasir Bespoke try-on issuer
- audience: Nasir Bespoke staff
- session type
- username subject
- UUID session ID
- expiration

### Cookie

Production cookie name:

```text
__Host-nasir-bespoke-session-v2
```

Development cookie name:

```text
nasir-bespoke-session
```

Properties:

- HttpOnly
- Secure in production
- SameSite Strict
- path `/`
- high priority
- browser-session cookie by default

### Session duration

Default server-side JWT/session TTL is approximately 12 hours, configurable between 1 and 168 hours.

`AUTH_SESSION_PERSISTENT=false` by default means the cookie does not receive a persistent browser `maxAge`.

However, Safari may restore session tabs/cookies, and the server-side session remains valid until TTL or logout/revocation. Therefore “browser-session-only” does not always guarantee a visible login screen every time Safari is reopened.

### Logout

Logout is POST-only, revokes the server-side session, clears current and legacy cookies, and redirects to `/login`.

### User count

The system supports 1–50 configured authorized users. The exact production user count was not inspected because credentials/configuration values were intentionally not exposed.

Conversation evidence indicates a `showroom` account was created, but the current production allowlist was not independently enumerated.

---

## 11. Database/data layer

There is no SQL database or ORM in the current repository.

`[CODE VERIFIED]`

### Upstash Redis stores

- sessions
- rate-limit counters
- catalog data
- generation history metadata

### Vercel Blob stores

- person image
- outfit image
- fabric image
- selected reference assets
- generated result

when the private Blob token is configured.

### Catalog keys

Catalog store uses versioned Redis keys similar to:

```text
nasir-tryon:catalog:blueprints:v5
nasir-tryon:catalog:accessories:v6
nasir-tryon:catalog:configuration-profiles:v1
```

### History keys

History uses keys similar to:

```text
nasir-tryon:history:events:v1
nasir-tryon:history:total:v1
```

### Session keys

Session IDs are hashed before storage, with keys similar to:

```text
nasir-tryon:session:<sha256>
```

### Current domain objects

The code models:

- user/authentication record
- generation event
- garment blueprint
- style option
- accessory
- configuration profile
- configuration group
- configuration option
- reference image
- outfit specification

These are TypeScript/data structures, not relational database tables.

---

## 12. History system

History implementation:

`/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/usage-history.ts`

UI:

`/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/components/UsageHistory.tsx`

### Stored metadata

Each event can store:

- unique generation ID
- timestamp
- username
- success/failure status
- duration
- provider
- model
- quality
- device category
- browser
- operating system
- selection mode
- garment IDs/names
- lower garment
- subtype
- style selections
- turban
- shoes
- structured bespoke configuration
- private asset references

### Stored versus displayed

Stored:

- complete audit metadata
- configuration IDs and names
- device/browser/OS
- duration
- generation status
- optional private asset references

Displayed:

- preview/result
- time
- look
- account
- device
- model
- result
- duration
- detailed generation specification

Raw IP addresses and raw user-agent strings are not stored in history.

### Retention

History is stored in a Redis list and trimmed to a maximum number of events.

Default:

```text
1000 events
```

This is count-based, not time-based.

### Pagination

The UI requests up to 100 history records at a time. The backend can retain more than the UI initially displays.

### Authorization limitation

The current history endpoint requires authentication but does not visibly filter history by username. Therefore any authenticated staff user may be able to see the shared history set.

This is a **MEDIUM privacy/authorization concern** if multiple staff accounts are used.

---

## 13. Image storage

### Customer photo

Without `NASIR_BLOB_READ_WRITE_TOKEN`:

- held in the current request
- sent to OpenAI
- not persistently stored by this application
- not available in History after the request

With the Blob token:

- stored in a private Vercel Blob path associated with the generation ID
- served only through authenticated application routes

### Outfit photo

Same lifecycle as customer photo.

### Fabric photo

Same lifecycle as customer photo.

### Generated result

Without Blob:

- returned to the browser
- held as a client object URL
- downloadable by the user
- not retained in application history as an image

With Blob:

- stored privately
- retrievable through authenticated history asset routes
- shown in History and generation details

### Reference images

- local public catalog assets are not customer images
- deep configuration references are stored under `/public/catalog`
- selected references may also be copied into private generation assets for history details

### Deletion

Automatic successful-generation deletion is not implemented.

Partial-upload cleanup is implemented when an asset upload fails midway.

There is no user-facing image deletion or retention-management interface.

---

## 14. Image input validation

### Client limits

- client file picker accepts up to approximately 15 MB before optimization
- client attempts compression/resizing
- maximum edge is approximately 2400 pixels
- output attempts target approximately 1.25 MB per image
- HEIC/HEIF may be converted in the browser

### Server limits

- each image: `1,250,000` bytes
- entire multipart request: `4,200,000` bytes

### Server-supported formats

- JPEG
- PNG
- WebP

### Magic-byte validation

The server checks file signatures for:

- JPEG
- PNG
- WebP
- HEIC

HEIC is recognized but rejected server-side with a conversion message if it reaches the backend unconverted.

### MIME matching

Declared MIME type must match the detected file signature.

### Not currently implemented

- decoded image dimension validation
- full image decoding before provider submission
- explicit decompression-bomb detection
- server-side HEIC conversion
- orientation normalization at the server
- per-image megapixel limits

These are relevant future hardening items.

---

## 15. Rate limiting and abuse protection

### Login

Default:

```text
10 attempts per 15 minutes
```

Uses a source address identifier derived from request headers and hashed before storage.

### Generation

Default per authenticated user:

```text
2 per minute
10 per hour
30 per day
```

### Global generation limit

Default:

```text
50 generations per day
```

### Backend

Production uses Upstash Redis-backed rate limiting.

Development/test may use memory fallback.

### Not implemented

- per-IP generation limit
- concurrent-generation lock
- idempotency key
- duplicate request detection
- per-device generation limit
- CAPTCHA
- account credits
- subscription enforcement
- spend-based OpenAI budget cutoff

The rate limiter prevents some abuse but does not prevent two simultaneous valid requests from running concurrently if quota remains.

---

## 16. Security audit

### Good/already protected

**Server-side OpenAI key — GOOD**

The key is only used in server files and is never sent to the browser.

**Authentication before generation — GOOD**

The generation route checks origin and authentication before processing uploads or contacting OpenAI.

**Prompt injection through form fields — GOOD**

The server allows a fixed field list and rejects unexpected fields. Arbitrary prompt text is not accepted.

**Model selection — GOOD**

The browser cannot choose the model. The server selects `gpt-image-2`.

**Origin protections — GOOD**

State-changing requests require same-origin validation and reject cross-site requests.

**Cookie security — GOOD**

Production session cookies are HttpOnly, Secure, SameSite Strict, and use the `__Host-` prefix.

**File validation — GOOD/PARTIAL**

Magic bytes, MIME types, and size limits are enforced. Full image decoding and dimension validation are absent.

**Private Blob routes — GOOD**

Customer images are not served through public Blob URLs. Asset routes require authentication and validate generation/asset identifiers.

**Security headers — GOOD**

CSP, HSTS in production, X-Frame-Options, Referrer-Policy, Permissions-Policy, CORP, COOP, and nosniff are configured.

### Medium findings

**Shared history authorization — MEDIUM**

Authenticated users appear to access the global history list rather than a user-filtered list.

**Image retention — MEDIUM**

Private Blob assets do not have an automatic deletion policy.

**No concurrent-generation lock — MEDIUM**

Multiple requests can execute simultaneously within quota.

**No per-IP generation limit — MEDIUM**

Generation limits are primarily per authenticated username plus global daily limit.

**Server image decoding — MEDIUM**

The server validates signatures but does not decode images or enforce dimensions/megapixels.

**Temporary reference licensing — MEDIUM**

Prototype references are sourced from Wikimedia/public sources, but commercial provenance and replacement by licensed Nasir photography remain future work.

### Low findings

**README/runtime mismatch — LOW**

README image size, timeout, and input-limit documentation differs from current code.

**No admin export/delete UI — LOW**

History exists but lacks administrative management.

**No automated visual quality verification — LOW**

The generated image is not automatically compared against the requested configuration.

---

## 17. Deployment

### Hosting

Vercel.

### Project

`nasir-bespoke-virtual-try-on`

### URL

[https://nasir-bespoke-virtual-try-on.vercel.app](https://nasir-bespoke-virtual-try-on.vercel.app)

### Build configuration

`vercel.json` uses:

```text
framework: nextjs
buildCommand: npm run build:next
```

### Previous verification

Prior deployment verification confirmed:

- `/login` returned 200
- unauthenticated `/api/catalog` returned 401
- `GET /api/try-on` returned 405
- latest production deployment reached Ready state

`[DEPLOYMENT VERIFIED — prior conversation]`

### Deployment flow

The repository is linked to Vercel through `.vercel/project.json`.

The exact Git auto-deploy connection was not verified. `[UNKNOWN]`

### Environment dependencies

Production requires, depending on enabled functionality:

- OpenAI
- Upstash Redis
- authentication secrets
- private Vercel Blob for visual History

### Preview deployments

Likely supported by Vercel, but the current repository does not document the exact branch/preview policy. `[UNKNOWN]`

---

## 18. Current cost-related architecture

Potential paid services:

- GPT Image 2 generations
- Vercel hosting/functions
- Upstash Redis operations
- Vercel Blob storage and bandwidth
- image transfer and delivery
- OpenAI API processing

### Existing safeguards

- per-user generation rate limits
- global daily generation limit
- upload-size limits
- no client-side OpenAI access
- no automatic multi-view generation
- one generated output per request
- no automatic correction loops

### Not currently protected by a hard monetary budget

There is no direct OpenAI spending cutoff or account-credit enforcement in the application.

The application’s rate limits reduce accidental abuse but do not guarantee a fixed monetary ceiling.

---

## 19. Current garment catalog

| Category | Status | Evidence |
|---|---|---|
| Suit | Deeply implemented | `[CODE VERIFIED]` |
| Coat / Blazer | Implemented, simpler style-based | `[CODE VERIFIED]` |
| Trousers | Implemented, catalog option and deep suit configuration | `[CODE VERIFIED]` |
| Shirt | Implemented, simpler style-based | `[CODE VERIFIED]` |
| Nehru Jacket | Implemented, simpler style-based | `[CODE VERIFIED]` |
| Waistcoat | Implemented, catalog option and three-piece suit support | `[CODE VERIFIED]` |
| Sherwani | Implemented, simpler style-based | `[CODE VERIFIED]` |
| Indo-Western | Implemented, simpler style-based | `[CODE VERIFIED]` |
| Kurta | Implemented | `[CODE VERIFIED]` |
| Kurta Pajama | Implemented as linked look | `[CODE VERIFIED]` |
| Men’s Pajama | Implemented | `[CODE VERIFIED]` |
| Turban | Implemented | `[CODE VERIFIED]` |
| Shoes | Implemented, with deeper suit shoe configuration | `[CODE VERIFIED]` |
| Women’s categories | Not present | `[CODE VERIFIED]` |

The current deep configuration system is strongest for Suit. Other categories retain simpler visual style pickers.

---

## 20. Reference image system

Reference assets are stored locally in:

`/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/public/catalog`

Metadata is stored in the catalog seed and profile definitions.

The catalog references real menswear photographs sourced from internet/public sources, primarily Wikimedia Commons. Local copies/crops are used instead of depending entirely on fragile hotlinks.

`[CODE VERIFIED]`

`public/catalog/SOURCES.md` documents:

- source URLs
- attribution
- license information
- prototype status
- replacement plan for official Nasir Bespoke photography

The catalog supports:

- display reference
- AI reference
- multiple references in the type model

For the current implementation, many records use one canonical image for both display and AI reference.

Deep Suit configuration selects a limited number of high-priority references rather than sending every thumbnail to OpenAI.

---

## 21. Prompt and dynamic configuration capability

| Capability | Status |
|---|---|
| Hardcoded permanent instruction | IMPLEMENTED |
| Prompt fragments | IMPLEMENTED |
| Structured garment metadata | IMPLEMENTED |
| Conditional option logic | IMPLEMENTED |
| Dependency rules | IMPLEMENTED |
| Conflict rules | IMPLEMENTED |
| Visual priorities | IMPLEMENTED for deep configuration |
| Target-view relevance | IMPLEMENTED for deep configuration |
| Structured Outfit Specification | IMPLEMENTED for deep Suit path |
| Deterministic prompt compiler | IMPLEMENTED |
| Dynamic reference selection | IMPLEMENTED |
| Multi-view generation | ARCHITECTURALLY PREPARED, not active |
| Automatic verification | NOT IMPLEMENTED |
| Automatic correction loops | NOT IMPLEMENTED |
| Relational database catalog | NOT IMPLEMENTED |
| Admin catalog editor | NOT IMPLEMENTED |

The current system is data-driven in code/Redis, but not a fully relational catalog-management product.

---

## 22. Test suite

### Existing tests

- `/tests/security.test.ts`
- `/tests/catalog.test.ts`
- `/tests/bespoke.test.ts`
- `/tests/rendered-html.test.mjs`

### Prior verified status

A previous run reported:

- 13 security tests
- 4 catalog tests
- 4 bespoke tests
- 3 rendered HTML tests

Total reported: 24 tests passing.

`[CONVERSATION/PRIOR VERIFICATION]`

### Covered

- login/security behavior
- origin checks
- cookie/logout behavior
- unauthenticated API rejection
- rate limiting
- upload validation
- unsupported/malformed files
- oversized requests
- prompt-field rejection
- catalog men’s-only filtering
- visual references
- linked garments
- configuration dependencies
- conflict rules
- prompt role mapping
- rendered source checks

### Not covered

- full browser E2E flow
- actual production GPT Image 2 call
- actual iPhone/iPad camera capture test
- private Blob retention/deletion
- multi-user history authorization
- production Upstash failure behavior
- visual comparison of generated output versus specification

Lint was not independently re-run during this extraction. `[UNKNOWN FOR THIS AUDIT]`

---

## 23. Current bugs and limitations

### Bugs or likely issues

- Global authenticated history is not visibly filtered by user. `[CODE VERIFIED]`
- Logout must be POST; opening the logout endpoint directly as a URL produces an error. `[CODE VERIFIED]`
- README and current runtime parameters differ. `[CODE VERIFIED]`
- No automatic image retention/deletion policy. `[CODE VERIFIED]`

### Technical debt

- No SQL schema or migrations.
- Catalog and configuration are seeded in source code and cached in Redis.
- No admin catalog editor.
- No centralized schema versioning for all historical specifications.
- No idempotency/concurrency handling.
- Limited server-side image decoding.
- No structured operational monitoring beyond logs/history.

### Product limitations

- Generated images are visualizations, not measurements or guaranteed fit.
- Image output can vary between attempts.
- Only one result is generated per request.
- Deep tailoring customization is primarily implemented for Suit.
- History is bounded by event count.
- No history export or admin deletion interface.
- No multi-view result generation.

### AI limitations

- GPT Image 2 may alter background or pose despite instructions.
- Small tailoring details may not be rendered consistently.
- Fabric pattern scale may not be exact.
- Identity preservation is prioritized but not mathematically guaranteed.
- The result may not reflect physical fit or tailoring measurements.

---

## 24. Brand and design details

### Visual language

- off-white/paper background
- black/charcoal text
- muted grey
- restrained gold/tan accent
- serif editorial headings
- Helvetica/Avenir-style sans text
- generous whitespace
- thin borders
- minimal shadows
- restrained luxury tailoring aesthetic

### CSS variables

The main palette includes:

- ink: approximately `#171714`
- muted: approximately `#6f6c63`
- paper: approximately `#f5f3ed`
- deep paper: approximately `#ece9e0`
- white: approximately `#fcfbf8`
- line: approximately `#d7d3c8`
- accent: approximately `#9b8258`

### Interaction style

- large visual cards
- clear selected state
- checkmarks and heavy borders
- no visible prompt editor
- no AI model selector
- touch-friendly controls
- progressive sections for deep configuration

---

## 25. Device targets

### Desktop

Supported through responsive CSS and multi-column catalog layout.

### iPad

Important target device. Cards, upload controls, and configuration sections are touch-friendly. The layout reduces columns below 820px.

### iPhone

Supports:

- camera/photo chooser
- stacked upload panels
- two-column or reduced catalog cards
- full-width Generate action
- mobile history layout

The user previously confirmed the deployed app worked on iPhone.

### Known considerations

- The app uses input capture rather than custom camera APIs.
- `Permissions-Policy` disables generic camera APIs, although file-input camera capture has been used successfully.
- No offline mode is implemented.
- The web manifest supports Add to Home Screen but does not provide offline caching.

---

## 26. Data privacy model

### Current technical behavior

If Blob storage is not configured:

- customer, fabric, and outfit images are transient request data
- result remains in browser memory/object URL
- history is metadata-only

If private Blob storage is configured:

- uploaded and generated images are retained in private Vercel Blob
- authenticated routes serve them
- public customer-image URLs are not created

OpenAI receives the images for processing.

The README notes that provider-level abuse-monitoring retention may apply depending on OpenAI’s current data controls.

### Access

- authenticated application users can access application history
- asset routes require authentication
- current history authorization is global rather than clearly user-scoped

### Deletion

No user-facing deletion mechanism exists.

No automatic successful-generation deletion policy exists.

---

## 27. Previous major decisions

| Decision | Why | Status |
|---|---|---|
| Internal staff application | Protect customer images and control paid generation | IMPLEMENTED |
| Vercel deployment | Simple production hosting and environment management | IMPLEMENTED |
| Server-only OpenAI key | Prevent browser/API-key exposure | IMPLEMENTED |
| GPT Image 2 | Core image visualization provider | IMPLEMENTED |
| Men’s-only specialization | Nasir Bespoke business focus | IMPLEMENTED |
| No user-authored prompts | Keep showroom workflow simple | IMPLEMENTED |
| Photograph fabric on the spot | Fabric is a major visual source of truth | IMPLEMENTED |
| Uploaded outfit mode | Allow exact style/construction reference | IMPLEMENTED |
| Garment library mode | Allow exploration without an outfit photo | IMPLEMENTED |
| Real internet references for prototype | Exercise visual catalog before official photography | IMPLEMENTED |
| Replace with official Nasir imagery later | Prototype references are temporary | PLANNED |
| Keep images private | Customer privacy | IMPLEMENTED when Blob configured |
| Keep browser session non-persistent by default | Require re-login after normal session expiry/closure | IMPLEMENTED, but browser restoration can still occur |
| Add history | Track usage, device, time, and result | IMPLEMENTED |
| Deep Suit configuration first | Prove generic configuration engine | IMPLEMENTED |
| No CRM/orders/payments yet | Keep V1 focused | AGREED |

---

## 28. Proposed next-version vision

The discussed target architecture is:

```text
Customer photo
    +
Fabric photo
    +
Optional outfit photo
    +
Structured garment configuration
    +
Accessory configuration
    ↓
Validated Outfit Specification
    ↓
Deterministic Visualization Compiler
    ↓
GPT Image 2
    ↓
Private result + complete audit history
```

The intended compiler should combine:

- permanent Nasir men’s instruction
- person-preservation module
- fabric-preservation module
- uploaded outfit role, if present
- garment blueprint role
- lower garment
- accessories
- selected customization options
- visual priorities
- negative constraints
- target camera view
- selected reference images

No second LLM should be used to write prompts.

---

## 29. Proposed Suit reference implementation

The current deep Suit profile already includes approximately:

- 62 configuration groups
- approximately 205 option declarations in the profile source
- composition
- jacket closure
- button configuration
- fit
- jacket length
- shoulder
- lapel type
- lapel width
- gorge
- lapel finish
- stance
- chest pocket
- hip pockets
- ticket pocket
- vents
- button material
- sleeve button count
- sleeve arrangement
- sleeve buttonholes
- thread
- pick stitching
- lining
- conditional waistcoat
- trouser fit
- trouser rise
- pleats
- pleat direction
- waistband
- waist closure
- front pockets
- rear pockets
- rear pocket closure
- fly
- hem
- break
- lining
- shoes
- shoe style
- turban

`[CODE VERIFIED]`

The system is designed to expand the same configuration-engine approach to other men’s garment families.

---

## 30. Proposed UX improvements

| Feature | Status |
|---|---|
| Progressive disclosure | IMPLEMENTED for Suit |
| Collapsible customization sections | IMPLEMENTED |
| Configuration stepper | PARTIAL; visual step indicators exist, not a full wizard |
| Persistent outfit summary | IMPLEMENTED |
| Autosave | NOT IMPLEMENTED |
| Draft recovery | NOT IMPLEMENTED |
| Loading states | IMPLEMENTED |
| Duplicate generation prevention | NOT IMPLEMENTED |
| Success states | IMPLEMENTED |
| Error states | IMPLEMENTED |
| Confirmation dialogs | NOT IMPLEMENTED |
| Sticky Review/Generate action | PARTIAL |
| Responsive mobile navigation | PARTIAL |
| Touch states | IMPLEMENTED |
| Jump-to-section navigation | NOT IMPLEMENTED |

---

## 31. Proposed production hardening

### Current

- HTTPS through Vercel
- server-only secrets
- secure cookies
- origin checks
- auth checks
- rate limiting
- MIME/signature validation
- size limits
- CSP/security headers
- sanitized errors
- private Blob route access

### Proposed

- user-scoped History authorization
- automatic retention/deletion policy
- administrative deletion/export
- idempotency keys
- concurrent-generation lock
- per-IP generation limits
- stronger decoded-image validation
- dependency scanning
- production alerting
- backup/restore strategy
- formal audit-log retention
- explicit OpenAI spend guardrails
- no-index verification
- browser E2E testing
- iPad/iPhone capture testing
- accessibility regression testing

---

## 32. Environment variables

| Variable | Purpose | Scope | Required |
|---|---|---|---|
| `OPENAI_API_KEY` | OpenAI server authentication | Local/production | Required |
| `AUTH_SESSION_SECRET` | JWT signing/session security | Local/production | Required |
| `AUTH_USERS_JSON_BASE64` | Encoded authorized-user allowlist | Local/production | Required/preferred |
| `AUTH_USERS_JSON` | Direct JSON user allowlist fallback | Local/production | Optional |
| `AUTH_SESSION_TTL_HOURS` | Session lifetime | Local/production | Optional |
| `AUTH_SESSION_PERSISTENT` | Persistent cookie toggle | Local/production | Optional |
| `AUTH_LOGIN_RATE_LIMIT_PER_15_MINUTES` | Login limit | Local/production | Optional |
| `UPSTASH_REDIS_REST_URL` | Redis REST endpoint | Production | Required |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication | Production | Required |
| `NASIR_BLOB_READ_WRITE_TOKEN` | Private Vercel Blob storage | Production | Required for visual History |
| `TRYON_RATE_LIMIT_PER_MINUTE` | Per-user generation limit | Local/production | Optional |
| `TRYON_RATE_LIMIT_PER_HOUR` | Per-user hourly generation limit | Local/production | Optional |
| `TRYON_RATE_LIMIT_PER_DAY` | Per-user daily generation limit | Local/production | Optional |
| `TRYON_GLOBAL_RATE_LIMIT_PER_DAY` | Global daily generation limit | Local/production | Optional |
| `TRYON_HISTORY_MAX_EVENTS` | Maximum retained history records | Local/production | Optional |
| `TRY_ON_PROVIDER` | Internal provider selection | Local/production | Optional |
| `TRY_ON_QUALITY` | GPT image quality | Local/production | Optional |
| `AUTH_ALLOWED_ORIGINS` | Additional trusted origins | Local/production | Optional |
| `DEV_ALLOWED_ORIGIN` | LAN development origin | Local development | Optional |
| `NEXT_PUBLIC_SITE_URL` | Canonical site metadata URL | Production | Optional |
| `VERCEL_URL` | Vercel-provided deployment URL | Production | Automatic |
| `NODE_ENV` | Runtime environment | Automatic | Automatic |
| `RATE_LIMIT_BACKEND` | Test-only memory backend override | Tests | Test-only |

No values are reproduced.

---

## 33. Important code locations

| Functionality | File |
|---|---|
| Main protected page | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/app/page.tsx` |
| Login page | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/app/login/page.tsx` |
| Main frontend workflow | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/components/TryOnApp.tsx` |
| Upload UI | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/components/ImageUpload.tsx` |
| Result UI | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/components/TryOnResult.tsx` |
| Loading UI | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/components/GenerationState.tsx` |
| History UI | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/components/UsageHistory.tsx` |
| Suit configurator | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/components/BespokeConfigurator.tsx` |
| Generation endpoint | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/app/api/try-on/route.ts` |
| Generation handler | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/try-on-handler.ts` |
| OpenAI provider | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/tryon/providers/openai.ts` |
| OpenAI client | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/openai.ts` |
| Prompt modules | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/tryon/prompt.ts` |
| Bespoke engine | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/bespoke/engine.ts` |
| Suit profile | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/bespoke/suit-profile.ts` |
| Catalog seed | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/catalog/seed.ts` |
| Catalog store | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/catalog/store.ts` |
| Compatibility | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/catalog/compatibility.ts` |
| Upload validation | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/validation.ts` |
| Rate limiting | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/rate-limit.ts` |
| Request security | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/request-security.ts` |
| Authentication | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/auth/` |
| History storage | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/usage-history.ts` |
| Image storage | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/generation-storage.ts` |
| Catalog asset sources | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/public/catalog/SOURCES.md` |
| Database-like configuration | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/lib/catalog/` |
| Tests | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/tests/` |
| Deployment config | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/vercel.json` |
| Security headers | `/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web/next.config.ts` |

---

## 34. Current architecture diagram

```text
SHOWROOM DEVICE
  iPhone / iPad / Mac / Windows
          │
          ▼
NEXT.JS APP ON VERCEL
          │
          ├── /login
          │      │
          │      ├── bcrypt credential verification
          │      ├── JWT creation
          │      └── Upstash session record
          │
          ▼
AUTHENTICATED TRY-ON UI
          │
          ├── Customer image
          ├── Optional outfit image
          ├── Fabric image
          ├── Catalog IDs
          └── Bespoke selections
          │
          ▼
POST /api/try-on
          │
          ├── Origin validation
          ├── Session validation
          ├── Rate limiting
          ├── Multipart allowlist
          ├── Image validation
          ├── Catalog/compatibility validation
          └── Prompt construction
          │
          ├───────────────┬───────────────────┐
          ▼               ▼                   ▼
      Upstash         OpenAI GPT Image 2   Vercel Blob
      Redis           images.edit           private assets
      history        gpt-image-2
          │               │                   │
          └───────────────┴───────────────────┘
                          │
                          ▼
                 JPEG result to browser
                          │
                          ▼
               Result / Download / History
```

### Proposed next-version architecture

```text
CUSTOMER PHOTO
      +
FABRIC PHOTO
      +
OPTIONAL OUTFIT PHOTO
      +
VISUAL GARMENT SELECTION
      +
SEQUENTIAL CUSTOMIZATION
      +
ACCESSORIES
          │
          ▼
STRUCTURED OUTFIT SPECIFICATION
          │
          ├── dependency validation
          ├── conflict validation
          ├── visual-priority filtering
          ├── target-view filtering
          └── reference-image resolver
          │
          ▼
NASIR VISUALIZATION COMPILER
          │
          ├── person module
          ├── fabric module
          ├── outfit/design module
          ├── tailoring option modules
          └── negative constraints
          │
          ▼
GPT IMAGE 2
          │
          ▼
PRIVATE RESULT + COMPLETE SPECIFICATION
          │
          ▼
AUTHORIZED VISUAL HISTORY
```

---

## 35. Current state scorecard

| Feature | Status | Confidence |
|---|---|---|
| Authentication | COMPLETE | High |
| GPT Image 2 integration | COMPLETE | High |
| Server-only API key | COMPLETE | High |
| Person upload | COMPLETE | High |
| Fabric upload | COMPLETE | High |
| Optional outfit upload | COMPLETE | High |
| Camera chooser | COMPLETE | Medium |
| Garment library | COMPLETE | High |
| Men’s-only catalog | COMPLETE | High |
| No Change upper/lower | COMPLETE | High |
| Deep Suit configuration | COMPLETE | High |
| Sequential compatible configuration | COMPLETE | High |
| Other garment deep configuration | PARTIAL | High |
| Dynamic prompt composition | COMPLETE | High |
| Structured Outfit Specification | PARTIAL/COMPLETE for Suit | High |
| Reference resolver | COMPLETE | High |
| GPT image persistence | CONDITIONAL | High |
| Private image storage | CONDITIONAL | High |
| History metadata | COMPLETE | High |
| Visual History | CONDITIONAL on Blob token | High |
| Per-user History isolation | NOT COMPLETE | High |
| Rate limiting | COMPLETE | High |
| Per-IP generation limit | NOT IMPLEMENTED | High |
| Concurrent generation lock | NOT IMPLEMENTED | High |
| Autosave | NOT STARTED | High |
| Multi-view generation | NOT STARTED | High |
| Automated visual verification | NOT STARTED | High |
| Mobile layout | COMPLETE | High |
| iPhone/iPad capture | PARTIAL/previously observed working | Medium |
| Production deployment | COMPLETE | High |
| Full E2E tests | NOT COMPLETE | High |
| README/runtime alignment | PARTIAL | High |

---

## 36. Risks before the next major build

### P0

1. **History privacy scope**
   - Authenticated users may see shared history.
   - Important if multiple showroom employees/accounts are introduced.

2. **Image retention policy**
   - Private Blob images may persist indefinitely.
   - Customer-photo deletion and retention rules are not implemented.

### P1

3. **No idempotency/concurrency control**
   - Double taps or repeated requests can consume multiple generations.

4. **No per-IP generation control**
   - A compromised authenticated account could generate from multiple devices until user/global limits are reached.

5. **Limited server-side image decoding**
   - Signature checks do not fully validate decoded dimensions or decompression risks.

6. **Catalog data is source-seeded**
   - No admin editing workflow or relational migration system exists.

### P2

7. **Prototype reference licensing**
   - Temporary references should be replaced with controlled Nasir-owned/licensed photography.

8. **README/runtime configuration mismatch**
   - Documentation currently describes outdated size/timeout/input limits.

9. **No automated visual compliance checking**
   - There is no system verifying whether GPT Image 2 preserved every selected feature.

### P3

10. **Output variation**
    - GPT Image 2 can vary in pose, background, garment details, and fabric reproduction.

11. **No offline showroom mode**
    - A network connection is required for the app and generation.

12. **No administrative reporting/export**
    - History is operational, not yet a full business analytics system.

---

## 37. Recommended next implementation boundary

The smallest coherent next milestone should be security and data-integrity hardening before adding more garment taxonomy:

1. Scope History queries and asset access to authorized users or explicit staff permissions.
2. Add generation idempotency/concurrency protection.
3. Define Blob retention and deletion behavior.
4. Align README with current runtime behavior.
5. Add one browser-level end-to-end test for:
   - login
   - person/fabric upload
   - outfit mode
   - catalog mode
   - generation request mocking
   - History display
6. Preserve the current deep Suit configurator while adding one more garment family only after these foundations are stable.

This is analysis only; no implementation was performed.

---

# AI HANDOFF — COPY THIS INTO A NEW CONVERSATION

Nasir Bespoke Virtual Try-On is an internal Vercel-hosted men’s bespoke visualization tool at:

`https://nasir-bespoke-virtual-try-on.vercel.app`

Repository:

`/Users/omar/Documents/Codex/2026-08-14/build-a-complete-production-ready-web`

Stack:

- Next.js 16.3.0
- React 19.2.6
- TypeScript 5.9.3
- Node >=22.13
- npm
- OpenAI SDK 7.4.0
- `gpt-image-2`
- Upstash Redis
- private Vercel Blob
- jose JWT
- bcryptjs
- custom CSS
- no SQL database or ORM

Current workflow:

```text
Login
→ customer/model photo
→ optional outfit photo
→ fabric photo
→ Use Garment Library OR Use Uploaded Outfit
→ visual men’s garment selections
→ sequential Suit configurator when Suit is selected
→ optional turban/shoes
→ Generate
→ GPT Image 2
→ JPEG result
→ Download / Try Again / Start Over / History
```

Main frontend:

`components/TryOnApp.tsx`

Generation endpoint:

`app/api/try-on/route.ts`

Generation handler:

`lib/try-on-handler.ts`

OpenAI provider:

`lib/tryon/providers/openai.ts`

Prompt modules:

`lib/tryon/prompt.ts`

Bespoke compiler:

`lib/bespoke/engine.ts`

Suit profile:

`lib/bespoke/suit-profile.ts`

Catalog:

`lib/catalog/seed.ts`, `lib/catalog/store.ts`, `lib/catalog/types.ts`

Validation:

`lib/validation.ts`

History:

`lib/usage-history.ts`, `components/UsageHistory.tsx`

Private assets:

`lib/generation-storage.ts`

Authentication:

`lib/auth/`

Current model request:

- `client.images.edit`
- model `gpt-image-2`
- quality default `medium`
- size `auto`
- JPEG output
- compression 90
- one output
- approximately 165-second SDK timeout
- zero automatic SDK retries
- route maximum duration approximately 180 seconds

Image roles:

Uploaded-outfit mode:

```text
Image 1 = customer/person
Image 2 = uploaded outfit style/construction
Image 3 = fabric colour/texture/pattern
Image 4+ = selected references
```

Catalog mode:

```text
Image 1 = customer/person
Image 2 = fabric
Image 3+ = selected catalog/accessory references
```

Prompt priorities:

1. preserve customer identity, face, body, pose, scene, and camera
2. preserve photographed fabric colour, shade, texture, weave, pattern, sheen, and finish
3. apply selected outfit construction/style
4. preserve selected accessories
5. avoid background, identity, anatomy, accessory, and garment hallucinations

The server rejects arbitrary prompt/model fields. The browser sends selection IDs and controlled structured configuration only.

Authentication:

- username/password
- bcrypt hashes
- `AUTH_USERS_JSON_BASE64` or `AUTH_USERS_JSON`
- JWT via `jose`
- Upstash-backed server session store in production
- HttpOnly Secure SameSite Strict production cookie
- default browser-session cookie
- configurable 1–168 hour TTL
- POST logout revokes the server-side session

Required secrets:

- `OPENAI_API_KEY`
- `AUTH_SESSION_SECRET`
- `AUTH_USERS_JSON_BASE64`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Private visual History additionally requires:

- `NASIR_BLOB_READ_WRITE_TOKEN`

Without the Blob token, generation works but History is metadata-only.

Current catalog:

- No Change
- Suit
- Coat / Blazer
- Shirt
- Nehru Jacket
- Waistcoat
- Sherwani
- Indo-Western
- Kurta
- Kurta Pajama
- Trousers
- Men’s Pajama
- Turban
- Shoes

Suit is the only deeply customized garment family currently. The Suit profile has approximately 62 groups and approximately 205 option declarations, including composition, closure, button layout, fit, length, shoulders, lapels, pockets, vents, sleeves, waistcoat, trousers, shoes, and turban.

Current data storage:

- Upstash Redis stores sessions, rate limits, catalog records, and bounded history metadata.
- Vercel Blob stores private person/outfit/fabric/reference/result assets when configured.
- No relational database exists.
- History defaults to approximately 1,000 retained records.
- Current history is globally visible to authenticated staff rather than clearly user-scoped; this should be reviewed before adding more staff accounts.
- No automatic successful-generation Blob deletion exists.
- No user-facing deletion/export UI exists.

Current rate limits:

- login: approximately 10 per 15 minutes
- user generation: approximately 2/minute, 10/hour, 30/day
- global generation: approximately 50/day
- no per-IP generation limit
- no concurrent-generation lock
- no idempotency key

Current image limits:

- server per image: 1,250,000 bytes
- full request: 4,200,000 bytes
- browser accepts larger files and attempts compression
- browser accepts HEIC/HEIF, but server supports JPEG/PNG/WebP after conversion
- no decoded megapixel/dimension validation

Reference images:

- locally hosted under `public/catalog`
- real prototype menswear photographs
- provenance documented in `public/catalog/SOURCES.md`
- intended to be replaced by official Nasir Bespoke photography
- no women’s fashion taxonomy exists

Current unresolved items:

1. user-scoped History authorization
2. Blob retention/deletion
3. idempotency and duplicate-generation prevention
4. per-IP generation controls
5. stronger server-side image decoding validation
6. official licensed Nasir reference imagery
7. deep configuration for non-Suit garments
8. automated visual verification
9. multi-view generation
10. documentation/runtime alignment

Recommended next milestone:

Harden History authorization, image retention, idempotency, and E2E coverage before expanding the deep configurator to another garment family.
