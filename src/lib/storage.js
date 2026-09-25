import { sbGetMany, sbSet } from "./supabaseClient";

export function cacheKey(group, key) {
  return `moe_${group}_${key}`;
}

export function readLocal(group, key) {
  try {
    const raw = localStorage.getItem(cacheKey(group, key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeLocal(group, key, value) {
  try {
    localStorage.setItem(cacheKey(group, key), JSON.stringify(value));
  } catch {
    // Private mode or a full disk. The remote write can still succeed.
  }
}

const KITCHEN_KEYS = ["stock", "vendors", "inventory", "history", "subscription", "countLog", "priceHistory", "recipes"];

// ok:true  → data is the server's copy (missing keys really are empty)
// ok:false → server unreachable; data is this device's last copy, for display only
export async function loadKitchen(group) {
  const remote = await sbGetMany(group, KITCHEN_KEYS);
  const data = {};
  if (remote.ok) {
    KITCHEN_KEYS.forEach((key) => {
      if (key in remote.values) {
        data[key] = remote.values[key];
        writeLocal(group, key, remote.values[key]);
      }
    });
    return { data, ok: true, error: "" };
  }
  KITCHEN_KEYS.forEach((key) => {
    const local = readLocal(group, key);
    if (local !== null) data[key] = local;
  });
  return { data, ok: false, error: remote.error || "Couldn't reach MOE." };
}

export async function saveKey(group, key, value) {
  writeLocal(group, key, value);
  return sbSet(group, key, value);
}
