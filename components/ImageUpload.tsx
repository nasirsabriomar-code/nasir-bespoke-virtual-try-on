"use client";

import { useRef, useState } from "react";

type ImageUploadProps = {
  id: string;
  label: string;
  description: string;
  guidance: string;
  file: File | null;
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  /** One-row layout for cloth inside a builder step. */
  compact?: boolean;
};

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export function ImageUpload({
  id,
  label,
  description,
  guidance,
  file,
  previewUrl,
  onSelect,
  onRemove,
  disabled = false,
  compact = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function openCamera() {
    if (!disabled) cameraInputRef.current?.click();
  }

  function chooseFile(fileList: FileList | null) {
    const selected = fileList?.[0];
    if (selected && !disabled) onSelect(selected);
    if (inputRef.current) inputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files);
  }

  const input = (
    <input
      ref={inputRef}
      id={id}
      className="upload-input"
      type="file"
      accept={ACCEPTED_IMAGES}
      aria-label={`Upload ${label.toLowerCase()}`}
      onChange={(event) => chooseFile(event.target.files)}
      disabled={disabled}
    />
  );

  const cameraInput = (
    <input
      ref={cameraInputRef}
      className="upload-input"
      type="file"
      accept="image/*"
      capture="environment"
      aria-label={`Take ${label.toLowerCase()} with camera`}
      onChange={(event) => chooseFile(event.target.files)}
      disabled={disabled}
    />
  );

  if (compact) {
    return (
      <div className="upload-compact">
        {input}
        {cameraInput}
        <div className="upload-compact-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previewUrl && file ? <img src={previewUrl} alt={`${label} preview`} /> : <span aria-hidden="true">No cloth photo</span>}
        </div>
        <div className="upload-compact-body">
          <strong>{label}</strong>
          <div className="upload-compact-actions" aria-label={`${label} image actions`}>
            <button type="button" onClick={openPicker} disabled={disabled}>{previewUrl && file ? "Change" : "Upload"}</button>
            <button type="button" onClick={openCamera} disabled={disabled}>Camera</button>
            {previewUrl && file ? <button type="button" onClick={onRemove} disabled={disabled}>Remove</button> : null}
          </div>
          <p className="upload-compact-guidance">{guidance}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-column">
      <div className="upload-heading">
        <h2>{label}</h2>
        <p>{description}</p>
      </div>

      {previewUrl && file ? (
        <div className="upload-preview">
          {input}
          {cameraInput}
          {/* Blob URLs are transient user images and intentionally bypass framework optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`${label} preview`} />
          <div className="preview-actions" aria-label={`${label} image actions`}>
            <button type="button" onClick={openPicker} disabled={disabled}>
              Change
            </button>
            <button type="button" onClick={openCamera} disabled={disabled}>
              Camera
            </button>
            <button type="button" onClick={onRemove} disabled={disabled}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`upload-dropzone${isDragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragging(false);
            }
          }}
          onDrop={handleDrop}
        >
          {input}
          {cameraInput}
          <div className="upload-empty">
            <span className="upload-icon" aria-hidden="true">↑</span>
            <strong>Choose or take a photo</strong>
            <div className="upload-choice-actions">
              <button
                type="button"
                disabled={disabled}
                onClick={openPicker}
              >
                Choose from device
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={openCamera}
              >
                Use camera
              </button>
            </div>
            <span>or drag and drop here<br />JPG, PNG, or WebP · original quality · up to 50 MB</span>
          </div>
        </div>
      )}

      <p className="upload-guidance">
        <strong>Best results</strong>
        {guidance}
      </p>
    </div>
  );
}
