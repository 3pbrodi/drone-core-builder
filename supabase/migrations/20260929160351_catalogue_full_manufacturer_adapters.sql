-- Existing four adapters: convert to resumable full-catalogue discovery.
insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'iflight-eu-shopify-jsonld', 'manufacturer', 2, true, 500,
$json$
{
  "discoveryMode":"sitemap",
  "sitemapUrl":"https://shop.iflight.com/sitemap.xml",
  "manufacturer":"iFlight",
  "concurrency":3,
  "requestDelayMs":250,
  "retryAttempts":4,
  "retryBaseDelayMs":1000,
  "maxDiscoveredProducts":10000,
  "productUrlPatterns":["^https://shop[.]iflight[.]com/.+"],
  "excludePatterns":["/($|collections|pages|blogs|search|cart|account)","gift","replacement","spare","screw","strap","cable","adapter","antenna","mount","tool","case","bag","cover","led","gps","vtx","stack"],
  "categoryRules":[
    {"pattern":"flight[- _]?controller|(^|[^a-z])fc([^a-z]|$)","category":"flightController"},
    {"pattern":"(^|[^a-z])esc([^a-z]|$)","category":"esc"},
    {"pattern":"motor","category":"motors"},
    {"pattern":"frame","category":"frame"},
    {"pattern":"propeller|(^|[^a-z])prop([^a-z]|$)","category":"propellers"},
    {"pattern":"battery|lipo","category":"battery"},
    {"pattern":"camera","category":"camera"},
    {"pattern":"receiver|(^|[^a-z])rx([^a-z]|$)","category":"receiver"}
  ],
  "regexMappings":{
    "motor_kv":{"type":"integer","group":1,"pattern":"([0-9]{3,5})[ ]*KV"},
    "esc_amps":{"type":"number","group":1,"pattern":"([0-9]{2,3}(?:[.][0-9]+)?)[ ]*A(?:mp)?"},
    "battery_capacity_mah":{"type":"integer","group":1,"pattern":"([0-9]{3,5})[ ]*mAh"},
    "battery_cells":{"type":"integer","group":1,"pattern":"([0-9]{1,2})[ ]*S(?:1P)?"},
    "propeller_diameter_inches":{"type":"number","group":1,"pattern":"([2-9](?:[.][0-9]+)?)[ ]*(?:inch|inches|[\"])"}
  }
}
$json$::jsonb
from public.catalogue_sources where name='iFlight official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'radiomaster-shopify-jsonld', 'shopify', 2, true, 250,
$json$
{
  "discoveryMode":"shopify_products_json",
  "productsEndpoint":"https://radiomasterrc.com/products.json",
  "manufacturer":"RadioMaster",
  "retryAttempts":4,
  "retryBaseDelayMs":1000,
  "eligibilityPatternsAny":["receiver","expresslrs","elrs","(^|[^a-z])rp[0-9]+([^a-z]|$)","(^|[^a-z])er[0-9]+([^a-z]|$)"],
  "categoryRules":[
    {"pattern":"receiver|expresslrs|elrs|(^|[^a-z])rp[0-9]+([^a-z]|$)|(^|[^a-z])er[0-9]+([^a-z]|$)","category":"receiver"}
  ],
  "regexMappings":{
    "receiver_frequency_min_mhz":{"type":"number","group":1,"pattern":"([0-9]{3,4}(?:[.][0-9]+)?)[ ]*MHz"},
    "receiver_min_voltage_v":{"type":"number","group":1,"pattern":"([0-9](?:[.][0-9]+)?)[ ]*V"}
  }
}
$json$::jsonb
from public.catalogue_sources where name='RadioMaster official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'runcam-sitemap-jsonld', 'manufacturer', 2, true, 300,
$json$
{
  "discoveryMode":"sitemap",
  "sitemapUrl":"https://shop.runcam.com/xmlsitemap.php",
  "manufacturer":"RunCam",
  "concurrency":2,
  "requestDelayMs":400,
  "retryAttempts":4,
  "retryBaseDelayMs":1000,
  "productSitemapPatterns":["type=products"],
  "productUrlPatterns":["^https://shop[.]runcam[.]com/.+"],
  "excludePatterns":["cable","mount","lens","case","accessor","battery-bag","banner","shipping-fee","adapter"],
  "categoryRules":[
    {"pattern":"camera|runcam|phoenix|eagle|racer|night[- _]?eagle|swift|split","category":"camera"}
  ],
  "regexMappings":{
    "camera_width_mm":{"type":"number","group":1,"pattern":"(?:Size|Dimension)[^0-9]{0,20}([0-9]{2}(?:[.][0-9]+)?)"},
    "camera_min_voltage_v":{"type":"number","group":1,"pattern":"(?:Input|Power|Voltage)[^0-9]{0,20}([0-9](?:[.][0-9]+)?)[ ]*[-~]"}
  }
}
$json$::jsonb
from public.catalogue_sources where name='RunCam official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'cnhl-shopify-jsonld', 'shopify', 2, true, 250,
$json$
{
  "discoveryMode":"shopify_products_json",
  "productsEndpoint":"https://chinahobbyline.com/products.json",
  "manufacturer":"CNHL",
  "retryAttempts":4,
  "retryBaseDelayMs":1200,
  "eligibilityPatternsAny":[
    "fpv","drone","quadcopter",
    "(850|1000|1100|1200|1300|1500|1550|1800)[ ]*mah.*(4s|6s)",
    "(4s|6s).*(850|1000|1100|1200|1300|1500|1550|1800)[ ]*mah"
  ],
  "categoryRules":[{"pattern":".*","category":"battery"}],
  "regexMappings":{
    "connector":{"type":"string","group":1,"pattern":"Output[ ]*Connector[ ]*:?[^A-Za-z0-9]*([A-Za-z0-9/+.-]+(?:[ ]*Plug)?)"},
    "weight_grams":{"type":"number","group":1,"pattern":"(?:Approx[ ]*Weight[^:]{0,30}:|Weight[ ]*:?).{0,20}([0-9]+(?:[.][0-9]+)?)[ ]*g"},
    "battery_cells":{"type":"integer","group":1,"pattern":"(?:Voltage[^0-9]{0,30})?([0-9]{1,2})[ ]*(?:-?Cell|S1P|S)"},
    "battery_discharge_c":{"type":"number","group":1,"pattern":"Discharge[ ]*Rate[ ]*:?[ ]*([0-9]+(?:[.][0-9]+)?)C"},
    "battery_capacity_mah":{"type":"integer","group":1,"pattern":"(?:Capacity[ ]*:?[ ]*)?([0-9]{3,5})[ ]*mAh"}
  }
}
$json$::jsonb
from public.catalogue_sources where name='CNHL official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

