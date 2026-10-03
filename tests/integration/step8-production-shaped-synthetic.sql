\set ON_ERROR_STOP on
-- STEP 8: SYNTHETIC-ONLY; not actual Production rows or a Production export.
-- Mirrors the observed 25 product / 25 offer / 25 identity / 98 spec /
-- five batch / forty import row shape and identity-null distribution.
begin;
insert into public.catalogue_manufacturers(id,name,verification_status)
values('99000000-0000-0000-0000-000000000001','SYNTHETIC STEP8 MANUFACTURER','pending_review');
insert into public.catalogue_sources(id,name,kind,base_url,verification_status)
values('99000000-0000-0000-0000-000000000002','SYNTHETIC STEP8 SOURCE','manufacturer','https://synthetic.invalid','pending_review');
insert into public.catalogue_merchants(id,name,country_code,verification_status)
values('99000000-0000-0000-0000-000000000003','SYNTHETIC STEP8 MERCHANT','DE','pending_review');
with src as (select g,case when g<=3 then 'frame' when g<=6 then 'motors'
when g<=9 then 'flightController' when g<=12 then 'esc' when g<=15 then 'propellers'
when g<=19 then 'battery' when g<=22 then 'camera' else 'receiver' end as cat
from generate_series(1,25) g)
insert into public.catalogue_products(
 id,manufacturer_id,model,variant,display_name,category,
 manufacturer_sku,mpn,record_class,identity_status,verification_status,selectable)
select 'step8-syn-'||lpad(g::text,3,'0'),
'99000000-0000-0000-0000-000000000001',
'STEP8 TEST MODEL '||g,
case when g<=10 then 'V1' else null end,
'STEP8 SYNTHETIC UNIT '||g,
cat::public.drone_product_category,
case when g<=8 then null else 'STEP8-SKU-'||g end,
case when g=25 then 'STEP8-MPN-25' else null end,
(case when g=25 then 'candidate' else 'canonical' end)::public.catalogue_record_class,
'pending_review','pending_review',false
from src order by g;
insert into public.catalogue_product_specs(product_id)
select id from public.catalogue_products where id like 'step8-syn-%';
insert into public.catalogue_offers(product_id,merchant_id,product_url,price_amount,currency,region,verification_status)
select id,'99000000-0000-0000-0000-000000000003',
'https://synthetic.invalid/offer/'||id,9.00,'EUR','EU','pending_review'
from public.catalogue_products where id like 'step8-syn-%';
insert into public.catalogue_identity_evidence(
 product_id,source_id,source_url,authority,manufacturer_label,model_label,
 exact_model_association,verification_status)
select id,'99000000-0000-0000-0000-000000000002',
'https://synthetic.invalid/identity/'||id,'manufacturer','STEP8 SYNTHETIC',model,true,'pending_review'
from public.catalogue_products where id like 'step8-syn-%';
insert into public.catalogue_spec_evidence(
 product_id,field_key,value,unit,source_id,source_url,authority,
 exact_model_association,verification_status)
select p.id,'weight',to_jsonb(j::numeric),'g','99000000-0000-0000-0000-000000000002',
'https://synthetic.invalid/spec/'||p.id||'/'||j,
'manufacturer',true,'pending_review'
from public.catalogue_products p cross join lateral generate_series(
 1,case when substring(p.id from '([0-9]{3})$')::int<=23 then 4 else 3 end) j
where p.id like 'step8-syn-%';
with batches as (
insert into public.catalogue_import_batches(id,source_id,file_name,status,total_rows)
select ('99000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid,
'99000000-0000-0000-0000-000000000002','step8-synthetic-'||g||'.csv','staged',8
from generate_series(1,5) g returning id)
insert into public.catalogue_import_rows(batch_id,row_number,raw_data,normalized_data,status,dedupe_status)
select b.id,r,'{"synthetic":true}'::jsonb,'{}'::jsonb,'staged',
case when row_number() over(order by b.id,r)<=16 then 'new' else 'unresolved' end
from batches b cross join generate_series(1,8) r;
commit;
select jsonb_build_object(
'products',(select count(*) from public.catalogue_products),
'candidates',(select count(*) from public.catalogue_products where record_class='candidate'),
'offers',(select count(*) from public.catalogue_offers),
'identityEvidence',(select count(*) from public.catalogue_identity_evidence),
'technicalEvidence',(select count(*) from public.catalogue_spec_evidence),
'importBatches',(select count(*) from public.catalogue_import_batches),
'importRows',(select count(*) from public.catalogue_import_rows),
'sourceLinks',(select count(*) from public.catalogue_product_sources),
'unresolved',(select count(*) from public.catalogue_import_rows where dedupe_status='unresolved'),
'new',(select count(*) from public.catalogue_import_rows where dedupe_status='new')
);
