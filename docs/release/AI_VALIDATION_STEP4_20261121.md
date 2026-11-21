# AI build validation: three states and source explanations —2026-11-21

Baseline `888f075e190e274a8bfee1f08f9859353c704d59`, branch `feature/shared-drone-configurator`. Step4 extends the existing native checks and evidence resolver; it does not replace compatibility math, change product facts, activate research claims or modify the database/runtime API.

## Result

`validateBuildCompatibility` returns a serializable report containing `status`, `label`, `scope`, `explanation`, completeness/missing categories, per-status counts, issues, limitations and individual checks. Each check has its own status, explanation, missing/unverified fields, source references and an explicit public-reference availability flag. The native states map to:

| Result | Meaning |
| --- | --- |
| `verified-compatible` | Applicable listed checks pass with existing verified evidence; required components and integrated-role coverage cannot be missing. |
| `verified-incompatible` | At least one listed check has a confirmed verified failure. An unrelated missing proof/conflict does not erase that known failure. |
| `unverified` | Evidence/conditions are missing, a result is heuristic, sources conflict, required parts are absent, or integrated checks remain uncovered. A heuristic warning is not labeled a verified failure. |

This scope is **listed catalogue checks**. Full assembled mechanical fit, installed firmware and flight readiness remain unverified. Those limitations remain visible; the report does not create missing engineering facts or recategorize product availability.

The AI planner returns the report on both complete and incomplete results, after final selection rather than during every search candidate evaluation. The existing `verified` boolean uses the same report status. Budget/use-case ranking and the worker architecture remain intact. Initial AI details are explicitly labeled as initial; changing a component recomputes the current report in the shared build interface. Custom/template builds share that interface and the same native checks.

## Sources and conflicts

Field citations now reuse the resolver's authority, association, date and unit gates. Merely carrying `verificationStatus=verified` no longer makes a row a displayed supporting source. Excluded/pending/rejected rows are not cited as verified support. Conflicting credible field rows retain both references marked **Conflicting evidence** and only affect checks using the disputed field. Other confirmed failures remain decisive.

The resolver also returns source references for review of exact pair evidence. Applicable pair conflicts retain both citations; a valid proof for a different cell count is a **Reference only**, never support for the current selection. Where an applicable proof exists, unrelated cell-context references are omitted. Existing exact-ID/KV/battery restrictions and revoked-proof behavior remain unchanged.

Each displayed source identifies its host/link or available source ID, relevant field, retrieval date, and documented pair scope/locator when available. Field references alone do not establish a pair verdict. Existing legacy native pair proofs with no published URL remain governed by the native evidence contract and explicitly say that their public source reference is unavailable; URLs are never invented. Such missing public references are distinguishable from absent native proof, which remains unverified. Unsafe/credential-bearing URLs never become links.

The status summary uses the requested three labels. The source checklist remains collapsed by default, supports native keyboard operation, and preserves the compact product selection layout. No component images were added.

## Verification

- **26 distinct Node cases passed** across the focused regression run and one corrected fixture case; one opt-in database integration case was skipped because this is frontend/reporting work. Coverage includes all three results, accepted/excluded/disputed citations, wrong/missing battery context, unrelated-context isolation, verified-failure precedence, missing/integrated roles, safe links, serializable AI results and fresh revoked-proof replacement. The corrected test fixture needed explicit6S conditions for its new-provenance wiring record; the real validator correctly rejected the incomplete fixture and its gates were retained.
- Existing complete AI browser flow passed at **390/1280px**: all four answers, worker/spinner, budget/results, compact collapsed details, checklist, estimates, manual changes, GPS/conflicts and no horizontal overflow.
- A dedicated **390/1280px** browser check passed all three live UI states, source links/dates, keyboard expansion, manual incompatibility, and wiring-proof removal through the loopback fixture's primary/fallback read paths. The first browser attempt only modified browser responses while the server still received complete proofs; a fixture-only test endpoint now removes the proof for both paths. Production code required no evidence-gate workaround.
- Typecheck and build passed. The prior production state remains38 migrations, catalogue runtimev5,134 products/133 selectable; it was not reread or changed for this frontend task.

Receipts: `qa/ai-validation-step4-20261121.json` and `qa/compatibility-validation-browser-20261121.json`. Detailed logs are retained privately under `.private-backups/ai-validation-step4-20261121/`. All browser data was synthetic and loopback-only; no production source fetch, authentication/billing flow, product publication or deployment was performed.

```sh
node --import tsx --test tests/compatibility-validation.test.ts tests/ai-build-planner.test.ts tests/ai-compatibility-audit.test.ts tests/manufacturer-pair-review.test.ts
node_modules/.bin/tsc --noEmit
CATALOGUE_LOCAL_ONLY=true node_modules/.bin/vite build
# Existing synthetic fixture4289 + isolated Vite4190 must be running:
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/integration/compatibility-validation-browser.mjs
```

Use `CATALOGUE_LOCAL_ONLY=true`, both runtime overrides pointing to `http://127.0.0.1:4289`, and loopback auth placeholders for the local dev server. The fixture's POST `/__test/evidence?mode=complete|missing-wiring` is test-only, bound to127.0.0.1, and changes no database. It is not a production endpoint.

Rollback: revert only this scoped feature commit while preserving later work. No database migration, evidence withdrawal, product import replay or runtime rollback is involved. The five previously authorized production pairings and all unresolved manufacturer holds remain unchanged.
