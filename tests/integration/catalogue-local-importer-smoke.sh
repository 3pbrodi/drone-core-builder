#!/usr/bin/env bash
set -euo pipefail

eval "$(supabase status -o env)"
LOCAL_SUPABASE_URL="${API_URL:-${SUPABASE_URL:-http://127.0.0.1:54321}}"
LOCAL_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
TOKEN_FILE="/tmp/catalogue-import-token"
FUNCTION_URL="http://127.0.0.1:8000"
FUNCTION_LOG="$(mktemp)"

if [[ -z "${LOCAL_SERVICE_ROLE_KEY}" || ! -s "${TOKEN_FILE}" ]]; then
  echo "Disposable local Supabase credentials or importer token are unavailable." >&2
  exit 1
fi

TOKEN="$(cat "${TOKEN_FILE}")"
TOKEN_HASH="$(printf '%s' "${TOKEN}" | sha256sum | awk '{print $1}')"
cleanup() {
  if [[ -n "${FUNCTION_PID:-}" ]]; then
    kill "${FUNCTION_PID}" 2>/dev/null || true
    wait "${FUNCTION_PID}" 2>/dev/null || true
  fi
  rm -f "${TOKEN_FILE}" "${FUNCTION_LOG}" /tmp/catalogue-import-*.json /tmp/catalogue-upstream.json
}
trap cleanup EXIT

# Verify the repository-defined official endpoint is reachable from this
# disposable runner before attributing a failure to the importer.
UPSTREAM_CODE="$(curl -sS -L --max-time 30 --retry 2 --retry-delay 1 \
  -o /tmp/catalogue-upstream.json -w '%{http_code}' \
  'https://chinahobbyline.com/products.json?page=1&limit=5' || true)"
if [[ "${UPSTREAM_CODE}" != "200" ]]; then
  echo "CNHL repository-defined products endpoint is unreachable from the disposable runner (HTTP ${UPSTREAM_CODE})." >&2
  exit 2
fi
jq -e '.products | type == "array" and length >= 1' /tmp/catalogue-upstream.json >/dev/null
UPSTREAM_PRODUCTS="$(jq -r '.products | length' /tmp/catalogue-upstream.json)"
echo "Real-source preflight: CNHL endpoint reachable, products_received=${UPSTREAM_PRODUCTS}"

# Run the exact repository Edge Function source directly under Deno. Database
# access is pointed only at the disposable local Supabase API and uses only the
# local service-role key emitted by the local stack.
env \
  CATALOGUE_IMPORT_TOKEN_SHA256="${TOKEN_HASH}" \
  SUPABASE_URL="${LOCAL_SUPABASE_URL}" \
  SUPABASE_SERVICE_ROLE_KEY="${LOCAL_SERVICE_ROLE_KEY}" \
  deno run --allow-env --allow-net supabase/functions/catalogue-import-runner/index.ts \
  >"${FUNCTION_LOG}" 2>&1 &
FUNCTION_PID=$!

READY=0
for _ in $(seq 1 60); do
  CODE="$(curl -sS -o /tmp/catalogue-import-readiness.json -w '%{http_code}' \
    -X POST "${FUNCTION_URL}" \
    -H 'content-type: application/json' \
    -H "x-catalogue-import-token: ${TOKEN}" \
    -d '{"adapterKey":"cnhl-shopify-jsonld","dryRun":false,"limit":5}' || true)"
  if [[ "${CODE}" == "400" ]] && jq -e '.error | test("logicalRunId|stable"; "i")' /tmp/catalogue-import-readiness.json >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "${READY}" != "1" ]]; then
  echo "Direct-Deno catalogue-import-runner did not become ready with disposable auth." >&2
  cat /tmp/catalogue-import-readiness.json >&2 || true
  tail -100 "${FUNCTION_LOG}" >&2
  exit 1
fi

CODE="$(curl -sS -o /tmp/catalogue-import-real-source.json -w '%{http_code}' \
  -X POST "${FUNCTION_URL}" \
  -H 'content-type: application/json' \
  -H "x-catalogue-import-token: ${TOKEN}" \
  -d '{"adapterKey":"cnhl-shopify-jsonld","dryRun":true,"cursor":"1","limit":5}')"
if [[ "${CODE}" != "200" ]]; then
  echo "Real-source importer dry-run failed." >&2
  cat /tmp/catalogue-import-real-source.json >&2
  tail -100 "${FUNCTION_LOG}" >&2
  exit 1
fi

jq -e '.dryRun == true and .adapterKey == "cnhl-shopify-jsonld" and .discovered >= 1 and (.sample | length) >= 1' \
  /tmp/catalogue-import-real-source.json >/dev/null

DISCOVERED="$(jq -r '.discovered' /tmp/catalogue-import-real-source.json)"
STAGEABLE="$(jq -r '.stageable' /tmp/catalogue-import-real-source.json)"
FAILED="$(jq -r '.failed' /tmp/catalogue-import-real-source.json)"
MULTI_VARIANT_PARENTS="$(jq -r '
  [.sample[]
    | .normalized
    | select(.source_external_parent_product_id != null)
    | {parent:.source_external_parent_product_id, variant:.source_external_variant_id}]
  | group_by(.parent)
  | map(select(length > 1 and ([.[].variant] | unique | length) > 1))
  | length
' /tmp/catalogue-import-real-source.json)"

echo "Real-source dry-run summary: upstream_products=${DISCOVERED}, stageable_variants=${STAGEABLE}, failed=${FAILED}, multi_variant_parents_in_sample=${MULTI_VARIANT_PARENTS}"

PGPASSWORD=postgres psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if exists(select 1 from public.catalogue_import_runs) then
    raise exception 'real-source dry-run unexpectedly created a durable import run';
  end if;
  if exists(select 1 from public.catalogue_products) then
    raise exception 'real-source dry-run unexpectedly created a catalogue product';
  end if;
  if exists(select 1 from public.catalogue_offers) then
    raise exception 'real-source dry-run unexpectedly created an offer';
  end if;
  if exists(select 1 from public.catalogue_spec_evidence)
     or exists(select 1 from public.catalogue_identity_evidence) then
    raise exception 'real-source dry-run unexpectedly created evidence';
  end if;
end
$$;
SQL
