-- DroneCores catalogue review / promotion workflow
-- Local migration only. Do not apply to a remote Supabase project without explicit approval.

create type public.catalogue_promotion_action as enum (
  'candidate_created',
  'identity_promoted',
  'publication_enabled',
  'publication_disabled'
);

create table public.catalogue_identity_evidence (
  id uuid primary key default gen_random_uuid(),
  product_id text not null
    references public.catalogue_products(id) on delete cascade,
  source_id uuid not null
    references public.catalogue_sources(id) on delete restrict,
  source_url text not null check (length(trim(source_url)) > 0),
  authority public.catalogue_evidence_authority not null,
  manufacturer_label text not null check (length(trim(manufacturer_label)) > 0),
  model_label text not null check (length(trim(model_label)) > 0),
  variant_label text,
  exact_model_association boolean not null default false,
  verification_status public.catalogue_verification_status not null default 'pending_review',
  retrieved_at timestamptz,
  verified_at timestamptz,
  caveats text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogue_identity_evidence_verified_requirements
    check (
      verification_status <> 'verified'
      or (
        exact_model_association = true
        and authority in ('manufacturer', 'official_documentation')
        and retrieved_at is not null
        and verified_at is not null
      )
    )
);

create unique index catalogue_identity_evidence_source_unique
  on public.catalogue_identity_evidence (
    product_id,
    source_id,
    source_url
  );

create index catalogue_identity_evidence_review_idx
  on public.catalogue_identity_evidence (
    product_id,
    verification_status,
    exact_model_association
  );

create trigger catalogue_identity_evidence_updated_at
before update on public.catalogue_identity_evidence
for each row execute function public.set_catalogue_updated_at();

create table public.catalogue_category_field_requirements (
  category public.drone_product_category not null,
  field_key text not null
    check (field_key ~ '^[A-Za-z][A-Za-z0-9_.:-]{0,127}$'),
  explanation text not null check (length(trim(explanation)) > 0),
  primary key (category, field_key)
);

insert into public.catalogue_category_field_requirements (
  category,
  field_key,
  explanation
) values
  ('frame', 'frameInches', 'Nominal frame size used by the current propeller-clearance rule.'),
  ('frame', 'mount', 'Motor mounting pattern used by the current frame/motor rule.'),

  ('motors', 'mount', 'Motor mounting pattern used by the current frame/motor rule.'),
  ('motors', 'motorSize', 'Motor size retained for non-authoritative motor/propeller guidance.'),
  ('motors', 'minVoltage', 'Minimum supported battery cell count.'),
  ('motors', 'maxVoltage', 'Maximum supported battery cell count.'),

  ('flightController', 'minVoltage', 'Minimum supported battery cell count.'),
  ('flightController', 'maxVoltage', 'Maximum supported battery cell count.'),
  ('flightController', 'connector', 'FC-side connector family/name used as advisory information.'),
  ('flightController', 'fcCameraVideoInterfaces', 'Camera video interfaces explicitly supported by the FC.'),
  ('flightController', 'fcCameraPowerVoltagesV', 'FC power rails available to the camera.'),
  ('flightController', 'fcReceiverSignalInterfaces', 'Receiver signal interfaces explicitly supported by the FC.'),
  ('flightController', 'fcReceiverPowerVoltagesV', 'FC power rails available to the receiver.'),

  ('esc', 'minVoltage', 'Minimum supported battery cell count.'),
  ('esc', 'maxVoltage', 'Maximum supported battery cell count.'),
  ('esc', 'escInput', 'ESC-side connector family/name used as advisory information.'),
  ('esc', 'escAmps', 'ESC current value; rating semantics still require pair evidence for verified motor-current comparison.'),

  ('propellers', 'propInches', 'Propeller diameter used by the current frame-clearance and motor-size guidance rules.'),

  ('battery', 'voltage', 'Battery cell count used by the current voltage-range rules.'),
  ('battery', 'batteryMah', 'Battery capacity retained as a core canonical catalogue field.'),

  ('camera', 'cameraVideoInterface', 'Camera video interface used by the current FC/camera rule.'),
  ('camera', 'cameraMinVoltageV', 'Minimum camera supply voltage.'),
  ('camera', 'cameraMaxVoltageV', 'Maximum camera supply voltage.'),

  ('receiver', 'receiverProtocol', 'Receiver protocol retained as a core canonical identity/spec field.'),
  ('receiver', 'receiverSignalInterface', 'Receiver signal interface used by the current FC/receiver rule.'),
  ('receiver', 'receiverFrequencyMinMhz', 'Minimum supported receiver frequency.'),
  ('receiver', 'receiverFrequencyMaxMhz', 'Maximum supported receiver frequency.'),
  ('receiver', 'receiverMinVoltageV', 'Minimum receiver supply voltage.'),
  ('receiver', 'receiverMaxVoltageV', 'Maximum receiver supply voltage.');

