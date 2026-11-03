"use client";
import { useEffect, useState } from "react";
import { withDeadline } from "@/lib/generation-recovery";
import { REVIEW_REASONS, type GenerationReview as Review, type ReviewReason } from "@/lib/history/review-types";
const labels: Record<ReviewReason, string> = { "pattern-too-large": "Pattern too large", "pattern-too-small": "Pattern too small", "wrong-colour": "Wrong colour", "incorrect-construction": "Incorrect tailoring", "changed-background": "Background changed", "other-quality": "Other quality issue", "wrong-material": "Wrong fabric or material", "changed-customer": "Customer appearance changed" };
async function requestReview(id: string, value?: Review): Promise<Review> {
  return withDeadline(async signal => {
    const response = await fetch(`/api/history/${encodeURIComponent(id)}/review`, { method: value ? "PUT" : "GET", credentials: "same-origin", cache: "no-store", signal, ...(value ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) } : {}) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Feedback is unavailable.");
    return payload;
  }, 10000);
}
export function GenerationReview({ generationId, onSaved }: { generationId: string; onSaved?: (value: Review) => void }) {
  const [value, setValue] = useState<Review>({ decision: "unreviewed", favourite: false, reasons: [], updatedAt: "" });
  const [busy, setBusy] = useState(true);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loaded = loadedId === generationId;
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    requestReview(generationId).then(next => { if (active) { setValue(next); setLoadedId(generationId); } }).catch(() => { if (active) setMessage("Couldn't load your feedback. Reopen this result to retry."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [generationId]);
  async function save() {
    if (!loaded || busy) return;
    setBusy(true); setMessage("");
    try { const next = await requestReview(generationId, value); setValue(next); onSaved?.(next); setMessage("Your feedback is saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Feedback is unavailable."); }
    finally { setBusy(false); }
  }
  function update(next: Review) { setValue(next); setMessage("Changes not saved. Choose Save feedback to store them."); }
  return <section className="generation-review" aria-label="Your result feedback">
    <h3>Your result feedback</h3>
    <fieldset disabled={busy || !loaded}>
      <legend>How did this result turn out?</legend>
      <div role="group" aria-label="Review actions"><button type="button" aria-pressed={value.decision === "accepted"} onClick={() => update({ ...value, decision: "accepted" })}>Accept</button><button type="button" aria-pressed={value.decision === "rejected"} onClick={() => update({ ...value, decision: "rejected" })}>Needs improvement</button></div>
      <label>Decision <select value={value.decision} onChange={event => update({ ...value, decision: event.target.value as Review["decision"] })}><option value="unreviewed">Not reviewed</option><option value="accepted">Acceptable</option><option value="rejected">Needs improvement</option></select></label>
      <label><input type="checkbox" checked={value.favourite} onChange={event => update({ ...value, favourite: event.target.checked })} /> Save as favourite</label>
      {REVIEW_REASONS.map(reason => <label key={reason}><input type="checkbox" checked={value.reasons.includes(reason)} onChange={event => update({ ...value, reasons: event.target.checked ? [...value.reasons, reason] : value.reasons.filter(item => item !== reason) })} />{labels[reason]}</label>)}
      <button type="button" onClick={() => void save()}>Save feedback</button>
    </fieldset>
    <p role="status">{busy ? "Loading or saving feedback…" : message}</p>
  </section>;
}
