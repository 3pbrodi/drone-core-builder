-- Scalable source-adapter ingestion and canonical-product deduplication.
-- Import rows are classified before candidate creation. Only dedupe_status=new
-- may enter the existing Candidate -> Evidence -> Review -> Published workflow.

create table if not exists public.catalogue_source_adapters (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.catalogue_sources(id) on delete cascade,
  adapter_key text not null unique,
  adapter_type text not null
    check (adapter_type in ('csv','json','api','shopify','manufacturer','retailer')),
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  max_batch_size integer not null default 500 check (max_batch_size between 1 and 5000),
  config jsonb not null default '{}'::jsonb,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalogue_source_adapters enable row level security;
revoke all on public.catalogue_source_adapters from public, anon, authenticated;

alter table public.catalogue_import_batches
  add column if not exists adapter_id uuid
    references public.catalogue_source_adapters(id) on delete set null,
  add column if not exists source_run_id text,
  add column if not exists source_cursor text,
  add column if not exists dedupe_completed_at timestamptz;

alter table public.catalogue_import_rows
  add column if not exists dedupe_status text not null default 'unresolved',
  add column if not exists matched_product_id text
    references public.catalogue_products(id) on delete set null,
  add column if not exists match_method text,
  add column if not exists match_confidence numeric,
  add column if not exists identity_key text,
  add column if not exists dedupe_details jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='catalogue_import_rows_dedupe_status_check'
  ) then
    alter table public.catalogue_import_rows
      add constraint catalogue_import_rows_dedupe_status_check
      check (dedupe_status in (
        'unresolved','new','exact_match','probable_match','conflict'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='catalogue_import_rows_match_confidence_check'
  ) then
    alter table public.catalogue_import_rows
      add constraint catalogue_import_rows_match_confidence_check
      check (
        match_confidence is null
        or (match_confidence >= 0 and match_confidence <= 1)
      );
  end if;
end
$$;

create index if not exists catalogue_import_rows_batch_dedupe_idx
  on public.catalogue_import_rows(batch_id,dedupe_status);
create index if not exists catalogue_import_rows_matched_product_idx
  on public.catalogue_import_rows(matched_product_id);
create index if not exists catalogue_source_adapters_source_idx
  on public.catalogue_source_adapters(source_id);
create index if not exists catalogue_import_batches_adapter_idx
  on public.catalogue_import_batches(adapter_id);
create unique index if not exists catalogue_import_batches_adapter_run_uidx
  on public.catalogue_import_batches(adapter_id,source_run_id)
  where adapter_id is not null and source_run_id is not null;

create table if not exists public.catalogue_product_identity_keys (
  id bigint generated always as identity primary key,
  product_id text not null
    references public.catalogue_products(id) on delete cascade,
  key_kind text not null
    check (key_kind in (
      'source_external_id','manufacturer_sku','mpn','model_variant'
    )),
  key_value text not null,
  confidence numeric not null default 1
    check (confidence > 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalogue_product_identity_keys enable row level security;
revoke all on public.catalogue_product_identity_keys
  from public, anon, authenticated;

alter table public.catalogue_product_identity_keys
  drop constraint if exists
  catalogue_product_identity_keys_key_kind_key_value_key;

create unique index if not exists
  catalogue_product_identity_keys_product_kind_value_uidx
  on public.catalogue_product_identity_keys(product_id,key_kind,key_value);
create index if not exists catalogue_product_identity_keys_lookup_idx
  on public.catalogue_product_identity_keys(key_kind,key_value);
create index if not exists catalogue_product_identity_keys_product_idx
  on public.catalogue_product_identity_keys(product_id);

create or replace function catalogue_internal.normalize_identity_text(p_value text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select nullif(
    regexp_replace(lower(trim(coalesce(p_value,''))), '[^a-z0-9]+', '', 'g'),
    ''
  );
$$;

revoke all on function catalogue_internal.normalize_identity_text(text)
  from public, anon, authenticated;
grant execute on function catalogue_internal.normalize_identity_text(text)
  to service_role;

create or replace function catalogue_internal.refresh_product_identity_keys(
  p_product_id text
)
returns void
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare
  v_product record;
  v_manufacturer_norm text;
  v_category text;
  v_sku text;
  v_mpn text;
  v_model text;
  v_variant text;
begin
  delete from public.catalogue_product_identity_keys
  where product_id=p_product_id
    and key_kind in ('manufacturer_sku','mpn','model_variant');

  select p.*,m.name as manufacturer_name
  into v_product
  from public.catalogue_products p
  left join public.catalogue_manufacturers m on m.id=p.manufacturer_id
  where p.id=p_product_id;

  if not found then return; end if;

  v_manufacturer_norm :=
    catalogue_internal.normalize_identity_text(v_product.manufacturer_name);
  v_category := v_product.category::text;
  v_sku :=
    catalogue_internal.normalize_identity_text(v_product.manufacturer_sku);
  v_mpn := catalogue_internal.normalize_identity_text(v_product.mpn);
  v_model := catalogue_internal.normalize_identity_text(v_product.model);
  v_variant := coalesce(
    catalogue_internal.normalize_identity_text(v_product.variant),''
  );

  if v_manufacturer_norm is not null and v_sku is not null then
    insert into public.catalogue_product_identity_keys(
      product_id,key_kind,key_value,confidence
    ) values (
      p_product_id,'manufacturer_sku',
      v_category||'|'||v_manufacturer_norm||'|'||v_sku,1
    )
    on conflict (product_id,key_kind,key_value) do update
      set confidence=excluded.confidence,updated_at=now();
  end if;

  if v_manufacturer_norm is not null and v_mpn is not null then
    insert into public.catalogue_product_identity_keys(
      product_id,key_kind,key_value,confidence
    ) values (
      p_product_id,'mpn',
      v_category||'|'||v_manufacturer_norm||'|'||v_mpn,1
    )
    on conflict (product_id,key_kind,key_value) do update
      set confidence=excluded.confidence,updated_at=now();
  end if;

  if v_manufacturer_norm is not null and v_model is not null then
    insert into public.catalogue_product_identity_keys(
      product_id,key_kind,key_value,confidence
    ) values (
      p_product_id,'model_variant',
      v_category||'|'||v_manufacturer_norm||'|'||v_model||'|'||v_variant,
      0.92
    )
    on conflict (product_id,key_kind,key_value) do update
      set confidence=excluded.confidence,updated_at=now();
  end if;
end;
$$;

revoke all on function
  catalogue_internal.refresh_product_identity_keys(text)
  from public, anon, authenticated;

create or replace function
  catalogue_internal.refresh_product_identity_keys_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
begin
  perform catalogue_internal.refresh_product_identity_keys(
    coalesce(new.id,old.id)
  );
  return null;
end;
$$;

revoke all on function
  catalogue_internal.refresh_product_identity_keys_trigger()
  from public, anon, authenticated;

drop trigger if exists catalogue_products_identity_keys_sync
  on public.catalogue_products;
create trigger catalogue_products_identity_keys_sync
after insert or update of
  manufacturer_id,model,variant,mpn,manufacturer_sku,category
on public.catalogue_products
for each row execute function
  catalogue_internal.refresh_product_identity_keys_trigger();

create or replace function
  catalogue_internal.refresh_manufacturer_identity_keys_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_id text;
begin
  if old.name is distinct from new.name then
    for v_id in
      select p.id
      from public.catalogue_products p
      where p.manufacturer_id=new.id
    loop
      perform catalogue_internal.refresh_product_identity_keys(v_id);
    end loop;
  end if;
  return null;
end;
$$;

revoke all on function
  catalogue_internal.refresh_manufacturer_identity_keys_trigger()
  from public, anon, authenticated;

drop trigger if exists catalogue_manufacturers_identity_keys_sync
  on public.catalogue_manufacturers;
create trigger catalogue_manufacturers_identity_keys_sync
after update of name on public.catalogue_manufacturers
for each row execute function
  catalogue_internal.refresh_manufacturer_identity_keys_trigger();

create or replace function
  catalogue_internal.refresh_product_source_identity_key_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare v_key text;
begin
  if tg_op='DELETE' then
    delete from public.catalogue_product_identity_keys
    where product_id=old.product_id
      and key_kind='source_external_id'
      and key_value=old.source_id::text||'|'||
        catalogue_internal.normalize_identity_text(old.external_product_id);
    return null;
  end if;

  if tg_op='UPDATE' then
    delete from public.catalogue_product_identity_keys
    where product_id=old.product_id
      and key_kind='source_external_id'
      and key_value=old.source_id::text||'|'||
        catalogue_internal.normalize_identity_text(old.external_product_id);
  end if;

  v_key:=new.source_id::text||'|'||
    catalogue_internal.normalize_identity_text(new.external_product_id);

  if catalogue_internal.normalize_identity_text(
    new.external_product_id
  ) is not null then
    insert into public.catalogue_product_identity_keys(
      product_id,key_kind,key_value,confidence
    ) values (
      new.product_id,'source_external_id',v_key,1
    )
    on conflict (product_id,key_kind,key_value) do update
      set confidence=excluded.confidence,updated_at=now();
  end if;
  return null;
end;
$$;

revoke all on function
  catalogue_internal.refresh_product_source_identity_key_trigger()
  from public, anon, authenticated;

drop trigger if exists catalogue_product_sources_identity_key_sync
  on public.catalogue_product_sources;
create trigger catalogue_product_sources_identity_key_sync
after insert or update of product_id,source_id,external_product_id or delete
on public.catalogue_product_sources
for each row execute function
  catalogue_internal.refresh_product_source_identity_key_trigger();

do $$
declare v_id text;
begin
  for v_id in select id from public.catalogue_products loop
    perform catalogue_internal.refresh_product_identity_keys(v_id);
  end loop;
end
$$;

insert into public.catalogue_product_identity_keys(
  product_id,key_kind,key_value,confidence
)
select
  ps.product_id,
  'source_external_id',
  ps.source_id::text||'|'||
    catalogue_internal.normalize_identity_text(ps.external_product_id),
  1
from public.catalogue_product_sources ps
where catalogue_internal.normalize_identity_text(
  ps.external_product_id
) is not null
on conflict (product_id,key_kind,key_value) do nothing;

create or replace function public.catalogue_run_import_dedupe(
  p_batch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,catalogue_internal,pg_catalog
as $$
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
  v_match_count integer;
  v_product_id text;
  v_method text;
  v_confidence numeric;
  v_status text;
  v_new integer:=0;
  v_exact integer:=0;
  v_probable integer:=0;
  v_conflict integer:=0;
begin
  select source_id into v_source_id
  from public.catalogue_import_batches
  where id=p_batch_id and import_kind='products';

  if not found then
    raise exception 'Product import batch does not exist.';
  end if;

  for r in
    select id,proposed_product_id,normalized_data,status
    from public.catalogue_import_rows
    where batch_id=p_batch_id
      and normalized_data is not null
      and status in ('validated','needs_review','staged')
    order by row_number,id
  loop
    v_category:=r.normalized_data->>'category';
    v_manufacturer:=catalogue_internal.normalize_identity_text(
      r.normalized_data->>'manufacturer'
    );
    v_sku:=catalogue_internal.normalize_identity_text(
      r.normalized_data->>'manufacturer_sku'
    );
    v_mpn:=catalogue_internal.normalize_identity_text(
      r.normalized_data->>'mpn'
    );
    v_model:=catalogue_internal.normalize_identity_text(
      coalesce(
        nullif(r.normalized_data->>'model',''),
        r.normalized_data->>'display_name'
      )
    );
    v_variant:=coalesce(
      catalogue_internal.normalize_identity_text(
        r.normalized_data->>'variant'
      ),''
    );
    v_external:=catalogue_internal.normalize_identity_text(
      r.normalized_data->>'source_external_product_id'
    );

    v_identity_key:=case
      when v_manufacturer is not null and v_sku is not null
        then v_category||'|'||v_manufacturer||'|'||v_sku
      when v_manufacturer is not null and v_mpn is not null
        then v_category||'|'||v_manufacturer||'|'||v_mpn
      when v_manufacturer is not null and v_model is not null
        then v_category||'|'||v_manufacturer||'|'||v_model||'|'||v_variant
      else null
    end;

    with candidates as (
      select
        p.id product_id,0 priority,'product_id'::text method,
        1::numeric confidence
      from public.catalogue_products p
      where p.id=r.proposed_product_id

      union all
      select k.product_id,1,'source_external_id',1::numeric
      from public.catalogue_product_identity_keys k
      where v_source_id is not null
        and v_external is not null
        and k.key_kind='source_external_id'
        and k.key_value=v_source_id::text||'|'||v_external

      union all
      select k.product_id,2,'manufacturer_sku',1::numeric
      from public.catalogue_product_identity_keys k
      where v_manufacturer is not null
        and v_sku is not null
        and k.key_kind='manufacturer_sku'
        and k.key_value=
          v_category||'|'||v_manufacturer||'|'||v_sku

      union all
      select k.product_id,3,'mpn',1::numeric
      from public.catalogue_product_identity_keys k
      where v_manufacturer is not null
        and v_mpn is not null
        and k.key_kind='mpn'
        and k.key_value=
          v_category||'|'||v_manufacturer||'|'||v_mpn

      union all
      select k.product_id,4,'model_variant',0.92::numeric
      from public.catalogue_product_identity_keys k
      where v_manufacturer is not null
        and v_model is not null
        and k.key_kind='model_variant'
        and k.key_value=
          v_category||'|'||v_manufacturer||'|'||v_model||'|'||v_variant
    ),
    distinct_candidates as (
      select product_id,min(priority) priority
      from candidates
      group by product_id
    ),
    chosen as (
      select c.product_id,c.method,c.confidence,c.priority
      from candidates c
      join distinct_candidates d
        on d.product_id=c.product_id
       and d.priority=c.priority
      order by c.priority
    )
    select
      (select count(*) from distinct_candidates),
      (select product_id from chosen limit 1),
      (select method from chosen limit 1),
      (select confidence from chosen limit 1)
    into
      v_match_count,v_product_id,v_method,v_confidence;

    if v_match_count=0 then
      v_status:='new';
      v_product_id:=null;
      v_method:=null;
      v_confidence:=null;
      v_new:=v_new+1;
    elsif v_match_count>1 then
      v_status:='conflict';
      v_product_id:=null;
      v_method:='multiple_identity_matches';
      v_confidence:=null;
      v_conflict:=v_conflict+1;
    elsif v_method='model_variant' then
      v_status:='probable_match';
      v_probable:=v_probable+1;
    else
      v_status:='exact_match';
      v_exact:=v_exact+1;
    end if;

    update public.catalogue_import_rows
    set
      dedupe_status=v_status,
      matched_product_id=v_product_id,
      match_method=v_method,
      match_confidence=v_confidence,
      identity_key=v_identity_key,
      dedupe_details=jsonb_build_object(
        'manufacturerNormalized',v_manufacturer,
        'modelNormalized',v_model,
        'variantNormalized',v_variant,
        'manufacturerSkuNormalized',v_sku,
        'mpnNormalized',v_mpn,
        'sourceExternalIdNormalized',v_external,
        'candidateCount',v_match_count
      ),
      status=case
        when v_status in ('probable_match','conflict')
          then 'needs_review'::public.catalogue_import_row_status
        when status='staged'
          then 'validated'::public.catalogue_import_row_status
        else status
      end
    where id=r.id;
  end loop;

  update public.catalogue_import_batches
  set
    dedupe_completed_at=now(),
    status=case
      when v_conflict>0 or v_probable>0
        then 'needs_review'::public.catalogue_import_batch_status
      else 'validated'::public.catalogue_import_batch_status
    end
  where id=p_batch_id;

  return jsonb_build_object(
    'batchId',p_batch_id,
    'newRows',v_new,
    'exactMatches',v_exact,
    'probableMatches',v_probable,
    'conflicts',v_conflict
  );
end;
$$;

revoke all on function public.catalogue_run_import_dedupe(uuid)
  from public, anon, authenticated;
grant execute on function public.catalogue_run_import_dedupe(uuid)
  to service_role;

create or replace function public.catalogue_link_exact_import_matches(
  p_batch_id uuid,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=public,catalogue_internal,pg_catalog
as $$
declare
  r record;
  v_source_id uuid;
  v_external text;
  v_linked integer:=0;
begin
  if p_reviewer is null or length(trim(p_reviewer))=0 then
    raise exception 'Reviewer is required.';
  end if;

  select source_id into v_source_id
  from public.catalogue_import_batches
  where id=p_batch_id and import_kind='products';

  if not found then
    raise exception 'Product import batch does not exist.';
  end if;

  for r in
    select id,matched_product_id,normalized_data,match_method
    from public.catalogue_import_rows
    where batch_id=p_batch_id
      and dedupe_status='exact_match'
      and matched_product_id is not null
      and status in ('validated','needs_review')
  loop
    v_external:=nullif(
      trim(r.normalized_data->>'source_external_product_id'),''
    );

    if v_source_id is not null and v_external is not null then
      insert into public.catalogue_product_sources(
        product_id,source_id,external_product_id,source_url,
        verification_status,exact_model_association,retrieved_at,metadata
      ) values (
        r.matched_product_id,
        v_source_id,
        v_external,
        nullif(trim(r.normalized_data->>'source_url'),''),
        'pending_review',
        true,
        now(),
        jsonb_build_object(
          'importRowId',r.id,
          'dedupeMethod',r.match_method
        )
      )
      on conflict do nothing;
    end if;

    update public.catalogue_import_rows
    set status='imported',reviewed_at=now()
    where id=r.id;

    insert into public.catalogue_promotion_events(
      product_id,action,reviewer,notes,blockers_snapshot
    ) values (
      r.matched_product_id,
      'exact_import_match_linked',
      trim(p_reviewer),
      p_notes,
      '[]'::jsonb
    );

    v_linked:=v_linked+1;
  end loop;

  return jsonb_build_object(
    'batchId',p_batch_id,
    'linkedRows',v_linked
  );
end;
$$;

revoke all on function
  public.catalogue_link_exact_import_matches(uuid,text,text)
  from public, anon, authenticated;
grant execute on function
  public.catalogue_link_exact_import_matches(uuid,text,text)
  to service_role;

create or replace function
  public.catalogue_create_candidate_from_deduped_import(
    p_import_row_id bigint,
    p_reviewer text,
    p_notes text default null
  )
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_catalog
as $$
declare v_status text;
begin
  select dedupe_status into v_status
  from public.catalogue_import_rows
  where id=p_import_row_id;

  if not found then
    raise exception 'Import row does not exist.';
  end if;

  if v_status <> 'new' then
    raise exception
      'Candidate creation requires dedupe_status=new; current status is %.',
      v_status;
  end if;

  return public.catalogue_create_candidate_from_import(
    p_import_row_id,p_reviewer,p_notes
  );
end;
$$;

revoke all on function
  public.catalogue_create_candidate_from_deduped_import(bigint,text,text)
  from public, anon, authenticated;
grant execute on function
  public.catalogue_create_candidate_from_deduped_import(bigint,text,text)
  to service_role;
