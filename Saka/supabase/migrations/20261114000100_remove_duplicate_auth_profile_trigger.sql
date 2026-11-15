drop trigger if exists create_profile_after_auth_user_insert on auth.users;
drop function if exists public.create_profile_for_auth_user();
