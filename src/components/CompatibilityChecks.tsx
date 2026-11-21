import { compatibilityCoverageGaps } from "@/lib/compatibility-coverage";
import type { CompatibilityRuleResult, SelectedProducts } from "@/lib/build-calculations";
import type {
  CatalogueEvidenceSnapshot,
  CompatibilityEvidenceIssue,
} from "@/lib/catalogue-evidence";

function sourceLink(raw?: string | null) {
  try {
    const url = new URL(raw ?? "");
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function CompatibilityChecks({
  rules,
  selected,
  evidence,
  issues,
}: {
  rules: CompatibilityRuleResult[];
  selected: SelectedProducts;
  evidence: CatalogueEvidenceSnapshot;
  issues: CompatibilityEvidenceIssue[];
}) {
  const applicable = rules.filter((rule) => rule.applicable),
    passed = applicable.filter(
      (rule) => rule.status === "pass" && rule.evidenceLevel === "verified",
    ).length;
  const gaps = compatibilityCoverageGaps(selected);
  return (
    <details
      aria-label="Compatibility checklist"
      className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
    >
      <summary className="cursor-pointer font-medium">
        Compatibility checks · {passed}/{applicable.length + gaps.length} verified passes
      </summary>
      <div className="mt-3 space-y-3">
        {issues.length > 0 && (
          <ul className="list-disc space-y-1 pl-4">
            {issues.map((issue, i) => (
              <li key={i} className={issue.kind === "conflict" ? "text-destructive" : ""}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        <ul className="space-y-3">
          {applicable.map((rule) => {
            const sources = [
              ...new Set(
                evidence.fields
                  .filter(
                    (row) =>
                      row.verificationStatus === "verified" &&
                      rule.categories.some(
                        (category) =>
                          selected[category]?.id === row.productId &&
                          Object.hasOwn(rule.evidence, `${category}.${row.field}`),
                      ),
                  )
                  .map((row) => sourceLink(row.sourceUrl))
                  .filter((url): url is string => Boolean(url)),
              ),
            ];
            return (
              <li
                key={rule.code}
                data-compatibility-check={rule.code}
                className="space-y-1 border-l-2 border-border pl-3"
              >
                <p className="font-medium text-foreground">
                  {rule.code.replaceAll("_", " ")} ·{" "}
                  {rule.status === "pass" && rule.evidenceLevel === "verified"
                    ? "Verified compatible"
                    : rule.status === "fail" && rule.evidenceLevel === "verified"
                      ? "Verified incompatible"
                      : "Unverified"}
                </p>
                <p>{rule.explanation}</p>
                {rule.missingFields.length > 0 && <p>Missing: {rule.missingFields.join(", ")}</p>}
                {rule.unverifiedFields.length > 0 && (
                  <p>Evidence needed: {rule.unverifiedFields.join(", ")}</p>
                )}
                {sources.length > 0 && (
                  <p className="flex flex-wrap gap-3">
                    {sources.map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Source {i + 1}
                      </a>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {gaps.length > 0 && (
          <ul className="space-y-2">
            {gaps.map((gap) => (
              <li key={gap.code} data-compatibility-gap={gap.code}>
                <strong>{gap.code.replaceAll("_", " ")} · Unverified</strong>
                <p>{gap.explanation}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-1 border-t border-border pt-3">
          <h3 className="font-medium text-foreground">Additional review required</h3>
          <p>Listed checks do not verify full physical installation or flight readiness.</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Frame/stack mounting, camera clearance, motor shaft/propeller fit and battery
              retention need exact mechanical dimensions.
            </li>
            <li>
              Battery power connectors, VTX power/wiring and integrated ESC ratings need checks
              where the catalogue lacks matching data.
            </li>
            <li>
              Radio frequency bands, exact video ecosystem, firmware/setup and bench checks remain
              necessary; a matching protocol label alone is insufficient.
            </li>
          </ul>
          <p>
            Pair-test source links are not included in the current public evidence response; no
            missing source links are invented.
          </p>
        </div>
      </div>
    </details>
  );
}
