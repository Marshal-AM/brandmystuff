alter table users add column if not exists sui_public_key text;
alter table users add column if not exists wallet_kind text not null default 'privy';
