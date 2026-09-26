-- One MultiBaas webhook per chain deployment; the HMAC secret MultiBaas returns lives here, not in the repo.
create table if not exists multibaas_webhooks (
  chain text primary key,
  webhook_id int not null,
  url text not null,
  secret text not null,
  created_at timestamptz not null default now()
);
alter table public.multibaas_webhooks enable row level security;
