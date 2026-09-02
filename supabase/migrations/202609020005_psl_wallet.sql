alter table public.profiles add column if not exists psl_wallet_address text not null default '';
grant update(psl_wallet_address) on public.profiles to authenticated;

