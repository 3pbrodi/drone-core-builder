-- P0 import reliability: category-consistent identity, durable manifests, resumable chunks,
-- and transactional processing of dedupe/link/candidate/evidence phases.
-- Generated with `supabase migration new p0_import_reliability`.
-- This migration is version-controlled only by this task; it is NOT applied to production here.

-- Canonical product uniqueness must use the same category-aware identity tuple as dedupe.
do $$
begin
  if exists (
    select 1
    from public.catalogue_products p
    where p.manufacturer_id is not null
    group by
      p.manufacturer_id,
      p.category,
      lower(trim(p.model)),
      lower(trim(coalesce(p.variant,''))),
      lower(trim(coalesce(p.manufacturer_sku,''))),
      lower(trim(coalesce(p.mpn,'')))
    having count(*) > 1
  ) then
    raise exception 'Cannot install category-aware canonical identity uniqueness: duplicate canonical identity tuples exist.';
  end if;
end
$$;

drop index if exists public.catalogue_products_manufacturer_model_variant_unique;
drop index if exists public.catalogue_products_manufacturer_category_model_variant_unique;
create unique index if not exists catalogue_products_manufacturer_category_identity_unique
  on public.catalogue_products(
    manufacturer_id,
    category,
    lower(trim(model)),
    lower(trim(coalesce(variant,''))),
    lower(trim(coalesce(manufacturer_sku,''))),
    lower(trim(coalesce(mpn,'')))
  )
  where manufacturer_id is not null;

-- The existing exact-link RPC emits this event. Keeping the enum aligned prevents
-- a source-link failure from being hidden behind importer error handling.
alter type public.catalogue_promotion_action
  add value if not exists 'exact_import_match_linked';

create table if not exists public.catalogue_import_runs (
  id uuid primary key default gen_random_uuid(),
  adapter_id uuid not null references public.catalogue_source_adapters(id) on delete restrict,
  source_id uuid not null references public.catalogue_sources(id) on delete restrict,
  logical_run_id text not null check (length(trim(logical_run_id)) between 1 and 200),
  status text not null default 'discovering'
    check (status in (
      'discovering','processing','resumable','completed','completed_with_errors','failed'
    )),
  manifest_version integer not null default 1 check (manifest_version > 0),
  manifest_hash text,
  manifest_complete boolean not null default false,
  next_cursor text,
  discovery_state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(discovery_state)='object'),
  has_more boolean not null default true,
  discovered_count integer not null default 0 check (discovered_count >= 0),
  staged_count integer not null default 0 check (staged_count >= 0),
  excluded_count integer not null default 0 check (excluded_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  last_error text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(adapter_id,logical_run_id)
);

alter table public.catalogue_import_runs enable row level security;
revoke all on public.catalogue_import_runs from public,anon,authenticated;
grant select,insert,update,delete on public.catalogue_import_runs to service_role;

alter table public.catalogue_import_batches
  add column if not exists import_run_id uuid
    references public.catalogue_import_runs(id) on delete set null,
  add column if not exists chunk_key text;

create unique index if not exists catalogue_import_batches_run_chunk_uidx
  on public.catalogue_import_batches(import_run_id,chunk_key)
  where import_run_id is not null and chunk_key is not null;

create table if not exists public.catalogue_import_run_items (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.catalogue_import_runs(id) on delete cascade,
  upstream_item_id text not null check (length(trim(upstream_item_id)) > 0),
  parent_upstream_item_id text,
  upstream_parent_product_id text,
  upstream_variant_id text,
  item_kind text not null default 'product'
    check (item_kind in ('product','product_page','variant')),
  source_url text not null check (length(trim(source_url)) > 0),
  discovery_ordinal integer not null check (discovery_ordinal > 0),
  discovery_status text not null default 'discovered'
    check (discovery_status in (
      'discovered','ready','expanded','excluded','fetch_failed','parse_failed'
    )),
  processing_status text not null default 'pending'
    check (processing_status in (
      'pending','processing','staged','deduped','linked','candidate_created','evidence_seeded',
      'needs_review','failed','done'
    )),
  raw_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_payload)='object'),
  normalized_data jsonb
    check (normalized_data is null or jsonb_typeof(normalized_data)='object'),
  errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(errors)='array'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_seen_discovery_pass integer check (last_seen_discovery_pass is null or last_seen_discovery_pass > 0),
  last_error text,
  batch_id uuid references public.catalogue_import_batches(id) on delete set null,
  import_row_id bigint references public.catalogue_import_rows(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(run_id,upstream_item_id),
  unique(run_id,discovery_ordinal)
);

alter table public.catalogue_import_run_items enable row level security;
revoke all on public.catalogue_import_run_items from public,anon,authenticated;
grant select,insert,update,delete on public.catalogue_import_run_items to service_role;
grant usage,select on sequence public.catalogue_import_run_items_id_seq to service_role;

alter table public.catalogue_import_rows
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists import_run_id uuid
    references public.catalogue_import_runs(id) on delete set null,
  add column if not exists run_item_id bigint
    references public.catalogue_import_run_items(id) on delete set null,
  add column if not exists upstream_item_id text;

create unique index if not exists catalogue_import_rows_run_item_uidx
  on public.catalogue_import_rows(run_item_id)
  where run_item_id is not null;
create index if not exists catalogue_import_run_items_run_status_idx
  on public.catalogue_import_run_items(run_id,processing_status,discovery_ordinal);
create index if not exists catalogue_import_run_items_parent_idx
  on public.catalogue_import_run_items(run_id,parent_upstream_item_id)
  where parent_upstream_item_id is not null;
create index if not exists catalogue_import_rows_import_run_idx
  on public.catalogue_import_rows(import_run_id);

