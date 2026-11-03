"use client";

import { BackgroundControls } from "@/components/BackgroundControls";
import type { BackgroundControl } from "@/lib/tryon/background-control";
import { FabricReferenceControls } from "@/components/FabricReferenceControls";
import type { FabricGuidance, FabricRole } from "@/lib/tryon/fabric-guidance";
import { pendingStorageKey, parsePendingGeneration, type PendingGeneration } from "@/lib/pending-generation";
import { uploadOriginal } from "@/lib/highres/client-upload";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GenerationState } from "@/components/GenerationState";
import { ImageUpload } from "@/components/ImageUpload";
import { Level1Catalogue } from "@/components/Level1Catalogue";
import { LogoutButton } from "@/components/LogoutButton";
import { TryOnResult } from "@/components/TryOnResult";
import { UsageHistory } from "@/components/UsageHistory";
import { ModeSelector } from "@/components/split-outfit/ModeSelector";
import { SplitOutfitWorkspace } from "@/components/split-outfit/SplitOutfitWorkspace";
import type { SplitPieceFabrics } from "@/components/split-outfit/SplitMaterialsSection";
import { classifyGenerationResponse, fetchWithTimeout, recoverGeneration, RecoveryAuthenticationError } from "@/lib/generation-recovery";
import { buildResultSummary, type ResultSummary } from "@/lib/result-summary";
import { DEFAULT_SPLIT_OUTFIT_STATE } from "@/lib/split-outfit/catalogue";
import { clearSplitFabrics } from "@/lib/split-outfit/client-fabrics";
import type { SplitOutfitState, VisualTryOnMode } from "@/lib/split-outfit/types";
import type { Level1CatalogueView } from "@/lib/catalog/level1-types";
import type { FabricRegion } from "@/lib/catalog/level1-prompt";
import type { RestoredLook } from "@/lib/history/restore-look";

type UploadedImage = {
  file: File;
  previewUrl: string;
};

type UploadRole = "person" | "fabric" | "lowerFabric" | "shirtFabric" | "waistcoatFabric";

type TryOnAppProps = {
  displayName: string;
  accountId: string;
};

const MAX_CLIENT_FILE_SIZE = 50 * 1024 * 1024;
const GENERATION_REQUEST_TIMEOUT_MS = 285_000;
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

type GenerationResponse = { generationId: string; resultUrl: string; originalUrl: string; metadata?: { reportedSize?: string; outputWidth?: number; outputHeight?: number } };

