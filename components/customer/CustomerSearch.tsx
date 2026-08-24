"use client";

import { useState } from "react";
import type { Customer } from "@/lib/customer/types";

type CustomerSearchProps = {
  onSelectCustomer: (customer: Customer) => void;
  onSkip: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

export function CustomerSearch({ onSelectCustomer, onSkip }: CustomerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  async function runSearch(nextQuery: string) {
    setIsSearching(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers?q=${encodeURIComponent(nextQuery)}`, { credentials: "same-origin" });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't search customers."));
      const customers = isRecord(payload) && Array.isArray(payload.customers) ? (payload.customers as Customer[]) : [];
      setResults(customers);
    } catch (searchError: unknown) {
      setError(searchError instanceof Error ? searchError.message : "We couldn't search customers.");
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }

  async function createCustomer() {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email.trim().length > 0 ? email.trim() : null,
          preferences: { preferredStyles: [], preferredColours: [], preferredFit: null, preferredOccasions: [] },
        }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readResponseError(payload, "We couldn't create this customer."));
      onSelectCustomer(payload as Customer);
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "We couldn't create this customer.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="customer-search" aria-label="Find or create a customer">
      <div className="level1-step-heading">
        <span aria-hidden="true">✦</span>
        <div>
          <p className="eyebrow">Showroom Memory</p>
          <h2>Find or create a customer</h2>
        </div>
      </div>

      <div className="customer-search-row">
        <input
          type="text"
          className="customer-search-input"
          placeholder="Search by name or phone number"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void runSearch(query);
          }}
        />
        <button type="button" className="showroom-cta-button" onClick={() => void runSearch(query)} disabled={isSearching}>
          {isSearching ? "Searching…" : "Search"}
        </button>
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {results ? (
        <div className="customer-search-results">
          {results.length === 0 ? (
            <p className="split-section-intro">No customers matched. Create a new customer below.</p>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="customer-result-card"
                onClick={() => onSelectCustomer(customer)}
              >
                <span className="customer-result-name">{customer.name}</span>
                <span className="customer-result-phone">{customer.phone}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <div className="customer-search-actions">
        <button type="button" className="showroom-link-button" onClick={() => setShowCreateForm((current) => !current)}>
          {showCreateForm ? "Cancel new customer" : "+ New customer"}
        </button>
        <button type="button" className="showroom-link-button" onClick={onSkip}>
          Continue without a customer
        </button>
      </div>

      {showCreateForm ? (
        <div className="customer-create-form">
          <label className="showroom-profile-field">
            <span>Full name</span>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="showroom-profile-field">
            <span>Phone number</span>
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="showroom-profile-field">
            <span>Email (optional)</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button
            type="button"
            className="showroom-cta-button"
            onClick={() => void createCustomer()}
            disabled={isCreating || name.trim().length === 0 || phone.trim().length === 0}
          >
            {isCreating ? "Creating…" : "Create Customer"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
