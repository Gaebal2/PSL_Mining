create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id, display_name, auth_provider)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1), '새로운 광부'),
    coalesce(new.raw_app_meta_data->>'provider', 'anonymous')
  ) on conflict(id) do nothing;
  return new;
end $$;

