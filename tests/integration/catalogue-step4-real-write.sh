#!/usr/bin/env bash
set -euo pipefail

# Step 4 is deliberately confined to the disposable local Supabase stack.
# Selection sitemap contains ONLY two real URLs found by the official HQProp
# adapter in Step 3. Their HTML/JSON-LD is fetched LIVE by the unchanged runner.
OUT="step4-results"
mkdir -p "$OUT" /tmp/step4-sitemap
PG="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
export PGPASSWORD=postgres
psql_local() { psql "$PG" -v ON_ERROR_STOP=1 "$@"; }

eval "$(supabase status -o env)"
test "$API_URL" = "http://127.0.0.1:54321" || { echo "REFUSING NON-LOCAL SUPABASE API"; exit 1; }
test -n "$SERVICE_ROLE_KEY" || { echo "No local service-role key"; exit 1; }
test -z "$(env | grep '^SUPABASE_ACCESS_TOKEN=' || true)" || { echo "Unexpected hosted Supabase token"; exit 1; }
echo "local-only API URL and local CLI credentials verified" >"$OUT/safety.txt"
cat >/tmp/step4-sitemap/sitemap.xml <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://hqprop.com/direct-drive-prop-6x3b-ccw-p0267.html</loc></url>
  <url><loc>https://hqprop.com/direct-drive-pusher-prop-6x3rb-cw-p0268.html</loc></url>
</urlset>
XML
cp /tmp/step4-sitemap/sitemap.xml "$OUT/scope-sitemap.xml"
python3 -m http.server 8765 --bind 127.0.0.1 --directory /tmp/step4-sitemap >"$OUT/sitemap-server.log" 2>&1 &
SITEMAP_PID=$!
FUNCTION_PID=""
cleanup() {
  if [[ -n "$FUNCTION_PID" ]]; then kill "$FUNCTION_PID" 2>/dev/null || true; fi
  kill "$SITEMAP_PID" 2>/dev/null || true
  rm -f /tmp/step4-import-token
}
trap cleanup EXIT
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8765/sitemap.xml -o /dev/null; then break; fi
  sleep 1
done

snapshot() {
  psql_local -At -c "
    select jsonb_build_object(
      'products',(select count(*) from public.catalogue_products),
      'candidates',(select count(*) from public.catalogue_products where record_class='candidate'),
      'selectable',(select count(*) from public.catalogue_products where selectable),
      'publishedRuntime',(select count(*) from public.catalogue_public_runtime_products),
      'offers',(select count(*) from public.catalogue_offers),
      'identityEvidence',(select count(*) from public.catalogue_identity_evidence),
      'specEvidence',(select count(*) from public.catalogue_spec_evidence),
      'sources',(select count(*) from public.catalogue_sources where kind='manufacturer' and verification_status='verified'),
      'activeAdapters',(select count(*) from public.catalogue_source_adapters where active),
      'productSources',(select count(*) from public.catalogue_product_sources),
      'runs',(select count(*) from public.catalogue_import_runs),
      'runItems',(select count(*) from public.catalogue_import_run_items),
      'batches',(select count(*) from public.catalogue_import_batches),
      'rows',(select count(*) from public.catalogue_import_rows),
      'candidateEvents',(select count(*) from public.catalogue_promotion_events where action='candidate_created'),
      'exactLinkEvents',(select count(*) from public.catalogue_promotion_events where action='exact_import_match_linked')
    );" | jq . > "$1"
}

snapshot "$OUT/before.json"
jq -e '
 .products==0 and .candidates==0 and .selectable==0 and .publishedRuntime==0
 and .offers==0 and .identityEvidence==0 and .specEvidence==0
 and .runs==0 and .runItems==0 and .batches==0 and .rows==0
 and .sources==10 and .activeAdapters==10' "$OUT/before.json" >/dev/null
test "$(psql_local -At -c 'select count(*) from supabase_migrations.schema_migrations;')" = 22
echo "22 local migrations, 10 verified sources and zero imported catalogue rows" | tee -a "$OUT/safety.txt"

# ONLY local adapter configuration is changed, to constrain discovery.
# The product pages are still fetched directly from HQProp on each run.
psql_local <<'SQL'
update public.catalogue_source_adapters
set config=jsonb_set(
  config,'{sitemapUrl}',
  to_jsonb('http://127.0.0.1:8765/sitemap.xml'::text)
), updated_at=now()
where adapter_key='hqprop-sitemap-jsonld';
do $$
begin
 if (select count(*) from public.catalogue_source_adapters
     where adapter_key='hqprop-sitemap-jsonld'
       and config->>'sitemapUrl'='http://127.0.0.1:8765/sitemap.xml')<>1 then
   raise exception 'Local-only bounded adapter configuration failed';
 end if;
