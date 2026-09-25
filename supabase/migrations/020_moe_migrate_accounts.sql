-- MOE: move existing logins out of the moe_data blobs into Supabase Auth.
-- Idempotent — safe to run more than once (run again right before cutover to catch late signups).
-- Existing passwords are carried over (bcrypt-hashed) so nobody has to reset.
-- Emails that already have a Supabase Auth user keep that user and its password.
-- Nothing in moe_data is modified here. Passwords are removed from the blobs in 030.

do $$
declare
  acc record; mem record; uid uuid; grp text; bname text; pw text; em text; nm text;
begin
  -- helper: find-or-create an auth user
  create temporary table if not exists _moe_mig(email text primary key, uid uuid) on commit drop;

  -- 1) Owner accounts in __moe_accounts__/accounts
  for acc in
    select key as email_key, value as a
    from moe_data d, jsonb_each(d.data_value::jsonb)
    where d.group_id = '__moe_accounts__' and d.data_key = 'accounts'
  loop
    em  := lower(trim(coalesce(acc.a->>'email', acc.email_key)));
    pw  := acc.a->>'password';
    grp := acc.a->>'group';
    nm  := trim(coalesce(acc.a->>'ownerFirst','') || ' ' || coalesce(acc.a->>'ownerLast',''));
    continue when em is null or em = '' or grp is null or grp = '';

    select id into uid from auth.users where lower(email) = em limit 1;
    if uid is null and pw is not null and pw <> '' then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
        crypt(pw, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', nm, 'migrated', true),
        now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
    end if;
    continue when uid is null;

    bname := coalesce(nullif(acc.a->'business'->>'name',''), grp);
    insert into moe_kitchens(id, name, owner_id, business)
      values (grp, bname, uid, coalesce(acc.a->'business', '{}'::jsonb))
      on conflict (id) do nothing;
    insert into moe_members(kitchen_id, user_id, role, name, email)
      values (grp, uid, 'owner', nm, em)
      on conflict (kitchen_id, user_id) do nothing;
  end loop;

  -- 2) Team members stored in <group>/team arrays
  for mem in
    select d.group_id as grp, m
    from moe_data d, jsonb_array_elements(d.data_value::jsonb) m
    where d.data_key = 'team' and jsonb_typeof(d.data_value::jsonb) = 'array'
      and exists (select 1 from moe_kitchens k where k.id = d.group_id)
  loop
    em := lower(trim(coalesce(mem.m->>'email','')));
    pw := mem.m->>'password';
    continue when em = '' ;
    uid := null;
    select id into uid from auth.users where lower(email) = em limit 1;
    if uid is null and pw is not null and pw <> '' then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
        crypt(pw, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', mem.m->>'name', 'migrated', true),
        now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
    end if;
    continue when uid is null;
    insert into moe_members(kitchen_id, user_id, role, name, email)
      values (mem.grp, uid,
        case when lower(mem.m->>'role') = 'manager' then 'manager' else 'employee' end,
        coalesce(mem.m->>'name',''), em)
      on conflict (kitchen_id, user_id) do nothing;
  end loop;

  -- 3) Demo kitchen shell (demo login user is created separately with a private password)
  insert into moe_kitchens(id, name, business)
    values ('demo', 'Demo Kitchen', '{"name":"Demo Kitchen","type":"restaurant"}'::jsonb)
    on conflict (id) do nothing;

  -- 4) Platform admin: the Tommy's Pizza owner login
  insert into moe_platform_admins(user_id)
    select id from auth.users where lower(email) = 'tommyspizza11419@gmail.com'
    on conflict do nothing;
end $$;
