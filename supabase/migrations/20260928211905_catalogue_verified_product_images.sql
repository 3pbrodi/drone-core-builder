-- Curated exact-product image references for the current verified catalogue.
-- These are external manufacturer/retailer image URLs with source provenance.
-- No generated or synthetic imagery is used.

with verified_images(product_id,image_url,source_url,provenance) as (
  values
  ('catalogue-geprc-gep-mk5-o4-pro-dc-frame',
   'https://geprc.com/wp-content/uploads/2025/02/1_Main_0000-2-600x600.jpg',
   'https://geprc.com/product/gep-mk5-o4-pro-dc-frame/',
   'Exact-model GEPRC manufacturer product image.'),
  ('pilot-iflight-evoque-f5-v3-frame',
   'https://cdn.iflight.com/store/product/Drone-Frame/Nazgul-Evoque-F5/F5-V3/Nazgul-F5V3-M1.jpg?x-oss-process=image%2Fformat%2Cwebp',
   'https://shop.iflight.com/Nazgul-Evoque-F5-V3-Frame-Kit-Pro2407',
   'Exact-model iFlight manufacturer product image.'),
  ('catalogue-iflight-nazgul-xl5-eco-v1-1-frame',
   'https://iflight-rc.eu/cdn/shop/files/nazgul-xl5-eco-v11-frame-kit-661531.png?v=1727359888&width=300',
   'https://iflight-rc.eu/products/nazgul-xl5-v1-1-eco-frame-kit',
   'Exact-model iFlight Europe manufacturer product image.'),
  ('catalogue-iflight-xing-e-pro-2207-1800kv',
   'https://down-ph.img.susercontent.com/file/affa354ede6fba412c43cb0dc18481ce',
   'https://shopee.ph/iFlight-XING-E-Pro-2207-1800KV-2450KV-2750KV-Brushless-Motor-2~6S-Lipo-5mm-Hollow-Shaft-for-5~6inch-Propeller-Freestyle-i.616022087.19035309659',
   'Exact XING-E Pro 2207 image visibly labeled 1800KV; manufacturer identity cross-check.'),
  ('catalogue-iflight-xing2-2207-1750kv',
   'https://down-ph.img.susercontent.com/file/sg-11134202-7rcf9-ltdyam21o77ib5',
   'https://shopee.ph/IFlight-XING2-2207-2750KV-1750KV-4-6S-Brushless-Motor-W-5mm-Titanium-Alloy-Shaft-5inch-Propeller-f-i.1382004749.28019885352',
   'Exact XING2 2207 image visibly labeled 1750KV; manufacturer identity cross-check.'),
  ('pilot-iflight-xing2-2207-1855kv',
   'https://cdn.iflight.com/store/product/FPV-Motor/XING2-2207/XING2_2207-1855.M2.png?x-oss-process=image%2Fformat%2Cwebp',
   'https://shop.iflight.com/xing2-2207-4s-6s-fpv-motor-unibell-pro1464',
   'Exact 1855KV iFlight manufacturer product image.'),
  ('catalogue-geprc-gep-f405-hd-v3',
   'https://geprc.com/wp-content/uploads/2023/11/1_DeMain_0000-6-600x600.jpg',
   'https://geprc.com/product/gep-f405-hd-v3-flight-controller/',
   'Exact GEP-F405-HD V3 GEPRC manufacturer product image.'),
  ('catalogue-iflight-blitz-f7-v1-2',
   'https://iflight-rc.eu/cdn/shop/files/blitz-f7-v12-flight-controller-124044.png?v=1770807016&width=1000',
   'https://iflight-rc.eu/products/blitz-f7-v1-2-flight-controller',
   'Exact BLITZ F7 V1.2 iFlight Europe product image.'),
  ('pilot-speedybee-f405-v4',
   'https://cdn.shopify.com/s/files/1/0698/9525/8342/files/speedybee-f405-v4-stack---f4-v4-fc_1.jpg?v=1759318546',
   'https://www.lumenier.com/products/speedybee-f405-v4-flight-controller-30x30',
   'Exact individual SpeedyBee F405 V4 flight-controller image; stack-only imagery excluded.'),
  ('catalogue-geprc-taker-h60-bls-60a',
   'https://www.lacameraembarquee.fr/94821-large_default/esc-4en1-geprc-taker-h60-60a-6s-bls.jpg',
   'https://www.lacameraembarquee.fr/esc/16437-esc-4en1-geprc-taker-h60-60a-6s-bls.html',
   'Exact individual GEPRC TAKER H60 BLS 60A ESC image.'),
  ('catalogue-iflight-blitz-e55s',
   'https://iflight-rc.eu/cdn/shop/products/blitz-e55s-4in1-esc-812370.png?v=1715157342&width=1000',
   'https://iflight-rc.eu/products/blitz-e55s-4in1-esc',
   'Exact BLITZ E55S iFlight Europe product image.'),
  ('pilot-speedybee-bls-55a',
   'https://bsswebshop.com/cdn/shop/files/8385-3_8385-esc-speedybee-bls-55a-30x30-4-in-1.jpg?v=1755823592&width=1946',
   'https://bsswebshop.com/products/esc-speedybee-bls-55a-30x30-4-in-1',
   'Exact individual SpeedyBee BLS 55A ESC image; V5/OX32 and stack imagery excluded.'),
  ('catalogue-hqprop-5x4.3x3v1s',
   'https://www.defiancerc.com/cdn/shop/products/HQ_Prop_Durable_5x4_3x3_V1S_PC_5_3_Blade_Propellers_0.jpg?v=1658200134',
   'https://www.defiancerc.com/products/hq-prop-durable-5x4-3x3-v1s-pc-5-3-blade-propellers',
   'Exact HQProp 5X4.3X3V1S image; manufacturer model/SKU cross-check.'),
  ('pilot-hqprop-5x4.3x3v2s-grey',
   'https://ueeshop.ly200-cdn.com/u_file/UPAJ/UPAJ828/2002/products/06/bfd63d959b.jpg',
   'https://www.hqprop.com/hq-freestyle-prop-5x43x3v2s-2cw2ccw-poly-carbonate-p0233.html',
   'Exact HQProp manufacturer product image.'),
  ('catalogue-iflight-nazgul-f5-prop',
   'https://iflight-rc.eu/cdn/shop/products/nazgul-f5-tri-blade-prop-919208.png?v=1692835086&width=300',
   'https://iflight-rc.eu/products/nazgul-f5-tri-blade-prop',
   'Exact Nazgul F5 iFlight Europe product image.'),
  ('pilot-cnhl-black-v2-1300-6s-130c',
   'https://phaserfpv.com.au/cdn/shop/files/CNHL-Black-Series-V2-0-1300mAh-22-2V-6S-130C-Lipo-Battery-with-XT60.jpg?v=1731307830',
   'https://phaserfpv.com.au/products/cnhl-black-series-v2-0-1300mah-22-2v-6s-130c-lipo-battery-with-xt60',
   'Exact CNHL Black V2 1300mAh 6S 130C XT60 image; manufacturer identity cross-check.'),
  ('catalogue-tattu-rline-v5-1200-6s-150c',
   'https://cdn11.bigcommerce.com/s-99ohneivnb/images/stencil/1280x1280/products/3071/10837/_1__30719.1654074347.jpg?c=1',
   'https://genstattu.com/tattu-r-line-version-5-0-1200mah-6s-150c-22-2v-lipo-battery-pack-with-xt60-plug/',
   'Exact Tattu manufacturer product image.'),
  ('catalogue-tattu-rline-v5-1550-6s-150c',
   'https://gensace.de/cdn/shop/files/Tattu_R-Line_Version_5.0_1550mAh_22.2V_150C_6S_Lipo_Battery_Pack_with_XT60_Plug.png?v=1746528304&width=1600',
   'https://gensace.de/products/tattu-r-line-version-5-0-1550mah-22-2v-150c-6s1p-lipo-battery-pack-with-xt60-plug',
   'Exact Tattu/Gens Ace regional 1550mAh 6S 150C product image.'),
  ('catalogue-foxeer-razer-mini-v3',
   'https://cdn11.bigcommerce.com/s-afq6npz/images/stencil/1280x1280/products/21722/57772/15-38-15-669774e7e71ff-images-800x800__42162.1726478184.jpg?c=2',
   'https://www.foxeer.com/foxeer-razer-mini-v3-fpv-camera-g-593',
   'Exact Foxeer Razer Mini V3 image; manufacturer SKU HS1275 cross-check.'),
  ('pilot-runcam-phoenix-2',
   'https://www.hobbyrc.co.uk/images/thumbs/0012352_runcam-phoenix-2-fpv-camera.jpeg',
   'https://www.hobbyrc.co.uk/runcam-phoenix-2-fpv-camera',
   'Exact RunCam Phoenix 2 image; manufacturer identity cross-check.'),
  ('catalogue-runcam-phoenix-2-se-v2',
   'https://cdn11.bigcommerce.com/s-m8o52p/images/stencil/600x600/products/395/2196/034__60724.1715072984.jpg?c=3',
   'https://shop.runcam.com/runcam-phoenix-2-special-edition/',
   'Exact RunCam manufacturer-store image; page identifies Phoenix 2 SE V2.'),
  ('catalogue-radiomaster-rp1-v2-lbt',
   'https://www.unmannedtechshop.co.uk/cdn/shop/files/Radiomaster-RP1-ELRS-RX-3.jpg?v=1753833176&width=1445',
   'https://www.radiomasterrc.com/products/rp1-expresslrs-2-4ghz-nano-receiver',
   'Exact RP1 V2 hardware image; manufacturer verifies LBT SKU HP0157.RX-RP1-V2-LBT.'),
  ('catalogue-tbs-crossfire-diversity-nano-rx',
   'https://maxterdrone.com/3509-large_default/tbs-crossfire-diversity-nano-rx.jpg',
   'https://www.team-blacksheep.com/products/prod%3Axf_nano_div_rx',
   'Exact TBS Crossfire Diversity Nano RX image; manufacturer identity cross-check.'),
  ('pilot-tbs-crossfire-nano-rx',
   'https://www.helicomicro.com/wp-content/uploads/2018/02/tbs-crossfire-nano-rx-01.jpg',
   'https://www.team-blacksheep.com/products/prod%3Acrossfire_nano_rx',
   'Exact TBS Crossfire Nano RX image; manufacturer identity cross-check.')
)
insert into public.catalogue_product_images(
  product_id,image_url,source_url,alt_text,
  exact_model_verified,verification_status,provenance,
  primary_image,license_name,license_url,captured_at
)
select
  v.product_id,v.image_url,v.source_url,p.display_name,
  true,'verified',v.provenance,true,null,null,now()
from verified_images v
join public.catalogue_products p on p.id=v.product_id
where p.record_class='canonical'
  and p.identity_status='verified'
  and p.verification_status='verified'
  and p.selectable
  and not exists (
    select 1
    from public.catalogue_product_images i
    where i.product_id=v.product_id
      and i.image_url=v.image_url
      and i.exact_model_verified
      and i.verification_status='verified'
  );