end $$;
SQL

umask 077
openssl rand -hex 32 >/tmp/step4-import-token
TOKEN="$(cat /tmp/step4-import-token)"
HASH="$(printf '%s' "$TOKEN" | sha256sum | awk '{print $1}')"
env CATALOGUE_IMPORT_TOKEN_SHA256="$HASH" \
  SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  deno run --allow-env --allow-net=0.0.0.0:8000,127.0.0.1:8000,127.0.0.1:54321,127.0.0.1:8765,hqprop.com,www.hqprop.com \
  supabase/functions/catalogue-import-runner/index.ts >"$OUT/importer.log" 2>&1 &
FUNCTION_PID=$!
post() {
  curl --fail-with-body -sS --max-time 180 \
    -H 'content-type: application/json' -H "x-catalogue-import-token: $TOKEN" \
    -d "$1" 'http://127.0.0.1:8000' -o "$2"
}
READY=0
for i in $(seq 1 50); do
  if post '{"adapterKey":"hqprop-sitemap-jsonld","dryRun":false,"limit":1}' \
    "$OUT/readiness.json" 2>/dev/null; then :; else
    if jq -e '.error | test("logicalRunId")' "$OUT/readiness.json" >/dev/null 2>&1; then READY=1; break; fi
  fi
  sleep 1
done
test "$READY" = 1 || { echo "Importer not ready"; tail -100 "$OUT/importer.log"; exit 1; }

# Live DRY RUN is an additional guard against unexpected manufacturer changes.
post '{"adapterKey":"hqprop-sitemap-jsonld","dryRun":true,"limit":2}' \
  "$OUT/live-preflight-dry-run.json"
jq -e '
 .dryRun==true and .discovered==2 and .stageable==2 and .failed==0 and
 ([.sample[].normalized.manufacturer_sku]|sort)==["HQP010506302","HQP010506303"] and
 ([.sample[].normalized.propeller_diameter_inches]|all(.==6)) and
 ([.sample[].normalized.identity_conflicts[]]|length)==0 and
 ([.sample[].errors[]]|length)==0
' "$OUT/live-preflight-dry-run.json" >/dev/null || {
  echo "Live manufacturer response differs from Step 3; REFUSING WRITE"
  exit 1
}
snapshot "$OUT/after-preflight.json"
cmp "$OUT/before.json" "$OUT/after-preflight.json"
echo "Live manufacturer HTML parsed; exactly two expected stageable SKUs; preflight wrote no catalogue records" | tee -a "$OUT/safety.txt"

request_run() {
  local logical="$1" expected="$2" prefix="$3"
  local phase=""
  for n in 1 2 3 4 5; do
    post "$(jq -nc --arg id "$logical" '{adapterKey:"hqprop-sitemap-jsonld",dryRun:false,createCandidates:true,logicalRunId:$id,limit:2}')" \
      "$OUT/$prefix-call-$n.json"
    phase="$(jq -r '.phase // empty' "$OUT/$prefix-call-$n.json")"
    jq -c '{phase,logicalRunId,runId,discovery,processing}' "$OUT/$prefix-call-$n.json"
    if [[ "$phase" == "processed_chunk" ]]; then
      jq -e --argjson expected "$expected" \
        '.processing.staged.totalRows==2 and .processing.processed.candidatesCreated==$expected' \
        "$OUT/$prefix-call-$n.json" >/dev/null
      cp "$OUT/$prefix-call-$n.json" "$OUT/$prefix-processed.json"
      break
    fi
    test "$phase" = "discovery" || { echo "Unexpected importer phase: $phase"; exit 1; }
  done
  test "$phase" = "processed_chunk" || { echo "Run did not process exactly two real products"; exit 1; }
}

# REAL WRITE number one: both URLs are fetched from the manufacturer's website.
request_run "step4-hqprop-real-two" 2 primary
snapshot "$OUT/after-first-real-write.json"
jq -e '
 .products==2 and .candidates==2 and .selectable==0 and .publishedRuntime==0
 and .offers==0 and .identityEvidence==2 and .specEvidence==2
 and .runs==1 and .runItems==4 and .batches==1 and .rows==2 and .candidateEvents==2
