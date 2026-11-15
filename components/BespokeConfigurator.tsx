"use client";

import { useEffect, useMemo } from "react";
import { VisualOptionCard } from "@/components/VisualOptionCard";
import type { ConfigurationGroup, ConfigurationOption, ConfigurationProfile } from "@/lib/catalog/types";
import { isGroupVisible, matchesRules } from "@/lib/rules/engine";

type Props = {
  profile: ConfigurationProfile;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
};

const SECTION_ORDER: ConfigurationGroup["section"][] = ["composition", "jacket", "lapels", "pockets", "sleeves", "waistcoat", "trousers", "shoes", "turban"];
const SECTION_LABEL: Record<ConfigurationGroup["section"], string> = {
  composition: "Suit composition", jacket: "Jacket", lapels: "Lapels", pockets: "Pockets", sleeves: "Sleeves", waistcoat: "Waistcoat", trousers: "Trousers", shoes: "Shoes", turban: "Turban",
};

function visible(group: ConfigurationGroup, value: Record<string, string>) {
  return isGroupVisible(group.visibleWhen, value);
}

function allowed(option: ConfigurationOption, value: Record<string, string>) {
  return (
    (!option.requires?.length || matchesRules(value, option.requires)) &&
    !(option.conflictsWith?.length && matchesRules(value, option.conflictsWith))
  );
}

function recordsEqual(a: Record<string, string>, b: Record<string, string>) {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((key) => a[key] === b[key]);
}

function normalize(profile: ConfigurationProfile, current: Record<string, string>) {
  const next: Record<string, string> = {};
  for (const group of [...profile.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!visible(group, next)) continue;
    const candidate = group.options.find((option) => option.id === current[group.id] && option.active && allowed(option, next));
    if (candidate) next[group.id] = candidate.id;
  }
  return next;
}

function unlockedGroups(profile: ConfigurationProfile, value: Record<string, string>) {
  const groups: ConfigurationGroup[] = [];
  const selections = normalize(profile, value);
  for (const group of [...profile.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!visible(group, selections)) continue;
    groups.push(group);
    if (group.required && !selections[group.id]) break;
  }
  return groups;
}

export function isBespokeConfigurationComplete(profile: ConfigurationProfile, value: Record<string, string>) {
  const selections = normalize(profile, value);
  return profile.groups
    .filter((group) => visible(group, selections))
    .every((group) => !group.required || Boolean(selections[group.id]));
}

export function BespokeConfigurator({ profile, value, onChange, disabled = false }: Props) {
  const normalized = useMemo(() => normalize(profile, value), [profile, value]);

  useEffect(() => {
    if (!recordsEqual(value, normalized)) onChange(normalized);
  }, [normalized, onChange, value]);

  const availableGroups = useMemo(() => unlockedGroups(profile, normalized), [normalized, profile]);
  const groupsBySection = useMemo(() => SECTION_ORDER.map((section) => ({
    section,
    groups: availableGroups.filter((group) => group.section === section),
  })).filter(({ groups }) => groups.length), [availableGroups]);

  function select(groupId: string, optionId: string) {
    onChange(normalize(profile, { ...normalized, [groupId]: optionId }));
  }

  const summary = profile.groups
    .filter((group) => visible(group, normalized) && normalized[group.id])
    .map((group) => ({ group, option: group.options.find((item) => item.id === normalized[group.id]) }))
    .filter((item): item is { group: ConfigurationGroup; option: ConfigurationOption } => Boolean(item.option));

  return (
    <section className="bespoke-configurator" aria-label="Suit configuration">
      <div className="catalog-subheading"><p className="catalog-eyebrow">BESPOKE CONFIGURATION</p><h3>Configure this suit</h3></div>
      <p className="bespoke-intro">Choose the visible tailoring details. Sections open progressively so the configuration stays easy to review.</p>
      {groupsBySection.map(({ section, groups }, index) => (
        <details className="bespoke-section" key={section} open={index === groupsBySection.length - 1 || index < 1}>
          <summary>{SECTION_LABEL[section]} <span>{groups.length} choices</span></summary>
          <div className="bespoke-section-body">
            {groups.map((group) => {
              const options = group.options.filter((option) => option.active && allowed(option, normalized));
              return (
                <div className="bespoke-group" key={group.id}>
                  <div className="bespoke-group-heading"><h4>{group.name}</h4><p>{group.description}</p></div>
                  <div className="visual-option-grid bespoke-option-grid">
                    {options.map((option) => <VisualOptionCard key={option.id} id={option.id} name={option.name} description={option.description} imagePath={option.thumbnail.path} selected={normalized[group.id] === option.id} disabled={disabled} onSelect={() => select(group.id, option.id)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
      <div className="bespoke-live-summary" aria-live="polite">
        <p className="catalog-eyebrow">YOUR BESPOKE LOOK</p>
        <div>{summary.map(({ group, option }) => <span key={group.id}><b>{group.name}:</b> {option.name}</span>)}</div>
      </div>
    </section>
  );
}
