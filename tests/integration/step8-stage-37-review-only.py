#!/usr/bin/env python3
"""Create 37 UNVERIFIED import-review rows in a disposable/local Supabase DB.

Input is the immutable 171-source-pilot archive and balanced 37 queue.
No Production host, login, offer, image or product publication is used.
"""
import base64, json, sys
from pathlib import Path
from urllib.parse import urlparse

pilot=Path(sys.argv[1]);queue_file=Path(sys.argv[2]);out=Path(sys.argv[3])
out.mkdir(parents=True,exist_ok=True)
archive=[]
for path in ("staged-validated-items.json","staged-review-required-items.json"):
    archive+=json.loads((pilot/path).read_text())
look={str(row["import_row_id"]):row for row in archive}
queue=json.loads(queue_file.read_text())["review_queue"]
assert len(archive)==171 and len(queue)==37
assert len({c["pilot_id"] for c in queue})==37
domain_adapters={
    "www.hqprop.com":"hqprop-sitemap-jsonld",
    "www.foxeer.com":"foxeer-sitemap-jsonld",
    "www.speedybee.com":"speedybee-sitemap-jsonld",
    "www.team-blacksheep.com":"tbs-category-html",
}
def quote(s):return "'"+str(s).replace("'","''")+"'"
def blob(obj):return base64.b64encode(
    json.dumps(obj,ensure_ascii=False,separators=(",",":")).encode()).decode()
def jblob(obj):
    return "convert_from(decode("+quote(blob(obj))+",'base64'),'UTF8')::jsonb"
lines=["-- AUTO-GENERATED RESEARCH ROWS ONLY. NEVER RUN ON PRODUCTION.",
 "begin;","set local lock_timeout='5s';","set local statement_timeout='120s';",
 """do $$ begin
 if (select count(*) from public.catalogue_products)<>0
  or (select count(*) from public.catalogue_offers)<>0
  or (select count(*) from public.catalogue_import_rows)<>0
 then raise exception 'Step 8 review staging requires empty disposable database'; end if;
 if (select count(*) from supabase_migrations.schema_migrations)<>24
 then raise exception 'Expected 24 local migrations only'; end if;
 end $$;"""]
rows=[]
for rank,row in enumerate(queue,1):
    pid=row["pilot_id"]
    assert pid in look,pid
    orig=look[pid]
    source=row["source_url"]
    assert source.startswith("https://")
    adapter=domain_adapters[urlparse(source).netloc]
    data=dict(orig.get("normalized") or {})
    assert data.get("category")==row["category"]
    assert orig["source_url"].rstrip("/")==source.rstrip("/"),pid
    assert not row.get("publication_approved")
    data.update({
      "id":"qa-step8-review-"+pid,"source_url":source,
      "model":row["model"],"display_name":row["model"],
      "manufacturer":row["manufacturer"],
      "image_url":None,"image_exact_model_verified":False,
      "image_license_name":None,"image_license_url":None,
      "selectable":False,
    })
    for key in ("price","price_amount","offer_url","stock_status","last_checked_at",
                "merchant_price","image_source_url"):
        data.pop(key,None)
    # Research blockers are explicit. Even normalized complete fields alone
    # cannot make this candidate validated or approved for publication.
    blockers=["Step8: mandatory human model/variant, technical, EU offer and media review"]
    blockers += ["Step8: "+v for v in row["review_blockers"]]
    raw={"historical_pilot_id":pid,"source_url":source,
       "review_queue_rank":rank,"research_only":True,"seller_offer_approved":False,
       "manufacturer_photo_licensed":False,
       "component_classification":row["component_classification"],
       "eligible_as_standalone_component_research":row["eligible_as_standalone_component_research"]}
    rows.append({"pilot_id":pid,"category":row["category"],"model":row["model"],
                 "adapter":adapter,"missing_required_specs":row["missing_required_specs"],
                 "review_blockers":blockers,
                 "component_classification":row["component_classification"],
                 "eligible_standalone_component":row["eligible_as_standalone_component_research"]})
    # Inserts use existing registered manufacturer adapters and official source IDs.
    batchid="md5('step8:review:"+adapter+"')::uuid"
    lines.append(f"""insert into public.catalogue_import_batches
    (id,source_id,adapter_id,file_name,import_kind,status,
     total_rows,valid_rows,invalid_rows,notes)
     select {batchid},a.source_id,a.id,'step8-37-review-only.json',
     'products','staged',0,0,0,
     '37 original manufacturer source research rows: NOT VERIFIED, NO OFFERS/PHOTOS'
     from public.catalogue_source_adapters a
     where a.adapter_key={quote(adapter)} and a.active=true
     on conflict(id) do nothing;""")
    lines.append(f"""insert into public.catalogue_import_rows
     (batch_id,row_number,proposed_product_id,raw_data,normalized_data,
      status,validation_errors)
     values ({batchid},{rank},{quote(data["id"])},{jblob(raw)},
      {jblob(data)},'needs_review',{jblob(blockers)});""")
for adapter in sorted(set(x["adapter"] for x in rows)):
    batchid="md5('step8:review:"+adapter+"')::uuid"
    lines.append(f"""update public.catalogue_import_batches
    set total_rows=(select count(*) from public.catalogue_import_rows where batch_id={batchid}),
        valid_rows=0,
        invalid_rows=(select count(*) from public.catalogue_import_rows where batch_id={batchid}
          and status='needs_review')
    where id={batchid};""")
lines.append("commit;")
(out/"stage-37-review-only.sql").write_text("\n".join(lines)+"\n")
(out/"prepared-37-review-only.json").write_text(json.dumps({
 "source":"unchanged 171 pilot archive","records":rows,
 "all_approved":False,"offers_created":0,"images_reused":0},ensure_ascii=False,indent=2)+"\n")
print("STEP8_STAGING_PREPARED "+json.dumps({
 "records":len(rows),"categories":{c:sum(r["category"]==c for r in rows)
   for c in sorted(set(r["category"] for r in rows))},
 "missing_specs":sum(bool(r["missing_required_specs"]) for r in rows),
 "excluded_non_component":sum(not r["eligible_standalone_component"] for r in rows),
 "safe_unverified":True
},ensure_ascii=False))
