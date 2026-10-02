-- Version-controlled category expansion for Required / Optional / Pilot Gear.
-- Intentionally not applied by this change.
alter type public.drone_product_category add value if not exists 'videoTransmitter';
alter type public.drone_product_category add value if not exists 'gps';
alter type public.drone_product_category add value if not exists 'buzzer';
alter type public.drone_product_category add value if not exists 'antenna';
alter type public.drone_product_category add value if not exists 'powerAccessory';
alter type public.drone_product_category add value if not exists 'optionalModule';
alter type public.drone_product_category add value if not exists 'radioTransmitter';
alter type public.drone_product_category add value if not exists 'fpvGoggles';
alter type public.drone_product_category add value if not exists 'batteryCharger';
alter type public.drone_product_category add value if not exists 'chargingAccessory';
