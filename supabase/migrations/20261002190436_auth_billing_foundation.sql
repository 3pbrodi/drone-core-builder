create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: owner can read" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles: owner can update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.plans (
  id text primary key check (id in ('free', 'pro', 'team')),
  name text not null,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  yearly_discount_percent integer not null default 20 check (yearly_discount_percent between 0 and 100),
  ai_builds_limit integer,
  saved_builds_limit integer,
  exports_limit integer,
  seats integer not null default 1,
  sort_order integer not null default 0
);
alter table public.plans enable row level security;
create policy "plans: readable by everyone" on public.plans for select to anon, authenticated using (true);
insert into public.plans (id, name, monthly_price_cents, ai_builds_limit, saved_builds_limit, exports_limit, seats, sort_order) values
  ('free', 'Free',    0, 10,  3,    0,    1, 1),
  ('pro',  'Pro',  1900, 100, 50,   20,   1, 2),
  ('team', 'Team', 4900, 500, null, null, 5, 3);

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan_id text not null default 'free' references public.plans (id),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  billing_email text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
alter table public.subscriptions enable row level security;
create policy "subscriptions: owner can read" on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand text not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  exp_month integer not null check (exp_month between 1 and 12),
  exp_year integer not null,
  is_default boolean not null default true,
  stripe_payment_method_id text unique,
  created_at timestamptz not null default now()
);
create index payment_methods_user_id_idx on public.payment_methods (user_id);
alter table public.payment_methods enable row level security;
create policy "payment_methods: owner can read" on public.payment_methods for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  number text not null unique,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'eur',
  status text not null default 'paid' check (status in ('paid', 'open', 'void', 'refunded')),
  issued_at timestamptz not null default now(),
  stripe_invoice_id text unique
);
create index invoices_user_id_idx on public.invoices (user_id, issued_at desc);
alter table public.invoices enable row level security;
create policy "invoices: owner can read" on public.invoices for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  ai_builds integer not null default 0 check (ai_builds >= 0),
  exports integer not null default 0 check (exports >= 0),
  primary key (user_id, period_start)
);
alter table public.usage_counters enable row level security;
create policy "usage_counters: owner can read" on public.usage_counters for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.saved_builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My build',
  source text not null default 'custom' check (source in ('custom', 'template', 'ai')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_builds_user_id_idx on public.saved_builds (user_id, created_at desc);
alter table public.saved_builds enable row level security;
create policy "saved_builds: owner can read" on public.saved_builds for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "saved_builds: owner can insert" on public.saved_builds for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "saved_builds: owner can update" on public.saved_builds for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "saved_builds: owner can delete" on public.saved_builds for delete to authenticated
  using ((select auth.uid()) = user_id);
create trigger saved_builds_updated_at before update on public.saved_builds
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)));
  insert into public.subscriptions (user_id, plan_id, billing_email)
  values (new.id, 'free', new.email);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();