-- DroneCores catalogue review / promotion workflow
-- Local migration only. Do not apply to a remote Supabase project without explicit approval.

create type public.catalogue_promotion_action as enum (
  'candidate_created',
  'identity_evidence_verified',
  'identity_promoted',
  'spec_evidence_imported',
  'spec_evidence_verified',
  'technical_review_completed',
  'eu_offer_verified',
  'publication_enabled',
  'publication_disabled'
);

create table public.catalogue_identity_evidence (
  id uuid primary key default gen_random_uuid(),
  product_id text not null
    references public.catalogue_products(id) on delete cascade,
  source_id uuid not null
    references public.catalogue_sources(id) on delete restrict,
  source_url text not null check (source_url ~ '^https://'),
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
  on public.catalogue_identity_evidence (product_id, source_id, source_url);

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

  ('receiver', 'receiverProtocol', 'Receiver protocol retained as a core canonical product field.'),
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
  on public.catalogue_promotion_events (product_id, created_at desc);

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

create or replace function public.catalogue_product_field_value_json(
  p_product_id text,
  p_field_key text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  p public.catalogue_products%rowtype;
  s public.catalogue_product_specs%rowtype;
begin
  select * into p
  from public.catalogue_products
  where id = p_product_id;

  if not found then
    return null;
  end if;

  select * into s
  from public.catalogue_product_specs
  where product_id = p_product_id;

  case p_field_key
    when 'weight' then return to_jsonb(p.weight_grams);
    when 'frameInches' then return to_jsonb(s.frame_size_inches);
    when 'mount' then return to_jsonb(s.motor_mount_pattern);
    when 'propInches' then return to_jsonb(s.propeller_diameter_inches);
    when 'motorSize' then return to_jsonb(s.motor_size_code);
    when 'minVoltage' then return to_jsonb(s.min_battery_cells);
    when 'maxVoltage' then return to_jsonb(s.max_battery_cells);
    when 'connector' then return to_jsonb(s.connector);
    when 'escInput' then return to_jsonb(s.esc_input);
    when 'thrust' then return to_jsonb(s.thrust_grams);
    when 'current' then return to_jsonb(s.peak_current_amps);
    when 'escAmps' then return to_jsonb(s.esc_amps);
    when 'voltage' then return to_jsonb(s.battery_cells);
    when 'batteryMah' then return to_jsonb(s.battery_capacity_mah);
    when 'video' then return to_jsonb(s.video_system);
    when 'cameraVideoInterface' then return to_jsonb(s.camera_video_interface);
    when 'cameraMinVoltageV' then return to_jsonb(s.camera_min_voltage_v);
    when 'cameraMaxVoltageV' then return to_jsonb(s.camera_max_voltage_v);
    when 'cameraWidthMm' then return to_jsonb(s.camera_width_mm);
    when 'cameraHeightMm' then return to_jsonb(s.camera_height_mm);
    when 'cameraDepthMm' then return to_jsonb(s.camera_depth_mm);
    when 'fcCameraVideoInterfaces' then return to_jsonb(s.fc_camera_video_interfaces);
    when 'fcCameraPowerVoltagesV' then return to_jsonb(s.fc_camera_power_voltages_v);
    when 'receiverProtocol' then return to_jsonb(s.receiver_protocol);
    when 'receiverFrequencyMinMhz' then return to_jsonb(s.receiver_frequency_min_mhz);
    when 'receiverFrequencyMaxMhz' then return to_jsonb(s.receiver_frequency_max_mhz);
    when 'receiverMinVoltageV' then return to_jsonb(s.receiver_min_voltage_v);
    when 'receiverMaxVoltageV' then return to_jsonb(s.receiver_max_voltage_v);
    when 'receiverSignalInterface' then return to_jsonb(s.receiver_signal_interface);
    when 'receiverWidthMm' then return to_jsonb(s.receiver_width_mm);
    when 'receiverHeightMm' then return to_jsonb(s.receiver_height_mm);
    when 'receiverDepthMm' then return to_jsonb(s.receiver_depth_mm);
    when 'fcReceiverSignalInterfaces' then return to_jsonb(s.fc_receiver_signal_interfaces);
    when 'fcReceiverPowerVoltagesV' then return to_jsonb(s.fc_receiver_power_voltages_v);
    else return null;
  end case;
end;
$fn$;

create or replace function public.catalogue_missing_required_fields(
  p_product_id text
)
returns text[]
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  missing_fields text[] := array[]::text[];
  product_category public.drone_product_category;
  requirement record;
  stored_value jsonb;
begin
  select category into product_category
  from public.catalogue_products
  where id = p_product_id;

  if product_category is null then
    return array['Product does not exist.'];
  end if;

  for requirement in
    select field_key, explanation
    from public.catalogue_category_field_requirements
    where category = product_category
    order by field_key
  loop
    stored_value := public.catalogue_product_field_value_json(
      p_product_id,
      requirement.field_key
    );

    if stored_value is null then
      missing_fields := array_append(
        missing_fields,
        format(
          'Canonical field %s is missing: %s',
          requirement.field_key,
          requirement.explanation
        )
      );
    elsif not exists (
      select 1
      from public.catalogue_spec_evidence e
      where e.product_id = p_product_id
        and e.field_key = requirement.field_key
        and e.value = stored_value
        and e.verification_status = 'verified'
        and e.exact_model_association = true
        and e.retrieved_at is not null
        and e.verified_at is not null
        and e.authority in ('manufacturer', 'official_documentation')
    ) then
      missing_fields := array_append(
        missing_fields,
        format(
          'Missing verified matching field evidence for %s: %s',
          requirement.field_key,
          requirement.explanation
        )
      );
    end if;
  end loop;

  return missing_fields;
end;
$fn$;

create or replace function public.catalogue_identity_promotion_blockers(
  p_product_id text
)
returns text[]
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  blockers text[] := array[]::text[];
  product_record public.catalogue_products%rowtype;
  quality_record public.catalogue_product_quality_reviews%rowtype;
  verified_manufacturer_name text;
begin
  select * into product_record
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

  select * into quality_record
  from public.catalogue_product_quality_reviews
  where product_id = p_product_id;

  if not found then
    return array['Phase A / candidate quality review is missing.'];
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
    select name into verified_manufacturer_name
    from public.catalogue_manufacturers
    where id = product_record.manufacturer_id
      and verification_status = 'verified';

    if verified_manufacturer_name is null then
      blockers := array_append(blockers, 'Linked manufacturer is not verified.');
    elsif quality_record.manufacturer_label is not null
      and lower(trim(verified_manufacturer_name)) <>
          lower(trim(quality_record.manufacturer_label)) then
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
$fn$;

create or replace function public.catalogue_publication_blockers(
  p_product_id text
)
returns text[]
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  blockers text[] := array[]::text[];
  product_record public.catalogue_products%rowtype;
  quality_record public.catalogue_product_quality_reviews%rowtype;
begin
  select * into product_record
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

  select * into quality_record
  from public.catalogue_product_quality_reviews
  where product_id = p_product_id;

  if not found then
    return blockers || array['Product quality review is missing.'];
  end if;

  if quality_record.identity_quality_status <> 'verified' then
    blockers := array_append(blockers, 'Identity quality review is not verified.');
  end if;

  if quality_record.technical_quality_status <> 'verified' then
    blockers := array_append(blockers, 'Technical review has not been completed.');
  end if;

  if quality_record.human_review_required then
    blockers := array_append(blockers, 'Human review is still required.');
  end if;

  blockers := blockers || public.catalogue_missing_required_fields(p_product_id);

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
$fn$;

create or replace function public.enforce_catalogue_product_promotion_gate()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  blockers text[];
begin
  if old.record_class = 'canonical' and new.record_class <> 'canonical' then
    raise exception 'Canonical products cannot be downgraded to a review-only record class.';
  end if;

  if (
    (old.record_class <> 'canonical' and new.record_class = 'canonical')
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
$fn$;

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
as $fn$
declare
  import_record public.catalogue_import_rows%rowtype;
  batch_record public.catalogue_import_batches%rowtype;
  data jsonb;
  v_product_id text;
  v_category public.drone_product_category;
  v_manufacturer_name text;
  v_manufacturer_id uuid;
  v_model_label text;
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  select * into import_record
  from public.catalogue_import_rows
  where id = p_import_row_id;

  if not found then
    raise exception 'Import row does not exist.';
  end if;

  select * into batch_record
  from public.catalogue_import_batches
  where id = import_record.batch_id;

  if not found or batch_record.import_kind <> 'products' then
    raise exception 'Import row is not part of a product import batch.';
  end if;

  if import_record.normalized_data is null
     or import_record.status not in ('validated', 'needs_review') then
    raise exception 'Import row is not eligible to become a review candidate.';
  end if;

  data := import_record.normalized_data;
  v_product_id := nullif(trim(data->>'id'), '');

  if v_product_id is null then
    raise exception 'Normalized product ID is missing.';
  end if;

  if exists (
    select 1 from public.catalogue_products where id = v_product_id
  ) then
    raise exception 'Product ID % already exists in the catalogue.', v_product_id;
  end if;

  v_category := (data->>'category')::public.drone_product_category;
  v_manufacturer_name := nullif(trim(data->>'manufacturer'), '');
  v_model_label := coalesce(
    nullif(trim(data->>'model'), ''),
    nullif(trim(data->>'display_name'), '')
  );

  if v_model_label is null then
    raise exception 'A display name or model label is required.';
  end if;

  if v_manufacturer_name is not null then
    select id into v_manufacturer_id
    from public.catalogue_manufacturers
    where lower(name) = lower(v_manufacturer_name)
    limit 1;

    if v_manufacturer_id is null then
      insert into public.catalogue_manufacturers (
        name,
        verification_status
      ) values (
        v_manufacturer_name,
        'pending_review'
      )
      returning id into v_manufacturer_id;
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
    v_product_id,
    v_manufacturer_id,
    v_model_label,
    nullif(trim(data->>'variant'), ''),
    data->>'display_name',
    v_category,
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
    v_product_id,
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
      then array(select jsonb_array_elements_text(data->'fc_camera_video_interfaces'))
      else null
    end,
    case
      when jsonb_typeof(data->'fc_camera_power_voltages_v') = 'array'
      then array(
        select value::numeric
        from jsonb_array_elements_text(data->'fc_camera_power_voltages_v') as value
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
      then array(select jsonb_array_elements_text(data->'fc_receiver_signal_interfaces'))
      else null
    end,
    case
      when jsonb_typeof(data->'fc_receiver_power_voltages_v') = 'array'
      then array(
        select value::numeric
        from jsonb_array_elements_text(data->'fc_receiver_power_voltages_v') as value
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
    v_product_id,
    'unverified',
    'unverified',
    'unknown',
    v_manufacturer_name,
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
      v_product_id,
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
  set status = 'imported', reviewed_at = now()
  where id = p_import_row_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    v_product_id,
    'candidate_created',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', v_product_id,
    'recordClass', 'candidate',
    'identityStatus', 'pending_review',
    'selectable', false
  );
end;
$fn$;

create or replace function public.catalogue_verify_identity_evidence(
  p_identity_evidence_id uuid,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  evidence_record public.catalogue_identity_evidence%rowtype;
  v_manufacturer_id uuid;
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  select * into evidence_record
  from public.catalogue_identity_evidence
  where id = p_identity_evidence_id;

  if not found then
    raise exception 'Identity evidence does not exist.';
  end if;

  if not evidence_record.exact_model_association
     or evidence_record.authority not in ('manufacturer', 'official_documentation')
     or evidence_record.retrieved_at is null then
    raise exception 'Identity evidence is not sufficient for exact-model verification.';
  end if;

  if not exists (
    select 1
    from public.catalogue_product_quality_reviews
    where product_id = evidence_record.product_id
  ) then
    raise exception 'Product quality review is missing.';
  end if;

  update public.catalogue_sources
  set verification_status = 'verified'
  where id = evidence_record.source_id;

  select id into v_manufacturer_id
  from public.catalogue_manufacturers
  where lower(name) = lower(evidence_record.manufacturer_label)
  limit 1;

  if v_manufacturer_id is null then
    insert into public.catalogue_manufacturers (
      name,
      verification_status
    ) values (
      evidence_record.manufacturer_label,
      'verified'
    )
    returning id into v_manufacturer_id;
  else
    update public.catalogue_manufacturers
    set verification_status = 'verified'
    where id = v_manufacturer_id;
  end if;

  update public.catalogue_identity_evidence
  set verification_status = 'verified', verified_at = now()
  where id = p_identity_evidence_id;

  update public.catalogue_products
  set manufacturer_id = v_manufacturer_id
  where id = evidence_record.product_id;

  update public.catalogue_product_quality_reviews
  set
    identity_quality_status = 'verified',
    manufacturer_label = evidence_record.manufacturer_label,
    exact_model_label = evidence_record.model_label,
    variant_label = evidence_record.variant_label
  where product_id = evidence_record.product_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    evidence_record.product_id,
    'identity_evidence_verified',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', evidence_record.product_id,
    'identityEvidenceId', p_identity_evidence_id,
    'verificationStatus', 'verified'
  );
end;
$fn$;

create or replace function public.catalogue_promote_identity(
  p_product_id text,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
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

  select * into quality_record
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
$fn$;

create or replace function public.catalogue_accept_spec_evidence_from_import(
  p_import_row_id bigint,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  import_record public.catalogue_import_rows%rowtype;
  batch_record public.catalogue_import_batches%rowtype;
  data jsonb;
  v_source_id uuid;
  v_evidence_id uuid;
  v_source_kind public.catalogue_source_kind;
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  select * into import_record
  from public.catalogue_import_rows
  where id = p_import_row_id;

  if not found then
    raise exception 'Import row does not exist.';
  end if;

  select * into batch_record
  from public.catalogue_import_batches
  where id = import_record.batch_id;

  if not found or batch_record.import_kind <> 'spec_evidence' then
    raise exception 'Import row is not specification evidence.';
  end if;

  if import_record.normalized_data is null
     or import_record.status not in ('validated', 'needs_review') then
    raise exception 'Specification evidence row is not eligible for review.';
  end if;

  data := import_record.normalized_data;

  if not exists (
    select 1 from public.catalogue_products where id = data->>'productId'
  ) then
    raise exception 'Referenced product does not exist.';
  end if;

  v_source_kind := (data->>'sourceKind')::public.catalogue_source_kind;

  select id into v_source_id
  from public.catalogue_sources
  where lower(name) = lower(data->>'sourceName')
    and kind = v_source_kind
  limit 1;

  if v_source_id is null then
    insert into public.catalogue_sources (
      name,
      kind,
      verification_status
    ) values (
      data->>'sourceName',
      v_source_kind,
      'pending_review'
    )
    returning id into v_source_id;
  end if;

  insert into public.catalogue_spec_evidence (
    product_id,
    field_key,
    value,
    unit,
    value_semantics,
    source_id,
    source_url,
    authority,
    exact_model_association,
    verification_status,
    retrieved_at,
    verified_at,
    conditions,
    caveats
  ) values (
    data->>'productId',
    data->>'fieldKey',
    data->'value',
    nullif(data->>'unit', ''),
    nullif(data->>'valueSemantics', ''),
    v_source_id,
    data->>'sourceUrl',
    (data->>'authority')::public.catalogue_evidence_authority,
    coalesce((data->>'exactModelAssociation')::boolean, false),
    'pending_review',
    (data->>'retrievedAt')::timestamptz,
    null,
    coalesce(data->'conditions', '{}'::jsonb),
    nullif(data->>'caveats', '')
  )
  on conflict do nothing
  returning id into v_evidence_id;

  if v_evidence_id is null then
    select id into v_evidence_id
    from public.catalogue_spec_evidence
    where product_id = data->>'productId'
      and field_key = data->>'fieldKey'
      and source_id = v_source_id
      and coalesce(source_url, '') = coalesce(data->>'sourceUrl', '')
    limit 1;
  end if;

  update public.catalogue_import_rows
  set status = 'imported', reviewed_at = now()
  where id = p_import_row_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    data->>'productId',
    'spec_evidence_imported',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', data->>'productId',
    'specEvidenceId', v_evidence_id,
    'verificationStatus', 'pending_review'
  );
end;
$fn$;

create or replace function public.catalogue_verify_spec_evidence(
  p_spec_evidence_id uuid,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  evidence_record public.catalogue_spec_evidence%rowtype;
  stored_value jsonb;
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  select * into evidence_record
  from public.catalogue_spec_evidence
  where id = p_spec_evidence_id;

  if not found then
    raise exception 'Specification evidence does not exist.';
  end if;

  if not evidence_record.exact_model_association
     or evidence_record.authority not in ('manufacturer', 'official_documentation')
     or evidence_record.retrieved_at is null then
    raise exception 'Specification evidence is not sufficient for verified technical data.';
  end if;

  stored_value := public.catalogue_product_field_value_json(
    evidence_record.product_id,
    evidence_record.field_key
  );

  if stored_value is null then
    raise exception 'The corresponding canonical product field is missing or unsupported.';
  end if;

  if stored_value <> evidence_record.value then
    raise exception 'Evidence value does not match the current stored product value.';
  end if;

  update public.catalogue_sources
  set verification_status = 'verified'
  where id = evidence_record.source_id;

  update public.catalogue_spec_evidence
  set verification_status = 'verified', verified_at = now()
  where id = p_spec_evidence_id;

  update public.catalogue_product_quality_reviews
  set technical_quality_status =
    case
      when technical_quality_status = 'unverified'
        then 'partially_verified'::public.catalogue_quality_status
      else technical_quality_status
    end
  where product_id = evidence_record.product_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    evidence_record.product_id,
    'spec_evidence_verified',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', evidence_record.product_id,
    'specEvidenceId', p_spec_evidence_id,
    'verificationStatus', 'verified'
  );
end;
$fn$;

create or replace function public.catalogue_complete_technical_review(
  p_product_id text,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  missing_fields text[];
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  if not exists (
    select 1
    from public.catalogue_products
    where id = p_product_id
      and record_class = 'canonical'
      and identity_status = 'verified'
      and identity_verified_at is not null
  ) then
    raise exception 'Canonical verified identity is required before technical review can be completed.';
  end if;

  missing_fields := public.catalogue_missing_required_fields(p_product_id);

  if cardinality(missing_fields) > 0 then
    raise exception 'Technical review blocked: %', array_to_string(missing_fields, ' | ');
  end if;

  update public.catalogue_product_quality_reviews
  set
    technical_quality_status = 'verified',
    human_review_required = false
  where product_id = p_product_id
    and technical_quality_status <> 'conflicting';

  if not found then
    raise exception 'Product review is missing or still marked conflicting.';
  end if;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    p_product_id,
    'technical_review_completed',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', p_product_id,
    'technicalQualityStatus', 'verified',
    'humanReviewRequired', false
  );
end;
$fn$;

create or replace function public.catalogue_add_verified_eu_offer(
  p_product_id text,
  p_merchant_name text,
  p_product_url text,
  p_price_amount numeric,
  p_stock_status public.stock_status,
  p_last_checked_at timestamptz,
  p_reviewer text,
  p_notes text default null,
  p_merchant_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_merchant_id uuid;
  v_offer_id uuid;
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  if not exists (
    select 1
    from public.catalogue_products
    where id = p_product_id
      and record_class = 'canonical'
      and identity_status = 'verified'
  ) then
    raise exception 'A canonical verified product identity is required before adding a verified offer.';
  end if;

  if p_merchant_name is null or length(trim(p_merchant_name)) = 0 then
    raise exception 'Merchant name is required.';
  end if;

  if p_product_url is null or p_product_url !~ '^https://' then
    raise exception 'Verified offers require an HTTPS product URL.';
  end if;

  if p_price_amount is null or p_price_amount < 0 then
    raise exception 'Offer price must be zero or greater.';
  end if;

  if p_last_checked_at is null then
    raise exception 'Offer check timestamp is required.';
  end if;

  if p_merchant_country_code is not null
     and p_merchant_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Merchant country code must be a two-letter uppercase code.';
  end if;

  select id into v_merchant_id
  from public.catalogue_merchants
  where lower(name) = lower(trim(p_merchant_name))
  limit 1;

  if v_merchant_id is null then
    insert into public.catalogue_merchants (
      name,
      country_code,
      active,
      verification_status
    ) values (
      trim(p_merchant_name),
      p_merchant_country_code,
      true,
      'verified'
    )
    returning id into v_merchant_id;
  else
    update public.catalogue_merchants
    set
      country_code = coalesce(p_merchant_country_code, country_code),
      active = true,
      verification_status = 'verified'
    where id = v_merchant_id;
  end if;

  insert into public.catalogue_offers (
    product_id,
    merchant_id,
    product_url,
    price_amount,
    currency,
    stock_status,
    region,
    verification_status,
    last_checked_at
  ) values (
    p_product_id,
    v_merchant_id,
    p_product_url,
    p_price_amount,
    'EUR',
    p_stock_status,
    'EU',
    'verified',
    p_last_checked_at
  )
  on conflict (merchant_id, product_url) do update set
    price_amount = excluded.price_amount,
    currency = excluded.currency,
    stock_status = excluded.stock_status,
    region = excluded.region,
    verification_status = excluded.verification_status,
    last_checked_at = excluded.last_checked_at
  returning id into v_offer_id;

  insert into public.catalogue_promotion_events (
    product_id,
    action,
    reviewer,
    notes,
    blockers_snapshot
  ) values (
    p_product_id,
    'eu_offer_verified',
    trim(p_reviewer),
    p_notes,
    '[]'::jsonb
  );

  return jsonb_build_object(
    'productId', p_product_id,
    'offerId', v_offer_id,
    'currency', 'EUR',
    'region', 'EU',
    'verificationStatus', 'verified'
  );
end;
$fn$;

create or replace function public.catalogue_publish_product(
  p_product_id text,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
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
  set verification_status = 'verified', selectable = true
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
$fn$;

create or replace function public.catalogue_unpublish_product(
  p_product_id text,
  p_reviewer text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_reviewer is null or length(trim(p_reviewer)) = 0 then
    raise exception 'Reviewer is required.';
  end if;

  if not exists (
    select 1 from public.catalogue_products where id = p_product_id
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
$fn$;

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

revoke all on function public.catalogue_product_field_value_json(text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_missing_required_fields(text)
  from public, anon, authenticated;
revoke all on function public.catalogue_identity_promotion_blockers(text)
  from public, anon, authenticated;
revoke all on function public.catalogue_publication_blockers(text)
  from public, anon, authenticated;
revoke all on function public.enforce_catalogue_product_promotion_gate()
  from public, anon, authenticated;
revoke all on function public.catalogue_create_candidate_from_import(bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_verify_identity_evidence(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_promote_identity(text, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_accept_spec_evidence_from_import(bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_verify_spec_evidence(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_complete_technical_review(text, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_add_verified_eu_offer(
  text, text, text, numeric, public.stock_status, timestamptz, text, text, text
) from public, anon, authenticated;
revoke all on function public.catalogue_publish_product(text, text, text)
  from public, anon, authenticated;
revoke all on function public.catalogue_unpublish_product(text, text, text)
  from public, anon, authenticated;

grant execute on function public.catalogue_product_field_value_json(text, text)
  to service_role;
grant execute on function public.catalogue_missing_required_fields(text)
  to service_role;
grant execute on function public.catalogue_identity_promotion_blockers(text)
  to service_role;
grant execute on function public.catalogue_publication_blockers(text)
  to service_role;
grant execute on function public.catalogue_create_candidate_from_import(bigint, text, text)
  to service_role;
grant execute on function public.catalogue_verify_identity_evidence(uuid, text, text)
  to service_role;
grant execute on function public.catalogue_promote_identity(text, text, text)
  to service_role;
grant execute on function public.catalogue_accept_spec_evidence_from_import(bigint, text, text)
  to service_role;
grant execute on function public.catalogue_verify_spec_evidence(uuid, text, text)
  to service_role;
grant execute on function public.catalogue_complete_technical_review(text, text, text)
  to service_role;
grant execute on function public.catalogue_add_verified_eu_offer(
  text, text, text, numeric, public.stock_status, timestamptz, text, text, text
) to service_role;
grant execute on function public.catalogue_publish_product(text, text, text)
  to service_role;
grant execute on function public.catalogue_unpublish_product(text, text, text)
  to service_role;
