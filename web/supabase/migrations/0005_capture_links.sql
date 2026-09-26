-- Photo links: a signed-in user asks for a link, opens it on a phone, and takes the
-- photograph there with the live camera. Only a SHA-256 of the token is stored; the
-- link itself is the credential, so the camera page needs no sign-in.
create table if not exists capture_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null check (purpose in ('hero', 'space', 'proof', 'kyc')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  photo_b64 text,
  photo_mime text,
  captured_at timestamptz,
  attempts integer not null default 0,
  last_reject_reason text
);
create index if not exists capture_links_user_purpose_idx on capture_links (user_id, purpose, created_at desc);
alter table public.capture_links enable row level security;
