#!/usr/bin/env bash
set -euo pipefail

eval "$(supabase status -o env)"
LOCAL_SUPABASE_URL="${API_URL:-${SUPABASE_URL:-http://127.0.0.1:54321}}"
TOKEN_FILE="/tmp/catalogue-import-token"
ENV_FILE="supabase/functions/.env"
FUNCTION_LOG="$(mktemp)"

if [[ ! -s "${TOKEN_FILE}" || ! -s "${ENV_FILE}" ]]; then
  echo "Disposable importer auth was not prepared before the local Supabase stack started." >&2
  exit 1
fi

TOKEN="$(cat "${TOKEN_FILE}")"
cleanup() {
  if [[ -n "${FUNCTION_PID:-}" ]]; then
    kill "${FUNCTION_PID}" 2>/dev/null || true
    wait "${FUNCTION_PID}" 2>/dev/null || true
  fi
  rm -f "${TOKEN_FILE}" "${ENV_FILE}" "${FUNCTION_LOG}" /tmp/catalogue-import-*.json
}
trap cleanup EXIT

supabase functions serve catalogue-import-runner --no-verify-jwt >"${FUNCTION_LOG}" 2>&1 &
FUNCTION_PID=$!

# Wait for the function instance that loaded this run-specific token. An
# unauthorized response can come from the stack runtime before functions serve
# has reloaded the function, so only the expected logicalRunId validation marks
# the importer as ready.
READY=0
for _ in $(seq 1 60); do
  CODE="$(curl -sS -o /tmp/catalogue-import-readiness.json -w '%{http_code}' \
    -X POST "${LOCAL_SUPABASE_URL}/functions/v1/catalogue-import-runner" \
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
  echo "Local catalogue-import-runner did not load the disposable auth configuration." >&2
  cat /tmp/catalogue-import-readiness.json >&2 || true
  tail -100 "${FUNCTION_LOG}" >&2
  exit 1
fi

# Small real-source parser/adapter test. It is deliberately dry-run: five
# upstream Shopify products are fetched, but no durable run/candidate/offer or
# evidence record is created.
CODE="$(curl -sS -o /tmp/catalogue-import-real-source.json -w '%{http_code}' \
  -X POST "${LOCAL_SUPABASE_URL}/functions/v1/catalogue-import-runner" \
  -H 'content-type: application/json' \
  -H "x-catalogue-import-token: ${TOKEN}" \
  -d '{"adapterKey":"cnhl-shopify-jsonld","dryRun":true,"cursor":"1","limit":5}')"
if [[ "${CODE}" != "200" ]]; then
  echo "Real-source dry-run failed." >&2
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
