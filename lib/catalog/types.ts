export type GarmentCategory =
  | "suit"
  | "coat-blazer"
  | "shirt"
  | "nehru-jacket"
  | "waistcoat"
  | "sherwani"
  | "indo-western"
  | "kurta"
  | "trousers"
  | "mens-pajama"
  | "no-change";

export type BlueprintPieceType = "upper" | "lower" | "complete";
export type AccessoryCategory = "turban" | "shoes";

export type ReferenceImage = {
  id: string;
  path: string;
  alt: string;
  sourceUrl: string;
  license: string;
  attribution: string;
};

export type VisualizationPriority = "critical" | "high" | "medium" | "low" | "non-visual";
export type VisualizationView = "full-body-front" | "front" | "back" | "three-quarter" | "detail";

export type OptionRule = {
  groupId: string;
  optionIds: string[];
};

export type ConfigurationOption = {
  id: string;
  name: string;
  description: string;
  thumbnail: ReferenceImage;
  additionalReferences?: ReferenceImage[];
  promptFragment: string;
  negativeConstraints?: string[];
  priority: VisualizationPriority;
  visibleIn: VisualizationView[];
  requires?: OptionRule[];
  conflictsWith?: OptionRule[];
  active: boolean;
  sortOrder: number;
};

export type ConfigurationGroup = {
  id: string;
  name: string;
  description: string;
  section: "composition" | "jacket" | "lapels" | "pockets" | "sleeves" | "waistcoat" | "trousers" | "shoes" | "turban";
  required: boolean;
  defaultOptionId?: string;
  visibleWhen?: OptionRule[];
  options: ConfigurationOption[];
  sortOrder: number;
};

export type ConfigurationProfile = {
  id: string;
  name: string;
  garmentCategory: GarmentCategory;
  version: number;
  groups: ConfigurationGroup[];
};

export type StyleOption = {
  id: string;
  name: string;
  description: string;
  displayReference: ReferenceImage;
  aiReferences: ReferenceImage[];
  promptInstruction: string;
  active: boolean;
  sortOrder: number;
};

export type GarmentBlueprint = {
  id: string;
  name: string;
  category: GarmentCategory;
  subcategory?: string;
  gender: "menswear";
  description: string;
  displayReference: ReferenceImage;
  aiReferences: ReferenceImage[];
  promptInstruction: string;
  pieceType: BlueprintPieceType;
  linkedBlueprintIds: string[];
  compatibleCategories: GarmentCategory[];
  styleOptions?: StyleOption[];
  configurationProfileId?: string;
  active: boolean;
  sortOrder: number;
};

export type Accessory = {
  id: string;
  name: string;
  category: AccessoryCategory;
  gender: "menswear";
  description: string;
  displayReference: ReferenceImage;
  aiReferences: ReferenceImage[];
  promptInstruction: string;
  styleOptions?: StyleOption[];
  active: boolean;
  sortOrder: number;
};

export type Catalog = {
  blueprints: GarmentBlueprint[];
  accessories: Accessory[];
  configurationProfiles?: ConfigurationProfile[];
};

export type TryOnSelection = {
  mode: "catalog" | "outfit";
  upperGarmentId?: string;
  lowerGarmentId?: string;
  garmentSubtypeId?: string;
  upperStyleId?: string;
  lowerStyleId?: string;
  turbanStyleId?: string;
  shoeStyleId?: string;
  turbanId?: string;
  shoeId?: string;
} | {
  mode: "level1";
  categoryId: string;
  designId: string;
  variantId?: string;
};

export type CatalogSelection = {
  upper: GarmentBlueprint;
  lower?: GarmentBlueprint;
  subtype?: GarmentBlueprint;
  upperStyle?: StyleOption;
  lowerStyle?: StyleOption;
  turbanStyle?: StyleOption;
  shoeStyle?: StyleOption;
  turban: Accessory;
  shoes: Accessory;
};
