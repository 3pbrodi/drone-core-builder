-- Daily verified EU/EUR offer refresh.
-- Runtime configuration (never commit values) must provision these Vault secret names:
--   catalogue_offer_refresh_token
--   catalogue_project_url
--   catalogue_publishable_key
--
-- pg_cron runs at both UTC times that can correspond to Berlin midnight.
-- The internal timezone guard executes the refresh exactly once at 00:00 Europe/Berlin.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists catalogue_internal;
revoke all on schema catalogue_internal from public, anon, authenticated;

create table if not exists public.catalogue_offer_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  local_date date not null unique,
  timezone text not null default 'Europe/Berlin',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running','completed','partial','failed','skipped')),
  total_targets integer not null default 0,
  successful_checks integer not null default 0,
  failed_checks integer not null default 0,
  updated_offers integer not null default 0,
  error_message text
);

alter table public.catalogue_offer_refresh_runs enable row level security;
revoke all on public.catalogue_offer_refresh_runs from public, anon, authenticated;

create table if not exists public.catalogue_offer_refresh_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.catalogue_offer_refresh_runs(id) on delete cascade,
  offer_id uuid not null references public.catalogue_offers(id) on delete cascade,
  product_id text not null references public.catalogue_products(id) on delete cascade,
  merchant_name text not null,
  product_url text not null,
  previous_price numeric,
  observed_price numeric,
  previous_stock_status public.stock_status,
  observed_stock_status public.stock_status,
  observed_currency text,
  parser_source text,
  response_status integer,
  success boolean not null,
  applied boolean not null default false,
  checked_at timestamptz not null,
  error_message text,
  created_at timestamptz not null default now(),
  unique (run_id, offer_id)
);

alter table public.catalogue_offer_refresh_checks enable row level security;
revoke all on public.catalogue_offer_refresh_checks from public, anon, authenticated;

create index if not exists catalogue_offer_refresh_checks_run_idx
  on public.catalogue_offer_refresh_checks(run_id);
create index if not exists catalogue_offer_refresh_checks_offer_idx
  on public.catalogue_offer_refresh_checks(offer_id);

create or replace function catalogue_internal.assert_offer_refresh_token(p_token text)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_expected text;
begin
  select decrypted_secret
  into v_expected
  from vault.decrypted_secrets
  where name = 'catalogue_offer_refresh_token'
  limit 1;

  if v_expected is null
     or p_token is null
     or length(p_token) < 32
     or p_token <> v_expected then
    raise exception 'Invalid offer refresh token.';
  end if;
end;
$$;

revoke all on function catalogue_internal.assert_offer_refresh_token(text)
  from public, anon, authenticated;

create or replace function public.catalogue_offer_refresh_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_targets jsonb;
begin
  perform catalogue_internal.assert_offer_refresh_token(p_token);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'offerId', o.id,
        'productId', p.id,
        'productName', p.display_name,
        'manufacturerName', mf.name,
        'model', p.model,
        'variant', p.variant,
        'manufacturerSku', p.manufacturer_sku,
        'merchantSku', o.merchant_sku,
        'merchantName', m.name,
        'productUrl', o.product_url,
        'currentPrice', o.price_amount,
        'currentStockStatus', o.stock_status,
        'currency', o.currency
      )
      order by m.name, p.display_name
    ),
    '[]'::jsonb
  )
  into v_targets
  from public.catalogue_offers o
  join public.catalogue_products p on p.id = o.product_id
  join public.catalogue_merchants m on m.id = o.merchant_id
  left join public.catalogue_manufacturers mf on mf.id = p.manufacturer_id
  where p.record_class = 'canonical'
    and p.identity_status = 'verified'
    and p.verification_status = 'verified'
    and p.selectable
    and o.verification_status = 'verified'
    and o.currency = 'EUR'
    and upper(trim(coalesce(o.region, ''))) = 'EU'
    and m.active
    and m.verification_status = 'verified';

  return v_targets;
end;
$$;

revoke all on function public.catalogue_offer_refresh_preview(text)
  from public, authenticated;
grant execute on function public.catalogue_offer_refresh_preview(text)
  to anon;

