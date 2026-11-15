import type {
  CatalogSelection,
  ConfigurationGroup,
  ConfigurationOption,
  ConfigurationProfile,
  ReferenceImage,
  VisualizationPriority,
  VisualizationView,
} from "@/lib/catalog/types";
import { isGroupVisible, matchesRules } from "@/lib/rules/engine";

export type SubmittedBespokeConfiguration = {
  profileId: string;
  selections: Record<string, string>;
};

export type ResolvedConfigurationOption = {
  groupId: string;
  groupName: string;
  section: ConfigurationGroup["section"];
  option: ConfigurationOption;
};

export type ResolvedBespokeConfiguration = {
  profile: ConfigurationProfile;
  selections: Record<string, string>;
  options: ResolvedConfigurationOption[];
};

export type OutfitSpecification = {
  version: 1;
  targetView: VisualizationView;
  garment: {
    id: string;
    name: string;
    subtypeId?: string;
    subtypeName?: string;
  };
  fabric: { source: "uploaded" };
  customer: { source: "uploaded" };
  configuration: {
    profileId: string;
    selections: Record<string, string>;
    selectedOptions: Array<{
      groupId: string;
      groupName: string;
      section: ConfigurationGroup["section"];
      optionId: string;
      optionName: string;
      priority: VisualizationPriority;
      visibleIn: VisualizationView[];
    }>;
  };
};

export class BespokeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BespokeConfigurationError";
  }
}

export function parseSubmittedBespokeConfiguration(value: string): SubmittedBespokeConfiguration {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new BespokeConfigurationError("The bespoke configuration is malformed.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BespokeConfigurationError("The bespoke configuration is malformed.");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.profileId !== "string" || !record.selections || typeof record.selections !== "object" || Array.isArray(record.selections)) {
    throw new BespokeConfigurationError("The bespoke configuration is malformed.");
  }
  const selections: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record.selections as Record<string, unknown>)) {
    if (typeof entry !== "string") {
      throw new BespokeConfigurationError("The bespoke configuration is malformed.");
    }
    selections[key] = entry;
  }
  return { profileId: record.profileId, selections };
}

function groupIsVisible(group: ConfigurationGroup, selections: Record<string, string>) {
  return isGroupVisible(group.visibleWhen, selections);
}

/** Resolves only controlled option IDs; any unknown data is rejected before compilation. */
export function resolveBespokeConfiguration(
  profile: ConfigurationProfile,
  submitted: SubmittedBespokeConfiguration,
): ResolvedBespokeConfiguration {
  if (submitted.profileId !== profile.id) {
    throw new BespokeConfigurationError("The selected bespoke configuration profile is not valid for this garment.");
  }
  if (!submitted.selections || typeof submitted.selections !== "object" || Array.isArray(submitted.selections)) {
    throw new BespokeConfigurationError("The bespoke configuration is malformed.");
  }

  const allowedGroups = new Set(profile.groups.map((group) => group.id));
  for (const [groupId, optionId] of Object.entries(submitted.selections)) {
    if (!allowedGroups.has(groupId) || typeof optionId !== "string" || optionId.length > 120) {
      throw new BespokeConfigurationError("The bespoke configuration contains an invalid option.");
    }
  }

  const selections: Record<string, string> = {};
  const options: ResolvedConfigurationOption[] = [];
  for (const group of [...profile.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!groupIsVisible(group, selections)) continue;
    const optionId = submitted.selections[group.id];
    if (!optionId) {
      if (group.required) throw new BespokeConfigurationError(`Please choose ${group.name.toLowerCase()}.`);
      continue;
    }
    const selected = group.options.find((item) => item.id === optionId && item.active);
    if (!selected) throw new BespokeConfigurationError(`Please choose a valid option for ${group.name.toLowerCase()}.`);
    if (selected.requires?.length && !matchesRules(selections, selected.requires)) {
      throw new BespokeConfigurationError(`${selected.name} is not compatible with the current tailoring choices.`);
    }
    if (selected.conflictsWith?.length && matchesRules(selections, selected.conflictsWith)) {
      throw new BespokeConfigurationError(`${selected.name} conflicts with the current tailoring choices.`);
    }
    selections[group.id] = selected.id;
    options.push({ groupId: group.id, groupName: group.name, section: group.section, option: selected });
  }
  return { profile, selections, options };
}

