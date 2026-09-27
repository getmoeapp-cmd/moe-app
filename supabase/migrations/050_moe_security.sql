-- MOE security pass. Replaces 030 (run this instead of 030; safe to run more than once).
--   1. Team functions: a person who is NOT in the kitchen can no longer remove members or change roles.
--   2. moe_data is locked to signed-in members of each kitchen (no more anonymous access).
--   3. Employees can count (stock, count log, count sheets, drafts) but can't change the
--      item list, suppliers, prices, recipes, or order history — those are manager/owner only.
--   4. Approving a draft is one atomic step: it can't create two orders, and a draft someone
--      else already approved can't be approved again.
--   5. Whole-list saves (item list, suppliers) refuse to overwrite a newer version.
--   6. Plaintext passwords stripped from the old login blobs.

-- ── 1. Team functions: fail closed ─────────────────────────────────────────
create or replace function public.moe_remove_member(p_kitchen text, p_user uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me text := coalesce(public.moe_role(p_kitchen), ''); them text;
begin
  select role into them from public.moe_members where kitchen_id = p_kitchen and user_id = p_user;
  if them is null then return; end if;
  if them = 'owner' then raise exception 'The owner cannot be removed'; end if;
  if not (me = 'owner' or (me = 'manager' and them = 'employee') or coalesce(public.moe_is_admin(), false)) then
    raise exception 'Not allowed';
  end if;
  delete from public.moe_members where kitchen_id = p_kitchen and user_id = p_user;
end $$;

create or replace function public.moe_set_member_role(p_kitchen text, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if coalesce(public.moe_role(p_kitchen), '') <> 'owner' and not coalesce(public.moe_is_admin(), false) then
    raise exception 'Only the owner can change roles';
  end if;
  if p_role not in ('manager', 'employee') then raise exception 'Invalid role'; end if;
  update public.moe_members set role = p_role where kitchen_id = p_kitchen and user_id = p_user and role <> 'owner';
end $$;

-- ── 2/3. Row-level security on moe_data ────────────────────────────────────
drop policy if exists "Allow all for anon" on public.moe_data;
drop policy if exists "allow_all_access"   on public.moe_data;
drop policy if exists moe_data_read   on public.moe_data;
drop policy if exists moe_data_insert on public.moe_data;
drop policy if exists moe_data_update on public.moe_data;
drop policy if exists moe_data_delete on public.moe_data;
alter table public.moe_data enable row level security;

-- Only the platform admin (billing) may write these.
create or replace function public.moe_protected_key(k text) returns boolean
language sql immutable as $$ select k in ('subscription', 'team') $$;

-- Only managers/owners may write these. Everything else (stock, countLog, sheet_*, drafts…)
-- any member may write, so staff can count.
create or replace function public.moe_manager_key(k text) returns boolean
language sql immutable as $$
  select k in ('inventory', 'vendors', 'priceHistory', 'recipes', 'history', 'usageLog', 'permissions',
               'lastAutoWeek', 'settings', 'itemdata', 'sections', 'orders', 'added', 'pnl_data')
      or k like 'recipephoto\_%' or k like 'recipethumb\_%'
$$;

create or replace function public.moe_can_write(g text, k text) returns boolean
language sql stable security invoker set search_path = public, extensions as $$
  select coalesce(public.moe_is_admin(), false)
      or (public.moe_is_member(g)
          and not public.moe_protected_key(k)
          and (not public.moe_manager_key(k) or public.moe_is_manager(g)))
$$;

create policy moe_data_read on public.moe_data for select to authenticated
  using (public.moe_is_member(group_id) or public.moe_is_admin());
create policy moe_data_insert on public.moe_data for insert to authenticated
  with check (public.moe_can_write(group_id, data_key));
create policy moe_data_update on public.moe_data for update to authenticated
  using (public.moe_can_write(group_id, data_key))
  with check (public.moe_can_write(group_id, data_key));
create policy moe_data_delete on public.moe_data for delete to authenticated
  using ((public.moe_is_manager(group_id) and not public.moe_protected_key(data_key)) or public.moe_is_admin());

revoke all on public.moe_data from anon;
grant select, insert, update, delete on public.moe_data to authenticated;
revoke execute on function public.moe_protected_key(text), public.moe_manager_key(text), public.moe_can_write(text, text) from public, anon;
grant execute on function public.moe_protected_key(text), public.moe_manager_key(text), public.moe_can_write(text, text) to authenticated;

-- Patching an element of an empty array must not null the row.
create or replace function public.moe_array_patch(p_group text, p_key text, p_id text, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare cur jsonb; v jsonb;
begin
  select data_value::jsonb into cur from moe_data where group_id = p_group and data_key = p_key for update;
  if cur is null or jsonb_typeof(cur) <> 'array' then return '[]'::jsonb; end if;
  v := (select coalesce(jsonb_agg(case when e->>'id' = p_id then e || p_patch else e end order by ord), '[]'::jsonb)
        from jsonb_array_elements(cur) with ordinality t(e, ord));
  update moe_data set data_value = v::text, updated_at = now() where group_id = p_group and data_key = p_key;
  return v;
end $$;

-- Update an existing element only (never re-creates one someone else removed).
create or replace function public.moe_array_update(p_group text, p_key text, p_item jsonb)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare cur jsonb; v jsonb;
begin
  select data_value::jsonb into cur from moe_data where group_id = p_group and data_key = p_key for update;
  if cur is null or jsonb_typeof(cur) <> 'array'
     or not exists (select 1 from jsonb_array_elements(cur) e where e->>'id' = p_item->>'id') then
    return jsonb_build_object('ok', false, 'value', coalesce(cur, '[]'::jsonb));
  end if;
  v := (select jsonb_agg(case when e->>'id' = p_item->>'id' then p_item else e end order by ord)
        from jsonb_array_elements(cur) with ordinality t(e, ord));
  update moe_data set data_value = v::text, updated_at = now() where group_id = p_group and data_key = p_key;
  return jsonb_build_object('ok', true, 'value', v);
end $$;

-- ── 4. Approve a draft atomically ──────────────────────────────────────────
-- Removes the draft and adds the order to history in one transaction. If the draft is
-- already gone (someone else approved or deleted it), nothing is written.
create or replace function public.moe_approve_draft(p_group text, p_draft_id text, p_order jsonb, p_cap int default 5000)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare d jsonb; nd jsonb; h jsonb;
begin
  if not (public.moe_is_manager(p_group) or coalesce(public.moe_is_admin(), false)) then
    raise exception 'Only a manager or the owner can approve orders';
  end if;
  select data_value::jsonb into d from moe_data where group_id = p_group and data_key = 'drafts' for update;
  if d is null or jsonb_typeof(d) <> 'array'
     or not exists (select 1 from jsonb_array_elements(d) e where e->>'id' = p_draft_id) then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  nd := (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
         from jsonb_array_elements(d) with ordinality t(e, ord) where coalesce(e->>'id', '') <> p_draft_id);
  update moe_data set data_value = nd::text, updated_at = now() where group_id = p_group and data_key = 'drafts';

  select data_value::jsonb into h from moe_data where group_id = p_group and data_key = 'history' for update;
  if h is null or jsonb_typeof(h) <> 'array' then h := '[]'::jsonb; end if;
  if not exists (select 1 from jsonb_array_elements(h) e where e->>'id' = p_order->>'id') then
    h := (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) from (
            select e, ord from jsonb_array_elements(jsonb_build_array(p_order) || h) with ordinality t(e, ord)
            order by ord limit p_cap) s);
    insert into moe_data(group_id, data_key, data_value) values (p_group, 'history', h::text)
    on conflict (group_id, data_key) do update set data_value = excluded.data_value, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'drafts', nd, 'history', h);
end $$;

-- ── 5. Whole-value save that refuses to overwrite a newer copy ─────────────
-- p_expected = the updated_at this device loaded (null = the key didn't exist).
create or replace function public.moe_set_if_unchanged(p_group text, p_key text, p_value jsonb, p_expected timestamptz)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare cur_at timestamptz; cur_v text; found_row boolean; new_at timestamptz;
begin
  select updated_at, data_value into cur_at, cur_v from moe_data where group_id = p_group and data_key = p_key for update;
  found_row := found;
  if found_row and (p_expected is null or cur_at is distinct from p_expected) then
    return jsonb_build_object('ok', false, 'conflict', true, 'value', cur_v::jsonb, 'updated_at', cur_at);
  end if;
  if not found_row and p_expected is not null then
    return jsonb_build_object('ok', false, 'conflict', true, 'value', null, 'updated_at', null);
  end if;
  new_at := clock_timestamp();
  insert into moe_data(group_id, data_key, data_value, updated_at) values (p_group, p_key, p_value::text, new_at)
  on conflict (group_id, data_key) do update set data_value = excluded.data_value, updated_at = excluded.updated_at;
  return jsonb_build_object('ok', true, 'updated_at', new_at);
end $$;

revoke execute on function public.moe_array_patch(text,text,text,jsonb), public.moe_array_update(text,text,jsonb),
  public.moe_approve_draft(text,text,jsonb,int), public.moe_set_if_unchanged(text,text,jsonb,timestamptz) from public, anon;
grant execute on function public.moe_array_patch(text,text,text,jsonb), public.moe_array_update(text,text,jsonb),
  public.moe_approve_draft(text,text,jsonb,int), public.moe_set_if_unchanged(text,text,jsonb,timestamptz) to authenticated;

-- ── 6. Strip plaintext passwords from the legacy blobs ─────────────────────
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

alter function public.moe_protected_key(text) set search_path = public;
alter function public.moe_manager_key(text) set search_path = public;
