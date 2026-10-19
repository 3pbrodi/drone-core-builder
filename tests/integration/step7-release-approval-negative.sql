-- Step 7 QA-only negative tests after staging, proof and exact-dedupe.
-- Never execute against Production.
\set ON_ERROR_STOP on
begin;

do $audit$
declare p record; v_count integer;
begin
  if (select count(*) from supabase_migrations.schema_migrations)<>24
  then raise exception 'Step7 migration was not applied to disposable DB'; end if;
  if (select count(*) from public.catalogue_products where record_class='candidate' and selectable=false)<>4
  or exists (select 1 from public.catalogue_products where selectable)
  or exists (select 1 from public.catalogue_offers)
  or exists (select 1 from public.catalogue_release_reviews)
  then raise exception 'Step7 QA must start with four unpublished candidates, zero offers and no approvals'; end if;
  if not (select c.relrowsecurity
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='catalogue_release_reviews')
  then raise exception 'Release review RLS is disabled'; end if;
  if has_table_privilege('anon','public.catalogue_release_reviews','SELECT')
    or has_table_privilege('authenticated','public.catalogue_release_reviews','INSERT')
  then raise exception 'QA release-review table unexpectedly exposed'; end if;

  for p in select id from public.catalogue_products loop
    if not ('Step 7 release review missing; owner and media approval required.'
      = any(public.catalogue_step7_release_blockers(p.id))) then
      raise exception 'Step 7 review gate unexpectedly open for %',p.id;
    end if;
    if not ('Step 7 release review missing; owner and media approval required.'
      = any(public.catalogue_publication_blockers(p.id))) then
      raise exception 'Step 7 integrated DB publication gate was bypassed for %',p.id;
    end if;
  end loop;
end
$audit$;

-- Deliberately synthetic "approved" state to prove an owner attestation and
-- neutral icon alone do not permit a release WITHOUT a fresh exact EU offer.
-- Entire transaction is ROLLED BACK below; no approvals survive.
insert into public.catalogue_release_reviews(
 product_id,identity_variant_pack_approved,identity_reviewed_by,identity_reviewed_at,
 media_mode,media_policy_approved,media_reviewed_by,media_reviewed_at,
 offer_id,offer_exact_variant_pack_approved,
 owner_approved,owner_approved_by,owner_approval_reference,owner_approved_at,notes
) values (
 (select id from public.catalogue_products where category='propellers' limit 1),
 true,'SYNTHETIC-TEST-ONLY',now(),
 'neutral_icon',true,'SYNTHETIC-TEST-ONLY',now(),
 null,false,
 true,'SYNTHETIC-TEST-ONLY','SYNTHETIC-TEST-ONLY-NOT-AUTHORIZATION',now(),
 'This is not user permission; transaction is rolled back'
);

do $negative$
declare
 v text;
 blocked boolean := false;
 blockers text[];
begin
 select id into v from public.catalogue_products where category='propellers' limit 1;
 blockers:=public.catalogue_step7_release_blockers(v);
 if not ('No specifically approved EU offer selected.'=any(blockers))
 then raise exception 'Missing exact checked EU offer did not block release'; end if;
 if 'Step 7 release review missing; owner and media approval required.'=any(blockers)
 then raise exception 'Synthetic-review path did not execute'; end if;
 begin
  perform public.catalogue_publish_product(v,'SYNTHETIC-TEST-ONLY','MUST FAIL');
 exception when others then
  if SQLERRM like 'Publication blocked:%' then blocked:=true;
  else raise;
  end if;
 end;
 if not blocked then raise exception 'UNSAFE: synthetic approval bypassed catalogue publication'; end if;
 if exists(select 1 from public.catalogue_products where selectable)
 then raise exception 'UNSAFE: product was published'; end if;
end
$negative$;
rollback;

-- Prove all synthetic approvals were rolled back.
do $final$
begin
 if exists(select 1 from public.catalogue_release_reviews)
 or exists(select 1 from public.catalogue_products where selectable)
 or exists(select 1 from public.catalogue_offers)
 then raise exception 'QA synthetic review was not fully rolled back'; end if;
end
$final$;

select jsonb_build_object(
 'schemaMigrations',(select count(*) from supabase_migrations.schema_migrations),
 'candidates',(select count(*) from public.catalogue_products where record_class='candidate'),
 'approvalRecords',(select count(*) from public.catalogue_release_reviews),
 'approvedOffers',(select count(*) from public.catalogue_offers),
 'selectable',(select count(*) from public.catalogue_products where selectable),
 'step7Blockers',(select count(*) from public.catalogue_products p
     where 'Step 7 release review missing; owner and media approval required.'
     = any(public.catalogue_publication_blockers(p.id))),
 'syntheticOwnerApprovalTest','blocked_and_rolled_back'
)::text as step7_gate_audit;
