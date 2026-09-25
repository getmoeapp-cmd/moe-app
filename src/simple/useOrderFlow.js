import { useCallback, useEffect, useRef, useState } from "react";
import { buildDraft, dayStr, draftToOrder, parseSheetKey, SHEET_PREFIX, sheetKey } from "../lib/orderFlow";
import { getSB, sbArrayAddOnce, sbArrayRemove, sbArrayUpsert, sbGet, sbGetRange, sbMerge } from "../lib/supabaseClient";

const DRAFTS = "drafts";

// Count sheets + draft orders for one kitchen. Sits on top of useKitchenData.
export function useOrderFlow(user, kitchen) {
  const group = user.group;
  const [sheets, setSheets] = useState({});
  const [drafts, setDrafts] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef({});      // { sheetKey: { itemId: {q,by,at}, _meta } }
  const timer = useRef(null);
  const kitchenRef = useRef(kitchen);
  kitchenRef.current = kitchen;
  const userRef = useRef(user);
  userRef.current = user;

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const batch = pending.current;
    pending.current = {};
    for (const [key, patch] of Object.entries(batch)) {
      const res = await sbMerge(group, key, patch);
      if (res.ok) setSheets((prev) => ({ ...prev, [key]: res.value }));
      else {
        pending.current[key] = { ...patch, ...(pending.current[key] || {}) };
        setError(res.error || "Count not saved");
      }
    }
  }, [group]);

  // Close a sheet → draft order for review. Safe to call twice (draft id = sheet key).
  const closeSheet = useCallback(async (key, { auto = false } = {}) => {
    await flush();
    const parsed = parseSheetKey(key);
    const k = kitchenRef.current;
    const vendor = (k.vendors || []).find((v) => String(v.id) === parsed?.vendorId);
    if (!parsed || !vendor) return { ok: false, error: "Supplier not found" };
    const closed = await sbMerge(group, key, { _closed: { at: new Date().toISOString(), by: auto ? "MOE (end of day)" : userRef.current?.name || "", auto } });
    if (!closed.ok) return closed;
    setSheets((prev) => ({ ...prev, [key]: closed.value }));
    const counts = {};
    Object.entries(closed.value || {}).forEach(([id, v]) => { if (!id.startsWith("_") && v && typeof v === "object") counts[id] = v; });
    const draft = buildDraft({ id: key, vendor, date: parsed.date, counts, inventory: k.inventory, closedBy: closed.value?._closed?.by || "", auto });
    const res = await sbArrayAddOnce(group, DRAFTS, draft);
    if (res.ok && Array.isArray(res.value)) setDrafts(res.value);
    return res;
  }, [flush, group]);

  // Load sheets from the last 2 weeks + drafts; close any sheet whose day is over.
  const reload = useCallback(async () => {
    const from = new Date(); from.setDate(from.getDate() - 14);
    const [s, d] = await Promise.all([
      sbGetRange(group, sheetKey(dayStr(from), ""), `${SHEET_PREFIX}~`),
      sbGet(group, DRAFTS),
    ]);
    if (!s.ok || !d.ok) { setError(s.error || d.error || "Couldn't load orders"); return; }
    setSheets(s.values);
    setDrafts(Array.isArray(d.value) ? d.value : []);
    setReady(true);
    const today = dayStr();
    for (const [key, sheet] of Object.entries(s.values)) {
      const p = parseSheetKey(key);
      if (p && p.date < today && !sheet?._closed) await closeSheet(key, { auto: true });
    }
  }, [group, closeSheet]);

  useEffect(() => {
    if (kitchen.status !== "ready") return;
    reload();
  }, [kitchen.status, reload]);

  // Live updates from other phones.
  useEffect(() => {
    const sb = getSB();
    if (!sb) return undefined;
    const ch = sb.channel(`moe_flow_${group}`).on("postgres_changes", {
      event: "*", schema: "public", table: "moe_data", filter: `group_id=eq.${group}`,
    }, (payload) => {
      try {
        const key = payload.new?.data_key || "";
        const value = JSON.parse(payload.new?.data_value);
        if (key === DRAFTS) setDrafts(Array.isArray(value) ? value : []);
        if (key.startsWith(SHEET_PREFIX)) {
          setSheets((prev) => ({ ...prev, [key]: { ...value, ...(pending.current[key] || {}) } }));
        }
      } catch { /* ignore */ }
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [group]);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); flush(); };
  }, [flush]);

  // Enter an on-hand count on a sheet (also updates live stock + the count log).
  const countItem = useCallback((key, vendor, item, raw) => {
    const n = parseFloat(raw);
    const q = Number.isNaN(n) ? 0 : Math.max(0, Math.round(n * 100) / 100);
    const entry = { q, by: userRef.current?.name || "", at: new Date().toISOString() };
    const id = String(item.id);
    setSheets((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), [id]: entry } }));
    pending.current[key] = {
      ...(pending.current[key] || {}),
      [id]: entry,
      _meta: { vendor: vendor.name, vendorId: vendor.id, openedBy: userRef.current?.name || "" },
    };
    kitchenRef.current.updateStock(item.id, q);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }, [flush]);

  // Start an order outside a count day, from the latest counts on the Stock screen.
  const newDraft = useCallback(async (vendor) => {
    const k = kitchenRef.current;
    const counts = {};
    Object.entries(k.stock || {}).forEach(([id, q]) => { counts[id] = { q, by: "" }; });
    const date = dayStr();
    const draft = buildDraft({ id: `manual_${date}_${vendor.id}_${Date.now().toString(36)}`, vendor, date, counts, inventory: k.inventory, closedBy: userRef.current?.name || "", source: "manual" });
    const res = await sbArrayAddOnce(group, DRAFTS, draft);
    if (res.ok && Array.isArray(res.value)) setDrafts(res.value);
    return res.ok ? { ok: true, draft } : res;
  }, [group]);

  const saveDraft = useCallback(async (draft) => {
    const res = await sbArrayUpsert(group, DRAFTS, { ...draft, editedBy: userRef.current?.name || "", editedAt: new Date().toISOString() });
    if (res.ok && Array.isArray(res.value)) setDrafts(res.value);
    return res;
  }, [group]);

  const deleteDraft = useCallback(async (id) => {
    const res = await sbArrayRemove(group, DRAFTS, id);
    if (res.ok && Array.isArray(res.value)) setDrafts(res.value);
    return res;
  }, [group]);

  // Approve → saved as a real order (history + usage), draft removed.
  const approveDraft = useCallback(async (draft) => {
    const order = draftToOrder(draft, userRef.current);
    if (order.lines.length === 0) return { ok: false, error: "Nothing to order — every quantity is 0." };
    const placed = await kitchenRef.current.placeOrder(order);
    if (!placed?.ok) return placed || { ok: false, error: "Order not saved" };
    await deleteDraft(draft.id);
    return { ok: true, order };
  }, [deleteDraft]);

  return { ready, error, sheets, drafts, countItem, closeSheet, flush, newDraft, saveDraft, deleteDraft, approveDraft, reload };
}
