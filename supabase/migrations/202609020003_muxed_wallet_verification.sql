create table if not exists public.pi_wallet_identities (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  wallet_address text not null unique check (wallet_address ~ '^G[A-Z2-7]{55}$'),
  verification_tx_hash text not null unique,
  verified_at timestamptz not null default now()
);

create table if not exists public.wallet_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_address text not null check (wallet_address ~ '^G[A-Z2-7]{55}$'),
  muxed_id numeric(20,0) not null unique,
  muxed_address text not null unique check (muxed_address ~ '^M[A-Z2-7]{68}$'),
  amount numeric(20,7) not null default 0.01,
  network text not null check (network in ('testnet','mainnet')),
  status text not null default 'pending' check (status in ('pending','verified','expired')),
  transaction_hash text unique,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists one_pending_wallet_challenge_per_user
  on public.wallet_verification_challenges(user_id) where status = 'pending';
create index if not exists wallet_challenges_lookup
  on public.wallet_verification_challenges(wallet_address, status, expires_at);

alter table public.pi_wallet_identities enable row level security;
alter table public.wallet_verification_challenges enable row level security;
create policy "own wallet identity readable" on public.pi_wallet_identities
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own wallet challenge readable" on public.wallet_verification_challenges
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.pi_wallet_identities from authenticated;
revoke insert, update, delete on public.wallet_verification_challenges from authenticated;

