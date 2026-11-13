create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    contact_number,
    is_admin,
    role,
    organization_id,
    is_verified,
    avatar_url,
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Hiker'
    ),
    nullif(new.raw_user_meta_data ->> 'contact_number', ''),
    false,
    'hiker',
    null,
    false,
    null,
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;

drop trigger if exists create_profile_after_auth_user_insert on auth.users;
create trigger create_profile_after_auth_user_insert
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (
  id,
  email,
  full_name,
  contact_number,
  is_admin,
  role,
  organization_id,
  is_verified,
  avatar_url,
  updated_at
)
select
  users.id,
  users.email,
  coalesce(
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Hiker'
  ),
  nullif(users.raw_user_meta_data ->> 'contact_number', ''),
  false,
  'hiker',
  null,
  false,
  null,
  now()
from auth.users as users
on conflict (id) do nothing;
