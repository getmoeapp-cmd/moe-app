-- MOE cutover: lock moe_data to signed-in members of each kitchen.
-- RUN ONLY AFTER the new app build is live on Vercel (the old app reads data anonymously and will stop working).

-- 1) Remove the "allow everyone" policies
drop policy if exists "Allow all for anon" on public.moe_data;
drop policy if exists "allow_all_access"   on public.moe_data;
drop policy if exists moe_data_read   on public.moe_data;
drop policy if exists moe_data_insert on public.moe_data;
drop policy if exists moe_data_update on public.moe_data;
drop policy if exists moe_data_delete on public.moe_data;

-- Keys only the server / platform admin may write (billing, legacy login blobs)
create or replace function public.moe_protected_key(k text) returns boolean
language sql immutable as $$ select k in ('subscription', 'team') $$;

create policy moe_data_read on public.moe_data for select to authenticated
  using (public.moe_is_member(group_id) or public.moe_is_admin());

create policy moe_data_insert on public.moe_data for insert to authenticated
  with check ((public.moe_is_member(group_id) and not public.moe_protected_key(data_key)
               and (data_key <> 'permissions' or public.moe_is_manager(group_id)))
              or public.moe_is_admin());

create policy moe_data_update on public.moe_data for update to authenticated
  using ((public.moe_is_member(group_id) and not public.moe_protected_key(data_key)
          and (data_key <> 'permissions' or public.moe_is_manager(group_id)))
         or public.moe_is_admin())
  with check ((public.moe_is_member(group_id) and not public.moe_protected_key(data_key)
               and (data_key <> 'permissions' or public.moe_is_manager(group_id)))
              or public.moe_is_admin());

create policy moe_data_delete on public.moe_data for delete to authenticated
  using (public.moe_is_manager(group_id) or public.moe_is_admin());

revoke all on public.moe_data from anon;
grant select, insert, update, delete on public.moe_data to authenticated;
revoke execute on function public.moe_protected_key(text) from public, anon;
grant execute on function public.moe_protected_key(text) to authenticated;

-- 2) Strip plaintext passwords from the legacy blobs (logins now live in Supabase Auth)
update public.moe_data
   set data_value = (select coalesce(jsonb_object_agg(k, v - 'password'), '{}'::jsonb)
                     from jsonb_each(data_value::jsonb) e(k, v))::text
 where group_id = '__moe_accounts__' and data_key = 'accounts' and data_value like '%"password"%';

update public.moe_data
   set data_value = (select coalesce(jsonb_agg(m - 'password'), '[]'::jsonb)
                     from jsonb_array_elements(data_value::jsonb) m)::text
 where data_key = 'team' and jsonb_typeof(data_value::jsonb) = 'array' and data_value like '%"password"%';

update public.moe_data
   set data_value = (select coalesce(jsonb_object_agg(k, v - 'password'), '{}'::jsonb)
                     from jsonb_each(data_value::jsonb) e(k, v))::text
 where group_id = '__moe_reps__' and data_key = 'reps' and data_value like '%"password"%';
