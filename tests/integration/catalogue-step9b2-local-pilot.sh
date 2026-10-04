#!/usr/bin/env bash
# DroneCores Step 9B.2: LIVE official-source pilot, DISPOSABLE LOCAL database only.
# Uses the deployed importer *source code* on local PostgreSQL, NOT hosted APIs.
# No candidates, evidence approvals, offers, production writes or publication.
set -euo pipefail
umask 077
OUT=step9b2-results
mkdir -p "$OUT"
PG=postgresql://postgres:postgres@127.0.0.1:54322/postgres
export PGPASSWORD=postgres
psql_local() { psql "$PG" -X -v ON_ERROR_STOP=1 "$@"; }
snapshot() {
  psql_local -At -c "select jsonb_build_object(
    'products',(select count(*) from public.catalogue_products),
    'selectable',(select count(*) from public.catalogue_products where selectable),
    'offers',(select count(*) from public.catalogue_offers),
    'identityEvidence',(select count(*) from public.catalogue_identity_evidence),
    'specEvidence',(select count(*) from public.catalogue_spec_evidence),
    'candidateEvents',(select count(*) from public.catalogue_promotion_events where action='candidate_created'),
    'importRuns',(select count(*) from public.catalogue_import_runs),
    'batches',(select count(*) from public.catalogue_import_batches),
    'importRows',(select count(*) from public.catalogue_import_rows)
  );" | jq . > "$1"
}
eval "$(supabase status -o env)"
if [[ "$API_URL" != "http://127.0.0.1:54321" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "SAFETY STOP: no disposable local-only Supabase API and credentials" >&2
  exit 1
fi
if env | grep -Eq '^SUPABASE_(ACCESS_TOKEN|SECRET_KEYS|PUBLISHABLE_KEYS|DB_PASSWORD)='; then
  echo "SAFETY STOP: hosted-style Supabase credentials in environment" >&2
  exit 1
fi
test "$(psql_local -At -c 'select count(*) from supabase_migrations.schema_migrations')" = 23
psql_local -f tests/integration/catalogue-local-staging-readiness.sql > "$OUT/staging-readiness.log"
snapshot "$OUT/before.json"
jq -e '.products==0 and .selectable==0 and .offers==0 and
  .identityEvidence==0 and .specEvidence==0 and
  .importRuns==0 and .batches==0 and .importRows==0' "$OUT/before.json" >/dev/null

# Prevent aggressive official-source fetches and bound the local pilot by
# target stageable counts and a finite number of resumable importer requests.
psql_local <<'SQL' > "$OUT/local-adapter-configuration.log"
update public.catalogue_source_adapters
set config=jsonb_set(
  jsonb_set(config,'{concurrency}','2'::jsonb,true),
  '{requestDelayMs}','350'::jsonb,true
),updated_at=now()
where adapter_key in (
  'hqprop-sitemap-jsonld',
  'foxeer-sitemap-jsonld',
  'tbs-category-html',
  'speedybee-sitemap-jsonld'
);
do $$ begin
  if (select count(*) from public.catalogue_source_adapters
    where adapter_key in (
      'hqprop-sitemap-jsonld','foxeer-sitemap-jsonld',
      'tbs-category-html','speedybee-sitemap-jsonld'
    ) and config->>'concurrency'='2') <> 4 then
    raise exception 'Local-only concurrency settings incomplete';
  end if;
end $$;
SQL

TOKEN_FILE="$(mktemp)"
LOG_FILE="$OUT/local-importer.log"
FUNCTION_PID=""
cleanup() {
  if [[ -n "$FUNCTION_PID" ]]; then
    kill "$FUNCTION_PID" 2>/dev/null || true
    wait "$FUNCTION_PID" 2>/dev/null || true
  fi
  rm -f "$TOKEN_FILE"
}
trap cleanup EXIT
openssl rand -hex 32 > "$TOKEN_FILE"
TOKEN="$(cat "$TOKEN_FILE")"
TOKEN_HASH="$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)"
env -u SUPABASE_SECRET_KEYS -u SUPABASE_PUBLISHABLE_KEYS \
  CATALOGUE_IMPORT_TOKEN_SHA256="$TOKEN_HASH" \
  SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  deno run --allow-env --allow-net supabase/functions/catalogue-import-runner/index.ts \
  > "$LOG_FILE" 2>&1 &
FUNCTION_PID=$!

post() {
  local payload="$1" target="$2"
  curl --silent --show-error --max-time 165 \
    --output "$target" --write-out '%{http_code}' \
    -X POST http://127.0.0.1:8000 \
    -H 'content-type: application/json' \
    -H "x-catalogue-import-token: $TOKEN" \
    --data "$payload"
}
ready=0
for attempt in $(seq 1 40); do
  status="$(post '{}' "$OUT/readiness.json" 2>/dev/null || true)"
  if [[ "$status" == 400 ]] && jq -e '.error | contains("adapterKey")' "$OUT/readiness.json" >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  echo "Local Deno importer did not become ready" >&2
  tail -35 "$LOG_FILE" >&2
  exit 1
fi
echo "PASS: local-only importer authenticated, no production credentials used"

# Targets sum to 132 potential stageable rows. Sources remain independent
# resumable logical runs. "createCandidates=false" stages + classifies ONLY.
SOURCES=(hqprop-sitemap-jsonld foxeer-sitemap-jsonld tbs-category-html speedybee-sitemap-jsonld)
TARGETS=(45 40 30 17)
LIMIT=18
MAX_CALLS_PER_SOURCE=23
: > "$OUT/steps.jsonl"
: > "$OUT/errors.jsonl"
get_stageable() {
  local adapter="$1"
  psql_local -At -v adapter="$adapter" -c "
    select count(*) from public.catalogue_import_rows r
    join public.catalogue_import_batches b on b.id=r.batch_id
    join public.catalogue_source_adapters a on a.id=b.adapter_id
    where a.adapter_key=:'adapter'
      and r.status='validated' and r.dedupe_status='new'
      and coalesce(jsonb_array_length(r.validation_errors),0)=0;"
}
for i in 0 1 2 3; do
  adapter="${SOURCES[$i]}"
  target="${TARGETS[$i]}"
  logical="step9b2-20261004-$adapter"
  discovered=0
  finished_discovery=0
  current=0
  echo "PILOT_START source=$adapter target=$target"
  for call in $(seq 1 "$MAX_CALLS_PER_SOURCE"); do
    request="$(jq -nc --arg adapter "$adapter" --arg logical "$logical" \
      --argjson limit "$LIMIT" \
      '{adapterKey:$adapter,logicalRunId:$logical,limit:$limit,
        dryRun:false,createCandidates:false,retryFailed:false,maxAttempts:2}')"
    tmp="$(mktemp)"
    http="$(post "$request" "$tmp" || true)"
    if [[ "$http" != 200 ]] || ! jq -e '(.phase=="discovery" or .phase=="processing") and .dryRun==false' "$tmp" >/dev/null 2>&1; then
      detail="$(jq -r '.error // "Request failed before JSON result"' "$tmp" 2>/dev/null | head -c 240 || true)"
      jq -nc --arg adapter "$adapter" --argjson call "$call" --arg http "$http" \
        --arg error "$detail" '{adapter:$adapter,call:$call,http:$http,error:$error}' >> "$OUT/errors.jsonl"
      echo "PILOT_ERROR source=$adapter call=$call http=$http reason=$detail"
      rm -f "$tmp"
      break
    fi
    jq -c --arg adapter "$adapter" --argjson call "$call" \
      '{adapter:$adapter,call:$call,phase,
        discovery:{complete:.discovery.complete,discoveredCount:.discovery.discoveredCount},
        processing:{phase:.processing.phase,claimedCount:.processing.claimedCount,
          stagedRows:.processing.staged.totalRows,
          dedupe:.processing.processed.dedupe},status:.state.status}' "$tmp" \
      >> "$OUT/steps.jsonl"
    phase="$(jq -r '.phase' "$tmp")"
    if [[ "$phase" == discovery ]]; then
      if jq -e '.discovery.complete==true' "$tmp" >/dev/null; then
        finished_discovery=1
      fi
      echo "PILOT_DISCOVERY source=$adapter call=$call complete=$(jq -r '.discovery.complete' "$tmp")"
    else
      current="$(get_stageable "$adapter")"
      echo "PILOT_STAGE source=$adapter call=$call validated=$current target=$target"
      if [[ "$current" -ge "$target" ]]; then
        rm -f "$tmp"
        break
      fi
      if jq -e '.processing.phase=="idle" and (.processing.state.hasMore==false or .state.hasMore==false)' "$tmp" >/dev/null; then
        echo "PILOT_SOURCE_EXHAUSTED source=$adapter validated=$current"
        rm -f "$tmp"
        break
      fi
    fi
    rm -f "$tmp"
    sleep 2
  done
  echo "PILOT_SOURCE_SUMMARY source=$adapter validated=$(get_stageable "$adapter") target=$target manifestComplete=$finished_discovery"
