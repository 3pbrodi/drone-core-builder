\set ON_ERROR_STOP on

-- Disposable/local staging bootstrap only.
-- Uses only official source definitions already encoded in the repository's
-- manufacturer-adapter migrations. No production data or secrets are copied.
begin;

insert into public.catalogue_sources (
  id,
  name,
  kind,
  base_url,
  verification_status
) values
  (md5('dronecores-local-staging-source:cnhl')::uuid, 'CNHL official', 'manufacturer', 'https://chinahobbyline.com', 'verified'),
  (md5('dronecores-local-staging-source:foxeer')::uuid, 'Foxeer official', 'manufacturer', 'https://www.foxeer.com', 'verified'),
  (md5('dronecores-local-staging-source:geprc')::uuid, 'GEPRC official', 'manufacturer', 'https://geprc.com', 'verified'),
  (md5('dronecores-local-staging-source:hqprop')::uuid, 'HQProp official', 'manufacturer', 'https://www.hqprop.com', 'verified'),
  (md5('dronecores-local-staging-source:iflight')::uuid, 'iFlight official', 'manufacturer', 'https://shop.iflight.com', 'verified'),
  (md5('dronecores-local-staging-source:radiomaster')::uuid, 'RadioMaster official', 'manufacturer', 'https://radiomasterrc.com', 'verified'),
  (md5('dronecores-local-staging-source:runcam')::uuid, 'RunCam official', 'manufacturer', 'https://shop.runcam.com', 'verified'),
  (md5('dronecores-local-staging-source:speedybee')::uuid, 'SpeedyBee official', 'manufacturer', 'https://www.speedybee.com', 'verified'),
  (md5('dronecores-local-staging-source:tattu')::uuid, 'Tattu official', 'manufacturer', 'https://www.genstattu.com', 'verified'),
  (md5('dronecores-local-staging-source:tbs')::uuid, 'Team BlackSheep official', 'manufacturer', 'https://www.team-blacksheep.com', 'verified')
on conflict do nothing;

update public.catalogue_sources s
set
  base_url = expected.base_url,
  verification_status = 'verified',
  updated_at = now()
from (
  values
    ('CNHL official', 'https://chinahobbyline.com'),
    ('Foxeer official', 'https://www.foxeer.com'),
    ('GEPRC official', 'https://geprc.com'),
    ('HQProp official', 'https://www.hqprop.com'),
    ('iFlight official', 'https://shop.iflight.com'),
    ('RadioMaster official', 'https://radiomasterrc.com'),
    ('RunCam official', 'https://shop.runcam.com'),
    ('SpeedyBee official', 'https://www.speedybee.com'),
    ('Tattu official', 'https://www.genstattu.com'),
    ('Team BlackSheep official', 'https://www.team-blacksheep.com')
) as expected(name, base_url)
where s.name = expected.name
  and s.kind = 'manufacturer';

\ir ../../supabase/migrations/20260929160351_catalogue_full_manufacturer_adapters.sql
\ir ../../supabase/migrations/20260929160753_catalogue_manufacturer_adapter_hardening.sql
\ir ../../supabase/migrations/20260929161034_catalogue_manufacturer_adapter_quality_filters.sql
\ir ../../supabase/migrations/20260929161113_catalogue_foxeer_url_identity_fallback.sql

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'catalogue-offer-refresh-midnight-berlin'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end
$$;

commit;
