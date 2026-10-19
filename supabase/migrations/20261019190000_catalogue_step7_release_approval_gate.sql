-- Step 7: publication review additions. Apply ONLY after approval.
-- In this branch the migration runs solely in disposable local Supabase.
-- Existing selectable products are unchanged; all FUTURE publication events
-- require explicit owner, media and verified fresh exact-merchant review.
begin;

create table public.catalogue_release_reviews (
  product_id text primary key references public.catalogue_products(id) on delete cascade,
  identity_variant_pack_approved boolean not null default false,
  identity_reviewed_by text,
  identity_reviewed_at timestamptz,
  media_mode text not null default 'neutral_icon'
    check (media_mode in ('neutral_icon','licensed_image')),
  media_policy_approved boolean not null default false,
  media_reviewed_by text,
  media_reviewed_at timestamptz,
  offer_id uuid references public.catalogue_offers(id) on delete set null,
  offer_exact_variant_pack_approved boolean not null default false,
  offer_reviewed_by text,
  offer_reviewed_at timestamptz,
  owner_approved boolean not null default false,
  owner_approved_by text,
  owner_approval_reference text,
  owner_approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalogue_release_reviews_offer_idx
  on public.catalogue_release_reviews(offer_id);

alter table public.catalogue_release_reviews enable row level security;
revoke all on public.catalogue_release_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.catalogue_release_reviews to service_role;

create or replace function public.catalogue_step7_release_blockers(p_product_id text)
returns text[]
language plpgsql stable security invoker
set search_path=public
as $fn$
declare
  blockers text[] := array[]::text[];
  review_record public.catalogue_release_reviews%rowtype;
  offer_record public.catalogue_offers%rowtype;
begin
  select * into review_record
  from public.catalogue_release_reviews
  where product_id=p_product_id;
  if not found then
    return array['Step 7 release review missing; owner and media approval required.'];
  end if;

  if not review_record.identity_variant_pack_approved
    or nullif(trim(coalesce(review_record.identity_reviewed_by,'')),'') is null
    or review_record.identity_reviewed_at is null then
    blockers:=array_append(blockers,'Exact identity, variant and pack review incomplete.');
  end if;

  if not review_record.media_policy_approved
    or nullif(trim(coalesce(review_record.media_reviewed_by,'')),'') is null
    or review_record.media_reviewed_at is null then
    blockers:=array_append(blockers,'Legal media / neutral-icon policy review missing.');
  elsif review_record.media_mode='neutral_icon' then
    if exists(select 1 from public.catalogue_product_images i
      where i.product_id=p_product_id and i.verification_status='verified') then
      blockers:=array_append(blockers,
        'Neutral-icon publication requires no verified external product image.');
    end if;
  elsif review_record.media_mode='licensed_image' then
    if not exists(select 1 from public.catalogue_product_images i
      where i.product_id=p_product_id and i.verification_status='verified'
        and i.exact_model_verified=true
        and nullif(trim(coalesce(i.license_name,'')),'') is not null
        and i.license_url ~* '^https://[^[:space:]]+$') then
      blockers:=array_append(blockers,
        'Licensed model-matching image with license evidence missing.');
    end if;
  end if;

  if not review_record.owner_approved
    or nullif(trim(coalesce(review_record.owner_approved_by,'')),'') is null
    or nullif(trim(coalesce(review_record.owner_approval_reference,'')),'') is null
    or review_record.owner_approved_at is null then
    blockers:=array_append(blockers,
      'Explicit owner publication authorization not recorded.');
  end if;

  if review_record.offer_id is null then
    blockers:=array_append(blockers,'No specifically approved EU offer selected.');
  else
    select * into offer_record from public.catalogue_offers
    where id=review_record.offer_id and product_id=p_product_id;
    if not found then
      blockers:=array_append(blockers,'Reviewed offer does not match product.');
    else
      if offer_record.verification_status <> 'verified'
        or offer_record.currency <> 'EUR'
        or upper(trim(coalesce(offer_record.region,''))) <> 'EU'
        or offer_record.price_amount is null
        or offer_record.price_amount <= 0
        or offer_record.product_url !~* '^https://[^[:space:]]+$'
      then
        blockers:=array_append(blockers,
          'Selected offer is not verified, positive-priced EU/EUR and HTTPS.');
      end if;
      if offer_record.stock_status <> 'in_stock' then
        blockers:=array_append(blockers,'Selected offer not confirmed in stock.');
      end if;
      if offer_record.last_checked_at is null
        or offer_record.last_checked_at > now()
        or offer_record.last_checked_at < now() - interval '24 hours' then
        blockers:=array_append(blockers,'Offer data is stale, missing or future-dated.');
      end if;
      if not review_record.offer_exact_variant_pack_approved
        or nullif(trim(coalesce(review_record.offer_reviewed_by,'')),'') is null
        or review_record.offer_reviewed_at is null
        or review_record.offer_reviewed_at < offer_record.last_checked_at
        or review_record.offer_reviewed_at > now() then
        blockers:=array_append(blockers,
          'Selected merchant variant, pack and current observation not signed off.');
      end if;
    end if;
  end if;
  return blockers;
end;
$fn$;

revoke all on function public.catalogue_step7_release_blockers(text)
  from public, anon, authenticated;
grant execute on function public.catalogue_step7_release_blockers(text) to service_role;

-- Preserve the original catalogue identity, spec and EU-offer requirements.
-- Augment the common blocker function used by BOTH catalogue_publish_product
-- and the false->true selectable UPDATE trigger, preventing bypass.
create or replace function public.catalogue_publication_blockers(
  p_product_id text
)
returns text[]
language plpgsql
stable
security invoker
set search_path = public
as $fn$
declare
  blockers text[] := array[]::text[];
  product_record public.catalogue_products%rowtype;
  quality_record public.catalogue_product_quality_reviews%rowtype;
begin
  select * into product_record
  from public.catalogue_products
  where id = p_product_id;

  if not found then
    return array['Product does not exist.'];
  end if;

  if product_record.record_class <> 'canonical'
     or product_record.identity_status <> 'verified'
     or product_record.identity_verified_at is null then
    blockers := array_append(
      blockers,
      'Product identity has not been promoted to a verified canonical identity.'
    );
  end if;

  select * into quality_record
  from public.catalogue_product_quality_reviews
  where product_id = p_product_id;

  if not found then
    return blockers || array['Product quality review is missing.'];
  end if;

  if quality_record.identity_quality_status <> 'verified' then
    blockers := array_append(blockers, 'Identity quality review is not verified.');
  end if;

  if quality_record.technical_quality_status <> 'verified' then
    blockers := array_append(blockers, 'Technical review has not been completed.');
  end if;

  if quality_record.human_review_required then
    blockers := array_append(blockers, 'Human review is still required.');
  end if;

  blockers := blockers || public.catalogue_missing_required_fields(p_product_id);

  if not exists (
    select 1
    from public.catalogue_offers o
    where o.product_id = p_product_id
      and o.verification_status = 'verified'
      and o.currency = 'EUR'
      and upper(trim(coalesce(o.region, ''))) = 'EU'
      and o.last_checked_at is not null
  ) then
    blockers := array_append(
      blockers,
      'At least one verified EU/EUR merchant offer with a check timestamp is required.'
    );
  end if;

  -- Additional Step 7 human/media/fresh-offer/owner gate. The catalogue
  -- trigger invokes this function on false -> true selectable transitions.
  blockers := blockers || public.catalogue_step7_release_blockers(p_product_id);
  return blockers;
end;
$fn$;


commit;