-- Additional official manufacturers.
insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'geprc-sitemap-jsonld', 'manufacturer', 1, true, 500,
$json$
{
  "discoveryMode":"sitemap",
  "sitemapUrl":"https://geprc.com/wp-sitemap.xml",
  "manufacturer":"GEPRC",
  "concurrency":3,
  "requestDelayMs":250,
  "retryAttempts":4,
  "retryBaseDelayMs":1000,
  "productSitemapPatterns":["product-sitemap[.]xml"],
  "productUrlPatterns":["/product/"],
  "excludePatterns":["accessor","replacement","spare","arm-","screw","strap","cable","adapter","antenna","mount","tool","case","bag","cover","led","gps","vtx","stack"],
  "categoryRules":[
    {"pattern":"flight[- _]?controller|(^|[^a-z])fc([^a-z]|$)","category":"flightController"},
    {"pattern":"(^|[^a-z])esc([^a-z]|$)","category":"esc"},
    {"pattern":"motor","category":"motors"},
    {"pattern":"frame","category":"frame"},
    {"pattern":"propeller|(^|[^a-z])prop([^a-z]|$)","category":"propellers"},
    {"pattern":"battery|lipo","category":"battery"},
    {"pattern":"camera","category":"camera"},
    {"pattern":"receiver|(^|[^a-z])rx([^a-z]|$)","category":"receiver"}
  ],
  "regexMappings":{
    "motor_kv":{"type":"integer","group":1,"pattern":"([0-9]{3,5})[ ]*KV"},
    "esc_amps":{"type":"number","group":1,"pattern":"([0-9]{2,3}(?:[.][0-9]+)?)[ ]*A(?:mp)?"},
    "battery_capacity_mah":{"type":"integer","group":1,"pattern":"([0-9]{3,5})[ ]*mAh"},
    "battery_cells":{"type":"integer","group":1,"pattern":"([0-9]{1,2})[ ]*S(?:1P)?"}
  }
}
$json$::jsonb
from public.catalogue_sources where name='GEPRC official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'speedybee-sitemap-jsonld', 'manufacturer', 1, true, 300,
$json$
{
  "discoveryMode":"sitemap",
  "sitemapUrl":"https://www.speedybee.com/xmlsitemap.php",
  "manufacturer":"SpeedyBee",
  "concurrency":3,
  "requestDelayMs":300,
  "retryAttempts":4,
  "retryBaseDelayMs":1000,
  "productSitemapPatterns":["type=products"],
  "productUrlPatterns":["^https://www[.]speedybee[.]com/.+"],
  "excludePatterns":["accessor","cable","adapter","antenna","microsd","card","led","charger","tool","case","bag","stack"],
  "categoryRules":[
    {"pattern":"flight[- _]?controller|(^|[^a-z])fc([^a-z]|$)|f405|f7[0-9]{2}","category":"flightController"},
    {"pattern":"(^|[^a-z])esc([^a-z]|$)","category":"esc"},
    {"pattern":"motor","category":"motors"},
    {"pattern":"frame","category":"frame"}
  ],
  "regexMappings":{
    "motor_kv":{"type":"integer","group":1,"pattern":"([0-9]{3,5})[ ]*KV"},
    "esc_amps":{"type":"number","group":1,"pattern":"([0-9]{2,3}(?:[.][0-9]+)?)[ ]*A(?:mp)?"}
  }
}
$json$::jsonb
from public.catalogue_sources where name='SpeedyBee official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'hqprop-sitemap-jsonld', 'manufacturer', 1, true, 500,
$json$
{
  "discoveryMode":"sitemap",
  "sitemapUrl":"https://www.hqprop.com/sitemap.xml",
  "manufacturer":"HQProp",
  "concurrency":4,
  "requestDelayMs":150,
  "retryAttempts":4,
  "retryBaseDelayMs":800,
  "productUrlPatterns":["-p[0-9]+[.]html$"],
  "categoryRules":[{"pattern":".*","category":"propellers"}],
  "regexMappings":{
    "propeller_diameter_inches":{"type":"number","group":1,"pattern":"(?:HQProp[ ]*)?([0-9]+(?:[.][0-9]+)?)(?:x|X)"}
  }
}
$json$::jsonb
from public.catalogue_sources where name='HQProp official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'foxeer-sitemap-jsonld', 'manufacturer', 1, true, 500,
$json$
{
  "discoveryMode":"sitemap",
  "sitemapUrl":"https://www.foxeer.com/sitemap.xml",
  "manufacturer":"Foxeer",
  "concurrency":3,
  "requestDelayMs":250,
  "retryAttempts":4,
  "retryBaseDelayMs":1000,
  "productUrlPatterns":["-g-[0-9]+$"],
  "excludePatterns":["cable","case","lens","antenna","accessor","adapter","mount"],
  "categoryRules":[
    {"pattern":"camera|cam|predator|toothless|razer|cat[ -]?[0-9]|night","category":"camera"},
    {"pattern":"propeller|dalprop|(^|[^a-z])prop([^a-z]|$)","category":"propellers"}
  ]
}
$json$::jsonb
from public.catalogue_sources where name='Foxeer official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'tattu-sitemap-jsonld', 'manufacturer', 1, true, 300,
$json$
{
  "discoveryMode":"sitemap",
  "sitemapUrl":"https://www.genstattu.com/xmlsitemap.php",
  "manufacturer":"Tattu",
  "concurrency":3,
  "requestDelayMs":300,
  "retryAttempts":4,
  "retryBaseDelayMs":1000,
  "productSitemapPatterns":["type=products"],
  "productUrlPatterns":["^https://www[.]genstattu[.]com/.+"],
  "excludePatterns":["charger","bag","strap","accessor","cable","adapter"],
  "eligibilityPatternsAny":["fpv","drone","quadcopter","r-line","rline","4s","6s"],
  "categoryRules":[{"pattern":"battery|lipo|mah|4s|6s","category":"battery"}],
  "regexMappings":{
    "battery_capacity_mah":{"type":"integer","group":1,"pattern":"([0-9]{3,5})[ ]*mAh"},
    "battery_cells":{"type":"integer","group":1,"pattern":"([0-9]{1,2})[ ]*S(?:1P)?"},
    "battery_discharge_c":{"type":"number","group":1,"pattern":"([0-9]{2,3}(?:[.][0-9]+)?)[ ]*C"},
    "weight_grams":{"type":"number","group":1,"pattern":"(?:Weight|Net Weight)[^0-9]{0,20}([0-9]+(?:[.][0-9]+)?)[ ]*g"}
  }
}
$json$::jsonb
from public.catalogue_sources where name='Tattu official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();

