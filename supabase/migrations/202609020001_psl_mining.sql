create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '새로운 광부',
  auth_provider text not null default 'anonymous',
  pi_verified boolean not null default false,
  skill_level integer not null default 0 check (skill_level >= 0),
  completed_mines integer not null default 0 check (completed_mines >= 0),
  wallet_address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mines (
  grid_id text primary key check (grid_id ~ '^G-[0-9]+-[0-9]+$'),
  latitude double precision not null,
  longitude double precision not null,
  depth_meters numeric(12,6) not null default 0 check (depth_meters between 0 and 72),
  miner_id uuid references public.profiles(id),
  miner_name text,
  mining_speed numeric(12,6),
  active_until timestamptz,
  abandonment_at timestamptz,
  last_calculated_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  reward_type text not null default 'hidden' check (reward_type in ('hidden','kingWhale','whale','shrimp','anchovy')),
  updated_at timestamptz not null default now()
);
create unique index if not exists one_active_mine_per_user on public.mines(miner_id) where miner_id is not null and completed_at is null;
create index if not exists mines_activity_idx on public.mines(completed_at, miner_id);

create table if not exists public.mining_activations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  grid_id text not null references public.mines(grid_id), ad_transaction_id text not null unique,
  activated_at timestamptz not null default now(), active_until timestamptz not null
);
create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  grid_id text references public.mines(grid_id), amount bigint not null,
  transaction_type text not null check (transaction_type in ('mine_reward','withdrawal','adjustment')),
  created_at timestamptz not null default now(), unique(user_id, grid_id, transaction_type)
);
create table if not exists public.referrals (
  inviter_id uuid not null references public.profiles(id), invitee_id uuid primary key references public.profiles(id),
  created_at timestamptz not null default now(), check (inviter_id <> invitee_id)
);
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  wallet_address text not null, amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id, display_name, auth_provider)
  values(new.id, coalesce(new.raw_user_meta_data->>'display_name','새로운 광부'), coalesce(new.raw_user_meta_data->>'provider','anonymous'))
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.psl_balance(target uuid) returns bigint language plpgsql stable security definer set search_path='' as $$
begin
  if target is distinct from auth.uid() then raise exception 'forbidden'; end if;
  return (select coalesce(sum(amount),0)::bigint from public.reward_ledger where user_id=target);
end $$;

create or replace function public.start_mining(p_grid_id text, p_latitude double precision, p_longitude double precision, p_speed numeric, p_ad_transaction_id text)
returns public.mines language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); result public.mines; server_speed numeric;
begin
  if uid is null then raise exception 'authentication required'; end if;
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

create or replace function public.sync_my_mine() returns public.mines language plpgsql security definer set search_path='' as $$
declare result public.mines; elapsed_hours numeric; rank_value bigint; reward_amount bigint;
begin
  select * into result from public.mines where miner_id=auth.uid() and completed_at is null for update;
  if result.grid_id is null then return null; end if;
  if result.abandonment_at <= now() then
    update public.mines set depth_meters=0,miner_id=null,miner_name=null,mining_speed=null,active_until=null,abandonment_at=null,last_calculated_at=null,updated_at=now() where grid_id=result.grid_id returning * into result;
    return result;
  end if;
  elapsed_hours := greatest(0,extract(epoch from (least(now(),result.active_until)-result.last_calculated_at))/3600);
  update public.mines set depth_meters=least(72,depth_meters+elapsed_hours*mining_speed),last_calculated_at=least(now(),active_until),updated_at=now() where grid_id=result.grid_id returning * into result;
  if result.depth_meters >= 72 then
    rank_value := mod(abs(hashtextextended(result.grid_id,721888)),100000000);
    result.reward_type := case when rank_value<1 then 'kingWhale' when rank_value<889 then 'whale' when rank_value<11112000 then 'shrimp' else 'anchovy' end;
    reward_amount := case result.reward_type when 'kingWhale' then 800000000 when 'whale' then 100000000 when 'shrimp' then 8 else 1 end;
    update public.mines set completed_at=now(),completed_by=auth.uid(),miner_id=null,active_until=null,abandonment_at=null,reward_type=result.reward_type,updated_at=now() where grid_id=result.grid_id returning * into result;
    insert into public.reward_ledger(user_id,grid_id,amount,transaction_type) values(auth.uid(),result.grid_id,reward_amount,'mine_reward') on conflict do nothing;
    update public.profiles set skill_level=skill_level+1,completed_mines=completed_mines+1,updated_at=now() where id=auth.uid();
  end if;
  return result;
end $$;

create or replace function public.leave_mine(p_grid_id text) returns public.mines language plpgsql security definer set search_path='' as $$
declare result public.mines;
begin
  update public.mines set depth_meters=0, miner_id=null, miner_name=null, mining_speed=null, active_until=null,
    abandonment_at=null,last_calculated_at=null,updated_at=now() where grid_id=p_grid_id and miner_id=auth.uid() and completed_at is null returning * into result;
  if result.grid_id is null then raise exception 'active mine not found'; end if;
  return result;
end $$;

alter table public.profiles enable row level security; alter table public.mines enable row level security;
alter table public.mining_activations enable row level security; alter table public.reward_ledger enable row level security;
alter table public.referrals enable row level security; alter table public.withdrawals enable row level security;
create policy "own profile readable" on public.profiles for select to authenticated using((select auth.uid())=id);
create policy "own profile update" on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy "mines readable" on public.mines for select to authenticated using(true);
create policy "own activations readable" on public.mining_activations for select to authenticated using((select auth.uid())=user_id);
create policy "own ledger readable" on public.reward_ledger for select to authenticated using((select auth.uid())=user_id);
create policy "own referrals readable" on public.referrals for select to authenticated using((select auth.uid()) in (inviter_id,invitee_id));
create policy "own withdrawals readable" on public.withdrawals for select to authenticated using((select auth.uid())=user_id);
grant execute on function public.start_mining(text,double precision,double precision,numeric,text) to authenticated;
grant execute on function public.leave_mine(text) to authenticated;
grant execute on function public.psl_balance(uuid) to authenticated;
grant execute on function public.sync_my_mine() to authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update(display_name,wallet_address) on public.profiles to authenticated;
revoke insert, update, delete on public.mines, public.mining_activations, public.reward_ledger, public.referrals, public.withdrawals from authenticated;
