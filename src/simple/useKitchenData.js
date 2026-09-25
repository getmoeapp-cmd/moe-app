import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_GROUPS } from "../lib/config";
import { DEFAULT_INVENTORY, DEFAULT_VENDORS } from "../lib/defaults";
import { appendUsage, weekKeyOf } from "../lib/orders";
import { loadKitchen, saveKey, writeLocal } from "../lib/storage";
import { getSB, sbArrayPatch, sbArrayRemove, sbArrayUpsert, sbMerge, sbMergeUsage, sbPrepend } from "../lib/supabaseClient";

function fallbackInventory(group, value) {
  if (Array.isArray(value)) return value;
  return DEMO_GROUPS.includes(group) ? DEFAULT_INVENTORY : [];
}

function fallbackVendors(group, value) {
  if (Array.isArray(value)) return value;
  return DEMO_GROUPS.includes(group) ? DEFAULT_VENDORS : [];
}

export function useKitchenData(user) {
  const group = user.group;
  // loading → ready | offline (read failed: show data from this device, block writes that replace whole lists)
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [inventory, setInventory] = useState([]);
  const [stock, setStock] = useState({});
  const [vendors, setVendors] = useState([]);
  const [history, setHistory] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [countLog, setCountLog] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [recipes, setRecipes] = useState([]);
  const [saveState, setSaveState] = useState("saved");
  const [saveError, setSaveError] = useState("");
  const pendingStock = useRef({});         // { itemId: qty } not yet sent
  const stockTimer = useRef(null);
  const userRef = useRef(user);
  userRef.current = user;
  const statusRef = useRef(status);
  statusRef.current = status;

  const markSave = useCallback((result) => {
    if (result?.ok) {
      setSaveState("saved");
      setSaveError("");
    } else {
      setSaveState("local");
      setSaveError(result?.error || "Couldn't reach MOE. Changes are on this device only.");
    }
  }, []);

  // Whole-value writes (inventory, vendors). Refused while offline so a stale
  // or empty list on this device can never replace the kitchen's real list.
  const persist = useCallback(async (key, value) => {
    if (statusRef.current !== "ready") {
      const result = { ok: false, error: "Not connected — reload before editing the item list." };
      markSave(result);
      return result;
    }
    setSaveState("saving");
    const result = await saveKey(group, key, value);
    markSave(result);
    return result;
  }, [group, markSave]);

  const flushStock = useCallback(async () => {
    const patch = pendingStock.current;
    const ids = Object.keys(patch);
    if (ids.length === 0) return;
    pendingStock.current = {};
    setSaveState("saving");
    const result = await sbMerge(group, "stock", patch);
    if (!result.ok) {
      // Keep the unsent counts so the next tap (or reconnect) retries them.
      pendingStock.current = { ...patch, ...pendingStock.current };
      markSave(result);
      return;
    }
    writeLocal(group, "stock", result.value);
    const at = new Date().toISOString();
    const entries = ids.map((id) => ({ i: /^\d+$/.test(id) ? Number(id) : id, q: patch[id], by: userRef.current?.name || "", at }));
    const logged = await sbPrepend(group, "countLog", entries, 10000);
    if (logged.ok && Array.isArray(logged.value)) setCountLog(logged.value);
    markSave(logged.ok ? result : logged);
  }, [group, markSave]);

  const updateStock = useCallback((id, raw) => {
    const parsed = parseFloat(raw);
    const qty = Number.isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed * 100) / 100);
    setStock((prev) => ({ ...prev, [id]: qty }));
    pendingStock.current = { ...pendingStock.current, [id]: qty };
    setSaveState("saving");
    clearTimeout(stockTimer.current);
    stockTimer.current = setTimeout(flushStock, 800);
  }, [flushStock]);

  const reload = useCallback(async () => {
    const { data, ok, error } = await loadKitchen(group);
    setInventory(fallbackInventory(group, data.inventory));
    setVendors(fallbackVendors(group, data.vendors));
    const remoteStock = data.stock && typeof data.stock === "object" && !Array.isArray(data.stock) ? data.stock : {};
    setStock({ ...remoteStock, ...pendingStock.current });
    setHistory(Array.isArray(data.history) ? data.history : []);
    setSubscription(data.subscription ?? null);
    setCountLog(Array.isArray(data.countLog) ? data.countLog : []);
    setPriceHistory(data.priceHistory && typeof data.priceHistory === "object" ? data.priceHistory : {});
    setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
    setLoadError(ok ? "" : error);
    if (ok) { setSaveState("saved"); setSaveError(""); } else { setSaveState("local"); setSaveError(error); }
    setStatus(ok ? "ready" : "offline");
  }, [group]);

  useEffect(() => {
    setStatus("loading");
    reload();
  }, [reload]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushStock(); };
    const onOnline = () => { flushStock(); if (statusRef.current === "offline") reload(); };
    window.addEventListener("pagehide", flushStock);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("pagehide", flushStock);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
      clearTimeout(stockTimer.current);
      flushStock();
    };
  }, [flushStock, reload]);

  useEffect(() => {
    const sb = getSB();
    if (!sb) return undefined;
    const channel = sb.channel(`moe_simple_${group}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "moe_data",
        filter: `group_id=eq.${group}`,
      }, (payload) => {
        try {
          const key = payload.new?.data_key;
          const value = JSON.parse(payload.new?.data_value);
          // Stock: take the server copy, but keep taps from this device that aren't sent yet.
          if (key === "stock" && value && typeof value === "object") setStock({ ...value, ...pendingStock.current });
          if (key === "inventory") setInventory(Array.isArray(value) ? value : []);
          if (key === "vendors") setVendors(Array.isArray(value) ? value : []);
          if (key === "history") setHistory(Array.isArray(value) ? value : []);
          if (key === "subscription" && value) setSubscription(value);
          if (key === "countLog") setCountLog(Array.isArray(value) ? value : []);
          if (key === "priceHistory" && value && typeof value === "object") setPriceHistory(value);
          if (key === "recipes") setRecipes(Array.isArray(value) ? value : []);
        } catch {
          // Ignore malformed realtime payloads.
        }
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [group]);

  const saveInventory = useCallback(async (next) => {
    const result = await persist("inventory", next);
    if (result.ok) setInventory(next);
    return result;
  }, [persist]);

  const saveVendors = useCallback(async (next) => {
    const result = await persist("vendors", next);
    if (result.ok) setVendors(next);
    return result;
  }, [persist]);

  const placeOrder = useCallback(async (entry) => {
    setSaveState("saving");
    const added = await sbPrepend(group, "history", [entry], 5000);
    if (!added.ok) { markSave(added); return added; }
    setHistory(Array.isArray(added.value) ? added.value : [entry]);
    const usage = appendUsage({}, entry, inventory);
    const week = weekKeyOf(entry);
    const lines = usage[week]?.[entry.vendor] || {};
    const usageResult = await sbMergeUsage(group, week, entry.vendor, lines);
    markSave(usageResult);
    return { ok: true };
  }, [group, inventory, markSave]);

  // Record a case price for one item (adds to that item's price history only).
  const savePrice = useCallback(async (itemId, entry) => {
    const list = [...(priceHistory[itemId] || priceHistory[String(itemId)] || []), entry];
    const res = await sbMerge(group, "priceHistory", { [itemId]: list });
    if (res.ok && res.value) setPriceHistory(res.value);
    markSave(res);
    return res;
  }, [group, priceHistory, markSave]);

  // Many items at once (product import): { [itemId]: entry }
  const savePrices = useCallback(async (entries) => {
    const patch = {};
    Object.entries(entries).forEach(([id, entry]) => { patch[id] = [...(priceHistory[id] || []), entry]; });
    const res = await sbMerge(group, "priceHistory", patch);
    if (res.ok && res.value) setPriceHistory(res.value);
    markSave(res);
    return res;
  }, [group, priceHistory, markSave]);

  const saveRecipe = useCallback(async (recipe) => {
    const res = await sbArrayUpsert(group, "recipes", recipe, 1000);
    if (res.ok && Array.isArray(res.value)) setRecipes(res.value);
    markSave(res);
    return res;
  }, [group, markSave]);

  const deleteRecipe = useCallback(async (id) => {
    const res = await sbArrayRemove(group, "recipes", id);
    if (res.ok && Array.isArray(res.value)) setRecipes(res.value);
    markSave(res);
    return res;
  }, [group, markSave]);

  // Update fields on one saved order (sent to rep, received…).
  const patchOrder = useCallback(async (id, patch) => {
    const res = await sbArrayPatch(group, "history", id, patch);
    if (res.ok && Array.isArray(res.value)) setHistory(res.value);
    markSave(res);
    return res;
  }, [group, markSave]);

  return {
    status,
    group,
    patchOrder,
    loadError,
    reload,
    inventory,
    stock,
    vendors,
    history,
    countLog,
    priceHistory,
    recipes,
    savePrice,
    savePrices,
    saveRecipe,
    deleteRecipe,
    subscription,
    saveState,
    saveError,
    updateStock,
    saveInventory,
    saveVendors,
    placeOrder,
  };
}
