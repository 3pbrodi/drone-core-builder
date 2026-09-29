-- DroneCores catalogue trigger hardening
-- Pin the trigger function search_path so object resolution cannot be influenced
-- by caller-controlled schemas.

alter function public.set_catalogue_updated_at()
  set search_path = pg_catalog;
