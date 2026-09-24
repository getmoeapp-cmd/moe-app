import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_GROUPS, TRIAL_DAYS } from "../lib/config";
import { DEFAULT_INVENTORY, DEFAULT_VENDORS } from "../lib/defaults";
import { appendUsage } from "../lib/orders";
import { loadKitchen, saveKey } from "../lib/storage";
import { getSB, loadSupabase } from "../lib/supabaseClient";

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
  const [status, setStatus] = useState("loading");
  const [inventory, setInventory] = useState([]);
  const [stock, setStock] = useState({});
  const [vendors, setVendors] = useState([]);
  const [history, setHistory] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [saveState, setSaveState] = useState("saved");
  const [saveError, setSaveError] = useState("");
  const usageRef = useRef({});
  const countRef = useRef([]);
  const pendingStock = useRef(null);
  const changedIds = useRef(new Set());
  const stockTimer = useRef(null);
  const userRef = useRef(user);
  userRef.current = user;

  const markSave = useCallback((result) => {
    if (result?.ok) {
      setSaveState("saved");
      setSaveError("");
    } else {
      setSaveState("local");
      setSaveError(result?.error || "Couldn't reach Supabase. Changes are on this device only.");
    }
  }, []);

  const persist = useCallback(async (key, value) => {
    setSaveState("saving");
    const result = await saveKey(group, key, value);
    markSave(result);
    return result;
  }, [group, markSave]);

  const flushStock = useCallback(() => {
    const next = pendingStock.current;
    if (!next) return;
    pendingStock.current = null;
    const ids = [...changedIds.current];
    changedIds.current = new Set();
    persist("stock", next);
    if (ids.length === 0) return;
    const stamped = ids.map((id) => ({
      i: id,
      q: next[id],
      by: userRef.current?.name || "",
      at: new Date().toISOString(),
    }));
    const log = [...stamped.reverse(), ...countRef.current].slice(0, 3000);
    countRef.current = log;
    saveKey(group, "countLog", log).then(markSave);
  }, [group, markSave, persist]);

  const updateStock = useCallback((id, raw) => {
    const parsed = parseInt(raw, 10);
    const qty = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    setStock((prev) => {
      const next = { ...prev, [id]: qty };
      pendingStock.current = next;
      changedIds.current.add(id);
      return next;
    });
    setSaveState("saving");
    clearTimeout(stockTimer.current);
    stockTimer.current = setTimeout(flushStock, 800);
  }, [flushStock]);

  useEffect(() => {
    let cancel = false;
    setStatus("loading");
    loadKitchen(group).then(({ data, error }) => {
      if (cancel) return;
      setInventory(fallbackInventory(group, data.inventory));
      setVendors(fallbackVendors(group, data.vendors));
      setStock(data.stock && typeof data.stock === "object" && !Array.isArray(data.stock) ? data.stock : {});
      setHistory(Array.isArray(data.history) ? data.history : []);
      setSubscription(data.subscription ?? null);
      usageRef.current = data.usageLog && typeof data.usageLog === "object" ? data.usageLog : {};
      countRef.current = Array.isArray(data.countLog) ? data.countLog : [];
      if (error) {
        setSaveState("local");
        setSaveError(error);
      } else {
        setSaveState("saved");
        setSaveError("");
      }
      setStatus("ready");
    });
    return () => { cancel = true; };
  }, [group]);

  useEffect(() => {
    if (status !== "ready" || DEMO_GROUPS.includes(group) || subscription) return undefined;
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
    const next = {
      plan: "pro",
      status: "trialing",
      trialStart: new Date().toISOString(),
      trialEnd: trialEnd.toISOString(),
    };
    setSubscription(next);
    persist("subscription", next);
    return undefined;
  }, [status, group, subscription, persist]);

  useEffect(() => {
    const onHide = () => flushStock();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      clearTimeout(stockTimer.current);
      flushStock();
    };
  }, [flushStock]);

  useEffect(() => {
    let channel;
    let cancel = false;
    loadSupabase().then(() => {
      const sb = getSB();
      if (!sb || cancel) return;
      channel = sb.channel(`moe_simple_${group}`)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "moe_data",
          filter: `group_id=eq.${group}`,
        }, (payload) => {
          try {
            const key = payload.new?.data_key;
            const value = JSON.parse(payload.new?.data_value);
            if (key === "stock" && !pendingStock.current) setStock(value);
            if (key === "inventory") setInventory(Array.isArray(value) ? value : []);
            if (key === "vendors") setVendors(Array.isArray(value) ? value : []);
            if (key === "history") setHistory(Array.isArray(value) ? value : []);
            if (key === "subscription" && value) setSubscription(value);
          } catch {
            // Ignore malformed realtime payloads.
          }
        })
        .subscribe();
    });
    return () => {
      cancel = true;
      if (channel) getSB()?.removeChannel(channel);
    };
  }, [group]);

  const saveInventory = useCallback((next) => {
    setInventory(next);
    return persist("inventory", next);
  }, [persist]);

  const saveVendors = useCallback((next) => {
    setVendors(next);
    return persist("vendors", next);
  }, [persist]);

  const placeOrder = useCallback(async (entry) => {
    const nextHistory = [entry, ...history];
    setHistory(nextHistory);
    const nextUsage = appendUsage(usageRef.current, entry, inventory);
    usageRef.current = nextUsage;
    const historyResult = await saveKey(group, "history", nextHistory);
    const usageResult = await saveKey(group, "usageLog", nextUsage);
    markSave(historyResult.ok ? usageResult : historyResult);
    return historyResult.ok ? usageResult : historyResult;
  }, [group, history, inventory, markSave]);

  const selectPlan = useCallback((plan) => {
    const next = {
      ...(subscription || {}),
      plan,
      status: "active",
      subscribedAt: new Date().toISOString(),
    };
    setSubscription(next);
    return persist("subscription", next);
  }, [persist, subscription]);

  return {
    status,
    inventory,
    stock,
    vendors,
    history,
    subscription,
    saveState,
    saveError,
    updateStock,
    saveInventory,
    saveVendors,
    placeOrder,
    selectPlan,
  };
}
