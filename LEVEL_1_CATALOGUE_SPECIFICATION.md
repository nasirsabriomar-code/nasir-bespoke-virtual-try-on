# Nasir Bespoke — Level 1 Curated Design Catalogue

**Status:** Approved source of truth for the next catalogue implementation  
**Audience:** Nasir Bespoke, product/design, engineering, and future AI development agents  
**Scope:** Customer-facing Level 1 visual try-on only. This document does not change the current application.

## 1. Product decision

Level 1 is a **curated look-selection experience**, not a tailoring configurator.

The customer flow is:

```text
Customer photograph + fabric photograph
        ↓
Choose one outfit category
        ↓
Choose one curated design card
        ↓
Generate visual try-on
```

The customer chooses a professionally designed garment concept. They do **not** select lapels, pockets, vents, sleeve buttons, trouser breaks, shoe details, or other expert tailoring controls in this flow.

The server will later combine three authorities:

1. **Customer photo** — identity, body, proportions, pose, and scene.
2. **Design blueprint** — garment construction, silhouette, proportion, and outfit architecture.
3. **Fabric photo** — colour, texture, weave, pattern, sheen, motif, and material appearance.

The design-card image communicates construction only. It must never override the uploaded fabric or replace the customer with the reference model/mannequin.

## 2. Taxonomy decisions

### Approved Level 1 customer-facing categories

| Order | Customer-facing category | Stable category ID | Definition |
| --- | --- | --- | --- |
| 1 | Suits | `suit` | Western tailored jacket-and-trouser looks, including black tie and three-piece looks. |
| 2 | Sherwanis | `sherwani` | Long ceremonial South Asian coat looks, normally paired with a coordinated lower garment. |
| 3 | Bandhgalas | `bandhgala` | Structured closed-neck formal jackets, generally shorter than an achkan and worn with trousers. |
| 4 | Nehru Jackets | `nehru-jacket` | Sleeveless or jacket-style band-collar layers intended as a versatile Indian-formal upper garment. |
| 5 | Kurta Sets | `kurta-set` | Coordinated kurta-and-lower looks, including everyday and ceremonial styles. |
| 6 | Indo-Western | `indo-western` | Contemporary formal looks that combine Indian construction cues with Western tailoring. |
| 7 | Achkans | `achkan` | Long, clean-lined closed-neck formal coats; visually and structurally distinct from the shorter Bandhgala. |

### Explicit terminology rules

- Use **Bandhgala** in the customer interface. `Jodhpuri` may be a search/metadata synonym, but is not a separate Level 1 category.
- Use **Achkan** as a separate category because its long coat length and silhouette are visually distinct.
- Use **Kurta Sets**, not “Kurtas,” because the customer is selecting a complete visual look rather than an isolated upper garment.
- Do not display “Coat / Blazer,” “Shirt,” “Waistcoat,” “Trousers,” “Men’s Pajama,” “Shoes,” or “Turban” as top-level customer categories in Level 1. Those can be components of a curated design, or return in the future expert configurator.
- This catalogue is exclusively for **men’s bespoke clothing**. No women’s taxonomy or designs are permitted.

## 3. Design-card contract

Every design card has two layers of information:

### Customer-facing layer

- Category
- Design name
- Short description (two to four words)
- Customer intent / ideal use
- One consistent catalogue image

### Internal layer

- Stable internal design ID
- Version
- Category ID
- Structured silhouette and construction specification
- Linked lower garment rule
- Optional integrated accessory guidance
- Blueprint reference-image set
- Server-only prompt fragments and negative constraints
- Active status and sort order

Customers must never see server prompts, model names, hidden construction constraints, reference URLs, or internal IDs.

## 4. Canonical catalogue-image standard

Every approved card image must use the same visual system:

- **Subject:** identical headless male mannequin or minimal neck form; no human face.
- **Pose:** upright, front-facing, neutral, arms naturally at the sides.
- **Framing:** full body, centred, shoes visible, same camera distance and scale.
- **Aspect ratio:** portrait 4:5.
- **Background:** warm ivory/beige studio background; subtle tonal gradient permitted.
- **Lighting:** soft, consistent studio lighting with restrained, consistent shadows.
- **Content:** only the garment design may change from card to card.
- **Forbidden:** text, watermark, logo, UI, props, scenery, fashion pose, visible designer branding.

Catalogue images are design references. The finished generation must apply the **customer’s fabric image** to the selected design whenever a garment surface is visible.

## 5. Stable ID convention

IDs are immutable once a design is released. Rename customer-facing copy without changing the ID.

```text
L1-<CATEGORY>-<DESIGN>-V1
```

Examples:

