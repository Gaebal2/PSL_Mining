-- The table-returning function has an output variable named wallet_address.
-- Qualify table columns to avoid "column reference wallet_address is ambiguous".
create or replace function public.complete_pi_wallet_verification(p_challenge_id uuid, p_transaction_hash text)
returns table(wallet_address text, previous_user_id uuid, reset_grid_id text)
language plpgsql security definer set search_path = '' as $$
declare
  challenge public.wallet_verification_challenges;
  old_user_id uuid;
  old_grid_id text;
begin
  select * into challenge from public.wallet_verification_challenges where id = p_challenge_id for update;
  if challenge.id is null or challenge.status <> 'pending' then raise exception 'invalid wallet verification challenge'; end if;
  if challenge.expires_at <= now() then raise exception 'wallet verification challenge expired'; end if;
  if nullif(trim(p_transaction_hash), '') is null then raise exception 'transaction hash required'; end if;
  if exists (select 1 from public.pi_wallet_identities where verification_tx_hash = p_transaction_hash) then raise exception 'verification transaction already used'; end if;

  perform pg_advisory_xact_lock(hashtextextended(challenge.wallet_address, 0));
  select user_id into old_user_id from public.pi_wallet_identities where pi_wallet_identities.wallet_address = challenge.wallet_address for update;

  if old_user_id is not null and old_user_id <> challenge.user_id then
    select grid_id into old_grid_id from public.mines where miner_id = old_user_id and completed_at is null limit 1 for update;
    if old_grid_id is not null then
      update public.mines set depth_meters = 0, miner_id = null, miner_name = null, mining_speed = null,
        active_until = null, abandonment_at = null, last_calculated_at = null, updated_at = now() where grid_id = old_grid_id;
    end if;
    update public.profiles set pi_verified = false, wallet_address = '', updated_at = now() where id = old_user_id;
    update public.wallet_verification_challenges set status = 'expired' where user_id = old_user_id and status = 'pending';
    delete from public.pi_wallet_identities where user_id = old_user_id;
  end if;

  delete from public.pi_wallet_identities as identity
    where identity.user_id = challenge.user_id and identity.wallet_address <> challenge.wallet_address;
  insert into public.pi_wallet_identities(user_id, wallet_address, verification_tx_hash, verified_at)
    values(challenge.user_id, challenge.wallet_address, p_transaction_hash, now())
    on conflict(user_id) do update set wallet_address = excluded.wallet_address,
      verification_tx_hash = excluded.verification_tx_hash, verified_at = excluded.verified_at;
  update public.wallet_verification_challenges set status = 'verified', transaction_hash = p_transaction_hash,
    verified_at = now() where id = challenge.id;
  update public.profiles set pi_verified = true, wallet_address = challenge.wallet_address,
    updated_at = now() where id = challenge.user_id;
  return query select challenge.wallet_address, old_user_id, old_grid_id;
end $$;

revoke all on function public.complete_pi_wallet_verification(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_pi_wallet_verification(uuid, text) to service_role;
