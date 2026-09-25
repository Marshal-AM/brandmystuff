alter table listings add column if not exists expires_ms bigint not null default 0;
alter table listings add column if not exists v2 boolean not null default false;

create table if not exists bids (
  id text primary key,
  offering_id text not null references offerings(id),
  buyer text not null,
  units int not null,
  units_initial int not null,
  price_per_unit bigint not null,
  expires_ms bigint not null default 0,
  status text not null default 'open',     -- open | filled | cancelled | expired
  created_at timestamptz not null default now()
);
create index if not exists bids_offering_idx on bids(offering_id, status);
alter table bids enable row level security;

-- every executed trade (primary purchases, ask fills, bid fills) for price history & volume
create table if not exists trades (
  id bigint generated always as identity primary key,
  offering_id text not null references offerings(id),
  kind text not null,                      -- primary | ask | bid
  buyer text not null,
  seller text,
  units int not null,
  price_per_unit bigint not null,
  fee bigint not null default 0,
  digest text not null,
  created_at timestamptz not null default now(),
  unique (digest, offering_id, kind, buyer, units)
);
create index if not exists trades_offering_idx on trades(offering_id, created_at);
alter table trades enable row level security;