```text
L1-SUIT-CLASSIC-V1
L1-SHERWANI-REGAL-V1
L1-INDO-WESTERN-ASYMMETRIC-V1
```

`V1` is the design blueprint version, not the application version. A materially different construction gets a new ID/version and preserves historic-generation records.

## 6. Approved catalogue

### 6.1 Suits

| Order | Customer-facing name | Short description | Customer intent | Internal ID | Internal blueprint summary |
| --- | --- | --- | --- | --- | --- |
| 1 | Classic | Timeless everyday elegance | Business meetings, refined daywear, first bespoke suit. | `L1-SUIT-CLASSIC-V1` | Single-breasted, two-button jacket; notch lapel; tailored regular silhouette; flap pockets; matching flat-front trousers. |
| 2 | Tuxedo | Formal evening distinction | Black-tie weddings, receptions, gala evenings. | `L1-SUIT-TUXEDO-V1` | Dinner suit; single-button jacket; satin shawl or peak lapel defined by the canonical image; formal matching trousers. |
| 3 | Statement | Confident occasion tailoring | Engagements, celebrations, fashion-forward formal events. | `L1-SUIT-STATEMENT-V1` | Contemporary single-breasted suit; sharper silhouette; prominent but controlled construction details; matching trousers. |
| 4 | Double-Breasted | Strong and commanding | Executive occasions, formal daytime weddings, confident style. | `L1-SUIT-DOUBLE-BREASTED-V1` | Double-breasted jacket; six-by-two button arrangement; peak lapels; structured silhouette; matching trousers. |
| 5 | Three-Piece | Complete formal look | Weddings, important ceremonies, elevated business formality. | `L1-SUIT-THREE-PIECE-V1` | Single-breasted jacket, matching waistcoat, and matching trousers; formal layered construction. |

### 6.2 Sherwanis

| Order | Customer-facing name | Short description | Customer intent | Internal ID | Internal blueprint summary |
| --- | --- | --- | --- | --- | --- |
| 1 | Classic | Timeless wedding elegance | Traditional weddings and family ceremonies. | `L1-SHERWANI-CLASSIC-V1` | Knee-length straight sherwani; band collar; centred front closure; restrained formal proportions. |
| 2 | Regal | Grand ceremonial presence | Groom looks, receptions, and high-formality celebrations. | `L1-SHERWANI-REGAL-V1` | Long ceremonial sherwani; defined collar and placket; richer trim/embellishment zones only if supported by fabric. |
| 3 | Minimal | Clean modern ceremony | Understated weddings and elegant formal gatherings. | `L1-SHERWANI-MINIMAL-V1` | Clean long sherwani; minimal visible trim; precise closures; contemporary restrained silhouette. |
| 4 | Embroidered | Rich crafted detail | Sangeet, festive celebrations, and groomwear. | `L1-SHERWANI-EMBROIDERED-V1` | Formal sherwani with reserved embroidery placement zones; actual motif/ornament must follow provided fabric/outfit evidence, never be invented. |
| 5 | Angrakha | Wrapped ceremonial style | Distinctive traditional wedding or cultural attire. | `L1-SHERWANI-ANGRAKHA-V1` | Cross-over/overlap front construction; band collar; long ceremonial line; coordinated lower garment. |

### 6.3 Bandhgalas

| Order | Customer-facing name | Short description | Customer intent | Internal ID | Internal blueprint summary |
| --- | --- | --- | --- | --- | --- |
| 1 | Classic | Refined closed-neck tailoring | Receptions, formal dinners, and polished Indian formalwear. | `L1-BANDHGALA-CLASSIC-V1` | Hip-to-mid-thigh bandhgala; structured band collar; centred front closures; tailored trousers. |
| 2 | Minimal | Quiet modern refinement | Elegant daytime events and understated formal dressing. | `L1-BANDHGALA-MINIMAL-V1` | Clean bandhgala with minimal surface detail; sharp seam lines; concealed or restrained closures. |
| 3 | Double-Breasted | Formal structured presence | High-formality evenings and commanding celebration looks. | `L1-BANDHGALA-DOUBLE-BREASTED-V1` | Overlapping double-breasted bandhgala front; structured shoulder; tailored trousers. |
| 4 | Ceremonial | Elevated festive tailoring | Engagements, receptions, and special family functions. | `L1-BANDHGALA-CEREMONIAL-V1` | Bandhgala with defined ceremonial button/trim placement; fabric remains authoritative for surface finish. |
| 5 | Textured | Subtle material character | Events where the fabric itself is the focal point. | `L1-BANDHGALA-TEXTURED-V1` | Clean silhouette with broad uninterrupted fabric areas; no invented embroidery or contrasting material. |

### 6.4 Nehru Jackets

