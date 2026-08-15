"use client";

import { VisualOptionCard } from "@/components/VisualOptionCard";
import type { StyleOption } from "@/lib/catalog/types";

type StylePickerProps = {
  label: string;
  options: StyleOption[] | undefined;
  selectedId: string | null;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

export function StylePicker({ label, options, selectedId, disabled = false, onSelect }: StylePickerProps) {
  if (!options?.length) return null;

  return (
    <details className="style-picker">
      <summary>
        <span>{label}</span>
        <span>{selectedId ? "Style selected" : "Optional"}</span>
      </summary>
      <div className="visual-option-grid visual-option-grid-styles">
        {options.map((option) => (
          <VisualOptionCard
            key={option.id}
            id={option.id}
            name={option.name}
            description={option.description}
            imagePath={option.displayReference.path}
            selected={selectedId === option.id}
            disabled={disabled}
            onSelect={() => onSelect(option.id)}
          />
        ))}
      </div>
    </details>
  );
}
