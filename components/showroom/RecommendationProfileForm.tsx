"use client";

import { useState } from "react";
import type { FormalityLevel, RecommendationProfile, ShowroomOccasion, StylePersonality } from "@/lib/showroom/types";

type RecommendationProfileFormProps = {
  initialProfile: RecommendationProfile | null;
  onSubmit: (profile: RecommendationProfile) => void;
  onBack: () => void;
};

const OCCASION_OPTIONS: { value: ShowroomOccasion; label: string }[] = [
  { value: "business", label: "Business" },
  { value: "wedding", label: "Wedding" },
  { value: "reception", label: "Reception" },
  { value: "black-tie", label: "Black Tie" },
  { value: "formal-evening", label: "Formal Evening" },
  { value: "celebration", label: "Celebration" },
];

const STYLE_OPTIONS: { value: StylePersonality; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "executive", label: "Executive" },
  { value: "minimal", label: "Minimal" },
  { value: "black-tie", label: "Black Tie" },
  { value: "modern-statement", label: "Modern Statement" },
];

const FORMALITY_OPTIONS: { value: FormalityLevel; label: string }[] = [
  { value: 1, label: "1 — Relaxed" },
  { value: 2, label: "2 — Smart Casual" },
  { value: 3, label: "3 — Business" },
  { value: 4, label: "4 — Formal" },
  { value: 5, label: "5 — Black Tie" },
];

export function RecommendationProfileForm({ initialProfile, onSubmit, onBack }: RecommendationProfileFormProps) {
  const [occasion, setOccasion] = useState<ShowroomOccasion>(initialProfile?.occasion ?? "business");
  const [stylePersonality, setStylePersonality] = useState<StylePersonality>(initialProfile?.stylePersonality ?? "classic");
  const [formality, setFormality] = useState<FormalityLevel>(initialProfile?.formality ?? 3);

  return (
    <section className="showroom-profile-form" aria-label="Tell us about the occasion">
      <div className="level1-step-heading">
        <span aria-hidden="true">✦</span>
        <div>
          <p className="eyebrow">Signature Looks</p>
          <h2>Tell us about the occasion</h2>
        </div>
      </div>

      <div className="showroom-profile-fields">
        <label className="showroom-profile-field">
          <span>What are you dressing for?</span>
          <select value={occasion} onChange={(event) => setOccasion(event.target.value as ShowroomOccasion)}>
            {OCCASION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="showroom-profile-field">
          <span>Which style direction do you prefer?</span>
          <select
            value={stylePersonality}
            onChange={(event) => setStylePersonality(event.target.value as StylePersonality)}
          >
            {STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="showroom-profile-field">
          <span>Desired formality</span>
          <select
            value={formality}
            onChange={(event) => setFormality(Number(event.target.value) as FormalityLevel)}
          >
            {FORMALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="showroom-profile-actions">
        <button type="button" className="showroom-link-button" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="showroom-cta-button"
          onClick={() => onSubmit({ occasion, stylePersonality, formality })}
        >
          Show Recommended Looks
        </button>
      </div>
    </section>
  );
}