| Order | Customer-facing name | Short description | Customer intent | Internal ID | Internal blueprint summary |
| --- | --- | --- | --- | --- | --- |
| 1 | Classic | Versatile Indian formal | Festive lunches, cultural events, and versatile occasionwear. | `L1-NEHRU-JACKET-CLASSIC-V1` | Traditional sleeveless Nehru jacket; band collar; centred buttons; paired kurta/trouser base specified by blueprint. |
| 2 | Short | Clean contemporary layer | Modern festive wear and casual formal events. | `L1-NEHRU-JACKET-SHORT-V1` | Shorter waist-to-hip Nehru layer; straight hem; compact tailored proportions. |
| 3 | Long | Elegant extended line | Taller formal silhouette for daytime ceremonies. | `L1-NEHRU-JACKET-LONG-V1` | Extended-length Nehru jacket; band collar; longer straight line over coordinated lower garment. |
| 4 | Textured | Fabric-led statement | When weave, texture, or subtle pattern is central. | `L1-NEHRU-JACKET-TEXTURED-V1` | Minimal construction with an uninterrupted front to present uploaded fabric accurately. |
| 5 | Festive | Celebratory finishing layer | Diwali, Mehendi, family festivities, and celebratory styling. | `L1-NEHRU-JACKET-FESTIVE-V1` | Traditional Nehru construction with optional restrained contrast/trim zones only when supported by inputs. |

### 6.5 Kurta Sets

| Order | Customer-facing name | Short description | Customer intent | Internal ID | Internal blueprint summary |
| --- | --- | --- | --- | --- | --- |
| 1 | Classic | Effortless traditional elegance | Everyday celebrations, family events, and cultural wear. | `L1-KURTA-SET-CLASSIC-V1` | Straight kurta; regular placket; side slits; coordinated men’s pajama or slim trouser. |
| 2 | Pathani | Relaxed confident tradition | Casual gatherings and relaxed festive wear. | `L1-KURTA-SET-PATHANI-V1` | Pathani-inspired longer kurta; relaxed shoulder and sleeve; simple front; coordinated lower. |
| 3 | Straight | Clean tailored simplicity | Modern daytime occasions and understated formal dressing. | `L1-KURTA-SET-STRAIGHT-V1` | Clean straight-cut kurta; minimal placket; controlled side slits; narrow coordinated lower. |
| 4 | Asymmetric | Contemporary festive edge | Celebrations where a modern silhouette is desired. | `L1-KURTA-SET-ASYMMETRIC-V1` | Asymmetric hem or front overlap according to canonical blueprint; coordinated lower garment. |
| 5 | Ceremonial | Elevated traditional occasionwear | Engagements, festive ceremonies, and family portraits. | `L1-KURTA-SET-CEREMONIAL-V1` | Formal kurta set with carefully defined placket/collar proportions; fabric supplies all surface character. |

### 6.6 Indo-Western

| Order | Customer-facing name | Short description | Customer intent | Internal ID | Internal blueprint summary |
| --- | --- | --- | --- | --- | --- |
| 1 | Classic | Modern Indian formal | Receptions and polished contemporary formalwear. | `L1-INDO-WESTERN-CLASSIC-V1` | Straight tailored Indo-Western jacket; band-collar/structured neckline; coordinated slim lower. |
| 2 | Asymmetric | Contemporary statement tailoring | Fashion-forward receptions and evening celebrations. | `L1-INDO-WESTERN-ASYMMETRIC-V1` | Deliberate asymmetric front or closure line; structured silhouette; coordinated trousers. |
| 3 | Draped | Soft ceremonial movement | Sangeet, destination events, and expressive celebrationwear. | `L1-INDO-WESTERN-DRAPED-V1` | Structured main garment with controlled drape layer; no duplicated fabric or invented accessories. |
| 4 | Layered | Rich modern composition | Reception and groom-adjacent event dressing. | `L1-INDO-WESTERN-LAYERED-V1` | Intentional multi-layer design with one coherent outer silhouette and coordinated lower garment. |
| 5 | Statement | Bold occasion presence | High-impact celebrations and editorial eveningwear. | `L1-INDO-WESTERN-STATEMENT-V1` | Sharp contemporary construction with focal silhouette details defined by canonical design reference. |

### 6.7 Achkans

