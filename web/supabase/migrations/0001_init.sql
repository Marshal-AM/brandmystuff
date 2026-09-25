-- brandmystuff read model + app data (Supabase Postgres).
-- The browser never talks to Supabase directly: all access is server-side with the service role,
-- so RLS is enabled with no policies (deny-all for anon/authenticated).

create extension if not exists pgcrypto;

-- ============ identity ============
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  privy_did text unique,
  handle text unique,
  ens_name text unique,
  sui_address text unique,
  evm_address text,
  display_name text,
  bio text,
  avatar_blob_id text,
  twitter text,
  website text,
  brand_name text,
  profile_id text,
  ens_status text not null default 'pending',
  test_funds_at timestamptz,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists linked_wallets (
  address text primary key,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('privy_embedded','external')),
  verified_at timestamptz not null default now()
);

create table if not exists auth_nonces (
  nonce text primary key,
  address text not null,
  expires_at timestamptz not null
);

create table if not exists capture_codes (
  code text primary key,
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- ============ listings ============
create table if not exists objects (
  id text primary key,                 -- Sui ListedObject id
  owner_user_id uuid references users(id),
  owner_address text not null,
  category text not null,
  category_code int not null,
  title text not null,
  description text,
  make text, model text, color text,
  city text,
  ens_name text unique,
  hero_blob_id text not null,
  manifest_blob_id text,
  hero_check jsonb,
  object_aqs int not null default 0,
  object_grade int not null default 0,
  sponsored_until timestamptz,
  sponsor_tier int,
  status text not null default 'live',
  created_digest text,
  created_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(make,'') || ' ' || coalesce(model,'') || ' ' || coalesce(city,'') || ' ' || coalesce(category,''))
  ) stored
);
create index if not exists objects_search_idx on objects using gin(search);
create index if not exists objects_owner_idx on objects(owner_address);

create table if not exists spaces (
  id text primary key,                 -- Sui AdSpace id
  object_id text not null references objects(id) on delete cascade,
  calendar_id text not null,
  owner_address text not null,
  label text not null,
  ens_name text unique,
  width_mm int not null,
  height_mm int not null,
  placement text not null,
  material text,
  closeup_blob_id text not null,
  price_per_week bigint not null,
  aqs int not null default 0,
  grade int not null default 0,
  confidence_bps int not null default 0,
  rank_score numeric not null default 0,
  subscores jsonb,
  strengths jsonb,
  weaknesses jsonb,
  tips jsonb,
  report_blob_id text,
  report_hash text,
  rubric_version text,
  status text not null default 'scoring',
  offering_id text,
  active_leases int not null default 0,
  completed_leases int not null default 0,
  accepted_proofs int not null default 0,
  week_ms bigint not null,
  created_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', coalesce(label,'') || ' ' || coalesce(material,'') || ' ' || coalesce(placement,''))) stored
);
create index if not exists spaces_object_idx on spaces(object_id);
create index if not exists spaces_rank_idx on spaces(rank_score desc);
create index if not exists spaces_search_idx on spaces using gin(search);

-- AI analyses run in the "Add space" modal before anything goes on-chain
create table if not exists space_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  object_id text not null,
  input jsonb not null,
  closeup_blob_id text not null,
  decision text not null,
  reject_reason text,
  gate text,
  result jsonb not null,
  report_blob_id text,
  report_hash text,
  space_id text,
  created_at timestamptz not null default now()
);

