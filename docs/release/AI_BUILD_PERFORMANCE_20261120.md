# AI Build performance and loading, 2026-11-20

Scope: the five requested website changes on `feature/shared-drone-configurator`. No database writes/migrations, credentials, new packages, staging changes or deployment.

## 1. Make useful use of the budget

The existing native constrained selection now retains192alternatives per stage, including spend/frame/battery diversity, and always tries the consumer-first order too. Complete-build utility includes engineering estimates of speed, thrust-to-weight, mass and hover endurance, weighted by the selected use case. Range emphasizes estimated endurance; freestyle emphasizes speed/thrust-to-weight; filming emphasizes endurance and reserve; beginner emphasizes lower mass and manageable reserve. Existing documented size/KV/capacity/interface preferences remain. Filming quality, crash protection and real range cannot be established from absent camera/airframe evidence.

Two improvement passes consider each category and paired motor/battery and frame/propeller changes, allowing useful upgrades that would otherwise be blocked by an intermediate mismatch. A change must improve the use-case objective, preserve native compatibility checks and stay within the full-pack budget. Identical performance at a higher price earns nothing; unspent money can therefore remain when no supported improvement exists. Documented out-of-stock/stale policies and fresh exact-ID/evidence recheck remain unchanged. The search remains bounded, not a proof of a global maximum or actual flight performance.

## 2. Estimated takeoff mass

`build-performance-estimates.ts` is separate from product data, evidence and the strict native evaluator. All three configurator origins use its UI output. Listed complete installed masses are normalized by actual quad installation count. Missing/partial mass uses up to three matching-size, same-category peers, favoring explicitly described matching material and chemistry. Motor stator dimensions, frame/prop diameter, battery cells/capacity, camera/receiver dimensions or mounts identify comparable classes. Dissimilar dimensions are rejected. The peer median uses a30% scenario variation, bounded below by an explicit partial mass when known.

Without suitable peers, a clearly identified component-class model uses size (motor stator volume, frame/prop diameter scaling, battery chemistry/energy etc.), with50% variation. No donor or material is invented. Referenced product IDs and method remain available in Estimate details. Assembly allowance is max(8g,10+3×frame inches) plus4% of component mass, with50% variation, for wiring/fasteners/mounting. Unselected payloads are excluded; pilot gear is excluded; integrated units are not duplicated. Required components must be present for a takeoff total. Even all-listed components do not yield a measured takeoff mass because assembly remains modeled.

The explicit request supersedes historical blanket suppression for these labeled estimates only. Source masses and measurement basis/scope remain byte-for-byte unchanged. Estimated values never become release evidence, source-backed weight-limit certification or compatibility passes. The legacy native stats remain separate.

## 3. Estimated maximum speed

A simplified steady level-flight model in still air, using SI internally:

- Battery cell counts are converted to nominal volts:3.7V LiPo,3.8V LiHV,3.6V Li-ion. Loaded voltage assumes10% sag. Loaded RPM is KV×loaded volts×load factor (central75%, scenarios65–85%); rps=RPM/60.
- Electrical power is bounded by battery Ah×C, per-motor current and controller rating where listed. If discharge C is absent, the model explicitly assumes35C for LiPo/LiHV or8C for Li-ion; a C label is an upper bound, not measured output. ESC/motor limits do not prove the operating current of this combination.
- Four-rotor shaft power is `4 Cp rho n³ D⁵`; static thrust is `4 Ct rho n² D⁴`. Current-limited power caps loaded rps via the cube root; motor/ESC efficiency is75%. Central Ct=.10/Cp=.05, scenario ranges Ct=.08–.12/Cp=.04–.065.
- Takeoff mass gives weight and induced hover power `1.25 W^1.5 / sqrt(2 rho diskArea)`. Horizontal thrust is `sqrt(max(0,T²-W²))`. Drag-limited speed uses `sqrt(2 horizontalForce/(rho CdA))`; power-limited speed uses the cube root after hover losses; pitch/slip gives another ceiling. The smallest ceiling wins. Insufficient modeled thrust or known native incompatibility suppresses speed.
- Standard density is1.225kg/m³; CdA=.012×(frame inches/5)²m², varied−35/+50%. Explicit diameter×pitch text can supply pitch; otherwise pitch assumes70% of diameter. Slip varies60–85%. No ambiguous SKU pitch inference, CFD, measured airflow, wind or empirical calibration is claimed.

The UI shows a rounded central estimate plus a broad scenario interval. RPM, rps, estimated electrical demand, source/peer mass methods and assumptions are available on demand. Missing KV/diameter/cell count/capacity leaves speed unavailable. Hover endurance is only a design-ranking estimate (80% nominal energy, modeled induced power and5W electronics), not a range promise. Real hardware, drag, props, tuning, wind and battery state can differ substantially; this is not a measured maximum or statistical confidence interval.

## 4–5. Compact result and responsive loading

The initial result is a small budget/status row with Build details collapsed. Long answer/constraint explanations and selection reasons remain accessible there. Native missing/conflict/compatibility indicators stay visible in the configurator. Performance detail text is independently collapsed below the statistics.

A dedicated animated wheel and polite live status appear between questions and the result. Actual phases report product loading, compatibility checks, budget optimization, performance estimation and build loading. CPU work runs in a module Web Worker; it cannot freeze the main-thread spinner. Reduced-motion preferences disable rotation. Workers terminate on completion/cancellation/error. Retry restarts the entire process; there is no fake countdown or minimum artificial delay. Fresh selected evidence replaces old evidence; the wider catalogue is used only for mass-reference estimates, not for resurrecting revoked selected proofs.

## Verification and repeat

Eleven focused tests passed (six retained planner/data-access cases plus five new performance cases): budget buys a useful motor upgrade, identical expensive variant rejected, range battery mass/endurance, donor category/size/material/quantity, partial/class masses, no data mutation, pilot exclusion, assembly allowance, RPM/mass/power sensitivity, missing values/incompatibility and explicit pitch assumptions. Typecheck and Vite build passed, including the built worker asset. Chromium390/1280px passed actual spinner movement, worker execution, compact report, all four answers, visible model ranges/details, recalculation after manual selection, Skip clearing, range GPS, conflict blocking and overflow checks. Browser data/network are loopback-only synthetic fixtures. Receipt: `qa/ai-performance-20261120.json`.

A previously captured read-only public snapshot of133products was used offline, not fetched again: at1,000EUR, freestyle/reach profiles found complete selections in roughly1–2.3seconds on this instance. These model outputs were not empirically flight-tested or classified as verified compatibility. Protected benchmark log is under `.private-backups/ai-performance-20261120/`.

```sh
node --import tsx --test tests/ai-build-planner.test.ts tests/ai-performance.test.ts
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
node --import tsx tests/integration/ai-build-fixture.ts
```

Start isolated Vite on127.0.0.1:4190 with CATALOGUE_LOCAL_ONLY=true, CATALOGUE_DATABASE_ENABLED=true, CATALOGUE_RUNTIME_URL and VITE_CATALOGUE_RUNTIME_URL=http://127.0.0.1:4289/query, VITE_SUPABASE_URL=http://127.0.0.1:4289, a nonsecret test key and no server Supabase credentials. Then run:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/integration/ai-build-browser.mjs
```

Rollback: revert this scoped feature commit after preserving later changes. No database rollback/import/publication SQL is involved. Preserve other user work and published history. Existing generic TanStack deprecation/build size warnings remain outside this scope.
