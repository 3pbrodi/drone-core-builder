-- DroneCores catalogue Phase B: evidence-aware verification
-- Local migration only. Do not apply to a remote Supabase project without explicit approval.

create type public.catalogue_evidence_authority as enum (
  'manufacturer',
  'official_documentation',
  'retailer',
  'community',
  'internal_demo'
);

create type public.catalogue_pair_result as enum (
  'compatible',
  'incompatible'
);

create type public.catalogue_current_rating_type as enum (
  'continuous',
  'burst',
  'peak'
);

alter table public.catalogue_products
  add column identity_status public.catalogue_verification_status not null default 'unverified',
  add column identity_verified_at timestamptz;

alter table public.catalogue_products
  add constraint catalogue_products_selectable_requires_verified_identity
  check (
    not selectable
    or (
      identity_status = 'verified'
      and verification_status = 'verified'
    )
  );

alter table public.catalogue_product_sources
  add column exact_model_association boolean not null default false,
  add column retrieved_at timestamptz;

create table public.catalogue_spec_evidence (
  id uuid primary key default gen_random_uuid(),
  product_id text not null
    references public.catalogue_products(id) on delete cascade,
  field_key text not null
    check (field_key ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,127}$'),
  value jsonb not null,
  unit text,
  value_semantics text,
  source_id uuid not null
    references public.catalogue_sources(id) on delete restrict,
  source_url text,
  authority public.catalogue_evidence_authority not null,
  exact_model_association boolean not null default false,
  verification_status public.catalogue_verification_status not null default 'unverified',
  retrieved_at timestamptz,
  verified_at timestamptz,
  conditions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(conditions) = 'object'),
  caveats text,
  conflict_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_spec_evidence_verified_requirements
    check (
      verification_status <> 'verified'
      or (
        exact_model_association = true
        and retrieved_at is not null
        and verified_at is not null
      )
    )
);

create index catalogue_spec_evidence_product_field_idx
  on public.catalogue_spec_evidence (product_id, field_key);

create index catalogue_spec_evidence_verification_idx
  on public.catalogue_spec_evidence (
    product_id,
    field_key,
    verification_status,
    authority
  );

create unique index catalogue_spec_evidence_source_unique
  on public.catalogue_spec_evidence (
    product_id,
    field_key,
    source_id,
    coalesce(source_url, '')
  );

create table public.catalogue_motor_propeller_evidence (
  id uuid primary key default gen_random_uuid(),
  motor_product_id text not null
    references public.catalogue_products(id) on delete cascade,
  propeller_product_id text not null
    references public.catalogue_products(id) on delete cascade,
  result public.catalogue_pair_result not null,
  source_id uuid not null
    references public.catalogue_sources(id) on delete restrict,
  authority public.catalogue_evidence_authority not null,
  exact_products_verified boolean not null default false,
  operating_conditions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(operating_conditions) = 'object'),
  verification_status public.catalogue_verification_status not null default 'unverified',
  retrieved_at timestamptz,
  verified_at timestamptz,
  caveats text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_motor_propeller_distinct_products
    check (motor_product_id <> propeller_product_id),
  constraint catalogue_motor_propeller_verified_requirements
    check (
      verification_status <> 'verified'
      or (
        exact_products_verified = true
        and authority in ('manufacturer', 'official_documentation')
        and retrieved_at is not null
        and verified_at is not null
        and operating_conditions <> '{}'::jsonb
      )
    )
);

create index catalogue_motor_propeller_pair_idx
  on public.catalogue_motor_propeller_evidence (
    motor_product_id,
    propeller_product_id,
    verification_status
  );

create table public.catalogue_motor_esc_current_evidence (
  id uuid primary key default gen_random_uuid(),
  motor_product_id text not null
    references public.catalogue_products(id) on delete cascade,
  esc_product_id text not null
    references public.catalogue_products(id) on delete cascade,
  motor_current_amps numeric(10, 3) not null
    check (motor_current_amps >= 0),
  motor_rating_type public.catalogue_current_rating_type not null,
  esc_current_amps numeric(10, 3) not null
    check (esc_current_amps >= 0),
  esc_rating_type public.catalogue_current_rating_type not null,
  motor_current_source_id uuid not null
    references public.catalogue_sources(id) on delete restrict,
  esc_current_source_id uuid not null
    references public.catalogue_sources(id) on delete restrict,
  operating_conditions_source_id uuid
    references public.catalogue_sources(id) on delete restrict,
  exact_products_verified boolean not null default false,
  rating_types_verified boolean not null default false,
  motor_operating_conditions_verified boolean not null default false,
  operating_conditions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(operating_conditions) = 'object'),
  verification_status public.catalogue_verification_status not null default 'unverified',
  retrieved_at timestamptz,
  verified_at timestamptz,
  caveats text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_motor_esc_current_distinct_products
    check (motor_product_id <> esc_product_id),
  constraint catalogue_motor_esc_current_verified_requirements
    check (
      verification_status <> 'verified'
      or (
        exact_products_verified = true
        and rating_types_verified = true
        and motor_operating_conditions_verified = true
        and motor_rating_type = 'continuous'
        and esc_rating_type = 'continuous'
        and operating_conditions_source_id is not null
        and retrieved_at is not null
        and verified_at is not null
        and operating_conditions <> '{}'::jsonb
      )
    )
);

