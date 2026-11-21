# AI compatibility audit and continuation —2026-11-21

Audited baseline: `f3c789711d2ac6932dc49c63f5d3197e992a317c`, branch `feature/shared-drone-configurator`. Scope is shared frontend evidence resolution, AI ranking and truthful compatibility reporting. Preserve unrelated user changes; no new architecture, database migration, product import, release-rule change, production write or deployment.

## Confirmed existing coverage

| Area | Existing behavior |
| --- | --- |
| Frame/motor and frame/prop | Verified mounting patterns and nominal size comparisons; nominal size is not a complete physical clearance measurement. |
| Battery | Separate motor, ESC and FC cell-count ranges. These fields are S, not volts. |
| Motor/prop | Exact manufacturer/official pair proof; absent proof falls back to explicitly unverified size guidance. |
| Motor/ESC | Exact current values, comparable continuous ratings and verified operating conditions. Peak/burst values cannot establish a continuous-current pass. |
| FC/ESC | Exact pair plus connector family, pinout, wire order, signal and voltage flags; matching connector names alone cannot verify wiring. |
| Camera/receiver | FC video/signal interfaces and appropriate power rails. |
| Optional/pilot | Radio protocol, goggles ecosystem, battery/charger/accessory, VTX camera/antenna, GPS and buzzer rules. Rules enter only when corresponding roles are selected. |
| Data/selection | Shared evaluator, 50-row pagination, scoped exact-ID/evidence reads, public fallback, fresh selected proof replacement, pack-budget calculation, worker optimization and separately labeled estimates. |

There are12 core rules plus8 optional/pilot rules, not20 universally applicable checks. Existing native math and direct-evidence evaluator contracts were preserved. All four existing native compatibility/evidence test files passed.

## Defects found and implemented fixes

1. **Conflicting evidence depended on order.** Field resolution accepted a matching row even if another trusted currently verified row disagreed. Pair resolution used the first matching record. The resolver now groups credible field assertions and applicable pair verdicts; disagreement with the product or another applicable credible assertion creates an explicit conflict. Disputed proofs do not verify a check. AI excludes affected variants/combinations, while manual selection remains possible with a review warning. Unrelated candidate badges are not downgraded by an unrelated selected-product conflict. Verified native failures retain their failure state.
2. **Source/time/unit gates were incomplete.** Non-null timestamp strings were sufficient and field authority/units were ignored. Field assertions now need a nonempty source ID, manufacturer/official/retailer authority, parseable retrieval/verification times (five-minute future clock-skew tolerance), exact association and compatible declared units for known numerical fields. Community/demo assertions cannot supply verified technical fields. Missing optional units retain the existing typed API convention; explicit V claims cannot verify an S field. Old technical proofs do not expire merely because an offer is stale. Optional field source URLs remain backward compatible; no URL is invented.
3. **Motor test conditions were not selection-bound.** Any nonempty operatingConditions object could verify a pair, even for a different battery/propeller. Exact motor/propeller tests now require the selected battery cell context. Current tests also require an exact selected propeller ID. Supported condition keys: batteryCells or minBatteryCells/maxBatteryCells; propeller or propellerId; an explicit propellers array for multiple exact tested IDs; optional motorKv must also match. Aliases supplied together must agree. Missing/malformed context is unverified. Different test verdicts under different cell conditions do not become artificial conflicts; contradictory applicable verdicts do. Test source values still must match the catalogue current values.
4. **Modeled performance could outweigh source certainty.** At equal fulfilled component count, AI now ranks fewer unresolved checks before its use-case score, then price/stable IDs. Battery-first electrical ordering makes test conditions available before motor/prop evaluation. Useful budget upgrades remain possible when verification certainty is equal. Missing proof still yields an explicitly unverified proposal rather than fabricated completion.
5. **Integration could appear better because checks were skipped.** `compatibilityCoverageGaps` explicitly counts omitted integrated ESC voltage/current and integrated FC supply/camera/receiver checks. Neither AI nor the whole-build status treats their omission as a verified pass. These gaps require actual evidence/rule support later; integration metadata alone cannot fill them.
6. **Verification scope was easy to overread.** The result now says catalogue/listed checks rather than blanket hardware approval. A collapsed checklist shows pass/unverified/incompatible explanations, missing fields, available field source links, source conflicts and integration gaps. Physical fit remains visibly unverified; expanded notes identify what the current rules do not cover. All current build origins use the same resolver/reporting and preserve existing compact layout and estimates. Flight speed is suppressed for selected evidence conflicts.

