import type { ConfigurationGroup, ConfigurationOption, ConfigurationProfile, ReferenceImage, VisualizationPriority } from "@/lib/catalog/types";

const source = (id: string, path: string, alt: string, sourceUrl: string, license: string, attribution: string): ReferenceImage => ({
  id, path, alt, sourceUrl, license, attribution,
});

// These controlled, locally hosted prototype references are real menswear photographs.
// They are intentionally data, rather than UI imports, so Nasir photography can replace
// them later without changing the configuration engine.
const refs = {
  suit: source("config-suit", "/catalog/suit.jpg", "Men's tailored suit", "https://commons.wikimedia.org/wiki/File:19th_Century_Men%27s_Suit.jpg", "CC0 1.0", "The Metropolitan Museum of Art via Wikimedia Commons"),
  doubleBreasted: source("config-double-breasted", "/catalog/style-double-breasted-suit.jpg", "Men's double-breasted suit", "https://commons.wikimedia.org/wiki/File:StateLibQld_2_148563_Man_wearing_a_double-breasted_suit_and_felt_hat,_Brisbane,_1940-1950.jpg", "Public domain", "State Library of Queensland via Wikimedia Commons"),
  tuxedo: source("config-tuxedo", "/catalog/style-tuxedo.jpg", "Men's tuxedo", "https://commons.wikimedia.org/wiki/File:Man_wearing_black_tie_(cropped).jpg", "CC BY-SA 4.0", "KoeppiK via Wikimedia Commons"),
  waistcoat: source("config-waistcoat", "/catalog/three-piece-suit.jpg", "Men's three-piece suit and waistcoat", "https://commons.wikimedia.org/wiki/File:Navy_Blue_Wool_Suit_Owned_by_Charles_Lindbergh_-_DPLA_-_cc6e6858c24caa5d512acbe845f0534c_(page_66).jpg", "Public domain / Wikimedia Commons", "Missouri Historical Society via Wikimedia Commons"),
  trousers: source("config-trousers", "/catalog/mens-trousers.jpg", "Men's tailored trousers", "https://commons.wikimedia.org/wiki/File:Men%27s_Black_Wool_Trousers.jpg", "CC BY-SA 4.0", "Wikimedia Commons contributor"),
  oxford: source("config-oxford", "/catalog/oxford-shoe.jpg", "Men's Oxford shoe", "https://commons.wikimedia.org/wiki/File:Oxford_shoe1.jpg", "CC BY-SA 3.0", "Kan8eDie via Wikimedia Commons"),
  derby: source("config-derby", "/catalog/derby-shoe.jpg", "Men's Derby shoe", "https://commons.wikimedia.org/wiki/File:Oxford_shoes_-_Introduction_and_History.jpg", "CC BY 2.0", "Robert Sheie via Wikimedia Commons"),
  mojari: source("config-mojari", "/catalog/mojari.jpg", "Men's Mojari shoe", "https://commons.wikimedia.org/wiki/Category:Jutti", "Wikimedia Commons category reference", "Wikimedia Commons"),
  turban: source("config-turban", "/catalog/turban.jpg", "Men's ceremonial turban", "https://commons.wikimedia.org/wiki/File:Man_with_beard_and_turban,_Rajasthan,_India.jpg", "CC BY-SA 4.0", "Yann Forget via Wikimedia Commons"),
};

type OptionInput = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  negative?: string[];
  reference?: ReferenceImage;
  priority?: VisualizationPriority;
  requires?: ConfigurationOption["requires"];
  conflictsWith?: ConfigurationOption["conflictsWith"];
};

const option = ({ id, name, description, prompt, negative, reference = refs.suit, priority = "medium", requires, conflictsWith }: OptionInput): ConfigurationOption => ({
  id,
  name,
  description,
  thumbnail: reference,
  promptFragment: prompt,
  negativeConstraints: negative,
  priority,
  visibleIn: priority === "non-visual" ? [] : ["full-body-front", "front", "three-quarter"],
  ...(requires ? { requires } : {}),
  ...(conflictsWith ? { conflictsWith } : {}),
  active: true,
  sortOrder: 0,
});

const group = (id: string, name: string, description: string, section: ConfigurationGroup["section"], required: boolean, defaultOptionId: string | undefined, options: ConfigurationOption[], visibleWhen?: ConfigurationGroup["visibleWhen"]): ConfigurationGroup => ({
  id, name, description, section, required, ...(defaultOptionId ? { defaultOptionId } : {}), ...(visibleWhen ? { visibleWhen } : {}), options: options.map((item, index) => ({ ...item, sortOrder: index + 1 })), sortOrder: 0,
});

const threePieceOnly = [{ groupId: "suit-composition", optionIds: ["suit-three-piece"] }];
const singleBreastedOnly = [{ groupId: "jacket-closure", optionIds: ["single-breasted"] }];
const doubleBreastedOnly = [{ groupId: "jacket-closure", optionIds: ["double-breasted"] }];
const pleatedOnly = [{ groupId: "trouser-pleats", optionIds: ["single-pleat", "double-pleat"] }];
const selectedShoesOnly = [{ groupId: "shoe-family", optionIds: ["shoes-oxford", "shoes-derby", "shoes-loafer", "shoes-monk", "shoes-brogue", "shoes-mojari", "shoes-jutti"] }];
const selectedTurbanOnly = [{ groupId: "turban-family", optionIds: ["turban-safa"] }];

