"use client";
/* eslint-disable @next/next/no-img-element -- swatches are transient blob URLs or private History assets. */

import { useState } from "react";
import type { BuilderRow, BuilderStepId, RowSwatch } from "@/lib/split-outfit/builder-steps";

type Props = {
  rows: BuilderRow[];
  onSelect: (id: BuilderStepId) => void;
  flashIds: BuilderStepId[];
  disabled?: boolean;
};

function Swatch({ swatch }: { swatch: RowSwatch }) {
  if (!swatch) return <span className="builder-swatch is-empty" aria-hidden="true" />;
  if (swatch.kind === "reference") return <span className="builder-swatch is-reference" aria-hidden="true" title="Reference cloth" />;
  return <img className={`builder-swatch${swatch.kind === "linked" ? " is-linked" : ""}`} src={swatch.url} alt="" />;
}

/** Steps and outfit summary in one list: a side column on wide screens, a bar with a sheet on narrow ones. */
export function BuilderStepList({ rows, onSelect, flashIds, disabled = false }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const current = rows.find((row) => row.current) ?? rows[0];

  const list = (
    <ol className="builder-step-rows">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className={`builder-step-row${row.current ? " is-current" : ""}${row.complete ? " is-complete" : ""}${flashIds.includes(row.id) ? " is-flash" : ""}`}
            aria-current={row.current ? "step" : undefined}
            onClick={() => { onSelect(row.id); setSheetOpen(false); }}
            disabled={disabled}
          >
            <span className="builder-step-mark" aria-hidden="true">{row.complete ? "✓" : row.number}</span>
            <Swatch swatch={row.swatch} />
            <span className="builder-step-text">
              <span className="builder-step-label">{row.label}{row.complete ? <span className="visually-hidden"> (done)</span> : null}</span>
              {row.detail ? <span className="builder-step-detail">{row.detail}</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <nav className={`builder-steps${sheetOpen ? " is-sheet-open" : ""}`} aria-label="Outfit steps">
      <button
        type="button"
        className="builder-steps-bar"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen((open) => !open)}
      >
        <span>Step {current.number} of {rows.length} · {current.label}</span>
        <span className="builder-steps-bar-swatches" aria-hidden="true">
          {rows.filter((row) => row.swatch && row.swatch.kind !== "reference" && row.id !== "customer").map((row) => <Swatch key={row.id} swatch={row.swatch} />)}
        </span>
        <span aria-hidden="true">{sheetOpen ? "▴" : "▾"}</span>
      </button>
      <p className="builder-steps-title">Build the outfit</p>
      {list}
    </nav>
  );
}