' "$OUT/after-first-real-write.json" >/dev/null || {
  echo "First real write did not produce the expected candidate and evidence counts"; exit 1;
}

psql_local <<'SQL'
do $$
begin
  if (select count(*) from public.catalogue_products p
       join public.catalogue_manufacturers m on m.id=p.manufacturer_id
       join public.catalogue_product_specs s on s.product_id=p.id
       where m.name='HQProp' and p.category='propellers'
         and p.record_class='candidate' and p.selectable=false
         and p.verification_status='pending_review'
         and p.identity_status='pending_review'
         and s.propeller_diameter_inches=6
         and (p.manufacturer_sku,p.model) in (
           ('HQP010506302','Direct Drive Prop 6x3B CCW'),
           ('HQP010506303','Direct Drive Pusher Prop 6x3RB CW')
         ))<>2 then
    raise exception 'Exact HQProp candidates / SKUs / specs were not persisted correctly';
  end if;
  if (select count(*) from public.catalogue_identity_evidence e
       join public.catalogue_sources s on s.id=e.source_id
       where s.name='HQProp official' and e.authority='manufacturer'
         and e.verification_status='pending_review' and e.exact_model_association
         and e.source_url in (
           'https://hqprop.com/direct-drive-prop-6x3b-ccw-p0267.html',
           'https://hqprop.com/direct-drive-pusher-prop-6x3rb-cw-p0268.html'
         ))<>2 then
    raise exception 'Expected source-backed pending identity evidence missing';
  end if;
  if (select count(*) from public.catalogue_spec_evidence e
      where e.field_key='propInches' and e.value='6'::jsonb
      and e.authority='manufacturer' and e.verification_status='pending_review'
      and e.exact_model_association and e.conditions->>'extraction'='structured_or_configured_regex')<>2 then
    raise exception 'Expected source-backed pending propInches evidence missing';
  end if;
  if exists(select 1 from public.catalogue_offers)
    or exists(select 1 from public.catalogue_products where selectable)
    or exists(select 1 from public.catalogue_public_runtime_products)
    or exists(select 1 from public.catalogue_identity_evidence where verification_status='verified')
    or exists(select 1 from public.catalogue_spec_evidence where verification_status='verified')
  then raise exception 'Premature publication or verification'; end if;
end $$;
SQL

# A repeat of the SAME logical run must reuse its ID and must not add rows.
PRIMARY_ID="$(jq -r '.runId' "$OUT/primary-processed.json")"
post '{"adapterKey":"hqprop-sitemap-jsonld","dryRun":false,"createCandidates":true,"logicalRunId":"step4-hqprop-real-two","limit":2,"finalize":true}' \
  "$OUT/same-logical-run-finalized.json"
jq -e --arg id "$PRIMARY_ID" '.runId==$id and .phase=="finalized"' "$OUT/same-logical-run-finalized.json" >/dev/null
snapshot "$OUT/after-same-run-repeat.json"
cmp "$OUT/after-first-real-write.json" "$OUT/after-same-run-repeat.json"
echo "Same logical run reused its ID with no duplicate rows" | tee -a "$OUT/safety.txt"

# A FRESH logical run against exactly the same two live manufacturer URLs
# exercises exact dedupe/source-linking, not just same-run replay caching.
request_run "step4-hqprop-cross-run-dedupe" 0 dedupe
jq -e '.processing.processed.linkedExactMatches==2' "$OUT/dedupe-processed.json" >/dev/null
snapshot "$OUT/after-cross-run-dedupe.json"
jq -e '
 .products==2 and .candidates==2 and .selectable==0 and .publishedRuntime==0
 and .offers==0 and .identityEvidence==2 and .specEvidence==2
 and .runs==2 and .runItems==8 and .batches==2 and .rows==4
 and .candidateEvents==2 and .exactLinkEvents==2
 and .productSources==2
' "$OUT/after-cross-run-dedupe.json" >/dev/null || {
  echo "Cross-run dedupe or evidence counts differ from expectation"; exit 1;
}
psql_local -At -c "
 select jsonb_agg(jsonb_build_object('sku',p.manufacturer_sku,'model',p.model,
 'id',p.id,'source',s.name,'externalId',ps.external_product_id,
 'sourceUrl',ps.source_url,'sourceReview',ps.verification_status))
 from public.catalogue_product_sources ps
 join public.catalogue_products p on p.id=ps.product_id
 join public.catalogue_sources s on s.id=ps.source_id;" | jq . >"$OUT/product-source-links.json"

