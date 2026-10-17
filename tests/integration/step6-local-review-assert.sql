-- Local-only revision of evidence provenance; never execute on Production.
\set ON_ERROR_STOP on
begin;
do $assert$
begin
  if (select count(*) from public.catalogue_products)<>4
    or (select count(*) from public.catalogue_spec_evidence)<>13
    or (select count(*) from public.catalogue_spec_evidence
      where verification_status='pending_review')<>13
    or (select count(*) from public.catalogue_identity_evidence
      where verification_status='pending_review')<>4
    or exists(select 1 from public.catalogue_offers)
    or exists(select 1 from public.catalogue_product_images)
    or exists(select 1 from public.catalogue_products where selectable)
    or exists(select 1 from public.catalogue_public_runtime_products)
    then raise exception 'Step 6 local review is not fully pending/nonpublic'; end if;

  -- Canonical voltage-labelled fields refer to cell counts; never persist
  -- nominal volts as their structured field evidence.
  if (select e.value from public.catalogue_spec_evidence e
      join public.catalogue_products p on p.id=e.product_id
      where p.category='battery' and e.field_key='voltage') <> '3'::jsonb
  then raise exception 'Battery voltage field must mean 3 cells, not 11.1 V'; end if;
  if (select e.value from public.catalogue_spec_evidence e
      join public.catalogue_products p on p.id=e.product_id
      where p.category='esc' and e.field_key='minVoltage') <> '3'::jsonb
  then raise exception 'ESC minVoltage must mean 3 cells'; end if;
  if (select e.value from public.catalogue_spec_evidence e
      join public.catalogue_products p on p.id=e.product_id
      where p.category='esc' and e.field_key='maxVoltage') <> '6'::jsonb
  then raise exception 'ESC maxVoltage must mean 6 cells'; end if;
  if (select count(*) from public.catalogue_spec_evidence
      where product_id in (select id from public.catalogue_products where category='esc')
      and field_key='escInput'
      and value='"8-pin JST-SH 1.0mm ESC-to-FC cable"'::jsonb)<>1 then
    raise exception 'ESC-to-FC connector not independently sourced'; end if;
end
$assert$;
update public.catalogue_spec_evidence
set source_url='https://www.team-blacksheep.com/media/files/tbs-lucid-manual.pdf',
    conditions=jsonb_set(coalesce(conditions,'{}'::jsonb),'{provenance}',
      '"manufacturer-manual-pinout-review-pending"'::jsonb),
    caveats='Official TBS Lucid manual illustrates 8-PIN ESC Cable JST SH 1.0mm; exact variant and connector reviewer approval still pending'
where product_id in (select id from public.catalogue_products where category='esc')
  and field_key='escInput'
  and verification_status='pending_review';
do $assert$
begin
 if (select count(*) from public.catalogue_spec_evidence
     where source_url='https://www.team-blacksheep.com/media/files/tbs-lucid-manual.pdf'
       and field_key='escInput' and verification_status='pending_review')<>1
 then raise exception 'Manual-source update failed'; end if;
end
$assert$;
commit;
