\set ON_ERROR_STOP on
set role service_role;
with claimed as materialized (
 select public.catalogue_claim_import_run_items(
   :'run_id'::uuid,:chunk,3,false
 ) payload
), extracted as (
 select item
 from claimed, lateral jsonb_array_elements(payload->'items') item
), results as (
 select coalesce(jsonb_agg(
    jsonb_build_object('upstreamItemId',i.upstream_item_id,'outcome','ready',
      'sourceUrl',i.source_url,'normalizedData',i.normalized_data,
      'errors','[]'::jsonb,'rawData',jsonb_build_object('synthetic',true)
    ) order by i.discovery_ordinal
 ),'[]'::jsonb) as batch
 from extracted c
 join public.catalogue_import_run_items i on i.id=(c.item->>'id')::bigint
)
select (public.catalogue_stage_import_run_chunk(
 :'run_id'::uuid,:'chunk_key',batch))->>'batchId'
from results;
