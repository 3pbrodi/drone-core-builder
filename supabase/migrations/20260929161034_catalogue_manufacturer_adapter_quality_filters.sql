update public.catalogue_source_adapters
set version=3,
    config=(config - 'regexMappings') || jsonb_build_object(
      'excludeContentPatterns',
      coalesce(config->'excludeContentPatterns','[]'::jsonb) || '["gimbal","slipring"]'::jsonb
    ),
    updated_at=now()
where adapter_key='iflight-eu-shopify-jsonld';

update public.catalogue_source_adapters
set version=3,
    updated_at=now()
where adapter_key='radiomaster-shopify-jsonld';

update public.catalogue_source_adapters
set version=3,
    config=config || jsonb_build_object(
      'excludeContentPatterns',
      coalesce(config->'excludeContentPatterns','[]'::jsonb) || '["bracket","fov 140 degree","fov 130 degree"]'::jsonb
    ),
    updated_at=now()
where adapter_key='runcam-sitemap-jsonld';

update public.catalogue_source_adapters
set version=3,
    config=config || jsonb_build_object(
      'categoryRules','[{"pattern":"battery|lipo|mah","category":"battery"}]'::jsonb,
      'excludeContentPatterns',
      coalesce(config->'excludeContentPatterns','[]'::jsonb) || '["(^|[^a-z])esc([^a-z]|$)","motor","flight controller","receiver","propeller","frame kit"]'::jsonb
    ),
    updated_at=now()
where adapter_key='cnhl-shopify-jsonld';

update public.catalogue_source_adapters
set version=2,
    config=config - 'regexMappings',
    updated_at=now()
where adapter_key='geprc-sitemap-jsonld';

update public.catalogue_source_adapters
set version=2,
    config=(config - 'regexMappings') || jsonb_build_object(
      'excludeContentPatterns',
      coalesce(config->'excludeContentPatterns','[]'::jsonb) || '["3d printed","printed parts","replacement part"]'::jsonb
    ),
    updated_at=now()
where adapter_key='speedybee-sitemap-jsonld';

update public.catalogue_source_adapters
set version=2, updated_at=now()
where adapter_key='hqprop-sitemap-jsonld';

update public.catalogue_source_adapters
set version=2,
    config=config || jsonb_build_object(
      'excludeContentPatterns',
      coalesce(config->'excludeContentPatterns','[]'::jsonb) || '["bracket","holder","protection"]'::jsonb
    ),
    updated_at=now()
where adapter_key='foxeer-sitemap-jsonld';

update public.catalogue_source_adapters
set version=2, updated_at=now()
where adapter_key='tattu-sitemap-jsonld';

update public.catalogue_source_adapters
set version=2, updated_at=now()
where adapter_key='tbs-category-html';
