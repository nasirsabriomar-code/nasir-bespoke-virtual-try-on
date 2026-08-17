"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenerationState } from "@/components/GenerationState";
import { ImageUpload } from "@/components/ImageUpload";
import { Level1Catalogue } from "@/components/Level1Catalogue";
import { LogoutButton } from "@/components/LogoutButton";
import { TryOnResult } from "@/components/TryOnResult";
import { UsageHistory } from "@/components/UsageHistory";
import { ModeSelector } from "@/components/split-outfit/ModeSelector";
import { SplitOutfitWorkspace } from "@/components/split-outfit/SplitOutfitWorkspace";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";
import { isSplitOutfitEnabled } from "@/lib/split-outfit/config";
import type { SplitOutfitState, VisualTryOnMode } from "@/lib/split-outfit/types";
import type { Level1CatalogueView } from "@/lib/catalog/level1-types";

type UploadedImage = {
  file: File;
  previewUrl: string;
};

type UploadRole = "person" | "fabric";

type TryOnAppProps = {
  displayName: string;
};

const MAX_CLIENT_FILE_SIZE = 15 * 1024 * 1024;
const MAX_API_FILE_SIZE = 1_250_000;
const MAX_IMAGE_EDGE = 2400;
const DIRECT_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

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

function hasHeicExtension(file: File) {
  return /\.(heic|heif)$/i.test(file.name);
}

function hasSupportedExtension(file: File) {
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

async function decodeImage(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (context: CanvasRenderingContext2D, width: number, height: number) => context.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  } catch {
    const sourceUrl = URL.createObjectURL(file);
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Image decode failed"));
        image.src = sourceUrl;
      });
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: (context: CanvasRenderingContext2D, width: number, height: number) => context.drawImage(image, 0, 0, width, height),
        close: () => URL.revokeObjectURL(sourceUrl),
      };
    } catch {
      URL.revokeObjectURL(sourceUrl);
      throw new Error("We couldn't prepare this photo. Please choose another image.");
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function optimizeForUpload(file: File): Promise<File> {
  if (file.size <= MAX_API_FILE_SIZE && !HEIC_TYPES.has(file.type.toLowerCase()) && !hasHeicExtension(file)) return file;

  const source = await decodeImage(file);
  try {
    let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(source.width, source.height));
    for (let sizeAttempt = 0; sizeAttempt < 5; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      source.draw(context, canvas.width, canvas.height);
      for (const quality of [0.9, 0.82, 0.74, 0.66]) {
        const webp = await canvasToBlob(canvas, "image/webp", quality);
        const blob = webp?.type === "image/webp" ? webp : await canvasToBlob(canvas, "image/jpeg", quality);
        if (blob && blob.size <= MAX_API_FILE_SIZE) {
          const extension = blob.type === "image/webp" ? "webp" : "jpg";
          return new File([blob], file.name.replace(/\.[^.]+$/, `.${extension}`), { type: blob.type, lastModified: file.lastModified });
        }
      }
      scale *= 0.82;
    }
  } finally {
    source.close();
  }
  throw new Error("We couldn't reduce this image safely. Please choose a smaller photo.");
}

