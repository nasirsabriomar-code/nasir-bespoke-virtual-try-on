"use client";

import type { DetailCrop } from "@/lib/tryon/fabric-guidance";

const BOX_FIELDS: readonly (keyof DetailCrop)[] = ["x", "y", "width", "height"];

export function clampRegionBox(
  region: DetailCrop,
  field: keyof DetailCrop,
  next: number,
): DetailCrop {
  const box = { ...region, [field]: next };
  box.width = Math.min(box.width, 1 - box.x);
  box.height = Math.min(box.height, 1 - box.y);
  return box;
}

export function RegionBoxSliders({
  value,
  onChange,
  labels,
}: {
  value: DetailCrop;
  onChange: (next: DetailCrop) => void;
  labels: Record<keyof DetailCrop, string>;
}) {
  return (
    <>
      {BOX_FIELDS.map((field) => (
        <label key={field}>
          {labels[field]}: {Math.round(value[field] * 100)}%{" "}
          <input
            type="range"
            min={field === "x" || field === "y" ? 0 : 0.05}
            max={
              field === "x"
                ? 1 - value.width
                : field === "y"
                  ? 1 - value.height
                  : field === "width"
                    ? 1 - value.x
                    : 1 - value.y
            }
            step="0.01"
            value={value[field]}
            onChange={(event) => onChange(clampRegionBox(value, field, Number(event.target.value)))}
          />
        </label>
      ))}
    </>
  );
}
