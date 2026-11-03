"use client";

import { clearPendingGenerations } from "@/lib/pending-generation";
import { useState } from "react";

export function LogoutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setIsSigningOut(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "We couldn't sign you out. Please try again.");
      }

      try { clearPendingGenerations(sessionStorage); const keys = Object.keys(sessionStorage).filter(key => key.startsWith("nasir-upload-v1:")); keys.forEach(key => sessionStorage.removeItem(key)); } catch { /* Storage can be unavailable in private browsing. */ }
      window.location.replace("/login");
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "We couldn't sign you out. Please try again.",
      );
      setIsSigningOut(false);
    }
  }

  return (
    <div className="logout-control">
      <button type="button" aria-label={isSigningOut ? "Signing out…" : "Log out"} onClick={handleLogout} disabled={isSigningOut}>
        {isSigningOut ? "Signing out…" : "Log out"}
      </button>
      {error ? <span className="logout-error" role="alert">{error}</span> : null}
    </div>
  );
}