done

# Preserve the real, reviewable STAGING outcome before destroying local DB.
psql_local -At -c "
select coalesce(jsonb_agg(row_to_json(t) order by t.adapter), '[]'::jsonb)
from (
 select a.adapter_key as adapter,s.name as manufacturer,
  count(r.id) as staged,
  count(r.id) filter(where r.status='validated' and r.dedupe_status='new'
    and coalesce(jsonb_array_length(r.validation_errors),0)=0) as eligible_new,
  count(r.id) filter(where r.dedupe_status='conflict') as conflicts,
  count(r.id) filter(where r.dedupe_status='probable_match') as probable_matches,
  count(r.id) filter(where r.status='needs_review') as needs_review,
  count(r.id) filter(where r.dedupe_status='exact_match') as exact_matches
 from public.catalogue_source_adapters a
 join public.catalogue_sources s on s.id=a.source_id
 left join public.catalogue_import_batches b on b.adapter_id=a.id
 left join public.catalogue_import_rows r on r.batch_id=b.id
 where a.adapter_key in (
  'hqprop-sitemap-jsonld','foxeer-sitemap-jsonld',
  'tbs-category-html','speedybee-sitemap-jsonld')
 group by a.adapter_key,s.name
) t;" | jq . > "$OUT/source-summary.json"
psql_local -At -c "
select coalesce(jsonb_agg(row_to_json(t) order by t.category),'[]'::jsonb)
from (
 select r.normalized_data->>'category' as category,
  count(*) as validated_new
 from public.catalogue_import_rows r
 where r.status='validated' and r.dedupe_status='new'
 group by 1
) t;" | jq . > "$OUT/category-summary.json"
psql_local -At -c "
select coalesce(jsonb_agg(row_to_json(t) order by t.manufacturer,t.product_key),'[]'::jsonb)
from (
  select b.source_id::text as source_id,s.name as manufacturer,
    r.id as import_row_id, r.normalized_data->>'id' as product_key,
    r.normalized_data->>'category' as category,
    r.normalized_data->>'model' as model,
    r.normalized_data->>'variant' as variant,
    r.normalized_data->>'manufacturer_sku' as manufacturer_sku,
    r.normalized_data->>'mpn' as mpn,
    r.normalized_data->>'source_url' as source_url,
    r.normalized_data as normalized,
    r.status::text as status, r.dedupe_status, r.validation_errors
  from public.catalogue_import_rows r
  join public.catalogue_import_batches b on b.id=r.batch_id
  join public.catalogue_sources s on s.id=b.source_id
  where r.status='validated' and r.dedupe_status='new'
) t;" | jq . > "$OUT/staged-validated-items.json"
psql_local -At -c "
with qualified as (
  select r.id, r.normalized_data as n,
    regexp_replace(lower(coalesce(r.normalized_data->>'manufacturer','')),'[^[:alnum:]]','','g') as maker,
    r.normalized_data->>'category' as cat,
    regexp_replace(lower(coalesce(r.normalized_data->>'model','')),'[^[:alnum:]]','','g') as model,
    regexp_replace(lower(coalesce(r.normalized_data->>'variant','')),'[^[:alnum:]]','','g') as variant,
    regexp_replace(lower(coalesce(r.normalized_data->>'manufacturer_sku','')),'[^[:alnum:]]','','g') as sku
  from public.catalogue_import_rows r
  where r.status='validated' and r.dedupe_status='new'
), matches as (
  select maker,cat,model,variant,count(*) as duplicated
  from qualified group by maker,cat,model,variant having count(*)>1
)
select coalesce(jsonb_agg(row_to_json(matches)),'[]'::jsonb) from matches;" \
  | jq . > "$OUT/potential-variant-collisions.json"