create or replace function public.catalogue_get_or_create_import_run(
  p_adapter_id uuid,
  p_source_id uuid,
  p_logical_run_id text,
  p_manifest_version integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_run public.catalogue_import_runs%rowtype;
begin
  if p_logical_run_id is null or length(trim(p_logical_run_id))=0 then
    raise exception 'logical_run_id is required for a durable import run.';
  end if;
  if p_manifest_version is null or p_manifest_version < 1 then
    raise exception 'manifest_version must be positive.';
  end if;
  if not exists (
    select 1 from public.catalogue_source_adapters a
    where a.id=p_adapter_id and a.source_id=p_source_id and a.active=true
  ) then
    raise exception 'Active adapter/source pair does not exist.';
  end if;

  insert into public.catalogue_import_runs(
    adapter_id,source_id,logical_run_id,manifest_version,status
  ) values (
    p_adapter_id,p_source_id,trim(p_logical_run_id),p_manifest_version,'discovering'
  )
  on conflict(adapter_id,logical_run_id) do update
    set updated_at=now()
  returning * into v_run;

  if v_run.source_id <> p_source_id then
    raise exception 'Logical run belongs to a different source.';
  end if;
  if v_run.manifest_version <> p_manifest_version then
    raise exception 'Logical run manifest version mismatch.';
  end if;

  return jsonb_build_object(
    'runId',v_run.id,
    'logicalRunId',v_run.logical_run_id,
    'status',v_run.status,
    'manifestComplete',v_run.manifest_complete,
    'manifestHash',v_run.manifest_hash,
    'nextCursor',v_run.next_cursor,
    'discoveryState',v_run.discovery_state,
    'hasMore',v_run.has_more
  );
end
$fn$;

revoke all on function public.catalogue_get_or_create_import_run(uuid,uuid,text,integer)
  from public,anon,authenticated;
grant execute on function public.catalogue_get_or_create_import_run(uuid,uuid,text,integer)
  to service_role;

create or replace function public.catalogue_commit_import_manifest(
  p_run_id uuid,
  p_manifest_hash text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_run public.catalogue_import_runs%rowtype;
  v_item jsonb;
  v_count integer;
  v_upstream_item_id text;
  v_source_url text;
  v_ordinal integer;
begin
  select * into v_run
  from public.catalogue_import_runs
  where id=p_run_id
  for update;
  if not found then raise exception 'Import run does not exist.'; end if;

  if p_manifest_hash is null or length(trim(p_manifest_hash))=0 then
    raise exception 'manifest_hash is required.';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Manifest items must be a JSON array.';
  end if;

  if v_run.manifest_complete then
    if v_run.manifest_hash is distinct from trim(p_manifest_hash) then
      raise exception 'Import manifest is already frozen with a different hash.';
    end if;
    select count(*) into v_count
    from public.catalogue_import_run_items where run_id=p_run_id;
    return jsonb_build_object(
      'runId',p_run_id,'manifestAlreadyCommitted',true,'discoveredCount',v_count
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_upstream_item_id:=nullif(trim(v_item->>'upstreamItemId'),'');
    v_source_url:=nullif(trim(v_item->>'sourceUrl'),'');
    v_ordinal:=nullif(v_item->>'ordinal','')::integer;
    if v_upstream_item_id is null or v_source_url is null or v_ordinal is null or v_ordinal < 1 then
      raise exception 'Each manifest item requires upstreamItemId, sourceUrl and positive ordinal.';
    end if;

    insert into public.catalogue_import_run_items(
      run_id,upstream_item_id,parent_upstream_item_id,
      upstream_parent_product_id,upstream_variant_id,item_kind,
      source_url,discovery_ordinal,raw_payload
    ) values (
      p_run_id,
      v_upstream_item_id,
      nullif(trim(v_item->>'parentUpstreamItemId'),''),
      nullif(trim(v_item->>'upstreamParentProductId'),''),
      nullif(trim(v_item->>'upstreamVariantId'),''),
      coalesce(nullif(trim(v_item->>'itemKind'),''),'product'),
      v_source_url,
      v_ordinal,
      case
        when jsonb_typeof(v_item->'rawPayload')='object' then v_item->'rawPayload'
        else '{}'::jsonb
      end
    )
    on conflict(run_id,upstream_item_id) do update
      set
        source_url=excluded.source_url,
        discovery_ordinal=excluded.discovery_ordinal,
        raw_payload=excluded.raw_payload,
        upstream_parent_product_id=excluded.upstream_parent_product_id,
        upstream_variant_id=excluded.upstream_variant_id,
        updated_at=now();
  end loop;

  select count(*) into v_count
  from public.catalogue_import_run_items where run_id=p_run_id;

  update public.catalogue_import_runs
  set
    manifest_hash=trim(p_manifest_hash),
    manifest_complete=true,
    status='resumable',
    discovered_count=v_count,
    next_cursor='0',
    has_more=(v_count>0),
    last_error=null,
    updated_at=now()
  where id=p_run_id;

  return jsonb_build_object(
    'runId',p_run_id,'manifestAlreadyCommitted',false,'discoveredCount',v_count
  );
end
$fn$;

revoke all on function public.catalogue_commit_import_manifest(uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.catalogue_commit_import_manifest(uuid,text,jsonb)
  to service_role;


-- Incremental discovery is deliberately separate from processing. A source may
-- take several invocations to enumerate. Items are keyed by stable upstream
-- identity; a verification pass must observe the same set before the manifest
-- is frozen.
create or replace function public.catalogue_upsert_import_manifest_items(
  p_run_id uuid,
  p_items jsonb,
  p_discovery_pass integer,
  p_next_cursor text,
  p_discovery_state jsonb,
  p_discovery_complete boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_run public.catalogue_import_runs%rowtype;
  v_item jsonb;
  v_upstream_item_id text;
  v_source_url text;
  v_status text;
  v_ordinal integer;
  v_existing_id bigint;
  v_inserted integer:=0;
  v_total integer;
  v_manifest_hash text;
begin
  if p_discovery_pass is null or p_discovery_pass < 1 then
    raise exception 'Positive discovery pass is required.';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Manifest items must be a JSON array.';
  end if;
  if p_discovery_state is null or jsonb_typeof(p_discovery_state) <> 'object' then
    raise exception 'Discovery state must be a JSON object.';
  end if;

  select * into v_run
  from public.catalogue_import_runs
  where id=p_run_id
  for update;
  if not found then raise exception 'Import run does not exist.'; end if;
  if v_run.status in ('completed','completed_with_errors','failed') then
    raise exception 'Import run is terminal and cannot accept discovery items.';
  end if;
  if v_run.manifest_complete then
    raise exception 'Import manifest is already frozen.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_upstream_item_id:=nullif(trim(v_item->>'upstreamItemId'),'');
    v_source_url:=nullif(trim(v_item->>'sourceUrl'),'');
    v_status:=coalesce(nullif(trim(v_item->>'discoveryStatus'),''),'discovered');

    if v_upstream_item_id is null or v_source_url is null then
      raise exception 'Each manifest item requires upstreamItemId and sourceUrl.';
    end if;
    if v_status not in ('discovered','ready','excluded') then
      raise exception 'Unsupported manifest discovery status %.',v_status;
    end if;

    select id into v_existing_id
    from public.catalogue_import_run_items
    where run_id=p_run_id and upstream_item_id=v_upstream_item_id
    for update;

    if v_existing_id is null then
      select coalesce(max(discovery_ordinal),0)+1 into v_ordinal
      from public.catalogue_import_run_items
      where run_id=p_run_id;

      insert into public.catalogue_import_run_items(
        run_id,upstream_item_id,parent_upstream_item_id,
        upstream_parent_product_id,upstream_variant_id,item_kind,
        source_url,discovery_ordinal,discovery_status,processing_status,
        raw_payload,normalized_data,errors,last_seen_discovery_pass
      ) values (
        p_run_id,
        v_upstream_item_id,
        nullif(trim(v_item->>'parentUpstreamItemId'),''),
        nullif(trim(v_item->>'upstreamParentProductId'),''),
        nullif(trim(v_item->>'upstreamVariantId'),''),
        coalesce(nullif(trim(v_item->>'itemKind'),''),'product'),
        v_source_url,
        v_ordinal,
        v_status,
        case when v_status='excluded' then 'done' else 'pending' end,
        case when jsonb_typeof(v_item->'rawPayload')='object' then v_item->'rawPayload' else '{}'::jsonb end,
        case when jsonb_typeof(v_item->'normalizedData')='object' then v_item->'normalizedData' else null end,
        case when jsonb_typeof(v_item->'errors')='array' then v_item->'errors' else '[]'::jsonb end,
        p_discovery_pass
      );
      v_inserted:=v_inserted+1;
    else
      update public.catalogue_import_run_items
      set
        source_url=v_source_url,
        upstream_parent_product_id=coalesce(nullif(trim(v_item->>'upstreamParentProductId'),''),upstream_parent_product_id),
        upstream_variant_id=coalesce(nullif(trim(v_item->>'upstreamVariantId'),''),upstream_variant_id),
        raw_payload=case when jsonb_typeof(v_item->'rawPayload')='object' then v_item->'rawPayload' else raw_payload end,
        normalized_data=case when jsonb_typeof(v_item->'normalizedData')='object' then v_item->'normalizedData' else normalized_data end,
        errors=case when jsonb_typeof(v_item->'errors')='array' then v_item->'errors' else errors end,
        discovery_status=v_status,
        processing_status=case
          when v_status='excluded' then 'done'
          when processing_status='done' then processing_status
          else 'pending'
        end,
        last_seen_discovery_pass=p_discovery_pass,
        last_error=null,
        updated_at=now()
      where id=v_existing_id;
    end if;

    v_existing_id:=null;
  end loop;

  if p_discovery_complete then
    update public.catalogue_import_run_items
    set
      discovery_status='excluded',
      processing_status='done',
      errors=errors || jsonb_build_array(
        'Source item was not present in the stable discovery verification pass.'
      ),
      last_error=null,
      updated_at=now()
    where run_id=p_run_id
      and coalesce(last_seen_discovery_pass,0) < p_discovery_pass
      and processing_status in ('pending','processing','failed');

    select md5(coalesce(string_agg(
      upstream_item_id||'|'||source_url||'|'||md5(raw_payload::text),
      E'\n' order by upstream_item_id
    ),'')) into v_manifest_hash
    from public.catalogue_import_run_items
    where run_id=p_run_id;

    update public.catalogue_import_runs
    set
      manifest_hash=v_manifest_hash,
      manifest_complete=true,
      next_cursor=null,
      discovery_state=p_discovery_state,
      status='resumable',
      has_more=exists(
        select 1 from public.catalogue_import_run_items
        where run_id=p_run_id and processing_status='pending'
      ),
      last_error=null,
      updated_at=now()
    where id=p_run_id;
  else
    update public.catalogue_import_runs
    set
      next_cursor=p_next_cursor,
      discovery_state=p_discovery_state,
      status='discovering',
      has_more=true,
      last_error=null,
      updated_at=now()
    where id=p_run_id;
  end if;

  select count(*) into v_total
  from public.catalogue_import_run_items where run_id=p_run_id;

  update public.catalogue_import_runs
  set discovered_count=v_total,updated_at=now()
  where id=p_run_id;

  return jsonb_build_object(
    'runId',p_run_id,
    'insertedCount',v_inserted,
    'discoveredCount',v_total,
    'manifestComplete',p_discovery_complete,
    'manifestHash',case when p_discovery_complete then v_manifest_hash else null end,
    'nextCursor',case when p_discovery_complete then null else p_next_cursor end,
    'discoveryState',p_discovery_state
  );
end
$fn$;

revoke all on function public.catalogue_upsert_import_manifest_items(
  uuid,jsonb,integer,text,jsonb,boolean
) from public,anon,authenticated;
grant execute on function public.catalogue_upsert_import_manifest_items(
  uuid,jsonb,integer,text,jsonb,boolean
) to service_role;

create or replace function public.catalogue_claim_import_run_items(
  p_run_id uuid,
  p_limit integer default 100,
  p_max_attempts integer default 3,
  p_retry_exhausted boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_items jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'Claim limit must be between 1 and 500.';
  end if;
  if p_max_attempts is null or p_max_attempts < 1 then
    raise exception 'max_attempts must be positive.';
  end if;
  if not exists (
    select 1 from public.catalogue_import_runs
    where id=p_run_id and manifest_complete=true
      and status not in ('completed','completed_with_errors','failed')
  ) then
    raise exception 'Import run is missing, terminal, or discovery is incomplete.';
  end if;

  with candidates as (
    select id
    from public.catalogue_import_run_items
    where run_id=p_run_id
      and discovery_status in ('discovered','ready')
      and (
        processing_status='pending'
        or (
          processing_status='failed'
          and (attempt_count < p_max_attempts or p_retry_exhausted)
        )
        or (
          processing_status='processing'
          and updated_at < now()-interval '15 minutes'
        )
      )
    order by discovery_ordinal,id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.catalogue_import_run_items i
    set processing_status='processing',last_error=null,updated_at=now()
    from candidates c
    where i.id=c.id
    returning i.*
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',id,
      'upstreamItemId',upstream_item_id,
      'parentUpstreamItemId',parent_upstream_item_id,
      'upstreamParentProductId',upstream_parent_product_id,
      'upstreamVariantId',upstream_variant_id,
      'itemKind',item_kind,
      'sourceUrl',source_url,
      'discoveryOrdinal',discovery_ordinal,
      'discoveryStatus',discovery_status,
      'processingStatus',processing_status,
      'rawPayload',raw_payload,
      'normalizedData',normalized_data,
      'errors',errors,
      'attemptCount',attempt_count
    ) order by discovery_ordinal,id
  ),'[]'::jsonb)
  into v_items
  from claimed;

  update public.catalogue_import_runs
  set status='processing',updated_at=now()
  where id=p_run_id;

  return jsonb_build_object('runId',p_run_id,'items',v_items);
end
$fn$;

revoke all on function public.catalogue_claim_import_run_items(uuid,integer,integer,boolean)
  from public,anon,authenticated;
grant execute on function public.catalogue_claim_import_run_items(uuid,integer,integer,boolean)
  to service_role;

create or replace function public.catalogue_mark_import_run_error(
  p_run_id uuid,
  p_error text,
  p_terminal boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
begin
  if p_error is null or length(trim(p_error))=0 then
    raise exception 'Import run error text is required.';
  end if;

  update public.catalogue_import_runs
  set
    status=case when p_terminal then 'failed' else 'resumable' end,
    last_error=left(trim(p_error),1000),
    completed_at=case when p_terminal then now() else null end,
    updated_at=now()
  where id=p_run_id
    and status not in ('completed','completed_with_errors');

  if not found then raise exception 'Import run does not exist or is already completed.'; end if;

  return jsonb_build_object(
    'runId',p_run_id,
    'status',case when p_terminal then 'failed' else 'resumable' end
  );
end
$fn$;

revoke all on function public.catalogue_mark_import_run_error(uuid,text,boolean)
  from public,anon,authenticated;
grant execute on function public.catalogue_mark_import_run_error(uuid,text,boolean)
  to service_role;

create or replace function public.catalogue_release_import_run_claims(
  p_run_id uuid,
  p_item_ids bigint[],
  p_error text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_released integer;
begin
  if p_item_ids is null or cardinality(p_item_ids)=0 then
    return jsonb_build_object('runId',p_run_id,'releasedCount',0);
  end if;
  if p_error is null or length(trim(p_error))=0 then
    raise exception 'Claim release error text is required.';
  end if;

  update public.catalogue_import_run_items
  set processing_status='failed',
      attempt_count=attempt_count+1,
      last_error=left(trim(p_error),1000),
      updated_at=now()
  where run_id=p_run_id
    and id=any(p_item_ids)
    and processing_status='processing';
  get diagnostics v_released = row_count;

  update public.catalogue_import_runs
  set status='resumable',last_error=left(trim(p_error),1000),updated_at=now()
  where id=p_run_id
    and status not in ('completed','completed_with_errors','failed');

  return jsonb_build_object('runId',p_run_id,'releasedCount',v_released);
end
$fn$;

revoke all on function public.catalogue_release_import_run_claims(uuid,bigint[],text)
  from public,anon,authenticated;
grant execute on function public.catalogue_release_import_run_claims(uuid,bigint[],text)
  to service_role;

create or replace function public.catalogue_stage_import_run_chunk(
  p_run_id uuid,
  p_chunk_key text,
  p_results jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_run public.catalogue_import_runs%rowtype;
  v_result jsonb;
  v_item public.catalogue_import_run_items%rowtype;
  v_parent_id text;
  v_outcome text;
  v_batch_id uuid;
  v_import_row_id bigint;
  v_next_ordinal integer;
  v_status public.catalogue_import_row_status;
  v_total integer;
  v_valid integer;
  v_invalid integer;
begin
  if p_chunk_key is null or length(trim(p_chunk_key))=0 then
    raise exception 'chunk_key is required.';
  end if;
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Chunk results must be a JSON array.';
  end if;

  select * into v_run
  from public.catalogue_import_runs
  where id=p_run_id
  for update;
  if not found then raise exception 'Import run does not exist.'; end if;
  if not v_run.manifest_complete then
    raise exception 'Import manifest must be committed before staging chunks.';
  end if;
  if v_run.status in ('completed','completed_with_errors','failed') then
    raise exception 'Import run is terminal and cannot accept another chunk.';
  end if;

  insert into public.catalogue_import_batches(
    source_id,adapter_id,import_run_id,chunk_key,file_name,import_kind,status,
    total_rows,valid_rows,invalid_rows,notes,source_run_id,source_cursor
  ) values (
    v_run.source_id,v_run.adapter_id,p_run_id,trim(p_chunk_key),
    'run-'||v_run.logical_run_id||'-chunk-'||trim(p_chunk_key)||'.json',
    'products','staged',0,0,0,
    'Durable import run '||v_run.logical_run_id,
    v_run.logical_run_id||':'||trim(p_chunk_key),
    trim(p_chunk_key)
  )
  on conflict(import_run_id,chunk_key)
    where import_run_id is not null and chunk_key is not null
  do update set source_cursor=excluded.source_cursor
  returning id into v_batch_id;

  for v_result in select value from jsonb_array_elements(p_results)
  loop
    v_outcome:=coalesce(nullif(trim(v_result->>'outcome'),''),'parse_failed');

    select * into v_item
    from public.catalogue_import_run_items
    where run_id=p_run_id
      and upstream_item_id=nullif(trim(v_result->>'upstreamItemId'),'')
    for update;

    if not found then
      v_parent_id:=nullif(trim(v_result->>'parentUpstreamItemId'),'');
      if v_parent_id is null or not exists (
        select 1 from public.catalogue_import_run_items
        where run_id=p_run_id and upstream_item_id=v_parent_id
      ) then
        raise exception 'Chunk result references an item outside the frozen manifest.';
      end if;

      select coalesce(max(discovery_ordinal),0)+1 into v_next_ordinal
      from public.catalogue_import_run_items where run_id=p_run_id;

      insert into public.catalogue_import_run_items(
        run_id,upstream_item_id,parent_upstream_item_id,
        upstream_parent_product_id,upstream_variant_id,item_kind,
        source_url,discovery_ordinal,raw_payload
      ) values (
        p_run_id,
        nullif(trim(v_result->>'upstreamItemId'),''),
        v_parent_id,
        nullif(trim(v_result->>'upstreamParentProductId'),''),
        nullif(trim(v_result->>'upstreamVariantId'),''),
        coalesce(nullif(trim(v_result->>'itemKind'),''),'variant'),
        coalesce(nullif(trim(v_result->>'sourceUrl'),''),(
          select source_url from public.catalogue_import_run_items
          where run_id=p_run_id and upstream_item_id=v_parent_id
        )),
        v_next_ordinal,
        case
          when jsonb_typeof(v_result->'rawPayload')='object' then v_result->'rawPayload'
          else '{}'::jsonb
        end
      )
      returning * into v_item;
    end if;

    if v_outcome not in ('ready','expanded','excluded','fetch_failed','parse_failed') then
      raise exception 'Unsupported chunk outcome %.',v_outcome;
    end if;

    update public.catalogue_import_run_items
    set
      discovery_status=v_outcome,
      normalized_data=case
        when jsonb_typeof(v_result->'normalizedData')='object'
          then v_result->'normalizedData'
        else normalized_data
      end,
      errors=case
        when jsonb_typeof(v_result->'errors')='array' then v_result->'errors'
        else '[]'::jsonb
      end,
      attempt_count=attempt_count+1,
      last_error=case
        when v_outcome in ('fetch_failed','parse_failed')
          then coalesce(nullif(v_result->>'lastError',''),'Import item processing failed.')
        else null
      end,
      processing_status=case
        when v_outcome='ready' then 'staged'
        when v_outcome in ('expanded','excluded') then 'done'
        else 'failed'
      end,
      batch_id=case when v_outcome='ready' then v_batch_id else batch_id end,
      updated_at=now()
    where id=v_item.id
    returning * into v_item;

    if v_outcome='ready' then
      if v_item.normalized_data is null then
        raise exception 'Ready import item % has no normalized_data.',v_item.upstream_item_id;
      end if;
      v_status:=case
        when coalesce(jsonb_array_length(v_item.errors),0)>0
          then 'needs_review'::public.catalogue_import_row_status
        else 'validated'::public.catalogue_import_row_status
      end;

      insert into public.catalogue_import_rows(
        batch_id,row_number,proposed_product_id,raw_data,normalized_data,status,
        validation_errors,duplicate_product_id,import_run_id,run_item_id,upstream_item_id
      ) values (
        v_batch_id,
        v_item.discovery_ordinal,
        nullif(trim(v_item.normalized_data->>'id'),''),
        case
          when jsonb_typeof(v_result->'rawData')='object' then v_result->'rawData'
          else '{}'::jsonb
        end || jsonb_build_object(
          'upstreamItemId',v_item.upstream_item_id,
          'logicalRunId',v_run.logical_run_id
        ),
        v_item.normalized_data,
        v_status,
        v_item.errors,
        null,
        p_run_id,
        v_item.id,
        v_item.upstream_item_id
      )
      on conflict(run_item_id) where run_item_id is not null
      do update set
        raw_data=excluded.raw_data,
        normalized_data=excluded.normalized_data,
        validation_errors=excluded.validation_errors,
        proposed_product_id=excluded.proposed_product_id,
        updated_at=now()
      where public.catalogue_import_rows.status <> 'imported'
      returning id into v_import_row_id;

      if v_import_row_id is null then
        select id into v_import_row_id
        from public.catalogue_import_rows where run_item_id=v_item.id;
      end if;

      update public.catalogue_import_run_items
      set import_row_id=v_import_row_id,updated_at=now()
      where id=v_item.id;
    end if;
  end loop;

  select
    count(*),
    count(*) filter (where status in ('validated','imported')),
    count(*) filter (where status in ('needs_review','rejected'))
  into v_total,v_valid,v_invalid
  from public.catalogue_import_rows
  where batch_id=v_batch_id;

  update public.catalogue_import_batches
  set
    total_rows=v_total,
    valid_rows=v_valid,
    invalid_rows=v_invalid,
    status=case
      when v_invalid>0 then 'needs_review'::public.catalogue_import_batch_status
      else 'staged'::public.catalogue_import_batch_status
    end
  where id=v_batch_id;

  update public.catalogue_import_runs
  set status='processing',last_error=null,updated_at=now()
  where id=p_run_id;

  return jsonb_build_object(
    'runId',p_run_id,'batchId',v_batch_id,'totalRows',v_total,
    'validRows',v_valid,'invalidRows',v_invalid
  );
end
$fn$;

revoke all on function public.catalogue_stage_import_run_chunk(uuid,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.catalogue_stage_import_run_chunk(uuid,text,jsonb)
  to service_role;

-- Exact identity matching: explicit product/source IDs win. Reused sibling SKU/MPN
-- identities are review conflicts unless the exact source variant is already known.
create or replace function public.catalogue_run_import_dedupe(p_batch_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
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
  v_identity_conflicts jsonb;
  v_new integer:=0;
  v_exact integer:=0;
  v_probable integer:=0;
  v_conflict integer:=0;
begin
  select source_id into v_source_id
  from public.catalogue_import_batches
  where id=p_batch_id and import_kind='products';
  if not found then raise exception 'Product import batch does not exist.'; end if;

  for r in
    select id,proposed_product_id,normalized_data,status
    from public.catalogue_import_rows
    where batch_id=p_batch_id
      and normalized_data is not null
      and status in ('validated','needs_review','staged')
    order by row_number,id
  loop
    v_category:=r.normalized_data->>'category';
    v_manufacturer:=catalogue_internal.normalize_identity_text(r.normalized_data->>'manufacturer');
    v_sku:=catalogue_internal.normalize_identity_text(r.normalized_data->>'manufacturer_sku');
    v_mpn:=catalogue_internal.normalize_identity_text(r.normalized_data->>'mpn');
    v_model:=catalogue_internal.normalize_identity_text(coalesce(
      nullif(r.normalized_data->>'model',''),r.normalized_data->>'display_name'
    ));
    v_variant:=coalesce(catalogue_internal.normalize_identity_text(r.normalized_data->>'variant'),'');
    v_external:=catalogue_internal.normalize_identity_text(r.normalized_data->>'source_external_product_id');
    v_identity_conflicts:=case
      when jsonb_typeof(r.normalized_data->'identity_conflicts')='array'
        then r.normalized_data->'identity_conflicts'
      else '[]'::jsonb
    end;
    v_model_prefix:=case
      when v_category is not null and v_manufacturer is not null and v_model is not null
        then v_category||'|'||v_manufacturer||'|'||v_model||'|'
      else null
    end;

    v_status:=null;
    v_product_id:=null;
    v_method:=null;
    v_confidence:=null;
    v_identity_key:=null;
    v_exact_count:=0;
    v_probable_count:=0;
    v_probable_ids:='[]'::jsonb;

    -- Explicit stable DroneCores IDs are authoritative when they already exist.
    if r.proposed_product_id is not null and exists (
      select 1 from public.catalogue_products where id=r.proposed_product_id
    ) then
      v_status:='exact_match';
      v_product_id:=r.proposed_product_id;
      v_method:='product_id';
      v_confidence:=1;
      v_identity_key:='product_id|'||r.proposed_product_id;
    end if;

    -- Next prefer exact source + upstream variant identity.
    if v_status is null and v_source_id is not null and v_external is not null then
      select count(distinct k.product_id),min(k.product_id)
      into v_exact_count,v_product_id
      from public.catalogue_product_identity_keys k
      where k.key_kind='source_external_id'
        and k.key_value=v_source_id::text||'|'||v_external;

      if v_exact_count=1 then
        v_status:='exact_match';
        v_method:='source_external_id';
        v_confidence:=1;
        v_identity_key:=v_source_id::text||'|'||v_external;
      elsif v_exact_count>1 then
        v_status:='conflict';
        v_product_id:=null;
        v_method:='multiple_source_identity_matches';
      end if;
    end if;

    -- Reused sibling SKU/MPN or unstable variant identity must never auto-merge
    -- a previously unseen upstream variant.
    if v_status is null and jsonb_array_length(v_identity_conflicts)>0 then
      v_status:='conflict';
      v_product_id:=null;
      v_method:='declared_identity_conflict';
      v_identity_key:=coalesce(v_source_id::text||'|'||v_external,v_model_prefix);
    end if;

    if v_status is null and v_variant<>'' and exists (
      select 1
      from public.catalogue_product_identity_keys k
      join public.catalogue_products p on p.id=k.product_id
      where k.key_kind='model_variant'
        and k.key_value=v_category||'|'||v_manufacturer||'|'||v_model||'|'||v_variant
        and (
          (
            v_sku is not null
            and catalogue_internal.normalize_identity_text(p.manufacturer_sku) is not null
            and catalogue_internal.normalize_identity_text(p.manufacturer_sku)<>v_sku
          )
          or (
            v_mpn is not null
            and catalogue_internal.normalize_identity_text(p.mpn) is not null
            and catalogue_internal.normalize_identity_text(p.mpn)<>v_mpn
          )
        )
    ) then
      v_status:='conflict';
      v_product_id:=null;
      v_method:='model_variant_identifier_conflict';
      v_identity_key:=v_category||'|'||v_manufacturer||'|'||v_model||'|'||v_variant;
    end if;

    if v_status is null then
      with candidates as (
        select k.product_id,2 priority,'manufacturer_sku'::text method,
          v_category||'|'||v_manufacturer||'|'||v_sku identity_key
        from public.catalogue_product_identity_keys k
        where v_category is not null and v_manufacturer is not null and v_sku is not null
          and k.key_kind='manufacturer_sku'
          and k.key_value=v_category||'|'||v_manufacturer||'|'||v_sku
        union all
        select k.product_id,3,'mpn',
          v_category||'|'||v_manufacturer||'|'||v_mpn
        from public.catalogue_product_identity_keys k
        where v_category is not null and v_manufacturer is not null and v_mpn is not null
          and k.key_kind='mpn'
          and k.key_value=v_category||'|'||v_manufacturer||'|'||v_mpn
        union all
        select k.product_id,4,'model_variant',
          v_category||'|'||v_manufacturer||'|'||v_model||'|'||v_variant
        from public.catalogue_product_identity_keys k
        join public.catalogue_products p on p.id=k.product_id
        where v_category is not null
          and v_manufacturer is not null
          and v_model is not null
          and v_variant<>''
          and k.key_kind='model_variant'
          and k.key_value=v_category||'|'||v_manufacturer||'|'||v_model||'|'||v_variant
          and (
            v_sku is null
            or catalogue_internal.normalize_identity_text(p.manufacturer_sku) is null
            or catalogue_internal.normalize_identity_text(p.manufacturer_sku)=v_sku
          )
          and (
            v_mpn is null
            or catalogue_internal.normalize_identity_text(p.mpn) is null
            or catalogue_internal.normalize_identity_text(p.mpn)=v_mpn
          )
      ), distinct_candidates as (
        select product_id,min(priority) priority from candidates group by product_id
      ), chosen as (
        select c.product_id,c.method,c.priority,c.identity_key
        from candidates c
        join distinct_candidates d on d.product_id=c.product_id and d.priority=c.priority
        order by c.priority,c.product_id
      )
      select
        (select count(*) from distinct_candidates),
        (select product_id from chosen limit 1),
        (select method from chosen limit 1),
        (select identity_key from chosen limit 1)
      into v_exact_count,v_product_id,v_method,v_identity_key;

      if v_exact_count>1 then
        v_status:='conflict';
        v_product_id:=null;
        v_method:='multiple_identity_matches';
      elsif v_exact_count=1 then
        v_status:='exact_match';
        v_confidence:=1;
      end if;
    end if;

    if v_status is null and v_model_prefix is not null then
      select
        count(*),
        case when count(*)=1 then min(product_id) else null end,
        coalesce(jsonb_agg(product_id order by product_id),'[]'::jsonb)
      into v_probable_count,v_product_id,v_probable_ids
      from (
        select distinct k.product_id
        from public.catalogue_product_identity_keys k
        where k.key_kind='model_variant'
          and left(k.key_value,length(v_model_prefix))=v_model_prefix
      ) probable;

      if v_probable_count>0 then
        v_status:='probable_match';
        v_method:=case when v_probable_count=1 then 'model_family' else 'model_family_multiple' end;
        v_confidence:=case when v_probable_count=1 then 0.80 else 0.70 end;
        v_identity_key:=v_model_prefix;
      end if;
    end if;

    if v_status is null then
      v_status:='new';
      v_product_id:=null;
      v_identity_key:=case
        when v_manufacturer is not null and v_sku is not null
          then v_category||'|'||v_manufacturer||'|'||v_sku
        when v_manufacturer is not null and v_mpn is not null
          then v_category||'|'||v_manufacturer||'|'||v_mpn
        when v_manufacturer is not null and v_model is not null
          then v_category||'|'||v_manufacturer||'|'||v_model||'|'||v_variant
        else null
      end;
    end if;

    if v_status='new' then v_new:=v_new+1;
    elsif v_status='exact_match' then v_exact:=v_exact+1;
    elsif v_status='probable_match' then v_probable:=v_probable+1;
    else v_conflict:=v_conflict+1;
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
        'identityConflicts',v_identity_conflicts,
        'exactCandidateCount',v_exact_count,
        'probableCandidateCount',v_probable_count,
        'probableCandidateIds',v_probable_ids
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

  update public.catalogue_import_batches b
  set
    dedupe_completed_at=now(),
    total_rows=(select count(*) from public.catalogue_import_rows ir where ir.batch_id=b.id),
    valid_rows=(select count(*) from public.catalogue_import_rows ir where ir.batch_id=b.id and ir.status in ('validated','imported')),
    invalid_rows=(select count(*) from public.catalogue_import_rows ir where ir.batch_id=b.id and ir.status in ('needs_review','rejected')),
    status=case
      when v_conflict>0 or v_probable>0
        then 'needs_review'::public.catalogue_import_batch_status
      else 'validated'::public.catalogue_import_batch_status
    end
  where b.id=p_batch_id;

  return jsonb_build_object(
    'batchId',p_batch_id,'newRows',v_new,'exactMatches',v_exact,
    'probableMatches',v_probable,'conflicts',v_conflict
  );
end
$fn$;

revoke all on function public.catalogue_run_import_dedupe(uuid)
  from public,anon,authenticated;
grant execute on function public.catalogue_run_import_dedupe(uuid)
  to service_role;

create or replace function public.catalogue_refresh_import_run_state(p_run_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_discovered integer;
  v_staged integer;
  v_excluded integer;
  v_failed integer;
  v_review integer;
  v_completed integer;
  v_pending integer;
  v_status text;
  v_manifest_complete boolean;
begin
  select manifest_complete into v_manifest_complete
  from public.catalogue_import_runs
  where id=p_run_id;
  if not found then raise exception 'Import run does not exist.'; end if;

  if not v_manifest_complete then
    update public.catalogue_import_runs
    set status='discovering',has_more=true,completed_at=null,updated_at=now()
    where id=p_run_id;
    return jsonb_build_object(
      'runId',p_run_id,'status','discovering','manifestComplete',false
    );
  end if;

  select
    count(*),
    count(*) filter (where import_row_id is not null),
    count(*) filter (where discovery_status='excluded'),
    count(*) filter (where processing_status='failed'),
    count(*) filter (where processing_status='needs_review'),
    count(*) filter (where processing_status='done'),
    count(*) filter (where processing_status in ('pending','processing','staged','deduped','linked','candidate_created','evidence_seeded'))
  into v_discovered,v_staged,v_excluded,v_failed,v_review,v_completed,v_pending
  from public.catalogue_import_run_items
  where run_id=p_run_id;

  v_status:=case
    when v_failed>0 or v_pending>0 then 'resumable'
    when v_review>0 then 'completed_with_errors'
    else 'completed'
  end;

  update public.catalogue_import_runs
  set
    status=v_status,
    discovered_count=v_discovered,
    staged_count=v_staged,
    excluded_count=v_excluded,
    failed_count=v_failed,
    review_count=v_review,
    completed_count=v_completed,
    has_more=(v_failed>0 or v_pending>0),
    completed_at=case when v_status in ('completed','completed_with_errors') then now() else null end,
    updated_at=now()
  where id=p_run_id;

  return jsonb_build_object(
    'runId',p_run_id,'status',v_status,'discoveredCount',v_discovered,
    'stagedCount',v_staged,'excludedCount',v_excluded,'failedCount',v_failed,
    'reviewCount',v_review,'completedCount',v_completed
  );
end
$fn$;

revoke all on function public.catalogue_refresh_import_run_state(uuid)
  from public,anon,authenticated;
grant execute on function public.catalogue_refresh_import_run_state(uuid)
  to service_role;

create or replace function public.catalogue_process_import_batch(
  p_batch_id uuid,
  p_create_candidates boolean,
  p_reviewer text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_batch public.catalogue_import_batches%rowtype;
  v_dedupe jsonb;
  v_linked jsonb;
  v_candidate jsonb;
  v_row record;
  v_requirement record;
  v_product_id text;
  v_source_url text;
  v_manufacturer text;
  v_model text;
  v_variant text;
  v_value jsonb;
  v_candidates integer:=0;
  v_identity_evidence integer:=0;
  v_spec_evidence integer:=0;
  v_run_state jsonb;
begin
  if p_reviewer is null or length(trim(p_reviewer))=0 then
    raise exception 'Reviewer is required.';
  end if;
  select * into v_batch
  from public.catalogue_import_batches
  where id=p_batch_id
  for update;
  if not found then raise exception 'Import batch does not exist.'; end if;

  v_dedupe:=public.catalogue_run_import_dedupe(p_batch_id);
  v_linked:=public.catalogue_link_exact_import_matches(
    p_batch_id,p_reviewer,
    'Exact upstream variant identity was linked without overwriting canonical specifications.'
  );

  update public.catalogue_import_run_items i
  set processing_status='done',updated_at=now()
  from public.catalogue_import_rows r
  where r.batch_id=p_batch_id
    and r.run_item_id=i.id
    and r.dedupe_status='exact_match'
    and r.status='imported';

  for v_row in
    select r.id,r.run_item_id,r.normalized_data
    from public.catalogue_import_rows r
    where r.batch_id=p_batch_id
      and r.dedupe_status='new'
      and r.status in ('validated','needs_review')
    order by r.row_number,r.id
  loop
    if not p_create_candidates then
      update public.catalogue_import_run_items
      set processing_status='needs_review',updated_at=now()
      where id=v_row.run_item_id;
      continue;
    end if;

    v_candidate:=public.catalogue_create_candidate_from_deduped_import(
      v_row.id,p_reviewer,
      'Candidate created by durable manufacturer import run; publication gates remain unchanged.'
    );
    v_product_id:=v_candidate->>'productId';
    v_source_url:=nullif(trim(v_row.normalized_data->>'source_url'),'');
    v_manufacturer:=nullif(trim(v_row.normalized_data->>'manufacturer'),'');
    v_model:=coalesce(
      nullif(trim(v_row.normalized_data->>'model'),''),
      nullif(trim(v_row.normalized_data->>'display_name'),'')
    );
    v_variant:=nullif(trim(v_row.normalized_data->>'variant'),'');

    if v_product_id is null or v_source_url is null
       or v_source_url !~ '^https://'
       or v_manufacturer is null or v_model is null then
      raise exception 'Candidate evidence seed data is incomplete for import row %.',v_row.id;
    end if;

    insert into public.catalogue_identity_evidence(
      product_id,source_id,source_url,authority,manufacturer_label,model_label,
      variant_label,exact_model_association,verification_status,retrieved_at,caveats
    ) values (
      v_product_id,v_batch.source_id,v_source_url,'manufacturer',
      v_manufacturer,v_model,v_variant,true,'pending_review',now(),
      'Automatically staged from a durable official-manufacturer import; human verification is required.'
    )
    on conflict(product_id,source_id,source_url) do nothing;
    declare
      v_row_count integer;
    begin
      get diagnostics v_row_count = row_count;
      v_identity_evidence:=v_identity_evidence+v_row_count;
    end;

    for v_requirement in
      select field_key
      from public.catalogue_category_field_requirements
      where category=(v_row.normalized_data->>'category')::public.drone_product_category
    loop
      v_value:=public.catalogue_product_field_value_json(v_product_id,v_requirement.field_key);
      if v_value is null or v_value='null'::jsonb then continue; end if;

      insert into public.catalogue_spec_evidence(
        product_id,field_key,value,source_id,source_url,authority,
        exact_model_association,verification_status,retrieved_at,conditions,caveats
      ) values (
        v_product_id,v_requirement.field_key,v_value,v_batch.source_id,v_source_url,
        'manufacturer',true,'pending_review',now(),
        jsonb_build_object(
          'importRunId',v_batch.import_run_id,
          'importRowId',v_row.id,
          'extraction','structured_or_configured_regex'
        ),
        'Automatically staged from exact manufacturer variant data; verification is required.'
      )
      on conflict do nothing;
      declare
        v_row_count integer;
      begin
        get diagnostics v_row_count = row_count;
        v_spec_evidence:=v_spec_evidence+v_row_count;
      end;
    end loop;

    update public.catalogue_import_run_items
    set processing_status='done',updated_at=now()
    where id=v_row.run_item_id;
    v_candidates:=v_candidates+1;
  end loop;

  update public.catalogue_import_run_items i
  set processing_status='needs_review',updated_at=now()
  from public.catalogue_import_rows r
  where r.batch_id=p_batch_id
    and r.run_item_id=i.id
    and r.dedupe_status in ('probable_match','conflict');

  update public.catalogue_import_run_items i
  set processing_status='failed',
      last_error='Import row was rejected before canonical processing.',
      updated_at=now()
  from public.catalogue_import_rows r
  where r.batch_id=p_batch_id
    and r.run_item_id=i.id
    and r.status='rejected';

  update public.catalogue_import_batches b
  set
    total_rows=(select count(*) from public.catalogue_import_rows r where r.batch_id=b.id),
    valid_rows=(select count(*) from public.catalogue_import_rows r where r.batch_id=b.id and r.status='imported'),
    invalid_rows=(select count(*) from public.catalogue_import_rows r where r.batch_id=b.id and r.status in ('needs_review','rejected','validated')),
    status=case
      when exists (
        select 1 from public.catalogue_import_rows r
        where r.batch_id=b.id and r.status in ('needs_review','rejected','validated')
      ) then 'needs_review'::public.catalogue_import_batch_status
      else 'imported'::public.catalogue_import_batch_status
    end
  where b.id=p_batch_id;

  if v_batch.import_run_id is not null then
    v_run_state:=public.catalogue_refresh_import_run_state(v_batch.import_run_id);
  end if;

  return jsonb_build_object(
    'batchId',p_batch_id,
    'dedupe',v_dedupe,
    'linkedExactMatches',coalesce((v_linked->>'linkedRows')::integer,0),
    'candidatesCreated',v_candidates,
    'identityEvidenceSeeded',v_identity_evidence,
    'specEvidenceSeeded',v_spec_evidence,
    'runState',v_run_state
  );
end
$fn$;

revoke all on function public.catalogue_process_import_batch(uuid,boolean,text)
  from public,anon,authenticated;
grant execute on function public.catalogue_process_import_batch(uuid,boolean,text)
  to service_role;

create or replace function public.catalogue_finalize_import_run(
  p_run_id uuid,
  p_allow_errors boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $fn$
declare
  v_state jsonb;
  v_pending integer;
  v_failed integer;
begin
  if not coalesce((select manifest_complete from public.catalogue_import_runs where id=p_run_id),false) then
    raise exception 'Import manifest is not complete and cannot be finalized.';
  end if;

  v_state:=public.catalogue_refresh_import_run_state(p_run_id);

  select
    count(*) filter (where processing_status in ('pending','processing','staged','deduped','linked','candidate_created','evidence_seeded')),
    count(*) filter (where processing_status='failed')
  into v_pending,v_failed
  from public.catalogue_import_run_items
  where run_id=p_run_id;

  if v_pending>0 then
    raise exception 'Import run still has % resumable items.',v_pending;
  end if;
  if v_failed>0 and not p_allow_errors then
    raise exception 'Import run has % failed items; retry them or explicitly finalize with errors.',v_failed;
  end if;

  if v_failed>0 then
    update public.catalogue_import_runs
    set status='completed_with_errors',has_more=false,completed_at=now(),updated_at=now()
    where id=p_run_id;
  end if;

  select jsonb_build_object(
    'runId',id,'status',status,'discoveredCount',discovered_count,
    'stagedCount',staged_count,'excludedCount',excluded_count,
    'failedCount',failed_count,'reviewCount',review_count,
    'completedCount',completed_count
  )
  into v_state
  from public.catalogue_import_runs where id=p_run_id;

  return v_state;
end
$fn$;

revoke all on function public.catalogue_finalize_import_run(uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.catalogue_finalize_import_run(uuid,boolean)
  to service_role;
