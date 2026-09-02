alter table public.profiles
  add column if not exists active_device_id text;

create or replace function public.register_login_device(p_device_id text)
returns table(forced_exit_grid_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  previous_device_id text;
  exited_grid_id text;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_device_id), '') is null then raise exception 'device id required'; end if;

  select active_device_id into previous_device_id
  from public.profiles
  where id = uid
  for update;

  if previous_device_id is distinct from p_device_id then
    select grid_id into exited_grid_id
    from public.mines
    where miner_id = uid and completed_at is null
    for update;

    if exited_grid_id is not null then
      update public.mines
      set depth_meters = 0, miner_id = null, miner_name = null,
          mining_speed = null, active_until = null, abandonment_at = null,
          last_calculated_at = null, updated_at = now()
      where grid_id = exited_grid_id;
    end if;
  end if;

  update public.profiles
  set active_device_id = p_device_id, updated_at = now()
  where id = uid;

  return query select exited_grid_id;
end;
$$;

grant execute on function public.register_login_device(text) to authenticated;
