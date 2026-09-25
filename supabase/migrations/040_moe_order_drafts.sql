-- MOE: order drafts (count day → review → approve). ADDITIVE, safe any time.
-- Array-of-objects helpers keyed by each element's "id", so two phones can't clobber each other.

-- Add an element only if no element with the same id exists. Returns the whole array.
create or replace function public.moe_array_add_once(p_group text, p_key text, p_item jsonb, p_cap int default 500)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare cur jsonb; v jsonb;
begin
  select data_value::jsonb into cur from moe_data where group_id = p_group and data_key = p_key for update;
  if cur is null or jsonb_typeof(cur) <> 'array' then cur := '[]'::jsonb; end if;
  if exists (select 1 from jsonb_array_elements(cur) e where e->>'id' = p_item->>'id') then
    return cur;
  end if;
  v := (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) from (
          select e, ord from jsonb_array_elements(jsonb_build_array(p_item) || cur) with ordinality t(e, ord)
          order by ord limit p_cap) s);
  insert into moe_data(group_id, data_key, data_value) values (p_group, p_key, v::text)
  on conflict (group_id, data_key) do update set data_value = excluded.data_value, updated_at = now();
  return v;
end $$;

-- Replace the element with the same id (keeping its position), or add it to the front.
create or replace function public.moe_array_upsert(p_group text, p_key text, p_item jsonb, p_cap int default 500)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare cur jsonb; v jsonb;
begin
  select data_value::jsonb into cur from moe_data where group_id = p_group and data_key = p_key for update;
  if cur is null or jsonb_typeof(cur) <> 'array' then cur := '[]'::jsonb; end if;
  if exists (select 1 from jsonb_array_elements(cur) e where e->>'id' = p_item->>'id') then
    v := (select jsonb_agg(case when e->>'id' = p_item->>'id' then p_item else e end order by ord)
          from jsonb_array_elements(cur) with ordinality t(e, ord));
  else
    v := (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) from (
            select e, ord from jsonb_array_elements(jsonb_build_array(p_item) || cur) with ordinality t(e, ord)
            order by ord limit p_cap) s);
  end if;
  insert into moe_data(group_id, data_key, data_value) values (p_group, p_key, v::text)
  on conflict (group_id, data_key) do update set data_value = excluded.data_value, updated_at = now();
  return v;
end $$;

-- Remove the element with this id. Returns the whole array.
create or replace function public.moe_array_remove(p_group text, p_key text, p_id text)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare cur jsonb; v jsonb;
begin
  select data_value::jsonb into cur from moe_data where group_id = p_group and data_key = p_key for update;
  if cur is null or jsonb_typeof(cur) <> 'array' then return '[]'::jsonb; end if;
  v := (select coalesce(jsonb_agg(e order by ord), '[]'::jsonb)
        from jsonb_array_elements(cur) with ordinality t(e, ord) where coalesce(e->>'id', '') <> p_id);
  update moe_data set data_value = v::text, updated_at = now() where group_id = p_group and data_key = p_key;
  return v;
end $$;

-- Merge fields into one element (by id) of an array blob: mark an order sent, received, etc.
create or replace function public.moe_array_patch(p_group text, p_key text, p_id text, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare cur jsonb; v jsonb;
begin
  select data_value::jsonb into cur from moe_data where group_id = p_group and data_key = p_key for update;
  if cur is null or jsonb_typeof(cur) <> 'array' then return '[]'::jsonb; end if;
  v := (select jsonb_agg(case when e->>'id' = p_id then e || p_patch else e end order by ord)
        from jsonb_array_elements(cur) with ordinality t(e, ord));
  update moe_data set data_value = v::text, updated_at = now() where group_id = p_group and data_key = p_key;
  return v;
end $$;

revoke execute on function public.moe_array_add_once(text,text,jsonb,int), public.moe_array_upsert(text,text,jsonb,int),
  public.moe_array_remove(text,text,text), public.moe_array_patch(text,text,text,jsonb) from public, anon;
grant execute on function public.moe_array_add_once(text,text,jsonb,int), public.moe_array_upsert(text,text,jsonb,int),
  public.moe_array_remove(text,text,text), public.moe_array_patch(text,text,text,jsonb) to authenticated;
