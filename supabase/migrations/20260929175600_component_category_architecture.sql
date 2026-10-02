-- Shared component-category architecture for Required / Optional / Pilot Gear.
-- This migration is version-controlled only in this task and must not be applied to production without review.

alter table public.catalogue_products
  add column if not exists integrated_categories text[] not null default '{}'::text[],
  add column if not exists included_categories text[] not null default '{}'::text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname='catalogue_products_integrated_categories_check') then
    alter table public.catalogue_products add constraint catalogue_products_integrated_categories_check
      check (integrated_categories <@ array[
        'frame','motors','flightController','esc','propellers','battery','camera','receiver',
        'videoTransmitter','gps','buzzer','antenna','powerAccessory','optionalModule',
        'radioTransmitter','fpvGoggles','batteryCharger','chargingAccessory'
      ]::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname='catalogue_products_included_categories_check') then
    alter table public.catalogue_products add constraint catalogue_products_included_categories_check
      check (included_categories <@ array[
        'frame','motors','flightController','esc','propellers','battery','camera','receiver',
        'videoTransmitter','gps','buzzer','antenna','powerAccessory','optionalModule',
        'radioTransmitter','fpvGoggles','batteryCharger','chargingAccessory'
      ]::text[]);
  end if;
end
$$;

alter table public.catalogue_product_specs
  add column if not exists battery_chemistry text,
  add column if not exists battery_connector text,
  add column if not exists fc_peripheral_interfaces text[],
  add column if not exists fc_peripheral_power_voltages_v numeric[],
  add column if not exists video_transmitter_system text,
  add column if not exists vtx_camera_video_interfaces text[],
  add column if not exists vtx_antenna_connector text,
  add column if not exists vtx_frequency_min_mhz numeric,
  add column if not exists vtx_frequency_max_mhz numeric,
  add column if not exists antenna_connector text,
  add column if not exists antenna_frequency_min_mhz numeric,
  add column if not exists antenna_frequency_max_mhz numeric,
  add column if not exists radio_protocols text[],
  add column if not exists supported_video_systems text[],
  add column if not exists charger_battery_chemistries text[],
  add column if not exists charger_min_cells smallint,
  add column if not exists charger_max_cells smallint,
  add column if not exists charger_connectors text[],
  add column if not exists charging_connectors text[],
  add column if not exists device_signal_interface text,
  add column if not exists device_min_voltage_v numeric,
  add column if not exists device_max_voltage_v numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='catalogue_specs_vtx_frequency_range_check') then
    alter table public.catalogue_product_specs add constraint catalogue_specs_vtx_frequency_range_check
      check (vtx_frequency_min_mhz is null or vtx_frequency_max_mhz is null or vtx_frequency_min_mhz <= vtx_frequency_max_mhz);
  end if;
  if not exists (select 1 from pg_constraint where conname='catalogue_specs_antenna_frequency_range_check') then
    alter table public.catalogue_product_specs add constraint catalogue_specs_antenna_frequency_range_check
      check (antenna_frequency_min_mhz is null or antenna_frequency_max_mhz is null or antenna_frequency_min_mhz <= antenna_frequency_max_mhz);
  end if;
  if not exists (select 1 from pg_constraint where conname='catalogue_specs_device_voltage_range_check') then
    alter table public.catalogue_product_specs add constraint catalogue_specs_device_voltage_range_check
      check (device_min_voltage_v is null or device_max_voltage_v is null or device_min_voltage_v <= device_max_voltage_v);
  end if;
  if not exists (select 1 from pg_constraint where conname='catalogue_specs_charger_cell_range_check') then
    alter table public.catalogue_product_specs add constraint catalogue_specs_charger_cell_range_check
      check (
        (charger_min_cells is null or charger_min_cells > 0) and
        (charger_max_cells is null or charger_max_cells > 0) and
        (charger_min_cells is null or charger_max_cells is null or charger_min_cells <= charger_max_cells)
      );
  end if;
end
$$;

create or replace function catalogue_internal.populate_product_roles_from_import()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_data jsonb;
  v_import_row_id bigint;
