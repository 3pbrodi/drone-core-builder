#!/usr/bin/env python3
"""Prepare a source-traceable eight-part local QA fixture from the immutable
successful Step 9B.2 artifact. No network, secrets or production DB access.
The fixture is current-source RESEARCH OVERLAY, not verified manufacturer
data; no product/offer receives approval here.
"""
import base64
import json
from pathlib import Path
import sys

pilot_dir=Path(sys.argv[1])
evidence_path=Path(sys.argv[2])
out=Path(sys.argv[3])
out.mkdir(parents=True,exist_ok=True)
evidence=json.loads(evidence_path.read_text())
archived=[]
for filename in ("staged-validated-items.json","staged-review-required-items.json"):
    archived += json.loads((pilot_dir/filename).read_text())
lookup={str(item["import_row_id"]):item for item in archived}
assert len(evidence["items"])==8
assert len({i["category"] for i in evidence["items"]})==8
assert sum(i["qaCandidate"] for i in evidence["items"])==4
assert len({i["pilotId"] for i in evidence["items"]})==8

samples=[]
for item in evidence["items"]:
    pilot_id=item["pilotId"]
    if pilot_id.startswith("NEU-"):
        assert pilot_id=="NEU-CNHL-3S-1300"
        normalized={
            "id":"qa-cnhl-black-v2-1300mah-3s-130c-xt60-1pack",
            "source_external_product_id":"official-product:1301303BK:one-pack",
            "source_external_parent_product_id":"official-product:1301303BK",
            "manufacturer":"CNHL","image_url":None,
            "image_provenance":"Image withheld: usage rights unverified",
        }
    else:
        original=lookup[pilot_id]
        assert original["category"]==item["category"],(pilot_id,original["category"])
        assert original["source_url"].rstrip("/")==item["source"].rstrip("/"),pilot_id
        normalized=original["normalized"].copy()
    # Preserve original upstream identity. Vendor GTINs are NOT manufacturer's
    # unambiguous SKUs, and ambiguous options never gain artificial variant IDs.
    normalized.update({
        "category":item["category"],"model":item["model"],
        "display_name":item["model"],
        "manufacturer_sku":item["manufacturerSku"],
        "source_url":item["source"],"source_product_url":item["source"],
        "image_url":None,"image_exact_model_verified":False,
        "image_license_name":None,"image_license_url":None,
        **item["specs"],
    })
    if item["pilotId"]=="126":normalized["variant"]="SE with Immortal-T V2"
    elif item["pilotId"]=="132":normalized["variant"]="6S / 60A"
    elif item["pilotId"]=="156":normalized["variant"]="1 PCS"
    elif item["pilotId"]=="159":normalized["variant"]="O4P-SE"
    elif item["pilotId"]=="72":normalized["variant"]=None # aspect/lens ambiguous
    elif item["pilotId"]=="4":normalized["variant"]="2CW+2CCW 4-pack"
    elif item["pilotId"].startswith("NEU-"):normalized["variant"]="1 battery / XT60"
    sample={**item,"normalized":normalized}
    samples.append(sample)

(out/"prepared-eight.json").write_text(json.dumps(samples,ensure_ascii=False,indent=2)+"\n")
def encode(value):
    return base64.b64encode(json.dumps(value,ensure_ascii=False,separators=(",",":")).encode()).decode()
def sqlstr(value):
    return "'"+str(value).replace("'","''")+"'"
adapters=sorted({i["adapter"] for i in samples})
batch={a:f"md5('step9b4:{a}')::uuid" for a in adapters}
lines=[
"-- GENERATED frozen-source, nonpublishing local QA fixture. NEVER run against Production.",
"begin;","set local lock_timeout='5s';","set local statement_timeout='120s';",
"do $$ begin",
"  if (select count(*) from public.catalogue_products)<>0 then raise exception 'QA requires empty disposable product DB'; end if;",
"  if (select count(*) from public.catalogue_offers)<>0 then raise exception 'QA requires zero merchant offers'; end if;",
"  if (select count(*) from supabase_migrations.schema_migrations)<>23 then raise exception 'Expected 23 local repository migrations'; end if;",
"end $$;",
]
for a in adapters:
    lines.append(f"""insert into public.catalogue_import_batches
(id,source_id,adapter_id,file_name,import_kind,status,total_rows,valid_rows,invalid_rows,notes)
select {batch[a]}, a.source_id, a.id,'step9b4-{a}.json','products','staged',0,0,0,
'Isolated frozen-source QA fixture; no approved retail offers and no licensed product photos'
from public.catalogue_source_adapters a
where a.adapter_key={sqlstr(a)}
  and a.active=true;""")
    lines.append(f"do $$ begin if not exists(select 1 from public.catalogue_import_batches where id={batch[a]}) then raise exception 'Missing adapter {a}'; end if; end $$;")