const groups: ConfigurationGroup[] = [
  group("suit-composition", "Suit composition", "Choose the visible pieces of the suit.", "composition", true, "suit-two-piece", [
    option({ id: "suit-two-piece", name: "Two-Piece Suit", description: "Jacket and matching trousers.", prompt: "Two-piece suit composition: one tailored jacket and matching trousers.", reference: refs.suit, priority: "critical", negative: ["Do not add a waistcoat."] }),
    option({ id: "suit-three-piece", name: "Three-Piece Suit", description: "Jacket, waistcoat, and matching trousers.", prompt: "Three-piece suit composition: tailored jacket worn over a clearly visible matching waistcoat and matching trousers.", reference: refs.waistcoat, priority: "critical", negative: ["Do not omit the waistcoat."] }),
    option({ id: "suit-tuxedo", name: "Tuxedo / Dinner Suit", description: "Formal evening suit construction.", prompt: "Tuxedo/dinner-suit composition with eveningwear proportion and formal lapel facing.", reference: refs.tuxedo, priority: "critical" }),
  ]),
  group("jacket-closure", "Jacket closure", "Choose the jacket front architecture.", "jacket", true, "single-breasted", [
    option({ id: "single-breasted", name: "Single-Breasted", description: "Clean, one-column jacket front.", prompt: "Single-breasted jacket with one vertical button column.", reference: refs.suit, priority: "high", negative: ["Do not make the jacket double-breasted."] }),
    option({ id: "double-breasted", name: "Double-Breasted", description: "Overlapping double-front jacket.", prompt: "Double-breasted jacket with an overlapping front and two button columns.", reference: refs.doubleBreasted, priority: "high", negative: ["Do not convert the jacket to single-breasted."] }),
  ]),
  group("jacket-buttons", "Button configuration", "Visible jacket button layout.", "jacket", true, "two-button", [
    option({ id: "one-button", name: "1 Button", description: "Single-breasted one-button stance.", prompt: "One-button single-breasted closure.", reference: refs.suit, priority: "medium", requires: singleBreastedOnly }),
    option({ id: "two-button", name: "2 Button", description: "Classic two-button single-breasted closure.", prompt: "Two-button single-breasted closure.", reference: refs.suit, priority: "medium", requires: singleBreastedOnly }),
    option({ id: "three-button", name: "3 Button", description: "Formal three-button single-breasted closure.", prompt: "Three-button single-breasted closure.", reference: refs.suit, priority: "medium", requires: singleBreastedOnly }),
    option({ id: "three-roll-two", name: "3-Roll-2", description: "Soft three-button roll to two-button stance.", prompt: "Three-roll-two single-breasted button stance.", reference: refs.suit, priority: "medium", requires: singleBreastedOnly }),
    option({ id: "four-by-one", name: "4×1", description: "Four-button double-breasted arrangement.", prompt: "4×1 double-breasted button layout.", reference: refs.doubleBreasted, priority: "high", requires: doubleBreastedOnly }),
    option({ id: "four-by-two", name: "4×2", description: "Classic four-button double-breasted arrangement.", prompt: "4×2 double-breasted button layout.", reference: refs.doubleBreasted, priority: "high", requires: doubleBreastedOnly }),
    option({ id: "six-by-one", name: "6×1", description: "Six-button double-breasted arrangement.", prompt: "6×1 double-breasted button layout.", reference: refs.doubleBreasted, priority: "high", requires: doubleBreastedOnly }),
    option({ id: "six-by-two", name: "6×2", description: "Classic six-button double-breasted layout.", prompt: "6×2 double-breasted button layout with two fastening buttons.", reference: refs.doubleBreasted, priority: "high", requires: doubleBreastedOnly }),
  ]),
  group("jacket-fit", "Fit & silhouette", "The overall jacket shape, independent of closure.", "jacket", true, "tailored-fit", [
    option({ id: "slim-fit", name: "Slim", description: "Closer, modern tailored line.", prompt: "Slim tailored jacket silhouette with natural ease; do not alter the customer's body.", reference: refs.suit, priority: "high" }),
    option({ id: "tailored-fit", name: "Tailored", description: "Balanced bespoke contour.", prompt: "Balanced bespoke tailored silhouette with defined waist and natural drape.", reference: refs.suit, priority: "high" }),
    option({ id: "classic-fit", name: "Classic", description: "Timeless, comfortable tailoring.", prompt: "Classic suit silhouette with proportionate ease and timeless balance.", reference: refs.suit, priority: "high" }),
    option({ id: "relaxed-fit", name: "Relaxed", description: "Softer, roomier line.", prompt: "Relaxed tailored silhouette with controlled room through chest and waist.", reference: refs.suit, priority: "high" }),
  ]),
  group("jacket-length", "Jacket length", "Proportion relative to the customer's body.", "jacket", true, "regular-length", [
    option({ id: "short-length", name: "Short", description: "Slightly abbreviated jacket length.", prompt: "Short jacket length with proportionate hem placement.", priority: "medium" }),
    option({ id: "regular-length", name: "Regular", description: "Balanced conventional length.", prompt: "Regular, balanced jacket length.", priority: "medium" }),
    option({ id: "long-length", name: "Long", description: "Slightly extended jacket length.", prompt: "Long tailored jacket length with a proportionate hem.", priority: "medium" }),
  ]),
  group("shoulder-construction", "Shoulder construction", "How the shoulder line presents visually.", "jacket", true, "lightly-structured", [
    option({ id: "natural-shoulder", name: "Natural / Soft", description: "Soft, natural shoulder line.", prompt: "Natural soft shoulder with minimal padding.", priority: "high" }),
    option({ id: "lightly-structured", name: "Lightly Structured", description: "Refined, balanced shoulder.", prompt: "Lightly structured shoulder with clean tailored line.", priority: "high" }),
    option({ id: "structured-shoulder", name: "Structured", description: "Sharper, more formal shoulder.", prompt: "Structured shoulder with a crisp formal line.", priority: "high" }),
    option({ id: "roped-shoulder", name: "Roped", description: "Raised sleeve-head shoulder detail.", prompt: "Roped shoulder with a subtle raised sleeve head.", priority: "medium" }),
  ]),
  group("lapel-type", "Lapel type", "Main visual lapel architecture.", "lapels", true, "notch-lapel", [
    option({ id: "notch-lapel", name: "Notch", description: "Classic notched lapel.", prompt: "Notch lapels.", negative: ["Do not use peak or shawl lapels."], priority: "high" }),
    option({ id: "peak-lapel", name: "Peak", description: "Upward-pointing formal peak lapel.", prompt: "Peak lapels with clear upward points.", negative: ["Do not use notch or shawl lapels."], reference: refs.doubleBreasted, priority: "high" }),
    option({ id: "shawl-lapel", name: "Shawl", description: "Continuous rounded dinner-jacket lapel.", prompt: "Continuous shawl lapel collar.", negative: ["Do not use notch or peak lapels."], reference: refs.tuxedo, priority: "high" }),
  ]),
  group("lapel-width", "Lapel width", "Visual scale of the lapel.", "lapels", true, "standard-lapel", [
    option({ id: "slim-lapel", name: "Slim", description: "Narrow lapel proportion.", prompt: "Slim lapel width.", priority: "medium" }), option({ id: "standard-lapel", name: "Standard", description: "Balanced lapel proportion.", prompt: "Standard balanced lapel width.", priority: "medium" }), option({ id: "wide-lapel", name: "Wide", description: "Broader formal lapel.", prompt: "Wide formal lapels.", priority: "high" }), option({ id: "extra-wide-lapel", name: "Extra Wide", description: "Statement wide lapel.", prompt: "Extra-wide lapels, scaled naturally to the customer.", priority: "high" }),
  ]),
  group("gorge-position", "Gorge position", "Where the collar meets the lapel.", "lapels", true, "standard-gorge", [
    option({ id: "low-gorge", name: "Low", description: "Lower lapel notch/peak position.", prompt: "Low gorge position.", priority: "medium" }), option({ id: "standard-gorge", name: "Standard", description: "Balanced gorge position.", prompt: "Standard gorge position.", priority: "medium" }), option({ id: "high-gorge", name: "High", description: "Higher modern gorge position.", prompt: "High gorge position.", priority: "medium" }),
  ]),
  group("lapel-finish", "Lapel finish", "Surface treatment of the lapel.", "lapels", true, "self-fabric", [
    option({ id: "self-fabric", name: "Self Fabric", description: "Use the selected fabric throughout.", prompt: "Self-fabric lapels using the uploaded fabric.", priority: "medium" }), option({ id: "satin-finish", name: "Satin", description: "Formal satin lapel facing.", prompt: "Satin lapel facing while preserving the uploaded fabric for the jacket body.", reference: refs.tuxedo, priority: "high" }), option({ id: "grosgrain-finish", name: "Grosgrain", description: "Textured formal lapel facing.", prompt: "Grosgrain lapel facing.", reference: refs.tuxedo, priority: "medium" }), option({ id: "contrast-finish", name: "Contrast", description: "Intentional contrasting lapel finish.", prompt: "A restrained contrast lapel finish.", priority: "medium" }),
  ]),
  group("button-stance", "Button stance", "Vertical position of the fastening.", "jacket", true, "standard-stance", [
    option({ id: "low-stance", name: "Low", description: "Lower fastening point.", prompt: "Low button stance.", priority: "medium" }), option({ id: "standard-stance", name: "Standard", description: "Balanced fastening point.", prompt: "Standard button stance.", priority: "medium" }), option({ id: "high-stance", name: "High", description: "Higher fastening point.", prompt: "High button stance.", priority: "medium" }),
  ]),
  group("chest-pocket", "Chest pocket", "Visible breast pocket treatment.", "pockets", true, "welt-chest", [
    option({ id: "welt-chest", name: "Welt", description: "Classic welt breast pocket.", prompt: "Welt chest pocket.", priority: "medium" }), option({ id: "patch-chest", name: "Patch", description: "Casual patch breast pocket.", prompt: "Patch chest pocket.", priority: "medium" }),
  ]),
  group("hip-pockets", "Hip pockets", "Visible lower jacket pocket treatment.", "pockets", true, "flap-hip", [
    option({ id: "flap-hip", name: "Flap", description: "Classic flap hip pockets.", prompt: "Flap hip pockets.", priority: "high" }), option({ id: "jetted-hip", name: "Jetted", description: "Clean jetted hip pockets.", prompt: "Jetted hip pockets.", priority: "high" }), option({ id: "patch-hip", name: "Patch", description: "Visible patch pockets.", prompt: "Patch hip pockets.", priority: "high" }), option({ id: "slanted-flap", name: "Slanted Flap", description: "Angled flap pockets.", prompt: "Slanted flap hip pockets.", priority: "high" }), option({ id: "slanted-jetted", name: "Slanted Jetted", description: "Angled jetted pockets.", prompt: "Slanted jetted hip pockets.", priority: "high" }),
  ]),
  group("ticket-pocket", "Ticket pocket", "Small additional right hip pocket.", "pockets", true, "no-ticket-pocket", [
    option({ id: "no-ticket-pocket", name: "None", description: "No small ticket pocket.", prompt: "No ticket pocket.", negative: ["Do not add a ticket pocket."], priority: "low" }), option({ id: "ticket-pocket", name: "Yes", description: "Add a small ticket pocket.", prompt: "Small ticket pocket above the right hip pocket.", priority: "medium" }),
  ]),
  group("vents", "Vents", "Rear jacket vent treatment.", "jacket", true, "double-vents", [
    option({ id: "no-vent", name: "No Vent", description: "Unvented jacket back.", prompt: "No rear jacket vent.", priority: "low" }), option({ id: "single-vent", name: "Single Centre Vent", description: "One centre-back vent.", prompt: "Single centre back vent.", priority: "low" }), option({ id: "double-vents", name: "Double Side Vents", description: "Two side-back vents.", prompt: "Double side vents.", priority: "low" }),
  ]),
  group("button-material", "Jacket button material", "Visible button appearance.", "jacket", true, "matching-buttons", [
    option({ id: "matching-buttons", name: "Matching", description: "Buttons blend with the fabric.", prompt: "Matching fabric-toned buttons.", priority: "medium" }), option({ id: "horn-buttons", name: "Horn Style", description: "Natural horn-style buttons.", prompt: "Horn-style jacket buttons.", priority: "medium" }), option({ id: "mother-of-pearl", name: "Mother-of-Pearl Style", description: "Refined pearlescent buttons.", prompt: "Mother-of-pearl-style buttons.", priority: "medium" }), option({ id: "metal-buttons", name: "Metal", description: "Formal metal buttons.", prompt: "Refined metal jacket buttons.", priority: "medium" }), option({ id: "fabric-covered", name: "Fabric Covered", description: "Buttons covered in the selected fabric.", prompt: "Fabric-covered buttons using the uploaded fabric.", priority: "medium" }),
  ]),
  group("sleeve-button-count", "Sleeve button count", "Number of cuff buttons.", "sleeves", true, "four-sleeve-buttons", [
    option({ id: "three-sleeve-buttons", name: "3", description: "Three cuff buttons.", prompt: "Three sleeve cuff buttons.", priority: "medium" }), option({ id: "four-sleeve-buttons", name: "4", description: "Four cuff buttons.", prompt: "Four sleeve cuff buttons.", priority: "medium" }), option({ id: "five-sleeve-buttons", name: "5", description: "Five cuff buttons.", prompt: "Five sleeve cuff buttons.", priority: "medium" }),
  ]),
  group("sleeve-button-arrangement", "Sleeve button arrangement", "Cuff-button spacing.", "sleeves", true, "spaced-buttons", [
    option({ id: "spaced-buttons", name: "Spaced", description: "Evenly spaced cuff buttons.", prompt: "Evenly spaced sleeve buttons.", priority: "low" }), option({ id: "kissing-buttons", name: "Kissing / Stacked", description: "Overlapping cuff buttons.", prompt: "Kissing/stacked sleeve buttons.", priority: "medium" }),
  ]),
  group("sleeve-buttonholes", "Sleeve buttonholes", "Cuff construction detail.", "sleeves", true, "decorative-buttonholes", [
    option({ id: "decorative-buttonholes", name: "Decorative", description: "Non-functional decorative cuff buttonholes.", prompt: "Decorative sleeve buttonholes.", priority: "non-visual" }), option({ id: "functional-buttonholes", name: "Functional / Surgeon's Cuff", description: "Openable cuff buttonholes.", prompt: "Functional surgeon's cuff buttonholes where visible.", priority: "low" }),
  ]),
  group("buttonhole-thread", "Buttonhole thread", "Thread colour around visible buttonholes.", "sleeves", true, "matching-thread", [
    option({ id: "matching-thread", name: "Matching", description: "Thread matches fabric.", prompt: "Matching buttonhole thread.", priority: "low" }), option({ id: "contrast-thread", name: "Contrast", description: "Subtle contrasting buttonhole thread.", prompt: "Subtle contrast buttonhole thread.", priority: "low" }),
  ]),
  group("pick-stitching", "Pick stitching", "Visible edge-stitch finish.", "lapels", true, "subtle-pick-stitching", [
    option({ id: "no-pick-stitching", name: "None", description: "Clean, unstiched-looking lapel edge.", prompt: "No visible pick stitching.", priority: "low" }), option({ id: "subtle-pick-stitching", name: "Subtle", description: "Fine restrained edge stitching.", prompt: "Subtle hand-like pick stitching along visible lapel edges.", priority: "low" }), option({ id: "visible-pick-stitching", name: "Visible", description: "Clearly visible decorative edge stitching.", prompt: "Visible pick stitching along lapel and pocket edges.", priority: "medium" }),
  ]),
  group("jacket-lining", "Jacket lining", "Stored for tailoring specification; mostly hidden in front view.", "jacket", true, "full-lining", [
    option({ id: "full-lining", name: "Full", description: "Fully lined jacket interior.", prompt: "Full jacket lining stored in the specification.", priority: "non-visual" }), option({ id: "half-lining", name: "Half", description: "Partially lined jacket interior.", prompt: "Half jacket lining stored in the specification.", priority: "non-visual" }), option({ id: "unlined", name: "Unlined", description: "Unlined jacket interior.", prompt: "Unlined jacket construction stored in the specification.", priority: "non-visual" }),
  ]),
  group("waistcoat-closure", "Waistcoat closure", "Layering beneath the jacket.", "waistcoat", true, "waistcoat-single", [
    option({ id: "waistcoat-single", name: "Single-Breasted", description: "Classic single-breasted waistcoat.", prompt: "Single-breasted waistcoat under the jacket.", reference: refs.waistcoat, priority: "high" }), option({ id: "waistcoat-double", name: "Double-Breasted", description: "Overlapping waistcoat front.", prompt: "Double-breasted waistcoat under the jacket.", reference: refs.doubleBreasted, priority: "high" }),
  ], threePieceOnly),
  group("waistcoat-neck", "Waistcoat neck opening", "Visible V opening.", "waistcoat", true, "standard-v", [
    option({ id: "high-v", name: "High V", description: "Higher waistcoat V opening.", prompt: "High-V waistcoat opening.", priority: "medium" }), option({ id: "standard-v", name: "Standard V", description: "Balanced V opening.", prompt: "Standard-V waistcoat opening.", priority: "medium" }), option({ id: "deep-v", name: "Deep V", description: "Lower V opening.", prompt: "Deep-V waistcoat opening.", priority: "medium" }),
  ], threePieceOnly),
  group("waistcoat-lapel", "Waistcoat lapel", "Optional waistcoat lapel treatment.", "waistcoat", true, "waistcoat-no-lapel", [
    option({ id: "waistcoat-no-lapel", name: "None", description: "Clean waistcoat front.", prompt: "Waistcoat with no lapel.", priority: "medium" }), option({ id: "waistcoat-notch", name: "Notch", description: "Small notch-lapel waistcoat.", prompt: "Notch-lapel waistcoat.", priority: "medium" }), option({ id: "waistcoat-peak", name: "Peak", description: "Formal peak-lapel waistcoat.", prompt: "Peak-lapel waistcoat.", priority: "medium" }), option({ id: "waistcoat-shawl", name: "Shawl", description: "Rounded shawl-lapel waistcoat.", prompt: "Shawl-lapel waistcoat.", priority: "medium" }),
  ], threePieceOnly),
  group("waistcoat-buttons", "Waistcoat button count", "Visible waistcoat button line.", "waistcoat", true, "five-waistcoat-buttons", [
    option({ id: "four-waistcoat-buttons", name: "4", description: "Four waistcoat buttons.", prompt: "Four waistcoat buttons.", priority: "medium" }), option({ id: "five-waistcoat-buttons", name: "5", description: "Five waistcoat buttons.", prompt: "Five waistcoat buttons.", priority: "medium" }), option({ id: "six-waistcoat-buttons", name: "6", description: "Six waistcoat buttons.", prompt: "Six waistcoat buttons.", priority: "medium" }),
  ], threePieceOnly),
  group("waistcoat-pockets", "Waistcoat pocket count", "Visible waistcoat pocket configuration.", "waistcoat", true, "two-waistcoat-pockets", [
    option({ id: "no-waistcoat-pockets", name: "None", description: "No waistcoat pockets.", prompt: "No visible waistcoat pockets.", priority: "low" }), option({ id: "two-waistcoat-pockets", name: "Two", description: "Two waistcoat pockets.", prompt: "Two waistcoat pockets.", priority: "medium" }), option({ id: "four-waistcoat-pockets", name: "Four", description: "Four waistcoat pockets.", prompt: "Four waistcoat pockets.", priority: "medium" }),
  ], threePieceOnly),
  group("waistcoat-pocket-style", "Waistcoat pocket style", "Pocket finish.", "waistcoat", true, "welt-waistcoat-pockets", [
    option({ id: "welt-waistcoat-pockets", name: "Welt", description: "Welt waistcoat pockets.", prompt: "Welt waistcoat pockets.", priority: "low" }), option({ id: "jetted-waistcoat-pockets", name: "Jetted", description: "Jetted waistcoat pockets.", prompt: "Jetted waistcoat pockets.", priority: "low" }),
  ], threePieceOnly),
  group("waistcoat-bottom", "Waistcoat bottom", "Lower waistcoat point.", "waistcoat", true, "pointed-waistcoat", [
    option({ id: "pointed-waistcoat", name: "Pointed", description: "Pointed waistcoat hem.", prompt: "Pointed waistcoat bottom.", priority: "medium" }), option({ id: "straight-waistcoat", name: "Straight", description: "Straight waistcoat hem.", prompt: "Straight waistcoat bottom.", priority: "medium" }),
  ], threePieceOnly),
  group("waistcoat-back", "Waistcoat back", "Back material selection.", "waistcoat", true, "matching-waistcoat-back", [
    option({ id: "matching-waistcoat-back", name: "Matching Fabric", description: "Back uses suit fabric.", prompt: "Matching-fabric waistcoat back.", priority: "non-visual" }), option({ id: "lining-waistcoat-back", name: "Lining Fabric", description: "Back uses lining fabric.", prompt: "Lining-fabric waistcoat back.", priority: "non-visual" }), option({ id: "contrast-waistcoat-back", name: "Contrast", description: "Contrasting waistcoat back.", prompt: "Contrast waistcoat back where visible.", priority: "low" }),
  ], threePieceOnly),
  group("waistcoat-adjuster", "Back adjuster", "Back waistcoat adjuster detail.", "waistcoat", true, "no-waistcoat-adjuster", [
    option({ id: "no-waistcoat-adjuster", name: "None", description: "No adjuster.", prompt: "No waistcoat back adjuster.", priority: "non-visual" }), option({ id: "waistcoat-adjustable-strap", name: "Adjustable Strap", description: "Back adjustment strap.", prompt: "Waistcoat back adjustable strap.", priority: "non-visual" }),
  ], threePieceOnly),
  group("trouser-fit", "Trouser fit", "Overall trouser leg line.", "trousers", true, "tapered-trousers", [
    option({ id: "slim-trousers", name: "Slim", description: "Close trouser line.", prompt: "Slim tailored trousers.", reference: refs.trousers, priority: "high" }), option({ id: "tapered-trousers", name: "Tapered", description: "Controlled narrowing to ankle.", prompt: "Tapered tailored trousers.", reference: refs.trousers, priority: "high" }), option({ id: "straight-trousers", name: "Straight", description: "Classic straight leg.", prompt: "Straight-leg tailored trousers.", reference: refs.trousers, priority: "high" }), option({ id: "relaxed-trousers", name: "Relaxed", description: "More relaxed leg line.", prompt: "Relaxed tailored trousers.", reference: refs.trousers, priority: "high" }), option({ id: "wide-trousers", name: "Wide", description: "Wide tailored leg.", prompt: "Wide-leg tailored trousers.", reference: refs.trousers, priority: "high" }),
  ]),
  group("trouser-rise", "Trouser rise", "Position of the trouser waistband.", "trousers", true, "mid-rise", [
    option({ id: "low-rise", name: "Low", description: "Low waistband position.", prompt: "Low-rise trousers.", priority: "medium" }), option({ id: "mid-rise", name: "Mid", description: "Balanced waistband position.", prompt: "Mid-rise trousers.", priority: "medium" }), option({ id: "high-rise", name: "High", description: "High tailored waistband.", prompt: "High-rise tailored trousers.", priority: "high" }),
  ]),
  group("trouser-pleats", "Trouser pleats", "Front trouser volume.", "trousers", true, "flat-front", [
    option({ id: "flat-front", name: "Flat Front", description: "Clean flat trouser front.", prompt: "Flat-front trousers.", priority: "medium" }), option({ id: "single-pleat", name: "Single Pleat", description: "One visible front pleat.", prompt: "Single front trouser pleat.", priority: "high" }), option({ id: "double-pleat", name: "Double Pleat", description: "Two visible front pleats.", prompt: "Double front trouser pleats.", priority: "high" }),
  ]),
  group("pleat-direction", "Pleat direction", "Direction of the selected trouser pleat.", "trousers", true, "forward-pleat", [
    option({ id: "forward-pleat", name: "Forward", description: "Pleat opens toward fly.", prompt: "Forward-facing trouser pleat.", priority: "medium" }), option({ id: "reverse-pleat", name: "Reverse", description: "Pleat opens toward pocket.", prompt: "Reverse-facing trouser pleat.", priority: "medium" }),
  ], pleatedOnly),
  group("trouser-waistband", "Trouser waistband", "Waist adjustment style.", "trousers", true, "side-adjusters", [
    option({ id: "belt-loops", name: "Belt Loops", description: "Traditional belt-loop waistband.", prompt: "Trouser waistband with belt loops.", priority: "medium" }), option({ id: "side-adjusters", name: "Side Adjusters", description: "Side-tab tailored waistband.", prompt: "Trouser waistband with side adjusters.", priority: "high" }), option({ id: "plain-waistband", name: "Plain Waistband", description: "Clean plain waistband.", prompt: "Clean plain trouser waistband.", priority: "medium" }), option({ id: "brace-buttons", name: "Suspender / Brace Buttons", description: "Internal brace button preparation.", prompt: "Brace-button trouser waistband.", priority: "low" }),
  ]),
  group("trouser-closure", "Trouser waist closure", "Front waistband closure.", "trousers", true, "standard-closure", [
    option({ id: "standard-closure", name: "Standard", description: "Classic closure.", prompt: "Standard trouser waistband closure.", priority: "low" }), option({ id: "extended-tab", name: "Extended Tab", description: "Extended waistband tab.", prompt: "Extended trouser waistband tab closure.", priority: "medium" }), option({ id: "hook-bar", name: "Hook / Bar", description: "Hook-and-bar closure.", prompt: "Hook-and-bar trouser closure.", priority: "low" }),
  ]),
  group("trouser-front-pockets", "Trouser front pockets", "Visible pocket entry.", "trousers", true, "slanted-front-pockets", [
    option({ id: "slanted-front-pockets", name: "Slanted", description: "Classic slanted pockets.", prompt: "Slanted trouser front pockets.", priority: "medium" }), option({ id: "onseam-front-pockets", name: "On-Seam", description: "Pockets in side seam.", prompt: "On-seam trouser front pockets.", priority: "medium" }), option({ id: "jetted-front-pockets", name: "Jetted", description: "Jetted front pocket finish.", prompt: "Jetted trouser front pockets.", priority: "medium" }),
  ]),
  group("trouser-rear-pockets", "Trouser rear pockets", "Back pocket count.", "trousers", true, "two-rear-pockets", [
    option({ id: "no-rear-pockets", name: "None", description: "No rear pockets.", prompt: "No rear trouser pockets.", priority: "non-visual" }), option({ id: "one-rear-pocket", name: "One", description: "One rear pocket.", prompt: "One rear trouser pocket.", priority: "non-visual" }), option({ id: "two-rear-pockets", name: "Two", description: "Two rear pockets.", prompt: "Two rear trouser pockets.", priority: "non-visual" }),
  ]),
  group("trouser-rear-closure", "Rear pocket closure", "Back pocket closure detail.", "trousers", true, "open-rear-pocket", [
    option({ id: "open-rear-pocket", name: "Open", description: "Open rear pocket.", prompt: "Open rear pocket closure.", priority: "non-visual" }), option({ id: "buttoned-rear-pocket", name: "Buttoned", description: "Buttoned rear pocket.", prompt: "Buttoned rear pocket closure.", priority: "non-visual" }),
  ]),
  group("trouser-fly", "Trouser fly", "Front fly mechanism.", "trousers", true, "zip-fly", [
    option({ id: "zip-fly", name: "Zip", description: "Zip fly.", prompt: "Zip trouser fly.", priority: "non-visual" }), option({ id: "button-fly", name: "Button", description: "Button fly.", prompt: "Button trouser fly.", priority: "non-visual" }),
  ]),
  group("trouser-hem", "Trouser hem", "Visible hem finish.", "trousers", true, "plain-hem", [
    option({ id: "plain-hem", name: "Plain", description: "Plain trouser hem.", prompt: "Plain trouser hem.", priority: "medium" }), option({ id: "turn-up-hem", name: "Turn-Up / Cuff", description: "Turned-up trouser cuff.", prompt: "Turn-up/cuffed trouser hem.", priority: "medium" }),
  ]),
  group("trouser-break", "Trouser break", "How the hem rests on the shoe.", "trousers", true, "quarter-break", [
    option({ id: "no-break", name: "No Break", description: "Clean hem above shoe.", prompt: "No trouser break at the shoe.", priority: "high" }), option({ id: "quarter-break", name: "Quarter Break", description: "Minimal break.", prompt: "Quarter trouser break.", priority: "high" }), option({ id: "half-break", name: "Half Break", description: "Balanced break.", prompt: "Half trouser break.", priority: "high" }), option({ id: "full-break", name: "Full Break", description: "Deeper traditional break.", prompt: "Full trouser break.", priority: "high" }),
  ]),
  group("trouser-lining", "Trouser lining", "Stored interior construction.", "trousers", true, "knee-lining", [
    option({ id: "no-trouser-lining", name: "None", description: "Unlined trouser interior.", prompt: "No trouser lining stored in specification.", priority: "non-visual" }), option({ id: "knee-lining", name: "Knee", description: "Knee-lined trouser.", prompt: "Knee lining stored in specification.", priority: "non-visual" }), option({ id: "full-trouser-lining", name: "Full", description: "Fully lined trouser.", prompt: "Full trouser lining stored in specification.", priority: "non-visual" }),
  ]),
  group("shoe-family", "Shoe family", "Visible footwear selection.", "shoes", true, "shoes-keep-existing", [
    option({ id: "shoes-keep-existing", name: "Keep Existing", description: "Keep visible footwear unchanged.", prompt: "Keep the customer's existing footwear where visible.", reference: refs.oxford, priority: "high" }), option({ id: "shoes-oxford", name: "Oxford", description: "Formal lace-up Oxford.", prompt: "Oxford dress shoes.", reference: refs.oxford, priority: "high" }), option({ id: "shoes-derby", name: "Derby", description: "Open-laced Derby shoe.", prompt: "Derby lace-up shoes.", reference: refs.derby, priority: "high" }), option({ id: "shoes-loafer", name: "Loafer", description: "Formal slip-on loafer.", prompt: "Formal men's loafers.", reference: refs.oxford, priority: "high" }), option({ id: "shoes-monk", name: "Monk Strap", description: "Formal monk-strap shoe.", prompt: "Men's monk-strap shoes.", reference: refs.oxford, priority: "high" }), option({ id: "shoes-brogue", name: "Brogue", description: "Decorated leather brogue.", prompt: "Men's brogue dress shoes.", reference: refs.derby, priority: "high" }), option({ id: "shoes-mojari", name: "Mojari", description: "Traditional Mojari.", prompt: "Traditional men's Mojari shoes.", reference: refs.mojari, priority: "high" }), option({ id: "shoes-jutti", name: "Jutti", description: "Traditional Jutti.", prompt: "Traditional men's Jutti shoes.", reference: refs.mojari, priority: "high" }),
  ]),
  group("shoe-toe-shape", "Shoe toe shape", "Toe silhouette where applicable.", "shoes", true, "almond-toe", [
    option({ id: "round-toe", name: "Round", description: "Round toe.", prompt: "Round shoe toe.", reference: refs.oxford, priority: "medium" }), option({ id: "almond-toe", name: "Almond", description: "Almond toe.", prompt: "Almond shoe toe.", reference: refs.oxford, priority: "medium" }), option({ id: "chisel-toe", name: "Chisel", description: "Chisel toe.", prompt: "Chisel shoe toe.", reference: refs.derby, priority: "medium" }), option({ id: "square-toe", name: "Square", description: "Square toe.", prompt: "Square shoe toe.", reference: refs.derby, priority: "medium" }),
  ], selectedShoesOnly),
  group("shoe-toe-design", "Shoe toe design", "Visible toe pattern.", "shoes", true, "cap-toe", [
    option({ id: "plain-toe", name: "Plain Toe", description: "Simple unbroken toe.", prompt: "Plain-toe shoe construction.", reference: refs.oxford, priority: "medium" }), option({ id: "cap-toe", name: "Cap Toe", description: "Formal cap toe.", prompt: "Cap-toe shoe construction.", reference: refs.oxford, priority: "medium" }), option({ id: "wingtip", name: "Wingtip", description: "Wingtip brogue toe.", prompt: "Wingtip shoe toe.", reference: refs.derby, priority: "medium" }), option({ id: "wholecut", name: "Wholecut", description: "Wholecut leather upper.", prompt: "Wholecut shoe upper.", reference: refs.oxford, priority: "medium" }), option({ id: "apron-toe", name: "Apron", description: "Apron toe construction.", prompt: "Apron-toe shoe construction.", reference: refs.derby, priority: "medium" }),
  ], selectedShoesOnly),
  group("shoe-material", "Shoe material appearance", "Surface finish.", "shoes", true, "smooth-leather", [
    option({ id: "smooth-leather", name: "Smooth Leather", description: "Classic smooth leather.", prompt: "Smooth leather shoe finish.", reference: refs.oxford, priority: "medium" }), option({ id: "grain-leather", name: "Grain Leather", description: "Textured grain leather.", prompt: "Grain leather shoe finish.", reference: refs.derby, priority: "medium" }), option({ id: "suede", name: "Suede", description: "Soft suede appearance.", prompt: "Suede shoe finish.", reference: refs.derby, priority: "medium" }), option({ id: "patent", name: "Patent", description: "High-gloss patent leather.", prompt: "Patent leather shoe finish.", reference: refs.tuxedo, priority: "medium" }), option({ id: "velvet", name: "Velvet", description: "Formal velvet slipper appearance.", prompt: "Velvet formal shoe finish.", reference: refs.tuxedo, priority: "medium" }),
  ], selectedShoesOnly),
  group("shoe-colour", "Shoe colour", "Prototype shoe colour.", "shoes", true, "black-shoes", [
    option({ id: "black-shoes", name: "Black", description: "Classic black formal shoe.", prompt: "Black shoes.", reference: refs.oxford, priority: "high" }), option({ id: "brown-shoes", name: "Brown", description: "Rich brown leather.", prompt: "Brown leather shoes.", reference: refs.derby, priority: "high" }), option({ id: "oxblood-shoes", name: "Oxblood", description: "Deep oxblood leather.", prompt: "Oxblood leather shoes.", reference: refs.derby, priority: "high" }), option({ id: "tan-shoes", name: "Tan", description: "Tan leather.", prompt: "Tan leather shoes.", reference: refs.derby, priority: "high" }),
  ], selectedShoesOnly),
  group("shoe-broguing", "Broguing", "Decorative perforation level.", "shoes", true, "no-broguing", [
    option({ id: "no-broguing", name: "None", description: "No decorative perforation.", prompt: "No shoe broguing.", priority: "low" }), option({ id: "quarter-broguing", name: "Quarter", description: "Light broguing.", prompt: "Quarter broguing.", priority: "low" }), option({ id: "semi-broguing", name: "Semi", description: "Moderate broguing.", prompt: "Semi broguing.", priority: "low" }), option({ id: "full-broguing", name: "Full", description: "Full brogue detail.", prompt: "Full shoe broguing.", priority: "medium" }),
  ], selectedShoesOnly),
  group("shoe-closure", "Shoe closure", "Fastening style where applicable.", "shoes", true, "lace-closure", [
    option({ id: "lace-closure", name: "Lace", description: "Lace-up fastening.", prompt: "Lace-up shoe closure.", priority: "medium" }), option({ id: "single-monk", name: "Single Monk", description: "One monk strap.", prompt: "Single monk-strap closure.", priority: "medium" }), option({ id: "double-monk", name: "Double Monk", description: "Two monk straps.", prompt: "Double monk-strap closure.", priority: "medium" }), option({ id: "slip-on", name: "Slip-On", description: "No-lace slip-on.", prompt: "Slip-on shoe construction.", priority: "medium" }),
  ], selectedShoesOnly),
  group("shoe-sole", "Shoe sole appearance", "Visible sole edge.", "shoes", true, "leather-sole", [
    option({ id: "leather-sole", name: "Leather", description: "Leather sole edge.", prompt: "Leather shoe sole appearance.", priority: "low" }), option({ id: "rubber-sole", name: "Rubber", description: "Rubber sole edge.", prompt: "Rubber shoe sole appearance.", priority: "low" }), option({ id: "combination-sole", name: "Combination", description: "Combination sole.", prompt: "Combination shoe sole appearance.", priority: "low" }),
  ], selectedShoesOnly),
  group("turban-family", "Turban", "Optional men's headwear.", "turban", true, "turban-none", [
    option({ id: "turban-none", name: "None", description: "Keep head and hairstyle unchanged.", prompt: "No turban; preserve the customer's head and hairstyle.", reference: refs.suit, priority: "high" }), option({ id: "turban-safa", name: "Safa Turban", description: "Ceremonial men's safa.", prompt: "A refined men's ceremonial safa turban fitted naturally to the customer.", reference: refs.turban, priority: "high" }),
  ]),
  group("turban-style", "Turban style", "Overall turban wrap style.", "turban", true, "wedding-safa", [
    option({ id: "traditional-turban", name: "Traditional", description: "Traditional wrap.", prompt: "Traditional men's turban wrapping.", reference: refs.turban, priority: "medium" }), option({ id: "wedding-safa", name: "Wedding Safa", description: "Formal wedding safa.", prompt: "Wedding safa turban wrap.", reference: refs.turban, priority: "high" }), option({ id: "rajasthani-turban", name: "Rajasthani", description: "Rajasthani-inspired wrap.", prompt: "Rajasthani-inspired men's turban wrap.", reference: refs.turban, priority: "high" }), option({ id: "royal-turban", name: "Royal", description: "More sculpted royal profile.", prompt: "Royal formal turban profile.", reference: refs.turban, priority: "high" }),
  ], selectedTurbanOnly),
  group("turban-main-colour", "Turban main colour", "Primary colour.", "turban", true, "cream-turban", [
    option({ id: "cream-turban", name: "Cream", description: "Cream main colour.", prompt: "Cream turban main colour.", reference: refs.turban, priority: "high" }), option({ id: "gold-turban", name: "Gold", description: "Gold main colour.", prompt: "Gold turban main colour.", reference: refs.turban, priority: "high" }), option({ id: "maroon-turban", name: "Maroon", description: "Maroon main colour.", prompt: "Maroon turban main colour.", reference: refs.turban, priority: "high" }), option({ id: "navy-turban", name: "Navy", description: "Navy main colour.", prompt: "Navy turban main colour.", reference: refs.turban, priority: "high" }),
  ], selectedTurbanOnly),
  group("turban-secondary-colour", "Turban secondary colour", "Accent colour.", "turban", true, "no-secondary-turban", [
    option({ id: "no-secondary-turban", name: "None", description: "Single-colour turban.", prompt: "No secondary turban colour.", priority: "medium" }), option({ id: "gold-secondary", name: "Gold", description: "Gold accent.", prompt: "Gold secondary turban colour.", reference: refs.turban, priority: "medium" }), option({ id: "cream-secondary", name: "Cream", description: "Cream accent.", prompt: "Cream secondary turban colour.", reference: refs.turban, priority: "medium" }), option({ id: "maroon-secondary", name: "Maroon", description: "Maroon accent.", prompt: "Maroon secondary turban colour.", reference: refs.turban, priority: "medium" }),
  ], selectedTurbanOnly),
  group("turban-pattern", "Turban pattern", "Surface pattern.", "turban", true, "solid-turban", [
    option({ id: "solid-turban", name: "Solid", description: "Plain solid fabric.", prompt: "Solid turban fabric.", priority: "medium" }), option({ id: "bandhani-turban", name: "Bandhani", description: "Bandhani-inspired pattern.", prompt: "Bandhani-style turban pattern.", reference: refs.turban, priority: "high" }), option({ id: "stripe-turban", name: "Stripe", description: "Striped turban fabric.", prompt: "Striped turban pattern.", reference: refs.turban, priority: "high" }), option({ id: "embroidered-turban", name: "Embroidered", description: "Restrained embroidery.", prompt: "Refined embroidered turban detail.", reference: refs.turban, priority: "high" }),
  ], selectedTurbanOnly),
  group("turban-volume", "Turban volume", "Amount of wrap volume.", "turban", true, "standard-turban-volume", [
    option({ id: "low-turban-volume", name: "Low", description: "Low-volume wrap.", prompt: "Low-volume turban wrap.", priority: "medium" }), option({ id: "standard-turban-volume", name: "Standard", description: "Balanced volume.", prompt: "Standard-volume turban wrap.", priority: "medium" }), option({ id: "high-turban-volume", name: "High", description: "High-volume ceremonial wrap.", prompt: "High-volume ceremonial turban wrap.", priority: "high" }),
  ], selectedTurbanOnly),
  group("turban-height", "Turban height", "Vertical profile.", "turban", true, "medium-turban-height", [
    option({ id: "low-turban-height", name: "Low", description: "Low profile.", prompt: "Low-profile turban height.", priority: "medium" }), option({ id: "medium-turban-height", name: "Medium", description: "Balanced profile.", prompt: "Medium turban height.", priority: "medium" }), option({ id: "tall-turban-height", name: "Tall", description: "Tall ceremonial profile.", prompt: "Tall turban height.", priority: "high" }),
  ], selectedTurbanOnly),
  group("turban-border", "Turban border", "Visible border finish.", "turban", true, "plain-turban-border", [
    option({ id: "plain-turban-border", name: "Plain", description: "Plain edge.", prompt: "Plain turban border.", priority: "low" }), option({ id: "contrast-turban-border", name: "Contrast", description: "Contrast edge.", prompt: "Contrast turban border.", priority: "medium" }), option({ id: "zari-turban-border", name: "Zari Style", description: "Zari-inspired border.", prompt: "Zari-style turban border.", priority: "medium" }), option({ id: "embroidered-turban-border", name: "Embroidered", description: "Embroidered edge.", prompt: "Embroidered turban border.", priority: "medium" }),
  ], selectedTurbanOnly),
  group("turban-brooch", "Turban brooch", "Optional front brooch.", "turban", true, "no-turban-brooch", [
    option({ id: "no-turban-brooch", name: "None", description: "No brooch.", prompt: "No turban brooch.", priority: "medium" }), option({ id: "turban-brooch", name: "Present", description: "One restrained brooch.", prompt: "One refined turban brooch.", priority: "high" }),
  ], selectedTurbanOnly),
  group("turban-kalgi", "Turban kalgi", "Optional ceremonial kalgi.", "turban", true, "no-turban-kalgi", [
    option({ id: "no-turban-kalgi", name: "None", description: "No kalgi.", prompt: "No turban kalgi.", priority: "medium" }), option({ id: "turban-kalgi", name: "Present", description: "One restrained ceremonial kalgi.", prompt: "One refined ceremonial turban kalgi.", priority: "high" }),
  ], selectedTurbanOnly),
];

export const SUIT_CONFIGURATION_PROFILE: ConfigurationProfile = {
  id: "suit-bespoke-v1",
  name: "Suit Bespoke Configuration",
  garmentCategory: "suit",
  version: 1,
  groups: groups.map((item, index) => ({ ...item, sortOrder: index + 1 })),
};

export const BESPOKE_CONFIGURATION_PROFILES: ConfigurationProfile[] = [SUIT_CONFIGURATION_PROFILE];
