-- Review infrastructure only. No product/pair approvals or hosted changes.
-- Rehearse transactionally against the current schema before any authorized rollout.
alter table public.catalogue_fc_esc_connection_evidence
  add column source_snapshot_id uuid references public.catalogue_source_snapshots(id) on delete restrict,
  add column source_url text,
  add column source_content_hash text,
  add column source_locator text,
  add column compatibility_scope text;
alter table public.catalogue_public_fc_esc_evidence
  add column source_snapshot_id uuid,
  add column source_url text,
  add column source_content_hash text,
  add column source_locator text,
  add column compatibility_scope text;
alter table public.catalogue_motor_propeller_evidence
  add column source_snapshot_id uuid references public.catalogue_source_snapshots(id) on delete restrict,
  add column source_url text,
  add column source_content_hash text,
  add column source_locator text,
  add column compatibility_scope text;
alter table public.catalogue_public_motor_propeller_evidence
  add column source_snapshot_id uuid,
  add column source_url text,
  add column source_content_hash text,
  add column source_locator text,
  add column compatibility_scope text;

create index catalogue_fc_esc_pair_snapshot_idx on public.catalogue_fc_esc_connection_evidence(source_snapshot_id) where source_snapshot_id is not null;
create index catalogue_motor_propeller_pair_snapshot_idx on public.catalogue_motor_propeller_evidence(source_snapshot_id) where source_snapshot_id is not null;

-- Existing snapshot INSERT ... SELECT * stays column-aligned. RLS/SELECT-only
-- grants are unchanged. Reviewer identifiers stay in private promotion events.
create function catalogue_internal.guard_pair_evidence_review()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  r jsonb := to_jsonb(new);
  previous jsonb;
  capture public.catalogue_source_snapshots%rowtype;
  left_id text;
  right_id text;
  left_category text;
  right_category text;
  conditions jsonb;
  minimum numeric;
  maximum numeric;