for a in adapters:
    for n,item in enumerate([x for x in samples if x["adapter"]==a],1):
        norm=item["normalized"]
        raw={"pilotId":item["pilotId"],"sourceUrl":item["source"],"fixture":"step9b4","offerEvidenceOnly":True,"originalShopCode":item.get("externalShopCode")}
        warnings=list(lookup[item["pilotId"]]["validation_errors"]) if item["pilotId"] in lookup else []
        if item["qaCandidate"]:
            warnings=[]
        else:
            warnings=[f"Isolated QA hold: {w}" for w in item["blockers"]]
        state="validated" if item["qaCandidate"] else "needs_review"
        lines.append(f"""insert into public.catalogue_import_rows
(batch_id,row_number,proposed_product_id,raw_data,normalized_data,status,validation_errors)
values ({batch[a]},{n},{sqlstr(norm["id"])},
convert_from(decode('{encode(raw)}','base64'),'UTF8')::jsonb,
convert_from(decode('{encode(norm)}','base64'),'UTF8')::jsonb,
'{state}',convert_from(decode('{encode(warnings)}','base64'),'UTF8')::jsonb);""")
    lines.append(f"""update public.catalogue_import_batches
set total_rows=(select count(*) from public.catalogue_import_rows where batch_id={batch[a]}),
    valid_rows=(select count(*) from public.catalogue_import_rows where batch_id={batch[a]} and status='validated'),
    invalid_rows=(select count(*) from public.catalogue_import_rows where batch_id={batch[a]} and status='needs_review')
where id={batch[a]};""")
    lines.append(f"select public.catalogue_run_import_dedupe({batch[a]});")
lines.append("""do $$ begin
 if (select count(*) from public.catalogue_import_rows)<>8 then raise exception 'Expected exactly eight real source rows'; end if;
 if (select count(*) from public.catalogue_import_rows where dedupe_status='new')<>8 then raise exception 'Unexpected first-pass dedupe'; end if;
end $$;""")
for item in [x for x in samples if x["qaCandidate"]]:
    id=sqlstr(item["normalized"]["id"])
    lines.append(f"""select public.catalogue_create_candidate_from_deduped_import(
 (select id from public.catalogue_import_rows where proposed_product_id={id}),
 'DroneCores disposable QA only',
 'Technical data and identity are pending human verification; offer information is only an external research snapshot, not a DB offer'
);""")
    # Evidence is source-provenanced but remains unverified. Never infer image rights.
    source=sqlstr(item["source"])
    a=sqlstr(item["adapter"])
    lines.append(f"""insert into public.catalogue_identity_evidence
(product_id,source_id,source_url,authority,manufacturer_label,model_label,
variant_label,exact_model_association,verification_status,retrieved_at,caveats)
select {id},a.source_id,{source},'manufacturer',p.name,{sqlstr(item["model"])},
{sqlstr(item["normalized"].get("variant") or "")},true,'pending_review',now(),
'Offline exact-source identity; human verification and genuine current offers outstanding'
from public.catalogue_source_adapters a
join public.catalogue_sources p on p.id=a.source_id
where a.adapter_key={a};""")
    lines.append(f"""insert into public.catalogue_spec_evidence
(product_id,field_key,value,source_id,source_url,authority,exact_model_association,
 verification_status,retrieved_at,conditions,caveats)
select {id},req.field_key,public.catalogue_product_field_value_json({id},req.field_key),
a.source_id,{source},'manufacturer',true,'pending_review',now(),
jsonb_build_object('fixture','step9b4','provenance','source-backed frozen QA research'),
'Automated copy from independently researched exact official page; NOT reviewer approved'
from public.catalogue_category_field_requirements req
cross join public.catalogue_source_adapters a
where a.adapter_key={a} and req.category={sqlstr(item["category"])}::public.drone_product_category
and public.catalogue_product_field_value_json({id},req.field_key) is not null;""")
lines.append("commit;")
(out/"stage-and-create-four.sql").write_text("\n".join(lines)+"\n")
print("PREPARED_SAMPLES",len(samples),"CATEGORIES",len({x["category"] for x in samples}),"CANDIDATE_SEEDS",sum(x["qaCandidate"] for x in samples))
