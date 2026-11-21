<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep demo product specifications, build presets, compatibility rules, and estimates in separate shared modules; all three build origins must use the same evaluator so changing a part never bypasses checks.
- Carry template and AI seed selections to the existing custom-build route through validated URL search parameters; this avoids a backend and preserves direct-link navigation.
- Use a client-mounted procedural React Three Fiber viewer until licensed modular drone assets are available; never depict an unselected Custom Build as a finished drone.

## Website development branch

The user explicitly selected `feature/shared-drone-configurator` for all future website and configurator work on2026-11-19. Use this branch. Preserve unrelated user changes and never force-push or merge into main. A branch update is not authorization to deploy the public website, modify production Supabase, or replay product imports. Keep the existing viewer architecture and neutral image fallback; reference photographs are not3D product previews. See docs/PROJECT_STATUS.md for current UI behavior and verification.

## Catalogue preview recovery —2026-11-20

The catalogue is the established DroneCores public runtime, independent of the Supabase project used for authentication. Override it only via dedicated CATALOGUE_RUNTIME_URL/VITE_CATALOGUE_RUNTIME_URL. Browser component pages and selected-ID confirmation retain the existing server path, with a read-only public fallback when that path fails. Local/test runs must remain isolated: CATALOGUE_LOCAL_ONLY/NODE_ENV=test are enforced on the server and forwarded to the client by Vite; loopback browser hosts also require a loopback endpoint. No credentials are sent by the browser fallback. See docs/PROJECT_STATUS.md for fault-injection receipts and actual verification limits.

## Product selection rows — user instruction2026-11-20

The user now requests one product image on the right of each configurator option when available. This supersedes the old blanket no-display instruction only for displaying existing approved product.image metadata in these rows. No image research, uploads, new URLs/associations, unlicensed photos or database changes are authorized by this UI request. Missing/failed images use ImageOff. Verified-compatible and verified-incompatible use green checked-square/red crossed-square labels; unknown compatibility remains explicitly unverified. Keep source mass scope, distinguish peak current from ESC current rating, and never estimate missing values.

## KI-Build continuation —2026-11-20

Live AI selections must use `planAiBuild` with the fully paginated published catalogue and `loadAiBuildCatalogue` evidence, never the legacy `aiPreset` demo IDs. Preserve all four answers, explicit unknown/conflict reporting, full-pack budget accounting and shared native compatibility evaluation. A fresh exact-ID/evidence read must replace old selected proof snapshots, so revoked proofs cannot survive matching. Missing evidence is not a pass; bounded search is not a global optimum or a flight-performance guarantee. No LLM provider is configured. See `docs/release/AI_BUILD_SELECTION_20261120.md` for test commands and constraints.

## Estimated performance — explicit user instruction2026-11-20

The user now explicitly requests estimated missing component weights and maximum flight speed. This supersedes prior blanket suppression only for separately labeled UI/design estimates. Use `build-performance-estimates.ts`; never mutate product weights, source evidence, native compatibility checks or publication rules. Prefer same-size/category donors and matching explicitly described material, retain donor IDs, normalize installed/sales quantities, and expose broad ranges/assumptions. Assembly allowance, assumed battery discharge/prop pitch/drag are estimates, not product facts or measured performance. Incomplete/conflicting builds or missing essential speed inputs must not get a confident flight value. All build origins share this display estimator and recompute on selection changes. Preserve strict source-backed hard constraints. AI search runs in its worker to keep the loading wheel responsive; progress reflects actual phases, with no fake countdown. Keep the initial report collapsed. See `docs/release/AI_BUILD_PERFORMANCE_20261120.md`.

## Compatibility evidence and coverage —2026-11-21

Use the shared resolver's `issues` as well as its field/technical evidence. Conflicting currently verified sources are review blockers, never first-row wins or popularity guesses. Respect primary/retailer authority, meaningful dates and declared units; motor operating conditions must bind the selected battery cell count and exact tested propeller IDs. Missing context remains unknown. AI ranks fewer unresolved catalogue/integration checks before performance and price at equal component coverage. Preserve `compatibilityCoverageGaps`: integrated categories cannot gain certainty merely because separate-role checks are omitted. Keep the source-linked checklist collapsed and the physical-fit limitation visible. Passed listed checks are not full mechanical/firmware/flight verification. Candidate badges must not inherit unrelated selected-product conflicts. See `docs/release/AI_COMPATIBILITY_AUDIT_20261121.md`.

## Manufacturer compatibility source packet —2026-11-21

See `docs/release/MANUFACTURER_COMPATIBILITY_EVIDENCE_20261121.md` and `qa/manufacturer-compatibility-dossier-20261121.json`. This is source research/pending evidence, not native DATA/pair approval or active runtime integration. Preserve all pending states and holds: generic HQ5x4.3x3 does not identify V1S/V2S; measured peak/maximum current is not continuous current; full physical fit needs exact assembly clearances/fasteners; actual firmware requires hardware readouts. Firmware targets are project- and revision-specific (notably SPEEDYBEE_F745_AIO vs manufacturer spelling/INAV aliases). Source-supported pairs are exact supplied-harness designs, not interchangeable cables. Keep legacy SKU mapping, F7 ESC layout and30vs30.5mm ambiguities conditional. The104-row CSV includes proposed dotted keys requiring explicit typed runtime mapping; syntactic CSV validity never authorizes promotion. Do not import the entire dossier or enable reviewed-only native flags automatically. No component photos/media were integrated. Recheck raw hashes with `node --import tsx scripts/verify-manufacturer-compatibility-audit.ts --archives`.

## Exact pair review integration —2026-11-21

See `docs/release/MANUFACTURER_PAIR_REVIEW_20261121.md`. New pair approvals use the scoped security-invoker RPC and exact current-row SHA256; require native capture/identity/source gates and preserve pending states after edits/revocation. Keep native/public pair columns aligned with snapshot INSERT/SELECT order. Carry pair source URL/hash/locator/scope through the shared mapper/resolver, binding new FC/ESC proofs to battery conditions. Do not activate the manufacturer dossier/CSV automatically. The five-pair local rehearsal used a disposable clone and clone-only service-role policies because the review-room role lacks BYPASSRLS; staging, roles and sequences remained unchanged. Production migration/approval and full mechanical/installed-firmware closure remain separate.

## Five-pair production activation completed —2026-11-21

The user authorized steps1–3; the single guarded migration and five exact manufacturer pair reviews are applied. Read `docs/release/MANUFACTURER_PAIR_ACTIVATION_20261121.md` and `qa/manufacturer-pair-activation-20261121.json`. Production134/public133 unchanged; four new supplied-harness3–6S wiring proofs plus exact1750KV/NazgulF5 6S proof active, original V4/55A retained. Catalogue runtime v5 preserves source/scope/conditions in both response shapes; only its entrypoint/shared mapper changed from actual v4,8 dependencies unchanged. Do NOT replay activation or the104-field CSV. Local source filename20261121201229 maps to applied production version20261121203933 (38 migrations); no history repair performed, never bulk replay. Real production service_role has BYPASSRLS; clone-only policies are tests, not production configuration. Rollback withdraws only the five receipt IDs through native revoke/current fingerprints before any v4 reader rollback. No product/spec/offer/image changes or website deployment. Full fit/installed firmware/bench-current holds remain.
