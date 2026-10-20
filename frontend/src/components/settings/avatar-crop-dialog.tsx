"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const OUTPUT_SIZE = 1024;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.01;

interface ImageDimensions {
  width: number;
  height: number;
}

interface Offset {
  x: number;
  y: number;
}

interface AvatarCropDialogProps {
  file: File | null;
  uploading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getOffsetLimits(
  imageDimensions: ImageDimensions,
  previewSize: number,
  zoom: number,
): Offset {
  const scale = (previewSize / Math.min(imageDimensions.width, imageDimensions.height)) * zoom;
  return {
    x: Math.max(0, (imageDimensions.width * scale - previewSize) / 2),
    y: Math.max(0, (imageDimensions.height * scale - previewSize) / 2),
  };
}

function clampOffset(
  offset: Offset,
  imageDimensions: ImageDimensions,
  previewSize: number,
  zoom: number,
): Offset {
  const limits = getOffsetLimits(imageDimensions, previewSize, zoom);
  return {
    x: clamp(offset.x, -limits.x, limits.x),
    y: clamp(offset.y, -limits.y, limits.y),
  };
}

export function AvatarCropDialog({
  file,
  uploading = false,
  error,
  onCancel,
  onConfirm,
}: AvatarCropDialogProps) {
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offset: Offset;
  } | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [previewSize, setPreviewSize] = useState(0);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [imageError, setImageError] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);

  const baseImageSize = useMemo(() => {
    if (!imageDimensions || previewSize === 0) return null;
    const scale = previewSize / Math.min(imageDimensions.width, imageDimensions.height);
    return {
      width: imageDimensions.width * scale,
      height: imageDimensions.height * scale,
    };
  }, [imageDimensions, previewSize]);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setImageDimensions(null);
      setPreviewElement(null);
      setPreviewSize(0);
      setImageError(null);
      setCropError(null);
      return;
    }

    const url = URL.createObjectURL(file);
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      setImageDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      setImageError(null);
    };
    image.onerror = () => {
      if (cancelled) return;
      setImageDimensions(null);
      setImageError("This image could not be loaded. Please choose another file.");
    };
    image.src = url;
    setObjectUrl(url);
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setCropError(null);

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const setPreviewRef = useCallback((node: HTMLDivElement | null) => {
    setPreviewElement(node);
  }, []);

  useEffect(() => {
    if (!previewElement) return;

    const updatePreviewSize = () => {
      setPreviewSize(previewElement.clientWidth);
    };
    updatePreviewSize();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updatePreviewSize);
    observer.observe(previewElement);
    return () => observer.disconnect();
  }, [previewElement]);

  useEffect(() => {
    if (!imageDimensions || previewSize === 0) return;
    setOffset((current) => clampOffset(current, imageDimensions, previewSize, zoom));
  }, [imageDimensions, previewSize, zoom]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!baseImageSize || uploading) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId || !imageDimensions) {
      return;
    }
    const drag = dragRef.current;
    setOffset(
      clampOffset(
        {
          x: drag.offset.x + event.clientX - drag.startX,
          y: drag.offset.y + event.clientY - drag.startY,
        },
        imageDimensions,
        previewSize,
        zoom,
      ),
    );
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const createCroppedFile = async (): Promise<File> => {
    if (!file || !objectUrl || !imageDimensions || !baseImageSize || previewSize === 0) {
      throw new Error("The image is still loading. Please try again.");
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loadedImage = new window.Image();
      loadedImage.onload = () => resolve(loadedImage);
      loadedImage.onerror = () => reject(new Error("This image could not be cropped."));
      loadedImage.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");

    const displayScale = (previewSize / Math.min(imageDimensions.width, imageDimensions.height)) * zoom;
    const renderedWidth = imageDimensions.width * displayScale;
    const renderedHeight = imageDimensions.height * displayScale;
    const imageLeft = (previewSize - renderedWidth) / 2 + offset.x;
    const imageTop = (previewSize - renderedHeight) / 2 + offset.y;
    const sourceSize = previewSize / displayScale;
    const sourceX = clamp(-imageLeft / displayScale, 0, imageDimensions.width - sourceSize);
    const sourceY = clamp(-imageTop / displayScale, 0, imageDimensions.height - sourceSize);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("Your browser could not prepare this image."))),
        "image/jpeg",
        0.92,
      );
    });

    return new File([blob], "profile-picture.jpg", { type: "image/jpeg" });
  };

  const handleConfirm = async () => {
    setCropError(null);
    try {
      await onConfirm(await createCroppedFile());
    } catch (error: unknown) {
      setCropError(error instanceof Error ? error.message : "Could not prepare this image.");
    }
  };

  const handleCancel = () => {
    if (!uploading) onCancel();
  };

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust profile picture</DialogTitle>
          <DialogDescription>
            Drag the image to position it, then use the zoom slider. Your picture will be cropped square and shown in a circle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            ref={setPreviewRef}
            role="img"
            aria-label="Profile picture crop preview"
            className={`relative mx-auto aspect-square w-full max-w-[280px] select-none overflow-hidden rounded-md bg-black/10 ${
              uploading ? "cursor-wait" : "cursor-grab active:cursor-grabbing"
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            {objectUrl && baseImageSize && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                style={{
                  width: baseImageSize.width * zoom,
                  height: baseImageSize.height * zoom,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-3 rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            {!imageDimensions && !imageError && (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                Loading preview...
              </p>
            )}
          </div>

          {imageError && <p className="text-xs text-destructive">{imageError}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {cropError && <p className="text-xs text-destructive">{cropError}</p>}

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <label htmlFor="avatar-zoom">Zoom</label>
              <span>{zoom.toFixed(1)}x</span>
            </div>
            <input
              id="avatar-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              disabled={!imageDimensions || uploading}
              aria-label="Zoom profile picture"
              className="w-full accent-foreground"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOffset({ x: 0, y: 0 })} disabled={uploading}>
            Reset position
          </Button>
          <Button variant="secondary" onClick={handleCancel} disabled={uploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!imageDimensions || Boolean(imageError) || uploading}
          >
            {uploading ? "Uploading..." : "Use photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
