-- Step 9B.4 disposable staging audit and duplicate import replay.
-- Nothing here may be executed against hosted Production.
\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';

do $guard$
declare v text; blocked boolean;
begin
  if (select count(*) from public.catalogue_import_rows)<>8
  or (select count(*) from public.catalogue_products)<>4
  or (select count(*) from public.catalogue_products where record_class='candidate'
       and selectable=false and identity_status='pending_review')<>4
  or (select count(*) from public.catalogue_import_rows where status='imported')<>4
  or (select count(*) from public.catalogue_import_rows where status='needs_review')<>4
  or (select count(distinct normalized_data->>'category') from public.catalogue_import_rows)<>8
  or exists(select 1 from public.catalogue_offers)
  or exists(select 1 from public.catalogue_public_runtime_products)
  or exists(select 1 from public.catalogue_product_images)
  or exists(select 1 from public.catalogue_identity_evidence where verification_status='verified')
  or exists(select 1 from public.catalogue_spec_evidence where verification_status='verified')
  or (select count(*) from public.catalogue_identity_evidence)<>4
  or (select count(*) from public.catalogue_spec_evidence)<10
  then raise exception 'Staging counts, independent research evidence, or publication gates invalid';
  end if;
  if (select count(*) from public.catalogue_import_rows where status='imported'
    and dedupe_status='new' and normalized_data->>'image_url' is null)<>4
  then raise exception 'Missing four image-free candidate rows'; end if;
  -- Important: exact manufacturer SKU is NOT the same as an upstream GTIN.
  if exists(select 1 from public.catalogue_import_rows
    where normalized_data->>'source_name' in ('HQProp official','Team BlackSheep official')
      and nullif(normalized_data->>'manufacturer_sku','') is not null)
  then raise exception 'GTIN used as manufacturer SKU'; end if;

  for v in select id from public.catalogue_products
  loop
    if cardinality(public.catalogue_publication_blockers(v))=0 then
      raise exception 'Candidate % unexpectedly has no publication blockers',v;
    end if;
    blocked:=false;
    begin
      perform public.catalogue_publish_product(v,'disposable automated negative test',
        'MUST FAIL: identity, technical reviews and exact verified EU offers missing');
    exception when others then
      if SQLERRM like 'Publication blocked:%' then blocked:=true;
      else raise;
      end if;
    end;
    if not blocked then raise exception 'UNSAFE: publication succeeded for %',v; end if;
  end loop;
end
$guard$;

-- Fresh replay of the same eight immutable original product identities.
-- Four seeded candidates should match exactly; four held variants must remain new.
with old as (
  select a.adapter_key,b.source_id,b.adapter_id,b.id old_id
  from public.catalogue_import_batches b
  join public.catalogue_source_adapters a on a.id=b.adapter_id
  where b.file_name like 'step9b4-%'
)
insert into public.catalogue_import_batches
(id,source_id,adapter_id,file_name,import_kind,status,total_rows,valid_rows,invalid_rows,notes)
select md5('step9b4-replay:'||adapter_key)::uuid,source_id,adapter_id,
'step9b4-replay-'||adapter_key||'.json','products','staged',0,0,0,
'Local-only identity replay to check exact dedupe without publishing'
from old;

insert into public.catalogue_import_rows
(batch_id,row_number,proposed_product_id,raw_data,normalized_data,status,validation_errors)
select md5('step9b4-replay:'||a.adapter_key)::uuid, r.row_number,
r.proposed_product_id,r.raw_data,r.normalized_data,
case when r.status='imported' then 'validated'::public.catalogue_import_row_status
     else r.status end,
r.validation_errors
from public.catalogue_import_rows r
join public.catalogue_import_batches b on b.id=r.batch_id
join public.catalogue_source_adapters a on a.id=b.adapter_id
where b.file_name like 'step9b4-%'
  and b.file_name not like 'step9b4-replay-%';

select public.catalogue_run_import_dedupe(b.id)
from public.catalogue_import_batches b
where b.file_name like 'step9b4-replay-%';

do $replay$
begin
  if (select count(*) from public.catalogue_import_batches)<>10
  or (select count(*) from public.catalogue_import_rows)<>16
  or (select count(*) from public.catalogue_import_rows r
    join public.catalogue_import_batches b on b.id=r.batch_id
    where b.file_name like 'step9b4-replay-%'
      and r.dedupe_status='exact_match' and r.match_method='product_id'
      and r.matched_product_id=r.proposed_product_id)<>4
  or (select count(*) from public.catalogue_import_rows r
    join public.catalogue_import_batches b on b.id=r.batch_id
    where b.file_name like 'step9b4-replay-%' and r.dedupe_status='new')<>4
  or (select count(*) from public.catalogue_products)<>4
  or (select count(*) from public.catalogue_products where selectable)<>0
  or exists(select 1 from public.catalogue_offers)
  or exists(select 1 from public.catalogue_public_runtime_products)
  then raise exception 'Cross-run dedupe or unpublished security check failed'; end if;
end
$replay$;
commit;

-- Export one machine-readable audit, never stage any retail offer here.
select jsonb_build_object(
  'originalRows', (select count(*) from public.catalogue_import_rows r
    join public.catalogue_import_batches b on b.id=r.batch_id
    where b.file_name like 'step9b4-%' and b.file_name not like 'step9b4-replay-%'),
  'candidateProducts',(select count(*) from public.catalogue_products),
  'unpublishedCandidates',(select count(*) from public.catalogue_products where record_class='candidate' and not selectable),
  'published',(select count(*) from public.catalogue_products where selectable),
  'publicRuntime',(select count(*) from public.catalogue_public_runtime_products),
  'offers',(select count(*) from public.catalogue_offers),
  'pendingIdentityEvidence',(select count(*) from public.catalogue_identity_evidence where verification_status='pending_review'),
  'pendingSpecEvidence',(select count(*) from public.catalogue_spec_evidence where verification_status='pending_review'),
  'exactReplay',(select count(*) from public.catalogue_import_rows r
    join public.catalogue_import_batches b on b.id=r.batch_id
    where b.file_name like 'step9b4-replay-%' and r.dedupe_status='exact_match'),
  'heldRows',(select count(*) from public.catalogue_import_rows r
    join public.catalogue_import_batches b on b.id=r.batch_id
    where b.file_name like 'step9b4-%' and b.file_name not like 'step9b4-replay-%'
      and r.status='needs_review'),
  'categories',(select jsonb_agg(distinct normalized_data->>'category') from public.catalogue_import_rows),
  'blockers',(select jsonb_object_agg(p.id,public.catalogue_publication_blockers(p.id))
    from public.catalogue_products p)
)::text as audit_json;
