-- DroneCores catalogue Phase 2
-- Local migration only. Do not apply to a remote Supabase project without explicit approval.

create extension if not exists pgcrypto;

create type public.drone_product_category as enum (
  'frame',
  'motors',
  'flightController',
  'esc',
  'propellers',
  'battery',
  'camera',
  'receiver'
);

create type public.catalogue_verification_status as enum (
  'unverified',
  'pending_review',
  'verified',
  'rejected'
);

create type public.product_lifecycle_status as enum (
  'unknown',
  'announced',
  'active',
  'discontinued'
);

create type public.stock_status as enum (
  'unknown',
  'in_stock',
  'out_of_stock',
  'preorder',
  'backorder'
);

create type public.catalogue_source_kind as enum (
  'manual',
  'csv',
  'xml',
  'api',
  'shopify',
  'manufacturer',
  'retailer'
);

create type public.catalogue_import_batch_status as enum (
  'staged',
  'validated',
  'needs_review',
  'approved',
  'rejected',
  'imported'
);

create type public.catalogue_import_row_status as enum (
  'staged',
  'validated',
  'needs_review',
  'rejected',
  'imported'
);

create table public.catalogue_manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  website_url text,
  verification_status public.catalogue_verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index catalogue_manufacturers_name_unique
  on public.catalogue_manufacturers (lower(name));

create table public.catalogue_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  kind public.catalogue_source_kind not null,
  base_url text,
  license_name text,
  license_url text,
  terms_url text,
  verification_status public.catalogue_verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index catalogue_sources_name_kind_unique
  on public.catalogue_sources (lower(name), kind);

