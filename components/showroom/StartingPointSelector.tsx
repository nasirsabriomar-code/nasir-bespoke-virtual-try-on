"use client";

type StartingPointSelectorProps = {
  onSelectSignatureLooks: () => void;
  onSelectManual: () => void;
};

export function StartingPointSelector({ onSelectSignatureLooks, onSelectManual }: StartingPointSelectorProps) {
  return (
    <section className="showroom-starting-point" aria-label="Choose your starting point">
      <div className="level1-step-heading">
        <span aria-hidden="true">✦</span>
        <div>
          <p className="eyebrow">Starting Point</p>
          <h2>How would you like to begin?</h2>
        </div>
      </div>

      <div
        className="showroom-starting-point-grid"
        role="radiogroup"
        aria-label="Starting point: Signature Looks or Build Manually"
      >
        <button type="button" className="showroom-starting-point-card" onClick={onSelectSignatureLooks}>
          <span className="showroom-starting-point-title">Signature Looks</span>
          <span className="showroom-starting-point-desc">
            Begin from a curated Nasir Bespoke look, matched to your occasion and style.
          </span>
        </button>
        <button type="button" className="showroom-starting-point-card" onClick={onSelectManual}>
          <span className="showroom-starting-point-title">Build Manually</span>
          <span className="showroom-starting-point-desc">
            Start from a blank recipe and choose every component yourself.
          </span>
        </button>
      </div>
    </section>
  );
}
