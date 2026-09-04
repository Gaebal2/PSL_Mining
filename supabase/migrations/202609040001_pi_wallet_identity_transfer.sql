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

  delete from public.pi_wallet_identities where user_id = challenge.user_id and wallet_address <> challenge.wallet_address;
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

create or replace function public.start_mining(p_grid_id text, p_latitude double precision, p_longitude double precision, p_speed numeric, p_ad_transaction_id text)
returns public.mines language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); result public.mines; server_speed numeric;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.profiles where id=uid and pi_verified=true) then raise exception 'Pi wallet ownership verification required'; end if;
  select 1 + skill_level * 0.1 + least(10,(select count(*) from public.referrals where inviter_id=uid)) * 0.5 into server_speed from public.profiles where id=uid;
  if exists(select 1 from public.mines where miner_id=uid and completed_at is null and grid_id<>p_grid_id) then raise exception 'complete your current mine first'; end if;
  insert into public.mines(grid_id,latitude,longitude) values(p_grid_id,p_latitude,p_longitude) on conflict(grid_id) do nothing;
  select * into result from public.mines where grid_id=p_grid_id for update;
  if result.completed_at is not null then raise exception 'mine already completed'; end if;
  if result.miner_id is not null and result.miner_id<>uid then raise exception 'mine already occupied'; end if;
  update public.mines set miner_id=uid, miner_name=(select display_name from public.profiles where id=uid), mining_speed=server_speed,
    active_until=now()+interval '24 hours', abandonment_at=now()+interval '7 days', last_calculated_at=now(), updated_at=now()
    where grid_id=p_grid_id returning * into result;
  insert into public.mining_activations(user_id,grid_id,ad_transaction_id,active_until) values(uid,p_grid_id,p_ad_transaction_id,result.active_until);
  return result;
end $$;
