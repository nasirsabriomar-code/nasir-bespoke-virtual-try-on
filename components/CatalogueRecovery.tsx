"use client";
import Link from "next/link";
import { useState } from "react";

export function CatalogueRecovery() {
  const [status, setStatus] = useState("Choose approved catalogue image backups.");
  const [busy, setBusy] = useState(false);
  async function restore(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    try {
      const response = await fetch("/api/catalogue-recovery", { cache: "no-store" });
      if (!response.ok) throw new Error("Sign in to restore approved references.");
      const payload = (await response.json().catch(() => ({}))) as { assets?: { id: string; checksum: string }[] };
      const assets = Array.isArray(payload.assets) ? payload.assets : [];
      let restored = 0, unmatched = 0;
      for (const file of Array.from(files)) {
        const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))]
          .map(b => b.toString(16).padStart(2, "0")).join("");
        const matches = assets.filter(a => a.checksum === hash);
        if (!matches.length) { unmatched++; continue; }
        for (const asset of matches) {
          setStatus("Restoring " + asset.id + "…");
          const result = await fetch("/api/catalogue-recovery?id=" + encodeURIComponent(asset.id), {
            method: "POST", credentials: "same-origin", body: file,
          });
          const payload = await result.json().catch(() => ({} as { error?: string }));
          if (!result.ok) throw new Error(payload.error || "Restoration failed.");
          restored++;
        }
      }
      setStatus("Restored and verified " + restored + " references. " + unmatched + " files did not match approved references.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Restoration failed."); }
    finally { setBusy(false); }
  }
  return <main className="catalogue-recovery-panel">
    <h1>Restore approved catalogue references</h1>
    <p>Only exact matches to the approved catalogue are accepted. Existing references are verified before any upload.</p>
    <label>Approved image backups <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy}
      onChange={event => void restore(event.target.files)} /></label>
    <p role="status">{status}</p>
    <Link href="/">Return to Try-On</Link>
  </main>;
}
