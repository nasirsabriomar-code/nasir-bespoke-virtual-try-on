"use client";

import { useEffect, useRef, useState } from "react";
import { GenerationState } from "@/components/GenerationState";
import { ImageUpload } from "@/components/ImageUpload";
import { LogoutButton } from "@/components/LogoutButton";
import { TryOnResult } from "@/components/TryOnResult";
import { UsageHistory } from "@/components/UsageHistory";
import { VisualOptionCard } from "@/components/VisualOptionCard";
import { StylePicker } from "@/components/StylePicker";
import { BespokeConfigurator, isBespokeConfigurationComplete } from "@/components/BespokeConfigurator";
import type { Catalog, ConfigurationProfile, GarmentBlueprint } from "@/lib/catalog/types";

type SelectedImage = {
  file: File;
  previewUrl: string;
};
type SelectionMode = "catalog" | "outfit";

type TryOnAppProps = {
  displayName: string;
};

const MAX_CLIENT_FILE_SIZE = 15 * 1024 * 1024;
const MAX_API_FILE_SIZE = 1_250_000;
const MAX_IMAGE_EDGE = 2400;
const DIRECT_UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

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
      draw: (context: CanvasRenderingContext2D, width: number, height: number) =>
        context.drawImage(bitmap, 0, 0, width, height),
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
        draw: (context: CanvasRenderingContext2D, width: number, height: number) =>
          context.drawImage(image, 0, 0, width, height),
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
  if (file.size <= MAX_API_FILE_SIZE && !HEIC_TYPES.has(file.type.toLowerCase()) && !hasHeicExtension(file)) {
    return file;
  }

  const source = await decodeImage(file);
  try {
    let scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(source.width, source.height));
    const qualities = [0.9, 0.82, 0.74, 0.66];

    for (let sizeAttempt = 0; sizeAttempt < 5; sizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      source.draw(context, canvas.width, canvas.height);

      for (const quality of qualities) {
        const webp = await canvasToBlob(canvas, "image/webp", quality);
        const blob = webp?.type === "image/webp"
          ? webp
          : await canvasToBlob(canvas, "image/jpeg", quality);
        if (blob && blob.size <= MAX_API_FILE_SIZE) {
          const extension = blob.type === "image/webp" ? "webp" : "jpg";
          return new File([blob], file.name.replace(/\.[^.]+$/, `.${extension}`), {
            type: blob.type,
            lastModified: file.lastModified,
          });
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
  if (file.size > MAX_CLIENT_FILE_SIZE) {
    throw new Error("This image is too large. Please choose an image under 15 MB.");
  }

  const isHeic = HEIC_TYPES.has(file.type.toLowerCase()) || hasHeicExtension(file);
  if (!isHeic && !DIRECT_UPLOAD_TYPES.has(file.type.toLowerCase()) && !hasSupportedExtension(file)) {
    throw new Error("Please upload a JPG, PNG, WebP, or HEIC image.");
  }

  return optimizeForUpload(file);
}

async function readErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || "We couldn't create the try-on. Please try again.";
  } catch {
    return "We couldn't create the try-on. Please try again.";
  }
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
  const [personImage, setPersonImage] = useState<SelectedImage | null>(null);
  const [outfitImage, setOutfitImage] = useState<SelectedImage | null>(null);
  const [fabricImage, setFabricImage] = useState<SelectedImage | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("catalog");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [upperGarmentId, setUpperGarmentId] = useState<string | null>(null);
  const [lowerGarmentId, setLowerGarmentId] = useState<string | null>(null);
  const [garmentSubtypeId, setGarmentSubtypeId] = useState<string | null>(null);
  const [upperStyleId, setUpperStyleId] = useState<string | null>(null);
  const [lowerStyleId, setLowerStyleId] = useState<string | null>(null);
  const [turbanStyleId, setTurbanStyleId] = useState<string | null>(null);
  const [shoeStyleId, setShoeStyleId] = useState<string | null>(null);
  const [turbanId, setTurbanId] = useState("turban-none");
  const [shoeId, setShoeId] = useState("shoes-keep-existing");
  const [bespokeSelections, setBespokeSelections] = useState<Record<string, string>>({});
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/catalog", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace("/login");
          return null;
        }
        const payload = await response.json().catch(() => ({})) as Partial<Catalog> & { error?: string };
        if (!response.ok) throw new Error(payload.error || "The men's garment catalog is unavailable.");
        return payload;
      })
      .then((payload) => {
        if (cancelled || !payload || !Array.isArray(payload.blueprints) || !Array.isArray(payload.accessories)) return;
        setCatalog({ blueprints: payload.blueprints, accessories: payload.accessories, configurationProfiles: payload.configurationProfiles });
        setCatalogError(null);
      })
      .catch((loadError) => {
        if (!cancelled) setCatalogError(loadError instanceof Error ? loadError.message : "The men's garment catalog is unavailable.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (resultUrl) {
      window.setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    }
  }, [resultUrl]);

  function revokeUrl(url: string | null | undefined) {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  }

  function clearResult() {
    setResultUrl((current) => {
      revokeUrl(current);
      return null;
    });
  }

  async function selectImage(
    file: File,
    current: SelectedImage | null,
    update: (value: SelectedImage | null) => void,
  ) {
    setError(null);
    try {
      const prepared = await prepareImage(file);
      const previewUrl = URL.createObjectURL(prepared);
      objectUrls.current.add(previewUrl);
      revokeUrl(current?.previewUrl);
      update({ file: prepared, previewUrl });
      clearResult();
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "We couldn't prepare this image. Please choose another one.",
      );
    }
  }

  function removeImage(
    current: SelectedImage | null,
    update: (value: SelectedImage | null) => void,
  ) {
    revokeUrl(current?.previewUrl);
    update(null);
    clearResult();
    setError(null);
  }

  function findBlueprint(id: string | null) {
    return id && catalog ? catalog.blueprints.find((item) => item.id === id) ?? null : null;
  }

  const selectedUpper = findBlueprint(upperGarmentId);
  const selectedSubtype = findBlueprint(garmentSubtypeId);
  const selectedLower = findBlueprint(lowerGarmentId);
  const selectedTurban = catalog?.accessories.find((item) => item.id === turbanId);
  const selectedShoes = catalog?.accessories.find((item) => item.id === shoeId);
  const bespokeProfile: ConfigurationProfile | null = selectedUpper?.configurationProfileId
    ? catalog?.configurationProfiles?.find((profile) => profile.id === selectedUpper.configurationProfileId) ?? null
    : null;
  const upperOptions = catalog?.blueprints.filter((item) => item.active && item.pieceType !== "lower" && !item.subcategory?.includes("Two-Piece") && !item.subcategory?.includes("Three-Piece") && !item.subcategory?.includes("Double-Breasted") && !item.subcategory?.includes("Tuxedo")) ?? [];
  const suitSubtypeOptions = catalog?.blueprints.filter((item) => item.active && item.category === "suit" && item.id !== "suit-base") ?? [];
  const lowerOptions = catalog?.blueprints.filter((item) => item.active && item.pieceType === "lower") ?? [];
  const turbanOptions = catalog?.accessories.filter((item) => item.active && item.category === "turban") ?? [];
  const shoeOptions = catalog?.accessories.filter((item) => item.active && item.category === "shoes") ?? [];
  const lowerRequired = Boolean(selectedUpper && selectedUpper.pieceType === "upper" && selectedUpper.id !== "suit-base");
  const subtypeRequired = selectedUpper?.id === "suit-base";

  function updateBespokeSelections(next: Record<string, string>) {
    setBespokeSelections(next);
    if (next["suit-composition"]) setGarmentSubtypeId(next["suit-composition"]);
    if (next["shoe-family"]) setShoeId(next["shoe-family"]);
    if (next["turban-family"]) setTurbanId(next["turban-family"]);
    setError(null);
    clearResult();
  }

  async function generateTryOn() {
    if (!personImage || !fabricImage || (selectionMode === "outfit" && !outfitImage)) {
      setError(selectionMode === "outfit"
        ? "Please upload a person photo, outfit photo, and fabric photo."
        : "Please upload a person photo and fabric photo, then choose a men's look from the library.");
      return;
    }
    if (selectionMode === "catalog" && (!upperGarmentId || !turbanId || !shoeId || (lowerRequired && !lowerGarmentId) || (subtypeRequired && !garmentSubtypeId) || (bespokeProfile && !isBespokeConfigurationComplete(bespokeProfile, bespokeSelections)))) {
      setError("Please choose the men's garment, lower garment where needed, and accessories.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 165_000);

    try {
      const formData = new FormData();
      formData.append("person", personImage.file);
      formData.append("selectionMode", selectionMode);
      if (selectionMode === "outfit" && outfitImage) formData.append("outfit", outfitImage.file);
      formData.append("fabric", fabricImage.file);
      if (selectionMode === "catalog") {
        if (upperGarmentId) formData.append("upperGarmentId", upperGarmentId);
        if (lowerGarmentId) formData.append("lowerGarmentId", lowerGarmentId);
        if (garmentSubtypeId) formData.append("garmentSubtypeId", garmentSubtypeId);
        if (upperStyleId) formData.append("upperStyleId", upperStyleId);
        if (lowerStyleId) formData.append("lowerStyleId", lowerStyleId);
        if (turbanStyleId) formData.append("turbanStyleId", turbanStyleId);
        if (shoeStyleId) formData.append("shoeStyleId", shoeStyleId);
        if (turbanId) formData.append("turbanId", turbanId);
        if (shoeId) formData.append("shoeId", shoeId);
        if (bespokeProfile) formData.append("bespokeConfiguration", JSON.stringify({ profileId: bespokeProfile.id, selections: bespokeSelections }));
      }

      const response = await fetch("/api/try-on", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Nasir-Device": getClientDeviceHint() },
        body: formData,
        signal: controller.signal,
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const result = await response.blob();
      if (!result.type.startsWith("image/")) {
        throw new Error("We couldn't create the try-on. Please try again.");
      }

      const nextResultUrl = URL.createObjectURL(result);
      objectUrls.current.add(nextResultUrl);
      setResultUrl((current) => {
        revokeUrl(current);
        return nextResultUrl;
      });
    } catch (generationError) {
      setError(
        generationError instanceof DOMException && generationError.name === "AbortError"
          ? "The generation took too long. Please try again."
          : generationError instanceof Error
            ? generationError.message
            : "We couldn't create the try-on. Please try again.",
      );
    } finally {
      window.clearTimeout(timeout);
      setIsGenerating(false);
    }
  }

  function startOver() {
    revokeUrl(personImage?.previewUrl);
    revokeUrl(outfitImage?.previewUrl);
    revokeUrl(fabricImage?.previewUrl);
    revokeUrl(resultUrl);
    setPersonImage(null);
    setOutfitImage(null);
    setFabricImage(null);
    setSelectionMode("catalog");
    setUpperGarmentId(null);
    setLowerGarmentId(null);
    setGarmentSubtypeId(null);
    setUpperStyleId(null);
    setLowerStyleId(null);
    setTurbanStyleId(null);
    setShoeStyleId(null);
    setTurbanId("turban-none");
    setShoeId("shoes-keep-existing");
    setBespokeSelections({});
    setResultUrl(null);
    setError(null);
    setIsGenerating(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const canGenerate = Boolean(
    personImage && fabricImage && !isGenerating &&
    (selectionMode === "outfit"
      ? outfitImage
      : catalog && upperGarmentId && (!lowerRequired || lowerGarmentId) && (!subtypeRequired || garmentSubtypeId) && (!bespokeProfile || isBespokeConfigurationComplete(bespokeProfile, bespokeSelections))),
  );

  const creationSteps = [
    { id: "model", number: "01", label: "Model", complete: Boolean(personImage) },
    { id: "fabric", number: "02", label: "Fabric", complete: Boolean(fabricImage) },
    {
      id: "garment",
      number: "03",
      label: "Garment",
      complete: selectionMode === "outfit" ? Boolean(outfitImage) : Boolean(upperGarmentId),
    },
    { id: "review", number: "04", label: "Review", complete: Boolean(resultUrl) },
  ];
  const currentStepIndex = resultUrl ? 3 : creationSteps.findIndex((step) => !step.complete);
  const stageImage = resultUrl ?? personImage?.previewUrl ?? outfitImage?.previewUrl ?? null;
  const stageAlt = resultUrl
    ? "Generated Nasir Bespoke virtual try-on"
    : personImage
      ? "Selected model photograph"
      : outfitImage
        ? "Selected outfit reference photograph"
        : "Awaiting a model photograph";
  const activeBespokeSummary = bespokeProfile
    ? bespokeProfile.groups
      .map((group) => {
        const optionId = bespokeSelections[group.id];
        const option = group.options.find((item) => item.id === optionId);
        return option ? { group: group.name, option: option.name } : null;
      })
      .filter((item): item is { group: string; option: string } => Boolean(item))
    : [];

  return (
    <main className="atelier-shell">
      <aside className="atelier-sidebar" aria-label="Nasir Bespoke workspace navigation">
        <div className="atelier-sidebar-top">
          <span className="atelier-monogram" aria-hidden="true">N</span>
          <div className="atelier-brand"><strong>NASIR BESPOKE</strong><span>Midnight Atelier</span></div>
        </div>
        <nav className="atelier-nav" aria-label="Workspace">
          <a className="atelier-nav-link is-active" href="#new-creation"><span aria-hidden="true">✦</span> New Creation</a>
          <UsageHistory />
        </nav>
        <div className="atelier-sidebar-footer">
          <div className="atelier-user">
            <span className="user-initial" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
            <span><strong>{displayName}</strong><small>Private staff access</small></span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="atelier-main">
        <header className="atelier-mobile-header" aria-label="Nasir Bespoke">
          <span className="atelier-monogram" aria-hidden="true">N</span><strong>NASIR BESPOKE</strong>
          <div className="atelier-mobile-actions"><UsageHistory /><LogoutButton /></div>
        </header>

      <header className="brand-header" aria-label="Nasir Bespoke Virtual Try-On">
        <p className="brand-kicker">PRIVATE DIGITAL ATELIER</p>
        <span className="brand-rule" aria-hidden="true" />
        <h1>New Creation</h1>
        <p className="brand-description">
          Build a men&apos;s bespoke look from the model, fabric, and selected construction.
        </p>
      </header>

      <section id="new-creation" className="try-on-workspace" aria-label="Create a men&apos;s bespoke virtual try-on">
        <div className="creation-progress" aria-label="Creation progress">
          {creationSteps.map((step, index) => (
            <div className={`progress-step${step.complete ? " is-complete" : ""}${index === currentStepIndex ? " is-current" : ""}`} key={step.id}>
              <span>{step.complete ? "✓" : step.number}</span><b>{step.label}</b>
            </div>
          ))}
        </div>
        <div className="workspace-layout">
          <section className="image-stage" aria-label="Fitting room preview">
            <div className="stage-heading"><span>THE FITTING ROOM</span><small>{resultUrl ? "Generated view" : "Live reference"}</small></div>
            <div className="stage-frame">
              {stageImage ? (
                // Object URLs are transient private image previews and cannot use framework image optimization.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stageImage} alt={stageAlt} className="stage-image" />
              ) : <div className="stage-empty"><span aria-hidden="true">✦</span><strong>Your model appears here</strong><p>Begin with a clear, full-body photograph.</p></div>}
              <div className="stage-overlay"><span>{resultUrl ? "TRY-ON READY" : personImage ? "MODEL LOADED" : "AWAITING MODEL"}</span></div>
            </div>
          </section>
          <aside className="creation-panel" aria-label="Your current creation">
            <div className="creation-panel-heading"><p>YOUR CREATION</p><span>{selectionMode === "outfit" ? "Outfit reference" : "Bespoke configuration"}</span></div>
            <dl className="creation-spec-list">
              <div><dt>Model</dt><dd>{personImage?.file.name ?? "Not selected"}</dd></div>
              <div><dt>Fabric</dt><dd>{fabricImage?.file.name ?? "Not selected"}</dd></div>
              <div><dt>Garment</dt><dd>{selectionMode === "outfit" ? (outfitImage?.file.name ?? "Upload outfit") : (selectedSubtype?.name ?? selectedUpper?.name ?? "Choose a look")}</dd></div>
              {selectionMode === "catalog" && selectedLower ? <div><dt>Lower</dt><dd>{selectedLower.name}</dd></div> : null}
              {selectionMode === "catalog" ? <div><dt>Shoes</dt><dd>{selectedShoes?.name ?? "Keep existing"}</dd></div> : null}
              {selectionMode === "catalog" ? <div><dt>Turban</dt><dd>{selectedTurban?.name ?? "None"}</dd></div> : null}
            </dl>
            {activeBespokeSummary.length ? <div className="creation-detail-list">{activeBespokeSummary.slice(0, 6).map((item) => <p key={item.group}><span>{item.group}</span>{item.option}</p>)}</div> : null}
            <a href="#asset-references" className="creation-edit-link">Edit creation <span aria-hidden="true">→</span></a>
          </aside>
        </div>
        <div id="asset-references" className="upload-grid asset-dock">
          <ImageUpload
            id="person-photo"
            label="Your Photo"
            description="Upload a clear photo of the person."
            guidance="Use a clear, well-lit photo where the body and clothing are visible."
            file={personImage?.file ?? null}
            previewUrl={personImage?.previewUrl ?? null}
            onSelect={(file) => selectImage(file, personImage, setPersonImage)}
            onRemove={() => removeImage(personImage, setPersonImage)}
            disabled={isGenerating}
          />

          <div className="plus-mark" aria-hidden="true"><span>+</span></div>

          <ImageUpload
            id="outfit-photo"
            label="Outfit Photo"
            description="Optional when you choose a look from the library; otherwise upload the exact outfit style to recreate."
            guidance="The garment construction, cut, collar, buttons, and proportions come from this photo."
            file={outfitImage?.file ?? null}
            previewUrl={outfitImage?.previewUrl ?? null}
            onSelect={(file) => { setSelectionMode("outfit"); void selectImage(file, outfitImage, setOutfitImage); }}
            onRemove={() => removeImage(outfitImage, setOutfitImage)}
            disabled={isGenerating}
          />

          <div className="plus-mark" aria-hidden="true"><span>+</span></div>

          <ImageUpload
            id="fabric-photo"
            label="Fabric"
            description="Photograph or upload the fabric you want to visualize."
            guidance="Only its colour, texture, weave, shade, and pattern are applied to the selected clothing."
            file={fabricImage?.file ?? null}
            previewUrl={fabricImage?.previewUrl ?? null}
            onSelect={(file) => selectImage(file, fabricImage, setFabricImage)}
            onRemove={() => removeImage(fabricImage, setFabricImage)}
            disabled={isGenerating}
          />
        </div>

        <section className="catalog-section" aria-labelledby="upper-garments-heading">
          <div className="catalog-heading">
            <div><p className="catalog-eyebrow">STEP 04</p><h2 id="upper-garments-heading">Choose the men&apos;s look</h2></div>
            <p>{selectionMode === "outfit" ? "Your uploaded outfit photo is the style reference for this generation." : "Tap a photograph to select the construction you want to visualize."}</p>
          </div>
          <div className="generation-mode-toggle" role="group" aria-label="Generation mode">
            <button type="button" className={selectionMode === "catalog" ? "is-selected" : ""} onClick={() => { setSelectionMode("catalog"); setError(null); clearResult(); }} disabled={isGenerating}>
              Use Garment Library
              <span>Person + fabric + visual blueprints</span>
            </button>
            <button type="button" className={selectionMode === "outfit" ? "is-selected" : ""} onClick={() => { setSelectionMode("outfit"); setError(null); clearResult(); }} disabled={isGenerating}>
              Use Uploaded Outfit
              <span>Person + outfit + fabric</span>
            </button>
          </div>
          {catalogError ? <p className="catalog-status catalog-status-error" role="alert">{catalogError}</p> : null}
          {!catalog && !catalogError ? <p className="catalog-status">Loading the men&apos;s garment references…</p> : null}
          {selectionMode === "outfit" ? (
            <div className="outfit-mode-notice" role="status">
              <strong>Uploaded outfit mode</strong>
              <p>The outfit photograph controls the garment style and construction. Library garments, lower pieces, turbans, and shoes are not used for this generation.</p>
              <button type="button" className="text-action" onClick={() => { setSelectionMode("catalog"); setError(null); }}>Switch to garment library</button>
            </div>
          ) : catalog ? (
            <>
              {bespokeProfile ? (
                <BespokeConfigurator
                  profile={bespokeProfile}
                  value={bespokeSelections}
                  onChange={updateBespokeSelections}
                  disabled={isGenerating}
                />
              ) : null}

              <div className="visual-option-grid visual-option-grid-primary">
                {upperOptions.map((item: GarmentBlueprint) => (
                  <VisualOptionCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    description={item.description}
                    imagePath={item.displayReference.path}
                    selected={upperGarmentId === item.id}
                    disabled={isGenerating}
                    onSelect={() => {
                      setUpperGarmentId(item.id);
                      setGarmentSubtypeId(null);
                      setLowerGarmentId(null);
                      setUpperStyleId(null);
                      setLowerStyleId(null);
                      setBespokeSelections({});
                      setError(null);
                      clearResult();
                    }}
                  />
                ))}
              </div>

              {selectedUpper?.id === "suit-base" && !bespokeProfile ? (
                <div className="catalog-subsection" aria-labelledby="suit-style-heading">
                  <div className="catalog-subheading"><p className="catalog-eyebrow">SUIT STYLE</p><h3 id="suit-style-heading">Choose the suit construction</h3></div>
                  <div className="visual-option-grid visual-option-grid-subtypes">
                    {suitSubtypeOptions.map((item) => (
                      <VisualOptionCard
                        key={item.id}
                        id={item.id}
                        name={item.name}
                        description={item.description}
                        imagePath={item.displayReference.path}
                        selected={garmentSubtypeId === item.id}
                        disabled={isGenerating}
                        onSelect={() => { setGarmentSubtypeId(item.id); setLowerGarmentId(null); setUpperStyleId(null); setError(null); clearResult(); }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {!bespokeProfile ? <StylePicker
                label="Upper style & cut"
                options={selectedUpper?.styleOptions}
                selectedId={upperStyleId}
                disabled={isGenerating}
                onSelect={(id) => { setUpperStyleId(id); setError(null); clearResult(); }}
              /> : null}

              {lowerRequired && !bespokeProfile ? (
                <div className="catalog-subsection" aria-labelledby="lower-garments-heading">
                  <div className="catalog-subheading"><p className="catalog-eyebrow">LOWER</p><h3 id="lower-garments-heading">Choose the lower garment</h3></div>
                  <div className="visual-option-grid visual-option-grid-lower">
                    {lowerOptions.filter((item) => item.category === "no-change" || selectedUpper?.compatibleCategories.includes(item.category)).map((item) => (
                      <VisualOptionCard
                        key={item.id}
                        id={item.id}
                        name={item.name}
                        description={item.description}
                        imagePath={item.displayReference.path}
                        selected={lowerGarmentId === item.id}
                        disabled={isGenerating}
                        onSelect={() => { setLowerGarmentId(item.id); setLowerStyleId(null); setError(null); clearResult(); }}
                      />
                    ))}
                  </div>
                  <StylePicker
                    label="Lower style & cut"
                    options={selectedLower?.styleOptions}
                    selectedId={lowerStyleId}
                    disabled={isGenerating}
                    onSelect={(id) => { setLowerStyleId(id); setError(null); clearResult(); }}
                  />
                </div>
              ) : null}

              {!bespokeProfile ? <div className="catalog-subsection" aria-labelledby="accessories-heading">
                <div className="catalog-subheading"><p className="catalog-eyebrow">OPTIONAL ACCESSORIES</p><h3 id="accessories-heading">Finish the look</h3></div>
                <div className="accessory-group">
                  <p className="accessory-label">Turban</p>
                  <div className="visual-option-grid visual-option-grid-accessories">
                    {turbanOptions.map((item) => <VisualOptionCard key={item.id} id={item.id} name={item.name} description={item.description} imagePath={item.displayReference.path} selected={turbanId === item.id} disabled={isGenerating} onSelect={() => { setTurbanId(item.id); setTurbanStyleId(null); clearResult(); }} />)}
                  </div>
                  <StylePicker label="Turban style" options={selectedTurban?.styleOptions} selectedId={turbanStyleId} disabled={isGenerating} onSelect={(id) => { setTurbanStyleId(id); clearResult(); }} />
                </div>
                <div className="accessory-group">
                  <p className="accessory-label">Shoes</p>
                  <div className="visual-option-grid visual-option-grid-accessories">
                    {shoeOptions.map((item) => <VisualOptionCard key={item.id} id={item.id} name={item.name} description={item.description} imagePath={item.displayReference.path} selected={shoeId === item.id} disabled={isGenerating} onSelect={() => { setShoeId(item.id); setShoeStyleId(null); clearResult(); }} />)}
                  </div>
                  <StylePicker label="Shoe finish" options={selectedShoes?.styleOptions} selectedId={shoeStyleId} disabled={isGenerating} onSelect={(id) => { setShoeStyleId(id); clearResult(); }} />
                </div>
              </div> : null}

              <div className="selection-summary" aria-live="polite">
                <p className="catalog-eyebrow">SUMMARY</p>
                <div className="selection-summary-items">
                  <span>{selectedUpper?.name ?? "Choose a men's look"}</span>
                  {selectedSubtype ? <span>{selectedSubtype.name}</span> : null}
                  {upperStyleId ? <span>{selectedUpper?.styleOptions?.find((item) => item.id === upperStyleId)?.name}</span> : null}
                  {selectedLower ? <span>{selectedLower.name}</span> : null}
                  {lowerStyleId ? <span>{selectedLower?.styleOptions?.find((item) => item.id === lowerStyleId)?.name}</span> : null}
                  <span>{catalog.accessories.find((item) => item.id === turbanId)?.name ?? "None"} turban</span>
                  <span>{catalog.accessories.find((item) => item.id === shoeId)?.name ?? "Keep Existing"} shoes</span>
                  {bespokeProfile ? <span>Deep bespoke specification</span> : null}
                </div>
              </div>
            </>
          ) : null}
        </section>

        <div className="generate-area">
          <button
            type="button"
            className="generate-button"
            onClick={generateTryOn}
            disabled={!canGenerate}
            aria-describedby="privacy-note"
          >
            <span>{isGenerating ? "Creating your try-on…" : "Generate Try-On"}</span>
            <span className="button-arrow" aria-hidden="true">→</span>
          </button>
          <p id="privacy-note" className="privacy-note">
            <span className="privacy-lock" aria-hidden="true">◇</span>
            Photos are processed transiently and sent to OpenAI to create your try-on.
          </p>
        </div>

        {error ? (
          <div className="error-message" role="alert">
            <span aria-hidden="true">!</span><p>{error}</p>
          </div>
        ) : null}

        {isGenerating ? <GenerationState /> : null}
      </section>

      {resultUrl && personImage ? (
        <section ref={resultRef} className="result-section" aria-label="Your virtual try-on result">
          <TryOnResult
            resultUrl={resultUrl}
            originalUrl={personImage.previewUrl}
            summary={{
              garment: selectionMode === "outfit" ? "Uploaded outfit" : selectedSubtype?.name ?? selectedUpper?.name ?? "Men's look",
              ...(selectionMode === "catalog" && selectedLower ? { lower: selectedLower.name } : {}),
              fabric: "Uploaded fabric",
              turban: selectionMode === "outfit" ? "Not selected" : selectedTurban?.name ?? "None",
              shoes: selectionMode === "outfit" ? "Not selected" : selectedShoes?.name ?? "Keep Existing",
            }}
            onRegenerate={generateTryOn}
            onReset={startOver}
            isGenerating={isGenerating}
          />
        </section>
      ) : null}

      <footer className="site-footer">
        <span>NASIR BESPOKE</span><span aria-hidden="true">—</span>
        <span>Made for the perfect first impression.</span>
      </footer>
      </div>
    </main>
  );
}
