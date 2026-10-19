-- Isolated Supabase Step-8 postconditions. Never run on Production.
\set ON_ERROR_STOP on
do $audit$
declare
 n integer;
begin
 select count(*) into n from public.catalogue_import_rows;
 if n<>37 then raise exception 'Expected 37 source research rows; got %', n; end if;
 if exists(select 1 from public.catalogue_import_rows where status<>'needs_review')
 then raise exception 'UNSAFE: some research import rows auto-validated'; end if;
 if (select count(distinct proposed_product_id) from public.catalogue_import_rows)<>37
 then raise exception 'Duplicate QA IDs; would collide'; end if;
 if (select count(distinct normalized_data->>'category') from public.catalogue_import_rows)<>8
 then raise exception 'Research categories lost'; end if;
 if exists(select 1 from public.catalogue_import_rows
   where validation_errors is null
     or jsonb_array_length(validation_errors)<1
     or raw_data->>'research_only'<>'true'
     or raw_data->>'seller_offer_approved'<>'false'
     or raw_data->>'manufacturer_photo_licensed'<>'false'
     or coalesce(normalized_data->>'image_url','')<>'')
 then raise exception 'QA rows must be blocked, unlicensed and unverified'; end if;
 if exists(select 1 from public.catalogue_import_rows
  where (normalized_data->>'source_url') !~ '^https://www[.](hqprop|foxeer|speedybee|team-blacksheep)[.]com/')
 then raise exception 'Non-official source URL in staged review'; end if;

 if exists(select 1 from public.catalogue_products)
    or exists(select 1 from public.catalogue_offers)
    or exists(select 1 from public.catalogue_product_images)
    or exists(select 1 from public.catalogue_release_reviews)
    or exists(select 1 from public.catalogue_public_runtime_products)
 then raise exception 'UNSAFE: research rows leaked into products, offers or public runtime'; end if;
end
$audit$;
select jsonb_build_object(
 'researchImportRows',(select count(*) from public.catalogue_import_rows),
 'pendingReviewRows',(select count(*) from public.catalogue_import_rows where status='needs_review'),
 'distinctCategories',(select count(distinct normalized_data->>'category') from public.catalogue_import_rows),
 'candidateProducts',(select count(*) from public.catalogue_products),
 'offers',(select count(*) from public.catalogue_offers),
 'images',(select count(*) from public.catalogue_product_images),
 'ownerApprovals',(select count(*) from public.catalogue_release_reviews),
 'publicRuntime',(select count(*) from public.catalogue_public_runtime_products),
 'state','PASS_NO_PUBLICATION'
)::text as step8_review_only_audit;