snapshot "$OUT/after.json"
jq -e '.products==0 and .selectable==0 and .offers==0 and
  .identityEvidence==0 and .specEvidence==0 and
  .candidateEvents==0 and .importRuns==4 and
  .batches>0 and .importRows>0' "$OUT/after.json" >/dev/null || {
    echo "SAFETY FAILURE: staged import created unexpected products or no runs" >&2
    exit 1
  }
actual="$(jq '[.[].eligible_new] | add // 0' "$OUT/source-summary.json")"
jq -n --slurpfile summary "$OUT/source-summary.json" \
  --slurpfile categories "$OUT/category-summary.json" \
  --slurpfile before "$OUT/before.json" --slurpfile after "$OUT/after.json" \
  --slurpfile collisions "$OUT/potential-variant-collisions.json" \
  '{pilotName:"step9b2-disposable-staging",selectedTarget:132,
    sourceResults:$summary[0],categoryResults:$categories[0],
    before:$before[0],after:$after[0],
    potentialVariantCollisions:$collisions[0],publishedProducts:0}' \
  > "$OUT/report.json"
echo "PILOT_FINAL validatedNew=$actual target=132"
cat "$OUT/source-summary.json"
echo "PILOT_SAFETY_PASS: zero products, candidates, offers, evidence, published rows"
if [[ "$actual" -lt 100 || "$actual" -gt 200 ]]; then
  echo "PILOT_PARTIAL: verified staging count $actual outside planned 100–200 range" >&2
  exit 1
fi
echo "PILOT_SUCCESS: $actual official-source rows staged + classified in disposable DB"
