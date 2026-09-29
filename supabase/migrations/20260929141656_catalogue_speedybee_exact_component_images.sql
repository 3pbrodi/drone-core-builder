-- Replace shared SpeedyBee stack imagery with exact component-specific
-- manufacturer images while preserving the official product-page provenance.

update public.catalogue_product_images
set
  image_url = 'https://store-fhxxhuiq8q.mybigcommerce.com/product_images/img_SpeedyBee_F405_V4_Stack/SB_F405V4-Other-10.jpg',
  source_url = 'https://www.speedybee.com/speedybee-f405-v4-bls-55a-30x30-fc-esc-stack/',
  alt_text = 'SpeedyBee F405 V4 30x30 Flight Controller',
  exact_model_verified = true,
  verification_status = 'verified',
  primary_image = true,
  provenance = 'Exact F405 V4 Flight Controller image from the official SpeedyBee F405 V4/BLS 55A product page (Option 2).'
where id = '855aa52c-522d-4cbe-b669-21f01ca8818f'
  and product_id = 'pilot-speedybee-f405-v4';

update public.catalogue_product_images
set
  image_url = 'https://store-fhxxhuiq8q.mybigcommerce.com/product_images/img_SpeedyBee_F405_V4_Stack/SB_F405V4-Other-8.jpg',
  source_url = 'https://www.speedybee.com/speedybee-f405-v4-bls-55a-30x30-fc-esc-stack/',
  alt_text = 'SpeedyBee BLS 55A 30x30 4-in-1 ESC',
  exact_model_verified = true,
  verification_status = 'verified',
  primary_image = true,
  provenance = 'Exact BLS 55A 4-in-1 ESC front/back image from the official SpeedyBee F405 V4/BLS 55A product page.'
where id = '3124055f-d089-4c04-b942-d2fb3976a3a3'
  and product_id = 'pilot-speedybee-bls-55a';
