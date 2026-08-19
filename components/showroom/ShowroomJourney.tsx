"use client";

import { useCallback, useMemo, useState } from "react";
import { SplitOutfitWorkspace } from "@/components/split-outfit/SplitOutfitWorkspace";
import { applySignatureLook, deriveCustomizedFromLook } from "@/lib/showroom/look-application";
import { SIGNATURE_LOOK_LIBRARY } from "@/lib/showroom/look-library";
import { recommendSignatureLooks } from "@/lib/showroom/recommendation-engine";
import type {
  RecommendationProfile,
  ShowroomJourneyStep,
  SignatureLookProvenance,
  SignatureLookRecommendation,
} from "@/lib/showroom/types";
import type { SplitOutfitState } from "@/lib/split-outfit/types";
import { LookRecommendationList } from "./LookRecommendationList";
import { RecommendationProfileForm } from "./RecommendationProfileForm";
import { StartingPointSelector } from "./StartingPointSelector";

type ShowroomJourneyProps = {
  state: SplitOutfitState;
  onChange: (updater: (prev: SplitOutfitState) => SplitOutfitState) => void;
};

/**
 * Orchestrates the hybrid showroom journey: CUSTOMER INTENT → CURATED
 * RECOMMENDATIONS → SELECT LOOK → CUSTOMIZE (existing Split workspace) →
 * MATERIALS → REVIEW. This is not a parallel garment-state system — the
 * only thing this component owns is journey/UI state (which step is
 * showing, the declared recommendation profile, the ranked recommendations,
 * and Look provenance). The actual outfit recipe always lives in the
 * existing SplitOutfitState (`state`/`onChange`, owned by the parent
 * TryOnApp), and every mutation still flows through
 * sanitizeSplitOutfitState()/the compatibility engine exactly as before —
 * see SplitOutfitWorkspace, unchanged.
 */
export function ShowroomJourney({ state, onChange }: ShowroomJourneyProps) {
  const [journeyStep, setJourneyStep] = useState<ShowroomJourneyStep>("starting-point");
  const [profile, setProfile] = useState<RecommendationProfile | null>(null);
  const [recommendations, setRecommendations] = useState<SignatureLookRecommendation[]>([]);
  const [provenance, setProvenance] = useState<SignatureLookProvenance>({ type: "manual" });
  const [applicationError, setApplicationError] = useState<string | null>(null);

  // customizedFromLook is NEVER a manually toggled flag — it is recomputed
  // from canonical component identity comparison on every render, so it
  // cannot drift from the actual selections (see deriveCustomizedFromLook).
  const customizedFromLook = useMemo(
    () => deriveCustomizedFromLook(state, provenance, SIGNATURE_LOOK_LIBRARY),
    [state, provenance],
  );

  const startManualBuild = useCallback(() => {
    setApplicationError(null);
    setProvenance({ type: "manual" });
    setJourneyStep("workspace");
  }, []);

  const startSignatureLookIntake = useCallback(() => {
    setApplicationError(null);
    setJourneyStep("profile");
  }, []);

  const submitProfile = useCallback((nextProfile: RecommendationProfile) => {
    setProfile(nextProfile);
    setRecommendations(recommendSignatureLooks(nextProfile, SIGNATURE_LOOK_LIBRARY));
    setApplicationError(null);
    setJourneyStep("recommendations");
  }, []);

  const selectLook = useCallback(
    (lookId: string) => {
      const recommendation = recommendations.find((entry) => entry.look.id === lookId);
      if (!recommendation) return;

      // applySignatureLook is atomic: on failure, the current recipe is left
      // completely untouched (see lib/showroom/look-application.ts) — there
      // is no partial application, and the staff-friendly reason is shown
      // right where the action was taken.
      const result = applySignatureLook(recommendation.look, "suit");
      if (!result.applied) {
        setApplicationError(result.reason);
        return;
      }

      setApplicationError(null);
      onChange(() => result.state);
      setProvenance({ type: "signature-look", lookId: recommendation.look.id, lookName: recommendation.look.name });
      setJourneyStep("workspace");
    },
    [onChange, recommendations],
  );

  const changeStartingPoint = useCallback(() => {
    setApplicationError(null);
    setJourneyStep("starting-point");
  }, []);

  if (journeyStep === "starting-point") {
    return <StartingPointSelector onSelectSignatureLooks={startSignatureLookIntake} onSelectManual={startManualBuild} />;
  }

  if (journeyStep === "profile") {
    return <RecommendationProfileForm initialProfile={profile} onSubmit={submitProfile} onBack={changeStartingPoint} />;
  }

  if (journeyStep === "recommendations") {
    return (
      <LookRecommendationList
        recommendations={recommendations}
        error={applicationError}
        onSelectLook={selectLook}
        onRefineProfile={() => setJourneyStep("profile")}
        onBuildManually={startManualBuild}
      />
    );
  }

  return (
    <div className="showroom-workspace-wrap">
      <div className="showroom-provenance-toolbar">
        {provenance.type === "signature-look" ? (
          <span className="showroom-provenance-pill">
            {customizedFromLook ? "Customized from " : "Started from "}
            <strong>{provenance.lookName}</strong>
          </span>
        ) : (
          <span className="showroom-provenance-pill is-manual">Manual build</span>
        )}
        <button type="button" className="showroom-link-button" onClick={changeStartingPoint}>
          Change starting point
        </button>
      </div>
      <SplitOutfitWorkspace
        state={state}
        onChange={onChange}
        provenance={provenance}
        customizedFromLook={customizedFromLook}
      />
    </div>
  );
}
