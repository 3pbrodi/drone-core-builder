-- DroneCores evidence-first catalogue foundation
-- Local migration only. Do not apply to a remote Supabase project without explicit approval.
--
-- This migration separates temporary demo/seed data from canonical catalogue data,
-- persists the Phase A quality-review states, strengthens the promotion gate, and
-- makes the future runtime offer policy explicitly EU/EUR.

create type public.catalogue_record_class as enum (
  'demo_seed',
  'candidate',
  'canonical'
);

create type public.catalogue_quality_status as enum (
  'unverified',
  'partially_verified',
  'verified',
  'conflicting'
);

create type public.catalogue_product_kind as enum (
  'standalone',
  'bundle',
  'unknown'
);

create type public.catalogue_price_data_status as enum (
  'illustrative',
  'market_offer_backed'
);

alter table public.catalogue_products
  add column record_class public.catalogue_record_class not null default 'canonical';

alter table public.catalogue_products
  drop constraint catalogue_products_selectable_requires_verified_identity;

alter table public.catalogue_products
  add constraint catalogue_products_selectable_requires_canonical_identity
  check (
    not selectable
    or (
      record_class = 'canonical'
      and manufacturer_id is not null
      and identity_status = 'verified'
      and identity_verified_at is not null
      and verification_status = 'verified'
    )
  );

create index catalogue_products_record_class_idx
  on public.catalogue_products (
    record_class,
    selectable,
    verification_status
  );

create table public.catalogue_product_quality_reviews (
  product_id text primary key
    references public.catalogue_products(id) on delete cascade,
  identity_quality_status public.catalogue_quality_status not null,
  technical_quality_status public.catalogue_quality_status not null,
  product_kind public.catalogue_product_kind not null default 'unknown',
  manufacturer_label text,
  exact_model_label text,
  variant_label text,
  price_status public.catalogue_price_data_status not null default 'illustrative',
  illustrative_price_amount numeric(12, 2)
    check (
      illustrative_price_amount is null
      or illustrative_price_amount >= 0
    ),
  illustrative_price_currency text
    check (
      illustrative_price_currency is null
      or illustrative_price_currency ~ '^[A-Z]{3}$'
    ),
  human_review_required boolean not null default true,
  issues jsonb not null default '[]'::jsonb
    check (jsonb_typeof(issues) = 'array'),
  remediation jsonb not null default '[]'::jsonb
    check (jsonb_typeof(remediation) = 'array'),
  review_dataset text not null
    check (length(trim(review_dataset)) > 0),
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_product_quality_verified_identity_labels
    check (
      identity_quality_status <> 'verified'
      or (
        manufacturer_label is not null
        and length(trim(manufacturer_label)) > 0
        and exact_model_label is not null
        and length(trim(exact_model_label)) > 0
      )
    ),
  constraint catalogue_product_quality_illustrative_price
    check (
      price_status <> 'illustrative'
      or (
        illustrative_price_amount is not null
        and illustrative_price_currency is not null
      )
    )
);

create index catalogue_product_quality_review_queue_idx
  on public.catalogue_product_quality_reviews (
    human_review_required,
    identity_quality_status,
    technical_quality_status
  );

create trigger catalogue_product_quality_reviews_updated_at
before update on public.catalogue_product_quality_reviews
for each row execute function public.set_catalogue_updated_at();

alter table public.catalogue_product_quality_reviews enable row level security;

revoke all on public.catalogue_product_quality_reviews from anon, authenticated;
grant select, insert, update, delete
  on public.catalogue_product_quality_reviews
  to service_role;

create or replace view public.catalogue_product_review_queue
with (security_invoker = true)
as
select
  p.id,
  p.category,
  p.display_name,
  p.record_class,
  p.identity_status,
  p.verification_status,
  p.selectable,
  q.identity_quality_status,
  q.technical_quality_status,
  q.product_kind,
  q.manufacturer_label,
  q.exact_model_label,
  q.variant_label,
  q.price_status,
  q.illustrative_price_amount,
  q.illustrative_price_currency,
  q.human_review_required,
  q.issues,
  q.remediation,
  q.review_dataset,
  q.reviewed_at
from public.catalogue_products p
join public.catalogue_product_quality_reviews q
  on q.product_id = p.id
where
  p.record_class in ('demo_seed', 'candidate')
  or q.human_review_required = true
  or q.identity_quality_status <> 'verified'
  or q.technical_quality_status in ('unverified', 'conflicting');