async function prepareImage(file: File): Promise<File> {
  if (file.size > MAX_CLIENT_FILE_SIZE) throw new Error("This image is too large. Please choose an image under 15 MB.");
  const isHeic = HEIC_TYPES.has(file.type.toLowerCase()) || hasHeicExtension(file);
  if (!isHeic && !DIRECT_UPLOAD_TYPES.has(file.type.toLowerCase()) && !hasSupportedExtension(file)) {
    throw new Error("Please upload a JPG, PNG, WebP, or HEIC image.");
  }
  return optimizeForUpload(file);
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
  const [mode, setMode] = useState<VisualTryOnMode>("full");
  const [splitOutfit, setSplitOutfit] = useState<SplitOutfitState>(DEFAULT_SPLIT_OUTFIT_STATE);
  const [splitOutfitEnabled, setSplitOutfitEnabled] = useState(false);
  const [catalogue, setCatalogue] = useState<Level1CatalogueView | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("suit");
  const [designId, setDesignId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const objectUrls = useRef(new Set<string>());
  const generationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setSplitOutfitEnabled(isSplitOutfitEnabled());
  }, []);

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
  }, [revokeUrl]);

  const selectedDesign = useMemo(
    () => catalogue?.designs.find((design) => design.id === designId) ?? null,
    [catalogue, designId],
  );

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
      } else {
        setFabric((current) => {
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

    setFabric((current) => {
      revokeUrl(current?.previewUrl);
      return null;
    });
  }, [clearResult, revokeUrl]);

  const generate = useCallback(async () => {
    if (!person || !fabric || !selectedDesign || selectedDesign.generation.state !== "ready") {
      setError("Add a customer photo and fabric, then choose an approved design to generate.");
      return;
    }

    if (generationKeyRef.current) return;

    setError(null);
    setIsGenerating(true);
    clearResult();

    let timeout: number | null = null;
    try {
      const formData = new FormData();
      formData.set("selectionMode", "level1");
      formData.set("categoryId", categoryId);
      formData.set("designId", selectedDesign.id);
      formData.set("person", person.file);
      formData.set("fabric", fabric.file);

      const idempotencyKey = crypto.randomUUID();
      generationKeyRef.current = idempotencyKey;
      const controller = new AbortController();
      timeout = window.setTimeout(() => controller.abort(), 165_000);
      const response = await fetch("/api/try-on", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Nasir-Device": getClientDeviceHint(), "Idempotency-Key": idempotencyKey },
        body: formData,
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
      const image = await response.blob();
      if (!image.type.startsWith("image/")) throw new Error("We couldn't create the try-on. Please try again.");
      const nextResultUrl = URL.createObjectURL(image);
      objectUrls.current.add(nextResultUrl);
      setResultUrl((current) => {
        revokeUrl(current);
        return nextResultUrl;
      });
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
      setIsGenerating(false);
    }
  }, [categoryId, clearResult, fabric, person, revokeUrl, selectedDesign]);

  const startOver = useCallback(() => {
    setError(null);
    clearResult();
    setDesignId(null);
    setPerson((current) => {
      revokeUrl(current?.previewUrl);
      return null;
    });
    setFabric((current) => {
      revokeUrl(current?.previewUrl);
      return null;
    });
  }, [clearResult, revokeUrl]);

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
            label={UPLOAD_HELP.fabric.label}
            description={UPLOAD_HELP.fabric.description}
            guidance={UPLOAD_HELP.fabric.guidance}
            file={fabric?.file ?? null}
            previewUrl={fabric?.previewUrl ?? null}
            onSelect={(file) => void changeImage("fabric", file)}
            onRemove={() => removeImage("fabric")}
            disabled={isGenerating}
          />
        </div>
      </section>

      {splitOutfitEnabled ? (
        <ModeSelector
          mode={mode}
          onModeChange={(nextMode) => {
            setMode(nextMode);
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
                onCategoryChange={(nextCategoryId) => {
                  setCategoryId(nextCategoryId);
                  setDesignId(null);
                  clearResult();
                  setError(null);
                }}
                onDesignChange={(nextDesignId) => {
                  setDesignId(nextDesignId);
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
                  ? `${selectedDesign.name} — ${selectedDesign.description}`
                  : "Choose a curated design to continue."}
              </p>
            </div>
            <button
              className="button button-primary level1-generate"
              type="button"
              onClick={generate}
              disabled={isGenerating || !person || !fabric || !selectedDesign || selectedDesign.generation.state !== "ready"}
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
        />
      )}
      {error ? <p className="form-error" role="alert">{error}</p> : null}

      {isGenerating ? <GenerationState /> : null}

      {resultUrl && person ? (
        <TryOnResult
          resultUrl={resultUrl}
          originalUrl={person.previewUrl}
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
