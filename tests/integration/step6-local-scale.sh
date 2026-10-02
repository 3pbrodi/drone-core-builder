#!/usr/bin/env bash
set -euo pipefail
OUT="step6-results"
mkdir -p "$OUT"
PG="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
export PGPASSWORD=postgres
psql_local(){ psql "$PG" -v ON_ERROR_STOP=1 "$@"; }
eval "$(supabase status -o env)"
test "$API_URL" = "http://127.0.0.1:54321"
test -n "$SERVICE_ROLE_KEY"
test -z "$(env | grep '^SUPABASE_ACCESS_TOKEN=' || true)"
test "$(psql_local -qAt -c 'select count(*) from supabase_migrations.schema_migrations;')" = 23
psql_local -qAt -c "
 select jsonb_build_object('migrationCount',(select count(*) from supabase_migrations.schema_migrations),
 'serviceUsage',has_schema_privilege('service_role','catalogue_internal','USAGE'),
 'publicUsage',exists(select 1 from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl where n.nspname='catalogue_internal' and acl.grantee=0 and acl.privilege_type='USAGE'),
 'anonUsage',has_schema_privilege('anon','catalogue_internal','USAGE'),
 'authenticatedUsage',has_schema_privilege('authenticated','catalogue_internal','USAGE'),
 'dbSize',pg_database_size(current_database()),
 'tableCount',(select count(*) from pg_tables where schemaname='public'),
 'indexCount',(select count(*) from pg_indexes where schemaname='public'),
 'products',(select count(*) from public.catalogue_products),
 'candidates',(select count(*) from public.catalogue_products where record_class='candidate'),
 'offers',(select count(*) from public.catalogue_offers),
 'identityEvidence',(select count(*) from public.catalogue_identity_evidence),
 'specEvidence',(select count(*) from public.catalogue_spec_evidence),
 'runs',(select count(*) from public.catalogue_import_runs),
 'items',(select count(*) from public.catalogue_import_run_items),
 'batches',(select count(*) from public.catalogue_import_batches),
 'rows',(select count(*) from public.catalogue_import_rows))" | jq . >"$OUT/baseline.json"
jq -e '.migrationCount==23 and .serviceUsage==true and .publicUsage==false and .anonUsage==false and .authenticatedUsage==false and .products==0 and .candidates==0 and .offers==0 and .identityEvidence==0 and .specEvidence==0 and .runs==0 and .items==0 and .batches==0 and .rows==0' "$OUT/baseline.json" >/dev/null
psql_local -qAt -c "
 select json_agg(json_build_object('table',tablename,'index',indexname,'definition',indexdef) order by tablename,indexname)
 from pg_indexes where schemaname='public' and tablename like 'catalogue_%'
 " | jq . >"$OUT/existing-indexes.json"
psql_local -qAt -c "
 select json_agg(json_build_object('table',tablename,'policy',policyname,'roles',roles,'command',cmd) order by table_name,policyname)
 from pg_policies where schemaname='public' and tablename like 'catalogue_%'
 " | jq . >"$OUT/rls-policies.json"
psql_local <<'SQL'
insert into public.catalogue_sources(id,name,kind,base_url,verification_status)
 values ('20000000-0000-0000-0000-000000000001','TEST/SYNTHETIC Load Lab',
 'manufacturer','https://synthetic.invalid','verified');
insert into public.catalogue_source_adapters(
 id,source_id,adapter_key,adapter_type,version,active,max_batch_size,config)
 values('20000000-0000-0000-0000-000000000002',
 '20000000-0000-0000-0000-000000000001',
 'step6-synthetic-direct-rpc','manufacturer',1,true,250,
 '{"synthetic":true}'::jsonb);
insert into public.catalogue_manufacturers(id,name,verification_status)
 values('20000000-0000-0000-0000-000000000003',
 'TEST/SYNTHETIC Load Lab','verified');
