-- DRAFT DATA SAFETY MIGRATION. DO NOT DEPLOY WITHOUT OWNER APPROVAL.
-- Existing published product photographs lack recorded reuse licenses. On
-- deployment they would fall back to the neutral ImageOff icon.
-- Existing offers older than 24h would not be selected at snapshot refresh.
begin;
create or replace view public.catalogue_runtime_products
with (security_invoker=true)
as
 SELECT p.id,
    p.category,
    p.display_name,
    p.spec_summary,
    p.weight_grams,
    m.name AS manufacturer_name,
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
    img.alt_text AS image_alt,
    img.source_url AS image_source_url,
    offer.price_amount,
    offer.currency,
    offer.stock_status,
    offer.product_url AS offer_url,
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
    offer.region AS offer_region,
    p.record_class
   FROM catalogue_products p
     LEFT JOIN catalogue_manufacturers m ON m.id = p.manufacturer_id
     LEFT JOIN catalogue_product_specs s ON s.product_id = p.id
     LEFT JOIN LATERAL ( SELECT i.image_url,
            i.alt_text,
            i.source_url
           FROM catalogue_product_images i
          WHERE i.product_id = p.id AND i.exact_model_verified = true AND i.verification_status = 'verified'::catalogue_verification_status AND nullif(btrim(i.license_name), '') IS NOT NULL AND i.license_url ~* '^https://[^[:space:]]+$'
          ORDER BY i.primary_image DESC, i.updated_at DESC
         LIMIT 1) img ON true
     LEFT JOIN LATERAL ( SELECT o.price_amount,
            o.currency,
            o.stock_status,
            o.product_url,
            o.last_checked_at,
            o.region
           FROM catalogue_offers o
          WHERE o.product_id = p.id AND o.verification_status = 'verified'::catalogue_verification_status AND o.last_checked_at IS NOT NULL AND o.last_checked_at <= now() AND o.last_checked_at >= now() - interval '24 hours' AND o.currency = 'EUR'::text AND upper(TRIM(BOTH FROM COALESCE(o.region, ''::text))) = 'EU'::text
          ORDER BY (
                CASE o.stock_status
                    WHEN 'in_stock'::stock_status THEN 0
                    WHEN 'preorder'::stock_status THEN 1
                    WHEN 'backorder'::stock_status THEN 2
                    WHEN 'unknown'::stock_status THEN 3
                    ELSE 4
                END), o.last_checked_at DESC NULLS LAST, o.price_amount
         LIMIT 1) offer ON true
  WHERE p.record_class = 'canonical'::catalogue_record_class AND p.selectable = true AND p.identity_status = 'verified'::catalogue_verification_status AND p.verification_status = 'verified'::catalogue_verification_status AND p.lifecycle_status <> 'discontinued'::product_lifecycle_status;
;
delete from public.catalogue_public_runtime_products where true;
insert into public.catalogue_public_runtime_products
select * from public.catalogue_runtime_products;
commit;