create or replace function public.catalogue_offer_refresh_begin(
  p_token text,
  p_local_date date,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_run_id uuid;
  v_existing_status text;
  v_targets jsonb;
  v_target_count integer;
begin
  perform catalogue_internal.assert_offer_refresh_token(p_token);

  if p_local_date is null then
    raise exception 'Local refresh date is required.';
  end if;

  select id, status
  into v_run_id, v_existing_status
  from public.catalogue_offer_refresh_runs
  where local_date = p_local_date;

  if v_run_id is not null and not p_force then
    return jsonb_build_object(
      'runId', v_run_id,
      'skip', true,
      'status', v_existing_status,
      'targets', '[]'::jsonb
    );
  end if;

  if v_run_id is null then
    insert into public.catalogue_offer_refresh_runs(local_date)
    values (p_local_date)
    returning id into v_run_id;
  else
    delete from public.catalogue_offer_refresh_checks
    where run_id = v_run_id;

    update public.catalogue_offer_refresh_runs
    set
      started_at = now(),
      finished_at = null,
      status = 'running',
      total_targets = 0,
      successful_checks = 0,
      failed_checks = 0,
      updated_offers = 0,
      error_message = null
    where id = v_run_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'offerId', o.id,
        'productId', p.id,
        'productName', p.display_name,
        'manufacturerName', mf.name,
        'model', p.model,
        'variant', p.variant,
        'manufacturerSku', p.manufacturer_sku,
        'merchantSku', o.merchant_sku,
        'merchantName', m.name,
        'productUrl', o.product_url,
        'currentPrice', o.price_amount,
        'currentStockStatus', o.stock_status,
        'currency', o.currency
      )
      order by m.name, p.display_name
    ),
    '[]'::jsonb
  ), count(*)::integer
  into v_targets, v_target_count
  from public.catalogue_offers o
  join public.catalogue_products p on p.id = o.product_id
  join public.catalogue_merchants m on m.id = o.merchant_id
  left join public.catalogue_manufacturers mf on mf.id = p.manufacturer_id
  where p.record_class = 'canonical'
    and p.identity_status = 'verified'
    and p.verification_status = 'verified'
    and p.selectable
    and o.verification_status = 'verified'
    and o.currency = 'EUR'
    and upper(trim(coalesce(o.region, ''))) = 'EU'
    and m.active
    and m.verification_status = 'verified';

  update public.catalogue_offer_refresh_runs
  set total_targets = v_target_count
  where id = v_run_id;

  return jsonb_build_object(
    'runId', v_run_id,
    'skip', false,
    'status', 'running',
    'targets', v_targets
  );
end;
$$;

revoke all on function public.catalogue_offer_refresh_begin(text,date,boolean)
  from public, authenticated;
grant execute on function public.catalogue_offer_refresh_begin(text,date,boolean)
  to anon;

