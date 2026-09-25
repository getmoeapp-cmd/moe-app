-- MOE multi-tenant foundation. ADDITIVE: safe to run while the old app is live.
-- Creates kitchens, members, invites, platform admins, and the RPCs the new app calls.

create extension if not exists pgcrypto;

create table if not exists public.moe_kitchens (
  id          text primary key,
  name        text not null,
  owner_id    uuid references auth.users(id) on delete set null,
  business    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.moe_members (
  kitchen_id  text not null references public.moe_kitchens(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner','manager','employee')),
  name        text not null default '',
  email       text not null default '',
  created_at  timestamptz not null default now(),
  primary key (kitchen_id, user_id)
);
create index if not exists moe_members_user_idx on public.moe_members(user_id);

create table if not exists public.moe_invites (
  code        text primary key,
  kitchen_id  text not null references public.moe_kitchens(id) on delete cascade,
  role        text not null check (role in ('manager','employee')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz
);

create table if not exists public.moe_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.moe_kitchens        enable row level security;
alter table public.moe_members         enable row level security;
alter table public.moe_invites         enable row level security;
alter table public.moe_platform_admins enable row level security;

-- ── helpers (security definer so policies don't recurse) ─────────────────────
create or replace function public.moe_is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from moe_platform_admins where user_id = auth.uid());
$$;

create or replace function public.moe_is_member(g text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from moe_members where kitchen_id = g and user_id = auth.uid());
$$;

create or replace function public.moe_role(g text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select role from moe_members where kitchen_id = g and user_id = auth.uid();
$$;

create or replace function public.moe_is_manager(g text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(public.moe_role(g) in ('owner','manager'), false);
$$;

-- ── policies on the new tables ──────────────────────────────────────────────
drop policy if exists moe_kitchens_read on public.moe_kitchens;
create policy moe_kitchens_read on public.moe_kitchens for select to authenticated
  using (public.moe_is_member(id) or public.moe_is_admin());
drop policy if exists moe_kitchens_update on public.moe_kitchens;
create policy moe_kitchens_update on public.moe_kitchens for update to authenticated
  using (public.moe_role(id) = 'owner' or public.moe_is_admin())
  with check (public.moe_role(id) = 'owner' or public.moe_is_admin());

drop policy if exists moe_members_read on public.moe_members;
create policy moe_members_read on public.moe_members for select to authenticated
  using (public.moe_is_member(kitchen_id) or public.moe_is_admin());

drop policy if exists moe_invites_read on public.moe_invites;
create policy moe_invites_read on public.moe_invites for select to authenticated
  using (public.moe_is_manager(kitchen_id) or public.moe_is_admin());

drop policy if exists moe_admins_read on public.moe_platform_admins;
create policy moe_admins_read on public.moe_platform_admins for select to authenticated
  using (user_id = auth.uid());

revoke all on public.moe_kitchens, public.moe_members, public.moe_invites, public.moe_platform_admins from anon;
grant select, update on public.moe_kitchens to authenticated;
grant select on public.moe_members, public.moe_invites, public.moe_platform_admins to authenticated;

-- ── profile for the signed-in user ──────────────────────────────────────────
create or replace function public.moe_my_profile() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare m record; k record;
begin
  if auth.uid() is null then return null; end if;
  select * into m from moe_members where user_id = auth.uid()
    order by case role when 'owner' then 0 when 'manager' then 1 else 2 end, created_at limit 1;
  if m is null then
    return jsonb_build_object('user_id', auth.uid(), 'group', null, 'is_admin', moe_is_admin());
  end if;
  select * into k from moe_kitchens where id = m.kitchen_id;
  return jsonb_build_object(
    'user_id', auth.uid(), 'group', m.kitchen_id, 'role', m.role, 'name', m.name,
    'email', m.email, 'business', coalesce(k.business, '{}'::jsonb) || jsonb_build_object('name', k.name),
    'is_admin', moe_is_admin());
end $$;

-- ── create a kitchen for a new owner ────────────────────────────────────────
create or replace function public.moe_create_kitchen(p_name text, p_phone text default '', p_first text default '', p_last text default '')
returns text language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); base text; gid text; n int := 0; em text; trial_end timestamptz;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Enter the restaurant name'; end if;
  select kitchen_id into gid from moe_members where user_id = uid and role = 'owner' limit 1;
  if gid is not null then return gid; end if;          -- idempotent: one kitchen per owner signup
  select email into em from auth.users where id = uid;
  base := left(trim(both '_' from regexp_replace(regexp_replace(lower(trim(p_name)), '[^a-z0-9]', '_', 'g'), '_+', '_', 'g')), 30);
  if base = '' or base like '\_\_%' then base := 'kitchen'; end if;
  gid := base;
  while gid in ('demo') or exists (select 1 from moe_kitchens where id = gid)
        or exists (select 1 from moe_data where group_id = gid) loop
    n := n + 1; gid := left(base, 24) || '_' || substr(md5(random()::text), 1, 5);
    if n > 20 then raise exception 'Could not allocate a kitchen id'; end if;
  end loop;
  insert into moe_kitchens(id, name, owner_id, business)
    values (gid, trim(p_name), uid, jsonb_build_object('name', trim(p_name), 'type', 'restaurant', 'phone', coalesce(p_phone, '')));
  insert into moe_members(kitchen_id, user_id, role, name, email)
    values (gid, uid, 'owner', trim(coalesce(p_first, '') || ' ' || coalesce(p_last, '')), coalesce(em, ''));
  trial_end := now() + interval '14 days';
  insert into moe_data(group_id, data_key, data_value)
    values (gid, 'subscription', jsonb_build_object('plan', 'pro', 'status', 'trialing',
            'trialStart', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'trialEnd', to_char(trial_end at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))::text)
    on conflict (group_id, data_key) do nothing;
  return gid;
end $$;

-- ── team invites ────────────────────────────────────────────────────────────
create or replace function public.moe_create_invite(p_kitchen text, p_role text default 'employee')
returns text language plpgsql security definer set search_path = public, extensions as $$
declare c text; r text := moe_role(p_kitchen);
begin
  if r is null or r not in ('owner','manager') then raise exception 'Only owners and managers can invite'; end if;
  if p_role not in ('manager','employee') then raise exception 'Invalid role'; end if;
  if p_role = 'manager' and r <> 'owner' then raise exception 'Only the owner can invite managers'; end if;
  c := upper(substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=0O1Il', ''), 1, 8));
  insert into moe_invites(code, kitchen_id, role, created_by) values (c, p_kitchen, p_role, auth.uid());
  return c;
end $$;

create or replace function public.moe_invite_info(p_code text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('kitchen', k.name, 'role', i.role)
  from moe_invites i join moe_kitchens k on k.id = i.kitchen_id
  where i.code = upper(trim(p_code)) and i.used_at is null and i.expires_at > now();
$$;

create or replace function public.moe_join_kitchen(p_code text, p_name text default '')
returns text language plpgsql security definer set search_path = public, extensions as $$
declare i record; em text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into i from moe_invites where code = upper(trim(p_code)) for update;
  if i is null or i.used_at is not null or i.expires_at < now() then
    raise exception 'That invite code is not valid. Ask your manager for a new one.';
  end if;
  select email into em from auth.users where id = auth.uid();
  insert into moe_members(kitchen_id, user_id, role, name, email)
    values (i.kitchen_id, auth.uid(), i.role, coalesce(nullif(trim(p_name), ''), split_part(em, '@', 1)), coalesce(em, ''))
    on conflict (kitchen_id, user_id) do nothing;
  update moe_invites set used_by = auth.uid(), used_at = now() where code = i.code;
  return i.kitchen_id;
end $$;

create or replace function public.moe_remove_member(p_kitchen text, p_user uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare me text := moe_role(p_kitchen); them text;
begin
  select role into them from moe_members where kitchen_id = p_kitchen and user_id = p_user;
  if them is null then return; end if;
  if them = 'owner' then raise exception 'The owner cannot be removed'; end if;
  if not (me = 'owner' or (me = 'manager' and them = 'employee') or moe_is_admin()) then
    raise exception 'Not allowed';
  end if;
  delete from moe_members where kitchen_id = p_kitchen and user_id = p_user;
end $$;

create or replace function public.moe_set_member_role(p_kitchen text, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if moe_role(p_kitchen) <> 'owner' and not moe_is_admin() then raise exception 'Only the owner can change roles'; end if;
  if p_role not in ('manager','employee') then raise exception 'Invalid role'; end if;
  update moe_members set role = p_role where kitchen_id = p_kitchen and user_id = p_user and role <> 'owner';
end $$;

-- ── atomic JSON writes (fix lost updates between devices) ────────────────────
-- Merge a patch object into an object blob: stock counts, per-item maps.
create or replace function public.moe_merge(p_group text, p_key text, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare v jsonb;
begin
  insert into moe_data(group_id, data_key, data_value) values (p_group, p_key, p_patch::text)
  on conflict (group_id, data_key) do update
    set data_value = (case when jsonb_typeof(moe_data.data_value::jsonb) = 'object'
                           then moe_data.data_value::jsonb else '{}'::jsonb end || p_patch)::text,
        updated_at = now()
  returning data_value::jsonb into v;
  return v;
end $$;

-- Prepend items to an array blob, newest first, capped: countLog, history.
create or replace function public.moe_prepend(p_group text, p_key text, p_items jsonb, p_cap int default 3000)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare v jsonb;
begin
  insert into moe_data(group_id, data_key, data_value) values (p_group, p_key, p_items::text)
  on conflict (group_id, data_key) do update
    set data_value = (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) from (
          select e, ord from jsonb_array_elements(
            p_items || case when jsonb_typeof(moe_data.data_value::jsonb) = 'array'
                            then moe_data.data_value::jsonb else '[]'::jsonb end)
          with ordinality as t(e, ord) order by ord limit p_cap) s)::text,
        updated_at = now()
  returning data_value::jsonb into v;
  return v;
end $$;

-- Deep-merge (two levels) for usageLog: { week: { vendor: { itemId: {...} } } }
create or replace function public.moe_merge_usage(p_group text, p_week text, p_vendor text, p_lines jsonb)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare cur jsonb; v jsonb;
begin
  select data_value::jsonb into cur from moe_data where group_id = p_group and data_key = 'usageLog' for update;
  if cur is null or jsonb_typeof(cur) <> 'object' then cur := '{}'::jsonb; end if;
  v := jsonb_set(cur, array[p_week], coalesce(cur->p_week, '{}'::jsonb) ||
        jsonb_build_object(p_vendor, coalesce(cur->p_week->p_vendor, '{}'::jsonb) || p_lines), true);
  insert into moe_data(group_id, data_key, data_value) values (p_group, 'usageLog', v::text)
  on conflict (group_id, data_key) do update set data_value = excluded.data_value, updated_at = now();
  return v;
end $$;

-- ── platform admin ──────────────────────────────────────────────────────────
create or replace function public.moe_admin_kitchens() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not moe_is_admin() then raise exception 'Not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', k.id, 'name', k.name, 'business', k.business, 'created_at', k.created_at,
      'owner_email', (select email from moe_members m where m.kitchen_id = k.id and m.role = 'owner' limit 1),
      'members', (select count(*) from moe_members m where m.kitchen_id = k.id),
      'subscription', (select data_value::jsonb from moe_data d where d.group_id = k.id and d.data_key = 'subscription'),
      'last_activity', (select max(updated_at) from moe_data d where d.group_id = k.id)
    ) order by k.created_at desc) from moe_kitchens k), '[]'::jsonb);
end $$;

create or replace function public.moe_admin_set_subscription(p_kitchen text, p_sub jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not moe_is_admin() then raise exception 'Not allowed'; end if;
  insert into moe_data(group_id, data_key, data_value) values (p_kitchen, 'subscription', p_sub::text)
  on conflict (group_id, data_key) do update set data_value = excluded.data_value, updated_at = now();
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'moe\_%' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop; end $$;
grant execute on function public.moe_invite_info(text) to anon;
grant execute on function public.moe_my_profile(), public.moe_create_kitchen(text,text,text,text),
  public.moe_create_invite(text,text), public.moe_invite_info(text), public.moe_join_kitchen(text,text),
  public.moe_remove_member(text,uuid), public.moe_set_member_role(text,uuid,text),
  public.moe_merge(text,text,jsonb), public.moe_prepend(text,text,jsonb,int),
  public.moe_merge_usage(text,text,text,jsonb), public.moe_admin_kitchens(),
  public.moe_admin_set_subscription(text,jsonb),
  public.moe_is_admin(), public.moe_is_member(text), public.moe_is_manager(text), public.moe_role(text)
  to authenticated;