begin
  if new.attributes->>'candidateSource' is distinct from 'catalogue_import_rows' then
    return new;
  end if;
  begin
    v_import_row_id := nullif(new.attributes->>'importRowId','')::bigint;
  exception when others then
    return new;
  end;
  select normalized_data into v_data
  from public.catalogue_import_rows
  where id=v_import_row_id;
  if v_data is null then return new; end if;

  if jsonb_typeof(v_data->'integrated_categories')='array' then
    new.integrated_categories := array(select jsonb_array_elements_text(v_data->'integrated_categories'));
  end if;
  if jsonb_typeof(v_data->'included_categories')='array' then
    new.included_categories := array(select jsonb_array_elements_text(v_data->'included_categories'));
  end if;
  return new;
end
$fn$;
revoke all on function catalogue_internal.populate_product_roles_from_import() from public,anon,authenticated;

drop trigger if exists catalogue_products_import_roles on public.catalogue_products;
create trigger catalogue_products_import_roles
before insert or update of attributes on public.catalogue_products
for each row execute function catalogue_internal.populate_product_roles_from_import();

create or replace function catalogue_internal.populate_extended_specs_from_import()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_data jsonb;
  v_import_row_id bigint;
begin
  select nullif(p.attributes->>'importRowId','')::bigint
  into v_import_row_id
  from public.catalogue_products p
  where p.id=new.product_id
    and p.attributes->>'candidateSource'='catalogue_import_rows';

  if v_import_row_id is null then return new; end if;
  select normalized_data into v_data from public.catalogue_import_rows where id=v_import_row_id;
  if v_data is null then return new; end if;

  new.battery_chemistry := nullif(v_data->>'battery_chemistry','');
  new.battery_connector := nullif(v_data->>'battery_connector','');
  new.video_transmitter_system := nullif(v_data->>'video_transmitter_system','');
  new.vtx_antenna_connector := nullif(v_data->>'vtx_antenna_connector','');
  new.vtx_frequency_min_mhz := nullif(v_data->>'vtx_frequency_min_mhz','')::numeric;
  new.vtx_frequency_max_mhz := nullif(v_data->>'vtx_frequency_max_mhz','')::numeric;
  new.antenna_connector := nullif(v_data->>'antenna_connector','');
  new.antenna_frequency_min_mhz := nullif(v_data->>'antenna_frequency_min_mhz','')::numeric;
  new.antenna_frequency_max_mhz := nullif(v_data->>'antenna_frequency_max_mhz','')::numeric;
  new.charger_min_cells := nullif(v_data->>'charger_min_cells','')::smallint;
  new.charger_max_cells := nullif(v_data->>'charger_max_cells','')::smallint;
  new.device_signal_interface := nullif(v_data->>'device_signal_interface','');
  new.device_min_voltage_v := nullif(v_data->>'device_min_voltage_v','')::numeric;
  new.device_max_voltage_v := nullif(v_data->>'device_max_voltage_v','')::numeric;

  if jsonb_typeof(v_data->'fc_peripheral_interfaces')='array' then new.fc_peripheral_interfaces := array(select jsonb_array_elements_text(v_data->'fc_peripheral_interfaces')); end if;
  if jsonb_typeof(v_data->'fc_peripheral_power_voltages_v')='array' then new.fc_peripheral_power_voltages_v := array(select value::numeric from jsonb_array_elements_text(v_data->'fc_peripheral_power_voltages_v') value); end if;
  if jsonb_typeof(v_data->'vtx_camera_video_interfaces')='array' then new.vtx_camera_video_interfaces := array(select jsonb_array_elements_text(v_data->'vtx_camera_video_interfaces')); end if;
  if jsonb_typeof(v_data->'radio_protocols')='array' then new.radio_protocols := array(select jsonb_array_elements_text(v_data->'radio_protocols')); end if;
  if jsonb_typeof(v_data->'supported_video_systems')='array' then new.supported_video_systems := array(select jsonb_array_elements_text(v_data->'supported_video_systems')); end if;
  if jsonb_typeof(v_data->'charger_battery_chemistries')='array' then new.charger_battery_chemistries := array(select jsonb_array_elements_text(v_data->'charger_battery_chemistries')); end if;
  if jsonb_typeof(v_data->'charger_connectors')='array' then new.charger_connectors := array(select jsonb_array_elements_text(v_data->'charger_connectors')); end if;
  if jsonb_typeof(v_data->'charging_connectors')='array' then new.charging_connectors := array(select jsonb_array_elements_text(v_data->'charging_connectors')); end if;

  return new;