create table public.catalogue_promotion_events (
  id bigint generated always as identity primary key,
  product_id text not null
    references public.catalogue_products(id) on delete cascade,
  action public.catalogue_promotion_action not null,
  reviewer text not null check (length(trim(reviewer)) > 0),
  notes text,
  blockers_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(blockers_snapshot) = 'array'),
  created_at timestamptz not null default now()
);

create index catalogue_promotion_events_product_idx
  on public.catalogue_promotion_events (
    product_id,
    created_at desc
  );

alter table public.catalogue_identity_evidence enable row level security;
alter table public.catalogue_category_field_requirements enable row level security;
alter table public.catalogue_promotion_events enable row level security;

revoke all on public.catalogue_identity_evidence from anon, authenticated;
revoke all on public.catalogue_category_field_requirements from anon, authenticated;
revoke all on public.catalogue_promotion_events from anon, authenticated;

grant select, insert, update, delete on public.catalogue_identity_evidence to service_role;
grant select on public.catalogue_category_field_requirements to service_role;
grant select, insert on public.catalogue_promotion_events to service_role;
grant usage, select on sequence public.catalogue_promotion_events_id_seq to service_role;

create or replace function public.catalogue_identity_promotion_blockers(
  p_product_id text
)
returns text[]
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  blockers text[] := array[]::text[];
  product_record public.catalogue_products%rowtype;
  quality_record public.catalogue_product_quality_reviews%rowtype;
  manufacturer_name text;
begin
  select *
  into product_record
  from public.catalogue_products
  where id = p_product_id;

  if not found then
    return array['Product does not exist.'];
  end if;

  if product_record.record_class = 'canonical'
     and product_record.identity_status = 'verified'
     and product_record.identity_verified_at is not null then
    return blockers;
  end if;

  select *
  into quality_record
  from public.catalogue_product_quality_reviews
  where product_id = p_product_id;

  if not found then
    blockers := array_append(blockers, 'Phase A quality review is missing.');
    return blockers;
  end if;

  if quality_record.identity_quality_status <> 'verified' then
    blockers := array_append(
      blockers,
      'Identity quality must be verified before canonical promotion.'
    );
  end if;

  if quality_record.manufacturer_label is null
     or length(trim(quality_record.manufacturer_label)) = 0 then
    blockers := array_append(blockers, 'Reviewed manufacturer identity is missing.');
  end if;

  if quality_record.exact_model_label is null
     or length(trim(quality_record.exact_model_label)) = 0 then
    blockers := array_append(blockers, 'Reviewed exact model identity is missing.');
  end if;

  if product_record.manufacturer_id is null then
    blockers := array_append(blockers, 'Canonical manufacturer link is missing.');
  else
    select name
    into manufacturer_name
    from public.catalogue_manufacturers
    where id = product_record.manufacturer_id
      and verification_status = 'verified';

    if manufacturer_name is null then
      blockers := array_append(blockers, 'Linked manufacturer is not verified.');
    elsif quality_record.manufacturer_label is not null
      and lower(trim(manufacturer_name)) <> lower(trim(quality_record.manufacturer_label)) then
      blockers := array_append(
        blockers,
        'Reviewed manufacturer does not match the linked canonical manufacturer.'
      );
    end if;
  end if;

  if quality_record.manufacturer_label is not null
     and quality_record.exact_model_label is not null
     and not exists (
       select 1
       from public.catalogue_identity_evidence e
       where e.product_id = p_product_id
         and e.verification_status = 'verified'
         and e.exact_model_association = true
         and e.authority in ('manufacturer', 'official_documentation')
         and e.retrieved_at is not null
         and e.verified_at is not null
         and lower(trim(e.manufacturer_label)) =
           lower(trim(quality_record.manufacturer_label))
         and lower(trim(e.model_label)) =
           lower(trim(quality_record.exact_model_label))
         and lower(trim(coalesce(e.variant_label, ''))) =
           lower(trim(coalesce(quality_record.variant_label, '')))
     ) then
    blockers := array_append(
      blockers,
      'Verified exact-model manufacturer/official identity evidence is missing.'
    );
  end if;

  return blockers;
