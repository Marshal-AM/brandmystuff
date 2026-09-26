-- Brand accounts, one Scout agent per brand, budget mandates and agent runs.
alter table users add column if not exists account_type text not null default 'owner' check (account_type in ('owner', 'brand'));
alter table users add column if not exists brand_about text;
alter table users add column if not exists brand_logo_blob_id text;
alter table users add column if not exists brand_location text;

-- One agent per brand. The agent's Sui key is encrypted at rest (AES-256-GCM).
create table if not exists brand_agents (
  user_id uuid primary key references users(id) on delete cascade,
  agent_address text not null unique,
  agent_secret_enc text not null,
  mandate_id text,
  created_at timestamptz not null default now(),
  gas_funded_at timestamptz
);

-- Every run keeps what the agent saw and why it chose what it chose.
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'running',
  brand jsonb,
  lands jsonb,
  dna jsonb,
  universe jsonb,
  candidates jsonb,
  pick_id text,
  payment jsonb,
  events jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_user_idx on agent_runs (user_id, created_at desc);

alter table public.brand_agents enable row level security;
alter table public.agent_runs enable row level security;
