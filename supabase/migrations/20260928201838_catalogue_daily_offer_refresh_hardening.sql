-- Harden the nightly refresh after the initial migration.
-- Privileged writes now happen only inside the server-side Edge Function using
-- Supabase's automatically provisioned secret key. No SECURITY DEFINER refresh
-- RPC remains callable through the public Data API.

drop function if exists public.catalogue_offer_refresh_preview(text);
drop function if exists public.catalogue_offer_refresh_begin(text,date,boolean);
drop function if exists public.catalogue_offer_refresh_apply_batch(text,uuid,jsonb);
drop function if exists public.catalogue_offer_refresh_finish(text,uuid,text);
drop function if exists catalogue_internal.assert_offer_refresh_token(text);

create index if not exists catalogue_offer_refresh_checks_product_idx
  on public.catalogue_offer_refresh_checks(product_id);

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
