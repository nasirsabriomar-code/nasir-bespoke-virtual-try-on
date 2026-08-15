"use client";

import { useEffect, useState } from "react";

const STATUS_MESSAGES = [
  "Preparing images…",
  "Fitting the garment…",
  "Rendering result…",
];

export function GenerationState() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStatusIndex((current) => (current + 1) % STATUS_MESSAGES.length);
    }, 4200);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="generation-state" role="status" aria-live="polite">
      <div className="generation-indicator" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="generation-copy">
        <strong>Constructing your look…</strong>
        <p>{STATUS_MESSAGES[statusIndex]} This can take up to two minutes.</p>
      </div>
    </div>
  );
}
