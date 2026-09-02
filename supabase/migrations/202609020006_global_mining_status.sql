create or replace function public.mining_status()
returns table(total_miners bigint, active_miners bigint, completed_mines bigint)
language sql stable security definer set search_path='' as $$
  select
    (select count(*) from public.profiles)::bigint,
    (select count(distinct miner_id) from public.mines where miner_id is not null and completed_at is null)::bigint,
    (select count(*) from public.mines where completed_at is not null)::bigint;
$$;
grant execute on function public.mining_status() to authenticated;
