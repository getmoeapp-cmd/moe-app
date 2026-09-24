import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let client = null;
let loadPromise = null;

export function loadSupabase() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.supabase) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src*="@supabase/supabase-js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function getSB() {
  if (client) return client;
  if (typeof window !== "undefined" && window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export async function sbGet(group, key) {
  await loadSupabase();
  const sb = getSB();
  if (!sb) return { ok: false, value: null, error: "Supabase did not load" };
  try {
    const { data, error } = await sb
      .from("moe_data")
      .select("data_value")
      .eq("group_id", group)
      .eq("data_key", key)
      .maybeSingle();
    if (error) return { ok: false, value: null, error: error.message };
    if (!data) return { ok: true, value: null };
    try {
      return { ok: true, value: JSON.parse(data.data_value) };
    } catch {
      return { ok: false, value: null, error: "Stored value was not JSON" };
    }
  } catch (error) {
    return { ok: false, value: null, error: error.message || "Load failed" };
  }
}

export async function sbSet(group, key, value) {
  await loadSupabase();
  const sb = getSB();
  if (!sb) return { ok: false, error: "Supabase did not load" };
  try {
    const { error } = await sb.from("moe_data").upsert(
      { group_id: group, data_key: key, data_value: JSON.stringify(value) },
      { onConflict: "group_id,data_key" }
    );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Save failed" };
  }
}