# Repeat finalize for the other logical run (again strictly idempotent).
SECOND_ID="$(jq -r '.runId' "$OUT/dedupe-processed.json")"
post '{"adapterKey":"hqprop-sitemap-jsonld","dryRun":false,"createCandidates":true,"logicalRunId":"step4-hqprop-cross-run-dedupe","limit":2,"finalize":true}' \
  "$OUT/cross-run-finalized.json"
jq -e --arg id "$SECOND_ID" '.runId==$id and .phase=="finalized"' "$OUT/cross-run-finalized.json" >/dev/null
snapshot "$OUT/final.json"
cmp "$OUT/final.json" "$OUT/after-cross-run-dedupe.json"

psql_local -At -c "
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',p.id,'manufacturer',m.name,'model',p.model,'variant',p.variant,
 'category',p.category,'sku',p.manufacturer_sku,'mpn',p.mpn,
 'diameterInches',s.propeller_diameter_inches,
 'recordClass',p.record_class,'identityStatus',p.identity_status,
 'verificationStatus',p.verification_status,'selectable',p.selectable,
 'imageReview',(select jsonb_agg(i.verification_status) from public.catalogue_product_images i where i.product_id=p.id),
 'publicationBlockers',public.catalogue_publication_blockers(p.id)
 ) order by p.manufacturer_sku),'[]'::jsonb)
 from public.catalogue_products p
 join public.catalogue_manufacturers m on m.id=p.manufacturer_id
 join public.catalogue_product_specs s on s.product_id=p.id;" | jq . >"$OUT/products.json"
psql_local -At -c "
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',id,'logicalRunId',logical_run_id,'status',status,'manifestComplete',manifest_complete,
 'manifestHash',manifest_hash,'discovered',discovered_count,'completed',completed_count,
 'staged',staged_count,'excluded',excluded_count,'failed',failed_count,'review',review_count
 ) order by logical_run_id),'[]'::jsonb) from public.catalogue_import_runs;" | jq . >"$OUT/runs.json"
psql_local -At -c "
 select coalesce(jsonb_agg(jsonb_build_object(
 'runId',run_id,'upstreamItemId',upstream_item_id,'parentId',parent_upstream_item_id,
 'itemKind',item_kind,'discoveryStatus',discovery_status,'processingStatus',processing_status,
 'attempts',attempt_count,'sourceUrl',source_url,'importRowId',import_row_id)
 order by run_id,discovery_ordinal),'[]'::jsonb)
 from public.catalogue_import_run_items;" | jq . >"$OUT/run-items.json"
psql_local -At -c "
 select coalesce(jsonb_agg(jsonb_build_object(
 'sku',normalized_data->>'manufacturer_sku','sourceExternalId',
 normalized_data->>'source_external_product_id','sourceUrl',normalized_data->>'source_url',
 'category',normalized_data->>'category','spec',normalized_data->'propeller_diameter_inches',
 'status',status,'dedupeStatus',dedupe_status,'matchedProductId',matched_product_id)
 order by import_run_id,row_number),'[]'::jsonb)
 from public.catalogue_import_rows;" | jq . >"$OUT/import-rows.json"
psql_local -At -c "
 select coalesce(jsonb_agg(jsonb_build_object(
 'productId',product_id,'field',field_key,'value',value,'sourceUrl',source_url,
 'authority',authority,'verificationStatus',verification_status,
 'exactModelAssociation',exact_model_association,
 'conditions',conditions,'caveats',caveats)),'[]'::jsonb)
 from public.catalogue_spec_evidence;" | jq . >"$OUT/spec-evidence.json"
psql_local -At -c "
 select coalesce(jsonb_agg(jsonb_build_object(
 'productId',product_id,'sourceUrl',source_url,'authority',authority,
 'verificationStatus',verification_status,'exactModelAssociation',
 exact_model_association,'caveats',caveats)),'[]'::jsonb)
 from public.catalogue_identity_evidence;" | jq . >"$OUT/identity-evidence.json"
echo "STEP 4 PASSED: exactly two live manufacturer candidates, source-backed pending evidence, real local write, same-run idempotence, cross-run exact dedupe, no publication" | tee -a "$OUT/safety.txt"
cat "$OUT/final.json"
