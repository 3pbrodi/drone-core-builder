-- DroneCores catalogue Phase E: camera and receiver technical fields
-- Local migration only. Do not apply to a remote Supabase project without explicit approval.

alter table public.catalogue_product_specs
  add column camera_video_interface text,
  add column camera_min_voltage_v numeric(8, 3)
    check (camera_min_voltage_v is null or camera_min_voltage_v > 0),
  add column camera_max_voltage_v numeric(8, 3)
    check (camera_max_voltage_v is null or camera_max_voltage_v > 0),
  add column camera_width_mm numeric(8, 3)
    check (camera_width_mm is null or camera_width_mm > 0),
  add column camera_height_mm numeric(8, 3)
    check (camera_height_mm is null or camera_height_mm > 0),
  add column camera_depth_mm numeric(8, 3)
    check (camera_depth_mm is null or camera_depth_mm > 0),
  add column fc_camera_video_interfaces text[],
  add column fc_camera_power_voltages_v numeric(8, 3)[],
  add column receiver_frequency_min_mhz numeric(10, 3)
    check (receiver_frequency_min_mhz is null or receiver_frequency_min_mhz > 0),
  add column receiver_frequency_max_mhz numeric(10, 3)
    check (receiver_frequency_max_mhz is null or receiver_frequency_max_mhz > 0),
  add column receiver_min_voltage_v numeric(8, 3)
    check (receiver_min_voltage_v is null or receiver_min_voltage_v > 0),
  add column receiver_max_voltage_v numeric(8, 3)
    check (receiver_max_voltage_v is null or receiver_max_voltage_v > 0),
  add column receiver_signal_interface text,
  add column receiver_width_mm numeric(8, 3)
    check (receiver_width_mm is null or receiver_width_mm > 0),
  add column receiver_height_mm numeric(8, 3)
    check (receiver_height_mm is null or receiver_height_mm > 0),
  add column receiver_depth_mm numeric(8, 3)
    check (receiver_depth_mm is null or receiver_depth_mm > 0),
  add column fc_receiver_signal_interfaces text[],
  add column fc_receiver_power_voltages_v numeric(8, 3)[];

alter table public.catalogue_product_specs
  add constraint catalogue_product_specs_camera_voltage_range_check
    check (
      camera_min_voltage_v is null
      or camera_max_voltage_v is null
      or camera_min_voltage_v <= camera_max_voltage_v
    ),
  add constraint catalogue_product_specs_receiver_frequency_range_check
    check (
      receiver_frequency_min_mhz is null
      or receiver_frequency_max_mhz is null
      or receiver_frequency_min_mhz <= receiver_frequency_max_mhz
    ),
  add constraint catalogue_product_specs_receiver_voltage_range_check
    check (
      receiver_min_voltage_v is null
      or receiver_max_voltage_v is null
      or receiver_min_voltage_v <= receiver_max_voltage_v
    ),
  add constraint catalogue_product_specs_fc_camera_interfaces_nonempty
    check (
      fc_camera_video_interfaces is null
      or cardinality(fc_camera_video_interfaces) > 0
    ),
  add constraint catalogue_product_specs_fc_camera_power_nonempty
    check (
      fc_camera_power_voltages_v is null
      or cardinality(fc_camera_power_voltages_v) > 0
    ),
  add constraint catalogue_product_specs_fc_receiver_interfaces_nonempty
    check (
      fc_receiver_signal_interfaces is null
      or cardinality(fc_receiver_signal_interfaces) > 0
    ),
  add constraint catalogue_product_specs_fc_receiver_power_nonempty
    check (
      fc_receiver_power_voltages_v is null
      or cardinality(fc_receiver_power_voltages_v) > 0
    );

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
  s.fc_receiver_power_voltages_v
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

revoke all on public.catalogue_runtime_products from anon, authenticated;
grant select on public.catalogue_runtime_products to service_role;
