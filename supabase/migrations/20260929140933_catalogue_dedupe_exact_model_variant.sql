-- Align scalable catalogue dedupe with the evidence-first identity rules.
-- Exact Manufacturer + Model + Variant + Category is an exact match.
-- Same model family with a different/unknown variant is review-only probable_match.

create or replace function public.catalogue_run_import_dedupe(p_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  r record;
  v_source_id uuid;
  v_category text;
  v_manufacturer text;
  v_sku text;
  v_mpn text;
  v_model text;
  v_variant text;
  v_external text;
  v_identity_key text;
  v_model_prefix text;
  v_exact_count integer;
  v_probable_count integer;
  v_product_id text;
  v_method text;
  v_confidence numeric;
  v_status text;
  v_probable_ids jsonb;
  v_new integer := 0;
  v_exact integer := 0;
  v_probable integer := 0;
  v_conflict integer := 0;
begin
  select source_id into v_source_id
  from public.catalogue_import_batches
  where id = p_batch_id and import_kind = 'products';

  if not found then
    raise exception 'Product import batch does not exist.';
  end if;

  for r in
    select id, proposed_product_id, normalized_data, status
    from public.catalogue_import_rows
    where batch_id = p_batch_id
      and normalized_data is not null
      and status in ('validated','needs_review','staged')
    order by row_number, id
  loop
    v_category := r.normalized_data->>'category';
    v_manufacturer := catalogue_internal.normalize_identity_text(
      r.normalized_data->>'manufacturer'
    );
    v_sku := catalogue_internal.normalize_identity_text(
      r.normalized_data->>'manufacturer_sku'
    );
    v_mpn := catalogue_internal.normalize_identity_text(
      r.normalized_data->>'mpn'
    );
    v_model := catalogue_internal.normalize_identity_text(
      coalesce(
        nullif(r.normalized_data->>'model',''),
        r.normalized_data->>'display_name'
      )
    );
    v_variant := coalesce(
      catalogue_internal.normalize_identity_text(
        r.normalized_data->>'variant'
      ),
      ''
    );
    v_external := catalogue_internal.normalize_identity_text(
      r.normalized_data->>'source_external_product_id'
    );

    v_identity_key := null;
    v_model_prefix := case
      when v_category is not null
       and v_manufacturer is not null
       and v_model is not null
      then v_category || '|' || v_manufacturer || '|' || v_model || '|'
      else null
    end;

    with candidates as (
      select
        p.id product_id,
        0 priority,
        'product_id'::text method,
        1::numeric confidence,
        'product_id|' || p.id as identity_key
      from public.catalogue_products p
      where p.id = r.proposed_product_id

      union all

      select
        k.product_id,
        1,
        'source_external_id',
        1::numeric,
        v_source_id::text || '|' || v_external
      from public.catalogue_product_identity_keys k
      where v_source_id is not null
        and v_external is not null
        and k.key_kind = 'source_external_id'
        and k.key_value = v_source_id::text || '|' || v_external

      union all

      select
        k.product_id,
        2,
        'manufacturer_sku',
        1::numeric,
        v_category || '|' || v_manufacturer || '|' || v_sku
      from public.catalogue_product_identity_keys k
      where v_manufacturer is not null
        and v_sku is not null
        and k.key_kind = 'manufacturer_sku'
        and k.key_value =
          v_category || '|' || v_manufacturer || '|' || v_sku

      union all

      select
        k.product_id,
        3,
        'mpn',
        1::numeric,
        v_category || '|' || v_manufacturer || '|' || v_mpn
      from public.catalogue_product_identity_keys k
      where v_manufacturer is not null
        and v_mpn is not null
        and k.key_kind = 'mpn'
        and k.key_value =
          v_category || '|' || v_manufacturer || '|' || v_mpn

      union all

      select
        k.product_id,
        4,
        'model_variant',
        1::numeric,
        v_category || '|' || v_manufacturer || '|' || v_model || '|' ||
          v_variant
      from public.catalogue_product_identity_keys k
      where v_manufacturer is not null
        and v_model is not null
        and k.key_kind = 'model_variant'
        and k.key_value =
          v_category || '|' || v_manufacturer || '|' || v_model || '|' ||
          v_variant
    ),
    distinct_candidates as (
      select product_id, min(priority) priority
      from candidates
      group by product_id
    ),
    chosen as (
      select
        c.product_id,
        c.method,
        c.confidence,
        c.priority,
        c.identity_key
      from candidates c
      join distinct_candidates d
        on d.product_id = c.product_id
       and d.priority = c.priority
      order by c.priority, c.product_id
    )
    select
      (select count(*) from distinct_candidates),
      (select product_id from chosen limit 1),
      (select method from chosen limit 1),
      (select confidence from chosen limit 1),
      (select identity_key from chosen limit 1)
    into
      v_exact_count,
      v_product_id,
      v_method,
      v_confidence,
      v_identity_key;

    v_probable_count := 0;
    v_probable_ids := '[]'::jsonb;

    if v_exact_count > 1 then
      v_status := 'conflict';
      v_product_id := null;
      v_method := 'multiple_identity_matches';
      v_confidence := null;
      v_conflict := v_conflict + 1;
    elsif v_exact_count = 1 then
      v_status := 'exact_match';
      v_exact := v_exact + 1;
    else
      if v_model_prefix is not null then
        select
          count(*),
          case when count(*) = 1 then min(product_id) else null end,
          coalesce(
            jsonb_agg(product_id order by product_id),
            '[]'::jsonb
          )
        into
          v_probable_count,
          v_product_id,
          v_probable_ids
        from (
          select distinct k.product_id
          from public.catalogue_product_identity_keys k
          where k.key_kind = 'model_variant'
            and left(k.key_value, length(v_model_prefix)) = v_model_prefix
        ) probable;
      end if;

      if v_probable_count > 0 then
        v_status := 'probable_match';
        v_method := case
          when v_probable_count = 1 then 'model_family'
          else 'model_family_multiple'
        end;
        v_confidence := case
          when v_probable_count = 1 then 0.80::numeric
          else 0.70::numeric
        end;
        v_identity_key := v_model_prefix;
        v_probable := v_probable + 1;
      else
        v_status := 'new';
        v_product_id := null;
        v_method := null;
        v_confidence := null;
        v_identity_key := case
          when v_manufacturer is not null and v_sku is not null
            then v_category || '|' || v_manufacturer || '|' || v_sku
          when v_manufacturer is not null and v_mpn is not null
            then v_category || '|' || v_manufacturer || '|' || v_mpn
          when v_manufacturer is not null and v_model is not null
            then v_category || '|' || v_manufacturer || '|' || v_model || '|' ||
              v_variant
          else null
        end;
        v_new := v_new + 1;
      end if;
    end if;

    update public.catalogue_import_rows
    set
      dedupe_status = v_status,
      matched_product_id = v_product_id,
      match_method = v_method,
      match_confidence = v_confidence,
      identity_key = v_identity_key,
      dedupe_details = jsonb_build_object(
        'manufacturerNormalized', v_manufacturer,
        'modelNormalized', v_model,
        'variantNormalized', v_variant,
        'manufacturerSkuNormalized', v_sku,
        'mpnNormalized', v_mpn,
        'sourceExternalIdNormalized', v_external,
        'exactCandidateCount', v_exact_count,
        'probableCandidateCount', v_probable_count,
        'probableCandidateIds', v_probable_ids
      ),
      status = case
        when v_status in ('probable_match','conflict')
          then 'needs_review'::public.catalogue_import_row_status
        when status = 'staged'
          then 'validated'::public.catalogue_import_row_status
        else status
      end
    where id = r.id;
  end loop;

  update public.catalogue_import_batches
  set
    dedupe_completed_at = now(),
    status = case
      when v_conflict > 0 or v_probable > 0
        then 'needs_review'::public.catalogue_import_batch_status
      else 'validated'::public.catalogue_import_batch_status
    end
  where id = p_batch_id;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'newRows', v_new,
    'exactMatches', v_exact,
    'probableMatches', v_probable,
    'conflicts', v_conflict
  );
end;
$fn$;

revoke all on function public.catalogue_run_import_dedupe(uuid)
  from public, anon, authenticated;
grant execute on function public.catalogue_run_import_dedupe(uuid)
  to service_role;