insert into public.catalogue_source_adapters
  (source_id, adapter_key, adapter_type, version, active, max_batch_size, config)
select id, 'tbs-category-html', 'manufacturer', 1, true, 500,
$json$
{
  "discoveryMode":"category_html",
  "manufacturer":"Team BlackSheep",
  "concurrency":3,
  "requestDelayMs":250,
  "retryAttempts":4,
  "retryBaseDelayMs":1000,
  "listingUrls":[
    "https://www.team-blacksheep.com/shop/cat:battery",
    "https://www.team-blacksheep.com/shop/cat:motors",
    "https://www.team-blacksheep.com/shop/cat:props",
    "https://www.team-blacksheep.com/shop/cat:frames",
    "https://www.team-blacksheep.com/shop/cat:electronics-electronic-speed-controllers-esc",
    "https://www.team-blacksheep.com/shop/cat:electronics-flight-controllers-fc",
    "https://www.team-blacksheep.com/shop/cat:fpv-equipment-fpv-cameras",
    "https://www.team-blacksheep.com/shop/cat:rc-link-receivers",
    "https://www.team-blacksheep.com/shop/cat:cat_crossfire",
    "https://www.team-blacksheep.com/shop/cat:cat_tracer"
  ],
  "productUrlPatterns":["team-blacksheep[.]com/products/(?:prod|product):"],
  "excludePatterns":["antenna","adapter","cable","accessor","strap","screw","tool","case","bag","heatsink","startset","tx"],
  "categoryRules":[
    {"pattern":"flight[- _]?controller|(^|[^a-z])fc([^a-z]|$)","category":"flightController"},
    {"pattern":"(^|[^a-z])esc([^a-z]|$)","category":"esc"},
    {"pattern":"motor","category":"motors"},
    {"pattern":"frame","category":"frame"},
    {"pattern":"propeller|(^|[^a-z])prop([^a-z]|$)","category":"propellers"},
    {"pattern":"battery|lipo","category":"battery"},
    {"pattern":"camera","category":"camera"},
    {"pattern":"receiver|(^|[^a-z])rx([^a-z]|$)|crossfire.*nano|tracer.*nano","category":"receiver"}
  ]
}
$json$::jsonb
from public.catalogue_sources where name='Team BlackSheep official'
on conflict (adapter_key) do update set
  source_id=excluded.source_id, adapter_type=excluded.adapter_type, version=excluded.version,
  active=excluded.active, max_batch_size=excluded.max_batch_size, config=excluded.config, updated_at=now();
