-- ENSv2 permissions: per-identity Permissioned Resolvers with key-scoped roles (docs/ENS-INTEGRATION.md §12).

-- One resolver per identity (an owner/advertiser account or a brand agent). brandmystuff keeps admin;
-- `manager` (the identity's EVM key) holds ROLE_SET_TEXT only for `managed_keys`.
create table if not exists ens_resolvers (
  key text primary key,                       -- 'user:<uuid>' | 'agent:<uuid>'
  address text not null,
  manager text,
  managed_keys text[] not null default '{}',
  status text not null default 'active',      -- active | revoked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ens_resolvers_manager_idx on ens_resolvers(lower(manager));
alter table ens_resolvers enable row level security;

-- Where a name's records live (null = the shared platform resolver) and whether its owner manages some keys.
alter table ens_names add column if not exists resolver text;
alter table ens_names add column if not exists delegated boolean not null default false;

-- The brand agent's ENS identity: its own EVM key (encrypted like its Sui key) and name.
alter table brand_agents add column if not exists evm_address text;
alter table brand_agents add column if not exists evm_secret_enc text;
alter table brand_agents add column if not exists ens_name text;
alter table brand_agents add column if not exists ens_status text;
alter table brand_agents add column if not exists ens_synced_at timestamptz;
alter table brand_agents add column if not exists ens_state jsonb;

-- x402 payers that identified themselves by an agent ENS name (verified against addr(784)).
alter table x402_intents add column if not exists payer_ens text;
