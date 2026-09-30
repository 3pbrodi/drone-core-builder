#!/usr/bin/env bash
set -euo pipefail

eval "$(supabase status -o env)"

LOCAL_SUPABASE_URL="${API_URL:-${SUPABASE_URL:-http://127.0.0.1:54321}}"
LOCAL_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"

if [[ -z "${LOCAL_SERVICE_ROLE_KEY}" ]]; then
  echo "Local Supabase service-role key was not reported by supabase status." >&2
  exit 1
fi

TOKEN="$(openssl rand -hex 32)"
TOKEN_HASH="$(printf '%s' "${TOKEN}" | sha256sum | awk '{print $1}')"
ENV_FILE="$(mktemp)"
FUNCTION_LOG="$(mktemp)"
cleanup() {
  if [[ -n "${FUNCTION_PID:-}" ]]; then
    kill "${FUNCTION_PID}" 2>/dev/null || true
    wait "${FUNCTION_PID}" 2>/dev/null || true
  fi
  rm -f "${ENV_FILE}" "${FUNCTION_LOG}" /tmp/catalogue-import-*.json
}
trap cleanup EXIT

chmod 600 "${ENV_FILE}"
cat > "${ENV_FILE}" <<EOF
CATALOGUE_IMPORT_TOKEN_SHA256=${TOKEN_HASH}
SUPABASE_URL=${LOCAL_SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${LOCAL_SERVICE_ROLE_KEY}
EOF

supabase functions serve catalogue-import-runner --env-file "${ENV_FILE}" >"${FUNCTION_LOG}" 2>&1 &
FUNCTION_PID=$!

READY=0
for _ in $(seq 1 60); do
  CODE="$(curl -sS -o /tmp/catalogue-import-unauthorized.json -w '%{http_code}' \
    -X POST "${LOCAL_SUPABASE_URL}/functions/v1/catalogue-import-runner" \
    -H 'content-type: application/json' \
    -d '{}' || true)"
  if [[ "${CODE}" == "401" ]]; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "${READY}" != "1" ]]; then
  echo "Local catalogue-import-runner did not become ready." >&2
  tail -100 "${FUNCTION_LOG}" >&2
  exit 1
fi

CODE="$(curl -sS -o /tmp/catalogue-import-no-run-id.json -w '%{http_code}' \
  -X POST "${LOCAL_SUPABASE_URL}/functions/v1/catalogue-import-runner" \
  -H 'content-type: application/json' \
  -H "x-catalogue-import-token: ${TOKEN}" \
  -d '{"adapterKey":"cnhl-shopify-jsonld","dryRun":false,"limit":5}')"
if [[ "${CODE}" != "400" ]]; then
  echo "Importer accepted a write request without a stable logicalRunId." >&2
  cat /tmp/catalogue-import-no-run-id.json >&2
  exit 1
fi

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