create index catalogue_motor_esc_current_pair_idx
  on public.catalogue_motor_esc_current_evidence (
    motor_product_id,
    esc_product_id,
    verification_status
  );

create table public.catalogue_fc_esc_connection_evidence (
  id uuid primary key default gen_random_uuid(),
  flight_controller_product_id text not null
    references public.catalogue_products(id) on delete cascade,
  esc_product_id text not null
    references public.catalogue_products(id) on delete cascade,
  result public.catalogue_pair_result not null,
  source_id uuid not null
    references public.catalogue_sources(id) on delete restrict,
  authority public.catalogue_evidence_authority not null,
  exact_products_verified boolean not null default false,
  connector_family_verified boolean not null default false,
  pinout_verified boolean not null default false,
  wire_order_verified boolean not null default false,
  signal_compatibility_verified boolean not null default false,
  voltage_compatibility_verified boolean not null default false,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object'),
  verification_status public.catalogue_verification_status not null default 'unverified',
  retrieved_at timestamptz,
  verified_at timestamptz,
  caveats text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_fc_esc_connection_distinct_products
    check (flight_controller_product_id <> esc_product_id),
  constraint catalogue_fc_esc_connection_verified_requirements
    check (
      verification_status <> 'verified'
      or (
        exact_products_verified = true
        and connector_family_verified = true
        and pinout_verified = true
        and wire_order_verified = true
        and signal_compatibility_verified = true
        and voltage_compatibility_verified = true
        and authority in ('manufacturer', 'official_documentation')
        and retrieved_at is not null
        and verified_at is not null
      )
    )
);

create index catalogue_fc_esc_connection_pair_idx
  on public.catalogue_fc_esc_connection_evidence (
    flight_controller_product_id,
    esc_product_id,
    verification_status
  );

create trigger catalogue_spec_evidence_updated_at
before update on public.catalogue_spec_evidence
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_motor_propeller_evidence_updated_at
before update on public.catalogue_motor_propeller_evidence
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_motor_esc_current_evidence_updated_at
before update on public.catalogue_motor_esc_current_evidence
for each row execute function public.set_catalogue_updated_at();

create trigger catalogue_fc_esc_connection_evidence_updated_at
before update on public.catalogue_fc_esc_connection_evidence
for each row execute function public.set_catalogue_updated_at();

alter table public.catalogue_spec_evidence enable row level security;
alter table public.catalogue_motor_propeller_evidence enable row level security;
alter table public.catalogue_motor_esc_current_evidence enable row level security;
alter table public.catalogue_fc_esc_connection_evidence enable row level security;

revoke all on public.catalogue_spec_evidence from anon, authenticated;
revoke all on public.catalogue_motor_propeller_evidence from anon, authenticated;
revoke all on public.catalogue_motor_esc_current_evidence from anon, authenticated;
revoke all on public.catalogue_fc_esc_connection_evidence from anon, authenticated;

grant select, insert, update, delete on public.catalogue_spec_evidence to service_role;
grant select, insert, update, delete on public.catalogue_motor_propeller_evidence to service_role;
grant select, insert, update, delete on public.catalogue_motor_esc_current_evidence to service_role;
grant select, insert, update, delete on public.catalogue_fc_esc_connection_evidence to service_role;

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
  e.retrieved_at,
  e.verified_at,
  e.conditions,
  e.caveats
from public.catalogue_spec_evidence e
join public.catalogue_products p
  on p.id = e.product_id
where e.verification_status = 'verified'
  and e.exact_model_association = true
  and p.identity_status = 'verified';

revoke all on public.catalogue_verified_spec_evidence from anon, authenticated;
grant select on public.catalogue_verified_spec_evidence to service_role;
