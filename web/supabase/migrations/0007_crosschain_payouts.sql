-- Cross-chain payouts: where each holder wants revenue paid, and every payout's journey
-- (released on Sui → burned via CCTP → attested by Circle → delivered on EVM via MultiBaas).

-- Mirror of payout::PayoutRegistry routes (source of truth is on Sui, set by the holder).
create table if not exists payout_routes (
  sui_address text primary key,
  chain text not null,                 -- 'eth-sepolia' | 'base-sepolia' | 'arb-sepolia' | 'op-sepolia'
  domain int not null,                 -- Circle CCTP domain
  recipient text not null,             -- EVM address (0x…, 20 bytes)
  set_digest text,
  updated_at timestamptz not null default now()
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  offering_id text not null,
  holder text not null,                -- Sui address
  chain text not null,
  domain int not null,
  recipient text not null,
  amount text not null,                -- USDC atomic (6 decimals)
  status text not null default 'released', -- released | attested | delivering | delivered | failed
  release_digest text,                 -- Sui tx: payout::release_routed + CCTP deposit_for_burn
  cctp_nonce text,
  message text,                        -- CCTP message bytes (hex)
  attestation text,                    -- Circle attestation (hex)
  evm_tx text,                         -- relayer.deliver tx (via MultiBaas)
  evm_block bigint,
  delivered_at timestamptz,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payouts_holder_idx on payouts (holder, created_at desc);
create index if not exists payouts_status_idx on payouts (status);
create unique index if not exists payouts_nonce_idx on payouts (cctp_nonce) where cctp_nonce is not null;

-- MultiBaas webhook deliveries (deduplicated by MultiBaas event id).
create table if not exists multibaas_events (
  id text primary key,
  chain text not null,
  kind text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.payout_routes enable row level security;
alter table public.payouts enable row level security;
alter table public.multibaas_events enable row level security;
