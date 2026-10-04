-- One-time production metadata cleanup after the 2026-10-04 read-only audit.
-- Changes ONLY public.catalogue_import_rows: 24 historical imported rows and
-- three ineligible CNHL importer rows. No product, candidate, offer, evidence,
-- adapter, permission, workflow, or source changes. Exact 24+3 cardinality
-- assertions fail closed on a changed production snapshot.
-- Test safely by replacing the final COMMIT with ROLLBACK.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $guard$
declare
  v_exact integer;
  v_ineligible integer;
  v_mismatch integer;
  v_collision integer;
  v_identity_key_conflicts integer;
begin
  select count(*) into v_exact
  from public.catalogue_import_rows r
  join public.catalogue_import_batches b on b.id = r.batch_id
  join public.catalogue_products p on p.id = r.proposed_product_id
  join public.catalogue_manufacturers m on m.id = p.manufacturer_id
  where r.status::text = 'imported'
    and r.dedupe_status = 'unresolved'
    and b.file_name in (
      'pilot-8-real-products-2026-09-28.json',
      'catalogue-expansion-8-real-products-2026-09-28.json',
      'phase2_verified_parts_2026-09-28.json'
    )
    and p.selectable
    and p.record_class::text = 'canonical'
    and p.verification_status::text = 'verified'
    and p.category::text = r.normalized_data->>'category'
    and p.model = r.normalized_data->>'model'
    and coalesce(p.variant,'') = coalesce(r.normalized_data->>'variant','')
    and coalesce(p.manufacturer_sku,'') =
        coalesce(r.normalized_data->>'manufacturer_sku','')
    and regexp_replace(lower(m.name),'[^[:alnum:]]','','g') =
        regexp_replace(lower(r.normalized_data->>'manufacturer'),'[^[:alnum:]]','','g');

  if v_exact <> 24 then
    raise exception 'Expected 24 verified same-ID legacy rows; found %', v_exact;
  end if;
  select count(*) into v_mismatch
  from public.catalogue_import_rows r
  join public.catalogue_import_batches b on b.id=r.batch_id
  where b.file_name in (
    'pilot-8-real-products-2026-09-28.json',
    'catalogue-expansion-8-real-products-2026-09-28.json',
    'phase2_verified_parts_2026-09-28.json'
  )
    and r.status::text='imported'
    and r.dedupe_status='unresolved';
  if v_mismatch <> v_exact then
    raise exception 'Not all original import rows matched their canonical product';
  end if;

  -- Keep motor KV variants distinct; refuse any OTHER matching product.
  select count(*) into v_collision
  from public.catalogue_import_rows r
  join public.catalogue_import_batches b on b.id=r.batch_id
  join public.catalogue_products p on p.id=r.proposed_product_id
  where b.file_name in (
    'pilot-8-real-products-2026-09-28.json',
    'catalogue-expansion-8-real-products-2026-09-28.json',
    'phase2_verified_parts_2026-09-28.json'
  )
    and r.status::text='imported' and r.dedupe_status='unresolved'
    and exists (
      select 1 from public.catalogue_products other
      where other.id <> p.id
        and other.manufacturer_id = p.manufacturer_id
        and other.category = p.category
        and regexp_replace(lower(other.model),'[^[:alnum:]]','','g')
            = regexp_replace(lower(p.model),'[^[:alnum:]]','','g')
        and regexp_replace(lower(coalesce(other.variant,'')),'[^[:alnum:]]','','g')
            = regexp_replace(lower(coalesce(p.variant,'')),'[^[:alnum:]]','','g')
    );
  if v_collision <> 0 then
    raise exception 'Found % conflicting canonical identities', v_collision;
  end if;

  select count(*) into v_identity_key_conflicts
  from (
    select key_kind,key_value
    from public.catalogue_product_identity_keys
    group by key_kind,key_value
    having count(distinct product_id) > 1
  ) collisions;
  if v_identity_key_conflicts <> 0 then
    raise exception 'Existing identity-key conflicts detected';
  end if;

  select count(*) into v_ineligible
  from public.catalogue_import_rows r
  join public.catalogue_import_batches b on b.id=r.batch_id
  where b.file_name='cnhl-shopify-jsonld-2026-09-29T11:35:08.222Z'
    and r.status::text='needs_review' and r.dedupe_status='new'
    and r.normalized_data->>'category'='battery'
    and r.normalized_data->>'source_product_url' in (
      'https://chinahobbyline.com/products/cnhl-850mah-11-1v-3s-30c-lipo-battery-with-t-plug',
      'https://chinahobbyline.com/products/cnhl-2200mah-7-4v-2s-30c-lipo-battery-with-t-plug',
      'https://chinahobbyline.com/products/cnhl-2200mah-11-1v-3s-30c-lipo-battery-with-t-plug'
    )
    and exists (
      select 1 from jsonb_array_elements_text(r.validation_errors) issue
      where issue like 'Product did not match%eligibility rules.'
    )
    and not exists (
      select 1 from public.catalogue_products p where p.id=r.proposed_product_id
    );
  if v_ineligible <> 3 then
    raise exception 'Expected exactly 3 still-ineligible CNHL rows; found %', v_ineligible;
  end if;