begin
  if tg_op = 'UPDATE' then
    previous := to_jsonb(old);
    if previous->>'source_snapshot_id' is not null and new.source_snapshot_id is null then
      raise exception 'Reviewed pair provenance cannot be removed.';
    end if;
    if old.verification_status = 'verified' and
       (r - array['verification_status','verified_at','updated_at']) is distinct from
       (previous - array['verification_status','verified_at','updated_at']) then
      new.verification_status := 'pending_review';
      new.verified_at := null;
    end if;
    -- Legacy rows retain their existing approval only while untouched.
    if old.verification_status = 'verified' and new.verification_status = 'verified'
       and r - array['updated_at'] = previous - array['updated_at'] then return new; end if;
  end if;
  if new.verification_status <> 'verified' then
    new.verified_at := null;
    return new;
  end if;
  select * into capture from public.catalogue_source_snapshots
    where id = new.source_snapshot_id for share;
  if not found or capture.source_id <> new.source_id
     or new.source_url is distinct from capture.source_url
     or new.source_content_hash is distinct from capture.content_hash
     or new.retrieved_at is distinct from capture.retrieved_at
     or new.source_content_hash !~ '^[a-f0-9]{64}$'
     or new.source_url !~ '^https://[^/@[:space:]]+([/:?]|$)'
     or nullif(trim(new.source_locator),'') is null
     or nullif(trim(new.compatibility_scope),'') is null
     or new.verified_at is null
     or new.verified_at > now() + interval '5 minutes'
     or new.retrieved_at > now() + interval '5 minutes'
     or new.retrieved_at > new.verified_at then
    raise exception 'Pair review requires exact captured source URL, SHA256, dates, locator and scope.';
  end if;
  perform 1 from public.catalogue_sources where id=new.source_id
    and verification_status='verified' and kind in ('manufacturer','manual') for share;
  if not found then raise exception 'Pair source is not a verified primary source.'; end if;
  if tg_table_name = 'catalogue_fc_esc_connection_evidence' then
    left_id := r->>'flight_controller_product_id'; right_id := r->>'esc_product_id';
    left_category := 'flightController'; right_category := 'esc';
    conditions := r->'details'->'operatingConditions';
  else
    left_id := r->>'motor_product_id'; right_id := r->>'propeller_product_id';
    left_category := 'motors'; right_category := 'propellers';
    conditions := r->'operating_conditions';
  end if;
  perform 1 from public.catalogue_products where id=left_id and category::text=left_category
    and identity_status='verified' and record_class='canonical' for share;
  if not found then raise exception 'Pair left product/category/identity is not verified.'; end if;
  perform 1 from public.catalogue_products where id=right_id and category::text=right_category
    and identity_status='verified' and record_class='canonical' for share;
  if not found then raise exception 'Pair right product/category/identity is not verified.'; end if;
  if exists(select 1 from (values (left_id),(right_id)) ids(id) where not exists(
    select 1 from public.catalogue_identity_evidence e join public.catalogue_sources s on s.id=e.source_id
    where e.product_id=ids.id and e.verification_status='verified' and e.exact_model_association
      and e.authority in ('manufacturer','official_documentation') and s.verification_status='verified')) then
    raise exception 'Pair products require current verified exact identity evidence.';
  end if;
  if not coalesce(capture.metadata->'productIds'  @> jsonb_build_array(left_id,right_id),false) then
    raise exception 'Capture must bind both exact product IDs.';
  end if;
  if conditions is null or jsonb_typeof(conditions) <> 'object' then
    raise exception 'Pair requires battery operating conditions.';
  end if;
  if jsonb_typeof(conditions->'batteryCells')='number' then
    minimum := (conditions->>'batteryCells')::numeric; maximum := minimum;
  elsif jsonb_typeof(conditions->'minBatteryCells')='number' and
        jsonb_typeof(conditions->'maxBatteryCells')='number' then
    minimum := (conditions->>'minBatteryCells')::numeric;
    maximum := (conditions->>'maxBatteryCells')::numeric;
  else raise exception 'Pair requires numeric battery operating conditions.';
  end if;
  if minimum < 1 or maximum > 24 or minimum <> trunc(minimum)
     or maximum <> trunc(maximum) or minimum > maximum then
    raise exception 'Invalid pair battery range.';
  end if;
  if (conditions ? 'minBatteryCells' and
      (jsonb_typeof(conditions->'minBatteryCells') <> 'number' or
       (conditions->>'minBatteryCells')::numeric > minimum)) or
     (conditions ? 'maxBatteryCells' and
      (jsonb_typeof(conditions->'maxBatteryCells') <> 'number' or
       (conditions->>'maxBatteryCells')::numeric < maximum)) then
    raise exception 'Contradictory pair battery aliases.';
  end if;
  if tg_op='INSERT' then raise exception 'Pair approvals require the native review RPC.'; end if;
  if not exists(select 1 from public.catalogue_promotion_events e
    where e.product_id=left_id and e.action='technical_review_completed'
      and case when e.notes like 'pair-evidence-review:%' then
        substring(e.notes from length('pair-evidence-review:')+1)::jsonb @> jsonb_build_object(
          'kind','pair_evidence_review','evidenceId',new.id,'decision','approve',
          'preimageSha256',encode(sha256(convert_to(previous::text,'UTF8')),'hex'))
        else false end) then
    raise exception 'Pair approvals require a current native review record.';
  end if;
  return new;
end $$;
revoke all on function catalogue_internal.guard_pair_evidence_review() from public,anon,authenticated;
create trigger catalogue_fc_esc_pair_review_guard before insert or update
  on public.catalogue_fc_esc_connection_evidence for each row
  execute function catalogue_internal.guard_pair_evidence_review();
create trigger catalogue_motor_propeller_pair_review_guard before insert or update
  on public.catalogue_motor_propeller_evidence for each row
  execute function catalogue_internal.guard_pair_evidence_review();

