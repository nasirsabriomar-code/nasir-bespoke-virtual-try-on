"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { GenerationState } from "@/components/GenerationState";
import { ImageUpload } from "@/components/ImageUpload";
import { Level1Catalogue } from "@/components/Level1Catalogue";
import { LogoutButton } from "@/components/LogoutButton";
import { TryOnResult } from "@/components/TryOnResult";
import { UsageHistory } from "@/components/UsageHistory";
import { ModeSelector } from "@/components/split-outfit/ModeSelector";
import { SplitOutfitWorkspace } from "@/components/split-outfit/SplitOutfitWorkspace";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";
import type { SplitOutfitState, VisualTryOnMode } from "@/lib/split-outfit/types";
import type { Level1CatalogueView } from "@/lib/catalog/level1-types";
import type { FabricRegion } from "@/lib/catalog/level1-prompt";

type UploadedImage = {
  file: File;
  previewUrl: string;
};

type UploadRole = "person" | "fabric" | "lowerFabric";

type TryOnAppProps = {
  displayName: string;
};

const MAX_CLIENT_FILE_SIZE = 50 * 1024 * 1024;
const DIRECT_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const UPLOAD_HELP = {
  person: {
    label: "Customer photo",
    description: "Photograph or upload the customer.",
    guidance: "Use a clear, well-lit, full-body photograph where possible.",
  },
  fabric: {
    label: "Fabric",
    description: "Photograph or upload the fabric to visualize.",
    guidance: "Capture the colour, pattern, texture, and finish clearly.",
  },
  lowerFabric: {
    label: "Lower fabric",
    description: "Photograph or upload the fabric for the lower garment.",
    guidance: "Capture the colour, pattern, texture, and finish clearly.",
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readResponseError(payload: unknown, fallback: string) {
  return isRecord(payload) && typeof payload.error === "string" ? payload.error : fallback;
}

function isLevel1CatalogueView(value: unknown): value is Level1CatalogueView {
  if (!isRecord(value)) return false;
  return Array.isArray(value.categories) && Array.isArray(value.designs);
}

async function prepareImage(file: File): Promise<File> {
  if (file.size > MAX_CLIENT_FILE_SIZE) throw new Error("This image is too large. Please choose an image under 50 MB.");
  if (!DIRECT_UPLOAD_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Please upload a JPG, PNG, or WebP image. HEIC photos must be exported first to preserve the original model input.");
  }
  return file;
}

type UploadSlotResponse = { id: string; pathname: string };
type GenerationResponse = { generationId: string; resultUrl: string; originalUrl: string; metadata?: { reportedSize?: string; outputWidth?: number; outputHeight?: number } };

async function uploadOriginal(role: UploadRole, file: File, onProgress: (progress: number) => void) {
  const slotResponse = await fetch("/api/try-on/uploads", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, filename: file.name, contentType: file.type, bytes: file.size }),
  });
  const slotPayload = await slotResponse.json().catch(() => ({})) as UploadSlotResponse & { error?: string };
  if (!slotResponse.ok || !slotPayload.id || !slotPayload.pathname) throw new Error(slotPayload.error || "We couldn't prepare this upload.");
  await upload(slotPayload.pathname, file, {
    access: "private", handleUploadUrl: `/api/try-on/uploads/${encodeURIComponent(slotPayload.id)}`,
    multipart: file.size > 5 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  });
  const completeResponse = await fetch(`/api/try-on/uploads/${encodeURIComponent(slotPayload.id)}/complete`, {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  const completePayload = await completeResponse.json().catch(() => ({})) as { error?: string };
  if (!completeResponse.ok) throw new Error(completePayload.error || "We couldn't validate this upload.");
  return slotPayload.id;
}

function getClientDeviceHint() {
  if (typeof navigator === "undefined") return "unknown";
  const userAgent = navigator.userAgent;
  const isIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (isIPad || /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "tablet";
  if (/Mobile|iPhone|iPod|Android/i.test(userAgent)) return "phone";
  return "desktop";
}

export function TryOnApp({ displayName }: TryOnAppProps) {
  const [person, setPerson] = useState<UploadedImage | null>(null);
  const [fabric, setFabric] = useState<UploadedImage | null>(null);
  const [lowerFabric, setLowerFabric] = useState<UploadedImage | null>(null);
  const [mode, setMode] = useState<VisualTryOnMode>("full");
  const [splitOutfit, setSplitOutfit] = useState<SplitOutfitState>(DEFAULT_SPLIT_OUTFIT_STATE);
  // Split Outfit is now a visible Phase 1 workspace. Its generation action
  // remains intentionally disabled until the multi-part compiler is ready.
  const splitOutfitEnabled = true;
  const [catalogue, setCatalogue] = useState<Level1CatalogueView | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("suit");
  const [designId, setDesignId] = useState<string | null>(null);
  const [designVariantId, setDesignVariantId] = useState<string | null>(null);
  const [fabricRegion, setFabricRegion] = useState<FabricRegion>("both");
  const [reuseFabricForLower, setReuseFabricForLower] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [originalResultUrl, setOriginalResultUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const objectUrls = useRef(new Set<string>());
  const generationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetch("/api/level1-catalog", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(readResponseError(payload, "We couldn't load the catalogue."));
        if (!isLevel1CatalogueView(payload)) {
          throw new Error("We couldn't load the catalogue.");
        }
        return payload;
      })
      .then((nextCatalogue) => {
        if (!active) return;
        setCatalogue(nextCatalogue);
        const suitCategory = nextCatalogue.categories.find((category) => category.id === "suit");
        const firstCategory = suitCategory ?? nextCatalogue.categories[0];
        if (firstCategory) setCategoryId(firstCategory.id);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setCatalogueError(loadError instanceof Error ? loadError.message : "We couldn't load the catalogue.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  const revokeUrl = useCallback((url: string | null | undefined) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  }, []);

  const clearResult = useCallback(() => {
    setResultUrl((current) => {
      revokeUrl(current);
      return null;
    });
    setOriginalResultUrl(null);
    setOutputSize(null);
  }, [revokeUrl]);

  const selectedDesign = useMemo(
    () => catalogue?.designs.find((design) => design.id === designId) ?? null,
    [catalogue, designId],
  );
  const selectedVariant = useMemo(
    () => selectedDesign?.variants?.find((variant) => variant.id === designVariantId) ?? null,
    [designVariantId, selectedDesign],
  );
  const selectedReferenceReady = selectedDesign?.generation.state === "ready" && (!selectedVariant || selectedVariant.generation.state === "ready");
  const isJacketCategory = categoryId === "jackets";

  const changeImage = useCallback(async (role: UploadRole, file: File) => {
    setError(null);
    try {
      const prepared = await prepareImage(file);
      const previewUrl = URL.createObjectURL(prepared);
      objectUrls.current.add(previewUrl);
      if (role === "person") {
        setPerson((current) => {
          revokeUrl(current?.previewUrl);
          return { file: prepared, previewUrl };
        });
      } else if (role === "fabric") {
        setFabric((current) => {
          revokeUrl(current?.previewUrl);
          return { file: prepared, previewUrl };
        });
      } else {
        setLowerFabric((current) => {
          revokeUrl(current?.previewUrl);
          return { file: prepared, previewUrl };
        });
      }
      clearResult();
    } catch (selectionError: unknown) {
      setError(selectionError instanceof Error ? selectionError.message : "We couldn't prepare this image. Please choose another one.");
    }
  }, [clearResult, revokeUrl]);

  const removeImage = useCallback((role: UploadRole) => {
    setError(null);
    clearResult();

    if (role === "person") {
      setPerson((current) => {
        revokeUrl(current?.previewUrl);
        return null;
      });
      return;
    }

    if (role === "fabric") {
      setFabric((current) => {
        revokeUrl(current?.previewUrl);
        return null;
      });
    } else {
      setLowerFabric((current) => {
        revokeUrl(current?.previewUrl);
        return null;
      });
    }
  }, [clearResult, revokeUrl]);

  const generate = useCallback(async () => {
    if (mode === "split") {
      if (!person || !fabric) {
        setError("Add a customer photo and fabric to generate.");
        return;
      }
    } else {
      if (!person || !fabric || !selectedDesign || !selectedReferenceReady) {
        setError("Add a customer photo and fabric, then choose an approved design to generate.");
        return;
      }
      if (fabricRegion === "custom" && !reuseFabricForLower && !lowerFabric) {
        setError("Add a lower fabric or choose to reuse the upper fabric for both regions.");
        return;
      }
    }

    if (generationKeyRef.current) return;

    setError(null);
    setIsGenerating(true);
    clearResult();

    let timeout: number | null = null;
    try {
      const idempotencyKey = crypto.randomUUID();
      generationKeyRef.current = idempotencyKey;
      const controller = new AbortController();
      timeout = window.setTimeout(() => controller.abort(), 285_000);
      setUploadProgress(0);
      const personUpload = await uploadOriginal("person", person.file, setUploadProgress);
      const fabricUpload = await uploadOriginal("fabric", fabric.file, setUploadProgress);
      const lowerFabricUpload = mode === "full" && fabricRegion === "custom" && !reuseFabricForLower && lowerFabric
        ? await uploadOriginal("lowerFabric", lowerFabric.file, setUploadProgress)
        : undefined;
      setUploadProgress(100);
      const requestBody = mode === "split"
        ? {
          selectionMode: "split" as const,
          splitRecipe: JSON.stringify(splitOutfit),
          fabricRegion,
          uploads: { person: personUpload, fabric: fabricUpload },
        }
        : selectedDesign
          ? {
            selectionMode: "level1" as const, categoryId, designId: selectedDesign.id,
            ...(designVariantId ? { variantId: designVariantId } : {}),
            fabricRegion: isJacketCategory ? "jacket" : fabricRegion === "custom" && reuseFabricForLower ? "both" : fabricRegion,
            uploads: { person: personUpload, fabric: fabricUpload, ...(lowerFabricUpload ? { lowerFabric: lowerFabricUpload } : {}) },
          }
          : null;
      if (!requestBody) throw new Error("We couldn't create the try-on. Please try again.");
      const response = await fetch("/api/try-on", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Nasir-Device": getClientDeviceHint(), "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      timeout = null;
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => ({}));
        throw new Error(readResponseError(payload, "We couldn't create the try-on. Please try again."));
      }
      const payload = await response.json().catch(() => ({})) as GenerationResponse;
      if (!payload.resultUrl || !payload.originalUrl) throw new Error("We couldn't create the try-on. Please try again.");
      const nextResultUrl = payload.resultUrl;
      setResultUrl(() => {
        return nextResultUrl;
      });
      setOriginalResultUrl(payload.originalUrl);
      setOutputSize(payload.metadata?.outputWidth && payload.metadata?.outputHeight
        ? `${payload.metadata.outputWidth}×${payload.metadata.outputHeight}`
        : payload.metadata?.reportedSize ?? null);
    } catch (generationError: unknown) {
      setError(
        generationError instanceof DOMException && generationError.name === "AbortError"
          ? "The generation took too long. Please try again."
          : generationError instanceof Error
            ? generationError.message
            : "We couldn't create the try-on. Please try again.",
      );
    } finally {
      if (timeout !== null) window.clearTimeout(timeout);
      generationKeyRef.current = null;
      setUploadProgress(null);
      setIsGenerating(false);
    }
  }, [categoryId, clearResult, designVariantId, fabric, fabricRegion, isJacketCategory, lowerFabric, mode, person, reuseFabricForLower, selectedDesign, selectedReferenceReady, splitOutfit]);

  const startOver = useCallback(() => {
    setError(null);
    clearResult();
    setDesignId(null);
    setDesignVariantId(null);
    setFabricRegion(isJacketCategory ? "jacket" : "both");
    setReuseFabricForLower(false);
    setPerson((current) => {
      revokeUrl(current?.previewUrl);
      return null;
    });
    setFabric((current) => {
      revokeUrl(current?.previewUrl);
      return null;
    });
    setLowerFabric((current) => {
      revokeUrl(current?.previewUrl);
      return null;
    });
  }, [clearResult, isJacketCategory, revokeUrl]);

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
          <span className="atelier-nav-link is-active"><span aria-hidden="true">✦</span>New Creation</span>
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
      <section className="atelier-hero" aria-labelledby="try-on-title">
        <p className="eyebrow">Nasir Bespoke</p>
        <h1 id="try-on-title">Simple Visual Try-On</h1>
        <p className="atelier-intro">Choose the look you love. We handle the complexity.</p>
      </section>

      <section className="level1-flow" aria-label="Create a visual try-on">
        <div className="level1-step-heading">
          <span>01</span>
          <div>
            <p className="eyebrow">Customer</p>
            <h2>Your references</h2>
          </div>
        </div>
        <div className="level1-upload-grid">
          <ImageUpload
            id="customer-photo"
            label={UPLOAD_HELP.person.label}
            description={UPLOAD_HELP.person.description}
            guidance={UPLOAD_HELP.person.guidance}
            file={person?.file ?? null}
            previewUrl={person?.previewUrl ?? null}
            onSelect={(file) => void changeImage("person", file)}
            onRemove={() => removeImage("person")}
            disabled={isGenerating}
          />
          <ImageUpload
            id="fabric-photo"
            label={isJacketCategory ? "Jacket fabric" : fabricRegion === "custom" ? "Upper fabric" : UPLOAD_HELP.fabric.label}
            description={UPLOAD_HELP.fabric.description}
            guidance={UPLOAD_HELP.fabric.guidance}
            file={fabric?.file ?? null}
            previewUrl={fabric?.previewUrl ?? null}
            onSelect={(file) => void changeImage("fabric", file)}
            onRemove={() => removeImage("fabric")}
            disabled={isGenerating}
          />
          {!isJacketCategory && mode === "full" && fabricRegion === "custom" ? (
            <ImageUpload
              id="lower-fabric-photo"
              label={UPLOAD_HELP.lowerFabric.label}
              description={UPLOAD_HELP.lowerFabric.description}
              guidance={UPLOAD_HELP.lowerFabric.guidance}
              file={lowerFabric?.file ?? null}
              previewUrl={lowerFabric?.previewUrl ?? null}
              onSelect={(file) => void changeImage("lowerFabric", file)}
              onRemove={() => removeImage("lowerFabric")}
              disabled={isGenerating || reuseFabricForLower}
            />
          ) : null}
        </div>
        {!isJacketCategory ? <div
          className="comparison-toggle fabric-region-toggle"
          role="radiogroup"
          aria-label="Apply fabric colour to"
        >
          <button
            type="button"
            role="radio"
            aria-checked={fabricRegion === "upper"}
            className={fabricRegion === "upper" ? "is-active" : ""}
            onClick={() => setFabricRegion("upper")}
            disabled={isGenerating}
          >
            Upper Only
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={fabricRegion === "lower"}
            className={fabricRegion === "lower" ? "is-active" : ""}
            onClick={() => setFabricRegion("lower")}
            disabled={isGenerating}
          >
            Lower Only
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={fabricRegion === "both"}
            className={fabricRegion === "both" ? "is-active" : ""}
            onClick={() => setFabricRegion("both")}
            disabled={isGenerating}
          >
            Both
          </button>
          {mode === "full" ? (
            <button
              type="button"
              role="radio"
              aria-checked={fabricRegion === "custom"}
              className={fabricRegion === "custom" ? "is-active" : ""}
              onClick={() => setFabricRegion("custom")}
              disabled={isGenerating}
            >
              Customization
            </button>
          ) : null}
        </div> : null}
        {!isJacketCategory && fabricRegion === "custom" ? (
          <label className="fabric-reuse-toggle">
            <input
              type="checkbox"
              checked={reuseFabricForLower}
              onChange={(event) => setReuseFabricForLower(event.target.checked)}
              disabled={isGenerating}
            />
            <span>Use upper fabric for lower garment too</span>
          </label>
        ) : null}
        <p className="privacy-note">Studio quality: medium effort · full-resolution originals · private PNG master.</p>
      </section>

      {splitOutfitEnabled ? (
        <ModeSelector
          mode={mode}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            if (nextMode === "split") {
              // "custom" and "jacket" are Full Outfit-only fabric modes; Split
              // Outfit only ever accepts upper/lower/both.
              setFabricRegion((current) => (current === "custom" || current === "jacket" ? "both" : current));
              setReuseFabricForLower(false);
              setLowerFabric((current) => {
                revokeUrl(current?.previewUrl);
                return null;
              });
            }
            clearResult();
            setError(null);
          }}
        />
      ) : null}

      {mode === "full" ? (
        <>
          <section className="level1-flow" aria-label="Choose a curated design">
            <div className="level1-step-heading">
              <span>02</span>
              <div>
                <p className="eyebrow">Catalogue</p>
                <h2>Choose the look</h2>
              </div>
            </div>
            {catalogueError ? <p className="form-error" role="alert">{catalogueError}</p> : null}
            {catalogue ? (
              <Level1Catalogue
                catalogue={catalogue}
                categoryId={categoryId}
                designId={designId}
                designVariantId={designVariantId}
                onCategoryChange={(nextCategoryId) => {
                  setCategoryId(nextCategoryId);
                  setDesignId(null);
                  setDesignVariantId(null);
                  setFabricRegion(nextCategoryId === "jackets" ? "jacket" : "both");
                  setReuseFabricForLower(false);
                  if (nextCategoryId === "jackets") {
                    setLowerFabric((current) => {
                      revokeUrl(current?.previewUrl);
                      return null;
                    });
                  }
                  clearResult();
                  setError(null);
                }}
                onDesignChange={(nextDesignId, nextVariantId) => {
                  setDesignId(nextDesignId);
                  setDesignVariantId(nextVariantId ?? null);
                  clearResult();
                  setError(null);
                }}
              />
            ) : !catalogueError ? <p className="catalogue-loading">Preparing the curated catalogue…</p> : null}
          </section>

          <section className="level1-review" aria-label="Review your selection">
            <div>
              <p className="eyebrow">03 · Review</p>
              <h2>Your selected look</h2>
              <p className="level1-review-copy">
                {selectedDesign
                  ? `${selectedDesign.name}${selectedVariant ? ` — ${selectedVariant.name}` : ""} — ${selectedDesign.description}`
                  : "Choose a curated design to continue."}
              </p>
            </div>
            <button
              className="button button-primary level1-generate"
              type="button"
              onClick={generate}
              disabled={isGenerating || !person || !fabric || !selectedDesign || !selectedReferenceReady}
            >
              {isGenerating ? "Constructing your look…" : "Generate Try-On"}
            </button>
          </section>

          {selectedDesign?.generation.state === "awaiting-approved-reference" ? (
            <p className="level1-pending-note" role="status">
              This design is ready for review. Generation unlocks when its approved private catalogue reference is added.
            </p>
          ) : null}
        </>
      ) : (
        <SplitOutfitWorkspace
          state={splitOutfit}
          onChange={setSplitOutfit}
          onGenerate={generate}
          isGenerating={isGenerating}
        />
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {uploadProgress !== null ? <p className="privacy-note" role="status">Preserving original quality… {uploadProgress}% uploaded.</p> : null}

      {isGenerating ? <GenerationState /> : null}

      {resultUrl && originalResultUrl ? (
        <TryOnResult
          resultUrl={resultUrl}
          originalUrl={originalResultUrl}
          outputSize={outputSize ?? undefined}
          summary={{
            garment: selectedDesign?.name ?? "Curated Suit",
            fabric: "Uploaded fabric",
            turban: "None",
            shoes: "Keep Existing",
          }}
          onRegenerate={generate}
          onReset={startOver}
          isGenerating={isGenerating}
        />
      ) : null}

      <p className="privacy-note">Photos are used only to create your try-on. AI visualization; actual garment fit may vary.</p>
      </section>
    </main>
  );
}
