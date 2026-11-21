import type { CompatibilityRuleResult, SelectedProducts } from "@/lib/build-calculations";
import {
  resolveCompatibilityEvidence,
  type CatalogueEvidenceSnapshot,
  type CompatibilityEvidenceIssue,
  type ResolvedCompatibilityEvidence,
} from "@/lib/catalogue-evidence";
import {
  createCompatibilityValidation,
  compatibilityValidationLabels,
  type CompatibilityValidation,
} from "@/lib/compatibility-validation";

export function CompatibilityChecks({
  rules,
  selected,
  evidence,
  report,
}: {
  rules: CompatibilityRuleResult[];
  selected: SelectedProducts;
  evidence: CatalogueEvidenceSnapshot;
  issues: CompatibilityEvidenceIssue[];
  pairSources: ResolvedCompatibilityEvidence["pairSources"];
  report?: CompatibilityValidation;
}) {
  const validation =
    report ??
    createCompatibilityValidation(
      selected,
      evidence,
      resolveCompatibilityEvidence(selected, evidence),
      rules,
    );
  return (
    <details
      aria-label="Compatibility checklist"
      className="mt-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"
    >
      <summary className="cursor-pointer font-medium">
        Compatibility checks · {validation.counts["verified-compatible"]}/{validation.checks.length}{" "}
        verified passes
      </summary>
      <div className="mt-3 space-y-3">
        {validation.issues.length > 0 && (
          <ul className="list-disc space-y-1 pl-4">
            {validation.issues.map((issue, i) => (
              <li key={i} className={issue.kind === "conflict" ? "text-destructive" : ""}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        <ul className="space-y-3">
          {validation.checks.map((check) => (
            <li
              key={check.code}
              data-compatibility-check={check.code}
              data-validation-status={check.status}
              className="space-y-1 border-l-2 border-border pl-3"
            >
              <p
                className={`font-medium ${check.status === "verified-compatible" ? "text-emerald-600" : check.status === "verified-incompatible" ? "text-destructive" : "text-foreground"}`}
              >
                {check.label} · {compatibilityValidationLabels[check.status]}
              </p>
              <p>{check.explanation}</p>
              {check.missingFields.length > 0 && <p>Missing: {check.missingFields.join(", ")}</p>}
              {check.unverifiedFields.length > 0 && (
                <p>Evidence needed: {check.unverifiedFields.join(", ")}</p>
              )}
              {check.sources.length > 0 && (
                <ul className="space-y-1">
                  {check.sources.map((source, i) => (
                    <li key={`${source.sourceId}:${source.field}:${i}`} className="break-words">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          Source · {new URL(source.url).hostname}
                        </a>
                      ) : (
                        <span>Source ID: {source.sourceId}</span>
                      )}
                      {source.field && <span> · {source.field}</span>}
                      {source.usage === "disputed" && (
                        <span className="text-destructive"> · Conflicting evidence</span>
                      )}
                      {source.usage === "reference" && <span> · Reference only</span>}
                      {source.retrievedAt && (
                        <span>
                          {" "}
                          · Retrieved{" "}
                          <time dateTime={source.retrievedAt}>
                            {source.retrievedAt.slice(0, 10)}
                          </time>
                        </span>
                      )}
                      {source.scope && <p>{source.scope}</p>}
                      {source.locator && <p>{source.locator}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {check.sourceReferenceUnavailable && (
                <p>
                  {check.status === "unverified"
                    ? "A verified source reference for this check is missing."
                    : "The native proof does not expose a public source reference."}
                </p>
              )}
            </li>
          ))}
        </ul>
        <div className="space-y-1 border-t border-border pt-3">
          <h3 className="font-medium text-foreground">Additional review required</h3>
          {validation.limitations.map((text) => (
            <p key={text}>{text}</p>
          ))}
          <p>
            Frame/stack clearances, fasteners, propeller shafts, battery retention, wiring and
            actual firmware/setup require separate checks. Sources support only their documented
            fields or exact pairing conditions.
          </p>
        </div>
      </div>
    </details>
  );
}