end
$fn$;
revoke all on function catalogue_internal.populate_extended_specs_from_import() from public,anon,authenticated;

drop trigger if exists catalogue_product_specs_import_extended on public.catalogue_product_specs;
create trigger catalogue_product_specs_import_extended
before insert on public.catalogue_product_specs
for each row execute function catalogue_internal.populate_extended_specs_from_import();

create or replace function public.catalogue_product_field_value_json(p_product_id text,p_field_key text)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $fn$
declare
  p public.catalogue_products%rowtype;
  s public.catalogue_product_specs%rowtype;
begin
  select * into p from public.catalogue_products where id=p_product_id;
  if not found then return null; end if;
  select * into s from public.catalogue_product_specs where product_id=p_product_id;

  case p_field_key
    when 'weight' then return to_jsonb(p.weight_grams);
    when 'integratedCategories' then return to_jsonb(p.integrated_categories);
    when 'includedCategories' then return to_jsonb(p.included_categories);
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
    when 'batteryChemistry' then return to_jsonb(s.battery_chemistry);
    when 'batteryConnector' then return to_jsonb(s.battery_connector);
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
    when 'fcPeripheralInterfaces' then return to_jsonb(s.fc_peripheral_interfaces);
    when 'fcPeripheralPowerVoltagesV' then return to_jsonb(s.fc_peripheral_power_voltages_v);
    when 'videoTransmitterSystem' then return to_jsonb(s.video_transmitter_system);
    when 'vtxCameraVideoInterfaces' then return to_jsonb(s.vtx_camera_video_interfaces);
    when 'vtxAntennaConnector' then return to_jsonb(s.vtx_antenna_connector);
    when 'vtxFrequencyMinMhz' then return to_jsonb(s.vtx_frequency_min_mhz);
    when 'vtxFrequencyMaxMhz' then return to_jsonb(s.vtx_frequency_max_mhz);
    when 'antennaConnector' then return to_jsonb(s.antenna_connector);
    when 'antennaFrequencyMinMhz' then return to_jsonb(s.antenna_frequency_min_mhz);
    when 'antennaFrequencyMaxMhz' then return to_jsonb(s.antenna_frequency_max_mhz);
    when 'radioProtocols' then return to_jsonb(s.radio_protocols);
    when 'supportedVideoSystems' then return to_jsonb(s.supported_video_systems);
    when 'chargerBatteryChemistries' then return to_jsonb(s.charger_battery_chemistries);
    when 'chargerMinCells' then return to_jsonb(s.charger_min_cells);
    when 'chargerMaxCells' then return to_jsonb(s.charger_max_cells);
    when 'chargerConnectors' then return to_jsonb(s.charger_connectors);
    when 'chargingConnectors' then return to_jsonb(s.charging_connectors);
    when 'deviceSignalInterface' then return to_jsonb(s.device_signal_interface);
    when 'deviceMinVoltageV' then return to_jsonb(s.device_min_voltage_v);
    when 'deviceMaxVoltageV' then return to_jsonb(s.device_max_voltage_v);
    else return null;
  end case;
end
$fn$;