-- ============ leases ============
create table if not exists leases (
  escrow_id text primary key,
  lease_id text not null,
  seq bigint not null,
  ens_label text not null,
  space_id text not null references spaces(id),
  advertiser text not null,
  owner text not null,
  start_ms bigint not null,
  week_ms bigint not null,
  weeks int not null,
  total_paid bigint not null,
  released bigint not null default 0,
  refunded bigint not null default 0,
  status text not null default 'pending_approval',
  creative_blob_id text not null,
  creative_hash text not null,
  landing_url text,
  brand text,
  brand_asset_id uuid,
  via_operator boolean not null default false,
  approve_deadline_ms bigint,
  booked_digest text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leases_space_idx on leases(space_id);
create index if not exists leases_adv_idx on leases(advertiser);
create index if not exists leases_owner_idx on leases(owner);

create table if not exists proofs (
  id uuid primary key default gen_random_uuid(),
  escrow_id text not null references leases(escrow_id),
  period int not null,
  photo_blob_id text not null,
  status text not null,              -- accepted | rejected
  match_bps int,
  object_bps int,
  reason text,
  analysis jsonb,
  phash text,
  digest text,
  submitted_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index if not exists proofs_escrow_idx on proofs(escrow_id);

create table if not exists tranches (
  id uuid primary key default gen_random_uuid(),
  escrow_id text not null,
  space_id text not null,
  period int not null,
  kind text not null,                -- released | refunded
  gross bigint not null,
  platform_fee bigint not null default 0,
  investor_share bigint not null default 0,
  to_owner bigint not null default 0,
  digest text not null,
  created_at timestamptz not null default now(),
  unique (escrow_id, period)
);

create table if not exists clicks (
  id bigint generated always as identity primary key,
  escrow_id text not null,
  referer text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists clicks_escrow_idx on clicks(escrow_id);

-- ============ tokenisation ============
create table if not exists offerings (
  id text primary key,
  seq bigint not null,
  space_id text not null references spaces(id),
  owner text not null,
  revenue_share_bps int not null,
  retained_units int not null,
  offered_units int not null,
  sold_units int not null default 0,
  price_per_unit bigint not null,
  min_raise_units int not null,
  per_investor_max int not null,
  sale_end_ms bigint not null,
  term_months int not null,
  legal_pack_hash text not null,
  legal_pack_blob_id text not null,
  legal_pack jsonb,
  status text not null default 'open',
  raised bigint not null default 0,
  total_distributed bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists holdings (
  offering_id text not null references offerings(id),
  address text not null,
  units int not null default 0,
  listed_units int not null default 0,
  paid bigint not null default 0,
  claimed bigint not null default 0,
  primary key (offering_id, address)
);

create table if not exists unit_events (
  id uuid primary key default gen_random_uuid(),
  offering_id text not null,
  kind text not null,                -- purchase | refund | distribution | claim | trade | listed | cancel
  address text,
  counterparty text,
  units int,
  amount bigint,
  digest text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists unit_events_off_idx on unit_events(offering_id);

create table if not exists listings (
  id text primary key,
  offering_id text not null references offerings(id),
  seller text not null,
  units int not null,
  price_per_unit bigint not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists acceptances (
  id uuid primary key default gen_random_uuid(),
  offering_id text,
  signer text not null,
  role text not null,                -- owner | investor
  message text not null,
  signature text not null,
  sig_hash text not null,
  units int,
  created_at timestamptz not null default now()
);

create table if not exists kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  address text not null,
  legal_name text not null,
  date_of_birth date not null,
  country text not null,
  address_line text not null,
  investor_type text not null,
  attestations jsonb not null,
  id_document_meta jsonb,
  status text not null default 'approved',
  expires_at timestamptz not null,
  digest text,
  created_at timestamptz not null default now()
);

-- ============ sponsorship ============
create table if not exists sponsorships (
  id uuid primary key default gen_random_uuid(),
  object_id text not null references objects(id),
  payer text not null,
  tier int not null,
  days int not null,
  paid bigint not null,
  sponsored_until timestamptz not null,
  digest text not null unique,
  created_at timestamptz not null default now()
);

-- ============ brand kit & chat ============
create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  blob_id text not null,
  mime text not null,
  width int, height int,
  sha256 text not null,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  space_id text not null references spaces(id),
  advertiser_user_id uuid not null references users(id),
  owner_user_id uuid not null references users(id),
  escrow_id text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (space_id, advertiser_user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_user_id uuid not null references users(id),
  body text,
  attachments jsonb not null default '[]'::jsonb,
  read_at timestamptz,
  reported boolean not null default false,
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on messages(conversation_id, created_at);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                -- message | creative
  target_id text not null,
  reporter_user_id uuid references users(id),
  reason text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- ============ chain & ENS plumbing ============
create table if not exists chain_events (
  digest text not null,
  event_seq int not null,
  event_type text not null,
  module text not null,
  json jsonb not null,
  checkpoint bigint,
  ts timestamptz,
  processed_at timestamptz,
  error text,
  primary key (digest, event_seq)
);
create index if not exists chain_events_unprocessed on chain_events(processed_at) where processed_at is null;

create table if not exists cursors (
  name text primary key,
  cursor text,
  updated_at timestamptz not null default now()
);

create table if not exists activity (
  id bigint generated always as identity primary key,
  space_id text,
  object_id text,
  offering_id text,
  kind text not null,
  actor text,
  amount bigint,
  data jsonb,
  sui_digest text,
  eth_tx text,
  created_at timestamptz not null default now()
);
create index if not exists activity_space_idx on activity(space_id, created_at desc);
create index if not exists activity_object_idx on activity(object_id, created_at desc);

create table if not exists ens_names (
  name text primary key,
  label text not null,
  parent text,
  kind text not null,                -- account | object | space | lease | platform
  owner text,
  subregistry text,                  -- UserRegistry deployed for this name's children
  expiry bigint,
  status text not null default 'pending',
  sui_ref text,
  updated_at timestamptz not null default now()
);

create table if not exists ens_writes (
  id bigint generated always as identity primary key,
  name text not null,
  action text not null,
  payload jsonb,
  sui_digest text,
  eth_tx text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ens_writes_name_idx on ens_writes(name, created_at desc);

create table if not exists jobs (
  id bigint generated always as identity primary key,
  kind text not null,
  payload jsonb not null,
  dedupe_key text unique,
  status text not null default 'queued',
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_ready_idx on jobs(status, run_after);

create table if not exists x402_intents (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                -- lease | sponsorship
  payload jsonb not null,
  amount bigint not null,
  pay_to text not null,
  status text not null default 'awaiting_payment',
  payer text,
  payment_digest text unique,
  result jsonb,
  error text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists test_fund_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  address text not null,
  sui_mist bigint not null,
  usdc bigint not null,
  digest text not null,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references users(id),
  action text not null,
  target text,
  data jsonb,
  digest text,
  created_at timestamptz not null default now()
);

-- ============ RLS: deny-all for anon/authenticated (server uses service role) ============
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ============ Realtime for chat + notifications ============
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.messages'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.notifications'; exception when duplicate_object then null; end;
  end if;
end $$;

-- ============ Storage: private chat media bucket ============
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', false, 26214400)
on conflict (id) do nothing;
