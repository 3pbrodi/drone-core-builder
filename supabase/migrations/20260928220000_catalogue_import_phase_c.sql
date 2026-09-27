-- DroneCores catalogue Phase C: source-backed import lifecycle
-- Local migration only. Do not apply to a remote Supabase project without explicit approval.

create type public.catalogue_import_kind as enum (
  'products',
  'spec_evidence',
  'motor_propeller_evidence',
  'motor_esc_current_evidence',
  'fc_esc_connection_evidence'
);

alter table public.catalogue_import_batches
  add column import_kind public.catalogue_import_kind not null default 'products';

create index catalogue_import_batches_kind_status_idx
  on public.catalogue_import_batches (
    import_kind,
    status,
    created_at desc
  );

create table public.catalogue_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references public.catalogue_sources(id) on delete cascade,
  external_product_id text,
  source_url text not null check (length(trim(source_url)) > 0),
  content_hash text not null check (length(trim(content_hash)) > 0),
  retrieved_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index catalogue_source_snapshots_lookup_idx
  on public.catalogue_source_snapshots (
    source_id,
    external_product_id,
    retrieved_at desc
  );

create unique index catalogue_source_snapshots_content_unique
  on public.catalogue_source_snapshots (
    source_id,
    coalesce(external_product_id, ''),
    source_url,
    content_hash
  );

alter table public.catalogue_source_snapshots enable row level security;

revoke all on public.catalogue_source_snapshots from anon, authenticated;
grant select, insert, update, delete on public.catalogue_source_snapshots to service_role;
