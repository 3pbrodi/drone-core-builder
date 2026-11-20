# KI-Build: katalogbasierte Auswahl, 2026-11-20

Scope: website branch `feature/shared-drone-configurator`, step1 of the AI Build overhaul. No database migration, production write, new dependency, model credential or deployment.

## Behavior

The live four-question flow uses the real public approved catalogue instead of hardcoded demo presets. It reads all50-row pages, then exact-ID evidence in groups of100. Motor/propeller, motor/ESC and FC/ESC cross-group pairs are explicitly collected with both endpoints in scope. Public read transport is the existing credential-free reader, including preview support and enforced loopback test isolation. Failure offers Retry; no demo catalogue is substituted.

The deterministic beam search evaluates96alternatives per stage with shared compatibility rules and integer-cent costs. It tries a consumer-first order if the first order cannot complete. Completeness precedes utility, evidence coverage influences ranking, ties prefer lower price then stable IDs. Known rule failures, including conservative advisory conflicts, are rejected. Categories already satisfied by documented integrations are skipped. Besides the native eight core roles, FPV proposals require VTX/antenna; range or explicit GPS requires GPS. No blank fields are invented to complete a build.

1. Budget includes all required sales packs: four installed motors/props, one installed battery etc. A known pack quantity now determines purchase quantity even when installed-weight metadata is missing. Legacy unknown-quantity set pricing remains; the planner excludes motors/props whose pack quantity is unknown. Pilot equipment/tools and unspecified assembly accessories are outside the stated drone-component budget.
2. Priorities rank only documented data: design size targets are2.5in beginner,3.5in filming,5in freestyle and7in range; two priorities average their targets. These are transparent design heuristics, not source-backed performance facts. Motor size/KV and battery capacity use the same profile; known interface conflicts cannot be outweighed by preference. Missing camera-performance/flight-time/protection evidence is never manufactured.
3. Preferred color is a soft preference only when explicit frame/propeller variant wording matches. Unmatched or partial color fulfillment is reported, not a recolor or invented variant.
4. Recognized German/English wishes: cell count, inch size, compact/backpack frame limit4in, maximum documented component mass, ELRS/Crossfire, analog/digital, GPS and listed manufacturer exclusions. Relevant hard-constraint fields require matching verified proof. Conflicting requests block the selection. Other prose is retained visibly and requires review; there is no general language-model interpretation. Component mass is not certified takeoff mass; partial/unknown weights cannot satisfy a weight limit.

After planning, the chosen IDs and evidence are fetched again. Only that new snapshot is used for the final plan: withdrawn variants, changed prices or revoked field/pair proofs cannot remain silently verified. A changed/withdrawn chosen candidate can yield a partial result and a warning; the final check does not promise to find an alternative from the entire catalogue again. Manual changes continue through existing configurator selection/evidence checks; the report explicitly describes the initial recommendation.

Out-of-stock and stale products remain eligible under the existing product policy. Original retailer timestamps remain; stale totals are last-recorded prices, not a currently purchasable complete offer. Hardware status reports only the existing catalogue rules. Unverified wiring, physical installation, radio/goggles pairing and actual flight performance still require appropriate evidence/validation. Full component coverage is distinct from verified compatibility.

## Checks and limits

- Six Node tests cover full synthetic compatibility, four-answer effects, pack-budget agreement, missing/contradictory requirements, incompatible vs unknown pairs, installed mass and151-row pagination with cross100-ID pair evidence. Test data are explicitly synthetic; no imports.
- Local Chromium390/1280px checks wizard navigation, all answers, complete fixture selection, budget, GPS, manual changes, Skip clearing previously typed wishes, conflict blocking and no horizontal overflow. Receipt: `qa/ai-build-20261120.json`.
- Public production API separately read only:133products and996field claims. Four standalone profiles at1,000EUR each produced complete component selections; all remained UNVERIFIED because exact pair evidence was insufficient. No real build was declared ready to fly. Protected raw read snapshot/benchmarks remain under `.private-backups/ai-build-20261120/`; browser checks do not access production.
- Typecheck/build passed. Existing TanStack inputValidator deprecation/build size warnings remain outside this scope.
- Search is bounded and may miss a better or complete combination. It does not establish a global optimum, safety certification, real flight time or optimal camera performance. Additional sourced pairing/performance data are the next prerequisite for stronger guarantees. The existing legacy `aiPreset` export is retained for historical/template tests but is absent from the live AI path.

## Repeat locally

```sh
node --import tsx --test tests/ai-build-planner.test.ts
node_modules/.bin/tsc --noEmit
node_modules/.bin/vite build
node --import tsx tests/integration/ai-build-fixture.ts
```

In a separate shell start the app with CATALOGUE_LOCAL_ONLY=true, CATALOGUE_DATABASE_ENABLED=true, CATALOGUE_RUNTIME_URL=http://127.0.0.1:4289/query, VITE_CATALOGUE_RUNTIME_URL=http://127.0.0.1:4289/query, VITE_SUPABASE_URL=http://127.0.0.1:4289 and a nonsecret test publishable key. Unset server Supabase credentials. Run Vite on127.0.0.1:4190, then:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/integration/ai-build-browser.mjs
```

Rollback: revert only the scoped AI Build commit on the feature branch after preserving later changes. This restores the previous website behavior; no product/database reversal is involved. Do not reset unrelated work, rewrite published history or replay any catalogue import/publication SQL.
