import { useEffect, useMemo, useRef, useState, type TouchEvent, type PointerEvent, type WheelEvent } from "react";
import { Image as ImageIcon, ImageOff, Maximize2, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { BuildSelection } from "@/lib/build-data";

type PreviewView = "front" | "top" | "bottom";
type ReferenceSet = {
  label: string;
  sourceUrl: string;
  images: Record<PreviewView, string>;
};

const referenceSets: Record<"freestyle" | "longRange" | "cinematic", ReferenceSet> = {
  freestyle: {
    label: "iFlight Nazgul Evoque F5 V2",
    sourceUrl: "https://shop.iflight.com/Nazgul-Evoque-F5-V2-6S-Pro1954",
    images: {
      front: "https://www.shopsta.co.uk/cdn/shop/products/0edcd0e0-e80f-4b6e-b57b-d0135dede32e_700x700.png?v=1686076083",
      top: "https://www.drone-fpv-racer.com/75462-large_default/nazgul-evoque-f5d-v2-6s-dji-o4-pro-bnf-crossfire-gps-by-iflight.jpg",
      bottom: "https://www.shopsta.co.uk/cdn/shop/products/f49d21e6-d300-424a-9d3c-e03f1f2e9625_700x700.png?v=1686077561",
    },
  },
  longRange: {
    label: "iFlight Chimera7 Pro V2",
    sourceUrl: "https://shop.iflight.com/Chimera7-Pro-V2-6S-Pro1947",
    images: {
      front: "https://pyrodrone.com/cdn/shop/files/Chimera7_Pro_V2_Analog_2_9bef496b-341c-4a83-a6b6-c7761e640167_700x700.png?v=1685382506",
      top: "https://www.drone-fpv-racer.com/77393-large_default/chimera7-pro-v2-hd-6s-dji-o4-pro-bnf-crossfire-gps-by-iflight.jpg",
      bottom: "https://viatec.ua/upload/images/13-243/Chimera7%20Pro%20V2%206S4.webp",
    },
  },
  cinematic: {
    label: "iFlight Defender 25",
    sourceUrl: "https://shop.iflight.com/Defender-25-O4-4S-HD-Pro2329",
    images: {
      front: "https://uk.robotshop.com/cdn/shop/files/iflight_defender_25_frame_kit_1_1200x1200.webp?v=1733931949",
      top: "https://iflight-rc.eu/cdn/shop/files/Defender-25-hd-6.png?v=1745004546&width=1000",
      bottom: "https://cdn.getmidnight.com/8aee729bc77d09ed01e86b375983212f/2023/11/Defender-25-hd-5.webp",
    },
  },
};

const viewLabels: Record<PreviewView, string> = {
  front: "Front view",
  top: "Top view",
  bottom: "Bottom view",
};

function chooseReferenceSet(selection: BuildSelection): ReferenceSet {
  if (selection.frame === "frame3") return referenceSets.cinematic;
  if (selection.frame === "frame7" || selection.battery === "battery6long") return referenceSets.longRange;
  return referenceSets.freestyle;
}

const clampZoom = (value: number) => Math.min(5, Math.max(1, value));
const touchDistance = (touches: TouchEvent<HTMLDivElement>["touches"]) => {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
};

function PhotoLightbox({
  src,
  alt,
  topView,
  onClose,
}: {
  src: string;
  alt: string;
  topView: boolean;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const touchGesture = useRef({
    distance: 0,
    zoom: 1,
    x: 0,
    y: 0,
    originX: 0,
    originY: 0,
  });
  const pointerPan = useRef<{
    id: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);

  const applyZoom = (nextZoom: number) => {
    const clamped = clampZoom(nextZoom);
    setZoom(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      touchGesture.current.distance = touchDistance(event.touches);
      touchGesture.current.zoom = zoom;
      return;
    }
    const touch = event.touches[0];
    if (touch && zoom > 1) {
      touchGesture.current.x = touch.clientX;
      touchGesture.current.y = touch.clientY;
      touchGesture.current.originX = offset.x;
      touchGesture.current.originY = offset.y;
    }
  };

  const onTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const distance = touchDistance(event.touches);
      if (touchGesture.current.distance > 0) {
        applyZoom(touchGesture.current.zoom * (distance / touchGesture.current.distance));
      }
      return;
    }
    const touch = event.touches[0];
    if (touch && zoom > 1) {
      event.preventDefault();
      setOffset({
        x: touchGesture.current.originX + touch.clientX - touchGesture.current.x,
        y: touchGesture.current.originY + touch.clientY - touchGesture.current.y,
      });
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerPan.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pan = pointerPan.current;
    if (!pan || pan.id !== event.pointerId || zoom <= 1) return;
    setOffset({
      x: pan.originX + event.clientX - pan.x,
      y: pan.originY + event.clientY - pan.y,
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerPan.current?.id === event.pointerId) {
      pointerPan.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    applyZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen drone preview"
      className="fixed inset-0 z-[100] flex h-dvh w-screen flex-col bg-background/98 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card/90 px-3 py-2 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">Drone Preview</p>
          <p className="text-[11px] text-muted-foreground">Pinch or scroll to zoom · drag to move</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => applyZoom(zoom - 0.5)}
            disabled={zoom <= 1}
            aria-label="Zoom out"
            className="grid size-11 place-items-center rounded-xl border border-border bg-card text-foreground disabled:opacity-40"
          >
            <ZoomOut className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Reset zoom"
            className="grid size-11 place-items-center rounded-xl border border-border bg-card text-foreground"
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => applyZoom(zoom + 0.5)}
            disabled={zoom >= 5}
            aria-label="Zoom in"
            className="grid size-11 place-items-center rounded-xl border border-border bg-card text-foreground disabled:opacity-40"
          >
            <ZoomIn className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close full-screen preview"
            className="grid size-11 place-items-center rounded-xl border border-border bg-card text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden bg-gradient-to-b from-background to-brand-soft"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={() => (zoom > 1 ? reset() : applyZoom(2.5))}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={`max-h-[92%] max-w-[94%] object-contain object-center transition-transform duration-75 ${topView ? "mix-blend-multiply" : ""} ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})` }}
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}

export function DroneViewer({ selection }: { selection: BuildSelection }) {
  const reference = useMemo(() => chooseReferenceSet(selection), [selection]);
  const [view, setView] = useState<PreviewView>("front");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const activeImage = reference.images[view];
  const hasAnySelection = Object.keys(selection).length > 0;
  const activeFailed = failedImages[activeImage] === true;

  return (
    <section
      aria-label="Drone preview"
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-medium text-primary">
          <ImageIcon className="size-4" aria-hidden />
          Drone Preview
        </div>

        <div className="min-w-0 sm:max-w-[62%] sm:text-right">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
            Your Drone
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm lg:text-base">
            Realistic preview based on your selected components
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex h-[clamp(250px,46vw,480px)] w-full items-center justify-center overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-b from-background to-brand-soft p-[clamp(14px,3vw,32px)]">
        {!hasAnySelection ? (
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
              <ImageIcon className="size-7" aria-hidden />
            </span>
            <p className="mt-3 font-display text-lg font-bold text-foreground">
              Your drone preview will appear here
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Select components below to start building your drone.
            </p>
          </div>
        ) : activeFailed ? (
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <ImageOff className="size-7" aria-hidden />
            </span>
            <p className="mt-3 font-display text-lg font-bold text-foreground">
              Preview image unavailable
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your build data is unaffected. Try another view or reload the page.
            </p>
          </div>
        ) : (
          <>
            <img
              key={activeImage}
              src={activeImage}
              alt={`${reference.label} — ${viewLabels[view]} illustrative drone reference`}
              className={`block h-auto max-h-full w-auto max-w-full cursor-zoom-in object-contain object-center ${view === "top" ? "mix-blend-multiply" : ""}`}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onClick={() => setLightboxOpen(true)}
              onError={() => setFailedImages((current) => ({ ...current, [activeImage]: true }))}
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label="Open drone image full screen"
              className="absolute right-3 top-3 grid size-11 place-items-center rounded-xl border border-border bg-card/90 text-foreground shadow-sm backdrop-blur transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Maximize2 className="size-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      <div
        className="mx-auto mt-4 grid max-w-3xl grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3"
        aria-label="Drone preview views"
      >
        {(Object.keys(viewLabels) as PreviewView[]).map((option) => {
          const selected = view === option;
          const optionImage = reference.images[option];
          const failed = failedImages[optionImage] === true;

          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setView(option)}
              className={`flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium transition-colors sm:min-h-16 sm:gap-3 sm:text-sm ${
                selected
                  ? "border-primary bg-secondary text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-card sm:size-11">
                {failed ? (
                  <ImageOff className="size-4 text-muted-foreground/60" aria-hidden />
                ) : (
                  <img
                    src={optionImage}
                    alt=""
                    aria-hidden
                    className={`size-full object-contain ${option === "top" ? "mix-blend-multiply" : ""}`}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImages((current) => ({ ...current, [optionImage]: true }))}
                  />
                )}
              </span>
              <span className="truncate">{viewLabels[option]}</span>
            </button>
          );
        })}
      </div>

      <p className="mx-auto mt-3 max-w-3xl text-center text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
        Illustrative reference only. Final appearance may vary.
      </p>
      {lightboxOpen && (
        <PhotoLightbox
          src={activeImage}
          alt={`${reference.label} — ${viewLabels[view]} illustrative drone reference`}
          topView={view === "top"}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </section>
  );
}