end;
$$;

create or replace function public.catalogue_publication_blockers(
  p_product_id text
)
returns text[]
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  blockers text[] := array[]::text[];
  product_record public.catalogue_products%rowtype;
  quality_record public.catalogue_product_quality_reviews%rowtype;
  requirement record;
begin
  select *
  into product_record
  from public.catalogue_products
  where id = p_product_id;

  if not found then
    return array['Product does not exist.'];
  end if;

  if product_record.record_class <> 'canonical'
     or product_record.identity_status <> 'verified'
     or product_record.identity_verified_at is null then
    blockers := array_append(
      blockers,
      'Product identity has not been promoted to a verified canonical identity.'
    );
  end if;

  select *
  into quality_record
  from public.catalogue_product_quality_reviews
  where product_id = p_product_id;

  if not found then
    blockers := array_append(blockers, 'Phase A quality review is missing.');
    return blockers;
  end if;

  if quality_record.identity_quality_status <> 'verified' then
    blockers := array_append(blockers, 'Identity quality review is not verified.');
  end if;

  if quality_record.technical_quality_status in ('unverified', 'conflicting') then
    blockers := array_append(
      blockers,
      'Technical quality still contains unresolved or unverified catalogue data.'
    );
  end if;

  if quality_record.human_review_required then
    blockers := array_append(blockers, 'Human review is still required.');
  end if;

  for requirement in
    select field_key, explanation
    from public.catalogue_category_field_requirements
    where category = product_record.category
    order by field_key
  loop
    if not exists (
      select 1
      from public.catalogue_verified_spec_evidence e
      where e.product_id = p_product_id
        and e.field_key = requirement.field_key
    ) then
      blockers := array_append(
        blockers,
        format(
          'Missing verified field evidence for %s: %s',
          requirement.field_key,
          requirement.explanation
        )
      );
    end if;
  end loop;

  if not exists (
    select 1
    from public.catalogue_offers o
    where o.product_id = p_product_id
      and o.verification_status = 'verified'
      and o.currency = 'EUR'
      and upper(trim(coalesce(o.region, ''))) = 'EU'
      and o.last_checked_at is not null
  ) then
    blockers := array_append(
      blockers,
      'At least one verified EU/EUR merchant offer with a check timestamp is required.'
    );
  end if;

  return blockers;
end;
$$;

create or replace function public.enforce_catalogue_product_promotion_gate()
returns trigger
language plpgsql
security invoker
set search_path = public
as $
declare
  blockers text[];
begin
  if old.record_class = 'canonical' and new.record_class <> 'canonical' then
    raise exception 'Canonical products cannot be downgraded to a review-only record class.';
  end if;

  if (
    (old.record_class = 'demo_seed' and new.record_class = 'canonical')
    or (old.identity_status <> 'verified' and new.identity_status = 'verified')
  ) then
    blockers := public.catalogue_identity_promotion_blockers(old.id);
    if cardinality(blockers) > 0 then
      raise exception 'Identity promotion blocked: %', array_to_string(blockers, ' | ');
    end if;
  end if;

  if old.selectable = false and new.selectable = true then
    blockers := public.catalogue_publication_blockers(old.id);
    if cardinality(blockers) > 0 then
      raise exception 'Publication blocked: %', array_to_string(blockers, ' | ');
    end if;
  end if;

  return new;
end;
$;

create trigger catalogue_products_promotion_gate
before update of record_class, identity_status, verification_status, selectable
on public.catalogue_products
for each row execute function public.enforce_catalogue_product_promotion_gate();

