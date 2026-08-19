"use client";

import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { UsageHistory } from "@/components/UsageHistory";
import { FabricCatalogue } from "./FabricCatalogue";

type FabricCataloguePageProps = {
  displayName: string;
};

/**
 * Atelier catalogue shell (Phase 4E). Probes PATCH on an unknown fabric id
 * to decide whether mutation controls are shown — OWNER/MANAGER get 404,
 * unauthorized roles get 403. The server still independently rejects writes.
 */
export function FabricCataloguePage({ displayName }: FabricCataloguePageProps) {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let active = true;
    async function probe() {
      const response = await fetch("/api/fabrics/00000000-0000-4000-8000-000000000000", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "probe" }),
      });
      if (!active) return;
      setCanManage(response.status === 404 || response.status === 400);
    }
    void probe();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="atelier-shell">
      <header className="atelier-mobile-header">
        <div className="atelier-mobile-brand">
          <span className="atelier-monogram" aria-hidden="true">N</span>
          <span><strong>NASIR BESPOKE</strong><small>Private atelier</small></span>
        </div>
        <div className="atelier-mobile-actions">
          <UsageHistory />
          <LogoutButton />
        </div>
      </header>
      <aside className="atelier-sidebar" aria-label="Nasir Bespoke navigation">
        <div className="atelier-sidebar-top">
          <span className="atelier-monogram" aria-hidden="true">N</span>
          <span className="atelier-brand"><strong>NASIR BESPOKE</strong><span>Private atelier</span></span>
        </div>
        <nav className="atelier-nav" aria-label="Primary navigation">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain full-page nav, consistent with /atelier. */}
          <a href="/" className="atelier-nav-link">New Creation</a>
          <a href="/atelier" className="atelier-nav-link">Atelier</a>
          <span className="atelier-nav-link is-active"><span aria-hidden="true">✦</span>Fabrics</span>
          <UsageHistory />
        </nav>
        <div className="atelier-sidebar-footer">
          <div className="atelier-user">
            <span className="user-initial" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
            <span><strong>{displayName}</strong><small>Showroom access</small></span>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <section className="atelier-main">
        <div className="atelier-dashboard-header">
          <div>
            <p className="eyebrow">Nasir Bespoke</p>
            <h1>Fabric Catalogue</h1>
          </div>
        </div>
        <FabricCatalogue canManage={canManage} />
      </section>
    </main>
  );
}