end;
$guard$;

do $apply$
declare
  v_reconciled integer;
  v_excluded integer;
begin
  with legacy as (
    select r.id,p.id as canonical_id
    from public.catalogue_import_rows r
    join public.catalogue_import_batches b on b.id=r.batch_id
    join public.catalogue_products p on p.id=r.proposed_product_id
    where r.status::text='imported' and r.dedupe_status='unresolved'
      and b.file_name in (
        'pilot-8-real-products-2026-09-28.json',
        'catalogue-expansion-8-real-products-2026-09-28.json',
        'phase2_verified_parts_2026-09-28.json'
      )
  )
  update public.catalogue_import_rows r
  set dedupe_status='exact_match',
      matched_product_id=legacy.canonical_id,
      match_method='product_id',
      match_confidence=1,
      identity_key='product_id|' || legacy.canonical_id,
      dedupe_details=coalesce(r.dedupe_details,'{}'::jsonb) ||
        jsonb_build_object(
          'exactCandidateCount',1,
          'legacyReconciliation', jsonb_build_object(
            'classification','existing_original_canonical',
            'explanation','Historical import already created this exact canonical product. Metadata was previously unresolved; no new product or identity merge was performed.',
            'auditedAt',transaction_timestamp()
          )
        )
  from legacy
  where r.id=legacy.id;
  get diagnostics v_reconciled = row_count;
  if v_reconciled <> 24 then
    raise exception 'Legacy reconciliation changed % rows, expected 24',v_reconciled;
  end if;

  update public.catalogue_import_rows r
  set status='rejected'::public.catalogue_import_row_status,
      reviewed_at=transaction_timestamp(),
      validation_errors=r.validation_errors ||
        jsonb_build_array('2026-10-04 catalogue cleanup: insufficient confirmed FPV/drone eligibility; preserve source for reconsideration if new evidence appears.'),
      dedupe_details=coalesce(r.dedupe_details,'{}'::jsonb) ||
        jsonb_build_object(
          'eligibilityReview',jsonb_build_object(
            'decision','excluded_from_drone_fpv_import',
            'basis','Existing adapter ineligibility plus official manufacturer product page; no verified drone-specific use or reviewed EU offer.',
            'note',case
              when r.normalized_data->>'battery_capacity_mah'='850'
                then 'Official product page confirms JST connector; its historical URL slug mentions T-Plug. No automatic connector correction was made.'
              else 'Official page markets this product principally for ground/water RC vehicles; no verified FPV-specific suitability.'
            end,
            'reviewedAt',transaction_timestamp(),
            'reversible',true
          )
        )
  where r.id in (
    select x.id from public.catalogue_import_rows x
    join public.catalogue_import_batches b on b.id=x.batch_id
    where b.file_name='cnhl-shopify-jsonld-2026-09-29T11:35:08.222Z'
      and x.status::text='needs_review' and x.dedupe_status='new'
      and x.normalized_data->>'category'='battery'
      and x.normalized_data->>'source_product_url' in (
        'https://chinahobbyline.com/products/cnhl-850mah-11-1v-3s-30c-lipo-battery-with-t-plug',
        'https://chinahobbyline.com/products/cnhl-2200mah-7-4v-2s-30c-lipo-battery-with-t-plug',
        'https://chinahobbyline.com/products/cnhl-2200mah-11-1v-3s-30c-lipo-battery-with-t-plug'
      )
  );
  get diagnostics v_excluded = row_count;
  if v_excluded <> 3 then
    raise exception 'Eligibility cleanup changed % rows, expected 3',v_excluded;
  end if;
end;
$apply$;

-- Visible transaction output, used in the rollback test and after commit.
select status::text as status,dedupe_status,count(*) as rows
from public.catalogue_import_rows
group by status,dedupe_status
order by status,dedupe_status;
commit;
