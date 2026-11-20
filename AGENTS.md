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
