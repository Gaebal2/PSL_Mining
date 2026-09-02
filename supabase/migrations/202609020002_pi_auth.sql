create table if not exists public.pi_identities (
  pi_uid text primary key,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  username text not null,
  wallet_address text,
  verified_at timestamptz not null default now()
);

alter table public.pi_identities enable row level security;
create policy "own pi identity readable" on public.pi_identities
  for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.pi_identities from authenticated;