insert into public.catalogue_category_field_requirements(category,field_key,explanation) values
  ('videoTransmitter','videoTransmitterSystem','Video ecosystem or transmitter system used by goggles compatibility.'),
  ('videoTransmitter','vtxCameraVideoInterfaces','Camera interfaces accepted by the standalone VTX.'),
  ('videoTransmitter','vtxAntennaConnector','Antenna connector required by the standalone VTX.'),
  ('videoTransmitter','vtxFrequencyMinMhz','Minimum transmitter frequency used by antenna compatibility.'),
  ('videoTransmitter','vtxFrequencyMaxMhz','Maximum transmitter frequency used by antenna compatibility.'),
  ('gps','deviceSignalInterface','FC signal interface required by the GPS/GNSS module.'),
  ('gps','deviceMinVoltageV','Minimum supply voltage for the GPS/GNSS module.'),
  ('gps','deviceMaxVoltageV','Maximum supply voltage for the GPS/GNSS module.'),
  ('buzzer','deviceSignalInterface','FC signal interface required by the buzzer/lost-model module.'),
  ('buzzer','deviceMinVoltageV','Minimum supply voltage for the buzzer/lost-model module.'),
  ('buzzer','deviceMaxVoltageV','Maximum supply voltage for the buzzer/lost-model module.'),
  ('antenna','antennaConnector','Antenna connector used by the VTX compatibility rule.'),
  ('antenna','antennaFrequencyMinMhz','Minimum supported antenna frequency.'),
  ('antenna','antennaFrequencyMaxMhz','Maximum supported antenna frequency.'),
  ('radioTransmitter','radioProtocols','Radio protocols explicitly supported by the transmitter.'),
  ('fpvGoggles','supportedVideoSystems','Video systems or ecosystems explicitly supported by the goggles/receiver.'),
  ('batteryCharger','chargerBatteryChemistries','Battery chemistries explicitly supported by the charger.'),
  ('batteryCharger','chargerMinCells','Minimum supported pack cell count.'),
  ('batteryCharger','chargerMaxCells','Maximum supported pack cell count.'),
  ('batteryCharger','chargerConnectors','Charging connectors explicitly supported by the charger.'),
  ('chargingAccessory','chargingConnectors','Connectors exposed by the charging accessory.')
on conflict(category,field_key) do update set explanation=excluded.explanation;

alter table public.catalogue_public_runtime_products
  add column if not exists integrated_categories text[],
  add column if not exists included_categories text[],
  add column if not exists battery_chemistry text,
  add column if not exists battery_connector text,
  add column if not exists fc_peripheral_interfaces text[],
  add column if not exists fc_peripheral_power_voltages_v numeric[],
  add column if not exists video_transmitter_system text,
  add column if not exists vtx_camera_video_interfaces text[],
  add column if not exists vtx_antenna_connector text,
  add column if not exists vtx_frequency_min_mhz numeric,
  add column if not exists vtx_frequency_max_mhz numeric,
  add column if not exists antenna_connector text,
  add column if not exists antenna_frequency_min_mhz numeric,
  add column if not exists antenna_frequency_max_mhz numeric,
  add column if not exists radio_protocols text[],
  add column if not exists supported_video_systems text[],
  add column if not exists charger_battery_chemistries text[],
  add column if not exists charger_min_cells smallint,
  add column if not exists charger_max_cells smallint,
  add column if not exists charger_connectors text[],
  add column if not exists charging_connectors text[],
  add column if not exists device_signal_interface text,
  add column if not exists device_min_voltage_v numeric,
  add column if not exists device_max_voltage_v numeric;

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
  p.record_class,
  p.integrated_categories,
  p.included_categories,
  s.battery_chemistry,
  s.battery_connector,
  s.fc_peripheral_interfaces,
  s.fc_peripheral_power_voltages_v,
  s.video_transmitter_system,
  s.vtx_camera_video_interfaces,
  s.vtx_antenna_connector,
  s.vtx_frequency_min_mhz,
  s.vtx_frequency_max_mhz,
  s.antenna_connector,
  s.antenna_frequency_min_mhz,
  s.antenna_frequency_max_mhz,
  s.radio_protocols,
  s.supported_video_systems,
  s.charger_battery_chemistries,
  s.charger_min_cells,
  s.charger_max_cells,
  s.charger_connectors,
  s.charging_connectors,
  s.device_signal_interface,
  s.device_min_voltage_v,
  s.device_max_voltage_v
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

delete from public.catalogue_public_runtime_products where true;
insert into public.catalogue_public_runtime_products
select * from public.catalogue_runtime_products;