function getClientDeviceHint() {
  if (typeof navigator === "undefined") return "unknown";
  const userAgent = navigator.userAgent;
  const isIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (isIPad || /iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return "tablet";
  if (/Mobile|iPhone|iPod|Android/i.test(userAgent)) return "phone";
  return "desktop";
}

export function TryOnApp({ displayName, accountId }: TryOnAppProps) {
  const [person, setPerson] = useState<UploadedImage | null>(null);
  const [fabric, setFabric] = useState<UploadedImage | null>(null);
  const [lowerFabric, setLowerFabric] = useState<UploadedImage | null>(null);
  const [splitFabrics, setSplitFabrics] = useState<SplitPieceFabrics>({
    jacket: null,
    trousers: null,
    shirt: null,
    waistcoat: null,
  });
  const [mode, setMode] = useState<VisualTryOnMode>("full");
  const [splitOutfit, setSplitOutfit] = useState<SplitOutfitState>(DEFAULT_SPLIT_OUTFIT_STATE);
  const splitOutfitEnabled = true;
  const [catalogue, setCatalogue] = useState<Level1CatalogueView | null>(null);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("suit");
  const [designId, setDesignId] = useState<string | null>(null);
  const [designVariantId, setDesignVariantId] = useState<string | null>(null);
  const [backgroundControl, setBackgroundControl] = useState<BackgroundControl>({ mode: "prompt-only" });
  const [fabricGuidance, setFabricGuidance] = useState<FabricGuidance>({});
  const [fabricRegion, setFabricRegion] = useState<FabricRegion>("both");
  const [reuseFabricForLower, setReuseFabricForLower] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [originalResultUrl, setOriginalResultUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  const [generationStage, setGenerationStage] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const objectUrls = useRef(new Set<string>());
  const generationKeyRef = useRef<string | null>(null);
  const pendingRef = useRef<PendingGeneration | null>(null);
  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null);

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

  const updateSplitOutfit = useCallback((next: SplitOutfitState) => {
    setSplitOutfit(next);
    if (next.waistcoatId && next.waistcoatId !== "SUIT_WAISTCOAT_NONE") return;
    setSplitFabrics((current) => {
      if (!current.waistcoat) return current;
      revokeUrl(current.waistcoat.previewUrl);
      return { ...current, waistcoat: null };
    });
  }, [revokeUrl]);

  const clearResult = useCallback(() => {
    setResultUrl((current) => {
      revokeUrl(current);
      return null;
    });
    setOriginalResultUrl(null);
    setOutputSize(null);
    setResultSummary(null);
  }, [revokeUrl]);

  const trackPending = useCallback((value: PendingGeneration | null) => {
    pendingRef.current = value;
    setPendingGeneration(value);
    try {
      if (value) sessionStorage.setItem(pendingStorageKey(accountId), JSON.stringify(value));
      else sessionStorage.removeItem(pendingStorageKey(accountId));
    } catch { /* The current tab can still follow a job without browser persistence. */ }
  }, [accountId]);

  const reconcilePending = useCallback(async (value: PendingGeneration) => {
    generationKeyRef.current = value.key;
    setIsGenerating(true);
    try {
      const recovered = await recoverGeneration(value.key);
      if (recovered.kind === "unknown") {
        setError("This generation is still unconfirmed. Check again or inspect History before starting another paid run.");
        return;
      }
      trackPending(null);
      generationKeyRef.current = null;
      if (recovered.kind === "failed") { setError(recovered.error); return; }
      setResultUrl(recovered.resultUrl);
      setOriginalResultUrl(recovered.originalUrl);
      setResultSummary(value.summary);
      setOutputSize(null);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Recovery is unavailable.");
      if (error instanceof RecoveryAuthenticationError) window.location.replace("/login");
    } finally { setIsGenerating(false); }
  }, [trackPending]);

  useEffect(() => {
    let pending: PendingGeneration | null = null;
    try { pending = parsePendingGeneration(sessionStorage.getItem(pendingStorageKey(accountId))); } catch { /* Browser storage is optional. */ }
    if (!pending || generationKeyRef.current) return;
    const value = pending;
    // Defer state changes until after mount and make Strict Mode's first pass cancellable.
    let active = true;
    void Promise.resolve().then(() => {
      if (!active || generationKeyRef.current) return;
      trackPending(value);
      void reconcilePending(value);
    });
    return () => { active = false; };
  }, [accountId, trackPending, reconcilePending]);

  const selectedDesign = useMemo(
    () => catalogue?.designs.find((design) => design.id === designId) ?? null,
    [catalogue, designId],
  );
  const selectedVariant = useMemo(
    () => selectedDesign?.variants?.find((variant) => variant.id === designVariantId) ?? null,
    [designVariantId, selectedDesign],
  );
  const selectedReferenceReady = (selectedVariant ?? selectedDesign)?.generation.state === "ready";
  const isJacketCategory = categoryId === "jackets";
  const activeFabricReferences = useMemo(() => {
    const candidates: { role: FabricRole; label: string; image: UploadedImage | null }[] = mode === "full"
      ? [{ role: "fabric", label: isJacketCategory ? "Jacket fabric" : "Upper fabric", image: fabric }, ...(!isJacketCategory && fabricRegion === "custom" && !reuseFabricForLower ? [{ role: "lowerFabric" as const, label: "Lower fabric", image: lowerFabric }] : [])]
      : [{ role: "fabric", label: "Jacket fabric", image: splitFabrics.jacket }, { role: "lowerFabric", label: "Trouser fabric", image: splitFabrics.trousers }, { role: "shirtFabric", label: "Shirt fabric", image: splitFabrics.shirt }, ...(splitOutfit.waistcoatId && splitOutfit.waistcoatId !== "SUIT_WAISTCOAT_NONE" ? [{ role: "waistcoatFabric" as const, label: "Waistcoat fabric", image: splitFabrics.waistcoat }] : [])];
    return candidates.filter((item): item is typeof item & { image: UploadedImage } => item.image !== null);
  }, [mode, isJacketCategory, fabric, fabricRegion, reuseFabricForLower, lowerFabric, splitFabrics, splitOutfit.waistcoatId]);

  const changeImage = useCallback(async (role: UploadRole, file: File) => {
    setError(null);
    try {
      const prepared = await prepareImage(file);
      if (role === "person") setBackgroundControl({ mode: "prompt-only" });
      if (role !== "person") setFabricGuidance(current => { const next = { ...current }; delete next[role]; return next; });
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
      if (!person) {
        setError("Add a customer photo to generate.");
        return;
      }
    } else {
      if (!person || !fabric || !selectedDesign || !selectedReferenceReady) {
        setError("Add a customer photo and fabric, then choose an approved design to generate.");
        return;
      }
      if (!isJacketCategory && fabricRegion === "custom" && !reuseFabricForLower && !lowerFabric) {
        setError("Add a lower fabric or choose to reuse the upper fabric for both regions.");
        return;
      }
    }

    if (generationKeyRef.current) { setError("Check the pending generation before starting another paid run."); return; }

    setError(null);
    setIsGenerating(true);
    clearResult();

    // Captured now so the summary describes this look, not later selection changes.
    const summary = mode === "split"
      ? buildResultSummary({ mode, splitOutfit, hasUploadedFabric: Object.values(splitFabrics).some(Boolean) })
      : buildResultSummary({ mode: "full", designName: selectedDesign?.name ?? "Curated design", variantName: selectedVariant?.name });
    const showResult = (nextResultUrl: string, nextOriginalUrl: string, nextOutputSize: string | null) => {
      setResultUrl(nextResultUrl);
      setOriginalResultUrl(nextOriginalUrl);
      setOutputSize(nextOutputSize);
      setResultSummary(summary);
    };

    try {
      const idempotencyKey = crypto.randomUUID();
      generationKeyRef.current = idempotencyKey;
      setUploadProgress(0);
      uploadController.current = new AbortController();
      const files = [person.file, ...activeFabricReferences.map(item => item.image.file)];
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const transferred = new Map<string, number>();
      const upload = (role: UploadRole, file: File) => uploadOriginal(role, file, () => {}, {
        accountId, signal: uploadController.current!.signal,
        onBytes: bytes => { transferred.set(role, Math.max(transferred.get(role) ?? 0, bytes)); setUploadProgress(Math.min(100, Math.round(Array.from(transferred.values()).reduce((sum, amount) => sum + amount, 0) * 100 / totalBytes))); },
        onPhase: phase => setGenerationStage(`${phase === "uploading" ? "Uploading" : "Validating"} ${role === "person" ? "customer photo" : "fabric"}`),
      });
      const personUpload = await upload("person", person.file);
      const fabricUploads: Partial<Record<FabricRole, string>> = {};
      for (const reference of activeFabricReferences) fabricUploads[reference.role] = await upload(reference.role, reference.image.file);
      const { fabric: fabricUpload, lowerFabric: lowerFabricUpload, shirtFabric: shirtFabricUpload, waistcoatFabric: waistcoatFabricUpload } = fabricUploads;
      setUploadProgress(100);
      uploadController.current = null;
      setGenerationStage("Generating and saving your private master");
      const requestBody = mode === "split"
        ? {
          selectionMode: "split" as const,
          splitRecipe: JSON.stringify(splitOutfit),
          uploads: {
            person: personUpload,
            ...(fabricUpload ? { fabric: fabricUpload } : {}),
            ...(lowerFabricUpload ? { lowerFabric: lowerFabricUpload } : {}),
            ...(shirtFabricUpload ? { shirtFabric: shirtFabricUpload } : {}),
            ...(waistcoatFabricUpload ? { waistcoatFabric: waistcoatFabricUpload } : {}),
          },
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
      const pending = { key: idempotencyKey, createdAt: Date.now(), summary };
      trackPending(pending);
      const activeGuidance: FabricGuidance = {};
      for (const role of Object.keys(requestBody.uploads) as FabricRole[]) if (fabricGuidance[role]) activeGuidance[role] = fabricGuidance[role];
      const requestWithGuidance = { ...requestBody, fabricGuidance: JSON.stringify(activeGuidance), backgroundControl: JSON.stringify(backgroundControl) };
      let response: Response;
      try {
        response = await fetchWithTimeout("/api/try-on", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Nasir-Device": getClientDeviceHint(), "Idempotency-Key": idempotencyKey },
          body: JSON.stringify(requestWithGuidance),
        }, GENERATION_REQUEST_TIMEOUT_MS);
        // A proxy error or a conflict on this key can arrive while the original
        // job is still running. Reconcile that key before allowing a new
        // generation. Rejections the server marks as never started are final.
        if (classifyGenerationResponse(response) === "uncertain") throw new Error("Generation outcome needs confirmation.");
      } catch {
        // The connection dropped or timed out, but the paid generation may still
        // be running. Follow it rather than asking staff to pay for another.
        const recovered = await recoverGeneration(idempotencyKey);
        if (recovered.kind === "complete") {
          trackPending(null);
          showResult(recovered.resultUrl, recovered.originalUrl, null);
          return;
        }
        if (recovered.kind === "failed") trackPending(null);
        throw new Error(recovered.kind === "failed"
          ? recovered.error
          : "We lost contact with this try-on. Please check History before trying again, as it may still finish.");
      }
      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      const outcome = classifyGenerationResponse(response);
      if (outcome === "rejected") {
        trackPending(null);
        const payload: unknown = await response.json().catch(() => ({}));
        throw new Error(readResponseError(payload, "We couldn't create the try-on. Please try again."));
      }
      if (outcome === "unsaved") {
        // The paid image exists only in this response. Show it and say so.
        trackPending(null);
        const unsavedUrl = URL.createObjectURL(await response.blob());
        objectUrls.current.add(unsavedUrl);
        showResult(unsavedUrl, person.previewUrl, null);
        setError("This try-on could not be saved to History. Download it now; it will be lost when you leave this page.");
        return;
      }
      const payload = await response.json().catch(() => ({})) as GenerationResponse;
      if (!payload.resultUrl || !payload.originalUrl) throw new Error("We couldn't create the try-on. Please try again.");
      trackPending(null);
      showResult(payload.resultUrl, payload.originalUrl, payload.metadata?.outputWidth && payload.metadata?.outputHeight
        ? `${payload.metadata.outputWidth}×${payload.metadata.outputHeight}`
        : payload.metadata?.reportedSize ?? null);
    } catch (generationError: unknown) {
      if (generationError instanceof RecoveryAuthenticationError) window.location.replace("/login");
      setError(generationError instanceof Error ? generationError.message : "We couldn't create the try-on. Please try again.");
    } finally {
      if (!pendingRef.current) generationKeyRef.current = null;
      uploadController.current = null;
      setGenerationStage("");
      setUploadProgress(null);
      setIsGenerating(false);
    }
  }, [accountId, activeFabricReferences, trackPending, backgroundControl, fabricGuidance, categoryId, clearResult, designVariantId, fabric, fabricRegion, isJacketCategory, lowerFabric, mode, person, reuseFabricForLower, selectedDesign, selectedReferenceReady, selectedVariant, splitFabrics, splitOutfit]);

  const selectSplitFabric = useCallback(async (piece: keyof SplitPieceFabrics, file: File) => {
    setError(null);
    try {
      const prepared = await prepareImage(file);
      const role = ({ jacket: "fabric", trousers: "lowerFabric", shirt: "shirtFabric", waistcoat: "waistcoatFabric" } as const)[piece];
      setFabricGuidance(current => { const next = { ...current }; delete next[role]; return next; });
      const previewUrl = URL.createObjectURL(prepared);
      objectUrls.current.add(previewUrl);
      setSplitFabrics((current) => {
        const previous = current[piece];
        if (previous) revokeUrl(previous.previewUrl);
        return { ...current, [piece]: { file: prepared, previewUrl } };
      });
      clearResult();
    } catch (selectionError: unknown) {
      setError(selectionError instanceof Error ? selectionError.message : "We couldn't prepare this image. Please choose another one.");
    }
  }, [clearResult, revokeUrl]);

  const removeSplitFabric = useCallback((piece: keyof SplitPieceFabrics) => {
    setSplitFabrics((current) => {
      const previous = current[piece];
      if (previous) revokeUrl(previous.previewUrl);
      return { ...current, [piece]: null };
    });
    clearResult();
  }, [clearResult, revokeUrl]);

  const reuseJacketOnTrousers = useCallback(() => {
    const jacket = splitFabrics.jacket;
    if (!jacket) return;
    const previewUrl = URL.createObjectURL(jacket.file);
    objectUrls.current.add(previewUrl);
    setSplitFabrics((current) => {
      if (current.trousers) revokeUrl(current.trousers.previewUrl);
      return { ...current, trousers: { file: jacket.file, previewUrl } };
    });
    clearResult();
  }, [clearResult, revokeUrl, splitFabrics.jacket]);

  const restoreLook = useCallback((look: RestoredLook) => {
    if (look.kind === "unsupported") return;
    setError(null);
    clearResult();
    setReuseFabricForLower(false);
    setLowerFabric((current) => {
      revokeUrl(current?.previewUrl);
      return null;
    });
    if (look.kind === "split") {
      setMode("split");
      updateSplitOutfit(look.state);
      setFabricRegion(look.fabricRegion);
      return;
    }
    setMode("full");
    setCategoryId(look.categoryId);
    setDesignId(look.designId);
    setDesignVariantId(look.variantId);
    setFabricRegion(look.fabricRegion);
  }, [clearResult, revokeUrl, updateSplitOutfit]);

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
    setSplitFabrics((current) => clearSplitFabrics(current, revokeUrl));
    setSplitOutfit(DEFAULT_SPLIT_OUTFIT_STATE);
    setFabricGuidance({});
    setBackgroundControl({ mode: "prompt-only" });
  }, [clearResult, isJacketCategory, revokeUrl]);

  return (
    <main className="atelier-shell">
      <header className="atelier-mobile-header">
        <div className="atelier-mobile-brand">
          <span className="atelier-monogram" aria-hidden="true">N</span>
          <span><strong>NASIR BESPOKE</strong><small>Private atelier</small></span>
        </div>
        <div className="atelier-mobile-actions">
          <UsageHistory onRestoreLook={restoreLook} />
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
          <UsageHistory onRestoreLook={restoreLook} />
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
          {mode === "full" ? (
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
          ) : null}
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
        {mode === "split" ? (
          <p className="privacy-note">Optional cloth for jacket, trousers, shirt, and waistcoat is assigned in Fabrics &amp; materials below. Shoes keep the shoe photograph.</p>
        ) : null}
        {mode === "full" && !isJacketCategory ? <div
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
        {mode === "full" && !isJacketCategory && fabricRegion === "custom" ? (
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

          {selectedDesign && !selectedReferenceReady ? (
            <p className="level1-pending-note" role="status">
              {(selectedVariant ?? selectedDesign).generation.unavailabilityReason === "storage-unavailable" ? "Reference storage is temporarily unavailable. Please try again shortly." : "This reference image is unavailable. Choose an available design or variation."}
            </p>
          ) : null}
        </>
      ) : (
        <SplitOutfitWorkspace
          state={splitOutfit}
          onChange={(updater) => updateSplitOutfit(updater(splitOutfit))}
          onGenerate={generate}
          isGenerating={isGenerating}
          fabrics={splitFabrics}
          onFabricSelect={(piece, file) => void selectSplitFabric(piece, file)}
          onFabricRemove={removeSplitFabric}
          onReuseJacketOnTrousers={reuseJacketOnTrousers}
        />
      )}
      {person ? <BackgroundControls previewUrl={person.previewUrl} value={backgroundControl} onChange={setBackgroundControl} disabled={isGenerating} /> : null}
      {activeFabricReferences.map(item => <FabricReferenceControls key={item.role + item.image.previewUrl} label={item.label} previewUrl={item.image.previewUrl} value={fabricGuidance[item.role]} onChange={value => setFabricGuidance(current => ({ ...current, [item.role]: value }))} disabled={isGenerating} />)}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {pendingGeneration && !isGenerating ? <section aria-label="Pending generation"><p>We need to check whether the previous generation finished before starting another paid run.</p><button type="button" onClick={() => void reconcilePending(pendingGeneration)}>Check generation again</button></section> : null}

      {uploadProgress !== null ? <p className="privacy-note" role="status">{generationStage || "Preparing originals"} · {uploadProgress}% of total upload.</p> : null}

      {isGenerating && !pendingGeneration ? <button type="button" onClick={() => uploadController.current?.abort()}>Cancel upload</button> : null}
      {isGenerating ? <GenerationState /> : null}

      {resultUrl && originalResultUrl && resultSummary ? (
        <TryOnResult
          resultUrl={resultUrl}
          originalUrl={originalResultUrl}
          outputSize={outputSize ?? undefined}
          summary={resultSummary}
          onRegenerate={generate}
          onReset={startOver}
          isGenerating={isGenerating}
          fabricReferences={activeFabricReferences.map(item => ({ label: item.label, url: item.image.previewUrl }))}
        />
      ) : null}

      <p className="privacy-note">Photos and results are kept in private History, visible to signed-in staff. AI visualization; actual garment fit may vary.</p>
      </section>
    </main>
  );
}
