\set ON_ERROR_STOP on
select jsonb_build_object(
 'migrationVersions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'relations',(select jsonb_agg(n.nspname||'.'||c.relname||':'||c.relkind::text||':'||c.relrowsecurity::text order by n.nspname,c.relname)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p','v','m')),
 'columns',(select jsonb_agg(c.table_name||'.'||c.column_name||':'||c.data_type||':'||c.is_nullable||':'||coalesce(c.column_default,'') order by c.table_name,c.ordinal_position)
 from information_schema.columns c where c.table_schema='public'),
 'indexes',(select jsonb_agg(tablename||':'||indexname||':'||indexdef order by tablename,indexname)
 from pg_indexes where schemaname='public'),
 'constraints',(select jsonb_agg(c.relname||':'||con.conname||':'||pg_get_constraintdef(con.oid) order by c.relname,con.conname)
 from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
 'policies',(select jsonb_agg(tablename||':'||policyname||':'||cmd||':'||roles::text||':'||coalesce(qual,'')||':'||coalesce(with_check,'') order by tablename,policyname)
 from pg_policies where schemaname='public'),
 'triggers',(select jsonb_agg(n.nspname||'.'||c.relname||':'||tg.tgname||':'||pg_get_triggerdef(tg.oid) order by n.nspname,c.relname,tg.tgname)
 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where not tg.tgisinternal and (n.nspname='public' or (n.nspname='auth' and tg.tgname='on_auth_user_created'))),
 'functions',(select jsonb_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'||
 ':'||p.prosecdef::text||':'||coalesce(array_to_string(p.proconfig,','),'') order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='catalogue_internal' or (n.nspname='public' and (p.proname like 'catalogue_%' or p.proname in ('handle_new_user','set_updated_at','set_catalogue_updated_at')))),
 'functionHashes',(select jsonb_object_agg(n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='catalogue_internal' or (n.nspname='public' and (p.proname like 'catalogue_%' or p.proname in ('handle_new_user','set_updated_at','set_catalogue_updated_at')))),
 'enums',(select jsonb_agg(n.nspname||'.'||t.typname||':'||e.enumlabel order by n.nspname,t.typname,e.enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public'),
 'schemaPrivateGrant',(select coalesce(n.nspacl::text,'') from pg_namespace n where n.nspname='catalogue_internal'),
 'serviceUsage',has_schema_privilege('service_role','catalogue_internal','USAGE'),
 'anonUsage',has_schema_privilege('anon','catalogue_internal','USAGE'),
 'authenticatedUsage',has_schema_privilege('authenticated','catalogue_internal','USAGE'),
 'cron',(select jsonb_agg(jobname||':'||schedule||':'||command||':'||active::text order by jobname) from cron.job where jobname like 'catalogue_%' or jobname like 'catalogue-%')
) as snapshot;
