# Split Outfit step-by-step builder and customer view — design

Date: 4 November 2026
Status: draft for owner approval. Authorizes no implementation, paid image calls, push or deployment.

## Why

Split Outfit is the most flexible way to build a look (jacket, trousers, shirt, waistcoat, shoes, accessories, each with its own cloth). Today it is one continuous page about 9,650 px tall on desktop: every option grid and every full-size fabric upload box is stacked, and the chosen combination is only visible as text at the very bottom. On the showroom iPad this reads as a long form, not a fitting.

Split Outfit is still experimental and has not been used much with real customers, so there is no list of observed pain points. This redesign is driven by the layout review, not by measured staff complaints.

## Who uses it, and where (owner-confirmed)

- Staff build the outfit, mostly on an **iPad**, sometimes on a **phone**.
- The customer is usually **not** beside them while they build.
- The customer sees the result **on the same iPad**: staff hand it over.

Consequence: the builder is a staff work tool (fast, compact, low scrolling). The customer moment is the result, so the result needs a clean "show customer" view.

## Goals

1. Replace the single long Split Outfit page with a step-by-step builder: one step on screen at a time.
2. Keep what has been chosen always visible, with cloth swatches, and let staff jump to any step.
3. Put each garment's cloth choice inside that garment's step, compactly.
4. Make option cards scannable: photo, name, one line; tailoring specs behind a Details tap.
5. Add a "Show customer" view for presenting results on the iPad, with all staff controls hidden.

## Non-goals

- No change to what is sent to the image model: the prompt, image order, recipe validation, upload roles, fabric guidance, idempotency, pending recovery and History stay exactly as they are.
- No change to Full Outfit mode's flow (it may share the new top-of-page mode/family placement only).
- No new garment families, garment options, shoe/shirt colour options or fabric library. "Library" is a future cloth source; it is not shown until that feature exists.
- No new visual style. Keep the existing Midnight Atelier tokens (near-black surfaces, gold accent, serif headings) in `app/globals.css`.
- No new dependencies.

## Anti-goals (would make this a failure even if it works)

- The customer view ever shows another customer's photo or History, or any staff control.
- A layout change silently changes what gets generated (a recipe or cloth assignment that differs from what the left list shows).
- The builder hides an incompatibility repair: a selection removed by the rules engine without staff noticing.
- iPad staff have to scroll the page to reach Next/Back or to see the step list.

## Constraints

- Next.js 16.3 App Router and React 19 as already used. Read the relevant guide in `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`).
- iPad Safari (portrait and landscape) is the primary target; phone Safari/Chrome secondary; desktop must still work.
- Touch targets at least 44×44 pt, at least 8 px between adjacent targets. Text contrast at least 4.5:1 (check gold-on-near-black small text and grey helper text, both currently borderline).
- Respect `prefers-reduced-motion` for any transition or flash.
- Split Outfit stays behind the existing `splitOutfitEnabled` flag and `ModeSelector`.
- Existing tests (`npm run verify`) must keep passing; browser checks in `scripts/check-improvement-browser.mjs` that target Split Outfit selectors will need updating to the new structure while keeping the same behavioural assertions.

## Page structure (decided)

Top of page, before any step: the **Full / Split mode choice**, then (in Split mode) the **outfit family** selector (Suit; other families labelled "Coming soon"). Changing family resets the recipe as it does today.

Below that, in Split mode, the builder.

## The builder (layout B — owner chose)

### iPad landscape and desktop

Two columns.

**Left column — step list that is also the outfit summary.** Rows, in order:

1. Customer photo
2. Jacket
3. Trousers
4. Shirt & waistcoat
5. Shoes
6. Extras (accessories)
7. Review & generate

Each row shows: step number or a tick when complete; the chosen piece name ("Jacket · Classic"); a small swatch of its effective cloth (uploaded cloth thumbnail, "same as jacket" swatch, or a neutral "reference cloth" mark); and the customer photo thumbnail on row 1. The current step is highlighted (gold border, `aria-current="step"`). Tapping any row goes to that step. Rows are never locked: staff may visit steps in any order.

**Main column — the current step only.** Step heading, then content, then a footer with **Back** and **Next: <next step name>** buttons. The footer stays visible without scrolling the page on iPad (sticky to the bottom of the main column if the step content is long).

### iPad portrait and phone

