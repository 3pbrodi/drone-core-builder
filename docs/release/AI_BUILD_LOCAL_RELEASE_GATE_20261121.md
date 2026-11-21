# AI build local release gate —2026-11-21

Tested application baseline `ce9981f9a8a826a6290c8d7d6068ecf52f33dcdf`, branch `feature/shared-drone-configurator`. The local AI behavior gate passed and a bounded release candidate is prepared for the evidence-aware proposal interface. **No application-source fix was needed.** Changes in this step are tests, local fixture scenarios, receipts and continuity documentation. No hosted request, production migration/import, API deployment, website deployment, release tag or merge was performed.

## Required scenario matrix

| Scenario | Expected and observed result |
| --- | --- |
| Valid build | Complete, within budget, verified compatible **for listed catalogue checks**; full installation/firmware limitations remain visible. |
| Mismatched wiring | A verified negative exact-pair verdict is verified incompatible and excluded by the AI. Missing connector/pinout/order/signal/voltage evidence or an unproven lookalike connector remains unverified. |
| Unsupported combination | Missing or wrong-cell motor/propeller proof remains unverified. An explicit verified manufacturer rejection is incompatible and excluded. No unsupported pair gains a verified label from size guidance. |
| Missing dimensions | Absent frame size/mount and propeller diameter are reported as missing/unverified. Neither planner nor report fills or mutates product facts. Other unmodeled assembled clearances remain outside verification even when basic checks pass. |
| Revoked evidence | Fresh missing, rejected, pending or unverified wiring proof cannot retain the old approval. A restored valid proof is recognized again. Native SQL withdrawal removes the proof from its public snapshot. |

## Executed checks

- **38 Node tests passed once, zero failures/skips.** This includes five new release-matrix cases, existing AI planner/policy/source/three-state regressions, and the native manufacturer-pair integration case.
- **Native local database rehearsal passed** in a disposable clone inside the existing `dronecores_catalogue_staging` container: five exact pair approval/readout/revocation paths and the existing negative provenance/permission checks. The review-room stub role uses clone-only policies; this is not a production role change. The source staging schema, relevant records and sequence fingerprints remained unchanged, and the clone was dropped. No second hosted project was created. The source migration's201229-to-production203933 mapping is unchanged and was not replayed remotely.
- **10 Chromium scenario outcomes passed**: all five matrix scenarios at390px and1280px, including live review notices, checklist navigation and no horizontal overflow. Rejected records still present in a defensive input packet and withdrawn rows removed from a fresh public-shaped packet were both covered, with restoration afterward. Browser requests were restricted to127.0.0.1; data was synthetic. The same fixture modes feed primary server and browser fallback reads.
- Typecheck and production-mode build passed with local-only catalogue configuration. No dependency/package/lockfile changed. Authentication/billing and a protected hosted Lovable session were not exercised by this AI gate.

Receipts: `qa/ai-build-local-release-20261121.json`, `qa/ai-build-release-browser-20261121.json`, `qa/ai-build-snapshot-release-20261121.json`. Protected logs are in `.private-backups/ai-build-release-20261121/`. The pre-existing native QA receipt is unchanged; no historical evidence was rewritten.

## Saved real-catalogue replay

A separate offline replay used the existing saved2026-11-21 public response, **133 unique products**, capture-file SHA256 `c4a00e1b2cda5655c47489948b7bc14239bd43d9ef672190adb25c5fa9badfbe`. This is a prior capture, **not a new production census or live offer check**. Network requests were disabled in the replay. All selected IDs came from that capture, totals stayed within budget, no selected source conflicts/verified failures were accepted, and all serialized source facts/observation times remained unchanged.

| Use case | Budget EUR | Sum of captured last-recorded prices EUR | Outcome |
| --- | ---: | ---: | --- |
| Beginner |400|320.74|Complete, unverified |
| Freestyle |800|306.31|Complete, unverified |
| Footage |900|312.43|Complete, unverified |
| Range |1200|406.33|Complete, unverified |

All four proposals still lack an exact verified **motor/propeller pairing** and comparable **motor/ESC continuous-current** evidence for the chosen operating conditions. The range proposal also has an unresolved **GPS/FC integration** check. These are real captured-data evidence gaps, not test failures or product reclassifications. Spending the remaining budget alone cannot establish more verified compatibility or a measured performance improvement.

## Release decision and remaining requirements

**Local software gate: passed.** Release preparation can proceed for an AI interface that explicitly presents evidence-aware proposals and unresolved checks. The release manifest is tied to the tested application baseline and the QA receipts; preserve their fingerprints when selecting the final feature commit.

**Fully hardware-verified build claims: not ready.** Resolve exact motor/propeller/current/GPS evidence for the relevant combinations, and obtain complete assembly dimensions/fastener clearances plus actual installed firmware/setup evidence before making those stronger claims. Preserve all current unverified labels, source citations and limitations. Do not promote the pending research CSV or alter published products to make tests green.

Before a separately authorized hosted rollout, verify the selected feature commit in the actual target preview, keep catalogue runtimev5/provenance support and its existing settings, then smoke-test initial matching, a manual incompatible change, unknown evidence and the evidence checklist. This local gate does not certify a logged-in hosted session or authorize public deployment.

Revocation tests require a **fresh response**. The existing production API has public max-age30/s-maxage60-second caching; an already-open selection is not a live subscription to database changes. Allow/invalidate that cache and refresh selected evidence when checking a real withdrawal. These tests establish replacement of old proof after a fresh read, not instantaneous global revocation delivery.

## Reproduce locally

```sh
DRONECORES_PAIR_LOCAL=1 DRONECORES_PAIR_ARCHIVES=/path/to/workspace-with-captures \
node --import tsx --test tests/ai-build-release.test.ts tests/ai-selection-policy.test.ts tests/ai-build-planner.test.ts tests/ai-compatibility-audit.test.ts tests/compatibility-validation.test.ts tests/manufacturer-pair-review.test.ts
node_modules/.bin/tsc --noEmit
CATALOGUE_LOCAL_ONLY=true node_modules/.bin/vite build
# Existing loopback fixture4289 + isolated Vite4190:
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/integration/ai-build-release-browser.mjs
# Optional offline real-catalogue replay; never fetches production:
AI_RELEASE_SNAPSHOT=/path/to/saved-public-response.json node --import tsx tests/integration/ai-build-snapshot-release.ts
```

Keep both runtime overrides at `http://127.0.0.1:4289`, `CATALOGUE_LOCAL_ONLY=true`, and only loopback auth placeholders for the local server. Fixture POST `/__test/evidence?mode=...` supports `complete`, `missing-wiring`, `mismatched-wiring`, `unsupported-combination`, `missing-dimensions`, `revoked-evidence`; it is bound to127.0.0.1 and changes only cloned in-memory test inputs.

Rollback of this testing/documentation commit requires no database or runtime reversal. Revert only the scoped commit after preserving later work. Application rollback still follows the Step4/Step5 scoped feature instructions; the separately applied five production pairings and their native withdrawal procedure remain unchanged. Never replay completed imports or migrations as part of a test rollback.
