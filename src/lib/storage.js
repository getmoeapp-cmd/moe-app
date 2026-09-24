import { sbGet, sbSet } from "./supabaseClient";

export function cacheKey(group, key) {
  return `moe_${group}_${key}`;
}

function readLocal(group, key) {
  try {
    const raw = localStorage.getItem(cacheKey(group, key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocal(group, key, value) {
  try {
    localStorage.setItem(cacheKey(group, key), JSON.stringify(value));
  } catch {
    // Private mode or a full disk. The remote write can still succeed.
  }
}

const KITCHEN_KEYS = ["stock", "vendors", "inventory", "history", "subscription", "usageLog", "countLog"];

export async function loadKitchen(group) {
  const rows = await Promise.all(KITCHEN_KEYS.map(async (key) => ({ key, remote: await sbGet(group, key) })));
  const data = {};
  let error = "";
  rows.forEach(({ key, remote }) => {
    if (remote.ok && remote.value !== null) {
      data[key] = remote.value;
      writeLocal(group, key, remote.value);
      return;
    }
    const local = readLocal(group, key);
    if (local !== null) {
      data[key] = local;
      if (remote.ok && remote.value === null) sbSet(group, key, local);
      else if (!remote.ok && !error) error = remote.error;
      return;
    }
    if (!remote.ok && !error) error = remote.error;
  });
  return { data, error };
}

export async function saveKey(group, key, value) {
  writeLocal(group, key, value);
  return sbSet(group, key, value);
}
