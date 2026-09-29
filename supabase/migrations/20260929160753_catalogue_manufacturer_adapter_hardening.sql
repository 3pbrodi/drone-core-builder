update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludePatterns', '["/($|collections|pages|blogs|search|cart|account)","gift","replacement","spare","screw","strap","cable","adapter","antenna","mount","tool","case","bag","cover","led","gps","vtx","stack","charger"]'::jsonb,
  'excludeContentPatterns', '["charger","charging board","replacement","spare part","screw","strap","cable","adapter","antenna","mount","tool","case","bag","cover","stack"]'::jsonb
), updated_at=now()
where adapter_key='iflight-eu-shopify-jsonld';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludeContentPatterns', '["safety switch","replacement","switch kit","gimbal","transmitter module","tx module","radio controller","antenna","case","battery","charger","accessory"]'::jsonb
), updated_at=now()
where adapter_key='radiomaster-shopify-jsonld';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludeContentPatterns', '["lens","strap","protective cover","cover","case","mount","cable","accessory","battery","helmet","banner","shipping fee","adapter","glass"]'::jsonb,
  'categoryRules', '[{"pattern":"camera|phoenix|eagle|racer|night[- _]?eagle|swift|split|thumb|nano[- _]?4k","category":"camera"}]'::jsonb
), updated_at=now()
where adapter_key='runcam-sitemap-jsonld';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludeContentPatterns', '["accessory","replacement","spare","arm only","screw","strap","cable","adapter","antenna","mount","tool","case","bag","cover","led","gps","vtx","stack"]'::jsonb
), updated_at=now()
where adapter_key='geprc-sitemap-jsonld';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludeContentPatterns', '["stack","cable","adapter","antenna","microsd","sd card","led","charger","tool","case","bag","wire","accessory"]'::jsonb
), updated_at=now()
where adapter_key='speedybee-sitemap-jsonld';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludeContentPatterns', '["race gate","gate kit","display stand","stand only","tool","bag","shirt","banner"]'::jsonb,
  'categoryRules', '[{"pattern":"prop|pusher|cw|ccw|thin[- _]?electric|ethix|juicy|whoop","category":"propellers"}]'::jsonb
), updated_at=now()
where adapter_key='hqprop-sitemap-jsonld';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludeContentPatterns', '["protection glass","glass only","lens","cable","case","mount","antenna","adapter","accessory"]'::jsonb
), updated_at=now()
where adapter_key='foxeer-sitemap-jsonld';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'productUrlPatterns', '["^https://(?:www[.])?genstattu[.]com/.+"]'::jsonb,
  'excludeContentPatterns', '["charger","combo","adapter","airsoft","hardcase","jump starter","powersports","car battery","boat battery","uav battery","industrial"]'::jsonb,
  'eligibilityPatternsAny', '[
    "tattu.*(450|650|750|850|1000|1050|1100|1200|1300|1400|1480|1500|1550|1800|2200)[ ]*mah.*(4s|5s|6s)",
    "tattu.*(4s|5s|6s).*(450|650|750|850|1000|1050|1100|1200|1300|1400|1480|1500|1550|1800|2200)[ ]*mah",
    "r[- ]?line.*(4s|5s|6s)"
  ]'::jsonb
), updated_at=now()
where adapter_key='tattu-sitemap-jsonld';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludeContentPatterns', '["antenna","adapter","cable","accessory","strap","screw","tool","case","bag","heatsink","starter set","transmitter","tx module"]'::jsonb
), updated_at=now()
where adapter_key='tbs-category-html';

update public.catalogue_source_adapters
set config = config || jsonb_build_object(
  'excludeContentPatterns', '["charger","bag","strap","accessory","cable","adapter","hardcase","car battery","boat battery"]'::jsonb
), updated_at=now()
where adapter_key='cnhl-shopify-jsonld';