export function buildOutfitSpecification(
  selection: CatalogSelection,
  configuration: ResolvedBespokeConfiguration,
  targetView: VisualizationView = "full-body-front",
): OutfitSpecification {
  return {
    version: 1,
    targetView,
    garment: {
      id: selection.upper.id,
      name: selection.upper.name,
      ...(selection.subtype ? { subtypeId: selection.subtype.id, subtypeName: selection.subtype.name } : {}),
    },
    customer: { source: "uploaded" },
    fabric: { source: "uploaded" },
    configuration: {
      profileId: configuration.profile.id,
      selections: configuration.selections,
      selectedOptions: configuration.options.map(({ groupId, groupName, section, option }) => ({
        groupId,
        groupName,
        section,
        optionId: option.id,
        optionName: option.name,
        priority: option.priority,
        visibleIn: option.visibleIn,
      })),
    },
  };
}

const priorityRank: Record<VisualizationPriority, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  "non-visual": 1,
};

/** Selects a very small set of meaningful detail refs; it never submits one image per option. */
export function selectBespokeReferenceImages(configuration: ResolvedBespokeConfiguration, targetView: VisualizationView) {
  const selected: ReferenceImage[] = [];
  const seen = new Set<string>();
  const ranked = [...configuration.options]
    .filter(({ option }) => option.priority !== "non-visual" && option.visibleIn.includes(targetView))
    .sort((a, b) => priorityRank[b.option.priority] - priorityRank[a.option.priority]);
  for (const { option } of ranked) {
    if (seen.has(option.thumbnail.path)) continue;
    seen.add(option.thumbnail.path);
    selected.push(option.thumbnail);
    if (selected.length === 2) break;
  }
  return selected;
}

const sectionLabels: Record<ConfigurationGroup["section"], string> = {
  composition: "OUTFIT STRUCTURE",
  jacket: "JACKET",
  lapels: "LAPELS",
  pockets: "POCKETS",
  sleeves: "SLEEVES",
  waistcoat: "WAISTCOAT",
  trousers: "TROUSERS",
  shoes: "SHOES",
  turban: "TURBAN",
};

/** Deterministic NASIR visualization compiler; no text model participates in prompt authoring. */
export function compileVisualizationPrompt(
  basePrompt: string,
  specification: OutfitSpecification,
  configuration: ResolvedBespokeConfiguration,
) {
  const visibleOptions = configuration.options.filter(({ option }) => option.priority !== "non-visual" && option.visibleIn.includes(specification.targetView));
  const sections = Object.entries(sectionLabels).map(([section, label]) => {
    const items = visibleOptions.filter((item) => item.section === section).sort((a, b) => priorityRank[b.option.priority] - priorityRank[a.option.priority]);
    return items.length ? `${label}:\n${items.map(({ groupName, option }) => `- [${option.priority.toUpperCase()}] ${groupName}: ${option.promptFragment}`).join("\n")}` : "";
  }).filter(Boolean);
  const negatives = [...new Set(
    visibleOptions
      .filter(({ option }) => option.priority === "critical" || option.priority === "high" || option.priority === "medium")
      .sort((a, b) => priorityRank[b.option.priority] - priorityRank[a.option.priority])
      .flatMap(({ option }) => option.negativeConstraints ?? []),
  )];

  return [
    basePrompt,
    "NASIR OUTFIT VISUALIZATION COMPILER — STRUCTURED OUTFIT SPECIFICATION:",
    `Target view: ${specification.targetView}. Prioritize a full-body front view when Image 1 permits; do not change Image 1's camera or composition.`,
    "The following selected specification is authoritative for clothing construction only. Critical and high-priority visible attributes take precedence over medium and low details, without overriding identity, body, pose, camera or unaffected-scene preservation. Explicitly selected facings and embellishments are local panel exceptions, not changes to the base cloth.",
    sections.join("\n\n"),
    negatives.length ? `DO NOT CHANGE / SELECTED NEGATIVE CONSTRAINTS:\n${negatives.map((item) => `- ${item}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}
