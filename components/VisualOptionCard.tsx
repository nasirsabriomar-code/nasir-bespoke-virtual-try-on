"use client";

/* eslint-disable @next/next/no-img-element -- catalog references are selected dynamically and kept local. */

type VisualOptionCardProps = {
  id: string;
  name: string;
  description?: string;
  imagePath: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

export function VisualOptionCard({ id, name, description, imagePath, selected, disabled, onSelect }: VisualOptionCardProps) {
  return (
    <button
      type="button"
      className={`visual-option-card${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      aria-label={`${name}${selected ? ", selected" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      data-option-id={id}
    >
      <span className="visual-option-image-wrap">
        <img src={imagePath} alt={name} className="visual-option-image" loading="lazy" />
        {selected ? <span className="visual-option-check" aria-hidden="true">✓</span> : null}
      </span>
      <span className="visual-option-name">{name}</span>
      {description ? <span className="visual-option-description">{description}</span> : null}
      {selected ? <span className="visual-option-selected">Selected</span> : null}
    </button>
  );
}