create table public.catalogue_products (
  id text primary key
    check (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  manufacturer_id uuid references public.catalogue_manufacturers(id) on delete set null,
  model text not null check (length(trim(model)) > 0),
  variant text,
  display_name text not null check (length(trim(display_name)) > 0),
  category public.drone_product_category not null,
  mpn text,
  manufacturer_sku text,
  spec_summary text,
  weight_grams numeric(10, 2) check (weight_grams is null or weight_grams >= 0),
  lifecycle_status public.product_lifecycle_status not null default 'unknown',
  verification_status public.catalogue_verification_status not null default 'unverified',
  selectable boolean not null default false,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalogue_products_category_idx
  on public.catalogue_products (category);

create index catalogue_products_selectable_idx
  on public.catalogue_products (selectable, verification_status, lifecycle_status);

create index catalogue_products_manufacturer_idx
  on public.catalogue_products (manufacturer_id);

create unique index catalogue_products_manufacturer_model_variant_unique
  on public.catalogue_products (
    manufacturer_id,
    lower(model),
    lower(coalesce(variant, ''))
  )
  where manufacturer_id is not null;

create table public.catalogue_product_specs (
  product_id text primary key
    references public.catalogue_products(id) on delete cascade,

  frame_size_inches numeric(5, 2)
    check (frame_size_inches is null or frame_size_inches > 0),
  motor_mount_pattern text,

  propeller_diameter_inches numeric(5, 2)
    check (propeller_diameter_inches is null or propeller_diameter_inches > 0),

  motor_size_code integer
    check (motor_size_code is null or motor_size_code > 0),
  motor_stator_width_mm numeric(6, 2)
    check (motor_stator_width_mm is null or motor_stator_width_mm > 0),
  motor_stator_height_mm numeric(6, 2)
    check (motor_stator_height_mm is null or motor_stator_height_mm > 0),
  motor_kv integer
    check (motor_kv is null or motor_kv > 0),

  min_battery_cells smallint
    check (min_battery_cells is null or min_battery_cells > 0),
  max_battery_cells smallint
    check (max_battery_cells is null or max_battery_cells > 0),

  connector text,
  esc_input text,

  thrust_grams numeric(10, 2)
    check (thrust_grams is null or thrust_grams >= 0),
  peak_current_amps numeric(10, 2)
    check (peak_current_amps is null or peak_current_amps >= 0),
  esc_amps numeric(10, 2)
    check (esc_amps is null or esc_amps >= 0),

  battery_cells smallint
    check (battery_cells is null or battery_cells > 0),
  battery_capacity_mah integer
    check (battery_capacity_mah is null or battery_capacity_mah > 0),
  battery_discharge_c numeric(8, 2)
    check (battery_discharge_c is null or battery_discharge_c > 0),

  video_system text,
  receiver_protocol text,

  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  updated_at timestamptz not null default now(),

  constraint catalogue_product_specs_battery_range_check
    check (
      min_battery_cells is null
      or max_battery_cells is null
      or min_battery_cells <= max_battery_cells
    )
);

create table public.catalogue_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null
    references public.catalogue_products(id) on delete cascade,
  image_url text not null check (length(trim(image_url)) > 0),
  source_url text,
  alt_text text,
  exact_model_verified boolean not null default false,
  verification_status public.catalogue_verification_status not null default 'unverified',
  provenance text,
  primary_image boolean not null default false,
  license_name text,
  license_url text,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalogue_product_images_product_idx
  on public.catalogue_product_images (product_id);

create unique index catalogue_product_images_one_primary_idx
  on public.catalogue_product_images (product_id)
  where primary_image;

create table public.catalogue_merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  website_url text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  active boolean not null default true,
  verification_status public.catalogue_verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index catalogue_merchants_name_unique
  on public.catalogue_merchants (lower(name));

create table public.catalogue_offers (
  id uuid primary key default gen_random_uuid(),
  product_id text not null
    references public.catalogue_products(id) on delete cascade,
  merchant_id uuid not null
    references public.catalogue_merchants(id) on delete cascade,
  merchant_sku text,
  product_url text not null check (length(trim(product_url)) > 0),
  price_amount numeric(12, 2)
    check (price_amount is null or price_amount >= 0),
  currency text
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  stock_status public.stock_status not null default 'unknown',
  region text,
  verification_status public.catalogue_verification_status not null default 'unverified',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalogue_offers_product_idx
  on public.catalogue_offers (product_id);

create index catalogue_offers_stock_price_idx
  on public.catalogue_offers (product_id, stock_status, price_amount);

create unique index catalogue_offers_merchant_url_unique
  on public.catalogue_offers (merchant_id, product_url);

create table public.catalogue_product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id text not null
    references public.catalogue_products(id) on delete cascade,
  source_id uuid not null
    references public.catalogue_sources(id) on delete cascade,
  external_product_id text not null check (length(trim(external_product_id)) > 0),
  source_url text,
  imported_at timestamptz not null default now(),
  verification_status public.catalogue_verification_status not null default 'unverified',
  raw_hash text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create unique index catalogue_product_sources_external_unique
  on public.catalogue_product_sources (source_id, external_product_id);

create index catalogue_product_sources_product_idx
  on public.catalogue_product_sources (product_id);

create table public.catalogue_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.catalogue_sources(id) on delete set null,
  file_name text,
  status public.catalogue_import_batch_status not null default 'staged',
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index catalogue_import_batches_status_idx
  on public.catalogue_import_batches (status, created_at desc);

create table public.catalogue_import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null
    references public.catalogue_import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  proposed_product_id text,
  raw_data jsonb not null check (jsonb_typeof(raw_data) = 'object'),
  normalized_data jsonb check (normalized_data is null or jsonb_typeof(normalized_data) = 'object'),
  status public.catalogue_import_row_status not null default 'staged',
  validation_errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(validation_errors) = 'array'),
  duplicate_product_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index catalogue_import_rows_status_idx
  on public.catalogue_import_rows (batch_id, status);

create index catalogue_import_rows_product_idx
  on public.catalogue_import_rows (proposed_product_id);

create or replace function public.set_catalogue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger catalogue_manufacturers_updated_at
before update on public.catalogue_manufacturers
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_sources_updated_at
before update on public.catalogue_sources
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_products_updated_at
before update on public.catalogue_products
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_product_specs_updated_at
before update on public.catalogue_product_specs
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_product_images_updated_at
before update on public.catalogue_product_images
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_merchants_updated_at
before update on public.catalogue_merchants
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_offers_updated_at
before update on public.catalogue_offers
for each row execute function public.set_catalogue_updated_at();

create view public.catalogue_runtime_products
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
  offer.last_checked_at
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
    o.last_checked_at
  from public.catalogue_offers o
  where o.product_id = p.id
    and o.verification_status = 'verified'
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
where p.selectable = true
  and p.verification_status = 'verified'
  and p.lifecycle_status <> 'discontinued';

alter table public.catalogue_manufacturers enable row level security;
alter table public.catalogue_sources enable row level security;
alter table public.catalogue_products enable row level security;
alter table public.catalogue_product_specs enable row level security;
alter table public.catalogue_product_images enable row level security;
alter table public.catalogue_merchants enable row level security;
alter table public.catalogue_offers enable row level security;
alter table public.catalogue_product_sources enable row level security;
alter table public.catalogue_import_batches enable row level security;
alter table public.catalogue_import_rows enable row level security;

revoke all on public.catalogue_manufacturers from anon, authenticated;
revoke all on public.catalogue_sources from anon, authenticated;
revoke all on public.catalogue_products from anon, authenticated;
revoke all on public.catalogue_product_specs from anon, authenticated;
revoke all on public.catalogue_product_images from anon, authenticated;
revoke all on public.catalogue_merchants from anon, authenticated;
revoke all on public.catalogue_offers from anon, authenticated;
revoke all on public.catalogue_product_sources from anon, authenticated;
revoke all on public.catalogue_import_batches from anon, authenticated;
revoke all on public.catalogue_import_rows from anon, authenticated;
revoke all on public.catalogue_runtime_products from anon, authenticated;

grant select, insert, update, delete on public.catalogue_manufacturers to service_role;
grant select, insert, update, delete on public.catalogue_sources to service_role;
grant select, insert, update, delete on public.catalogue_products to service_role;
grant select, insert, update, delete on public.catalogue_product_specs to service_role;
grant select, insert, update, delete on public.catalogue_product_images to service_role;
grant select, insert, update, delete on public.catalogue_merchants to service_role;
grant select, insert, update, delete on public.catalogue_offers to service_role;
grant select, insert, update, delete on public.catalogue_product_sources to service_role;
grant select, insert, update, delete on public.catalogue_import_batches to service_role;
grant select, insert, update, delete on public.catalogue_import_rows to service_role;
grant select on public.catalogue_runtime_products to service_role;
grant usage, select on sequence public.catalogue_import_rows_id_seq to service_role;
