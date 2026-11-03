"use client";

/* eslint-disable @next/next/no-img-element -- private split catalogue photos must be requested with the session cookie. */

import { useState } from "react";
import type { Verdict } from "@/lib/rules/types";
import type { SplitComponentOptionView } from "@/lib/split-outfit/types";

type SplitComponentCardProps = {
  disabled?: boolean;
  option: SplitComponentOptionView;
  selected: boolean;
  onSelect: () => void;
  verdict?: Verdict;
  isMultiSelect?: boolean;
};

function renderPlaceholderSilhouette(categoryId: string, optionId: string) {
  if (categoryId === "upper") {
    // Upper Suit Jacket Silhouette
    return (
      <svg
        className="split-silhouette-svg"
        viewBox="0 0 120 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M38 20L60 65L82 20L98 35L108 140H12L22 35L38 20Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Lapels */}
        <path d="M38 20L54 62L60 92L66 62L82 20" stroke="currentColor" strokeWidth="1.5" />
        <path d="M38 20L48 55L32 60L54 100" stroke="currentColor" strokeWidth="1.2" />
        <path d="M82 20L72 55L88 60L66 100" stroke="currentColor" strokeWidth="1.2" />
        {/* Center line & buttons */}
        <line x1="60" y1="92" x2="60" y2="140" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="60" cy="100" r="1.5" fill="currentColor" />
        <circle cx="60" cy="115" r="1.5" fill="currentColor" />
        {/* Breast pocket */}
        <line x1="38" y1="70" x2="48" y2="68" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }

  if (categoryId === "lower") {
    // Trousers Silhouette
    return (
      <svg
        className="split-silhouette-svg"
        viewBox="0 0 120 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M30 15H90V25L84 140H66L60 70L54 140H36L30 25V15Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Waistband & Creases */}
        <line x1="30" y1="25" x2="90" y2="25" stroke="currentColor" strokeWidth="1.5" />
        <line x1="45" y1="30" x2="48" y2="135" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="75" y1="30" x2="72" y2="135" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
    );
  }

  if (categoryId === "inner-shirt") {
    // Shirt Collar Silhouette
    return (
      <svg
        className="split-silhouette-svg"
        viewBox="0 0 120 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M25 45L42 20L60 40L78 20L95 45L100 135H20L25 45Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M42 20L60 55L78 20" stroke="currentColor" strokeWidth="1.5" />
        <line x1="60" y1="55" x2="60" y2="135" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="60" cy="75" r="1.5" fill="currentColor" />
        <circle cx="60" cy="95" r="1.5" fill="currentColor" />
        <circle cx="60" cy="115" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  if (categoryId === "inner-waistcoat") {
    // Waistcoat Silhouette
    if (optionId === "SUIT_WAISTCOAT_NONE") {
      return (
        <svg
          className="split-silhouette-svg"
          viewBox="0 0 120 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="60" cy="75" r="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
          <line x1="42" y1="57" x2="78" y2="93" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    }
    return (
      <svg
        className="split-silhouette-svg"
        viewBox="0 0 120 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M40 25L60 70L80 25L94 40L88 125L60 140L32 125L26 40L40 25Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <line x1="60" y1="70" x2="60" y2="140" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="60" cy="80" r="1.5" fill="currentColor" />
        <circle cx="60" cy="95" r="1.5" fill="currentColor" />
        <circle cx="60" cy="110" r="1.5" fill="currentColor" />
        <circle cx="60" cy="125" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  if (categoryId === "footwear") {
    // Shoe Silhouette
    return (
      <svg
        className="split-silhouette-svg"
        viewBox="0 0 120 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M15 95C25 80 45 75 60 75C75 75 90 85 105 85C110 85 112 95 105 100L95 105L85 105L30 105C20 105 15 100 15 95Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M20 95H100V105H20V95Z" fill="currentColor" fillOpacity="0.1" />
        <line x1="20" y1="105" x2="35" y2="105" stroke="currentColor" strokeWidth="3" />
        <line x1="60" y1="80" x2="70" y2="92" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    );
  }

  // Accessories Silhouette
  return (
    <svg
      className="split-silhouette-svg"
      viewBox="0 0 120 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M60 30L68 50L60 125L52 50L60 30Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="30" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function SplitComponentCard({
  option,
  disabled = false,
  selected,
  onSelect,
  verdict,
  isMultiSelect = false,
}: SplitComponentCardProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const isRecommended = verdict?.status === "recommended";
  const isDiscouraged = verdict?.status === "discouraged";
  const reason = verdict?.status === "recommended" || verdict?.status === "discouraged" ? verdict.reason : undefined;
  const showPhoto = option.reference?.status === "active" && option.reference.url && !photoFailed;
  const hasDetails = Boolean(option.customer.description) || Boolean(option.customer.details?.length);

  return (
    <div className={`split-component-card ${selected ? "is-selected" : ""} ${isRecommended ? "is-recommended" : ""} ${isDiscouraged ? "is-discouraged" : ""}`}>
      <button
        type="button"
        className="split-card-select"
        disabled={disabled}
        role={isMultiSelect ? "checkbox" : "radio"}
        aria-checked={selected}
        title={reason}
        onClick={onSelect}
      >
        <div className="split-card-media">
          {showPhoto ? (
            <img
              className="split-card-photo"
              src={option.reference!.url}
              alt=""
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            // A missing or failed reference shows the drawn silhouette, never alt text over an empty box.
            <div className="split-card-silhouette-wrap">
              {renderPlaceholderSilhouette(option.categoryId, option.id)}
            </div>
          )}
        </div>

        <div className="split-card-body">
          <div className="split-card-header">
            <div className="split-card-title-group">
              <strong className="split-card-name">{option.customer.name}</strong>
              {option.customer.subtitle ? (
                <span className="split-card-subtitle">{option.customer.subtitle}</span>
              ) : null}
            </div>

            <div className="split-card-status-indicators">
              {isRecommended ? (
                <span className="split-tag split-tag-recommended">Recommended</span>
              ) : isDiscouraged ? (
                <span className="split-tag split-tag-discouraged">Unusual</span>
              ) : null}

              <span className={`split-select-indicator ${isMultiSelect ? "is-checkbox" : "is-radio"}`} aria-hidden="true">
                {selected ? "✓" : ""}
              </span>
            </div>
          </div>
        </div>
      </button>

      {hasDetails ? (
        // Outside the select button so opening Details never changes the selection.
        <details className="split-card-more">
          <summary>Details</summary>
          {option.customer.description ? <p className="split-card-desc">{option.customer.description}</p> : null}
          {option.customer.details && option.customer.details.length > 0 ? (
            <ul className="split-card-details" aria-label="Key specifications">
              {option.customer.details.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