## Remaining evidence and functionality gaps

- Exact mechanical fit: FC/ESC stack patterns and height, camera frame bay/clearance, propeller shaft/hub, screw lengths and battery retention. Existing motor mount/nominal frame size fields must not be repurposed as these facts.
- Power installation: battery/ESC connector and wire capability, VTX supply/pinout and onboard ESC ratings. Integrated-role gaps are now visible but not magically validated.
- Radio/goggles: same protocol text does not prove compatible frequency band/firmware or every video hardware generation. Existing radio/goggle checks only run when that gear is actually selected.
- Pair source provenance: the public pair-evidence shape does not include source URLs/IDs for the checklist; motor-current pair authority is also not represented in that shape. Backend verified/exact-product flags remain its upstream trust boundary. A later reviewed transport/data change should expose complete immutable pair source references. No fabricated link or new database table was added here.
- Exact manufacturer motor/propeller operating tables and FC/ESC wiring coverage remain sparse. The old cached snapshot has996 field proofs, zero motor/propeller pairs, zero motor/current pairs and one FC/ESC pair. Product DATA approval is distinct from assembly compatibility evidence.
- Estimates are still engineering scenarios, not measured flight data or compatibility evidence. Search remains bounded; manual physical/firmware/bench validation is still needed.

Next development step: prepare a bounded set of exact manufacturer pair/mechanical dossiers and the corresponding scoped transport/schema proposal, using the existing review process. Only then can currently unknown checks become verified. Production application remains a separate action; do not weaken the gates or populate facts from estimates.

## Verification evidence

-18 Node tests passed across existing AI/planner/performance plus7 new audit cases. One additional integrated-role regression passed after that fix:19 distinct Node cases total. Tests cover conflicting source ordering, exact context, field dates/authority/units, preferred supported compatibility, context-first search and integration certainty.
-42 existing Bun tests passed across catalogue-evidence, build-calculations, camera-receiver-compatibility and extended-compatibility (223 assertions). Two existing resolver tests were updated to supply the battery/propeller context they now require; their verified result is no longer claimed for a partial selection.
-TypeScript and Vite build passed, including worker compilation. Generic existing TanStack deprecation/build-size warnings remain outside scope.
-Chromium390/1280px passed: actual spinner movement/worker, four answers, compact collapsed report, checklist/source links, explicit physical-fit scope, model estimates, manual changes/recalculation, Skip clearing, range GPS, conflict blocking and no overflow. All browser data/network remained loopback-only synthetic fixtures. QA `qa/ai-compatibility-audit-20261121.json`.
-Offline comparison against the previously captured133-product public snapshot retained all996 verified fields and found no field-conflicting variants. Revised freestyle/range proposals still contain complete components but remain UNVERIFIED due to missing exact motor/propeller, current, wiring and/or GPS evidence. No new production query was made. Protected log/snapshot references: `.private-backups/ai-compatibility-audit-20261121/`.

Repeat:

```sh
node --import tsx --test tests/ai-build-planner.test.ts tests/ai-performance.test.ts tests/ai-compatibility-audit.test.ts
bun test tests/catalogue-evidence.test.ts tests/build-calculations.test.ts tests/camera-receiver-compatibility.test.ts tests/extended-compatibility.test.ts
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
node --import tsx tests/integration/ai-build-fixture.ts
```

This environment used an ephemeral npm-exec Bun runtime; no repository package/lockfile changed. For browser replay, start isolated Vite4190 with CATALOGUE_LOCAL_ONLY=true and both runtime overrides pinned to http://127.0.0.1:4289/query, local test auth URL/key and no Supabase server credentials. Run `PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/integration/ai-build-browser.mjs`.

Rollback: revert only this scoped feature commit after preserving later work. No database rollback/import/publication operation is involved. Do not rewrite history or reset unrelated local work.
