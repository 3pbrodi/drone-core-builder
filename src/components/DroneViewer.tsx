import { useMemo, useState } from "react";
import { Image as ImageIcon, ImageOff } from "lucide-react";
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

export function DroneViewer({ selection }: { selection: BuildSelection }) {
  const reference = useMemo(() => chooseReferenceSet(selection), [selection]);
  const [view, setView] = useState<PreviewView>("front");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activeImage = reference.images[view];
  const hasAnySelection = Object.keys(selection).length > 0;
  const activeFailed = failedImages[activeImage] === true;

  return (
    <section
      aria-label="Drone preview"
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-sm font-medium text-primary">
        <ImageIcon className="size-4" aria-hidden />
        Drone Preview
      </div>

      <div className="mt-4">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          Your Drone
        </h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Realistic preview based on your selected components
        </p>
      </div>

      <div className="mt-5 grid h-[260px] place-items-center overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-b from-background to-brand-soft p-4 sm:h-[330px] lg:h-[390px]">
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
          <img
            key={activeImage}
            src={activeImage}
            alt={`${reference.label} — ${viewLabels[view]} illustrative drone reference`}
            className={`max-h-[86%] max-w-[90%] -translate-y-1 object-contain object-center sm:max-h-[84%] sm:max-w-[88%] ${view === "top" ? "mix-blend-multiply" : ""}`}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailedImages((current) => ({ ...current, [activeImage]: true }))}
          />
        )}
      </div>

      <div
        className="mx-auto mt-5 grid max-w-3xl grid-cols-3 gap-2 sm:gap-3"
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
              className={`flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-2xl border px-2 py-2 text-xs font-medium transition-colors sm:min-h-16 sm:gap-3 sm:px-3 sm:text-sm ${
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
    </section>
  );
}