The left list collapses into a slim bar at the top of the builder: "Step 3 of 7 · Trousers" plus the row of chosen swatches. Tapping the bar opens the full list as a sheet; choosing a row closes it and goes to that step. Main content is one column. Back/Next stay pinned at the bottom of the viewport. Builder's call where exactly the portrait breakpoint sits, provided an iPad held upright uses the collapsed bar if two columns would make option cards narrower than about 160 px.

### Step contents

- **Customer photo:** existing `ImageUpload` for the person, with its current guidance text. Complete when a photo is present.
- **Jacket / Trousers:** option cards for that slot (compatible options only, as today), then that piece's cloth section.
- **Shirt & waistcoat:** shirt cards and shirt cloth; then waistcoat cards; waistcoat cloth appears only when a real waistcoat is chosen (as today).
- **Shoes:** shoe cards. No cloth section ("uses the shoe photograph").
- **Extras:** accessory cards, multi-select, labelled as text-described (no photograph).
- **Review & generate:** the existing per-piece review (`SplitOutfitReview`), the existing Advanced → Background preservation disclosure, and the Generate button. After a result exists, the result appears here (see below).

Step "complete" means: required selection made (jacket, trousers, shirt, shoes; customer photo for row 1). Waistcoat and extras are optional and show as complete once visited or once a choice is made. Builder's call on the exact rule, provided the left list never shows a tick for a step whose required selection is missing.

### Cloth section inside a garment step (decided)

A compact row, not a full-width upload panel: current cloth swatch (or "Reference cloth" placeholder) + actions **Upload** (camera or file, via existing `ImageUpload` behaviour) and, for trousers only, **Same as jacket** / **Unlink** (existing link behaviour from `client-fabrics.ts`). The fabric reference controls (whole swatch + detail, repeat measurements) that today render per piece remain available for that piece, behind a "Cloth settings" disclosure. While trousers are linked, show "Controlled by jacket cloth" instead of a second editor, as today. "Library" is not shown in this release.

The existing guidance text for cloth photos stays, shown under the upload action (it may be shortened, not removed).

### Option cards (decided)

Show: reference photo, name, one-line subtitle, selected state, and the compatibility badge where the rules engine gives one. Move the paragraph description and spec bullets into a **Details** disclosure on the card (keyboard and touch accessible; opening it must not select the card). When a reference image is missing or fails to load, show a neutral placeholder with the piece name, never the raw alt text over an empty box.

### Incompatibility repairs (decided)

The rules engine's `reconcile` keeps removing invalid downstream selections. When it does, the affected left-list row(s) briefly highlight (static highlight under reduced motion) and the existing repair notice text appears in the current step. The removed step loses its tick.

### Navigation

- Next/Back move one step. Next is always enabled; the Review step lists anything missing, each with a link to its step, and Generate stays disabled until the recipe is complete (current rules).
- Changing step moves focus to the new step heading (for screen readers and keyboard), and scrolls the main column to its top.
- Builder's call whether the current step is reflected in the URL; if it is, the iPad back gesture must not abandon an in-flight generation or lose the draft.

### While generating

As today: the whole builder is disabled during upload/generation, with the existing progress and Cancel upload. The left list remains visible so staff see what is being generated.

## Result and customer view (layout B — owner chose)

### Staff result (Review step)

When a result arrives it shows in the Review step using the existing `TryOnResult` (Original / Try-On / Side by side, feedback, download, Try Again, Start Over). Add one primary button: **Show customer**.

### Show customer view

A full-screen overlay presenting the result.

- **Landscape:** photo on the left (most of the width), outfit card on the right.
- **Portrait:** photo on top, outfit card below. Owner-approved as "my call".
- **Outfit card:** one row per piece with a larger swatch and plain wording, e.g. "Classic jacket · your cloth", "Non-pleated trousers · same cloth as jacket", "Classic formal shirt", "Oxford shoes"; accessories in a small line beneath. Wording comes from the **submitted** result summary (`lib/result-summary.ts`), never the current draft, so later edits cannot relabel a shown result.
- **Photo:** pinch/double-tap zoom (reuse `ZoomableImage`). A **Before / After** toggle switches to the customer's original photo.
- **Earlier results:** if more than one result was generated in this page session, swipe (and visible arrows) moves between them, with dots showing position. Only results generated in the current browser session are included. Nothing is loaded from History.
- **Always shown:** "AI visual reference — not an exact match of the cloth."
- **Hidden:** feedback, favourites, download, settings, History, staff name, logout and every builder control.
- **Done** (top corner) closes the view and returns to the builder with every choice intact. Escape also closes it on keyboards. Focus is trapped inside the overlay while open and returns to the Show customer button on close.
- Nothing new is stored or sent by opening this view.