revoke all on public.catalogue_product_review_queue from anon, authenticated;
grant select on public.catalogue_product_review_queue to service_role;

-- Verified field evidence is production-facing only after the product itself has
-- been promoted from a demo seed into the canonical catalogue.
drop view public.catalogue_verified_spec_evidence;

create view public.catalogue_verified_spec_evidence
with (security_invoker = true)
as
select
  e.id,
  e.product_id,
  e.field_key,
  e.value,
  e.unit,
  e.value_semantics,
  e.source_id,
  e.source_url,
  e.authority,
  e.exact_model_association,
  e.verification_status,
  e.retrieved_at,
  e.verified_at,
  e.conditions,
  e.caveats
from public.catalogue_spec_evidence e
join public.catalogue_products p
  on p.id = e.product_id
where e.verification_status = 'verified'
  and e.exact_model_association = true
  and p.record_class = 'canonical'
  and p.identity_status = 'verified';

revoke all on public.catalogue_verified_spec_evidence from anon, authenticated;
grant select on public.catalogue_verified_spec_evidence to service_role;

-- The future database-backed configurator is deliberately EU/EUR only.
-- No demo price is exposed here; prices must come from verified merchant offers.
create or replace view public.catalogue_runtime_products
with (security_invoker = true)
as
select
  p.id,
  p.category,
  p.display_name,
  p.spec_summary,
  p.weight_grams,
  m.name as manufacturer_name,
  p.model,
  p.variant,
  p.mpn,
  p.manufacturer_sku,

  s.frame_size_inches,
  s.motor_mount_pattern,
  s.propeller_diameter_inches,
  s.motor_size_code,
  s.min_battery_cells,
  s.max_battery_cells,
  s.connector,
  s.esc_input,
  s.thrust_grams,
  s.peak_current_amps,
  s.esc_amps,
  s.battery_cells,
  s.battery_capacity_mah,
  s.video_system,

  img.image_url,
  img.alt_text as image_alt,
  img.source_url as image_source_url,

  offer.price_amount,
  offer.currency,
  offer.stock_status,
  offer.product_url as offer_url,
  offer.last_checked_at,

  s.camera_video_interface,
  s.camera_min_voltage_v,
  s.camera_max_voltage_v,
  s.camera_width_mm,
  s.camera_height_mm,
  s.camera_depth_mm,
  s.fc_camera_video_interfaces,
  s.fc_camera_power_voltages_v,
  s.receiver_protocol,
  s.receiver_frequency_min_mhz,
  s.receiver_frequency_max_mhz,
  s.receiver_min_voltage_v,
  s.receiver_max_voltage_v,
  s.receiver_signal_interface,
  s.receiver_width_mm,
  s.receiver_height_mm,
  s.receiver_depth_mm,
  s.fc_receiver_signal_interfaces,
  s.fc_receiver_power_voltages_v,

  s.motor_stator_width_mm,
  s.motor_stator_height_mm,
  s.motor_kv,
  s.battery_discharge_c,
  offer.region as offer_region,
  p.record_class
from public.catalogue_products p
left join public.catalogue_manufacturers m
  on m.id = p.manufacturer_id
left join public.catalogue_product_specs s
  on s.product_id = p.id
left join lateral (
  select
    i.image_url,
    i.alt_text,
    i.source_url
  from public.catalogue_product_images i
  where i.product_id = p.id
    and i.exact_model_verified = true
    and i.verification_status = 'verified'
  order by i.primary_image desc, i.updated_at desc
  limit 1
) img on true
left join lateral (
  select
    o.price_amount,
    o.currency,
    o.stock_status,
    o.product_url,
    o.last_checked_at,
    o.region
  from public.catalogue_offers o
  where o.product_id = p.id
    and o.verification_status = 'verified'
    and o.currency = 'EUR'
    and upper(trim(coalesce(o.region, ''))) = 'EU'
  order by
    case o.stock_status
      when 'in_stock' then 0
      when 'preorder' then 1
      when 'backorder' then 2
      when 'unknown' then 3
      else 4
    end,
    o.last_checked_at desc nulls last,
    o.price_amount asc nulls last
  limit 1
) offer on true
where p.record_class = 'canonical'
  and p.selectable = true
  and p.identity_status = 'verified'
  and p.verification_status = 'verified'
  and p.lifecycle_status <> 'discontinued';

revoke all on public.catalogue_runtime_products from anon, authenticated;
grant select on public.catalogue_runtime_products to service_role;