| Order | Customer-facing name | Short description | Customer intent | Internal ID | Internal blueprint summary |
| --- | --- | --- | --- | --- | --- |
| 1 | Classic | Long formal elegance | Weddings, receptions, and traditional formal events. | `L1-ACHKAN-CLASSIC-V1` | Long straight achkan; closed band collar; centred front closure; tailored trouser or churidar lower. |
| 2 | Long Line | Refined ceremonial length | Tall, elongated presentation for formal portraits and ceremonies. | `L1-ACHKAN-LONG-LINE-V1` | Extended long-line achkan with uninterrupted vertical silhouette and precise collar. |
| 3 | Minimal | Quiet ceremonial refinement | Understated high-formality occasions. | `L1-ACHKAN-MINIMAL-V1` | Clean, minimally decorated long achkan; fabric-led character; restrained closures. |
| 4 | Embroidered | Crafted celebratory detail | Groomwear, receptions, and prominent celebration looks. | `L1-ACHKAN-EMBROIDERED-V1` | Long achkan with designated embellishment zones; only render ornament that is visibly supported by supplied material/outfit evidence. |
| 5 | Regal | Grand traditional presence | Major wedding moments and high-ceremony portraits. | `L1-ACHKAN-REGAL-V1` | Strong long ceremonial silhouette; defined neckline, buttons, and formal proportion. |

## 7. Level 1 accessory policy

Level 1 removes separate accessory configuration from the main customer journey.

- **Default:** preserve the customer’s existing footwear and do not add a turban.
- A catalogue design may define a *recommended presentation*, but recommendation is not an automatic addition.
- Turbans, shoes, brooches, kalgis, pocket squares, and other accessories return only in the future expert workflow or in a later, deliberately simple optional finishing step.
- The generator must never invent accessories merely because a catalogue card or design name appears formal.

## 8. Minimum structured record shape (for later implementation)

The eventual database/catalogue record must represent the source of truth as structured data, not a freeform prompt:

```ts
type Level1CatalogueDesign = {
  id: string; // e.g. L1-SUIT-CLASSIC-V1
  catalogueVersion: 1;
  categoryId: string;
  status: "draft" | "approved" | "active" | "retired";
  sortOrder: number;
  customer: {
    name: string;
    shortDescription: string;
    intent: string;
  };
  blueprint: {
    garmentFamily: string;
    silhouette: string[];
    construction: Record<string, string | string[]>;
    lowerGarmentRule: string;
    accessoryRule: "preserve-existing" | "none" | "future-optional";
  };
  references: {
    displayImageId: string;
    generationReferenceImageIds: string[];
  };
  generation: {
    promptFragments: string[];
    negativeConstraints: string[];
    visualPriority: "high";
  };
};
```

The browser will send only the selected `id`. The server must resolve all blueprint data, reference images, and prompt instructions from trusted catalogue storage.

## 9. Generation rules implied by this specification

For every Level 1 generation, the server-side compiler must state:

- The uploaded customer is the only identity and pose authority.
- The selected design is construction and silhouette authority only.
- The uploaded fabric is surface/material authority only.
- Keep the customer’s face, body proportions, hair, hands, pose, camera viewpoint, lighting, and background unchanged unless minimal garment reconstruction requires otherwise.
- Do not copy a person, face, scene, colour, pattern, or fabric from a catalogue reference.
- Do not invent embroidery, accessories, contrasting material, or garment pieces unsupported by the selected design and supplied images.
- Create luxury menswear only.

## 10. Catalogue management and lifecycle rules

1. New designs begin as `draft`; they are not visible to customers or eligible for generation.
2. Nasir Bespoke approves the exact image, name, description, intent, and blueprint before it becomes `active`.
3. Do not overwrite an existing active blueprint if a construction materially changes. Create a new versioned ID.
4. Retired designs remain resolvable for historical generations, but are hidden from new selections.
5. Reference assets require source/provenance metadata during the prototype stage. Official Nasir Bespoke assets should replace prototype references before a public-facing catalogue is considered.
6. Proprietary official catalogue references should be stored privately and served through authorized access, not as open static public files.

## 11. Explicitly deferred from Level 1

- Suit configuration dropdowns and 30–40 parameter tailoring controls.
- Separate lower-garment selectors.
- Separate shoe and turban selectors.
- Fabric inventory or customer account systems.
- Measurements, fit guarantees, order management, or body scanning.
- Four-view or 3D rendering.
- Customer-authored AI prompts.

The existing advanced configurator remains a future expert-system foundation. It must not appear in the Level 1 customer route.

## 12. Acceptance criteria before coding begins

The implementation is ready to start only when each design has:

- an approved canonical mannequin image meeting Section 4;
- an approved internal blueprint matching this document;
- a source/provenance record for its prototype asset, or a private official-asset record;
- a server-resolvable stable ID;
- clear prompt mapping that separates customer, blueprint, and fabric authority;
- an active/retired lifecycle state;
- a visual QA sign-off that it is visibly distinct from the other four designs in its category.

---

## Decision record

This document finalizes the Level 1 product taxonomy and card content. It does **not** approve implementation, asset generation, a database migration, catalogue-image sourcing, UI changes, or production deployment.
