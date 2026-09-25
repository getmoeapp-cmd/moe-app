import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

// One shared client for the whole app (simple + classic). The signed-in
// session rides along on every request, so row-level security decides which
// kitchen's rows a user can see.
let client = null;

export function getSB() {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "moe-auth" },
  });
  return client;
}

// Kept for older call sites. The client is bundled now, so there is nothing to load.
export function loadSupabase() {
  return Promise.resolve();
}

function fail(error, fallback = "Couldn't reach the server") {
  return { ok: false, value: null, error: error?.message || fallback };
}

// { ok: true, value } when the read worked (value null = no row yet)
// { ok: false, error } when it did not — callers must not treat that as "empty".
export async function sbGet(group, key) {
  const sb = getSB();
  if (!sb) return fail(null, "Supabase is not configured");
  try {
    const { data, error } = await sb
      .from("moe_data")
      .select("data_value")
      .eq("group_id", group)
      .eq("data_key", key)
      .maybeSingle();
    if (error) return fail(error);
    if (!data) return { ok: true, value: null };
    try {
      return { ok: true, value: JSON.parse(data.data_value) };
    } catch {
      return fail(null, "Stored value was not JSON");
    }
  } catch (error) {
    return fail(error, "Load failed");
  }
}

// Read many keys for one kitchen in a single request.
export async function sbGetMany(group, keys) {
  const sb = getSB();
  if (!sb) return { ok: false, values: {}, error: "Supabase is not configured" };
  try {
    const { data, error } = await sb
      .from("moe_data")
      .select("data_key, data_value")
      .eq("group_id", group)
      .in("data_key", keys);
    if (error) return { ok: false, values: {}, error: error.message };
    const values = {};
    (data || []).forEach((row) => {
      try { values[row.data_key] = JSON.parse(row.data_value); } catch { /* skip bad row */ }
    });
    return { ok: true, values };
  } catch (error) {
    return { ok: false, values: {}, error: error.message || "Load failed" };
  }
}

export async function sbSet(group, key, value) {
  const sb = getSB();
  if (!sb) return { ok: false, error: "Supabase is not configured" };
  try {
    const { error } = await sb.from("moe_data").upsert(
      { group_id: group, data_key: key, data_value: JSON.stringify(value), updated_at: new Date().toISOString() },
      { onConflict: "group_id,data_key" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Save failed" };
  }
}

async function rpc(name, args) {
  const sb = getSB();
  if (!sb) return { ok: false, error: "Supabase is not configured" };
  try {
    const { data, error } = await sb.rpc(name, args);
    if (error) return { ok: false, error: error.message };
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: error.message || "Request failed" };
  }
}

// Merge only the changed keys into an object blob (stock counts). Two phones
// counting different items no longer overwrite each other.
export const sbMerge = (group, key, patch) => rpc("moe_merge", { p_group: group, p_key: key, p_patch: patch });

// Add entries to the front of an array blob (orders, count log) without
// replacing what another device added in the meantime.
export const sbPrepend = (group, key, items, cap = 3000) =>
  rpc("moe_prepend", { p_group: group, p_key: key, p_items: items, p_cap: cap });

// Add one vendor's order lines to usageLog[week][vendor].
export const sbMergeUsage = (group, week, vendor, lines) =>
  rpc("moe_merge_usage", { p_group: group, p_week: week, p_vendor: vendor, p_lines: lines });

export const sbRpc = rpc;

// All keys for one kitchen in [fromKey, toKey) — e.g. the last two weeks of count sheets.
export async function sbGetRange(group, fromKey, toKey) {
  const sb = getSB();
  if (!sb) return { ok: false, values: {}, error: "Supabase is not configured" };
  try {
    const { data, error } = await sb
      .from("moe_data")
      .select("data_key, data_value")
      .eq("group_id", group)
      .gte("data_key", fromKey)
      .lt("data_key", toKey);
    if (error) return { ok: false, values: {}, error: error.message };
    const values = {};
    (data || []).forEach((row) => {
      try { values[row.data_key] = JSON.parse(row.data_value); } catch { /* skip bad row */ }
    });
    return { ok: true, values };
  } catch (error) {
    return { ok: false, values: {}, error: error.message || "Load failed" };
  }
}

// Array-of-objects blobs keyed by element id (order drafts, history).
export const sbArrayAddOnce = (group, key, item, cap = 500) => rpc("moe_array_add_once", { p_group: group, p_key: key, p_item: item, p_cap: cap });
export const sbArrayUpsert = (group, key, item, cap = 500) => rpc("moe_array_upsert", { p_group: group, p_key: key, p_item: item, p_cap: cap });
export const sbArrayRemove = (group, key, id) => rpc("moe_array_remove", { p_group: group, p_key: key, p_id: String(id) });
export const sbArrayPatch = (group, key, id, patch) => rpc("moe_array_patch", { p_group: group, p_key: key, p_id: String(id), p_patch: patch });
