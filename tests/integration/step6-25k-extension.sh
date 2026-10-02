#!/usr/bin/env bash
set -euo pipefail
# Disposable LOCAL data only. The existing, proven 10k scale suite defines
# reusable SQL-backed RPC helpers; sourcing it runs 10k before the extension.
source tests/integration/step6-local-scale.sh
level 25000 10001 250
snapshot "$OUT/pre-cross-run.json"
free -m >"$OUT/resource-snapshot.txt"
ps -eo pid,comm,rss --sort=-rss | head -35 >>"$OUT/resource-snapshot.txt"

cross_run() {
 local logical="$1" runid curr last pass batch complete
 runid="$(create_run "$logical")"
 for pass in 1 2; do
  curr=1
  while ((curr<=1000)); do
   last=$((curr+249))
   if ((last>1000)); then last=1000; fi
   complete=0
   if ((pass==2 && last==1000)); then complete=1; fi
   do_discover "$curr" "$last" "$runid" "$pass" "$complete" 1000
   curr=$((last+1))
  done
 done
 test "$(psql_local -qAt -c "select manifest_complete from public.catalogue_import_runs where id='$runid'::uuid;")" = t
 curr=1
 while ((curr<=1000)); do
  last=$((curr+249))
  if ((last>1000)); then last=1000; fi
  batch=$(stage_chunk "$runid" 250 "synthetic-crossrun-$logical-$curr-$last")
  test -n "$batch"
  process_chunk "$batch"
  curr=$((last+1))
 done
 psql_local -qAt -c "set role service_role; select public.catalogue_finalize_import_run('$runid'::uuid,false);" | jq . >"$OUT/crossrun-$logical-final.json"
 jq -e '.status=="completed" and .failedCount==0' "$OUT/crossrun-$logical-final.json" >/dev/null
 echo "$runid"
}
FIRST="$(cross_run step6-crossrun-A)"
snapshot "$OUT/after-crossrun-A.json"
jq -e --slurpfile b "$OUT/pre-cross-run.json" '
 .products==$b[0].products and .candidates==$b[0].candidates
 and .identityEvidence==$b[0].identityEvidence
 and .specEvidence==$b[0].specEvidence
 and .sourceLinks==($b[0].sourceLinks+345)
 and .exactRows==($b[0].exactRows+345)
 and .reviewRows==($b[0].reviewRows+655)
 and .manifestItems==($b[0].manifestItems+1000)
 and .rows==($b[0].rows+1000)
 and .failedItems==0 and .incompleteItems==0
 and .offers==0 and .selectable==0 and .published==0
' "$OUT/after-crossrun-A.json" >/dev/null || {
 echo "Cross-logical-run A dedupe/source-link assertion failed" >&2
 cat "$OUT/after-crossrun-A.json"
 exit 1
}
echo "PASS crossrun A: exactly 345 source links, 655 review items, no new products" >>"$OUT/summary.txt"
SECOND="$(cross_run step6-crossrun-B)"
snapshot "$OUT/after-crossrun-B.json"
jq -e --slurpfile a "$OUT/after-crossrun-A.json" '
 .products==$a[0].products and .candidates==$a[0].candidates
 and .identityEvidence==$a[0].identityEvidence
 and .specEvidence==$a[0].specEvidence
 and .sourceLinks==$a[0].sourceLinks
 and .exactRows==($a[0].exactRows+345)
 and .reviewRows==($a[0].reviewRows+655)
 and .manifestItems==($a[0].manifestItems+1000)
 and .rows==($a[0].rows+1000)
 and .failedItems==0 and .incompleteItems==0
 and .offers==0 and .selectable==0 and .published==0
' "$OUT/after-crossrun-B.json" >/dev/null || {
 echo "Cross-logical-run B dedupe/source-link assertion failed" >&2
 cat "$OUT/after-crossrun-B.json"
 exit 1
}
echo "PASS crossrun B: existing exact links reused; no duplicate products/evidence/source links" >>"$OUT/summary.txt"
DUPLICATE="$(create_run step6-crossrun-B)"
test "$DUPLICATE" = "$SECOND"
snapshot "$OUT/after-same-crossrun-replay.json"
diff -u <(jq -S 'del(.dbBytes)' "$OUT/after-crossrun-B.json") <(jq -S 'del(.dbBytes)' "$OUT/after-same-crossrun-replay.json") >/dev/null
echo "PASS repeat logical B: exact durable counters unchanged" >>"$OUT/summary.txt"
psql_local -qAt -c "explain(analyze,buffers,format json)
 select * from public.catalogue_product_sources
 where source_id='$SOURCE_ID'::uuid and external_product_id='synthetic:variant:1';" >"$OUT/explain-source-link-after-crossrun-25k.json"
psql_local -qAt -c "explain(analyze,buffers,format json)
 select * from public.catalogue_import_run_items
 where run_id='$FIRST'::uuid and processing_status='done'
 order by discovery_ordinal limit 250;" >"$OUT/explain-manifest-crossrun-25k.json"
psql_local -qAt -c "explain(analyze,buffers,format json)
 select * from public.catalogue_products
 where manufacturer_id='20000000-0000-0000-0000-000000000003'::uuid
 and category='propellers' and lower(trim(model))='synthetic test model 1'
 and lower(trim(coalesce(variant,'')))='v0000001'
 and lower(trim(coalesce(manufacturer_sku,'')))='syn-sku-1'
 and lower(trim(coalesce(mpn,'')))='syn-mpn-1';" >"$OUT/explain-composite-identity-25k.json"
echo "PASS 25k scale and crossrun dedupe completed" | tee -a "$OUT/summary.txt"
