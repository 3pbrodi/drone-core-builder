# AI selection: conflict exclusion, verified pairing preference and review notice —2026-11-21

Baseline `4bc70564e4cddce40de262bf687c47ce69afe71e`, branch `feature/shared-drone-configurator`. This finishes Step5 using the existing bounded planner, native evaluator and Step4 validation report. No catalogue facts, approval gates, production data, API deployment, images or website deployment changed.

## Confirmed behavior and focused change

The planner already excluded credible field/pair conflicts and known native failures, and ranked fewer unresolved checks before performance/price at equal required-component coverage. Those policies remain. Search and upgrade paths now share the same rejection predicate; the existing conservative rejection of advisory failures is also preserved.

The uncovered gap was a coupled replacement: a bounded beam could retain a cheap controller and ESC with no exact pairing proof, then reject either individually more expensive replacement because neither alone improved verification. The same could happen with motor/propeller partners. The planner now explores exact pair replacements from the existing FC/ESC, motor/propeller and motor/ESC-current evidence records during its two upgrade passes. Tests reproduce both FC/ESC and motor/propeller recovery with beam width1.

These records are exploration hints, not approvals. Both products must survive the existing variant/requirement/conflict filters. The actual replacement must fit the whole-build budget and existing requirements, pass the common conflict gate, and yield a verified pass for its specific native pair rule under the currently selected battery/propeller conditions. Pending, wrong-authority, future-dated or out-of-context hints cannot bypass verification. Duplicate hints are collapsed without removing evidence from the resolver, so contradictory source verdicts still block the pair. Explicit parts cannot be added to duplicate a role already supplied by one of the proposed integrated/included components.

This adds work proportional to supplied pair records rather than a new Cartesian product of every controller/ESC or motor/propeller. Candidate order is deterministic. Required-component coverage still comes first; at equal coverage, fewer unresolved native/integration checks precede modeled performance, price and stable IDs. Stale prices and out-of-stock products remain eligible under existing policy. Hard incompatibilities are not exchanged for higher performance.

## Visible review status

AI builds now have a compact notice near the recommendation when the **current** shared validation result needs review. It shows verified-conflict or unverified-check counts, missing components where relevant, and the first unresolved check names. It uses the same report as the checklist rather than a stale initial planner flag. Manual changes, newly missing proofs and restored proofs update the notice; it disappears when listed checks pass.

“Review current checks” opens and focuses the existing checklist and scrolls to it. The checklist stays collapsed until the user opens it. Source links/explanations, the three Step4 result states and visible physical-fit/installed-firmware limitations remain unchanged. Green listed-check results do not certify full assembly fit or flight readiness. Initial AI profile requirements still use the existing recommendation/notes and are not silently converted into compatibility proof.

## Verification

- **28 focused Node tests passed in one run**, including six new policy/notice cases plus existing planner, compatibility-audit and three-state validation regressions. Cases cover narrow-beam coupled recovery, conditions/authority/dates, source disputes, contradictory verdicts, budget, stale/out-of-stock eligibility, deterministic input ordering, integrated-role coverage, serializable reports and revocation behavior.
- **390/1280px Chromium passed** the three states, source links/dates, live notice, review-link navigation, native keyboard checklist, fresh proof removal/restoration and no horizontal overflow. All data was synthetic and loopback-only. The fixture removes evidence for both primary and fallback reads.
- Typecheck and build passed, including the worker bundle. No package or lockfile changed. No authenticated cloud session, production endpoint or database was used by these tests.

Receipts: `qa/ai-selection-step5-20261121.json`, `qa/ai-selection-browser-20261121.json`. Detailed logs and original working-file preimages are private under `.private-backups/ai-selection-step5-20261121/`.

```sh
node --import tsx --test tests/ai-selection-policy.test.ts tests/ai-build-planner.test.ts tests/ai-compatibility-audit.test.ts tests/compatibility-validation.test.ts
node_modules/.bin/tsc --noEmit
CATALOGUE_LOCAL_ONLY=true node_modules/.bin/vite build
# Existing loopback fixture4289 + isolated Vite4190:
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
COMPATIBILITY_BROWSER_RECEIPT=qa/ai-selection-browser-20261121.json \
node tests/integration/compatibility-validation-browser.mjs
```

For browser replay, keep both catalogue runtime overrides at `http://127.0.0.1:4289`, `CATALOGUE_LOCAL_ONLY=true`, and auth configuration restricted to loopback placeholders. The receipt override preserves the prior Step4 browser artifact.

## Limits and rollback

Search remains bounded and deterministic, with two upgrade passes; recovery improves documented pair selection but is not a global-optimum guarantee. A complete verified build can still be unavailable within the budget, hard requirements or search bounds. Unknown checks remain visible; unresolved manufacturer fit, firmware and continuous-current claims are not filled from estimates or imported from the pending research CSV.

Revert only this scoped feature commit after preserving later work. No product/evidence withdrawal, schema rollback, import replay or runtime redeployment is involved. The earlier five-pair production activation, its38-migration mapping and all other local user work remain intact.