create or replace function public.catalogue_create_candidate_from_import(
  p_import_row_id bigint,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $
declare
  import_record public.catalogue_import_rows%rowtype;
  batch_record public.catalogue_import_batches%rowtype;
  data jsonb;
  product_id text;
  category_value public.drone_product_category;
  manufacturer_name text;
  manufacturer_id uuid;
  model_label text;
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  select *
  into import_record
  from public.catalogue_import_rows
  where id = p_import_row_id;

  if not found then
    raise exception 'Import row does not exist.';
  end if;

  select *
  into batch_record
  from public.catalogue_import_batches
  where id = import_record.batch_id;

  if not found or batch_record.import_kind <> 'products' then
    raise exception 'Import row is not part of a product import batch.';
  end if;

  if import_record.normalized_data is null then
    raise exception 'Import row has no normalized product data.';
  end if;

  if import_record.status not in ('validated', 'needs_review') then
    raise exception 'Import row is not eligible to become a review candidate.';
  end if;

  data := import_record.normalized_data;
  product_id := nullif(trim(data->>'id'), '');

  if product_id is null then
    raise exception 'Normalized product ID is missing.';
  end if;

  if exists (
    select 1
    from public.catalogue_products p
    where p.id = product_id
  ) then
    raise exception 'Product ID % already exists in the catalogue.', product_id;
  end if;

  category_value := (data->>'category')::public.drone_product_category;
  manufacturer_name := nullif(trim(data->>'manufacturer'), '');
  model_label := coalesce(
    nullif(trim(data->>'model'), ''),
    nullif(trim(data->>'display_name'), '')
  );

  if model_label is null then
    raise exception 'A display name or model label is required.';
  end if;

  if manufacturer_name is not null then
    select id
    into manufacturer_id
    from public.catalogue_manufacturers
    where lower(name) = lower(manufacturer_name)
    limit 1;

    if manufacturer_id is null then
      insert into public.catalogue_manufacturers (
        name,
        verification_status
      ) values (
        manufacturer_name,
        'pending_review'
      )
      returning id into manufacturer_id;
    end if;
  end if;

  insert into public.catalogue_products (
    id,
    manufacturer_id,
    model,
    variant,
    display_name,
    category,
    mpn,
    manufacturer_sku,
    spec_summary,
    weight_grams,
    lifecycle_status,
    verification_status,
    selectable,
    attributes,
    identity_status,
    identity_verified_at,
    record_class
  ) values (
    product_id,
    manufacturer_id,
    model_label,
    nullif(trim(data->>'variant'), ''),
    data->>'display_name',
    category_value,
    nullif(trim(data->>'mpn'), ''),
    nullif(trim(data->>'manufacturer_sku'), ''),
    nullif(data->>'spec_summary', ''),
    nullif(data->>'weight_grams', '')::numeric,
    'unknown',
    'pending_review',
    false,
    jsonb_build_object(
      'candidateSource', 'catalogue_import_rows',
      'importRowId', p_import_row_id,
      'importBatchId', import_record.batch_id
    ),
    'pending_review',
    null,
    'candidate'
  );

  insert into public.catalogue_product_specs (
    product_id,
    frame_size_inches,
    motor_mount_pattern,
    propeller_diameter_inches,
    motor_size_code,
    motor_stator_width_mm,
    motor_stator_height_mm,
    motor_kv,
    min_battery_cells,
    max_battery_cells,
    connector,
    esc_input,
    thrust_grams,
    peak_current_amps,
    esc_amps,
    battery_cells,
    battery_capacity_mah,
    battery_discharge_c,
    video_system,
    camera_video_interface,
    camera_min_voltage_v,
    camera_max_voltage_v,
    camera_width_mm,
    camera_height_mm,
    camera_depth_mm,
    fc_camera_video_interfaces,
    fc_camera_power_voltages_v,
    receiver_protocol,
    receiver_frequency_min_mhz,
    receiver_frequency_max_mhz,
    receiver_min_voltage_v,
    receiver_max_voltage_v,
    receiver_signal_interface,
    receiver_width_mm,
    receiver_height_mm,
    receiver_depth_mm,
    fc_receiver_signal_interfaces,
    fc_receiver_power_voltages_v,
    attributes
  ) values (
    product_id,
    nullif(data->>'frame_size_inches', '')::numeric,
    nullif(data->>'motor_mount_pattern', ''),
    nullif(data->>'propeller_diameter_inches', '')::numeric,
    nullif(data->>'motor_size_code', '')::integer,
    nullif(data->>'motor_stator_width_mm', '')::numeric,
    nullif(data->>'motor_stator_height_mm', '')::numeric,
    nullif(data->>'motor_kv', '')::integer,
    nullif(data->>'min_battery_cells', '')::smallint,
    nullif(data->>'max_battery_cells', '')::smallint,
    nullif(data->>'connector', ''),
    nullif(data->>'esc_input', ''),
    nullif(data->>'thrust_grams', '')::numeric,
    nullif(data->>'peak_current_amps', '')::numeric,
    nullif(data->>'esc_amps', '')::numeric,
    nullif(data->>'battery_cells', '')::smallint,
    nullif(data->>'battery_capacity_mah', '')::integer,
    nullif(data->>'battery_discharge_c', '')::numeric,
    nullif(data->>'video_system', ''),
    nullif(data->>'camera_video_interface', ''),
    nullif(data->>'camera_min_voltage_v', '')::numeric,
    nullif(data->>'camera_max_voltage_v', '')::numeric,
    nullif(data->>'camera_width_mm', '')::numeric,
    nullif(data->>'camera_height_mm', '')::numeric,
    nullif(data->>'camera_depth_mm', '')::numeric,
    case
      when jsonb_typeof(data->'fc_camera_video_interfaces') = 'array'
      then array(
        select jsonb_array_elements_text(data->'fc_camera_video_interfaces')
      )
      else null
    end,
    case
      when jsonb_typeof(data->'fc_camera_power_voltages_v') = 'array'
      then array(
        select value::numeric
        from jsonb_array_elements_text(data->'fc_camera_power_voltages_v') value
      )
      else null
    end,
    nullif(data->>'receiver_protocol', ''),
    nullif(data->>'receiver_frequency_min_mhz', '')::numeric,
    nullif(data->>'receiver_frequency_max_mhz', '')::numeric,
    nullif(data->>'receiver_min_voltage_v', '')::numeric,
    nullif(data->>'receiver_max_voltage_v', '')::numeric,
    nullif(data->>'receiver_signal_interface', ''),
    nullif(data->>'receiver_width_mm', '')::numeric,
    nullif(data->>'receiver_height_mm', '')::numeric,
    nullif(data->>'receiver_depth_mm', '')::numeric,
    case
      when jsonb_typeof(data->'fc_receiver_signal_interfaces') = 'array'
      then array(
        select jsonb_array_elements_text(data->'fc_receiver_signal_interfaces')
      )
      else null
    end,
    case
      when jsonb_typeof(data->'fc_receiver_power_voltages_v') = 'array'
      then array(
        select value::numeric
        from jsonb_array_elements_text(data->'fc_receiver_power_voltages_v') value
      )
      else null
    end,
    '{}'::jsonb
  );

  insert into public.catalogue_product_quality_reviews (
    product_id,
    identity_quality_status,
    technical_quality_status,
    product_kind,
    manufacturer_label,
    exact_model_label,
    variant_label,
    price_status,
    illustrative_price_amount,
    illustrative_price_currency,
    human_review_required,
    issues,
    remediation,
    review_dataset,
    reviewed_at
  ) values (
    product_id,
    'unverified',
    'unverified',
    'unknown',
    manufacturer_name,
    nullif(trim(data->>'model'), ''),
    nullif(trim(data->>'variant'), ''),
    'missing',
    null,
    null,
    true,
    jsonb_build_array(
      'New product candidate requires identity, technical, image, and offer review.'
    ),
    jsonb_build_array(
      'Attach exact-model identity evidence and field-level technical evidence before promotion.'
    ),
    'staged-product-import',
    now()
  );

  if nullif(trim(data->>'image_url'), '') is not null then
    insert into public.catalogue_product_images (
      product_id,
      image_url,
      source_url,
      alt_text,
      exact_model_verified,
      verification_status,
      provenance,
      primary_image,
      license_name,
      license_url
    ) values (
      product_id,
      data->>'image_url',
      nullif(trim(data->>'image_source_url'), ''),
      coalesce(nullif(data->>'image_alt', ''), data->>'display_name'),
      false,
      'pending_review',
      coalesce(
        nullif(data->>'image_provenance', ''),
        'Staged product candidate image'
      ),
      false,
      nullif(data->>'image_license_name', ''),
      nullif(data->>'image_license_url', '')
    );
  end if;

  update public.catalogue_import_rows
  set
    status = 'imported',
    reviewed_at = now()
  where id = p_import_row_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    product_id,
    'candidate_created',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', product_id,
    'recordClass', 'candidate',
    'identityStatus', 'pending_review',
    'selectable', false
  );
