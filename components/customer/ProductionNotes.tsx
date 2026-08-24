"use client";

import { useEffect, useState } from "react";

type ProductionNotesProps = {
  jobId: string;
};

type ProductionNote = {
  id: string;
  productionJobId: string;
  body: string;
  createdBy: string;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function readNote(value: unknown): ProductionNote | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.productionJobId !== "string" ||
    typeof value.body !== "string" ||
    typeof value.createdBy !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    productionJobId: value.productionJobId,
    body: value.body,
    createdBy: value.createdBy,
    createdAt: value.createdAt,
  };
}

/**
 * Append-only production notes for a job. Visible only when GET succeeds
 * (roles that cannot read notes get 403/404 and see nothing). Body is
 * rendered as plain text — never HTML.
 */
export function ProductionNotes({ jobId }: ProductionNotesProps) {
  const [notes, setNotes] = useState<ProductionNote[] | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      setNotes(undefined);
      try {
        const response = await fetch(`/api/production/${jobId}/notes`, { credentials: "same-origin" });
        if (!active) return;
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setNotes(null);
          return;
        }
        const payload: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(readResponseError(payload, "We couldn't load production notes."));
        const list = isRecord(payload) && Array.isArray(payload.notes)
          ? payload.notes.map(readNote).filter((note): note is ProductionNote => note !== null)
          : [];
        setNotes(list);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "We couldn't load production notes.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [jobId]);

  async function addNote() {
    const body = draft.trim();
    if (!body || notes === null || notes === undefined) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/production/${jobId}/notes`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't add this production note."));
      const created = readNote(payload) ?? (isRecord(payload) ? readNote(payload.note) : null);
      if (created) {
        setNotes((current) => (current ? [...current, created] : [created]));
      } else {
        const refresh = await fetch(`/api/production/${jobId}/notes`, { credentials: "same-origin" });
        const refreshPayload: unknown = await refresh.json().catch(() => ({}));
        if (refresh.ok && isRecord(refreshPayload) && Array.isArray(refreshPayload.notes)) {
          setNotes(refreshPayload.notes.map(readNote).filter((note): note is ProductionNote => note !== null));
        }
      }
      setDraft("");
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't add this production note.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (notes === null) return null;

  if (notes === undefined) {
    if (error) {
      return (
        <div className="order-detail-section production-notes">
          <span className="customer-profile-card-label">Production Notes</span>
          <p className="form-error" role="alert">{error}</p>
        </div>
      );
    }
    return <p className="customer-profile-empty">Loading…</p>;
  }

  return (
    <div className="order-detail-section production-notes">
      <span className="customer-profile-card-label">Production Notes</span>
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {notes.length === 0 ? (
        <p className="customer-profile-empty">No production notes yet.</p>
      ) : (
        <ul className="customer-list">
          {notes.map((note) => (
            <li key={note.id}>
              <span className="production-note-meta">{note.createdBy} — {formatDateTime(note.createdAt)}</span>
              <p className="production-note-body">{note.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="production-notes-form"
        onSubmit={(event) => {
          event.preventDefault();
          void addNote();
        }}
      >
        <textarea
          aria-label="New production note"
          value={draft}
          disabled={isSubmitting}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="showroom-cta-button" disabled={isSubmitting || draft.trim() === ""}>
          {isSubmitting ? "Adding…" : "Add Note"}
        </button>
      </form>
    </div>
  );
}
