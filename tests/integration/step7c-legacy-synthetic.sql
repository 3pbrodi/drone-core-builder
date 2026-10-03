\set ON_ERROR_STOP on
-- Disposable historical-data fixture. Synthetic identifiers, no Production data.
insert into public.catalogue_manufacturers(id,name,verification_status)
values('88000000-0000-0000-0000-000000000001','TEST/SYNTHETIC Legacy Manufacturer','pending_review');
insert into public.catalogue_sources(id,name,kind,base_url,verification_status)
values('88000000-0000-0000-0000-000000000002','TEST/SYNTHETIC Legacy Source','manufacturer','https://synthetic.invalid','pending_review');
insert into public.catalogue_merchants(id,name,country_code,verification_status)
values('88000000-0000-0000-0000-000000000003','TEST/SYNTHETIC Legacy Merchant','DE','pending_review');
insert into public.catalogue_products(
 id,manufacturer_id,model,variant,display_name,category,
 manufacturer_sku,record_class,identity_status,verification_status,selectable)
values('step7c-local-legacy-prop','88000000-0000-0000-0000-000000000001',
 'TEST/SYNTHETIC Legacy Prop','V1','TEST/SYNTHETIC Prop V1','propellers',
 'TEST-STEP7C-LEGACY-SKU','canonical','pending_review','pending_review',false);
insert into public.catalogue_product_specs(product_id,propeller_diameter_inches)
values('step7c-local-legacy-prop',6);
insert into public.catalogue_offers(id,product_id,merchant_id,product_url,price_amount,currency,region,verification_status)
values('88000000-0000-0000-0000-000000000004','step7c-local-legacy-prop',
 '88000000-0000-0000-0000-000000000003','https://synthetic.invalid/offer',1.23,'EUR','EU','pending_review');
insert into public.catalogue_identity_evidence(
 id,product_id,source_id,source_url,authority,manufacturer_label,model_label,variant_label,
 exact_model_association,verification_status)
values('88000000-0000-0000-0000-000000000005','step7c-local-legacy-prop',
 '88000000-0000-0000-0000-000000000002','https://synthetic.invalid/identity','manufacturer',
 'TEST/SYNTHETIC Legacy Manufacturer','TEST/SYNTHETIC Legacy Prop','V1',true,'pending_review');
insert into public.catalogue_spec_evidence(
 id,product_id,field_key,value,unit,source_id,source_url,authority,exact_model_association,verification_status)
values('88000000-0000-0000-0000-000000000006','step7c-local-legacy-prop','propInches',
 '6'::jsonb,'in','88000000-0000-0000-0000-000000000002',
 'https://synthetic.invalid/spec','manufacturer',true,'pending_review');
select jsonb_build_object(
 'products',(select count(*) from public.catalogue_products),
 'offers',(select count(*) from public.catalogue_offers),
 'identityEvidence',(select count(*) from public.catalogue_identity_evidence),
 'technicalEvidence',(select count(*) from public.catalogue_spec_evidence),
 'snapshotRuntime',(select count(*) from public.catalogue_public_runtime_products),
 'selectable',(select count(*) from public.catalogue_products where selectable),
 'legacyExists',exists(select 1 from public.catalogue_products where id='step7c-local-legacy-prop'),
 'legacyOfferExists',exists(select 1 from public.catalogue_offers where id='88000000-0000-0000-0000-000000000004'),
 'legacySpecExists',exists(select 1 from public.catalogue_spec_evidence where id='88000000-0000-0000-0000-000000000006'),
 'legacyIdentityExists',exists(select 1 from public.catalogue_identity_evidence where id='88000000-0000-0000-0000-000000000005')
);