-- Optimistic fingerprint plus row lock prevents approving a stale dossier.
-- No SECURITY DEFINER: existing service_role table grants/RLS remain the boundary.
create function public.catalogue_review_pair_evidence(
  p_kind text, p_evidence_id uuid, p_decision text,
  p_reviewer text, p_notes text, p_expected_fingerprint text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  target_table text;
  record jsonb;
  product_id text;
  fingerprint text;
begin
  target_table := case p_kind when 'fc_esc_connection' then 'catalogue_fc_esc_connection_evidence'
    when 'motor_propeller' then 'catalogue_motor_propeller_evidence' end;
  if target_table is null or p_decision not in ('approve','revoke') or p_decision is null
     or nullif(trim(p_reviewer),'') is null or nullif(trim(p_notes),'') is null then
    raise exception 'Exact pair kind, decision, reviewer and documented review notes are required.';
  end if;
  execute format('select to_jsonb(e) from public.%I e where id=$1 for update',target_table)
    into record using p_evidence_id;
  if record is null then raise exception 'Pair evidence does not exist.'; end if;
  fingerprint := encode(sha256(convert_to(record::text,'UTF8')),'hex');
  if p_expected_fingerprint is distinct from fingerprint then
    raise exception 'Pair changed since review; refresh the exact preimage.';
  end if;
  if p_decision='approve' and record->>'verification_status' not in ('pending_review','unverified') then
    raise exception 'Only pending or unverified pairs can be approved.';
  end if;
  product_id := coalesce(record->>'flight_controller_product_id',record->>'motor_product_id');
  insert into public.catalogue_promotion_events(product_id,action,reviewer,notes,blockers_snapshot)
  values(product_id,'technical_review_completed',trim(p_reviewer),'pair-evidence-review:'||jsonb_build_object(
    'kind','pair_evidence_review','pairKind',p_kind,'evidenceId',p_evidence_id,
    'decision',p_decision,'preimageSha256',fingerprint,
    'sourceSnapshotId',record->>'source_snapshot_id','sourceSha256',record->>'source_content_hash',
    'scope',record->>'compatibility_scope','notes',trim(p_notes))::text,'[]');
  execute format('update public.%I set verification_status=$2::public.catalogue_verification_status,
    verified_at=case when $2=''verified'' then now() else null end where id=$1',target_table)
    using p_evidence_id,case when p_decision='approve' then 'verified' else 'pending_review' end;
  return jsonb_build_object('evidenceId',p_evidence_id,'decision',p_decision,
    'verificationStatus',case when p_decision='approve' then 'verified' else 'pending_review' end);
end $$;
revoke all on function public.catalogue_review_pair_evidence(text,uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.catalogue_review_pair_evidence(text,uuid,text,text,text,text) to service_role;

create function catalogue_internal.protect_pair_capture()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.catalogue_fc_esc_connection_evidence where source_snapshot_id=old.id)
     or exists(select 1 from public.catalogue_motor_propeller_evidence where source_snapshot_id=old.id) then
    raise exception 'Referenced pair source capture is immutable; add a new snapshot.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function catalogue_internal.protect_pair_capture() from public,anon,authenticated;
create trigger catalogue_pair_capture_immutable before update or delete
  on public.catalogue_source_snapshots for each row execute function catalogue_internal.protect_pair_capture();

-- Internal trigger needs owner rights when invoked from existing source/product
-- workflows. It grants no new exposed RPC or table privileges.
create function catalogue_internal.withdraw_changed_pair_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='catalogue_sources' then
    update public.catalogue_fc_esc_connection_evidence set verification_status='pending_review',verified_at=null
      where source_id=old.id and verification_status='verified';
    update public.catalogue_motor_propeller_evidence set verification_status='pending_review',verified_at=null
      where source_id=old.id and verification_status='verified';
  else
    update public.catalogue_fc_esc_connection_evidence set verification_status='pending_review',verified_at=null
      where (flight_controller_product_id=case when tg_table_name='catalogue_identity_evidence' then to_jsonb(old)->>'product_id' else old.id::text end or esc_product_id=case when tg_table_name='catalogue_identity_evidence' then to_jsonb(old)->>'product_id' else old.id::text end) and verification_status='verified';
    update public.catalogue_motor_propeller_evidence set verification_status='pending_review',verified_at=null
      where (motor_product_id=case when tg_table_name='catalogue_identity_evidence' then to_jsonb(old)->>'product_id' else old.id::text end or propeller_product_id=case when tg_table_name='catalogue_identity_evidence' then to_jsonb(old)->>'product_id' else old.id::text end) and verification_status='verified';
  end if;
  return null;
end $$;
revoke all on function catalogue_internal.withdraw_changed_pair_evidence() from public,anon,authenticated;
create trigger catalogue_pair_source_withdrawal after update on public.catalogue_sources
  for each row when ((old.verification_status,old.kind,old.base_url) is distinct from (new.verification_status,new.kind,new.base_url))
  execute function catalogue_internal.withdraw_changed_pair_evidence();
create trigger catalogue_pair_identity_withdrawal after update on public.catalogue_products
  for each row when ((old.identity_status,old.category,old.model,old.variant,old.manufacturer_id,
    old.manufacturer_sku,old.mpn,old.package_quantity,old.record_class) is distinct from
    (new.identity_status,new.category,new.model,new.variant,new.manufacturer_id,
    new.manufacturer_sku,new.mpn,new.package_quantity,new.record_class))
  execute function catalogue_internal.withdraw_changed_pair_evidence();

create trigger catalogue_pair_identity_evidence_withdrawal after update or delete on public.catalogue_identity_evidence
  for each row execute function catalogue_internal.withdraw_changed_pair_evidence();
