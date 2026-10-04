#!/usr/bin/env bash
# Step 9A: official manufacturer dry-run audit on disposable local Supabase.
# NEVER pass hosted keys or URLs into this script.
set -euo pipefail

eval "$(supabase status -o env)"
LOCAL_SUPABASE_URL="${API_URL:-${SUPABASE_URL:-http://127.0.0.1:54321}}"
LOCAL_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
if [[ ! "$LOCAL_SUPABASE_URL" =~ ^http://(127[.]0[.]0[.]1|localhost):[0-9]+/?$ ]]; then
  echo "Refusing non-local Supabase URL for disposable audit" >&2
  exit 1
fi
if [[ -z "$LOCAL_SERVICE_ROLE_KEY" ]]; then
  echo "Local-only service-role key is missing" >&2
  exit 1
fi

OUT_DIR="step9a-results"
mkdir -p "$OUT_DIR"
PAGES_FILE="$OUT_DIR/pages.jsonl"
REPORT_FILE="$OUT_DIR/report.md"
: > "$PAGES_FILE"
TOKEN_FILE="$(mktemp)"
LOG_FILE="$(mktemp)"
TOKEN_HASH=""
FUNCTION_PID=""
cleanup() {
  if [[ -n "$FUNCTION_PID" ]]; then
    kill "$FUNCTION_PID" 2>/dev/null || true
    wait "$FUNCTION_PID" 2>/dev/null || true
  fi
  rm -f "$TOKEN_FILE" "$LOG_FILE"
}
trap cleanup EXIT
umask 077
openssl rand -hex 32 > "$TOKEN_FILE"
TOKEN_HASH="$(sha256sum "$TOKEN_FILE" | cut -d' ' -f1)"
TOKEN="$(cat "$TOKEN_FILE")"

# Local code only: the actual official-source HTTP fetches write no catalogues
# and importer metadata writes remain inside this disposable local DB.
env -u SUPABASE_SECRET_KEYS \
  CATALOGUE_IMPORT_TOKEN_SHA256="$TOKEN_HASH" \
  SUPABASE_URL="$LOCAL_SUPABASE_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_ROLE_KEY" \
  deno run --allow-env --allow-net supabase/functions/catalogue-import-runner/index.ts \
  > "$LOG_FILE" 2>&1 &
FUNCTION_PID=$!

READY=0
for _ in $(seq 1 50); do
  status="$(curl --silent --show-error --max-time 3 --output /tmp/step9a-ready.json --write-out '%{http_code}' \
    -X POST http://127.0.0.1:8000 -H 'content-type: application/json' \
    -H "x-catalogue-import-token: $TOKEN" -d '{}' || true)"
  if [[ "$status" == "400" ]] && jq -e '.error | contains("adapterKey")' /tmp/step9a-ready.json >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" != "1" ]]; then
  echo "Disposable importer failed to start" >&2
  tail -30 "$LOG_FILE" >&2
  exit 1
fi
rm -f /tmp/step9a-ready.json

echo "# DroneCores Step 9A — disposable manufacturer audit" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "All dry-runs use only the repository's disposable local Supabase stack. The audit never uses production database keys and never publishes products." >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| Official adapter | Pages | Discovered page entries | Stageable variants | Skipped | Failed | Source catalogue size* | Last status |" >> "$REPORT_FILE"
echo "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |" >> "$REPORT_FILE"

ADAPTERS=(
  cnhl-shopify-jsonld
  foxeer-sitemap-jsonld
  geprc-sitemap-jsonld
  hqprop-sitemap-jsonld
  iflight-eu-shopify-jsonld
  radiomaster-shopify-jsonld
  runcam-sitemap-jsonld
  speedybee-sitemap-jsonld
  tattu-sitemap-jsonld
  tbs-category-html
)
PAGE_SIZE="${PAGE_SIZE:-30}"
MAX_PAGES="${MAX_PAGES:-3}"
SUCCESSFUL_ADAPTERS=0
for ADAPTER in "${ADAPTERS[@]}"; do
  CURSOR=""
  DISCOVERED=0
  STAGEABLE=0
  SKIPPED=0
  FAILED=0
  PAGES=0
  TOTAL="?"
  STATUS="pending"

  for PAGE in $(seq 1 "$MAX_PAGES"); do
    PAYLOAD="$(jq -nc --arg adapter "$ADAPTER" --arg cursor "$CURSOR" --argjson limit "$PAGE_SIZE" \
      '{adapterKey:$adapter,dryRun:true,limit:$limit,cursor:$cursor}')"
    TMP="$(mktemp)"
    HTTP="$(curl --silent --show-error --max-time 180 --output "$TMP" --write-out '%{http_code}' \
      -X POST http://127.0.0.1:8000 \
      -H 'content-type: application/json' -H "x-catalogue-import-token: $TOKEN" \
      -d "$PAYLOAD" || true)"

    if [[ "$HTTP" != "200" ]] || ! jq -e '.dryRun == true and (.discovered | type) == "number"' "$TMP" >/dev/null 2>&1; then
      ERROR="$(jq -r '.error // empty' "$TMP" 2>/dev/null | head -c 180 || true)"
      [[ -n "$ERROR" ]] || ERROR="non-JSON or unreachable local importer"
      STATUS="error: HTTP $HTTP; $ERROR"
      jq -nc --arg adapter "$ADAPTER" --arg cursor "$CURSOR" --arg http "$HTTP" \
        --arg error "$ERROR" '{adapter:$adapter,cursor:$cursor,http:$http,error:$error}' >> "$PAGES_FILE"
      rm -f "$TMP"
      break
    fi

    jq -c --arg adapter "$ADAPTER" --argjson page "$PAGE" \
      '{adapter:$adapter,page:$page,cursor,discovered,totalAvailable,stageable,skipped,failed,nextCursor,hasMore,examples:[.sample[]? | {url,normalized:{manufacturer:(.normalized.manufacturer // null),model:(.normalized.model // null),category:(.normalized.category // null)}}]}' \
      "$TMP" >> "$PAGES_FILE"
    read -r SEEN STAGED IGNORED BAD MORE NEXT FULL < <(jq -r \
      '[.discovered,.stageable,.skipped,.failed,.hasMore,(.nextCursor // "none"),(.totalAvailable // "unknown")] | map(tostring) | join(" ")' "$TMP")
    rm -f "$TMP"
    PAGES=$((PAGES + 1))
    DISCOVERED=$((DISCOVERED + SEEN))
    STAGEABLE=$((STAGEABLE + STAGED))
    SKIPPED=$((SKIPPED + IGNORED))
    FAILED=$((FAILED + BAD))
    TOTAL="$FULL"
    STATUS="partial: page limit"
    echo "AUDIT adapter=$ADAPTER page=$PAGE discovered=$SEEN stageable=$STAGED skipped=$IGNORED failed=$BAD available=$FULL hasMore=$MORE"
    if [[ "$MORE" != "true" || "$NEXT" == "none" || "$NEXT" == "$CURSOR" ]]; then
      STATUS="completed"
      break
    fi
    CURSOR="$NEXT"
    sleep 2
  done

  if [[ "$PAGES" -gt 0 ]]; then SUCCESSFUL_ADAPTERS=$((SUCCESSFUL_ADAPTERS + 1)); fi
  STATUS="${STATUS//|/-}"
  printf '| %s | %d | %d | %d | %d | %d | %s | %s |\n' \
    "$ADAPTER" "$PAGES" "$DISCOVERED" "$STAGEABLE" "$SKIPPED" "$FAILED" "$TOTAL" "$STATUS" \
    >> "$REPORT_FILE"
  echo "AUDIT_SUMMARY adapter=$ADAPTER pages=$PAGES discovered=$DISCOVERED stageable=$STAGEABLE skipped=$SKIPPED failed=$FAILED totalAvailable=$TOTAL status=$STATUS"
  sleep 3
done

echo "" >> "$REPORT_FILE"
echo "*Upstream catalogue size is the adapter's reported \`totalAvailable\`, not the number of verified/selectable products; Shopify pagination may not know the full size. Stageable counts are potential variants, **not** verified products. Incomplete sources are explicitly marked.*" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Successful adapter probes: $SUCCESSFUL_ADAPTERS of ${#ADAPTERS[@]}." >> "$REPORT_FILE"

# Hard safety assertion: dry-run must not create canonical products, offers,
# staging rows, candidates, evidence, or durable import runs, even locally.
PGPASSWORD=postgres psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -tAc "
do \$\$ begin
  if exists(select 1 from public.catalogue_products)
  or exists(select 1 from public.catalogue_offers)
  or exists(select 1 from public.catalogue_import_rows)
  or exists(select 1 from public.catalogue_import_runs)
  or exists(select 1 from public.catalogue_spec_evidence)
  or exists(select 1 from public.catalogue_identity_evidence)
  then raise exception 'DRY-RUN SAFETY VIOLATION: durable catalogue data was written';
  end if;
end \$\$;" >/dev/null
echo "AUDIT_SAFETY_PASS: no products, offers, staging rows, import runs, or evidence written"
echo "" >> "$REPORT_FILE"
echo "Dry-run safety assertion passed: no catalogue products, offers, staging rows, import runs, or evidence were written to the disposable database." >> "$REPORT_FILE"

if [[ "$SUCCESSFUL_ADAPTERS" -eq 0 ]]; then
  echo "No official source returned a successful dry-run; audit is inconclusive" >&2
  exit 1
fi
