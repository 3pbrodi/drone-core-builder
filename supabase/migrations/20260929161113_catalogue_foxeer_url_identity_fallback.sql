update public.catalogue_source_adapters
set version=3,
    config=config || '{"preferUrlNameFallback":true}'::jsonb,
    updated_at=now()
where adapter_key='foxeer-sitemap-jsonld';
