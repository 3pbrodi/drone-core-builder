import { AlertTriangle } from "lucide-react";
import type { CompatibilityValidation } from "@/lib/compatibility-validation";

/** Current selection only: recomputed by the shared build interface after edits. */
export function AiBuildReviewNotice({ validation }: { validation: CompatibilityValidation }) {
  if (validation.status === "verified-compatible") return null;
  const failed = validation.counts["verified-incompatible"],
    unknown = validation.counts.unverified;
  const message = failed
    ? `${failed} verified conflict${failed === 1 ? "" : "s"}`
    : [
        unknown ? `${unknown} unverified check${unknown === 1 ? "" : "s"}` : "",
        validation.missingCategories.length
          ? `${validation.missingCategories.length} missing component${validation.missingCategories.length === 1 ? "" : "s"}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ") || "Unresolved evidence";
  const labels = validation.checks
    .filter((c) => c.status !== "verified-compatible")
    .map((c) => c.label);
  return (
    <aside
      role="status"
      aria-live="polite"
      data-ai-selection-warning={validation.status}
      className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${failed ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-amber-500/40 bg-amber-500/5 text-foreground"}`}
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{message} · selection needs review</p>
        {labels.length > 0 && (
          <p className="break-words text-muted-foreground">
            {labels.slice(0, 2).join(", ")}
            {labels.length > 2 ? ` +${labels.length - 2} more` : ""}
          </p>
        )}
        <a
          href="#compatibility-checklist"
          className="underline"
          onClick={() => {
            const checklist = document.getElementById("compatibility-checklist");
            if (checklist instanceof HTMLDetailsElement) {
              checklist.open = true;
              checklist.querySelector("summary")?.focus();
            }
          }}
        >
          Review current checks
        </a>
      </div>
    </aside>
  );
}
