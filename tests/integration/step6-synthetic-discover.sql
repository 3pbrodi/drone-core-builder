\set ON_ERROR_STOP on
set role service_role;
with families as (
  select n,
    case when n<=10 then 1 when n<=35 then 2 when n<=85 then 3
         else 4+((n-86)/50) end as family
  from generate_series(:first,:last) n
), synthetic as (
  select n,family,
    case (family-1)%4 when 0 then 'propellers'
      when 1 then 'motors' when 2 then 'frame' else 'battery' end as category
  from families
), records as (
  select n,jsonb_build_object(
   'upstreamItemId','synthetic:variant:'||n,
   'upstreamParentProductId','synthetic:product:'||family,
   'upstreamVariantId','synthetic:vid:'||n,
   'sourceUrl','https://synthetic.invalid/products/family-'||family||'?variant='||n,
   'itemKind','variant','discoveryStatus','ready',
   'rawPayload',jsonb_build_object('synthetic',true,'family',family),
   'errors','[]'::jsonb,
   'normalizedData',jsonb_build_object(
      'id','synthetic-product-'||lpad(n::text,7,'0'),
      'category',category,'manufacturer','TEST/SYNTHETIC Load Lab',
      'model','Synthetic Test Model '||family,
      'variant','V'||lpad(n::text,7,'0'),
      'display_name','TEST/SYNTHETIC '||category||' '||n,
      'manufacturer_sku',case when n%11=0 then null else 'SYN-SKU-'||n end,
      'mpn',case when n%7=0 then null else 'SYN-MPN-'||n end,
      'propeller_diameter_inches',6,
      'motor_size_code','2207',
      'frame_size_inches',5,
      'battery_capacity_mah',1500,
      'source_url','https://synthetic.invalid/products/family-'||family||'?variant='||n,
      'source_product_url','https://synthetic.invalid/products/family-'||family||'?variant='||n,
      'source_external_product_id','synthetic:variant:'||n,
      'source_external_parent_product_id','synthetic:product:'||family,
      'source_external_variant_id','synthetic:vid:'||n,
      'source_name','TEST/SYNTHETIC Load Lab',
      'spec_summary','LOCAL SYNTHETIC DATA ONLY; not manufacturer evidence',
      'image_url','https://synthetic.invalid/images/'||n||'.jpg',
      'image_exact_model_verified',false
   )
  ) item
  from synthetic
)
select public.catalogue_upsert_import_manifest_items(
 :'run_id'::uuid,coalesce(jsonb_agg(item order by case when :pass=2 then -n else n end),'[]'::jsonb),
 :pass,case when :complete=1 then null else :'last_cursor' end,
 jsonb_build_object('pass',:pass,'synthetic',true,'expected',:total),
 (:complete=1)::boolean
) from records;
