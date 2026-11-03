# Offline outfit comparisons

`npm run quality:prepare` still creates synthetic fabric calibration fixtures. Synthetic swatches and mock browser tests are technical checks, not evidence of photographic accuracy.

Prepare a local folder containing consented customer photos, approved piece-specific construction references, fabrics and a `manifest.json`. Keep customer data and generated artifacts outside Git (for example under `.cache/`). Paths must stay inside this folder; escaping symlinks and absolute paths are rejected.

Example manifest:

```json
{
  "version": 1,
  "experiment": "fabric-treatment",
  "repetitions": 1,
  "cases": [{
    "id": "navy-check",
    "recipe": {
      "family": "suit",
      "upperId": "SUIT_UPPER_CLASSIC",
      "lowerId": "SUIT_LOWER_NON_PLEATED",
      "shirtId": "SUIT_SHIRT_CLASSIC_FORMAL",
      "waistcoatId": "SUIT_WAISTCOAT_NONE",
      "footwearId": "SUIT_SHOE_OXFORD",
      "accessoryIds": []
    },
    "person": "customer.png",
    "fabrics": { "fabric": "cloth.png", "lowerFabric": "cloth.png" },
    "references": {
      "split-upper": "jacket.png",
      "split-lower": "trousers.png",
      "split-shirt": "shirt.png",
      "split-footwear": "shoes.png"
    }
  }]
}
```

Run:

```sh
npm run quality:prepare-outfit -- .cache/fixtures/manifest.json .cache/comparison-run-001
npm run quality:report -- .cache/comparison-run-001
```

Open `comparison.html` in the output folder. Preparation validates recipes/images and uses the production input compiler, reference ordering, grayscale and fabric-crop functions. It writes input images, hashes, final prompt, planned settings, and a separate condition key. Existing output directories are refused. There are no network calls, provider requests, or live storage reads.

`fabric-treatment` compares centre crop and whole-plus-detail at medium quality. `quality` plans medium/high comparison with the same whole-plus-detail treatment and output size. These are experiment settings; the production app's defaults do not change. Use a new directory per run. Before making any paid calls, review the case list, attempt count, settings and expected cost with the owner.

After an authorized external pilot, place each actual output at `<runId>/generated.png`. Re-run the report command with a new filename, for example `review.html`. The report conceals condition meanings; keep its key separate during scoring. It labels absent outputs and never creates placeholder quality results. Its inline review controls are temporary notes, not persisted scores.

Fill `score-template.json`: `accepted` is boolean, `durationMs` is observed, `costUsd` is observed or null, and `scores` contains integer 1–5 values for `scale`, `colour`, `construction`, `background`, and `identity`. For failed runs use `accepted:false`, `failed:true`, `scores:null` and actual duration/cost where known. Include each paid attempt separately. Then run:

```sh
npm run quality:summary -- /absolute/path/to/scored-results.json
```

The existing summarizer counts failures/rejections and reports unknown costs as unknown. No percentage improvement should be claimed until actual outputs have been reviewed on representative photos. This bounded offline tool does not execute model jobs or manage billing.