end;
$;

create or replace function public.catalogue_promote_identity(
  p_product_id text,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  blockers text[];
  quality_record public.catalogue_product_quality_reviews%rowtype;
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  blockers := public.catalogue_identity_promotion_blockers(p_product_id);

  if cardinality(blockers) > 0 then
    raise exception 'Identity promotion blocked: %', array_to_string(blockers, ' | ');
  end if;

  select *
  into quality_record
  from public.catalogue_product_quality_reviews
  where product_id = p_product_id;

  update public.catalogue_products
  set
    record_class = 'canonical',
    model = quality_record.exact_model_label,
    variant = quality_record.variant_label,
    identity_status = 'verified',
    identity_verified_at = now(),
    verification_status = 'pending_review',
    selectable = false
  where id = p_product_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    p_product_id,
    'identity_promoted',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', p_product_id,
    'recordClass', 'canonical',
    'identityStatus', 'verified',
    'selectable', false
  );
end;
$$;

create or replace function public.catalogue_publish_product(
  p_product_id text,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  blockers text[];
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  blockers := public.catalogue_publication_blockers(p_product_id);

  if cardinality(blockers) > 0 then
    raise exception 'Publication blocked: %', array_to_string(blockers, ' | ');
  end if;

  update public.catalogue_products
  set
    verification_status = 'verified',
    selectable = true
  where id = p_product_id;

  update public.catalogue_product_quality_reviews
  set price_status = 'market_offer_backed'
  where product_id = p_product_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    p_product_id,
    'publication_enabled',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', p_product_id,
    'verificationStatus', 'verified',
    'selectable', true
  );