SQL
SOURCE_ID="20000000-0000-0000-0000-000000000001"
ADAPTER_ID="20000000-0000-0000-0000-000000000002"
snapshot(){
 psql_local -qAt -c "
  select jsonb_build_object(
   'products',(select count(*) from public.catalogue_products),
   'candidates',(select count(*) from public.catalogue_products where record_class='candidate'),
   'offers',(select count(*) from public.catalogue_offers),
   'identityEvidence',(select count(*) from public.catalogue_identity_evidence),
   'specEvidence',(select count(*) from public.catalogue_spec_evidence),
   'selectable',(select count(*) from public.catalogue_products where selectable),
   'published',(select count(*) from public.catalogue_public_runtime_products),
   'sourceLinks',(select count(*) from public.catalogue_product_sources),
   'runs',(select count(*) from public.catalogue_import_runs),
   'manifestItems',(select count(*) from public.catalogue_import_run_items),
   'batches',(select count(*) from public.catalogue_import_batches),
   'rows',(select count(*) from public.catalogue_import_rows),
   'dbBytes',pg_database_size(current_database()))" | jq . >"$1"
}
create_run(){
 psql_local -qAt -c "set role service_role;
 select (public.catalogue_get_or_create_import_run(
 '$ADAPTER_ID'::uuid,'$SOURCE_ID'::uuid,'$1',1))->>'runId';"
}
do_discover(){
 psql_local -qAt -v first="$1" -v last="$2" -v run_id="$3" -v pass="$4" -v complete="$5" -v last_cursor="$2" -v total="$6" -f tests/integration/step6-synthetic-discover.sql >/dev/null
}
stage_chunk(){
 psql_local -qAt -v run_id="$1" -v chunk="$2" -v chunk_key="$3" -f tests/integration/step6-synthetic-stage.sql
}
process_chunk(){
 psql_local -qAt -c "set role service_role;
 select public.catalogue_process_import_batch('$1'::uuid,true,'LOCAL SYNTHETIC SCALE TEST');" >/dev/null
}
level(){
 local target="$1" start="$2" chunk="$3" runid curr last pass batch before ms expected
 before=$(date +%s%3N)
 runid=$(create_run "step6-synthetic-level-$target")
 for pass in 1 2; do
   curr="$start"
   while ((curr<=target)); do
      last=$((curr+chunk-1))
      if ((last>target)); then last="$target"; fi
      local complete=0
      if ((pass==2 && last==target)); then complete=1; fi
      do_discover "$curr" "$last" "$runid" "$pass" "$complete" "$target"
      curr=$((last+1))
   done
 done
 test "$(psql_local -qAt -c "select manifest_complete from public.catalogue_import_runs where id='$runid'::uuid;")" = t
 curr="$start"
 while ((curr<=target)); do
   last=$((curr+chunk-1))
   if ((last>target)); then last="$target"; fi
   batch=$(stage_chunk "$runid" "$chunk" "synthetic-$curr-$last")
   test -n "$batch"
   process_chunk "$batch"
   curr=$((last+1))
 done
 psql_local -qAt -c "set role service_role; select public.catalogue_finalize_import_run('$runid'::uuid,false);" >/dev/null
 snapshot "$OUT/after-$target.json"
 jq -e --argjson n "$target" '.products==$n and .candidates==$n and .identityEvidence==$n and .offers==0 and .selectable==0 and .published==0' "$OUT/after-$target.json" >/dev/null
 ms=$(( $(date +%s%3N)-before ))
 echo "{\"level\":$target,\"increment\":$((target-start+1)),\"chunk\":$chunk,\"elapsedMs\":$ms,\"millisPerNewProduct\":$(awk "BEGIN{printf \"%.3f\",$ms/($target-$start+1)}")}" | tee -a "$OUT/level-metrics.jsonl"
 echo "PASS level $target: $ms ms"
}
level 10 1 10
level 100 11 25
level 1000 101 50
level 5000 1001 100
level 10000 5001 250
snapshot "$OUT/pre-idempotency.json"
R=$(create_run "step6-synthetic-level-10000")
test "$(psql_local -qAt -c "select count(*) from public.catalogue_import_runs where id='$R'::uuid;")" = 1
snapshot "$OUT/after-same-logical-run.json"
diff -u <(jq -S 'del(.dbBytes)' "$OUT/pre-idempotency.json") <(jq -S 'del(.dbBytes)' "$OUT/after-same-logical-run.json") >/dev/null || {
 echo "Same logical run changed counts" >&2; exit 1;
}
echo "PASS 10000 same logical run replay: all counters stable" | tee -a "$OUT/summary.txt"
psql_local -qAt -c "
  explain(analyze,buffers,format json)
  select * from public.catalogue_import_run_items
  where run_id=(select id from public.catalogue_import_runs where logical_run_id='step6-synthetic-level-10000')
  and processing_status='done' order by discovery_ordinal limit 100;" > "$OUT/explain-manifest-10000.json"
psql_local -qAt -c "
  explain(analyze,buffers,format json)
  select * from public.catalogue_products where manufacturer_sku='SYN-SKU-9999';" > "$OUT/explain-sku-10000.json"
psql_local -qAt -c "
  explain(analyze,buffers,format json)
  select * from public.catalogue_product_sources where external_product_id='synthetic:variant:9999';" > "$OUT/explain-source-link-10000.json"
psql_local -qAt -c "select jsonb_build_object('families10',(select count(*) from public.catalogue_import_run_items where upstream_parent_product_id='synthetic:product:1'),'families25',(select count(*) from public.catalogue_import_run_items where upstream_parent_product_id='synthetic:product:2'),'families50',(select count(*) from public.catalogue_import_run_items where upstream_parent_product_id='synthetic:product:3'),'distinctIds',(select count(distinct upstream_variant_id) from public.catalogue_import_run_items where upstream_variant_id like 'synthetic:vid:%'));" | jq . > "$OUT/variant-check.json"
echo "Finished synthetic scale through 10000" | tee -a "$OUT/summary.txt"