create or replace function public.catalogue_offer_refresh_apply_batch(
  p_token text,
  p_run_id uuid,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_applied integer := 0;
  v_seen integer := 0;
begin
  perform catalogue_internal.assert_offer_refresh_token(p_token);

  if p_run_id is null then
    raise exception 'Refresh run id is required.';
  end if;

  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Refresh results must be a JSON array.';
  end if;

  if not exists (
    select 1
    from public.catalogue_offer_refresh_runs
    where id = p_run_id
      and status = 'running'
  ) then
    raise exception 'Refresh run is not active.';
  end if;

  with parsed as (
    select
      nullif(x->>'offerId','')::uuid as offer_id,
      coalesce((x->>'success')::boolean, false) as success,
      nullif(x->>'price','')::numeric as observed_price,
      nullif(x->>'currency','') as observed_currency,
      nullif(x->>'stockStatus','') as stock_status_text,
      nullif(x->>'parserSource','') as parser_source,
      nullif(x->>'responseStatus','')::integer as response_status,
      coalesce(nullif(x->>'checkedAt','')::timestamptz, now()) as checked_at,
      left(nullif(x->>'error',''), 1000) as error_message
    from jsonb_array_elements(p_results) x
  ),
  eligible as (
    select
      pa.*,
      o.product_id,
      o.product_url,
      o.price_amount as previous_price,
      o.stock_status as previous_stock_status,
      m.name as merchant_name,
      (
        pa.success
        and pa.observed_price is not null
        and pa.observed_price >= 0
        and pa.observed_currency = 'EUR'
        and pa.stock_status_text in ('in_stock','out_of_stock','preorder','backorder')
        and o.verification_status = 'verified'
        and o.currency = 'EUR'
        and upper(trim(coalesce(o.region,''))) = 'EU'
        and p.record_class = 'canonical'
        and p.identity_status = 'verified'
        and p.verification_status = 'verified'
        and p.selectable
      ) as can_apply
    from parsed pa
    join public.catalogue_offers o on o.id = pa.offer_id
    join public.catalogue_products p on p.id = o.product_id
    join public.catalogue_merchants m on m.id = o.merchant_id
  ),
  inserted as (
    insert into public.catalogue_offer_refresh_checks (
      run_id,
      offer_id,
      product_id,
      merchant_name,
      product_url,
      previous_price,
      observed_price,
      previous_stock_status,
      observed_stock_status,
      observed_currency,
      parser_source,
      response_status,
      success,
      applied,
      checked_at,
      error_message
    )
    select
      p_run_id,
      e.offer_id,
      e.product_id,
      e.merchant_name,
      e.product_url,
      e.previous_price,
      e.observed_price,
      e.previous_stock_status,
      case
        when e.stock_status_text in ('in_stock','out_of_stock','preorder','backorder')
          then e.stock_status_text::public.stock_status
        else null
      end,
      e.observed_currency,
      e.parser_source,
      e.response_status,
      e.success,
      e.can_apply,
      e.checked_at,
      case
        when e.can_apply then null
        else coalesce(
          e.error_message,
          'Observed offer data did not pass verification gates.'
        )
      end
    from eligible e
    on conflict (run_id, offer_id) do update set
      previous_price = excluded.previous_price,
      observed_price = excluded.observed_price,
      previous_stock_status = excluded.previous_stock_status,
      observed_stock_status = excluded.observed_stock_status,
      observed_currency = excluded.observed_currency,
      parser_source = excluded.parser_source,
      response_status = excluded.response_status,
      success = excluded.success,
      applied = excluded.applied,
      checked_at = excluded.checked_at,
      error_message = excluded.error_message
    returning offer_id, applied, observed_price, observed_stock_status, checked_at
  ),
  updated as (
    update public.catalogue_offers o
    set
      price_amount = i.observed_price,
      stock_status = i.observed_stock_status,
      last_checked_at = i.checked_at
    from inserted i
    where o.id = i.offer_id
      and i.applied
    returning o.id
  )
  select
    (select count(*) from inserted),
    (select count(*) from updated)
  into v_seen, v_applied;

  return jsonb_build_object(
    'runId', p_run_id,
    'receivedResults', v_seen,
    'appliedOffers', v_applied
  );
end;
$$;

revoke all on function public.catalogue_offer_refresh_apply_batch(text,uuid,jsonb)
  from public, authenticated;
grant execute on function public.catalogue_offer_refresh_apply_batch(text,uuid,jsonb)
  to anon;

create or replace function public.catalogue_offer_refresh_finish(
  p_token text,
  p_run_id uuid,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_total integer;
  v_success integer;
  v_failed integer;
  v_applied integer;
  v_status text;
begin
  perform catalogue_internal.assert_offer_refresh_token(p_token);

  select total_targets
  into v_total
  from public.catalogue_offer_refresh_runs
  where id = p_run_id;

  if not found then
    raise exception 'Refresh run does not exist.';
  end if;

  select
    count(*) filter (where success and applied),
    count(*) filter (where not success or not applied),
    count(*) filter (where applied)
  into v_success, v_failed, v_applied
  from public.catalogue_offer_refresh_checks
  where run_id = p_run_id;

  if p_error is not null then
    v_status := 'failed';
  elsif v_total = 0 then
    v_status := 'completed';
  elsif v_success = v_total and v_failed = 0 then
    v_status := 'completed';
  elsif v_success > 0 then
    v_status := 'partial';
  else
    v_status := 'failed';
  end if;

  update public.catalogue_offer_refresh_runs
  set
    finished_at = now(),
    status = v_status,
    successful_checks = v_success,
    failed_checks = v_failed,
    updated_offers = v_applied,
    error_message = left(p_error, 2000)
  where id = p_run_id;

  return jsonb_build_object(
    'runId', p_run_id,
    'status', v_status,
    'totalTargets', v_total,
    'successfulChecks', v_success,
    'failedChecks', v_failed,
    'updatedOffers', v_applied
  );
end;
$$;

revoke all on function public.catalogue_offer_refresh_finish(text,uuid,text)
  from public, authenticated;
grant execute on function public.catalogue_offer_refresh_finish(text,uuid,text)
  to anon;

create or replace function catalogue_internal.invoke_offer_refresh_if_berlin_midnight()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_local_date date;
  v_local_time text;
  v_request_id bigint;
begin
  v_local_date := (now() at time zone 'Europe/Berlin')::date;
  v_local_time := to_char(now() at time zone 'Europe/Berlin', 'HH24:MI');

  if v_local_time <> '00:00' then
    return null;
  end if;

  if exists (
    select 1
    from public.catalogue_offer_refresh_runs
    where local_date = v_local_date
  ) then
    return null;
  end if;

  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'catalogue_project_url'
    ) || '/functions/v1/catalogue-offer-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'catalogue_publishable_key'
      ),
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'catalogue_publishable_key'
      ),
      'x-catalogue-refresh-token', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'catalogue_offer_refresh_token'
      )
    ),
    body := '{"mode":"apply"}'::jsonb,
    timeout_milliseconds := 120000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function catalogue_internal.invoke_offer_refresh_if_berlin_midnight()
  from public, anon, authenticated;

select cron.schedule(
  'catalogue-offer-refresh-midnight-berlin',
  '0 22,23 * * *',
  'select catalogue_internal.invoke_offer_refresh_if_berlin_midnight();'
);