end;
$$;

create or replace function public.catalogue_unpublish_product(
  p_product_id text,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  if not exists (
    select 1
    from public.catalogue_products
    where id = p_product_id
  ) then
    raise exception 'Product does not exist.';
  end if;

  update public.catalogue_products
  set selectable = false
  where id = p_product_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    p_product_id,
    'publication_disabled',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', p_product_id,
    'selectable', false
  );
end;
$$;

create or replace view public.catalogue_promotion_readiness
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
  q.human_review_required,
  public.catalogue_identity_promotion_blockers(p.id) as identity_blockers,
  public.catalogue_publication_blockers(p.id) as publication_blockers
from public.catalogue_products p
left join public.catalogue_product_quality_reviews q
  on q.product_id = p.id;

revoke all on public.catalogue_promotion_readiness from anon, authenticated;
grant select on public.catalogue_promotion_readiness to service_role;

revoke all on function public.enforce_catalogue_product_promotion_gate()
  from public, anon, authenticated;
revoke all on function public.catalogue_create_candidate_from_import(bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_identity_promotion_blockers(text)
  from public, anon, authenticated;
revoke all on function public.catalogue_publication_blockers(text)
  from public, anon, authenticated;
revoke all on function public.catalogue_promote_identity(text, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_publish_product(text, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_unpublish_product(text, text, text)
  from public, anon, authenticated;

grant execute on function public.catalogue_create_candidate_from_import(bigint, text, text)
  to service_role;
grant execute on function public.catalogue_identity_promotion_blockers(text)
  to service_role;
grant execute on function public.catalogue_publication_blockers(text)
  to service_role;
grant execute on function public.catalogue_promote_identity(text, text, text)
  to service_role;
grant execute on function public.catalogue_publish_product(text, text, text)
  to service_role;
grant execute on function public.catalogue_unpublish_product(text, text, text)
  to service_role;