Builder's call: how session results and their swatches are kept available (for example keeping the submitted thumbnails/URLs alive for the session, or using the stored History asset URLs for that generation). They must survive later draft edits and cloth replacements, and must be released on Start Over and on logout.

### Results within a session (my calls, settled after the builder check)

- **Generate / Try Again keep earlier results.** Today `generate()` calls `clearResult()`, which revokes the previous result and swatch URLs. Change this so each new result is added to an in-memory, current-page session list. The staff Review step shows the newest result; Show customer can swipe back through the list. Start Over, logout and page unload release everything. Cap the list (builder's call, for example 6) and release the oldest when exceeded.
- **What counts as "this session":** results generated in this page since the last Start Over, plus a result recovered after a reload through pending recovery (shown without swatches if its local cloth files are gone, with the wording still from its summary). Looks restored from History are **not** added.
- **Editing after a result:** the result stays visible in Review with a note "The outfit has changed since this result" once the draft no longer matches its submitted summary. Nothing is cleared automatically. Generate adds a new result rather than replacing.
- **Swatches for the customer card:** taken from the cloth actually submitted for that generation (History asset URLs when available, else the local preview kept alive with that session result). A linked trouser shows the jacket's swatch with "same cloth as jacket". A piece with no uploaded cloth shows a neutral "house cloth" mark, not an invented colour.
- **Result summary data:** extend `ResultSummary` in `lib/result-summary.ts` with what the card needs: accessories, a per-piece cloth source (`uploaded` / `linked-to-jacket` / `reference`) and plain customer-facing labels. Keep it server-checkable data only, no `File` objects or private paths. Keep parsing backward-compatible so older pending records and History entries still load; missing new fields fall back to today's wording.

### Customer photo across modes (my call)

The customer photo stays a single shared upload used by both modes, as today. Switching between Full and Split keeps it. In Split mode it appears as builder step 1; in Full mode it stays where it is today. One piece of state, rendered in whichever place the active mode needs.

## Also in scope (my calls, small)

- Fix the mobile `ImageUpload` overflow seen at 375 px width (format line spills outside the frame; arrow icon overlaps the border), since the builder relies on it on phones.
- Correct "Complete curated looks across 7 bespoke categories" to match the actual catalogue count (8), or derive it from the catalogue.

## Testing expectations

- Unit tests for any new pure helpers (for example step completion and the step list model) written test-first.
- Existing Split Outfit behaviour tests keep passing unchanged: request building, linked cloth, review summary, pending recovery.
- Browser check updated to drive the builder through every step on iPad landscape, iPad portrait and phone widths, assert the left list matches the submitted recipe and cloth roles, open and close Show customer, and confirm no staff controls are present in it. No paid calls; synthetic fixtures as today.
- Screenshot review at 1180×820, 820×1180 and 375×812.

## Decisions log

Owner decided: iPad-first staff tool; customer not present while building; result shown on the same iPad; builder layout B (combined step list and summary on the left); customer view layout B (photo plus outfit card).

My calls (flagged for owner review): family and mode at top of page; card details behind a Details tap; repair highlight in the left list; Library hidden until it exists; portrait customer view stacks the card below; customer view limited to current-session results; staff review stays on the normal result screen; Advanced background setting moves to the Review step; Next always enabled with missing items listed on Review; mobile upload overflow fix and category-count fix included; Generate/Try Again keep earlier results for the session; edits after a result show a "changed since this result" note instead of clearing it; History-restored looks are excluded from the customer carousel; linked trousers show the jacket swatch; `ResultSummary` is extended backward-compatibly; the customer photo stays shared between modes.

## Left to the builder

Component breakdown and file layout under `components/split-outfit/`; whether to extract builder state out of `TryOnApp.tsx` (currently 861 lines) into a hook; CSS organisation within `app/globals.css`; exact breakpoints within the constraints above; animation details within reduced-motion rules.
