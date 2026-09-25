import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { SUPPORT_EMAIL } from "./lib/config";
import { DEFAULT_INVENTORY, DEFAULT_VENDORS } from "./lib/defaults";
import { getSB, sbGetMany, sbSet as sbSetResult, sbMerge, sbPrepend, sbMergeUsage, sbRpc } from "./lib/supabaseClient";
import TeamPanel from "./simple/TeamPanel";
import UsageScreen from "./simple/UsageScreen";
import { ItemCosts, Recipes as CostRecipes } from "./simple/CostsScreen";
import { sbArrayUpsert, sbArrayRemove } from "./lib/supabaseClient";
import { calcQuizSavings, quizPaybackDays, quizRoiMultiple } from "./lib/quizMath";
import {
  DAYS, DAYS_SHORT, getWeekNumber, getWeekYear, weekKey, getToday, fmtDate, getWeekMonday, fmtWeekLabel,
  calcOrderQty, getStatus, flatItems, vendorsOrderingToday,
} from "./lib/stockMath";

// ═══════════════════════════════════════════════════════════════════════════════
// MOE — Make Ordering Easy
// Simplified kitchen flow: src/simple (default at /app). This file is classic MOE (/app?classic=1 or /classic).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
// Shared client from src/lib (signed-in session + row-level security).
const loadSupabase = () => Promise.resolve();
const sbSet = (grp, key, value) => sbSetResult(grp, key, value);
const normName = (v) => String(v || "").trim().toLowerCase();
// "2 Case + 3 each" — orders from the main app can include single pieces from a split case.
const qtyText = (l) => `${l.qty || 0} ${l.order_unit || ""}${(l.qty || 0) !== 1 && l.order_unit ? "s" : ""}${l.each_qty ? ` + ${l.each_qty} each` : ""}`;
// Whole number from user/AI input; keeps an explicit 0 instead of turning it into the default.
const intOr = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : d; };
// Split one CSV/TSV line, respecting "quoted, fields".
const splitDelimited = (line, sep) => {
  if (sep !== ",") return line.split(sep).map(c => c.trim());
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
};
// Server-side AI proxy. Sends the signed-in session so /api/claude can refuse anonymous callers.
const callClaude = async (body) => {
  const sb = getSB();
  const { data } = sb ? await sb.auth.getSession() : { data: null };
  const token = data?.session?.access_token || "";
  return fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
};

// ─── PRICE HELPERS ────────────────────────────────────────────────────────────
// ONE canonical way to read a price out of priceHistory, used by every section
// (Recipes, Dashboard, Price Tracker, Waste Log, Food Cost). Handles all the
// entry formats that exist in production data:
//   • basis:"unit" entries (new format)      → perUnit is already per INDIVIDUAL unit
//   • legacy entries WITH perUnit            → inline-edit / order-review typed the
//     ORDER-unit (case) price, so divide by upu to get the individual-unit price
//   • legacy entries WITHOUT perUnit         → invoice/CSV/manual-entry flows already
//     stored price per INDIVIDUAL unit (post-UPU expansion)
const entryPerUnit = (entry, upu = 1) => {
  if (!entry) return null;
  const u = Math.max(1, Number(upu) || 1);
  if (entry.basis === "unit" && entry.perUnit != null) return Number(entry.perUnit);
  if (entry.perUnit != null) return Number(entry.perUnit) / u;
  return entry.price != null ? Number(entry.price) : null;
};
const latestPriceEntry = (priceHistory, itemId) => {
  const ph = priceHistory?.[itemId];
  if (!Array.isArray(ph) || ph.length === 0) return null;
  return [...ph].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
};
// Latest price per INDIVIDUAL unit (what one egg / one gallon / one block costs)
const latestPerUnit = (priceHistory, item) => entryPerUnit(latestPriceEntry(priceHistory, item?.id), item?.upu || 1);
// Latest price per ORDER unit (what one case / bag / each costs — what you pay the vendor)
const latestPerOrderUnit = (priceHistory, item) => {
  const p = latestPerUnit(priceHistory, item);
  return p == null ? null : p * Math.max(1, Number(item?.upu) || 1);
};

// Compress image to max 1200px wide, JPEG quality 0.7 — keeps it under Vercel's 4.5MB limit
const compressImage = (file, maxWidth = 1200, quality = 0.7) => new Promise(async (resolve, reject) => {
  try {
    // Handle PDFs — render first page to image using PDF.js
    if (file.type === "application/pdf") {
      // Load PDF.js from CDN if not loaded
      if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(); };
          s.onerror = () => rej(new Error("Failed to load PDF viewer"));
          document.head.appendChild(s);
        });
      }
      const arrayBuf = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuf }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 }); // 2x for clarity
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      // Compress the rendered page
      let w = canvas.width, h = canvas.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const outCanvas = document.createElement("canvas");
      outCanvas.width = w; outCanvas.height = h;
      outCanvas.getContext("2d").drawImage(canvas, 0, 0, w, h);
      resolve(outCanvas.toDataURL("image/jpeg", quality).split(",")[1]);
      return;
    }

    // Handle images
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  } catch (err) { reject(err); }
});

// ─── SUBSCRIPTION PLANS ──────────────────────────────────────────────────────
const PLANS = {
  starter:    { name: "Starter",    price: 299, vendors: 3,        items: 100,      users: 2,        label: "For small kitchens" },
  pro:        { name: "Pro",        price: 399, vendors: Infinity, items: Infinity,  users: 10,       label: "For growing operations" },
  enterprise: { name: "Enterprise", price: 499, vendors: Infinity, items: Infinity,  users: Infinity, label: "For multi-location businesses" },
};
const TRIAL_DAYS = 14;
const DEMO_GROUPS = ["demo"]; // Demo accounts skip subscription
// Platform admin comes from the server (moe_platform_admins), never from an email list in the browser.
const isPlatformAdmin = (user) => !!user?.isAdmin;
const subscribeHref = (user, planName = "") => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`MOE subscription — ${user?.business?.name || "my kitchen"}`)}&body=${encodeURIComponent(`Hi, I'd like to subscribe to MOE${planName ? ` ${planName}` : ""}.\n\nRestaurant: ${user?.business?.name || ""}\nLogin email: ${user?.email || ""}\n`)}`;
const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

// ─── PDF GENERATOR ────────────────────────────────────────────────────────────
const printVendorPDF = ({ vendorName, items, weekNum, year, date, businessName, orderedBy }) => {
  const win = window.open("", "_blank");
  if (!win) { alert("Allow pop-ups for this site to print the order."); return; }
  const rows = items.filter(i => i.qty > 0 || i.each_qty > 0).map(item =>
    `<tr><td>${escHtml(item.name)}</td><td style="text-align:center">${escHtml((item.section || "").replace(/[^\w\s\-&]/g,"").trim())}</td><td style="text-align:center;font-weight:700">${escHtml(item.qty)} ${escHtml(item.order_unit)}${item.each_qty ? ` + ${escHtml(item.each_qty)} EACH (split case)` : ""}</td></tr>`
  ).join("");
  const totalItems = items.filter(i => i.qty > 0).length;
  win.document.write(`<html><head><title>${escHtml(vendorName)} — WK${weekNum}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:700px;margin:0 auto}h1{font-size:20px;margin:0 0 4px}.biz{font-size:24px;font-weight:900;color:#111;margin:0 0 2px;text-transform:uppercase;letter-spacing:1px}.vendor{font-size:22px;font-weight:700;color:#444;margin:0 0 6px}.meta{color:#666;font-size:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#1e293b;color:#fff;padding:10px 14px;text-align:left}th:last-child{text-align:center}td{padding:10px 14px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}.footer{margin-top:20px;color:#999;font-size:11px;border-top:1px solid #e5e7eb;padding-top:12px}@media print{body{padding:16px}}</style></head><body>
    ${businessName ? `<div class="biz">${escHtml(businessName)}</div>` : ""}
    <div class="vendor">${escHtml(vendorName)}</div>
    <h1>Order — Week ${weekNum} (Mon ${getWeekMonday(weekNum, year || getWeekYear()).toLocaleDateString("en-US", { month:"short", day:"numeric" })})</h1>
    <div class="meta">${date} · ${totalItems} item${totalItems!==1?"s":""} · Ordered by: <strong>${escHtml(orderedBy || "—")}</strong></div>
    <table><thead><tr><th>Item</th><th style="text-align:center">Location</th><th style="text-align:center">Qty to Order</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">MOE · Make Ordering Easy · Printed ${new Date().toLocaleDateString()}</div>
    <script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export function MoeApp({ initialUser, onLogout }) {
  const initialDemo = DEMO_GROUPS.includes(initialUser?.group);
  const [user, setUser]         = useState(initialUser || null);
  const [stock, setStock]       = useState({});
  const [vendors, setVendors]   = useState(initialDemo ? DEFAULT_VENDORS : []);
  const [inventory, setInventory] = useState(initialDemo ? DEFAULT_INVENTORY : []);
  const [history, setHistory]   = useState([]);
  const [view, setView]         = useState(initialUser?.role === "owner" ? "dashboard" : "inventory");
  const [group]                 = useState(initialUser?.group || null);
  const [flash, setFlash]       = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navOpenedAt = useRef(0);
  const [usageLog, setUsageLog]     = useState({});
  const [stockSnapshots, setStockSnapshots] = useState({}); // { [weekKey]: { [itemId]: count, _ts } }
  const [countLog, setCountLog]             = useState([]); // [{ i: itemId, q: qty, by, at }] newest first, capped
  const stockSaveTimerRef = useRef(null);    // debounce timer for stock writes
  const pendingStockRef = useRef({});        // { [itemId]: qty } taps not yet sent
  const [subscription, setSubscription] = useState(null); // { plan, status, trialStart, trialEnd, subscribedAt } — written by the server only
  const [wasteLog, setWasteLog]         = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [recipes, setRecipes]           = useState([]); // [{ id, name, yield, ingredients:[{itemId, qty, unit}], notes }]
  const [dataLoaded, setDataLoaded]     = useState(false);
  const [loadError, setLoadError]       = useState("");
  const [loadTick, setLoadTick]         = useState(0);
  const [saveError, setSaveError]       = useState("");
  const [onboarding, setOnboarding]     = useState(null); // null = not started, 1-4 = step, "done" = completed
  const [permissions, setPermissions]   = useState({
    manager: ["inventory", "waste", "orders", "history", "insights", "prices", "backend", "settings"],
    employee: ["inventory", "waste", "history"],
  });
  const [autoSubmit, setAutoSubmit]     = useState(true); // auto-submit missed orders when a new week starts
  const [foodCost, setFoodCost]         = useState(false); // optional food-cost add-on (off by default)

  const flashTimer = useRef(null);
  const showFlash = (msg = "✓ Saved") => { setFlash(msg); clearTimeout(flashTimer.current); flashTimer.current = setTimeout(() => setFlash(""), 2500); };

  // ── Persistence ──────────────────────────────────────────────────────────
  const groupRef = React.useRef(group);
  React.useEffect(() => { groupRef.current = group; }, [group]);

  const noteResult = useCallback((result) => {
    if (result && result.ok === false) setSaveError(result.error || "Couldn't save. Check the connection.");
    else setSaveError("");
    return result;
  }, []);

  // Whole-value write. Only used after a successful load, so it never replaces
  // the kitchen's real data with defaults or a stale copy.
  const save = useCallback(async (key, value) => {
    const g = groupRef.current;
    if (!g) return { ok: false, error: "No kitchen" };
    try { localStorage.setItem(`moe_${g}_${key}`, JSON.stringify(value)); } catch {}
    return noteResult(await sbSet(g, key, value));
  }, [noteResult]);

  // ── Save inventory ────────────────────────────────────────────────────────
  const saveInventory = useCallback((newInv) => { setInventory(newInv); save("inventory", newInv); showFlash(); }, [save]);
  const saveHistory = useCallback((newHist) => { setHistory(newHist); save("history", newHist); }, [save]);

  // ── Load data on login ───────────────────────────────────────────────────
  const KEYS = ["stock","vendors","history","inventory","usageLog","stockSnapshots","subscription","wasteLog","priceHistory","recipes","countLog","permissions","onboarding","autoSubmit","foodCost","lastAutoWeek"];
  useEffect(() => {
    if (!user || !group) return;
    let cancelled = false;
    const init = async () => {
      setDataLoaded(false);
      const res = await sbGetMany(group, KEYS);
      if (cancelled) return;
      if (!res.ok) { setLoadError(res.error || "Couldn't reach MOE."); return; }
      setLoadError("");
      const v = res.values;
      const isDemoGroup = DEMO_GROUPS.includes(group);
      const has = (k) => Object.prototype.hasOwnProperty.call(v, k);
      const st = v.stock && typeof v.stock === "object" && !Array.isArray(v.stock) ? v.stock : {};
      const vd = Array.isArray(v.vendors) ? v.vendors : (isDemoGroup ? DEFAULT_VENDORS : []);
      const hi = Array.isArray(v.history) ? v.history : [];
      const inv = Array.isArray(v.inventory) ? v.inventory : (isDemoGroup ? DEFAULT_INVENTORY : []);
      const ul = v.usageLog && typeof v.usageLog === "object" ? v.usageLog : {};
      setStock({ ...st, ...pendingStockRef.current }); setVendors(vd); setHistory(hi); setInventory(inv);
      setUsageLog(ul); setSubscription(v.subscription || null);
      setWasteLog(Array.isArray(v.wasteLog) ? v.wasteLog : []);
      setPriceHistory(v.priceHistory && typeof v.priceHistory === "object" ? v.priceHistory : {});
      setRecipes(Array.isArray(v.recipes) ? v.recipes : []);
      setCountLog(Array.isArray(v.countLog) ? v.countLog : []);
      setStockSnapshots(v.stockSnapshots && typeof v.stockSnapshots === "object" ? v.stockSnapshots : {});
      if (v.permissions) setPermissions(v.permissions);
      setOnboarding(has("onboarding") ? v.onboarding : null);
      setAutoSubmit(v.autoSubmit !== false);
      setFoodCost(v.foodCost === true);
      setDataLoaded(true);

      // ── Auto-submit missed orders from completed weeks ──────────────────
      if (v.autoSubmit !== false && vd.length > 0 && inv.length > 0) {
        runAutoSubmit({ vendors: vd, inventory: inv, stock: st, history: hi, usageLog: ul, lastAutoWeek: v.lastAutoWeek || null });
      }
    };
    init();
    return () => { cancelled = true; };
  }, [user, group, loadTick]);

  // ── Send pending stock taps (merge only the changed items) ───────────────
  const flushStock = useCallback(async () => {
    clearTimeout(stockSaveTimerRef.current);
    const g = groupRef.current;
    const patch = pendingStockRef.current;
    const ids = Object.keys(patch);
    if (!g || ids.length === 0) return;
    pendingStockRef.current = {};
    const merged = await sbMerge(g, "stock", patch);
    if (!merged.ok) {
      pendingStockRef.current = { ...patch, ...pendingStockRef.current };
      noteResult(merged);
      return;
    }
    noteResult(merged);
    const full = merged.value || {};
    // Snapshot every item's latest count for this week (not just the ones tapped)
    const wk = weekKey();
    const snap = await sbMerge(g, "stockSnapshots", { [wk]: { ...full, _ts: new Date().toISOString() } });
    if (snap.ok && snap.value) setStockSnapshots(snap.value);
    const at = new Date().toISOString();
    const entries = ids.map(id => ({ i: /^\d+$/.test(id) ? Number(id) : id, q: patch[id], by: user?.name || "", at }));
    const logged = await sbPrepend(g, "countLog", entries, 10000);
    if (logged.ok && Array.isArray(logged.value)) setCountLog(logged.value);
  }, [noteResult, user]);

  // ── Flush pending saves if the tab hides or closes ───────────────────────
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "hidden") flushStock(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flushStock);
    return () => { flushStock(); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", flushStock); };
  }, [flushStock]);

  // ── Real-time sync ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!group || !user) return;
    const sb = getSB(); if (!sb) return;
    const channel = sb.channel(`moe_${group}`).on("postgres_changes", {
      event: "*", schema: "public", table: "moe_data", filter: `group_id=eq.${group}`
    }, (payload) => {
      try {
        const { data_key, data_value } = payload.new || {};
        const value = JSON.parse(data_value);
        if (data_key === "stock")     setStock({ ...(value || {}), ...pendingStockRef.current });
        if (data_key === "vendors")   setVendors(Array.isArray(value) ? value : []);
        if (data_key === "history")   setHistory(Array.isArray(value) ? value : []);
        if (data_key === "inventory") setInventory(Array.isArray(value) ? value : []);
        if (data_key === "usageLog")     setUsageLog(value || {});
        if (data_key === "subscription") setSubscription(value);
        if (data_key === "wasteLog")    setWasteLog(Array.isArray(value) ? value : []);
        if (data_key === "priceHistory") setPriceHistory(value || {});
        if (data_key === "recipes")     setRecipes(Array.isArray(value) ? value : []);
        if (data_key === "countLog")    setCountLog(Array.isArray(value) ? value : []);
        if (data_key === "stockSnapshots") setStockSnapshots(value || {});
        if (data_key === "permissions") setPermissions(value);
      } catch {}
    }).subscribe();
    return () => { sb.removeChannel(channel); };
  }, [group, user]);

  // ── Stock update ─────────────────────────────────────────────────────────
  // UI updates instantly; changed items are sent 1.5s after the last tap as a
  // merge, so two phones counting at once never erase each other's counts.
  const updateStock = (id, val) => {
    const n = parseInt(val);
    const finalQty = isNaN(n) ? 0 : Math.max(0, n);
    setStock(prev => ({ ...prev, [id]: finalQty }));
    pendingStockRef.current = { ...pendingStockRef.current, [id]: finalQty };
    clearTimeout(stockSaveTimerRef.current);
    stockSaveTimerRef.current = setTimeout(flushStock, 1500);
  };

  // Build order lines for one vendor from the current counts.
  const linesFor = (vendorName, inv = inventory, stk = stock) => {
    const target = normName(vendorName);
    const vendorItems = flatItems(inv).filter(i => normName(i.vendor) === target);
    const lines = vendorItems.map(item => ({
      id: item.id, name: item.name, section: item.section,
      order_unit: item.order_unit, vendor: item.vendor,
      qty: calcOrderQty(item, stk[item.id] ?? 0),
      currentStock: stk[item.id] ?? 0,
    })).filter(l => l.qty > 0);
    return { vendorItems, lines };
  };

  const usageLinesFor = (lines, vendorItems, stk = stock) => {
    const out = {};
    lines.forEach(line => {
      out[line.id] = {
        name: line.name, qty: line.qty, order_unit: line.order_unit,
        stockBefore: line.currentStock ?? (stk[line.id] ?? 0),
        maxStock: vendorItems.find(i => i.id === line.id)?.max_stock || 0,
      };
    });
    return out;
  };

  // Save new history entries + usage atomically on the server, then refresh local copies.
  const recordOrders = async (entries, usageByVendor, wk) => {
    const g = groupRef.current;
    if (!g || entries.length === 0) return { ok: true };
    const added = noteResult(await sbPrepend(g, "history", entries, 5000));
    if (!added.ok) { showFlash("✗ Order not saved — check the connection"); return added; }
    if (Array.isArray(added.value)) setHistory(added.value);
    for (const [vendorName, lines] of Object.entries(usageByVendor)) {
      const u = await sbMergeUsage(g, wk, vendorName, lines);
      if (u.ok && u.value) setUsageLog(u.value);
    }
    return { ok: true };
  };

  // ── Auto-submit missed orders for the previous week ──────────────────────
  const runAutoSubmit = async ({ vendors: vds, inventory: inv, stock: stk, history: hist, lastAutoWeek }) => {
    const curKey = weekKey();
    if (lastAutoWeek === curKey) return;
    const prevDate = new Date(); prevDate.setDate(prevDate.getDate() - 7);
    const prevWeek = getWeekNumber(prevDate);
    const prevYear = getWeekYear(prevDate);
    const prevKey = weekKey(prevDate);
    const prevWeekOrders = (hist || []).filter(h => h.weekNumber === prevWeek && h.year === prevYear && h.type !== "quick");

    const entries = [];
    const usageByVendor = {};
    vds.forEach(v => {
      if (!v.orderDays || v.orderDays.length === 0 || !normName(v.name)) return;
      if (prevWeekOrders.some(h => normName(h.vendor) === normName(v.name))) return;
      const { vendorItems, lines } = linesFor(v.name, inv, stk);
      if (lines.length === 0) return;
      usageByVendor[v.name] = usageLinesFor(lines, vendorItems, stk);
      entries.push({
        id: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, vendor: v.name,
        weekNumber: prevWeek, year: prevYear, day: "Auto-submitted",
        date: getWeekMonday(prevWeek, prevYear).toISOString(),
        lines, totalItems: lines.length, orderedBy: "MOE (auto)",
        type: "auto", note: "Auto-submitted — order was not manually placed", received: true,
      });
    });
    // Mark this week as handled first so two devices opening at once don't both auto-submit.
    const marked = await save("lastAutoWeek", curKey);
    if (!marked.ok || entries.length === 0) return;
    const res = await recordOrders(entries, usageByVendor, prevKey);
    if (res.ok) showFlash(`✓ Auto-submitted ${entries.length} missed order${entries.length !== 1 ? "s" : ""} from last week`);
  };

  // ── Submit orders for one or more vendors (one save for all of them) ─────
  const submitOrder = async (vendorNames) => {
    const names = (Array.isArray(vendorNames) ? vendorNames : [vendorNames]).filter(Boolean);
    await flushStock();
    const now = new Date();
    const wk = weekKey(now);
    const entries = [];
    const usageByVendor = {};
    names.forEach(vendorName => {
      const { vendorItems, lines } = linesFor(vendorName);
      if (lines.length === 0) return;
      usageByVendor[vendorName] = usageLinesFor(lines, vendorItems);
      entries.push({
        id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        vendor: vendorName,
        weekNumber: getWeekNumber(now),
        year: getWeekYear(now),
        day: DAYS[now.getDay()],
        date: now.toISOString(),
        lines,
        totalItems: lines.length,
        orderedBy: user?.name || "",
        received: false,
        counts: Object.fromEntries(vendorItems.filter(i => Object.prototype.hasOwnProperty.call(stock, i.id)).map(i => [i.id, stock[i.id]])),
      });
    });
    if (entries.length === 0) { showFlash("Nothing to order — stock is above reorder points"); return; }
    const res = await recordOrders(entries, usageByVendor, wk);
    if (res.ok) showFlash(entries.length === 1 ? `✓ ${entries[0].vendor} order submitted` : `✓ ${entries.length} orders submitted`);
  };

  // ── Log a quick/emergency order (off-schedule purchase) ──────────────
  const logQuickOrder = async (items, source, note, targetWeek) => {
    if (!items || items.length === 0) return;
    const wkNum = targetWeek?.weekNum || getWeekNumber();
    const yr = targetWeek?.year || getWeekYear();
    const wk = `${yr}-WK${String(wkNum).padStart(2,"0")}`;
    const sourceName = source || "Quick Order";
    const isBackfill = !!targetWeek && (wkNum !== getWeekNumber() || yr !== getWeekYear());
    const lines = {};
    items.forEach(line => {
      const existing = usageLog?.[wk]?.[sourceName]?.[line.id];
      lines[line.id] = { name: line.name, qty: (existing?.qty || 0) + line.qty, order_unit: line.order_unit, stockBefore: stock[line.id] ?? 0, maxStock: 0 };
    });
    const entryDate = isBackfill ? getWeekMonday(wkNum, yr).toISOString() : new Date().toISOString();
    const entry = {
      id: `qord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, vendor: sourceName,
      weekNumber: wkNum, year: yr,
      day: isBackfill ? "Backfilled" : DAYS[getToday()], date: entryDate,
      lines: items, totalItems: items.length,
      orderedBy: user?.name || "", type: "quick", note: note || "", backfill: isBackfill, received: true,
    };
    const res = await recordOrders([entry], { [sourceName]: lines }, wk);
    if (res.ok) showFlash(isBackfill ? `✓ Backfilled WK${wkNum} — ${items.length} item${items.length !== 1 ? "s" : ""}` : `✓ Quick order logged — ${items.length} item${items.length !== 1 ? "s" : ""}`);
  };

  // Submit a regular vendor order to a SPECIFIC past week (backfill missed orders)
  const submitOrderForWeek = async (vendorName, wkNum, yr) => {
    const { vendorItems, lines } = linesFor(vendorName);
    if (lines.length === 0) { showFlash("Nothing to order — stock is above reorder points"); return; }
    const wk = `${yr}-WK${String(wkNum).padStart(2,"0")}`;
    const entry = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, vendor: vendorName, weekNumber: wkNum, year: yr,
      day: "Backfilled", date: getWeekMonday(wkNum, yr).toISOString(),
      lines, totalItems: lines.length, orderedBy: user?.name || "", backfill: true, received: false,
    };
    const res = await recordOrders([entry], { [vendorName]: usageLinesFor(lines, vendorItems) }, wk);
    if (res.ok) showFlash(`✓ Backfilled ${vendorName} order for WK${wkNum}`);
  };

  // ── Check in a delivery: record what actually arrived (does NOT touch stock) ──
  // lineStatuses = { [lineId]: { status, receivedQty } }  status: delivered|short|out_of_stock|damaged
  const checkInDelivery = (orderId, lineStatuses) => {
    const newHistory = (history || []).map(o => {
      if (o.id !== orderId) return o;
      const newLines = (o.lines || []).map(line => {
        const s = lineStatuses[line.id] || { status: "delivered" };
        return { ...line, delivered: s.status === "delivered" ? "delivered" : s.status, receivedQty: s.status === "short" ? (s.receivedQty ?? line.qty) : (s.status === "delivered" ? line.qty : 0) };
      });
      return { ...o, received: true, receivedAt: new Date().toISOString(), lines: newLines };
    });
    setHistory(newHistory);
    save("history", newHistory);
    const order = newHistory.find(o => o.id === orderId);
    const shortfalls = (order?.lines || []).filter(l => l.delivered && l.delivered !== "delivered").length;
    showFlash(shortfalls > 0 ? `✓ Delivery checked in — ${shortfalls} item${shortfalls!==1?"s":""} flagged` : `✓ Delivery checked in — all received`);
  };

  // ── Save vendors (renaming a vendor also renames it on its items) ────────
  const saveVendors = (newVendors) => {
    let inv = inventory;
    let changed = false;
    (vendors || []).forEach(old => {
      const next = newVendors.find(v => v.id === old.id);
      if (next && old.name && next.name && normName(old.name) !== normName(next.name)) {
        inv = inv.map(s => ({ ...s, items: (s.items || []).map(i => normName(i.vendor) === normName(old.name) ? { ...i, vendor: next.name } : i) }));
        changed = true;
      }
    });
    if (changed) { setInventory(inv); save("inventory", inv); }
    setVendors(newVendors); save("vendors", newVendors); showFlash();
  };

  // ── Save waste log ────────────────────────────────────────────────────
  const saveWasteLog = useCallback((newLog) => { setWasteLog(newLog); save("wasteLog", newLog); }, [save]);

  // ── Save price history ────────────────────────────────────────────────
  const savePriceHistory = useCallback((newPH) => { setPriceHistory(newPH); save("priceHistory", newPH); }, [save]);
  const saveRecipes = useCallback((newRecipes) => { setRecipes(newRecipes); save("recipes", newRecipes); showFlash("✓ Recipe saved"); }, [save]);

  // ── Save permissions ──────────────────────────────────────────────────
  const savePermissions = useCallback((newPerms) => { setPermissions(newPerms); save("permissions", newPerms); showFlash("✓ Permissions updated"); }, [save]);

  const signOut = async () => {
    await flushStock();
    setUser(null);
    if (onLogout) onLogout();
  };

  if (!user) return null;

  if (!group) {
    return (
      <div style={{ minHeight:"100vh", background:"#080c14", color:"#f1f5f9", fontFamily:"'DM Sans',sans-serif", padding:24 }}>
        <MoeIcons />
        {isPlatformAdmin(user) ? <AdminView /> : <p>This login isn't linked to a kitchen.</p>}
        <button type="button" onClick={signOut} style={{ marginTop:16, background:"transparent", border:"1px solid #1e2d45", borderRadius:8, color:"#94a3b8", padding:"10px 16px", cursor:"pointer" }}>Sign out</button>
      </div>
    );
  }

  // ── Subscription gate (skip for demo accounts) ─────────────────────────
  const isDemo = DEMO_GROUPS.includes(group);
  const now = new Date();
  const trialEndDate = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const trialDaysLeft = trialEndDate ? Math.max(0, Math.ceil((trialEndDate - now) / 86400000)) : 0;
  const isTrialing = subscription?.status === "trialing" && trialDaysLeft > 0;
  const isActive = subscription?.status === "active";
  const hasAccess = isDemo || isTrialing || isActive;

  if (!dataLoaded) {
    return (
      <div style={{ minHeight:"100vh", background:"#080c14", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <div style={{ textAlign:"center", padding:24 }}>
          <MoeLogo size="lg" />
          {loadError ? (
            <>
              <div style={{ color:"#fca5a5", fontSize:14, marginTop:16 }}>Can't reach MOE: {loadError}</div>
              <div style={{ color:"#64748b", fontSize:12, marginTop:6 }}>Nothing was changed.</div>
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginTop:16 }}>
                <button type="button" onClick={() => { setLoadError(""); setLoadTick(t => t + 1); }} style={{ background:"#38bdf8", border:"none", borderRadius:8, color:"#04111f", padding:"10px 16px", fontWeight:700, cursor:"pointer" }}>Try again</button>
                <button type="button" onClick={signOut} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, color:"#94a3b8", padding:"10px 16px", cursor:"pointer" }}>Sign out</button>
              </div>
            </>
          ) : (
            <div style={{ color:"#475569", fontSize:13, fontFamily:"'DM Mono',monospace", marginTop:16 }}>Loading your data...</div>
          )}
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <PricingPage subscription={subscription} user={user} onLogout={signOut} />;
  }

  // Get current plan limits
  const currentPlan = PLANS[subscription?.plan] || PLANS.pro;

  // ── Onboarding for new owners ─────────────────────────────────────────
  // Skip onboarding for existing accounts that already have vendors/inventory set up
  const hasExistingData = vendors.some(v => v.name && v.name.trim()) && inventory.length > 0;
  const needsOnboarding = user.role === "owner" && onboarding !== "done" && !isDemo && !hasExistingData;
  if (needsOnboarding) {
    return <OnboardingFlow
      user={user} step={onboarding || 1}
      vendors={vendors} saveVendors={(v) => { setVendors(v); save("vendors", v); }}
      inventory={inventory} saveInventory={(inv) => { setInventory(inv); save("inventory", inv); }}
      onStep={(s) => { setOnboarding(s); save("onboarding", s); }}
      onComplete={() => { setOnboarding("done"); save("onboarding", "done"); }}
    />;
  }

  // ── Permission check ──────────────────────────────────────────────────
  const canAccess = (feature) => {
    if (user.role === "owner") return true; // Owner always has full access
    const rolePerms = permissions[user.role] || [];
    return rolePerms.includes(feature);
  };

  const todayVendors = vendorsOrderingToday(vendors);
  const weekNum = getWeekNumber();
  const openNav = () => {
    navOpenedAt.current = Date.now();
    setSidebarOpen(true);
  };
  const closeNavFromOverlay = () => {
    if (Date.now() - navOpenedAt.current < 400) return;
    setSidebarOpen(false);
  };

  // All features that can be toggled
  const ALL_FEATURES = [
    { key: "inventory", label: "Inventory", icon: "📋" },
    { key: "waste", label: "Waste Log", icon: "🗑️" },
    { key: "orders", label: "Orders", icon: "📦" },
    { key: "history", label: "History", icon: "📚" },
    { key: "insights", label: "Insights", icon: "📊" },
    { key: "recipes", label: "Recipes & Costs", icon: "📖" },
    { key: "prices", label: "Price Tracker", icon: "💲" },
    { key: "backend", label: "Backend", icon: "🔧" },
    { key: "settings", label: "Settings", icon: "⚙️" },
    { key: "import", label: "Import Items", icon: "📤" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(1200px 600px at 50% -10%, #0d1626 0%, #080c14 55%)", fontFamily:"'DM Sans',sans-serif", overflowX:"hidden", width:"100%", maxWidth:"100vw" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`
        *,*::before,*::after{box-sizing:border-box}
        html{width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%}
        body{margin:0;padding:0;width:100%;max-width:100vw;overflow-x:hidden;background:#080c14;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
        #root{width:100%;max-width:100vw;overflow-x:hidden}
        input,select,textarea,button{font-size:16px;font-family:'DM Sans',sans-serif}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        input[type=number]{-moz-appearance:textfield}

        /* Smooth interactions everywhere */
        button{transition:transform .12s ease, filter .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease;}
        button:not(:disabled):hover{filter:brightness(1.08)}
        button:not(:disabled):active{transform:translateY(1px) scale(0.99)}
        input,select,textarea{transition:border-color .15s ease, box-shadow .15s ease, background .15s ease;}
        input:focus,select:focus,textarea:focus{box-shadow:0 0 0 3px rgba(56,189,248,0.12)}
        a{transition:color .15s ease}

        /* Custom dark scrollbars */
        ::-webkit-scrollbar{width:10px;height:10px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1e2d45;border-radius:8px;border:2px solid #080c14}
        ::-webkit-scrollbar-thumb:hover{background:#2d3f5f}
        *{scrollbar-width:thin;scrollbar-color:#1e2d45 transparent}

        /* Subtle card lift utility */
        .moe-lift{transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease}
        .moe-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.35);border-color:#2d3f5f}

        /* Nav item hover */
        .moe-nav:hover{background:#0f1a2e !important}

        /* Fade-in for views */
        @keyframes moeFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .moe-fade{animation:moeFade .25s ease both}

        /* Flash toast pop */
        @keyframes moePop{0%{opacity:0;transform:translateY(10px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}
      `}</style>

      <MoeIcons />
      {(new URLSearchParams(window.location.search).get("classic") === "1" || window.location.pathname.startsWith("/classic")) && (
        <div style={{ background:"#0c1220", color:"#94a3b8", fontSize:12, textAlign:"center", padding:"8px 12px", borderBottom:"1px solid #1e2d45" }}>
          Classic MOE. <a href="/app" style={{ color:"#38bdf8", fontWeight:700 }}>Switch to the simpler kitchen</a>
        </div>
      )}

      {sidebarOpen && createPortal(
        <>
          <div onClick={closeNavFromOverlay} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:10000 }} />
          <div role="dialog" aria-label="Menu" style={{ position:"fixed", top:0, left:0, height:"100dvh", width:"min(260px, 88vw)", background:"#0f1a2e", borderRight:"1px solid #1e2d45", zIndex:10001, display:"flex", flexDirection:"column", boxShadow:"8px 0 24px rgba(0,0,0,0.35)" }}>
            <div style={{ padding:"20px", borderBottom:"1px solid #1e2d45", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <MoeLogo size="md" />
              <button type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:18 }}>✕</button>
            </div>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid #1e2d45", flexShrink:0 }}>
              <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{user.name}</div>
              <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:2 }}>{user.role.toUpperCase()} · WK{weekNum} · {DAYS[getToday()]}</div>
            </div>
            <div style={{ flex:1, minHeight:0, padding:"12px", overflowY:"auto" }}>
              {(() => {
                const go = (key) => { setView(key); setSidebarOpen(false); };
                const primary = [
                  ...(user.role === "owner" ? [{ key:"dashboard", label:"Dashboard", icon:"dashboard", desc:"Overview" }] : []),
                  ...(canAccess("inventory") ? [{ key:"inventory", label:"Place Order", icon:"inventory", desc:"Count stock and order" }] : []),
                  ...(canAccess("orders") ? [{ key:"orders", label:"Orders", icon:"orders", desc:`${todayVendors.length} supplier${todayVendors.length!==1?"s":""} today`, badge: todayVendors.length }] : []),
                  ...(canAccess("history") ? [{ key:"history", label:"Order History", icon:"history", desc:"Past supplier orders" }] : []),
                  ...(canAccess("backend") ? [{ key:"backend", label:"Edit items", icon:"backend", desc:"Names, pars, suppliers" }] : []),
                  ...(canAccess("settings") ? [{ key:"settings", label:"Settings", icon:"settings", desc:"Suppliers and team" }] : []),
                ];
                const more = [
                  ...(canAccess("insights") ? [{ key:"insights", label:"Usage & pars", icon:"insights", desc: currentPlan === PLANS.starter && !isTrialing ? "Pro plan required" : "What you use, par suggestions", locked: currentPlan === PLANS.starter && !isTrialing }] : []),
                  ...(canAccess("waste") ? [{ key:"waste", label:"Waste log", icon:"waste", desc:"Parked until the count is in use" }] : []),
                  ...(canAccess("recipes") ? [{ key:"recipes", label:"Recipes & costs", icon:"recipes", desc:"Cost per oz, plate cost, food %" }] : []),
                  ...(canAccess("prices") ? [{ key:"prices", label:"Price tracker", icon:"prices", desc: currentPlan === PLANS.starter && !isTrialing ? "Pro plan required" : "Invoice prices", locked: currentPlan === PLANS.starter && !isTrialing }] : []),
                  ...(canAccess("import") ? [{ key:"import", label:"Import items", icon:"doc", desc: currentPlan === PLANS.starter && !isTrialing ? "Pro plan required" : "Upload a list or invoice", locked: currentPlan === PLANS.starter && !isTrialing }] : []),
                  ...(user.role === "owner" ? [{ key:"subscription", label:"Subscription", icon:"subscription", desc: isTrialing ? `Trial — ${trialDaysLeft}d left` : (isActive ? currentPlan.name : "Choose plan") }] : []),
                  ...(isPlatformAdmin(user) ? [{ key:"admin", label:"Admin", icon:"admin", desc:"Accounts" }] : []),
                ];
                const moreExpanded = moreOpen || more.some(item => item.key === view);
                const renderNavItem = (item) => {
                  const isActive = view === item.key;
                  return (
                    <button key={item.key} type="button" className="moe-nav"
                      onClick={() => go(item.locked ? "subscription" : item.key)}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:12, background:isActive?"#0f1a2e":"transparent", border:"none", borderRadius:10, padding:"11px 14px", cursor:"pointer", marginBottom:4, borderLeft:isActive?"3px solid #38bdf8":"3px solid transparent", opacity:item.locked?0.5:1 }}>
                      <Icon name={item.icon} size={19} color={isActive ? "#38bdf8" : "#64748b"} />
                      <div style={{ textAlign:"left", flex:1 }}>
                        <div style={{ color:isActive?"#f1f5f9":"#94a3b8", fontSize:14, fontWeight:isActive?600:400, display:"flex", alignItems:"center", gap:6 }}>{item.label}{item.locked ? <Icon name="alert" size={12} color="#d97706" /> : null}</div>
                        <div style={{ color:item.locked?"#d97706":"#475569", fontSize:11, marginTop:1 }}>{item.desc}</div>
                      </div>
                      {item.badge > 0 && <span style={{ background:"rgba(56,189,248,0.15)", color:"#38bdf8", borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{item.badge}</span>}
                    </button>
                  );
                };
                return (
                  <>
                    {primary.map(renderNavItem)}
                    {more.length > 0 && (
                      <>
                        <button type="button" onClick={() => setMoreOpen(open => !open)}
                          style={{ width:"100%", display:"flex", alignItems:"center", gap:12, background:"transparent", border:"none", borderRadius:10, padding:"11px 14px", cursor:"pointer", marginTop:8, borderLeft:"3px solid transparent" }}>
                          <div style={{ textAlign:"left", flex:1 }}>
                            <div style={{ color:"#64748b", fontSize:13, fontWeight:600 }}>More</div>
                            <div style={{ color:"#475569", fontSize:11, marginTop:1 }}>Waste, prices, recipes, import</div>
                          </div>
                          <Icon name="chevron" size={14} color="#64748b" style={{ transition:"transform 0.2s ease", transform: moreExpanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
                        </button>
                        {moreExpanded && more.map(renderNavItem)}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <div style={{ padding:"12px", borderTop:"1px solid #1e2d45", flexShrink:0 }}>
              <button type="button" onClick={signOut} style={{ width:"100%", background:"transparent", border:"1px solid #1e2d45", borderRadius:8, color:"#64748b", padding:"10px", cursor:"pointer", fontSize:13 }}>
                Sign Out
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Header */}
      <header style={{ background:"#0f1a2e", borderBottom:"1px solid #1e2d45", padding:"0 12px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, position:"sticky", top:0, zIndex:101, gap:8, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <button type="button" aria-label="Open menu" onPointerUp={(event) => { event.preventDefault(); event.stopPropagation(); openNav(); }} style={{ background:"none", border:"none", cursor:"pointer", padding:"6px", borderRadius:8, display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}
            onMouseEnter={e => e.currentTarget.style.background="#1e2d45"} onMouseLeave={e => e.currentTarget.style.background="none"}>
            <span style={{ display:"block", width:18, height:2, background:"#94a3b8", borderRadius:2 }} />
            <span style={{ display:"block", width:18, height:2, background:"#94a3b8", borderRadius:2 }} />
            <span style={{ display:"block", width:18, height:2, background:"#94a3b8", borderRadius:2 }} />
          </button>
          <svg viewBox="0 0 40 40" fill="none" width="28" height="28" style={{ display:"block", flexShrink:0 }}>
            <polygon points="20,2.5 36.5,11.25 36.5,28.75 20,37.5 3.5,28.75 3.5,11.25" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.35"/>
            <polygon points="20,8 31,14 31,26 20,32 9,26 9,14" fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.5"/>
            <polygon points="20,13 25.5,16.5 25.5,23.5 20,27 14.5,23.5 14.5,16.5" fill="#38bdf8" opacity="0.12"/>
            <line x1="20" y1="2.5" x2="20" y2="8" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/><line x1="36.5" y1="11.25" x2="31" y2="14" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/><line x1="36.5" y1="28.75" x2="31" y2="26" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/><line x1="20" y1="37.5" x2="20" y2="32" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/><line x1="3.5" y1="28.75" x2="9" y2="26" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/><line x1="3.5" y1="11.25" x2="9" y2="14" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
            <circle cx="20" cy="2.5" r="1.8" fill="#38bdf8" opacity="0.5"/><circle cx="36.5" cy="11.25" r="1.8" fill="#38bdf8" opacity="0.5"/><circle cx="36.5" cy="28.75" r="1.8" fill="#38bdf8" opacity="0.5"/><circle cx="20" cy="37.5" r="1.8" fill="#38bdf8" opacity="0.5"/><circle cx="3.5" cy="28.75" r="1.8" fill="#38bdf8" opacity="0.5"/><circle cx="3.5" cy="11.25" r="1.8" fill="#38bdf8" opacity="0.5"/>
            <text x="20" y="24.5" textAnchor="middle" fill="#38bdf8" fontFamily="DM Sans,sans-serif" fontWeight="700" fontSize="13">M</text>
          </svg>
          <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{view.toUpperCase()}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {todayVendors.length > 0 && view !== "inventory" && (
            <button onClick={() => setView("inventory")} style={{ background:"#422006", border:"1px solid #d97706", borderRadius:6, padding:"3px 8px", color:"#fbbf24", fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
              {todayVendors.length} due
            </button>
          )}
          <span style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:5, padding:"2px 6px", color:"#a5b4fc", fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:600, whiteSpace:"nowrap" }}>{fmtWeekLabel(weekNum)}</span>
          {flash && <span style={{ color:"#22c55e", fontSize:11, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{flash}</span>}
        </div>
      </header>

      {/* Trial banner */}
      {isTrialing && !isDemo && (
        <div style={{ background:"#422006", borderBottom:"1px solid #d97706", padding:"6px 12px", display:"flex", alignItems:"center", justifyContent:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{ color:"#fbbf24", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>Free trial — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left</span>
          <button onClick={() => setView("subscription")} style={{ background:"#d97706", border:"none", borderRadius:5, padding:"2px 10px", color:"#fff", fontSize:10, fontWeight:600, cursor:"pointer" }}>Upgrade</button>
        </div>
      )}

      {saveError && (
        <div role="status" style={{ background:"#450a0a", borderBottom:"1px solid #ef4444", color:"#fecaca", padding:"8px 12px", fontSize:12, textAlign:"center" }}>
          Not saved: {saveError}
        </div>
      )}

      {/* Main content */}
      <main key={view} className="moe-fade" style={{ maxWidth:1200, margin:"0 auto", padding:"16px", boxSizing:"border-box", width:"100%" }}>
        {view === "dashboard" && user.role === "owner" && <DashboardView
          user={user}
          inventory={inventory}
          stock={stock}
          vendors={vendors}
          history={history}
          stockSnapshots={stockSnapshots}
          recipes={recipes}
          priceHistory={priceHistory}
          todayVendors={todayVendors}
          weekNum={weekNum}
          setView={setView}
        />}
        {view === "inventory" && canAccess("inventory") && <InventoryView inventory={inventory} stock={stock} updateStock={updateStock} vendors={vendors} history={history} submitOrder={submitOrder} countLog={countLog} />}
        {view === "waste" && canAccess("waste") && <WasteLogView inventory={inventory} wasteLog={wasteLog} saveWasteLog={saveWasteLog} userName={user.name} priceHistory={priceHistory} />}
        {view === "orders" && canAccess("orders") && <OrdersView inventory={inventory} stock={stock} vendors={vendors} submitOrder={submitOrder} logQuickOrder={logQuickOrder} submitOrderForWeek={submitOrderForWeek} checkInDelivery={checkInDelivery} history={history} user={user} />}
        {view === "history" && canAccess("history") && <HistoryView history={history} user={user} />}
        {view === "insights" && canAccess("insights") && (
          <div style={{ background:"#f4f1ea", color:"#1c1917", borderRadius:12, padding:16 }}>
            <UsageScreen user={user} inventory={inventory} vendors={vendors} history={history} countLog={countLog} saveInventory={(inv) => { setInventory(inv); return save("inventory", inv); }} />
          </div>
        )}
        {view === "recipes" && canAccess("recipes") && (
          <div style={{ background:"#f4f1ea", color:"#1c1917", borderRadius:12, padding:16 }}>
            <ClassicCosts inventory={inventory} priceHistory={priceHistory} recipes={recipes} group={group}
              setRecipes={setRecipes} setPriceHistory={setPriceHistory} saveInventory={(inv) => { setInventory(inv); return save("inventory", inv); }} />
          </div>
        )}
        {view === "prices" && canAccess("prices") && <PriceTrackerView inventory={inventory} priceHistory={priceHistory} savePriceHistory={savePriceHistory} vendors={vendors} foodCost={foodCost} history={history} saveHistory={saveHistory} saveInventory={(inv) => { setInventory(inv); save("inventory", inv); }} />}
        {view === "import" && canAccess("import") && <ImportView inventory={inventory} saveInventory={saveInventory} vendors={vendors} />}
        {view === "backend" && canAccess("backend") && <BackendView inventory={inventory} saveInventory={saveInventory} vendors={vendors} stock={stock} />}
        {view === "settings" && canAccess("settings") && <SettingsView vendors={vendors} saveVendors={saveVendors} inventory={inventory} currentPlan={currentPlan} isTrialing={isTrialing} permissions={permissions} savePermissions={savePermissions} userRole={user.role} user={user} allFeatures={ALL_FEATURES} autoSubmit={autoSubmit} setAutoSubmit={(v) => { setAutoSubmit(v); save("autoSubmit", v); }} foodCost={foodCost} setFoodCost={(v) => { setFoodCost(v); save("foodCost", v); }} />}
        {view === "subscription" && user.role === "owner" && <SubscriptionView subscription={subscription} user={user} trialDaysLeft={trialDaysLeft} isTrialing={isTrialing} isActive={isActive} />}
        {view === "admin" && isPlatformAdmin(user) && <AdminView />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ICON SYSTEM — clean SVG icons (replaces emojis), defined once as a sprite
// ═══════════════════════════════════════════════════════════════════════════════
function MoeIcons() {
  return (
    <svg width="0" height="0" style={{ position:"absolute" }} aria-hidden="true">
      <defs>
        <symbol id="ic-inventory" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10"/></symbol>
        <symbol id="ic-waste" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-9 0l1 14h8l1-14M10 10v6M14 10v6"/></symbol>
        <symbol id="ic-orders" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M5 4h14l-1 16H6L5 4zm3 0V3a4 4 0 018 0v1M9 11h6"/></symbol>
        <symbol id="ic-history" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2M3 12a9 9 0 109-9 9 9 0 00-7 3.5M3 4v3.5H6.5"/></symbol>
        <symbol id="ic-insights" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></symbol>
        <symbol id="ic-prices" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></symbol>
        <symbol id="ic-backend" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v4H3zM3 11h18v4H3zM3 17h18v2H3z"/></symbol>
        <symbol id="ic-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8"/><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M19.4 13a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 01-4 0v-.2A1.6 1.6 0 005 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H1a2 2 0 010-4h.2A1.6 1.6 0 002.6 5l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V1a2 2 0 014 0v.2a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H23a2 2 0 010 4h-.2a1.6 1.6 0 00-1.4 1z" transform="scale(0.82) translate(2.6 2.6)"/></symbol>
        <symbol id="ic-subscription" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M2 7h20v10H2zM2 10h20M6 14h4"/></symbol>
        <symbol id="ic-admin" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 18l2-11 4 4 4-7 4 7 4-4 2 11H3z"/></symbol>
        <symbol id="ic-bolt" viewBox="0 0 24 24"><path fill="currentColor" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></symbol>
        <symbol id="ic-alert" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></symbol>
        <symbol id="ic-check" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5"/></symbol>
        <symbol id="ic-plus" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 5v14M5 12h14"/></symbol>
        <symbol id="ic-camera" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 8h3l2-2h8l2 2h3v12H3zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"/></symbol>
        <symbol id="ic-doc" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 2h8l4 4v16H6zM14 2v4h4M9 13h6M9 17h6"/></symbol>
        <symbol id="ic-dashboard" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/></symbol>
        <symbol id="ic-recipes" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 2v20h12V2zM6 7h12M9 11h6M9 15h6M9 19h6"/></symbol>
        <symbol id="ic-arrow-right" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7"/></symbol>
        <symbol id="ic-chevron" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></symbol>
      </defs>
    </svg>
  );
}

// Render an icon by name. <Icon name="orders" size={18} color="#38bdf8" />
function Icon({ name, size = 18, color = "currentColor", style = {} }) {
  return <svg width={size} height={size} style={{ display:"inline-block", verticalAlign:"middle", color, flexShrink:0, ...style }}><use href={`#ic-${name}`} /></svg>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOE LOGO — Hex SVG logo
// ═══════════════════════════════════════════════════════════════════════════════
function MoeLogo({ size = "md" }) {
  const configs = {
    sm: { s: 28, fs: 16, gap: 6, textSize: 18 },
    md: { s: 36, fs: 18, gap: 8, textSize: 22 },
    lg: { s: 56, fs: 28, gap: 10, textSize: 36 },
  };
  const c = configs[size] || configs.md;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: c.gap, flexShrink: 0 }}>
      <svg viewBox="0 0 40 40" fill="none" width={c.s} height={c.s} style={{ display: "block", flexShrink: 0 }}>
        <polygon points="20,2.5 36.5,11.25 36.5,28.75 20,37.5 3.5,28.75 3.5,11.25" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.35"/>
        <polygon points="20,8 31,14 31,26 20,32 9,26 9,14" fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.5"/>
        <polygon points="20,13 25.5,16.5 25.5,23.5 20,27 14.5,23.5 14.5,16.5" fill="#38bdf8" opacity="0.12"/>
        <line x1="20" y1="2.5" x2="20" y2="8" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
        <line x1="36.5" y1="11.25" x2="31" y2="14" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
        <line x1="36.5" y1="28.75" x2="31" y2="26" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
        <line x1="20" y1="37.5" x2="20" y2="32" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
        <line x1="3.5" y1="28.75" x2="9" y2="26" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
        <line x1="3.5" y1="11.25" x2="9" y2="14" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
        <circle cx="20" cy="2.5" r="1.8" fill="#38bdf8" opacity="0.5"/>
        <circle cx="36.5" cy="11.25" r="1.8" fill="#38bdf8" opacity="0.5"/>
        <circle cx="36.5" cy="28.75" r="1.8" fill="#38bdf8" opacity="0.5"/>
        <circle cx="20" cy="37.5" r="1.8" fill="#38bdf8" opacity="0.5"/>
        <circle cx="3.5" cy="28.75" r="1.8" fill="#38bdf8" opacity="0.5"/>
        <circle cx="3.5" cy="11.25" r="1.8" fill="#38bdf8" opacity="0.5"/>
        <text x="20" y="24.5" textAnchor="middle" fill="#38bdf8" fontFamily="DM Sans,sans-serif" fontWeight="700" fontSize="13">M</text>
      </svg>
      {size !== "icon" && (
        <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: c.textSize, letterSpacing: "-0.02em", color: "#f1f5f9" }}>
          M<span style={{ color: "#94a3b8" }}>OE</span>
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD VIEW — Clean overview shown when owner signs in
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardView({ user, inventory, stock, vendors, history, stockSnapshots, recipes, priceHistory, todayVendors, weekNum, setView }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const businessName = (typeof user.business === "string" ? user.business : user.business?.name) || "your kitchen";
  const firstName = (user.name || "").split(" ")[0] || "there";

  // ── Stats ─────────────────────────────────────────────────────────────────
  const allItems = flatItems(inventory);
  const totalItems = allItems.length;

  // Orders this week
  const currentYear = getWeekYear();
  const ordersThisWeek = (history || []).filter(o => o.weekNumber === weekNum && o.year === currentYear);
  const ordersThisWeekCount = ordersThisWeek.length;

  // Estimated spend this week — price per ORDER unit (case/bag/each) × qty ordered.
  // Uses the shared price helpers so it matches Price Tracker and Recipes exactly.
  const itemById = {};
  allItems.forEach(i => { itemById[i.id] = i; });
  const latestPrice = (itemId) => latestPerOrderUnit(priceHistory, itemById[itemId]);
  let weekSpend = 0;
  let weekSpendComplete = true;
  ordersThisWeek.forEach(o => {
    (o.lines || []).forEach(line => {
      const p = latestPrice(line.id);
      if (p == null) weekSpendComplete = false;
      else weekSpend += (Number(line.qty) || 0) * p;
    });
  });

  // Last count info
  const lastCountTs = Object.values(stockSnapshots || {})
    .map(s => s?._ts ? new Date(s._ts).getTime() : 0)
    .filter(t => t > 0)
    .sort((a, b) => b - a)[0];
  const daysSinceCount = lastCountTs ? Math.floor((Date.now() - lastCountTs) / 86400000) : null;

  // Items below their reorder point — same rule as Place Order (calcOrderQty orders when stock < reorder)
  const lowItems = allItems.filter(i => {
    const s = stock?.[i.id] ?? 0;
    const reorder = Number(i.reorder || 0);
    return reorder > 0 && s < reorder;
  });

  // Recent orders (last 5 across all weeks)
  const recentOrders = [...(history || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  // ── Styles ────────────────────────────────────────────────────────────────
  const cardBase = { background: "#0f1a2e", border: "1px solid #1e2d45", borderRadius: 14, padding: 20 };
  const statLabel = { color: "#64748b", fontSize: 11, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 };
  const statValue = { color: "#f1f5f9", fontSize: 30, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.1, marginTop: 6 };
  const statSub = { color: "#64748b", fontSize: 12, marginTop: 6 };

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: "#64748b", fontSize: 13, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 1 }}>
          WK {weekNum} · {DAYS[getToday()]}
        </div>
        <h1 style={{ color: "#f1f5f9", fontSize: 30, fontWeight: 500, margin: "8px 0 4px", letterSpacing: -0.5 }}>
          {greeting}, {firstName}
        </h1>
        <div style={{ color: "#94a3b8", fontSize: 15 }}>Here's what's happening at {businessName} today.</div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
        <div style={cardBase}>
          <div style={statLabel}>Orders this week</div>
          <div style={statValue}>{ordersThisWeekCount}</div>
          <div style={statSub}>{ordersThisWeekCount === 0 ? "No orders placed yet" : `Across ${new Set(ordersThisWeek.map(o => o.vendor)).size} vendor${new Set(ordersThisWeek.map(o => o.vendor)).size !== 1 ? "s" : ""}`}</div>
        </div>
        <div style={cardBase}>
          <div style={statLabel}>Spend this week</div>
          <div style={statValue}>
            {ordersThisWeekCount === 0 || weekSpend === 0 ? "—" : `$${weekSpend.toFixed(0)}`}
          </div>
          <div style={statSub}>{weekSpend > 0 ? (weekSpendComplete ? "From this week's orders" : "Estimate (some prices missing)") : "Once you order this week"}</div>
        </div>
        <div style={cardBase}>
          <div style={statLabel}>Items in catalog</div>
          <div style={statValue}>{totalItems}</div>
          <div style={statSub}>{(inventory || []).length} section{(inventory || []).length !== 1 ? "s" : ""}</div>
        </div>
        <div style={cardBase}>
          <div style={statLabel}>Recipes saved</div>
          <div style={statValue}>{recipes?.length || 0}</div>
          <div style={statSub}>{(recipes?.length || 0) === 0 ? "Build your first recipe →" : "Tap to cost out dishes"}</div>
        </div>
      </div>

      {/* Today / Heads up */}
      {(todayVendors.length > 0 || lowItems.length > 0 || (daysSinceCount !== null && daysSinceCount >= 7)) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, fontFamily: "'DM Mono',monospace" }}>Heads up</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {todayVendors.length > 0 && (
              <button onClick={() => setView("inventory")} style={{ ...cardBase, textAlign: "left", cursor: "pointer", borderColor: "#0c4a6e", background: "linear-gradient(135deg, #082f49 0%, #0f1a2e 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div>
                    <div style={{ color: "#38bdf8", fontSize: 12, fontWeight: 600, marginBottom: 6, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Orders due today</div>
                    <div style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 500 }}>
                      {todayVendors.length} vendor{todayVendors.length !== 1 ? "s" : ""} ordering today
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>{todayVendors.slice(0, 3).map(v => v.name).join(", ")}{todayVendors.length > 3 ? "…" : ""}</div>
                  </div>
                  <Icon name="arrow-right" size={18} color="#38bdf8" />
                </div>
              </button>
            )}
            {lowItems.length > 0 && (
              <button onClick={() => setView("inventory")} style={{ ...cardBase, textAlign: "left", cursor: "pointer", borderColor: "#78350f", background: "linear-gradient(135deg, #3b1d05 0%, #0f1a2e 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div>
                    <div style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600, marginBottom: 6, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Low stock</div>
                    <div style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 500 }}>
                      {lowItems.length} item{lowItems.length !== 1 ? "s" : ""} running low
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>{lowItems.slice(0, 3).map(i => i.name).join(", ")}{lowItems.length > 3 ? "…" : ""}</div>
                  </div>
                  <Icon name="arrow-right" size={18} color="#fbbf24" />
                </div>
              </button>
            )}
            {daysSinceCount !== null && daysSinceCount >= 7 && (
              <button onClick={() => setView("inventory")} style={{ ...cardBase, textAlign: "left", cursor: "pointer", borderColor: "#581c87", background: "linear-gradient(135deg, #2e1065 0%, #0f1a2e 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                  <div>
                    <div style={{ color: "#c084fc", fontSize: 12, fontWeight: 600, marginBottom: 6, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Count overdue</div>
                    <div style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 500 }}>Last count was {daysSinceCount} days ago</div>
                    <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Weekly counts keep your insights accurate</div>
                  </div>
                  <Icon name="arrow-right" size={18} color="#c084fc" />
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, fontFamily: "'DM Mono',monospace" }}>Quick actions</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { key: "inventory", icon: "inventory", title: "Place Order", sub: "Count stock & build order" },
            { key: "orders", icon: "orders", title: "Review Orders", sub: "Send to vendors & check in" },
            { key: "recipes", icon: "recipes", title: "Add Recipe", sub: "Build a dish recipe" },
            { key: "insights", icon: "insights", title: "View Insights", sub: "Usage & par suggestions" },
          ].map(a => (
            <button key={a.key} onClick={() => setView(a.key)} style={{ ...cardBase, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "16px 18px" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(56,189,248,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={a.icon} size={20} color="#38bdf8" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{a.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'DM Mono',monospace" }}>Recent orders</div>
          {recentOrders.length > 0 && (
            <button onClick={() => setView("history")} style={{ background: "none", border: "none", color: "#38bdf8", fontSize: 12, cursor: "pointer", padding: 0 }}>View all →</button>
          )}
        </div>
        <div style={cardBase}>
          {recentOrders.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 14, textAlign: "center", padding: "20px 0" }}>
              No orders yet. Place your first order to see history here.
            </div>
          ) : (
            recentOrders.map((o, idx) => {
              const dateStr = new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const orderTotal = (o.lines || []).reduce((sum, line) => {
                const p = latestPrice(line.id);
                return p == null ? sum : sum + (Number(line.qty) || 0) * p;
              }, 0);
              return (
                <div key={o.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: idx < recentOrders.length - 1 ? "1px solid #1e2d45" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 500 }}>{o.vendor}</div>
                    <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{dateStr} · WK{o.weekNumber} · {o.totalItems || (o.lines || []).length} item{(o.totalItems || (o.lines || []).length) !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ color: orderTotal > 0 ? "#f1f5f9" : "#475569", fontSize: 14, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>
                    {orderTotal > 0 ? `$${orderTotal.toFixed(0)}` : "—"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPES VIEW — Build recipes from inventory, see auto-calculated dish costs
// ═══════════════════════════════════════════════════════════════════════════════
function RecipesView({ inventory, priceHistory, recipes, saveRecipes }) {
  const [editingId, setEditingId] = useState(null); // null = list view, "new" = create, "id" = edit
  const allItems = flatItems(inventory);

  // Latest price per individual unit for an item — via the shared price helper
  // so Recipes, Dashboard, Price Tracker, and Waste Log all agree on the number.
  const latestPricePerUnit = (itemId) => {
    const item = allItems.find(i => i.id === itemId);
    return latestPerUnit(priceHistory, item || { id: itemId, upu: 1 });
  };

  // Cost out a recipe's ingredients
  const costRecipe = (recipe) => {
    let total = 0;
    let missing = [];
    (recipe.ingredients || []).forEach(ing => {
      const ppu = latestPricePerUnit(ing.itemId);
      const item = allItems.find(i => i.id === ing.itemId);
      if (ppu == null) {
        missing.push(item?.name || `#${ing.itemId}`);
        return;
      }
      total += (Number(ing.qty) || 0) * ppu;
    });
    return { total, missing };
  };

  const onSaveRecipe = (recipe) => {
    let next;
    if (recipe.id && recipes.some(r => r.id === recipe.id)) {
      next = recipes.map(r => r.id === recipe.id ? recipe : r);
    } else {
      const newRec = { ...recipe, id: recipe.id || `rec_${Date.now()}`, createdAt: recipe.createdAt || new Date().toISOString() };
      next = [newRec, ...recipes];
    }
    saveRecipes(next);
    setEditingId(null);
  };

  const onDeleteRecipe = (id) => {
    if (!window.confirm("Delete this recipe?")) return;
    saveRecipes(recipes.filter(r => r.id !== id));
    setEditingId(null);
  };

  // ── Editor view ───────────────────────────────────────────────────────────
  if (editingId) {
    const existing = editingId === "new" ? null : recipes.find(r => r.id === editingId);
    return <RecipeEditor
      initial={existing}
      allItems={allItems}
      latestPricePerUnit={latestPricePerUnit}
      onSave={onSaveRecipe}
      onCancel={() => setEditingId(null)}
      onDelete={existing ? () => onDeleteRecipe(existing.id) : null}
    />;
  }

  // ── List view ─────────────────────────────────────────────────────────────
  const cardBase = { background: "#0f1a2e", border: "1px solid #1e2d45", borderRadius: 14, padding: 18 };

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 500, margin: 0, letterSpacing: -0.4 }}>Recipes & Costs</h1>
          <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
            Build dish recipes from inventory. Costs update automatically from your latest invoice prices.
          </div>
        </div>
        <button onClick={() => setEditingId("new")}
          style={{ background: "#38bdf8", border: "none", borderRadius: 10, color: "#0a0e1a", padding: "11px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="plus" size={16} color="#0a0e1a" /> New Recipe
        </button>
      </div>

      {recipes.length === 0 ? (
        <div style={{ ...cardBase, textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📖</div>
          <div style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 500, marginBottom: 6 }}>No recipes yet</div>
          <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>
            Build a recipe from items in your inventory. We'll automatically calculate the cost per dish using your latest invoice prices.
          </div>
          <button onClick={() => setEditingId("new")}
            style={{ background: "#38bdf8", border: "none", borderRadius: 10, color: "#0a0e1a", padding: "12px 22px", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
            Build your first recipe
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {recipes.map(r => {
            const { total, missing } = costRecipe(r);
            const portions = Number(r.yield) || 1;
            const perPortion = total / portions;
            return (
              <button key={r.id} onClick={() => setEditingId(r.id)}
                style={{ ...cardBase, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12, minHeight: 140 }}>
                <div>
                  <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                    {(r.ingredients || []).length} ingredient{(r.ingredients || []).length !== 1 ? "s" : ""} · serves {portions}
                  </div>
                </div>
                <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "end" }}>
                  <div>
                    <div style={{ color: "#64748b", fontSize: 10, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Cost / portion</div>
                    <div style={{ color: missing.length ? "#fbbf24" : "#22c55e", fontSize: 22, fontWeight: 600, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                      {missing.length === (r.ingredients || []).length ? "—" : `$${perPortion.toFixed(2)}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#64748b", fontSize: 10, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Total</div>
                    <div style={{ color: "#94a3b8", fontSize: 14, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>${total.toFixed(2)}</div>
                  </div>
                </div>
                {missing.length > 0 && (
                  <div style={{ color: "#fbbf24", fontSize: 11, background: "rgba(217,119,6,0.1)", padding: "6px 8px", borderRadius: 6, border: "1px solid rgba(217,119,6,0.25)" }}>
                    Missing price for {missing.length} ingredient{missing.length !== 1 ? "s" : ""}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPE EDITOR — Create or edit a single recipe
// ═══════════════════════════════════════════════════════════════════════════════
function RecipeEditor({ initial, allItems, latestPricePerUnit, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(initial?.name || "");
  const [yieldQty, setYieldQty] = useState(initial?.yield || 1);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [ingredients, setIngredients] = useState(initial?.ingredients || []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const addIngredient = (item) => {
    const upu = Number(item.units_per_unit || item.upu || 1) || 1;
    const defaultUnit = upu > 1 ? "individual" : (item.order_unit || "each");
    setIngredients([...ingredients, { itemId: item.id, qty: 1, unit: defaultUnit }]);
    setPickerOpen(false);
    setPickerSearch("");
  };

  const updateIngredient = (idx, patch) => {
    setIngredients(ingredients.map((ing, i) => i === idx ? { ...ing, ...patch } : ing));
  };

  const removeIngredient = (idx) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  // ── Cost calculation ──────────────────────────────────────────────────────
  let total = 0;
  let missing = 0;
  const lines = ingredients.map(ing => {
    const item = allItems.find(i => i.id === ing.itemId);
    const ppu = latestPricePerUnit(ing.itemId);
    // ppu = price of ONE individual unit. "order" = a whole case/bag (upu units).
    const mult = ing.unit === "order" ? Math.max(1, Number(item?.upu) || 1) : 1;
    const cost = ppu == null ? null : (Number(ing.qty) || 0) * ppu * mult;
    if (ppu == null) missing++;
    else total += cost;
    return { ing, item, ppu, cost };
  });
  const perPortion = total / (Number(yieldQty) || 1);

  const filteredItems = allItems.filter(i =>
    !ingredients.some(ing => ing.itemId === i.id) &&
    i.name.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const canSave = name.trim() && ingredients.length > 0;

  const inputStyle = { background: "#080c14", border: "1px solid #1e2d45", borderRadius: 8, color: "#f1f5f9", padding: "10px 12px", fontSize: 14, outline: "none", width: "100%" };

  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 800, margin: "0 auto" }}>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 16 }}>← Back to recipes</button>

      <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 500, margin: "0 0 24px", letterSpacing: -0.4 }}>
        {initial ? "Edit recipe" : "New recipe"}
      </h1>

      <div style={{ background: "#0f1a2e", border: "1px solid #1e2d45", borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Recipe name</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Margherita Pizza, Vodka Sauce, Caesar Salad" style={inputStyle} />
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Yields (portions)</div>
            <input type="number" min="1" value={yieldQty} onChange={e => setYieldQty(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Notes (optional)</div>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Prep notes, serving suggestions..." style={inputStyle} />
        </div>
      </div>

      {/* Ingredients */}
      <div style={{ background: "#0f1a2e", border: "1px solid #1e2d45", borderRadius: 14, padding: 22, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600 }}>Ingredients</div>
          <button onClick={() => setPickerOpen(true)}
            style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 8, color: "#38bdf8", padding: "7px 12px", cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="plus" size={14} color="#38bdf8" /> Add ingredient
          </button>
        </div>

        {ingredients.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 14, textAlign: "center", padding: "24px 0" }}>
            No ingredients yet. Add items from your inventory.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lines.map(({ ing, item, ppu, cost }, idx) => {
              if (!item) return null;
              const upu = Number(item.units_per_unit || item.upu || 1) || 1;
              const isCase = upu > 1;
              return (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 100px 30px", gap: 10, alignItems: "center", background: "#080c14", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
                      {ppu != null ? `$${ppu.toFixed(3)}/${isCase ? "unit" : (item.order_unit || "each")}` : "no price"}
                    </div>
                  </div>
                  <input type="number" min="0" step="0.1" value={ing.qty}
                    onChange={e => updateIngredient(idx, { qty: e.target.value })}
                    style={{ ...inputStyle, padding: "7px 10px", fontSize: 13 }} />
                  <select value={ing.unit} onChange={e => updateIngredient(idx, { unit: e.target.value })}
                    style={{ ...inputStyle, padding: "7px 10px", fontSize: 13 }}>
                    {isCase && <option value="individual">{`unit (1 of ${item.upu} per ${item.order_unit || "case"})`}</option>}
                    {isCase && <option value="order">{`whole ${item.order_unit || "case"}`}</option>}
                    <option value="each">each</option>
                    <option value="oz">oz</option>
                    <option value="lb">lb</option>
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                    <option value="cup">cup</option>
                    <option value="tsp">tsp</option>
                    <option value="tbsp">tbsp</option>
                  </select>
                  <div style={{ color: cost == null ? "#fbbf24" : "#22c55e", fontSize: 14, fontFamily: "'DM Mono',monospace", textAlign: "right", fontWeight: 600 }}>
                    {cost == null ? "—" : `$${cost.toFixed(2)}`}
                  </div>
                  <button onClick={() => removeIngredient(idx)}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, padding: 0 }}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cost summary */}
      {ingredients.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, #082f49 0%, #0f1a2e 100%)", border: "1px solid #0c4a6e", borderRadius: 14, padding: 22, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Total cost</div>
              <div style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 600, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>${total.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Per portion</div>
              <div style={{ color: "#38bdf8", fontSize: 26, fontWeight: 600, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>${perPortion.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>Suggested menu price (3× food cost)</div>
              <div style={{ color: "#22c55e", fontSize: 26, fontWeight: 600, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>${(perPortion * 3).toFixed(2)}</div>
            </div>
          </div>
          {missing > 0 && (
            <div style={{ color: "#fbbf24", fontSize: 12, marginTop: 14, padding: "8px 10px", background: "rgba(217,119,6,0.12)", borderRadius: 6, border: "1px solid rgba(217,119,6,0.25)" }}>
              ⚠ {missing} ingredient{missing !== 1 ? "s" : ""} missing a price. Add invoice prices in Price Tracker to complete the cost.
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        {onDelete ? (
          <button onClick={onDelete}
            style={{ background: "transparent", border: "1px solid #7f1d1d", borderRadius: 10, color: "#fca5a5", padding: "11px 18px", cursor: "pointer", fontSize: 14 }}>
            Delete recipe
          </button>
        ) : <div />}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel}
            style={{ background: "transparent", border: "1px solid #1e2d45", borderRadius: 10, color: "#94a3b8", padding: "11px 18px", cursor: "pointer", fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={() => canSave && onSave({ id: initial?.id, createdAt: initial?.createdAt, name: name.trim(), yield: Number(yieldQty) || 1, notes: notes.trim(), ingredients, updatedAt: new Date().toISOString() })}
            disabled={!canSave}
            style={{ background: canSave ? "#38bdf8" : "#1e2d45", border: "none", borderRadius: 10, color: canSave ? "#0a0e1a" : "#475569", padding: "11px 22px", cursor: canSave ? "pointer" : "not-allowed", fontWeight: 600, fontSize: 14 }}>
            Save recipe
          </button>
        </div>
      </div>

      {/* Ingredient picker modal */}
      {pickerOpen && (
        <div onClick={() => setPickerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0f1a2e", border: "1px solid #1e2d45", borderRadius: 14, width: "100%", maxWidth: 500, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #1e2d45" }}>
              <div style={{ color: "#f1f5f9", fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Add ingredient</div>
              <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search inventory…" autoFocus style={inputStyle} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {filteredItems.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "20px" }}>No items found.</div>
              ) : filteredItems.map(item => {
                const ppu = latestPricePerUnit(item.id);
                return (
                  <button key={item.id} onClick={() => addIngredient(item)}
                    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "10px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#f1f5f9" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#1e2d45"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14 }}>{item.name}</div>
                      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{item.section}</div>
                    </div>
                    <div style={{ color: ppu == null ? "#fbbf24" : "#94a3b8", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
                      {ppu == null ? "no price" : `$${ppu.toFixed(3)}/unit`}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #1e2d45", textAlign: "right" }}>
              <button onClick={() => setPickerOpen(false)}
                style={{ background: "transparent", border: "1px solid #1e2d45", borderRadius: 8, color: "#94a3b8", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY VIEW (a.k.a. "Place Order") — day-aware count screen
// Defaults to today. Shows what's being ordered on the selected day, filters
// inventory to those vendors' items, marks vendors whose order has already
// been submitted this week.
// ═══════════════════════════════════════════════════════════════════════════════
function InventoryView({ inventory, stock, updateStock, vendors, history, submitOrder, countLog }) {
  const [selectedDay, setSelectedDay] = useState(getToday());
  const today = getToday();
  const weekNum = getWeekNumber();
  const curYear = getWeekYear();
  const allItems = flatItems(inventory);
  const hasStockData = Object.values(stock).some(v => v > 0);
  const urgentCount = hasStockData ? allItems.filter(i => (stock[i.id] ?? 0) < i.reorder).length : 0;

  // Last-counted timestamp per item (countLog is newest-first, so first hit wins)
  const lastCounted = {};
  (countLog || []).forEach(e => { if (!(e.i in lastCounted)) lastCounted[e.i] = e.at; });
  const agoLabel = (iso) => {
    if (!iso) return null;
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? "1d ago" : `${days}d ago`;
  };

  // Vendors that order on the selected day
  const dayVendors = (vendors || []).filter(v => v.orderDays && v.orderDays.includes(selectedDay));
  const dayVendorNames = new Set(dayVendors.map(v => normName(v.name)));

  // This week's submitted orders (non-quick)
  const thisWeekOrders = (history || []).filter(h => h.weekNumber === weekNum && h.year === curYear && h.type !== "quick");

  // Submission status per vendor for the selected day.
  // Match on vendor + this week (normalized) — NOT on the stamped day name.
  // Orders are stamped with the day they were SUBMITTED (e.g. Tuesday night for a
  // Wednesday vendor), so a day-name match would show "ready to build" after
  // submitting and allow a double submit.
  const submittedByVendor = {};
  dayVendors.forEach(v => {
    const found = thisWeekOrders.find(o => (o.vendor || "").trim().toLowerCase() === (v.name || "").trim().toLowerCase());
    if (found) submittedByVendor[v.name] = found;
  });
  const allSubmitted = dayVendors.length > 0 && dayVendors.every(v => submittedByVendor[v.name]);

  // Filter inventory to ONLY items from vendors ordering on the selected day
  const filteredSections = inventory
    .map(s => ({ ...s, items: (s.items || []).filter(i => dayVendorNames.has(normName(i.vendor))) }))
    .filter(s => s.items.length > 0);

  const isToday = selectedDay === today;

  // Count progress for the visible items (counted = logged today)
  const todayStr = new Date().toDateString();
  const visibleItems = filteredSections.flatMap(s => s.items);
  const countedToday = visibleItems.filter(i => lastCounted[i.id] && new Date(lastCounted[i.id]).toDateString() === todayStr).length;

  return (
    <div style={{ overflow:"hidden" }}>
      {/* Day selector + label */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:14 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:"0 0 2px" }}>Place Order</h2>
          <p style={{ color:"#475569", fontSize:13, margin:0 }}>
            {isToday ? `Today — ${DAYS[selectedDay]}` : DAYS[selectedDay]} · WK{weekNum}
            {visibleItems.length > 0 && !allSubmitted && (
              <span style={{ marginLeft:8, color: countedToday === visibleItems.length ? "#4ade80" : "#94a3b8", fontFamily:"'DM Mono',monospace", fontSize:11 }}>
                {countedToday}/{visibleItems.length} counted
              </span>
            )}
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:0.5 }}>Day</span>
          <select value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))}
            style={{ background:"#0f1a2e", border:"1px solid #1e2d45", color:"#f1f5f9", borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
            {DAYS.map((d, i) => {
              const dayVendorCount = (vendors || []).filter(v => v.orderDays && v.orderDays.includes(i)).length;
              return <option key={i} value={i}>{d}{i === today ? " (Today)" : ""}{dayVendorCount > 0 ? ` · ${dayVendorCount}` : ""}</option>;
            })}
          </select>
        </div>
      </div>

      {/* No orders for this day */}
      {dayVendors.length === 0 && (
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:14, padding:"32px 20px", textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
          <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:600, marginBottom:6 }}>No orders scheduled for {DAYS[selectedDay]}</div>
          <div style={{ color:"#94a3b8", fontSize:13 }}>
            None of your vendors order on {DAYS[selectedDay]}. Use the dropdown above to switch days, or set vendor order days in Settings.
          </div>
        </div>
      )}

      {/* Per-vendor submission banner */}
      {dayVendors.length > 0 && (
        <div style={{ marginBottom:14, display:"flex", flexDirection:"column", gap:8 }}>
          {dayVendors.map(v => {
            const sub = submittedByVendor[v.name];
            if (sub) {
              const subTime = new Date(sub.date).toLocaleString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });
              return (
                <div key={v.id} style={{ background:"linear-gradient(135deg, #022c22 0%, #0f1a2e 100%)", border:"1px solid #064e3b", borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:18 }}>✅</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#a7f3d0", fontWeight:600, fontSize:14 }}>{v.name} — order submitted this week</div>
                    <div style={{ color:"#6ee7b7", fontSize:12, marginTop:2 }}>Submitted {sub.day || ""} at {subTime} · {(sub.lines || []).length} item{(sub.lines || []).length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
              );
            }
            return (
              <div key={v.id} style={{ background:"#422006", border:"1px solid #d97706", borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:18 }}>📦</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:"#fbbf24", fontWeight:600, fontSize:14 }}>{v.name} — order ready to build</div>
                  <div style={{ color:"#d97706", fontSize:12, marginTop:2 }}>Count {v.name}'s items below, then submit at the bottom of this page</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Urgent items banner — only show when stock has been counted and there are items showing */}
      {urgentCount > 0 && filteredSections.length > 0 && !allSubmitted && (
        <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:12, padding:"12px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:18 }}>🔴</span>
          <div style={{ color:"#fca5a5", fontWeight:600, fontSize:13 }}>{urgentCount} item{urgentCount!==1?"s":""} below reorder point</div>
        </div>
      )}

      {/* All submitted state */}
      {allSubmitted && (
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:14, padding:"28px 20px", textAlign:"center", marginTop:8 }}>
          <div style={{ fontSize:36, marginBottom:10 }}>🎉</div>
          <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:600, marginBottom:6 }}>All orders for {DAYS[selectedDay]} have been submitted</div>
          <div style={{ color:"#94a3b8", fontSize:13 }}>Nothing left to count for today. Check Orders to track delivery.</div>
        </div>
      )}

      {/* Items to count, grouped by section, filtered to selected day's vendors */}
      {dayVendors.length > 0 && !allSubmitted && filteredSections.map(section => (
        <div key={section.section} style={{ marginBottom:16 }}>
          <div style={{ background:"#080c14", border:"1px solid #1e2d45", borderBottom:"none", borderRadius:"12px 12px 0 0", padding:"8px 16px", position:"sticky", top:52, zIndex:5 }}>
            <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>{section.section}</span>
          </div>
          <div style={{ border:"1px solid #1e2d45", borderTop:"none", borderRadius:"0 0 12px 12px", overflow:"hidden" }}>
            {section.items.map((item, idx) => {
              const s = stock[item.id] ?? 0;
              const status = getStatus(item, s);
              const orderQty = calcOrderQty(item, s);
              const vendorSubmitted = !!submittedByVendor[item.vendor];
              return (
                <div key={item.id} style={{ padding:"10px 14px", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:idx>0?"1px solid #080c14":"none", opacity: vendorSubmitted ? 0.45 : 1 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, gap:6, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0 }}>
                      <span style={{ color:"#e2e8f0", fontSize:14, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</span>
                      <span style={{ background:"#0f2040", border:"1px solid #1e3a5f", borderRadius:4, padding:"1px 6px", color:"#94a3b8", fontSize:9, fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{item.vendor}</span>
                      {lastCounted[item.id] && <span style={{ color:"#475569", fontSize:9, fontFamily:"'DM Mono',monospace", flexShrink:0 }}>✓ {agoLabel(lastCounted[item.id])}</span>}
                    </div>
                    <span style={{ background:status.bg, color:status.color, borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{status.label}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ color:"#475569", fontSize:9, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.5px", marginRight:2 }}>Current Stock</span>
                      <button onClick={() => updateStock(item.id, Math.max(0, s-1))} disabled={vendorSubmitted} style={{ width:40, height:40, background:"#1e2d45", border:"none", borderRadius:10, color:"#94a3b8", cursor: vendorSubmitted ? "not-allowed" : "pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                      <input type="number" value={s} min={0} inputMode="numeric" pattern="[0-9]*" disabled={vendorSubmitted}
                        onChange={e => updateStock(item.id, e.target.value === "" ? 0 : e.target.value)}
                        onFocus={e => e.target.select()}
                        style={{ width:54, background:"#080c14", border:"1px solid #475569", borderRadius:10, padding:"9px 6px", color:"#f1f5f9", fontSize:16, fontWeight:700, textAlign:"center", outline:"none", fontFamily:"'DM Mono',monospace" }} />
                      <button onClick={() => updateStock(item.id, s+1)} disabled={vendorSubmitted} style={{ width:40, height:40, background:"#1e2d45", border:"none", borderRadius:10, color:"#94a3b8", cursor: vendorSubmitted ? "not-allowed" : "pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                    </div>
                    <div>{orderQty > 0 ? <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:6, padding:"4px 10px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>Order {orderQty}</span> : null}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* SUBMIT FOOTER — only when there are unsubmitted vendors with items to order */}
      {dayVendors.length > 0 && !allSubmitted && (() => {
        const pending = dayVendors.filter(v => !submittedByVendor[v.name]);
        const pendingWithOrders = pending.map(v => {
          const items = flatItems(inventory).filter(i => (i.vendor || "").trim().toLowerCase() === (v.name || "").trim().toLowerCase());
          const lines = items.map(it => ({ ...it, orderQty: calcOrderQty(it, stock[it.id] ?? 0) })).filter(l => l.orderQty > 0);
          return { vendor: v, lines };
        });
        const vendorsWithOrders = pendingWithOrders.filter(p => p.lines.length > 0);
        const totalLines = vendorsWithOrders.reduce((sum, p) => sum + p.lines.length, 0);
        const nothingToOrder = vendorsWithOrders.length === 0;
        const submitAll = () => {
          if (nothingToOrder) return;
          const names = vendorsWithOrders.map(p => p.vendor.name).join(", ");
          if (!window.confirm(`Submit ${vendorsWithOrders.length} order${vendorsWithOrders.length !== 1 ? "s" : ""} (${totalLines} item${totalLines !== 1 ? "s" : ""}) to ${names}?\n\nOnce submitted, the orders move to Orders → Waiting on delivery. You can't edit them — use Quick Order if you forget something.`)) return;
          if (submitOrder) submitOrder(vendorsWithOrders.map(p => p.vendor.name));
        };
        return (
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:14, padding:"16px 18px", marginTop:8 }}>
            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:0.8, marginBottom:10, fontFamily:"'DM Mono',monospace" }}>Ready to submit</div>
            {nothingToOrder ? (
              <div style={{ color:"#64748b", fontSize:13, padding:"8px 0" }}>
                Nothing below reorder point yet — count more items or switch to another day.
              </div>
            ) : (
              <>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
                  {vendorsWithOrders.map(p => (
                    <div key={p.vendor.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"#0a1220", border:"1px solid #1e2d45", borderRadius:8 }}>
                      <div>
                        <div style={{ color:"#e2e8f0", fontSize:14, fontWeight:600 }}>{p.vendor.name}</div>
                        <div style={{ color:"#64748b", fontSize:11, marginTop:2, fontFamily:"'DM Mono',monospace" }}>{p.lines.length} item{p.lines.length !== 1 ? "s" : ""} to order</div>
                      </div>
                      <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:6, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{p.lines.reduce((s,l)=>s+l.orderQty,0)} units</span>
                    </div>
                  ))}
                </div>
                <button onClick={submitAll}
                  style={{ width:"100%", background:"linear-gradient(135deg,#22d3ee 0%,#0891b2 100%)", border:"none", borderRadius:10, padding:"14px", color:"#060a12", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
                  Submit {vendorsWithOrders.length} order{vendorsWithOrders.length !== 1 ? "s" : ""} →
                </button>
                <div style={{ color:"#64748b", fontSize:11, textAlign:"center", marginTop:8 }}>
                  Orders move to Orders → Waiting on delivery. Once submitted you can't edit.
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDERS VIEW — Shows vendors ordering today, submit per vendor
// ═══════════════════════════════════════════════════════════════════════════════
function OrdersView({ inventory, stock, vendors, submitOrder, logQuickOrder, submitOrderForWeek, checkInDelivery, history, user }) {
  const [selectedDay, setSelectedDay] = useState(getToday());
  const dayVendors = vendors.filter(v => v.orderDays && v.orderDays.includes(selectedDay));
  const allItems = flatItems(inventory);
  const weekNum = getWeekNumber();
  const curYear = getWeekYear();
  const [submitted, setSubmitted] = useState({});
  const isPast = selectedDay !== getToday();
  const [backfillDone, setBackfillDone] = useState({});

  // ── Detect missed orders this week ──────────────────────────────────────
  // For each vendor, check if their order day(s) earlier this week have a submitted order
  const today = getToday();
  const thisWeekOrders = (history || []).filter(h => h.weekNumber === weekNum && h.year === curYear && h.type !== "quick");
  const missedOrders = [];
  vendors.forEach(v => {
    if (!v.orderDays || v.orderDays.length === 0) return;
    // order days that have already passed this week (before today)
    // Weeks run Monday→Sunday, so compare Monday-based positions (Sunday is the LAST day).
    const monIdx = (d) => (d + 6) % 7;
    const passedDays = v.orderDays.filter(d => monIdx(d) < monIdx(today));
    if (passedDays.length === 0) return;
    const hasOrder = thisWeekOrders.some(h => normName(h.vendor) === normName(v.name));
    if (!hasOrder && !backfillDone[v.name]) {
      missedOrders.push({ vendor: v.name, days: passedDays });
    }
  });

  // ── Delivery check-in ───────────────────────────────────────────────────
  const [checkInOrder, setCheckInOrder] = useState(null); // order being checked in
  const [checkInState, setCheckInState] = useState({}); // { [lineId]: { status, receivedQty } }
  const [dismissedShortfall, setDismissedShortfall] = useState({});

  // Orders submitted but not yet checked in (awaiting delivery), newest first
  const awaitingDelivery = (history || [])
    .filter(o => !o.received && o.type !== "quick" && (o.lines || []).length > 0
      && (new Date() - new Date(o.date)) < 14 * 86400000) // only recent orders — don't flag ancient history
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Shortfalls: items from checked-in orders that didn't fully arrive (recent, not dismissed)
  const shortfalls = [];
  (history || []).filter(o => o.received).forEach(o => {
    (o.lines || []).forEach(line => {
      if (line.delivered && line.delivered !== "delivered" && !dismissedShortfall[`${o.id}_${line.id}`]) {
        shortfalls.push({ key: `${o.id}_${line.id}`, orderId: o.id, vendor: o.vendor, name: line.name, status: line.delivered, qty: line.qty, order_unit: line.order_unit, id: line.id, date: o.date });
      }
    });
  });

  // Low & not on any open (awaiting-delivery) order — catches "never made it onto the list"
  const onOpenOrder = new Set();
  awaitingDelivery.forEach(o => (o.lines || []).forEach(l => onOpenOrder.add(l.id)));
  const lowNotOrdered = allItems.filter(item => {
    const s = stock[item.id] ?? 0;
    const reorder = item.reorder ?? 0;
    return reorder > 0 && s <= reorder && !onOpenOrder.has(item.id);
  });

  const statusLabel = { short:"Short", out_of_stock:"Out of stock", damaged:"Damaged", not_ordered:"Not on order" };

  const openCheckIn = (order) => {
    const init = {};
    (order.lines || []).forEach(l => { init[l.id] = { status: "delivered", receivedQty: l.qty }; });
    setCheckInState(init);
    setCheckInOrder(order);
  };
  const submitCheckIn = () => {
    checkInDelivery(checkInOrder.id, checkInState);
    setCheckInOrder(null); setCheckInState({});
  };
  const addToNextOrder = (item) => {
    const invItem = allItems.find(i => i.id === item.id);
    logQuickOrder([{ id: item.id, name: item.name, qty: item.qty || 1, order_unit: item.order_unit, vendor: invItem?.vendor || "", section: invItem?.section || "" }], "Reorder — didn't arrive", `Shortfall from ${item.vendor || "order"}`);
    setDismissedShortfall(prev => ({ ...prev, [item.key]: true }));
  };

  const [quickSearch, setQuickSearch] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [quickItems, setQuickItems] = useState([]); // [{ id, name, qty, order_unit, vendor, section }]
  const [quickSource, setQuickSource] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [quickWeek, setQuickWeek] = useState("current"); // "current" or "YYYY-WKnn"

  // Build last 8 weeks for backfill picker
  const backfillWeeks = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(); d.setDate(d.getDate() - i * 7);
    const wn = getWeekNumber(d); const yr = getWeekYear(d);
    const key = `${yr}-WK${String(wn).padStart(2,"0")}`;
    if (!backfillWeeks.some(w => w.key === key)) {
      const mon = getWeekMonday(wn, yr).toLocaleDateString("en-US", { month:"short", day:"numeric" });
      backfillWeeks.push({ key, wn, yr, label: i === 0 ? `This week · Mon ${mon}` : `WK${wn} · Mon ${mon}` });
    }
  }

  const addQuickItem = (item) => {
    if (quickItems.find(q => q.id === item.id)) return;
    setQuickItems(prev => [...prev, { id: item.id, name: item.name, qty: 1, order_unit: item.order_unit, vendor: item.vendor || "", section: item.section || "" }]);
    setQuickSearch("");
  };
  const updateQuickQty = (id, qty) => setQuickItems(prev => prev.map(q => q.id === id ? { ...q, qty: Math.max(1, qty) } : q));
  const removeQuickItem = (id) => setQuickItems(prev => prev.filter(q => q.id !== id));

  const submitQuickOrder = () => {
    if (quickItems.length === 0) return;
    let targetWeek = null;
    if (quickWeek !== "current") {
      const w = backfillWeeks.find(b => b.key === quickWeek);
      if (w) targetWeek = { weekNum: w.wn, year: w.yr };
    }
    logQuickOrder(quickItems, quickSource || "Quick Order", quickNote, targetWeek);
    setQuickItems([]); setQuickSource(""); setQuickNote(""); setQuickWeek("current"); setShowQuick(false);
  };

  const filteredItems = quickSearch.trim() ? allItems.filter(i => i.name.toLowerCase().includes(quickSearch.toLowerCase())).slice(0, 8) : [];

  const handleSubmit = (vendorName) => {
    submitOrder(vendorName);
    setSubmitted(prev => ({ ...prev, [vendorName]: true }));
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:"0 0 4px" }}>Orders</h2>
          <p style={{ color:"#475569", fontSize:13, margin:0 }}>Waiting on delivery · {awaitingDelivery.length} open</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={() => setShowQuick(!showQuick)}
            style={{ background: showQuick ? "#38bdf8" : "transparent", border: `1px solid ${showQuick ? "#38bdf8" : "#1e2d45"}`, borderRadius: 8, padding: "7px 14px", color: showQuick ? "#060a12" : "#38bdf8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Icon name="bolt" size={14} color={showQuick ? "#060a12" : "#38bdf8"} style={{ marginRight:6 }} />Quick Order
          </button>
        </div>
      </div>

      {/* ── MISSED ORDER ALERT ── */}
      {missedOrders.length > 0 && (
        <div style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.4)", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <Icon name="alert" size={16} color="#fbbf24" />
            <span style={{ color:"#fbbf24", fontSize:14, fontWeight:700 }}>Possible missed orders this week</span>
          </div>
          <p style={{ color:"#94a3b8", fontSize:12.5, margin:"0 0 12px", lineHeight:1.5 }}>
            These vendors had an order day earlier this week ({fmtWeekLabel(weekNum)}) but no order was submitted. If you ordered, backfill it so your insights stay accurate.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {missedOrders.map(m => (
              <div key={m.vendor} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"#0c1220", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", flexWrap:"wrap" }}>
                <div>
                  <span style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>📦 {m.vendor}</span>
                  <span style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace", marginLeft:8 }}>due {m.days.map(d => DAYS_SHORT[d]).join(", ")}</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => { submitOrderForWeek(m.vendor, weekNum, curYear); setBackfillDone(prev => ({ ...prev, [m.vendor]: true })); }}
                    style={{ background:"#38bdf8", border:"none", borderRadius:7, padding:"7px 14px", color:"#060a12", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    Backfill order
                  </button>
                  <button onClick={() => setBackfillDone(prev => ({ ...prev, [m.vendor]: true }))}
                    style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:7, padding:"7px 12px", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DELIVERY CHECK-IN MODAL ── */}
      {checkInOrder && (
        <div onClick={() => setCheckInOrder(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:0 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:600, maxHeight:"88vh", overflowY:"auto" }}>
            <div style={{ position:"sticky", top:0, background:"#0f1a2e", padding:"16px 18px", borderBottom:"1px solid #1e2d45", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}><Icon name="orders" size={17} color="#38bdf8" />Check in {checkInOrder.vendor}</div>
                <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>Tap anything that didn't fully arrive. Everything defaults to delivered.</div>
              </div>
              <button onClick={() => setCheckInOrder(null)} style={{ background:"none", border:"none", color:"#64748b", fontSize:22, cursor:"pointer", lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:"8px 0" }}>
              {(checkInOrder.lines || []).map((line, idx) => {
                const st = checkInState[line.id] || { status:"delivered", receivedQty: line.qty };
                const opts = [
                  { v:"delivered", l:"Came in", c:"#34d399" },
                  { v:"short", l:"Short", c:"#fbbf24" },
                  { v:"out_of_stock", l:"Out", c:"#fca5a5" },
                  { v:"damaged", l:"Damaged", c:"#fca5a5" },
                ];
                return (
                  <div key={line.id} style={{ padding:"12px 18px", borderBottom: idx < checkInOrder.lines.length-1 ? "1px solid #0f1a2e" : "none" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:8 }}>
                      <span style={{ color:"#e2e8f0", fontSize:14, fontWeight:600 }}>{line.name}</span>
                      <span style={{ color:"#475569", fontSize:12, fontFamily:"'DM Mono',monospace" }}>ordered {qtyText(line)}</span>
                    </div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {opts.map(o => {
                        const active = st.status === o.v;
                        return (
                          <button key={o.v} onClick={() => setCheckInState(prev => ({ ...prev, [line.id]: { ...prev[line.id], status: o.v, receivedQty: o.v === "short" ? Math.max(0, line.qty-1) : (o.v === "delivered" ? line.qty : 0) } }))}
                            style={{ background: active ? o.c : "transparent", border:`1px solid ${active ? o.c : "#1e2d45"}`, borderRadius:7, padding:"6px 12px", color: active ? "#060a12" : "#94a3b8", fontSize:12, fontWeight: active?700:400, cursor:"pointer" }}>
                            {o.l}
                          </button>
                        );
                      })}
                      {st.status === "short" && (
                        <div style={{ display:"flex", alignItems:"center", gap:4, marginLeft:4 }}>
                          <span style={{ color:"#64748b", fontSize:11 }}>got</span>
                          <input type="number" min="0" max={line.qty} value={st.receivedQty} onFocus={e=>e.target.select()}
                            onChange={e => setCheckInState(prev => ({ ...prev, [line.id]: { ...prev[line.id], status:"short", receivedQty: parseInt(e.target.value)||0 } }))}
                            style={{ width:46, background:"#080c14", border:"1px solid #d97706", borderRadius:6, padding:"5px 6px", color:"#fbbf24", fontSize:13, outline:"none", textAlign:"center", fontFamily:"'DM Mono',monospace" }} />
                          <span style={{ color:"#64748b", fontSize:11 }}>of {line.qty}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ position:"sticky", bottom:0, background:"#0c1220", padding:"14px 18px", borderTop:"1px solid #1e2d45" }}>
              <button onClick={submitCheckIn}
                style={{ width:"100%", background:"#38bdf8", border:"none", borderRadius:10, padding:"13px", color:"#060a12", fontSize:15, fontWeight:700, cursor:"pointer" }}>
                Confirm delivery
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHORTFALL ALERT: ordered but didn't arrive ── */}
      {shortfalls.length > 0 && (
        <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.4)", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <Icon name="alert" size={16} color="#fca5a5" />
            <span style={{ color:"#fca5a5", fontSize:14, fontWeight:700 }}>Ordered but didn't arrive ({shortfalls.length})</span>
          </div>
          <p style={{ color:"#94a3b8", fontSize:12.5, margin:"0 0 12px", lineHeight:1.5 }}>
            These were on an order but came up short or out of stock. Add them to your next order so you don't run out.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {shortfalls.map(s => (
              <div key={s.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"#0c1220", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", flexWrap:"wrap" }}>
                <div>
                  <span style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>{s.name}</span>
                  <span style={{ background:"rgba(248,113,113,0.15)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:4, padding:"1px 6px", color:"#fca5a5", fontSize:9, fontWeight:700, marginLeft:8, fontFamily:"'DM Mono',monospace" }}>{statusLabel[s.status] || s.status}</span>
                  <span style={{ color:"#64748b", fontSize:11, marginLeft:8 }}>{s.vendor}</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => addToNextOrder(s)}
                    style={{ background:"#38bdf8", border:"none", borderRadius:7, padding:"7px 12px", color:"#060a12", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    Add to next order
                  </button>
                  <button onClick={() => setDismissedShortfall(prev => ({ ...prev, [s.key]: true }))}
                    style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:7, padding:"7px 10px", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AWAITING DELIVERY: orders to check in ── */}
      {awaitingDelivery.length > 0 && (
        <div style={{ background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.3)", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <Icon name="orders" size={16} color="#38bdf8" />
            <span style={{ color:"#38bdf8", fontSize:14, fontWeight:700 }}>Waiting on delivery ({awaitingDelivery.length})</span>
          </div>
          <p style={{ color:"#94a3b8", fontSize:12.5, margin:"0 0 12px", lineHeight:1.5 }}>
            When a delivery shows up, check it in so you catch anything that didn't come — before you run out.
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {awaitingDelivery.map(o => {
              const mon = getWeekMonday(o.weekNumber, o.year).toLocaleDateString("en-US",{month:"short",day:"numeric"});
              return (
                <div key={o.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:"#0c1220", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", flexWrap:"wrap" }}>
                  <div>
                    <span style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>{o.vendor}</span>
                    <span style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace", marginLeft:8 }}>WK{o.weekNumber} · Mon {mon} · {o.totalItems} item{o.totalItems!==1?"s":""}</span>
                  </div>
                  <button onClick={() => openCheckIn(o)}
                    style={{ background:"#38bdf8", border:"none", borderRadius:7, padding:"7px 14px", color:"#060a12", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                    Check in delivery
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── QUICK ORDER PANEL ── */}
      {showQuick && (
        <div style={{ background: "#0f1a2e", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ color: "#38bdf8", fontSize: 14, fontWeight: 700, display:"flex", alignItems:"center", gap:6 }}><Icon name="bolt" size={15} color="#38bdf8" />Quick Order</div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>Log an emergency run or off-schedule purchase</div>
            </div>
          </div>

          {/* Source */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", color: "#64748b", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "'DM Mono',monospace" }}>Where from</label>
              <input value={quickSource} onChange={e => setQuickSource(e.target.value)} placeholder="e.g. Restaurant Depot"
                style={{ width: "100%", background: "#080c14", border: "1px solid #1e2d45", borderRadius: 8, padding: "8px 12px", color: "#f1f5f9", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", color: "#64748b", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "'DM Mono',monospace" }}>Note (optional)</label>
              <input value={quickNote} onChange={e => setQuickNote(e.target.value)} placeholder="e.g. ran out mid-week"
                style={{ width: "100%", background: "#080c14", border: "1px solid #1e2d45", borderRadius: 8, padding: "8px 12px", color: "#f1f5f9", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* Week picker for backfilling */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display: "block", color: "#64748b", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "'DM Mono',monospace" }}>Log to week</label>
            <select value={quickWeek} onChange={e => setQuickWeek(e.target.value)}
              style={{ width:"100%", background:"#080c14", border:`1px solid ${quickWeek !== "current" ? "#d97706" : "#1e2d45"}`, borderRadius:8, padding:"8px 12px", color: quickWeek !== "current" ? "#fbbf24" : "#f1f5f9", fontSize:14, outline:"none", cursor:"pointer" }}>
              <option value="current">This week (now)</option>
              {backfillWeeks.slice(1).map(w => <option key={w.key} value={w.key}>Backfill · {w.label}</option>)}
            </select>
            {quickWeek !== "current" && <div style={{ color:"#fbbf24", fontSize:11, marginTop:4 }}>⚠️ Backfilling a past week — use this for orders you forgot to submit</div>}
          </div>

          {/* Search items */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <label style={{ display: "block", color: "#64748b", fontSize: 10, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "'DM Mono',monospace" }}>Add items</label>
            <input value={quickSearch} onChange={e => setQuickSearch(e.target.value)} placeholder="Search your items..."
              style={{ width: "100%", background: "#080c14", border: "1px solid #1e2d45", borderRadius: 8, padding: "8px 12px", color: "#f1f5f9", fontSize: 16, outline: "none", boxSizing: "border-box" }} />
            {filteredItems.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0c1220", border: "1px solid #1e2d45", borderRadius: "0 0 8px 8px", zIndex: 10, maxHeight: 200, overflowY: "auto" }}>
                {filteredItems.map(item => (
                  <button key={item.id} onClick={() => addQuickItem(item)}
                    style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "transparent", border: "none", borderBottom: "1px solid #080c14", color: "#e2e8f0", fontSize: 13, cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#1e2d45"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span>{item.name}</span>
                    <span style={{ color: "#475569", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>{item.order_unit} · {item.vendor}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected items */}
          {quickItems.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {quickItems.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#080c14", borderRadius: 8, marginBottom: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ color: "#475569", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>{item.order_unit}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={() => updateQuickQty(item.id, item.qty - 1)} style={{ width: 28, height: 28, background: "#1e2d45", border: "none", borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <input type="number" value={item.qty} min={1} onChange={e => updateQuickQty(item.id, parseInt(e.target.value) || 1)}
                      style={{ width: 40, background: "#0f1a2e", border: "1px solid #1e2d45", borderRadius: 6, padding: "4px", color: "#f1f5f9", fontSize: 16, fontWeight: 700, textAlign: "center", outline: "none", fontFamily: "'DM Mono',monospace" }} />
                    <button onClick={() => updateQuickQty(item.id, item.qty + 1)} style={{ width: 28, height: 28, background: "#1e2d45", border: "none", borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                  <button onClick={() => removeQuickItem(item.id)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: 4 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <button onClick={submitQuickOrder} disabled={quickItems.length === 0}
            style={{ width: "100%", background: quickItems.length > 0 ? "#38bdf8" : "#1e2d45", border: "none", borderRadius: 8, padding: "12px", color: quickItems.length > 0 ? "#060a12" : "#475569", fontSize: 14, fontWeight: 700, cursor: quickItems.length > 0 ? "pointer" : "default" }}>
            Log {quickItems.length > 0 ? `${quickItems.length} Item${quickItems.length !== 1 ? "s" : ""}` : "Quick Order"}
          </button>
        </div>
      )}

      {/* Per-vendor submit UI moved to Place Order — this view only handles waiting deliveries, check-ins, and shortfalls */}
      {awaitingDelivery.length === 0 && shortfalls.length === 0 && missedOrders.length === 0 && !showQuick && (
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:40, textAlign:"center" }}>
          <div style={{ fontSize:42, marginBottom:14 }}>📭</div>
          <div style={{ color:"#e2e8f0", fontSize:16, fontWeight:600, marginBottom:6 }}>Nothing waiting on delivery</div>
          <div style={{ color:"#64748b", fontSize:13, maxWidth:340, margin:"0 auto", lineHeight:1.5 }}>
            When you submit an order from Place Order, it lands here. Check it in once the delivery shows up, and it moves to History.
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY VIEW — Past orders organized by week number, PDF per vendor
// ═══════════════════════════════════════════════════════════════════════════════
function HistoryView({ history, user }) {
  const [search, setSearch] = useState("");
  const [filterVendor, setFilterVendor] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [expandedOrders, setExpandedOrders] = useState({});
  const [collapsedMonths, setCollapsedMonths] = useState({});

  // Only show CLOSED orders: received regulars, quick orders, backfills, auto orders.
  // Open (submitted-but-not-yet-checked-in) regular orders live in the Orders view —
  // BUT the Orders view only shows them for 14 days, so anything older than that
  // rolls into History here (never checked in ≠ gone).
  const closed = (history || []).filter(e =>
    e.received === true || e.type === "quick" || e.type === "auto" || e.backfill === true
    || (e.received !== true && (Date.now() - new Date(e.date).getTime()) >= 14 * 86400000)
  );

  const typeOf = (e) => e.type === "quick" ? "quick" : e.type === "auto" ? "auto" : e.backfill ? "backfill" : "regular";
  const typeMeta = {
    quick:    { label:"QUICK",    icon:"bolt",    color:"#38bdf8", bg:"rgba(56,189,248,0.15)" },
    auto:     { label:"AUTO",     icon:"check",   color:"#c084fc", bg:"rgba(168,85,247,0.15)" },
    backfill: { label:"BACKFILL", icon:"history", color:"#fbbf24", bg:"rgba(251,191,36,0.15)" },
    regular:  { label:"",         icon:"orders",  color:"#94a3b8", bg:"transparent" },
  };

  // All vendors that appear in closed history
  const allVendors = [...new Set(closed.map(e => e.vendor))].sort();

  // Apply filters
  const filtered = closed.filter(e => {
    if (filterVendor !== "ALL" && e.vendor !== filterVendor) return false;
    if (filterType !== "ALL" && typeOf(e) !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const inVendor = (e.vendor || "").toLowerCase().includes(q);
      const inItems = (e.lines || []).some(l => (l.name || "").toLowerCase().includes(q));
      const inNote = (e.note || "").toLowerCase().includes(q);
      if (!inVendor && !inItems && !inNote) return false;
    }
    return true;
  });

  // Stats
  const now = new Date();
  const thisMonthCount = closed.filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const vendorCounts = {};
  closed.forEach(e => { if (typeOf(e) !== "auto") vendorCounts[e.vendor] = (vendorCounts[e.vendor] || 0) + 1; });
  const topVendor = Object.entries(vendorCounts).sort((a,b) => b[1]-a[1])[0];

  // Group filtered → month → week
  const byMonth = {};
  filtered.forEach(entry => {
    const d = new Date(entry.date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
    const monthLabel = d.toLocaleDateString("en-US", { month:"long", year:"numeric" });
    const weekKey = `${entry.year}-WK${String(entry.weekNumber).padStart(2,"0")}`;
    if (!byMonth[monthKey]) byMonth[monthKey] = { label: monthLabel, weeks: {} };
    if (!byMonth[monthKey].weeks[weekKey]) byMonth[monthKey].weeks[weekKey] = [];
    byMonth[monthKey].weeks[weekKey].push(entry);
  });
  const monthKeys = Object.keys(byMonth).sort().reverse();

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:20, fontWeight:700, margin:"0 0 4px" }}>Order History</h2>
          <p style={{ color:"#64748b", fontSize:13, margin:0 }}>{closed.length} closed order{closed.length!==1?"s":""} across all time</p>
        </div>
      </div>

      {/* Stats */}
      {closed.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:16 }}>
          <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:12, padding:"12px 16px" }}>
            <div style={{ color:"#f1f5f9", fontSize:22, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{closed.length}</div>
            <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>Total orders</div>
          </div>
          <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:12, padding:"12px 16px" }}>
            <div style={{ color:"#38bdf8", fontSize:22, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{thisMonthCount}</div>
            <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>This month</div>
          </div>
          {topVendor && (
            <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:12, padding:"12px 16px" }}>
              <div style={{ color:"#e2e8f0", fontSize:15, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{topVendor[0]}</div>
              <div style={{ color:"#64748b", fontSize:11, marginTop:2 }}>Most ordered ({topVendor[1]}×)</div>
            </div>
          )}
        </div>
      )}

      {/* Search + filters */}
      {closed.length > 0 && (
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:"1 1 200px" }}>
            <Icon name="prices" size={15} color="#475569" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor or item..."
              style={{ width:"100%", background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"9px 12px 9px 34px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
            style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"9px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer" }}>
            <option value="ALL">All vendors</option>
            {allVendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"9px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer" }}>
            <option value="ALL">All types</option>
            <option value="regular">Regular</option>
            <option value="quick">Quick orders</option>
            <option value="auto">Auto-submitted</option>
            <option value="backfill">Backfilled</option>
          </select>
        </div>
      )}

      {closed.length === 0 ? (
        <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:16, padding:48, textAlign:"center" }}>
          <Icon name="history" size={36} color="#38bdf8" style={{ marginBottom:12 }} />
          <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No closed orders yet</div>
          <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>Orders move here once you check in the delivery</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:16, padding:40, textAlign:"center" }}>
          <div style={{ color:"#94a3b8", fontSize:15, fontWeight:600 }}>No orders match your filters</div>
          <button onClick={() => { setSearch(""); setFilterVendor("ALL"); setFilterType("ALL"); }}
            style={{ marginTop:12, background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 16px", color:"#60a5fa", fontSize:13, cursor:"pointer" }}>Clear filters</button>
        </div>
      ) : (
        monthKeys.map(monthKey => {
          const month = byMonth[monthKey];
          const weekKeys = Object.keys(month.weeks).sort().reverse();
          const monthTotal = Object.values(month.weeks).reduce((sum, arr) => sum + arr.length, 0);
          const isCollapsed = collapsedMonths[monthKey];
          return (
            <div key={monthKey} style={{ marginBottom:18 }}>
              {/* Month header */}
              <button onClick={() => setCollapsedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }))}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:10, background:"transparent", border:"none", padding:"4px 0 10px", cursor:"pointer" }}>
                <Icon name="history" size={14} color="#475569" style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition:"transform 0.2s" }} />
                <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>{month.label}</span>
                <span style={{ color:"#475569", fontSize:12 }}>{monthTotal} order{monthTotal!==1?"s":""}</span>
                <div style={{ flex:1, height:1, background:"#1e2d45" }} />
              </button>

              {!isCollapsed && weekKeys.map(weekKey => {
                const orders = month.weeks[weekKey];
                const wn = parseInt(weekKey.split("-WK")[1]);
                const yr = parseInt(weekKey.split("-WK")[0]);
                const mon = getWeekMonday(wn, yr).toLocaleDateString("en-US", { month:"short", day:"numeric" });
                return (
                  <div key={weekKey} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 4px" }}>
                      <span style={{ color:"#a5b4fc", fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>WK{wn}</span>
                      <span style={{ color:"#64748b", fontSize:11 }}>Mon {mon}</span>
                      <span style={{ color:"#475569", fontSize:11 }}>· {orders.length} order{orders.length!==1?"s":""}</span>
                    </div>
                    <div style={{ border:"1px solid #1e2d45", borderRadius:12, overflow:"hidden" }}>
                      {orders.map((entry, idx) => {
                        const t = typeMeta[typeOf(entry)];
                        const isOpen = expandedOrders[entry.id];
                        return (
                          <div key={entry.id} style={{ background:idx%2===0?"#0c1220":"#0a1018", borderTop:idx>0?"1px solid #080c14":"none" }}>
                            <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                              <button onClick={() => setExpandedOrders(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                                style={{ flex:1, background:"none", border:"none", textAlign:"left", cursor:"pointer", padding:0, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                                  <Icon name={t.icon} size={15} color={t.color} />
                                  <span style={{ color:"#e2e8f0", fontSize:14, fontWeight:600 }}>{entry.vendor}</span>
                                  {t.label && <span style={{ background:t.bg, border:`1px solid ${t.color}40`, borderRadius:4, padding:"1px 6px", color:t.color, fontSize:9, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{t.label}</span>}
                                </div>
                                <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:3 }}>{entry.day} · {fmtDate(entry.date)} · {entry.totalItems} item{entry.totalItems!==1?"s":""}{entry.note ? ` · ${entry.note}` : ""}</div>
                              </button>
                              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                <button onClick={() => setExpandedOrders(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))}
                                  style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:12, padding:"4px" }}>
                                  {isOpen ? "Hide" : "View"}
                                </button>
                                <button onClick={() => printVendorPDF({ vendorName: entry.vendor, items: entry.lines, weekNum: entry.weekNumber, year: entry.year, date: fmtDate(entry.date), businessName: user.business?.name || "", orderedBy: entry.orderedBy || user.name })}
                                  style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:6, padding:"5px 10px", color:"#94a3b8", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                                  <Icon name="doc" size={13} /> PDF
                                </button>
                              </div>
                            </div>
                            {/* Expanded line items */}
                            {isOpen && (
                              <div style={{ padding:"0 16px 14px", background:"#080c14" }}>
                                <div style={{ paddingTop:12, borderTop:"1px solid #1e2d45" }}>
                                  {(entry.lines || []).length === 0 ? (
                                    <div style={{ color:"#475569", fontSize:12 }}>No line items recorded</div>
                                  ) : (
                                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                                      <tbody>
                                        {entry.lines.map((line, li) => (
                                          <tr key={li} style={{ borderBottom: li < entry.lines.length-1 ? "1px solid #0f1a2e" : "none" }}>
                                            <td style={{ padding:"6px 0", color:"#e2e8f0", fontSize:13 }}>{line.name}</td>
                                            <td style={{ padding:"6px 0", color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", textAlign:"left", width:90 }}>{line.section || ""}</td>
                                            <td style={{ padding:"6px 0", textAlign:"right", color:"#38bdf8", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace", width:110 }}>{line.qty} <span style={{ color:"#475569", fontSize:10 }}>{line.order_unit}{line.each_qty ? ` + ${line.each_qty} each` : ""}</span></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                  {entry.orderedBy && <div style={{ color:"#475569", fontSize:11, marginTop:10, fontFamily:"'DM Mono',monospace" }}>Ordered by {entry.orderedBy}</div>}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS VIEW — Manage vendors & their order days (owner only)
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsView({ vendors, saveVendors, inventory, currentPlan, isTrialing, permissions, savePermissions, userRole, user, allFeatures, autoSubmit, setAutoSubmit, foodCost, setFoodCost }) {
  const [activeTab, setActiveTab] = useState("vendors");
  const [localVendors, setLocalVendors] = useState(vendors);
  const [dirty, setDirty] = useState(false);

  // Keep the local editing copy in sync with the live vendors data (real-time
  // sync from another device, async load finishing, or a confirmed rep invite).
  // Only when there are no unsaved edits — otherwise a save here could silently
  // wipe a vendor that was added elsewhere.
  useEffect(() => { if (!dirty) setLocalVendors(vendors); }, [vendors, dirty]);

  // ── Vendor management ──────────────────────────────────────────────────
  const update = (id, field, value) => {
    setLocalVendors(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    setDirty(true);
  };

  const toggleDay = (vendorId, day) => {
    setLocalVendors(prev => prev.map(v => {
      if (v.id !== vendorId) return v;
      const days = v.orderDays || [];
      return { ...v, orderDays: days.includes(day) ? days.filter(d => d !== day) : [...days, day].sort() };
    }));
    setDirty(true);
  };

  const addVendor = () => {
    setLocalVendors(prev => [...prev, { id: Date.now(), name: "", orderDays: [] }]);
    setDirty(true);
  };

  const removeVendor = (id) => {
    setLocalVendors(prev => prev.filter(v => v.id !== id));
    setDirty(true);
  };

  const handleSave = () => {
    saveVendors(localVendors.filter(v => v.name.trim()));
    setDirty(false);
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>Settings</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Manage vendors, schedules, and team members</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {[{ key:"vendors", label:"Vendors", icon:"📦" }, { key:"team", label:"Team", icon:"👥" }].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ background:activeTab===tab.key?"#e2e8f0":"transparent", border:`1px solid ${activeTab===tab.key?"#e2e8f0":"#1e2d45"}`, borderRadius:8, padding:"7px 16px", color:activeTab===tab.key?"#080c14":"#64748b", fontSize:13, fontWeight:activeTab===tab.key?600:400, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            {tab.icon} {tab.label}
          </button>
        ))}
        <button type="button" onClick={() => setActiveTab("permissions")}
          style={{ background:"none", border:"none", color:activeTab==="permissions"?"#e2e8f0":"#475569", fontSize:12, cursor:"pointer", padding:"7px 8px" }}>
          Role permissions
        </button>
      </div>

      {/* ── VENDORS TAB ── */}
      {activeTab === "vendors" && (
        <>
          {/* Auto-submit toggle */}
          {setAutoSubmit && (
            <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:12, padding:"16px 18px", marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>Auto-submit missed orders</div>
                  <div style={{ color:"#64748b", fontSize:12, marginTop:3, lineHeight:1.5 }}>
                    If an order isn't submitted by the end of the week, MOE auto-submits it based on your typical order — so no week is ever missing from your insights.
                  </div>
                </div>
                <button onClick={() => setAutoSubmit(!autoSubmit)}
                  style={{ flexShrink:0, width:52, height:30, borderRadius:15, border:"none", cursor:"pointer", background: autoSubmit ? "#38bdf8" : "#1e2d45", position:"relative", transition:"background 0.2s" }}>
                  <span style={{ position:"absolute", top:3, left: autoSubmit ? 25 : 3, width:24, height:24, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                </button>
              </div>
            </div>
          )}
          {/* Food Cost add-on toggle */}
          {setFoodCost && (
            <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:12, padding:"16px 18px", marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
                    Food cost tracking
                    <span style={{ background:"rgba(52,211,153,0.15)", border:"1px solid rgba(52,211,153,0.3)", borderRadius:4, padding:"1px 6px", color:"#34d399", fontSize:9, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>ADD-ON</span>
                  </div>
                  <div style={{ color:"#64748b", fontSize:12, marginTop:3, lineHeight:1.5 }}>
                    Turn submitted orders into a weekly food spend total. After each order, Price Tracker shows the items you ordered with last week's price carried over — only edit what changed. Leave off and the app works exactly as before.
                  </div>
                </div>
                <button onClick={() => setFoodCost(!foodCost)}
                  style={{ flexShrink:0, width:52, height:30, borderRadius:15, border:"none", cursor:"pointer", background: foodCost ? "#34d399" : "#1e2d45", position:"relative", transition:"background 0.2s" }}>
                  <span style={{ position:"absolute", top:3, left: foodCost ? 25 : 3, width:24, height:24, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                </button>
              </div>
            </div>
          )}
          {dirty && (
            <div style={{ marginBottom:16 }}>
              <button onClick={handleSave}
                style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Save Changes
              </button>
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:16 }}>
            {localVendors.map((vendor, idx) => {
              const itemCount = flatItems(inventory).filter(i => (i.vendor||"").trim().toLowerCase() === vendor.name.toLowerCase()).length;
              return (
                <div key={vendor.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:18 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", letterSpacing:"1px", textTransform:"uppercase" }}>Vendor {idx+1}</span>
                      {vendor.name && <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>· {itemCount} items</span>}
                    </div>
                    {localVendors.length > 1 && (
                      <button onClick={() => removeVendor(vendor.id)}
                        style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:6, color:"#64748b", cursor:"pointer", fontSize:11, padding:"3px 8px" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#64748b"; }}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Vendor Name</label>
                    <input value={vendor.name} onChange={e => update(vendor.id, "name", e.target.value)} placeholder="e.g. Anacapri, Market..."
                      style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                  </div>
                  <div>
                    <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Order Days</label>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {DAYS.map((day, i) => {
                        const selected = (vendor.orderDays || []).includes(i);
                        return (
                          <button key={day} onClick={() => toggleDay(vendor.id, i)}
                            style={{ padding:"8px 14px", borderRadius:8, background:selected?"#e2e8f0":"#080c14", border:`1px solid ${selected?"#e2e8f0":"#1e2d45"}`, color:selected?"#080c14":"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                            {DAYS_SHORT[i]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={addVendor}
            style={{ background:"none", border:"1px dashed #1e2d45", borderRadius:8, color:"#475569", cursor:"pointer", fontSize:13, padding:"10px 20px", display:"flex", alignItems:"center", gap:6 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
            ＋ Add Vendor
          </button>
        </>
      )}

      {/* ── TEAM TAB ── */}
      {activeTab === "team" && (
        <div style={{ background:"#f4f1ea", color:"#1c1917", borderRadius:12, padding:16, marginBottom:16 }}>
          <TeamPanel user={user} />
        </div>
      )}

      {activeTab === "permissions" && (
        <>
          <div style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:10, padding:"12px 16px", marginBottom:20 }}>
            <span style={{ color:"#a5b4fc", fontSize:12 }}>Control what each role can access. </span>
            <span style={{ color:"#64748b", fontSize:12 }}>
              {userRole === "owner" ? "As the owner, you can set permissions for managers and employees." : "As a manager, you can set permissions for employees."}
            </span>
          </div>

          {/* Manager permissions — only owner can edit */}
          {userRole === "owner" && (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                <span style={{ background:"#422006", border:"1px solid #d97706", borderRadius:5, padding:"2px 8px", color:"#fbbf24", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>MANAGER</span>
                <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>Manager Access</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:8 }}>
                {allFeatures.map(f => {
                  const enabled = (permissions.manager || []).includes(f.key);
                  const isCore = f.key === "inventory"; // Inventory always on
                  return (
                    <button key={f.key} onClick={() => {
                      if (isCore) return;
                      const current = permissions.manager || [];
                      const updated = enabled ? current.filter(k => k !== f.key) : [...current, f.key];
                      savePermissions({ ...permissions, manager: updated });
                    }}
                      style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderRadius:8, cursor:isCore?"default":"pointer", background: enabled ? "#052e16" : "#080c14", border:`1px solid ${enabled ? "#16a34a" : "#1e2d45"}`, opacity:isCore?0.6:1 }}>
                      <span style={{ fontSize:14 }}>{f.icon}</span>
                      <span style={{ color:enabled?"#4ade80":"#475569", fontSize:12, fontWeight:enabled?600:400 }}>{f.label}</span>
                      <span style={{ marginLeft:"auto", color:enabled?"#4ade80":"#334155", fontSize:12 }}>{enabled ? "✓" : "—"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Employee permissions — owner and manager can edit */}
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:"18px 20px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
              <span style={{ background:"#0f2040", border:"1px solid #1e40af", borderRadius:5, padding:"2px 8px", color:"#a5b4fc", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>EMPLOYEE</span>
              <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>Employee Access</span>
              <span style={{ color:"#475569", fontSize:11, marginLeft:4 }}>Default: Inventory, Waste Log, History</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:8 }}>
              {allFeatures.map(f => {
                const enabled = (permissions.employee || []).includes(f.key);
                const isCore = f.key === "inventory"; // Inventory always on for employees
                // Manager can only give permissions they themselves have
                const managerCanGrant = userRole === "owner" || (permissions.manager || []).includes(f.key);
                return (
                  <button key={f.key} onClick={() => {
                    if (isCore || !managerCanGrant) return;
                    const current = permissions.employee || [];
                    const updated = enabled ? current.filter(k => k !== f.key) : [...current, f.key];
                    savePermissions({ ...permissions, employee: updated });
                  }}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", borderRadius:8, cursor:(isCore || !managerCanGrant)?"default":"pointer", background: enabled ? "#052e16" : "#080c14", border:`1px solid ${enabled ? "#16a34a" : "#1e2d45"}`, opacity:(isCore || !managerCanGrant)?0.6:1 }}>
                    <span style={{ fontSize:14 }}>{f.icon}</span>
                    <span style={{ color:enabled?"#4ade80":"#475569", fontSize:12, fontWeight:enabled?600:400 }}>{f.label}</span>
                    <span style={{ marginLeft:"auto", color:enabled?"#4ade80":"#334155", fontSize:12 }}>{enabled ? "✓" : "—"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITABLE CELL — Click to edit inline
// ═══════════════════════════════════════════════════════════════════════════════
function EditableCell({ value, onSave, type="text", width=80 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const open = () => { setEditing(true); setDraft(String(value)); };
  const commit = () => { setEditing(false); if (String(draft) !== String(value)) onSave(draft); };
  const cancel = () => { setEditing(false); setDraft(String(value)); };
  if (!editing) return (
    <div onClick={open} title="Click to edit" className="edit-cell"
      style={{ cursor:"text", color:"#e2e8f0", fontSize:12, padding:"4px 6px", borderRadius:5, border:"1px solid transparent", display:"inline-flex", alignItems:"center", gap:4, minWidth:width, transition:"all 0.12s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#0d1a2e"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="transparent"; }}>
      <span style={{ flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
        {value !== "" && value !== null && value !== undefined ? String(value) : <span style={{ color:"#475569", fontStyle:"italic" }}>—</span>}
      </span>
      <span className="edit-pencil" style={{ color:"#e2e8f0", fontSize:9, opacity:0.7, flexShrink:0, display:"none" }}>✏</span>
    </div>
  );
  return (
    <input autoFocus value={draft} type={type} min={type === "number" ? 0 : undefined}
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
      style={{ width, background:"#080c14", border:"1px solid #e2e8f0", borderRadius:5, padding:"4px 7px", color:"#f1f5f9", fontSize:12, outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" }} />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORDER UNIT SELECT
// ═══════════════════════════════════════════════════════════════════════════════
const ORDER_UNITS = ["Case","Each","Piece","Unit","Bag","Bundle","Gallon","Roll","Lbs"];
function OrderUnitSelect({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return (
    <div onClick={() => setEditing(true)}
      style={{ cursor:"pointer", color:"#e2e8f0", fontSize:12, padding:"4px 6px", borderRadius:5, border:"1px solid transparent", display:"inline-flex", alignItems:"center", gap:4, minWidth:80, transition:"all 0.12s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#0d1a2e"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="transparent"; }}>
      <span style={{ flex:1 }}>{value || "—"}</span>
      <span className="edit-pencil" style={{ color:"#e2e8f0", fontSize:9, opacity:0.7, display:"none" }}>✏</span>
    </div>
  );
  return (
    <select autoFocus value={value} onChange={e => { onSave(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}
      style={{ background:"#080c14", border:"1px solid #e2e8f0", borderRadius:5, padding:"4px 7px", color:"#f1f5f9", fontSize:12, outline:"none" }}>
      {ORDER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
    </select>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOVER ROW — Shows remove button on hover
// ═══════════════════════════════════════════════════════════════════════════════
function HoverRow({ children, bg, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const handleRemove = (e) => { e.stopPropagation(); if (confirm) { onRemove(); } else { setConfirm(true); setTimeout(() => setConfirm(false), 2500); } };
  const childArray = React.Children.toArray(children);
  const firstTd = childArray[0]; const restTds = childArray.slice(1);
  const enhancedFirstTd = React.cloneElement(firstTd, {
    children: (<div style={{ display:"flex", alignItems:"center", gap:4 }}><div style={{ flex:1 }}>{firstTd.props.children}</div>
      {hovered && <button onClick={handleRemove} title={confirm ? "Click again to confirm" : "Remove item"} style={{ background:confirm?"#7f1d1d":"transparent", border:`1px solid ${confirm?"#ef4444":"#475569"}`, borderRadius:4, color:confirm?"#fca5a5":"#64748b", cursor:"pointer", fontSize:10, padding:"2px 6px", whiteSpace:"nowrap", flexShrink:0, lineHeight:1.4 }}>{confirm ? "confirm ✕" : "✕"}</button>}
    </div>),
  });
  return (<tr style={{ background:bg, borderTop:"1px solid #0f172a" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setConfirm(false); }}>{enhancedFirstTd}{restTds}</tr>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKEND VIEW — Original table layout with click-to-edit
// ═══════════════════════════════════════════════════════════════════════════════
function BackendView({ inventory, saveInventory, vendors, stock }) {
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSection, setReorderSection] = useState(null); // which section is being reordered

  // ── Helpers that mutate inventory and persist ──
  const saveItemField = (itemId, field, rawVal) => {
    const numFields = ["upu", "max_stock", "reorder"];
    const val = numFields.includes(field) ? (parseInt(rawVal) || 0) : rawVal;
    // Duplicate guard: when naming an item, warn if a very similar name already exists
    if (field === "name" && typeof val === "string" && val.trim() && val.trim().toLowerCase() !== "new item") {
      const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const target = norm(val);
      if (target.length >= 3) {
        const dupe = flatItems(inventory).find(i => {
          if (i.id === itemId) return false;
          const other = norm(i.name);
          return other === target || (other.length >= 4 && (other.includes(target) || target.includes(other)));
        });
        if (dupe && !window.confirm(`"${dupe.name}" already exists in ${dupe.section}.\n\nAdd "${val.trim()}" anyway?`)) {
          return; // keep the old name
        }
      }
    }
    saveInventory(inventory.map(s => ({ ...s, items: s.items.map(i => i.id === itemId ? { ...i, [field]: val } : i) })));
  };

  const addItem = (sectionKey) => {
    const newItem = { id: Date.now(), name: "New Item", order_unit: "Case", upu: 1, vendor: vendors[0]?.name || "", max_stock: 1, reorder: 1 };
    saveInventory(inventory.map(s => s.section === sectionKey ? { ...s, items: [...s.items, newItem] } : s));
  };

  const removeItem = (itemId) => {
    const newInv = inventory.map(s => ({ ...s, items: s.items.filter(i => i.id !== itemId) })).filter(s => s.items.length > 0);
    saveInventory(newInv);
  };

  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const sectionExists = (name) => inventory.some(s => normName(s.section) === normName(name));
  const addSection = () => {
    if (!newSectionName.trim()) return;
    if (sectionExists(newSectionName)) { alert("A section with that name already exists."); return; }
    saveInventory([...inventory, { section: newSectionName.trim(), items: [{ id: Date.now(), name: "New Item", order_unit: "Case", upu: 1, vendor: vendors[0]?.name || "", max_stock: 1, reorder: 1 }] }]);
    setNewSectionName(""); setShowAddSection(false);
  };

  const deleteSection = (sectionKey) => saveInventory(inventory.filter(s => s.section !== sectionKey));
  const saveSectionName = (oldName, newName) => { if (!newName.trim() || newName === oldName) return; if (normName(newName) !== normName(oldName) && sectionExists(newName)) { alert("A section with that name already exists."); return; } saveInventory(inventory.map(s => s.section === oldName ? { ...s, section: newName.trim() } : s)); };

  // ── Reorder helpers ──
  const moveSection = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= inventory.length) return;
    const newInv = [...inventory];
    [newInv[idx], newInv[newIdx]] = [newInv[newIdx], newInv[idx]];
    saveInventory(newInv);
  };
  const moveItem = (sectionKey, itemIdx, dir) => {
    saveInventory(inventory.map(s => {
      if (s.section !== sectionKey) return s;
      const newIdx = itemIdx + dir;
      if (newIdx < 0 || newIdx >= s.items.length) return s;
      const items = [...s.items];
      [items[itemIdx], items[newIdx]] = [items[newIdx], items[itemIdx]];
      return { ...s, items };
    }));
  };

  return (
    <div>
      <style>{`@media (max-width: 768px) { .edit-pencil { display: none !important; } } .edit-cell:hover .edit-pencil { display: inline !important; }`}</style>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>{reorderMode ? "Reorder Sections & Items" : "Backend — Edit Item Details"}</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>{reorderMode ? "Tap arrows to rearrange · Tap a section to reorder its items" : "Click any cell to edit · Hover a row to remove it"}</p>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <button onClick={() => { setReorderMode(!reorderMode); setReorderSection(null); }}
            style={{ background:reorderMode?"#e2e8f0":"transparent", border:`1px solid ${reorderMode?"#e2e8f0":"#1e2d45"}`, borderRadius:8, color:reorderMode?"#080c14":"#94a3b8", cursor:"pointer", fontSize:13, padding:"7px 16px", fontWeight:reorderMode?600:400 }}>
            {reorderMode ? "✓ Done" : "↕ Reorder"}
          </button>
          {!reorderMode && (
            <>
              {!showAddSection ? (
                <button onClick={() => setShowAddSection(true)}
                  style={{ background:"none", border:"1px dashed #1e2d45", borderRadius:8, color:"#475569", cursor:"pointer", fontSize:13, padding:"7px 16px", display:"flex", alignItems:"center", gap:6 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
                  ＋ Add Section
                </button>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <input autoFocus value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Section name..."
                    onKeyDown={e => { if (e.key === "Enter") addSection(); if (e.key === "Escape") { setShowAddSection(false); setNewSectionName(""); } }}
                    style={{ background:"#0f1a2e", border:"1px solid #e2e8f0", borderRadius:7, padding:"7px 12px", color:"#f1f5f9", fontSize:13, outline:"none", width:180 }} />
                  <button onClick={addSection} style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:7, padding:"7px 14px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>Add</button>
                  <button onClick={() => { setShowAddSection(false); setNewSectionName(""); }} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:7, padding:"7px 10px", color:"#64748b", fontSize:13, cursor:"pointer" }}>Cancel</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── REORDER MODE ── */}
      {reorderMode && (
        <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
          {/* Sections list */}
          <div style={{ flex:"1 1 280px", minWidth:280 }}>
            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Sections</div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {inventory.map((sec, idx) => (
                <div key={sec.section} onClick={() => setReorderSection(sec.section)}
                  style={{ background: reorderSection === sec.section ? "#1e2d45" : "#0f1a2e", border:`1px solid ${reorderSection === sec.section ? "#e2e8f0" : "#1e2d45"}`, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", transition:"all 0.15s" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    <button onClick={(e) => { e.stopPropagation(); moveSection(idx, -1); }} disabled={idx===0}
                      style={{ background:"none", border:"none", color:idx===0?"#1e2d45":"#64748b", cursor:idx===0?"default":"pointer", fontSize:12, padding:0, lineHeight:1 }}>▲</button>
                    <button onClick={(e) => { e.stopPropagation(); moveSection(idx, 1); }} disabled={idx===inventory.length-1}
                      style={{ background:"none", border:"none", color:idx===inventory.length-1?"#1e2d45":"#64748b", cursor:idx===inventory.length-1?"default":"pointer", fontSize:12, padding:0, lineHeight:1 }}>▼</button>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:600 }}>{sec.section.replace(/[^\w\s\-&]/g,"").trim()}</div>
                    <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{sec.items.length} items</div>
                  </div>
                  <span style={{ color:"#334155", fontSize:14 }}>›</span>
                </div>
              ))}
            </div>
          </div>

          {/* Items in selected section */}
          {reorderSection && (
            <div style={{ flex:"1 1 320px", minWidth:320 }}>
              <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>
                Items in {inventory.find(s => s.section === reorderSection)?.section.replace(/[^\w\s\-&]/g,"").trim()}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                {(inventory.find(s => s.section === reorderSection)?.items || []).map((item, idx, arr) => (
                  <div key={item.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      <button onClick={() => moveItem(reorderSection, idx, -1)} disabled={idx===0}
                        style={{ background:"none", border:"none", color:idx===0?"#1e2d45":"#64748b", cursor:idx===0?"default":"pointer", fontSize:11, padding:0, lineHeight:1 }}>▲</button>
                      <button onClick={() => moveItem(reorderSection, idx, 1)} disabled={idx===arr.length-1}
                        style={{ background:"none", border:"none", color:idx===arr.length-1?"#1e2d45":"#64748b", cursor:idx===arr.length-1?"default":"pointer", fontSize:11, padding:0, lineHeight:1 }}>▼</button>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ color:"#f1f5f9", fontSize:12, fontWeight:500 }}>{item.name}</div>
                      <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>{item.order_unit}{item.vendor ? ` · ${item.vendor}` : ""}</div>
                    </div>
                    <span style={{ color:"#334155", fontSize:11, fontFamily:"'DM Mono',monospace" }}>#{idx+1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── NORMAL TABLE MODE ── */}
      {!reorderMode && inventory.map((section, sIdx) => (
        <BackendSection key={section.section} section={section} stock={stock} vendors={vendors}
          saveItemField={saveItemField} addItem={addItem} removeItem={removeItem}
          saveSectionName={saveSectionName} deleteSection={deleteSection} />
      ))}
    </div>
  );
}

// ── Section inside BackendView ────────────────────────────────────────────────
function BackendSection({ section, stock, vendors, saveItemField, addItem, removeItem, saveSectionName, deleteSection }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.section);
  const [confirmDel, setConfirmDel] = useState(false);
  const commitRename = () => { saveSectionName(section.section, draft); setEditing(false); };

  return (
    <div style={{ marginBottom:12 }}>
      {/* Section header */}
      <div style={{ background:"#080c14", padding:"6px 16px", borderRadius:"10px 10px 0 0", border:"1px solid #1e2d45", borderBottom:"none", display:"flex", alignItems:"center", gap:8 }}>
        {editing ? (
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={commitRename} onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setEditing(false); setDraft(section.section); } }}
            style={{ background:"transparent", border:"none", borderBottom:"1px solid #e2e8f0", color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", outline:"none", width:220, padding:"2px 0" }} />
        ) : (
          <span style={{ color:"#e2e8f0", fontSize:11, fontWeight:700, letterSpacing:"1px", textTransform:"uppercase", fontFamily:"'DM Mono',monospace", flex:1 }}>{section.section}</span>
        )}
        {!editing && <>
          <button onClick={() => { setDraft(section.section); setEditing(true); }} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:11, padding:"2px 6px", borderRadius:4 }} onMouseEnter={e => e.currentTarget.style.color="#e2e8f0"} onMouseLeave={e => e.currentTarget.style.color="#475569"}>✏ rename</button>
          <button onClick={() => { if (confirmDel) deleteSection(section.section); else { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 2500); } }}
            style={{ background:confirmDel?"#7f1d1d":"none", border:`1px solid ${confirmDel?"#ef4444":"transparent"}`, color:confirmDel?"#fca5a5":"#475569", cursor:"pointer", fontSize:11, padding:"2px 8px", borderRadius:4, lineHeight:1.4 }}
            onMouseEnter={e => { if (!confirmDel) { e.currentTarget.style.color="#ef4444"; e.currentTarget.style.borderColor="#ef4444"; } }}
            onMouseLeave={e => { if (!confirmDel) { e.currentTarget.style.color="#475569"; e.currentTarget.style.borderColor="transparent"; } }}>
            {confirmDel ? "confirm ✕" : "✕ delete"}
          </button>
        </>}
      </div>

      {/* Table */}
      <div style={{ overflowX:"auto", overflowY:"auto", maxHeight:400, position:"relative", borderRadius:"0 0 12px 12px", border:"1px solid #1e2d45", borderTop:"none" }}>
        <table style={{ minWidth:950, borderCollapse:"separate", borderSpacing:0, background:"#0f1a2e" }}>
          <thead>
            <tr style={{ background:"#080c14" }}>
              {[
                ["Item Name","left",180,true], ["Vendor","left",100,false], ["Order Unit","left",90,false],
                ["Units/Pkg","center",65,false], ["Max Stock","center",75,false], ["Reorder Pt","center",75,false],
                ["Current","center",70,false], ["Needed","center",70,false], ["Order Qty","center",70,false], ["Status","center",80,false],
              ].map(([h, align, w, stickyLeft]) => (
                <th key={h} style={{ position:"sticky", top:0, left:stickyLeft?0:undefined, zIndex:stickyLeft?4:2, background:"#080c14", color:"#e2e8f0", fontSize:10, fontWeight:600, padding:"8px 8px", textAlign:align, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase", whiteSpace:"nowrap", minWidth:w, width:w, boxShadow:stickyLeft?"3px 0 6px rgba(0,0,0,0.5)":undefined, borderBottom:"1px solid #1e2d45" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.items.map((item, idx) => {
              const s = stock[item.id] ?? 0;
              const needed = Math.max(0, item.max_stock - s);
              const orderQty = calcOrderQty(item, s);
              const status = getStatus(item, s);
              const rowBg = idx % 2 === 0 ? "#0f1a2e" : "#0a1220";
              return (
                <HoverRow key={item.id} bg={rowBg} onRemove={() => removeItem(item.id)}>
                  <td style={{ padding:"5px 8px", position:"sticky", left:0, zIndex:3, background:rowBg, boxShadow:"3px 0 6px rgba(0,0,0,0.5)", minWidth:180, width:180 }}>
                    <EditableCell value={item.name} onSave={v => saveItemField(item.id, "name", v)} width={155} />
                  </td>
                  <td style={{ padding:"5px 8px" }}>
                    <select value={item.vendor || ""} onChange={e => saveItemField(item.id, "vendor", e.target.value)}
                      style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"4px 6px", color:"#f1f5f9", fontSize:11, outline:"none", cursor:"pointer", width:"100%" }}>
                      <option value="">—</option>
                      {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding:"5px 8px" }}><OrderUnitSelect value={item.order_unit} onSave={v => saveItemField(item.id, "order_unit", v)} /></td>
                  <td style={{ padding:"5px 8px", textAlign:"center" }}><EditableCell value={item.upu} onSave={v => saveItemField(item.id, "upu", v)} type="number" width={50} /></td>
                  <td style={{ padding:"5px 8px", textAlign:"center" }}><EditableCell value={item.max_stock} onSave={v => saveItemField(item.id, "max_stock", v)} type="number" width={55} /></td>
                  <td style={{ padding:"5px 8px", textAlign:"center" }}><EditableCell value={item.reorder} onSave={v => saveItemField(item.id, "reorder", v)} type="number" width={55} /></td>
                  <td style={{ padding:"5px 10px", textAlign:"center" }}><span style={{ color:"#4ade80", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:700 }}>{s}</span></td>
                  <td style={{ padding:"5px 10px", textAlign:"center" }}><span style={{ color:"#94a3b8", fontFamily:"'DM Mono',monospace", fontSize:12 }}>{needed}</span></td>
                  <td style={{ padding:"5px 10px", textAlign:"center" }}>{orderQty > 0 ? <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:5, padding:"2px 8px", fontSize:12, fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{orderQty}</span> : <span style={{ color:"#1e2d45", fontSize:12 }}>0</span>}</td>
                  <td style={{ padding:"5px 10px", textAlign:"center" }}><span style={{ background:status.bg, color:status.color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{status.label}</span></td>
                </HoverRow>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={10} style={{ padding:"6px 10px", borderTop:"1px solid #0f172a" }}>
                <button onClick={() => addItem(section.section)}
                  style={{ background:"none", border:"1px dashed #1e2d45", borderRadius:6, color:"#475569", cursor:"pointer", fontSize:12, padding:"5px 14px", display:"flex", alignItems:"center", gap:6 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.color="#e2e8f0"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#475569"; }}>
                  <span style={{ fontSize:14, lineHeight:1 }}>＋</span> Add Item
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING PAGE — Shown when trial expired, must pick a plan
// ═══════════════════════════════════════════════════════════════════════════════
function PricingPage({ subscription, user, onLogout }) {
  const [selected, setSelected] = useState("pro");
  const trialExpired = !!subscription && subscription.status !== "active";
  const isOwner = user?.role === "owner";

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ maxWidth:960, margin:"0 auto", padding:"40px 20px" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:40 }}>
          <div>
            <MoeLogo size="md" />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ color:"#64748b", fontSize:13 }}>{user?.name}</span>
            <button onClick={onLogout} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:6, color:"#64748b", padding:"5px 12px", cursor:"pointer", fontSize:12 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#ef4444"; e.currentTarget.style.color="#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="#1e2d45"; e.currentTarget.style.color="#64748b"; }}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Trial expired banner */}
        {trialExpired && (
          <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:12, padding:"16px 20px", marginBottom:32, textAlign:"center" }}>
            <div style={{ color:"#fca5a5", fontSize:16, fontWeight:700, marginBottom:4 }}>Your free trial has ended</div>
            <div style={{ color:"#f87171", fontSize:13 }}>{isOwner ? "Your data is saved. Pick a plan and we'll switch your kitchen back on." : `Ask the owner of ${user?.business?.name || "this kitchen"} to renew MOE. Your data is saved.`}</div>
          </div>
        )}

        {/* Title */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <h1 style={{ color:"#f1f5f9", fontSize:28, fontWeight:800, margin:"0 0 8px" }}>Choose Your Plan</h1>
          <p style={{ color:"#64748b", fontSize:15, margin:0 }}>Simple pricing for kitchens of every size. Cancel anytime.</p>
        </div>

        {/* Plan cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16, marginBottom:40 }}>
          {Object.entries(PLANS).map(([key, plan]) => {
            const isSelected = selected === key;
            const isPro = key === "pro";
            return (
              <div key={key} onClick={() => setSelected(key)}
                style={{ background:"#0f1a2e", border:`2px solid ${isSelected ? "#e2e8f0" : isPro ? "#1e2d45" : "#1e2d45"}`, borderRadius:16, padding:"28px 24px", cursor:"pointer", position:"relative", transition:"all 0.2s" }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "#475569"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = isPro ? "#1e2d45" : "#1e2d45"; }}>

                {isPro && (
                  <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:"#e2e8f0", color:"#080c14", borderRadius:20, padding:"3px 14px", fontSize:11, fontWeight:700, letterSpacing:"0.5px" }}>
                    MOST POPULAR
                  </div>
                )}

                <div style={{ color:"#94a3b8", fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1px", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>{plan.name}</div>
                <div style={{ color:"#f1f5f9", fontSize:36, fontWeight:800, marginBottom:4 }}>
                  ${plan.price}<span style={{ fontSize:15, fontWeight:400, color:"#64748b" }}>/mo</span>
                </div>
                <div style={{ color:"#475569", fontSize:13, marginBottom:20 }}>{plan.label}</div>

                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <PlanFeature label={plan.vendors === Infinity ? "Unlimited vendors" : `${plan.vendors} vendors`} included />
                  <PlanFeature label={plan.items === Infinity ? "Unlimited items" : `${plan.items} items`} included />
                  <PlanFeature label={plan.users === Infinity ? "Unlimited users" : `${plan.users} user${plan.users !== 1 ? "s" : ""}`} included />
                  <PlanFeature label="Inventory tracking" included />
                  <PlanFeature label="Order submission & history" included />
                  <PlanFeature label="PDF export" included />
                  <PlanFeature label="Insights & par suggestions" included={key !== "starter"} />
                  <PlanFeature label="Priority support" included={key === "enterprise"} />
                  <PlanFeature label="Custom onboarding" included={key === "enterprise"} />
                </div>

                <button onClick={(e) => { e.stopPropagation(); setSelected(key); }}
                  style={{ width:"100%", marginTop:24, padding:"12px", borderRadius:10, border: isSelected ? "none" : "1px solid #1e2d45", background: isSelected ? "linear-gradient(135deg,#e2e8f0,#94a3b8)" : "transparent", color: isSelected ? "#080c14" : "#94a3b8", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  {isSelected ? "Selected" : "Select Plan"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Subscribe button */}
        <div style={{ textAlign:"center" }}>
          {isOwner && (
            <a href={subscribeHref(user, PLANS[selected].name)}
              style={{ display:"inline-block", background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:12, padding:"16px 48px", color:"#fff", fontSize:17, fontWeight:700, cursor:"pointer", letterSpacing:"0.5px", textDecoration:"none" }}>
              Subscribe to {PLANS[selected].name} — ${PLANS[selected].price}/mo
            </a>
          )}
          <p style={{ color:"#475569", fontSize:12, marginTop:12 }}>Opens an email to {SUPPORT_EMAIL}. We'll send a secure payment link and activate your kitchen the same day.</p>
        </div>
      </div>
    </div>
  );
}

function PlanFeature({ label, included }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ color: included ? "#4ade80" : "#334155", fontSize:14, flexShrink:0 }}>{included ? "✓" : "—"}</span>
      <span style={{ color: included ? "#94a3b8" : "#334155", fontSize:13 }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION VIEW — Manage plan from inside the app (owner sidebar)
// ═══════════════════════════════════════════════════════════════════════════════
function SubscriptionView({ subscription, user, trialDaysLeft, isTrialing, isActive }) {
  const currentPlanKey = subscription?.plan || "pro";
  const currentPlan = PLANS[currentPlanKey];
  const trialStartDate = subscription?.trialStart ? new Date(subscription.trialStart) : null;
  const trialEndDate = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const trialProgress = trialStartDate && trialEndDate ? Math.max(0, Math.min(100, ((new Date() - trialStartDate) / (trialEndDate - trialStartDate)) * 100)) : 0;

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>💳 Subscription</h2>
        <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Manage your plan and billing</p>
      </div>

      {/* Trial countdown card */}
      {isTrialing && (
        <div style={{ background:"#422006", border:"1px solid #d97706", borderRadius:12, padding:"20px 24px", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
            <div style={{ color:"#fbbf24", fontSize:16, fontWeight:700 }}>Free Trial — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining</div>
            <span style={{ color:"#92400e", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
              {trialStartDate?.toLocaleDateString("en-US", { month:"short", day:"numeric" })} → {trialEndDate?.toLocaleDateString("en-US", { month:"short", day:"numeric" })}
            </span>
          </div>
          <div style={{ background:"#78350f", borderRadius:6, height:8, overflow:"hidden", marginBottom:10 }}>
            <div style={{ width:`${trialProgress}%`, height:"100%", background:"linear-gradient(90deg,#fbbf24,#f59e0b)", borderRadius:6, transition:"width 0.5s" }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ color:"#92400e", fontSize:12 }}>{Math.round(trialProgress)}% elapsed</span>
            <span style={{ color:"#fbbf24", fontSize:12, fontWeight:600 }}>Pro features included during trial</span>
          </div>
        </div>
      )}

      {/* Current plan status */}
      <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:"20px 24px", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <span style={{ color:"#f1f5f9", fontSize:20, fontWeight:700 }}>{currentPlan.name}</span>
              {isTrialing && (
                <span style={{ background:"#422006", border:"1px solid #d97706", borderRadius:6, padding:"3px 10px", color:"#fbbf24", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
                  TRIAL — {trialDaysLeft}d left
                </span>
              )}
              {isActive && (
                <span style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:6, padding:"3px 10px", color:"#4ade80", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
                  ACTIVE
                </span>
              )}
            </div>
            <div style={{ color:"#475569", fontSize:13 }}>{currentPlan.label}</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"#f1f5f9", fontSize:28, fontWeight:800 }}>{isTrialing ? "FREE" : `$${currentPlan.price}`}<span style={{ fontSize:14, fontWeight:400, color:"#64748b" }}>{isTrialing ? "" : "/mo"}</span></div>
            {isTrialing && <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>${currentPlan.price}/mo after trial</div>}
          </div>
        </div>

        {/* Current plan limits */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginTop:16, paddingTop:16, borderTop:"1px solid #1e2d45" }}>
          {[
            { label:"Vendors", value: currentPlan.vendors === Infinity ? "Unlimited" : currentPlan.vendors, color:"#a5b4fc" },
            { label:"Items", value: currentPlan.items === Infinity ? "Unlimited" : currentPlan.items, color:"#4ade80" },
            { label:"Users", value: currentPlan.users === Infinity ? "Unlimited" : currentPlan.users, color:"#fbbf24" },
          ].map(l => (
            <div key={l.label} style={{ background:"#080c14", borderRadius:8, padding:"10px 14px" }}>
              <div style={{ color:l.color, fontSize:18, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{l.value}</div>
              <div style={{ color:"#475569", fontSize:11, marginTop:2 }}>{l.label}</div>
            </div>
          ))}
        </div>

        {subscription?.subscribedAt && (
          <div style={{ marginTop:12, color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
            Subscribed: {new Date(subscription.subscribedAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Change plan */}
      <h3 style={{ color:"#94a3b8", fontSize:14, fontWeight:600, margin:"0 0 12px" }}>{isActive ? "Change Plan" : "Upgrade Plan"}</h3>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12 }}>
        {Object.entries(PLANS).map(([key, plan]) => {
          const isCurrent = key === currentPlanKey;
          return (
            <div key={key} style={{ background:"#0f1a2e", border:`1px solid ${isCurrent ? "#e2e8f0" : "#1e2d45"}`, borderRadius:12, padding:"18px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div>
                  <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>{plan.name}</span>
                  {isCurrent && <span style={{ color:"#475569", fontSize:11, marginLeft:8 }}>(current)</span>}
                </div>
                <span style={{ color:"#f1f5f9", fontSize:18, fontWeight:700 }}>${plan.price}<span style={{ fontSize:12, fontWeight:400, color:"#64748b" }}>/mo</span></span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                <span style={{ color:"#94a3b8", fontSize:12 }}>✓ {plan.vendors === Infinity ? "Unlimited" : plan.vendors} vendors · {plan.items === Infinity ? "Unlimited" : plan.items} items · {plan.users === Infinity ? "Unlimited" : plan.users} users</span>
                {key !== "starter" && <span style={{ color:"#94a3b8", fontSize:12 }}>✓ Insights & par suggestions</span>}
                {key === "enterprise" && <span style={{ color:"#94a3b8", fontSize:12 }}>✓ Priority support & onboarding</span>}
              </div>
              {isCurrent ? (
                <div style={{ padding:"8px", textAlign:"center", color:"#475569", fontSize:12, border:"1px solid #1e2d45", borderRadius:8 }}>Current Plan</div>
              ) : (
                <a href={subscribeHref(user, plan.name)}
                  style={{ display:"block", textAlign:"center", textDecoration:"none", width:"100%", padding:"8px", borderRadius:8, border:"none", background: key === "enterprise" ? "linear-gradient(135deg,#e2e8f0,#94a3b8)" : "linear-gradient(135deg,#22c55e,#16a34a)", color: key === "enterprise" ? "#080c14" : "#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxSizing:"border-box" }}>
                  {isActive ? `Switch to ${plan.name}` : `Subscribe — $${plan.price}/mo`}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:24, background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"12px 16px" }}>
        <span style={{ color:"#475569", fontSize:12 }}>Billing questions or plan changes: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color:"#38bdf8" }}>{SUPPORT_EMAIL}</a>. We send a secure payment link and switch your plan the same day.</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT VIEW — Upload CSV/Excel or invoice photo to populate inventory
// ═══════════════════════════════════════════════════════════════════════════════
function ImportView({ inventory, saveInventory, vendors }) {
  const [mode, setMode] = useState(null); // "file" | "photo"
  const [parsing, setParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState([]);
  const [parseError, setParseError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [imported, setImported] = useState(false);
  const [targetSection, setTargetSection] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const fileRef = React.useRef(null);
  const photoRef = React.useRef(null);

  const sections = inventory.map(s => s.section);

  // ── Parse CSV / TSV text into items ──────────────────────────────────────
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];
    const headerLine = lines[0].toLowerCase();
    const sep = headerLine.includes("\t") ? "\t" : ",";
    const headers = headerLine.split(sep).map(h => h.trim().replace(/"/g, ""));

    // Map column names to fields
    const colMap = {};
    headers.forEach((h, i) => {
      if (h.match(/item|name|product|description/i)) colMap.name = i;
      if (h.match(/unit|order.?unit|pkg/i)) colMap.order_unit = i;
      if (h.match(/upu|units.?per|per.?pkg|pack/i)) colMap.upu = i;
      if (h.match(/vendor|supplier/i)) colMap.vendor = i;
      if (h.match(/max|par|max.?stock/i)) colMap.max_stock = i;
      if (h.match(/reorder|min|reorder.?point/i)) colMap.reorder = i;
      if (h.match(/section|category|location|area/i)) colMap.section = i;
    });

    if (colMap.name === undefined) {
      // No header match — treat first column as name
      colMap.name = 0;
      // Try the rest positionally
      if (headers.length > 1) colMap.order_unit = 1;
      if (headers.length > 2) colMap.vendor = 2;
      if (headers.length > 3) colMap.max_stock = 3;
      if (headers.length > 4) colMap.reorder = 4;
    }

    return lines.slice(1).map((line, idx) => {
      const cols = splitDelimited(line, sep);
      const name = cols[colMap.name] || "";
      if (!name) return null;
      return {
        id: Date.now() + idx,
        name,
        order_unit: cols[colMap.order_unit] || "Case",
        upu: Math.max(1, intOr(cols[colMap.upu], 1)),
        vendor: cols[colMap.vendor] || "",
        max_stock: intOr(cols[colMap.max_stock], 10),
        reorder: intOr(cols[colMap.reorder], 2),
        _section: cols[colMap.section] || "",
      };
    }).filter(Boolean);
  };

  // ── Handle file upload (CSV, TSV, TXT) ──────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(""); setParsedItems([]); setImported(false);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const items = parseCSV(text);
        if (items.length === 0) { setParseError("No items found. Make sure your file has a header row with at least an item name column."); }
        else { setParsedItems(items); }
      } catch (err) { setParseError("Failed to parse file: " + err.message); }
      setParsing(false);
    };
    reader.onerror = () => { setParseError("Failed to read file."); setParsing(false); };
    reader.readAsText(file);
  };

  // ── Handle photo upload — use Claude API to extract items ───────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(""); setParsedItems([]); setImported(false);
    setParsing(true);

    // Show preview
    const url = URL.createObjectURL(file);
    setPreviewImage(url);

    try {
      // Convert to base64
      const base64 = await compressImage(file);

      const mediaType = "image/jpeg"; // compressImage always returns JPEG (PDFs are rendered to JPEG first)

      // Call Claude API to extract items from the invoice/photo
      const response = await callClaude({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: `Extract ALL inventory items from this image (invoice, order sheet, or inventory list). Return ONLY a JSON array with no other text, no markdown backticks. Each object should have these fields:
- "name": item name (string)
- "order_unit": unit of measurement like Case, Each, Bag, Lbs, Unit, Bundle, Roll, Gallon (string, default "Case")
- "vendor": vendor/supplier name if visible (string, default "")
- "max_stock": suggested max stock quantity (number, default 10)
- "reorder": suggested reorder point (number, default 2)
- "upu": units per package (number, default 1)
- "section": category like Produce, Dairy, Frozen, Dry Goods, etc. if you can determine it (string, default "")

Be thorough — extract every single item you can see. If quantities are shown, use them for max_stock. Return ONLY the JSON array.` }
            ]
          }]
        });

      const data = await response.json();
      const text = (data.content || []).map(c => c.text || "").join("");
      const clean = text.replace(/```json|```/g, "").trim();
      const items = JSON.parse(clean);

      if (Array.isArray(items) && items.length > 0) {
        setParsedItems(items.map((item, idx) => ({
          id: Date.now() + idx,
          name: item.name || "Unknown Item",
          order_unit: item.order_unit || "Case",
          upu: parseInt(item.upu) || 1,
          vendor: item.vendor || "",
          max_stock: intOr(item.max_stock, 10),
          reorder: intOr(item.reorder, 2),
          _section: item.section || "",
        })));
      } else {
        setParseError("No items could be extracted from this image. Try a clearer photo.");
      }
    } catch (err) {
      setParseError("Failed to process image: " + err.message);
    }
    setParsing(false);
  };

  // ── Edit a parsed item ──────────────────────────────────────────────────
  const updateParsedItem = (idx, field, value) => {
    setParsedItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };
  const removeParsedItem = (idx) => {
    setParsedItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Import parsed items into inventory ──────────────────────────────────
  const handleImport = () => {
    if (parsedItems.length === 0) return;

    // Copy sections and their item lists so the current inventory (and the
    // demo defaults) are never mutated in place.
    const newInv = inventory.map(sec => ({ ...sec, items: [...(sec.items || [])] }));

    parsedItems.forEach(item => {
      // Determine which section
      const sec = item._section || targetSection || (newSectionName.trim() || "📦  Imported Items");
      const cleanItem = {
        id: item.id, name: item.name, order_unit: item.order_unit,
        upu: Math.max(1, intOr(item.upu, 1)), vendor: item.vendor || "",
        max_stock: intOr(item.max_stock, 10), reorder: intOr(item.reorder, 2),
      };

      const existing = newInv.find(s => s.section === sec);
      if (existing) {
        // Skip duplicates by name
        if (!existing.items.some(i => i.name.toLowerCase() === cleanItem.name.toLowerCase())) {
          existing.items.push(cleanItem);
        }
      } else {
        newInv.push({ section: sec, items: [cleanItem] });
      }
    });

    saveInventory(newInv);
    setImported(true);
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const reset = () => {
    setMode(null); setParsedItems([]); setParseError(""); setPreviewImage(null);
    setImported(false); setTargetSection(""); setNewSectionName("");
    if (fileRef.current) fileRef.current.value = "";
    if (photoRef.current) photoRef.current.value = "";
  };

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>📤 Import Items</h2>
        <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Upload an inventory list or take a photo of an invoice to add items to your backend</p>
      </div>

      {/* Success state */}
      {imported && (
        <div style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:12, padding:32, textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
          <div style={{ color:"#4ade80", fontSize:18, fontWeight:700, marginBottom:6 }}>{parsedItems.length} items imported</div>
          <div style={{ color:"#22c55e", fontSize:13, marginBottom:16 }}>Items have been added to your inventory. Go to Backend to review and edit.</div>
          <button onClick={reset} style={{ background:"transparent", border:"1px solid #16a34a", borderRadius:8, padding:"8px 20px", color:"#4ade80", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            Import More
          </button>
        </div>
      )}

      {/* Method selection */}
      {!mode && !imported && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:24 }}>
          <button onClick={() => setMode("file")}
            style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"40px 24px", cursor:"pointer", textAlign:"center", transition:"all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d45"; }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
            <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:700, marginBottom:6 }}>Upload a File</div>
            <div style={{ color:"#475569", fontSize:12 }}>CSV, TSV, or TXT with item names, units, vendors, quantities</div>
          </button>
          <button onClick={() => setMode("photo")}
            style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"40px 24px", cursor:"pointer", textAlign:"center", transition:"all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d45"; }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📸</div>
            <div style={{ color:"#f1f5f9", fontSize:16, fontWeight:700, marginBottom:6 }}>Photo or PDF of Invoice</div>
            <div style={{ color:"#475569", fontSize:12 }}>Take a photo or upload an image — AI will extract the items</div>
          </button>
        </div>
      )}

      {/* File upload */}
      {mode === "file" && !imported && parsedItems.length === 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={reset} style={{ background:"none", border:"1px solid #1e2d45", borderRadius:6, color:"#94a3b8", padding:"4px 10px", cursor:"pointer", fontSize:12 }}>← Back</button>
            <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:600 }}>Upload Inventory File</span>
          </div>
          <div style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"40px 24px", textAlign:"center" }}>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} style={{ display:"none" }} />
            <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
            <button onClick={() => fileRef.current?.click()}
              style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:"10px 24px", color:"#080c14", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
              Choose File
            </button>
            <div style={{ color:"#475569", fontSize:12 }}>Accepts CSV, TSV, or TXT files</div>
          </div>
          {parsing && <div style={{ textAlign:"center", color:"#a5b4fc", marginTop:16 }}>Parsing file...</div>}
          {parseError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginTop:16 }}>{parseError}</div>}

          {/* Format guide */}
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"14px 16px", marginTop:16 }}>
            <div style={{ color:"#94a3b8", fontSize:12, fontWeight:600, marginBottom:8 }}>Expected Format</div>
            <div style={{ background:"#080c14", borderRadius:6, padding:"10px 12px", fontFamily:"'DM Mono',monospace", fontSize:11, color:"#64748b", overflowX:"auto", whiteSpace:"pre" }}>
{`Name, Order Unit, Vendor, Max Stock, Reorder, Section
Flour, Unit, Anacapri, 17, 4, Dry Goods
Mozzarella, Case, Anacapri, 10, 3, Dairy
French Fries, Case, , 12, 3, Freezer`}
            </div>
            <div style={{ color:"#475569", fontSize:11, marginTop:8 }}>Only the Name column is required. Other columns are optional — MOE will auto-detect headers.</div>
          </div>
        </div>
      )}

      {/* Photo upload */}
      {mode === "photo" && !imported && parsedItems.length === 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <button onClick={reset} style={{ background:"none", border:"1px solid #1e2d45", borderRadius:6, color:"#94a3b8", padding:"4px 10px", cursor:"pointer", fontSize:12 }}>← Back</button>
            <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:600 }}>Photo or PDF of Invoice / Order Sheet</span>
          </div>
          <div style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"40px 24px", textAlign:"center" }}>
            <input ref={photoRef} type="file" accept="image/*,application/pdf" onChange={handlePhotoUpload} style={{ display:"none" }} />
            <div style={{ fontSize:36, marginBottom:12 }}>📸</div>
            <button onClick={() => photoRef.current?.click()}
              style={{ background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:8, padding:"10px 24px", color:"#080c14", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
              Take Photo or Upload Image
            </button>
            <div style={{ color:"#475569", fontSize:12 }}>JPG, PNG, HEIC — invoices, order sheets, inventory lists</div>
          </div>
          {parsing && (
            <div style={{ textAlign:"center", marginTop:20 }}>
              <div style={{ color:"#a5b4fc", fontSize:14, fontWeight:600, marginBottom:8 }}>Analyzing image with AI...</div>
              <div style={{ color:"#475569", fontSize:12 }}>Extracting item names, quantities, and vendors</div>
            </div>
          )}
          {previewImage && !parsing && parsedItems.length === 0 && (
            <div style={{ marginTop:16, textAlign:"center" }}>
              <img src={previewImage} alt="Preview" style={{ maxWidth:"100%", maxHeight:300, borderRadius:10, border:"1px solid #1e2d45" }} />
            </div>
          )}
          {parseError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginTop:16 }}>{parseError}</div>}
        </div>
      )}

      {/* Preview & edit parsed items */}
      {parsedItems.length > 0 && !imported && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>{parsedItems.length} items found</div>
              <div style={{ color:"#475569", fontSize:12, marginTop:2 }}>Review, edit, or remove items before importing</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={reset} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 16px", color:"#94a3b8", fontSize:13, cursor:"pointer" }}>Cancel</button>
              <button onClick={handleImport} style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Import {parsedItems.length} Items
              </button>
            </div>
          </div>

          {/* Target section picker */}
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Import to Section</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
              <select value={targetSection} onChange={e => setTargetSection(e.target.value)}
                style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer", flex:1, minWidth:180 }}>
                <option value="">Auto-detect from data</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
                <option value="__new__">+ New section...</option>
              </select>
              {targetSection === "__new__" && (
                <input value={newSectionName} onChange={e => setNewSectionName(e.target.value)} placeholder="Section name..."
                  style={{ background:"#080c14", border:"1px solid #e2e8f0", borderRadius:7, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", flex:1, minWidth:160 }} />
              )}
            </div>
            <div style={{ color:"#475569", fontSize:11, marginTop:6 }}>Items with a detected section will use that. Others go to the section selected here.</div>
          </div>

          {/* Items table */}
          <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 80px 80px 36px", background:"#080c14", padding:"8px 12px", gap:6 }}>
              {["Item Name", "Vendor", "Unit", "Max", "Reorder", ""].map(h => (
                <span key={h} style={{ color:"#475569", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{h}</span>
              ))}
            </div>
            <div style={{ maxHeight:400, overflowY:"auto" }}>
              {parsedItems.map((item, idx) => (
                <div key={item.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 80px 80px 36px", padding:"8px 12px", gap:6, alignItems:"center", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:"1px solid #080c14" }}>
                  <input value={item.name} onChange={e => updateParsedItem(idx, "name", e.target.value)}
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 8px", color:"#f1f5f9", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box" }} />
                  <input value={item.vendor} onChange={e => updateParsedItem(idx, "vendor", e.target.value)} placeholder="—"
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 8px", color:"#f1f5f9", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box" }} />
                  <select value={item.order_unit} onChange={e => updateParsedItem(idx, "order_unit", e.target.value)}
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 6px", color:"#f1f5f9", fontSize:11, outline:"none", cursor:"pointer" }}>
                    {["Case","Each","Piece","Unit","Bag","Bundle","Gallon","Roll","Lbs"].map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input type="number" value={item.max_stock} onChange={e => updateParsedItem(idx, "max_stock", parseInt(e.target.value)||0)} min={0}
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 6px", color:"#f1f5f9", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center" }} />
                  <input type="number" value={item.reorder} onChange={e => updateParsedItem(idx, "reorder", parseInt(e.target.value)||0)} min={0}
                    style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:5, padding:"5px 6px", color:"#f1f5f9", fontSize:12, outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center" }} />
                  <button onClick={() => removeParsedItem(idx)}
                    style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:14 }}
                    onMouseEnter={e => e.currentTarget.style.color="#ef4444"}
                    onMouseLeave={e => e.currentTarget.style.color="#475569"}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE (served at getmoe.ai/)
// ═══════════════════════════════════════════════════════════════════════════════

const LANDING_PLANS = [
  { name: "Starter", price: 299, vendors: "3", items: "100", users: "2", features: ["Inventory tracking", "Order submission & history", "PDF export with business name", "Waste log with cost tracking", "Real-time sync across devices"], cta: "Start Free Trial" },
  { name: "Pro", price: 399, vendors: "Unlimited", items: "Unlimited", users: "10", features: ["Everything in Starter", "AI-powered invoice import", "Insights & smart par suggestions", "Price tracker — flag vendor increases", "Waste log with $ loss estimates"], popular: true, cta: "Start Free Trial" },
  { name: "Enterprise", price: 499, vendors: "Unlimited", items: "Unlimited", users: "Unlimited", features: ["Everything in Pro", "Priority support", "Custom onboarding", "Multi-location ready", "Dedicated account manager"], cta: "Contact Sales" },
];

const STEPS = [
  { num: "01", title: "Set Up in Minutes", desc: "Add vendors and items — or snap a photo of an invoice and let AI do it. Invite your team with one tap.", icon: "🏪" },
  { num: "02", title: "Count & Order", desc: "Your team counts stock on their phones. MOE calculates exactly what to order and generates a PDF for each vendor.", icon: "📋" },
  { num: "03", title: "Track Prices & Waste", desc: "Upload invoices to track vendor prices week to week. Log wasted items to see exactly how much you're losing.", icon: "💲" },
  { num: "04", title: "Get Smarter Every Week", desc: "MOE learns your patterns, recommends better stock levels, flags price increases, and shows you where money is going.", icon: "📊" },
];

const FEATURES = [
  { title: "Vendor-Based Ordering", desc: "Set order days per vendor. MOE shows you who to order from today and auto-calculates exactly how much you need.", icon: "📦" },
  { title: "AI Invoice Import", desc: "Snap a photo of any invoice or order sheet. AI extracts every item, unit, and quantity — your inventory is set up in seconds.", icon: "📸" },
  { title: "Price Tracker", desc: "Enter prices each week from your invoices — manually, by photo, or CSV upload. MOE flags every price increase with the exact % change.", icon: "💲" },
  { title: "Waste Log", desc: "Track what's going in the trash. MOE logs every wasted item with the reason, who logged it, and estimates the dollar loss from your price data.", icon: "🗑️" },
  { title: "Smart Par Suggestions", desc: "After 3 weeks of order data, MOE recommends optimal stock levels based on your actual usage — with a built-in safety buffer.", icon: "🧠" },
  { title: "Team Access Control", desc: "Owners see everything. Managers handle orders and backend. Employees just count stock. Everyone has exactly the access they need.", icon: "👥" },
  { title: "Real-Time Sync", desc: "Count stock on one phone, it updates everywhere instantly. Your whole team works from the same live inventory across all devices.", icon: "⚡" },
  { title: "PDF Order Sheets", desc: "Generate clean, printable order sheets per vendor — with your business name, who placed the order, and item quantities. Ready to send.", icon: "🖨️" },
];

const FAQS = [
  { q: "How long is the free trial?", a: "14 days with full Pro features — including AI import, price tracking, and insights. No credit card required." },
  { q: "Can my employees use it?", a: "Yes. Add employees in Settings with their email and a temporary password. They sign in and see only the inventory count screen. Managers get access to orders, history, insights, and backend." },
  { q: "Do I need to enter all my items manually?", a: "No. You can upload a CSV file, or just take a photo of any invoice or order sheet. Our AI extracts all the items, units, and quantities for you." },
  { q: "How does the price tracker work?", a: "Enter your vendor prices each week — manually, by uploading a photo of the invoice, or via CSV. MOE compares this week's prices to last week's and flags every increase with the exact dollar and percentage change." },
  { q: "What does the waste log track?", a: "Every item your team throws away — the quantity, the reason (expired, spoiled, damaged, etc.), and who logged it. If you've entered prices, MOE estimates the dollar value of the waste too." },
  { q: "What happens after the trial?", a: "Choose a plan that fits your business. All your data carries over — nothing is lost. Plans start at $299/month and pay for themselves in the first week." },
  { q: "Does it work on phones?", a: "MOE is built mobile-first. Your team counts stock on their phones while walking the floor. Orders can be submitted from any device." },
  { q: "Can I use it for multiple locations?", a: "Yes. Enterprise plan supports multiple locations, each with their own inventory, team, and vendor setup." },
];

function HexIcon({ size = 48 }) {
  const r = size / 2;
  const hex = (cx, cy, rad) => {
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`); }
    return pts.join(" ");
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={hex(r, r, r * 0.95)} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      <polygon points={hex(r, r, r * 0.6)} fill="none" stroke="#cbd5e1" strokeWidth="0.8" />
      <polygon points={hex(r, r, r * 0.3)} fill="#0f172a" />
    </svg>
  );
}

function MoeLogoLanding({ size = "lg", dark = false }) {
  const configs = { md: { vw: 150, vh: 44, hx: 22, hy: 22, oR: 20, mR: 13, iR: 7, d: 2.2, tx: 48, ty: 28, fs: 24 }, lg: { vw: 200, vh: 64, hx: 32, hy: 32, oR: 29, mR: 19, iR: 10, d: 3, tx: 68, ty: 42, fs: 34 } };
  const c = configs[size] || configs.lg;
  const hex = (cx, cy, r) => { const pts = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`); } return pts.join(" "); };
  const spokes = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return { x1: (c.hx + c.oR * Math.cos(a)).toFixed(2), y1: (c.hy + c.oR * Math.sin(a)).toFixed(2), x2: (c.hx + c.mR * Math.cos(a)).toFixed(2), y2: (c.hy + c.mR * Math.sin(a)).toFixed(2) }; });
  const dots = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 180 * (60 * i - 30); return { cx: (c.hx + c.oR * Math.cos(a)).toFixed(2), cy: (c.hy + c.oR * Math.sin(a)).toFixed(2) }; });
  const mFill = dark ? "#f1f5f9" : "#0f172a";
  const oeFill = dark ? "#94a3b8" : "#475569";
  const hexStroke = dark ? "#64748b" : "#94a3b8";
  const innerFill = dark ? "#f1f5f9" : "#0f172a";
  return (
    <svg width={c.vw} height={c.vh} viewBox={`0 0 ${c.vw} ${c.vh}`} style={{ display: "block" }}>
      <polygon points={hex(c.hx, c.hy, c.oR)} fill="none" stroke={hexStroke} strokeWidth="0.8" opacity="0.4" />
      {spokes.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={hexStroke} strokeWidth="0.7" opacity="0.3" />)}
      {dots.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={c.d} fill="#64748b" opacity="0.5" />)}
      <polygon points={hex(c.hx, c.hy, c.mR)} fill="none" stroke={dark ? "#cbd5e1" : "#475569"} strokeWidth="1" opacity="0.55" />
      <polygon points={hex(c.hx, c.hy, c.iR)} fill={innerFill} />
      <circle cx={c.hx} cy={c.hy} r={c.iR * 0.4} fill={dark ? "#080c14" : "#f8fafc"} opacity={dark ? 0.45 : 0.3} />
      <text x={c.tx} y={c.ty} fontFamily="'Syne',sans-serif" fontWeight="800" fontSize={c.fs} letterSpacing="-1" fill={mFill}>M<tspan fill={oeFill}>OE</tspan></text>
    </svg>
  );
}

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add("visible"); });
    }, { threshold: 0.1 });
    document.querySelectorAll(".fade-up").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const faqToggle = (idx) => setOpenFaq(openFaq === idx ? null : idx);

  const faqs = [
    { q: "What kind of businesses is MOE for?", a: "Any small business that orders supplies and tracks inventory — restaurants, salons, retail shops, contractors, fitness studios, medical offices, and more." },
    { q: "How long does setup take?", a: "Under 5 minutes. Create your account, use AI Import to generate your item list, and you're ready to go." },
    { q: "Is my data secure?", a: "Yes. MOE uses Supabase for secure cloud storage with row-level security. Your data is encrypted and only accessible to your team." },
    { q: "Can I cancel anytime?", a: "Absolutely. No contracts, no cancellation fees. Your 14-day trial is completely free with no credit card required." },
    { q: "Can my team use it too?", a: "Yes. MOE supports role-based access for Owners, Managers, and Employees. Everyone sees what they need." },
    { q: "Do I need to install anything?", a: "No. MOE runs entirely in your browser — desktop, tablet, or phone. No downloads needed." },
  ];

  const checkSvg = <svg width="14" height="14" fill="none" stroke="#34d399" strokeWidth="2.5"><path d="M2 7l3.5 3.5 7-7"/></svg>;
  const bulletSvg = <svg width="16" height="16" fill="none" stroke="#34d399" strokeWidth="2.5"><path d="M2 8.5l4 4 8-8"/></svg>;
  const arrowSvg = <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>;
  const plusSvg = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3v12M3 9h12"/></svg>;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
    .lp * { box-sizing: border-box; margin: 0; padding: 0; }
    .lp { --bg: #060a12; --card: #0c1220; --card-h: #111827; --surface: #141c2e; --border: rgba(148,163,184,0.1); --border-b: rgba(148,163,184,0.2); --t1: #f1f5f9; --t2: #94a3b8; --t3: #64748b; --accent: #38bdf8; --glow: rgba(56,189,248,0.15); --green: #34d399; --amber: #fbbf24; --rose: #fb7185; --r: 12px; --rl: 20px; --ff: 'DM Sans',sans-serif; --fm: 'Space Mono',monospace; font-family: var(--ff); background: var(--bg); color: var(--t1); line-height: 1.6; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
    .lp a { color: inherit; text-decoration: none; }
    .lp .ctn { max-width: 1140px; margin: 0 auto; padding: 0 24px; }
    .lp .fade-up { opacity: 0; transform: translateY(30px); transition: opacity 0.7s, transform 0.7s; }
    .lp .fade-up.visible { opacity: 1; transform: translateY(0); }
    .lp .slbl { font-family: var(--fm); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--accent); margin-bottom: 16px; }
    .lp .stitle { font-size: clamp(1.8rem,4vw,2.6rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 20px; }
    .lp .ssub { font-size: 1.05rem; color: var(--t2); max-width: 560px; line-height: 1.7; }
    .lp .btn-p { display: inline-flex; align-items: center; gap: 8px; padding: 16px 36px; background: var(--accent); color: var(--bg); font-weight: 700; font-size: 1rem; border-radius: 10px; border: none; cursor: pointer; transition: all 0.25s; box-shadow: 0 0 30px var(--glow); }
    .lp .btn-p:hover { transform: translateY(-2px); box-shadow: 0 0 50px var(--glow); }
    .lp .btn-s { display: inline-flex; align-items: center; gap: 8px; padding: 16px 36px; background: transparent; color: var(--t1); font-weight: 600; font-size: 1rem; border-radius: 10px; border: 1px solid var(--border-b); cursor: pointer; transition: all 0.25s; }
    .lp .btn-s:hover { border-color: var(--t2); background: rgba(255,255,255,0.03); }
    .lp .mock-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border-radius: 8px; margin-bottom: 8px; font-size: 0.85rem; }
    .lp .mock-row .lb { color: var(--t2); }
    .lp .mock-row .vl { font-family: var(--fm); font-weight: 700; font-size: 0.85rem; }
    .lp .mock-row .vl.red { color: var(--rose); }
    .lp .mock-row .vl.grn { color: var(--green); }
    .lp .mock-row .vl.blu { color: var(--accent); }
    .lp .mock-row .vl.amb { color: var(--amber); }
    .lp .mock-hdr { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--t3); margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    @media (max-width: 768px) {
      .lp .desk-nav { display: none !important; }
      .lp .mob-toggle { display: flex !important; }
      .lp .prob-grid, .lp .feat-row { grid-template-columns: 1fr !important; }
      .lp .feat-row .feat-vis { order: 0 !important; min-height: 240px !important; }
      .lp .aud-grid, .lp .price-grid { grid-template-columns: 1fr !important; }
      .lp .price-grid { max-width: 400px; margin: 0 auto; }
      .lp .price-card.feat { transform: none !important; }
      .lp .proof-inner { flex-direction: column !important; gap: 24px !important; }
      .lp .hero-acts { flex-direction: column; align-items: center; }
      .lp .hero-acts .btn-p, .lp .hero-acts .btn-s { width: 100%; justify-content: center; }
      .lp .save-bar { gap: 24px !important; }
      .lp .save-bar .snum { font-size: 1.6rem !important; }
    }
  `;

  return (
    <div className="lp" style={{ minHeight: "100vh" }}>
      <style>{css}</style>

      {/* ═══ NAV ═══ */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "16px 0", background: "rgba(6,10,18,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)" }}>
        <div className="ctn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: "1.25rem", letterSpacing: "-0.02em", color: "inherit", textDecoration: "none" }}>
            <svg viewBox="0 0 40 40" fill="none" width="36" height="36">
              <polygon points="20,2.5 36.5,11.25 36.5,28.75 20,37.5 3.5,28.75 3.5,11.25" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.35"/>
              <polygon points="20,8 31,14 31,26 20,32 9,26 9,14" fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.5"/>
              <polygon points="20,13 25.5,16.5 25.5,23.5 20,27 14.5,23.5 14.5,16.5" fill="#38bdf8" opacity="0.12"/>
              <line x1="20" y1="2.5" x2="20" y2="8" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
              <line x1="36.5" y1="11.25" x2="31" y2="14" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
              <line x1="36.5" y1="28.75" x2="31" y2="26" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
              <line x1="20" y1="37.5" x2="20" y2="32" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
              <line x1="3.5" y1="28.75" x2="9" y2="26" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
              <line x1="3.5" y1="11.25" x2="9" y2="14" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
              <circle cx="20" cy="2.5" r="1.8" fill="#38bdf8" opacity="0.5"/>
              <circle cx="36.5" cy="11.25" r="1.8" fill="#38bdf8" opacity="0.5"/>
              <circle cx="36.5" cy="28.75" r="1.8" fill="#38bdf8" opacity="0.5"/>
              <circle cx="20" cy="37.5" r="1.8" fill="#38bdf8" opacity="0.5"/>
              <circle cx="3.5" cy="28.75" r="1.8" fill="#38bdf8" opacity="0.5"/>
              <circle cx="3.5" cy="11.25" r="1.8" fill="#38bdf8" opacity="0.5"/>
              <text x="20" y="24.5" textAnchor="middle" fill="#38bdf8" fontFamily="DM Sans,sans-serif" fontWeight="700" fontSize="13">M</text>
            </svg>
            MOE
          </a>
          <button className="mob-toggle" onClick={() => setMenuOpen(!menuOpen)} style={{ display: "none", background: "none", border: "none", color: "var(--t1)", cursor: "pointer", alignItems: "center" }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <div className="desk-nav" style={{ display: "flex", gap: 32, alignItems: "center" }}>
            <a href="#features" style={{ fontSize: "0.875rem", color: "var(--t2)", fontWeight: 500 }}>Features</a>
            <a href="#pricing" style={{ fontSize: "0.875rem", color: "var(--t2)", fontWeight: 500 }}>Pricing</a>
            <a href="#faq" style={{ fontSize: "0.875rem", color: "var(--t2)", fontWeight: 500 }}>FAQ</a>
            <button onClick={() => window.__moeNavigate("/app")} style={{ fontSize: "0.875rem", color: "var(--t2)", fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Sign In</button>
            <button onClick={() => window.__moeNavigate("/quiz")} style={{ background: "var(--accent)", color: "var(--bg)", padding: "10px 22px", borderRadius: 8, fontWeight: 600, fontSize: "0.875rem", border: "none", cursor: "pointer" }}>Start Free Trial</button>
          </div>
        </div>
        {menuOpen && (
          <div style={{ display: "flex", flexDirection: "column", padding: "16px 24px", background: "var(--bg)", borderBottom: "1px solid var(--border)", gap: 16 }}>
            <a href="#features" onClick={() => setMenuOpen(false)} style={{ fontSize: 15, color: "var(--t2)", fontWeight: 500, padding: "8px 0" }}>Features</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} style={{ fontSize: 15, color: "var(--t2)", fontWeight: 500, padding: "8px 0" }}>Pricing</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} style={{ fontSize: 15, color: "var(--t2)", fontWeight: 500, padding: "8px 0" }}>FAQ</a>
            <button onClick={() => { window.__moeNavigate("/app"); setMenuOpen(false); }} style={{ fontSize: 15, color: "var(--t2)", fontWeight: 500, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "8px 0" }}>Sign In</button>
            <button onClick={() => { window.__moeNavigate("/quiz"); setMenuOpen(false); }} style={{ background: "var(--accent)", color: "var(--bg)", padding: "12px", borderRadius: 8, fontWeight: 600, border: "none", cursor: "pointer", textAlign: "center" }}>Start Free Trial</button>
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══ */}
      <section style={{ padding: "160px 0 100px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, background: "radial-gradient(circle, var(--glow) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="ctn fade-up" style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", background: "var(--glow)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 100, fontSize: "0.8rem", fontWeight: 600, color: "var(--accent)", marginBottom: 28, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            <span style={{ width: 6, height: 6, background: "var(--accent)", borderRadius: "50%", animation: "pulse-dot 2s infinite" }} /> Now in Early Access
          </div>
          <style>{`@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
          <h1 style={{ fontSize: "clamp(2.5rem,6vw,4rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", marginBottom: 24 }}>
            Stop losing money<br/>on <span style={{ background: "linear-gradient(135deg,var(--accent),#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>inventory</span>
          </h1>
          <p style={{ fontSize: "1.2rem", color: "var(--t2)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
            MOE counts your stock, builds your orders, catches what didn't get delivered, and flags price hikes — so you stop losing $500+ a week to over-ordering, waste, and emergency runs.
          </p>
          <div className="hero-acts" style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <button className="btn-p" onClick={() => window.__moeNavigate("/quiz")}>Start Free 14-Day Trial {arrowSvg}</button>
            <a href="#features" className="btn-s">See How It Works</a>
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--t3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {checkSvg} No credit card required · Setup in under 5 minutes
          </p>
          <div className="save-bar" style={{ marginTop: 60, display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
            {[["$500+","Saved per Week","var(--green)"],["80%","Less Waste","var(--amber)"],["Seconds","To Place an Order","var(--accent)"]].map(([num,lbl,col]) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <div className="snum" style={{ fontFamily: "var(--fm)", fontSize: "2.2rem", fontWeight: 700, color: col, letterSpacing: "-0.03em" }}>{num}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF ═══ */}
      <section style={{ padding: "60px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="ctn proof-inner fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
          {[
            ["Built by an Owner","Created by a real pizzeria operator","M12 2l2.09 6.26L21 9.27l-5 3.9L17.18 20 12 16.77 6.82 20 8 13.17l-5-3.9 6.91-1.01z","var(--accent)"],
            ["AI-Powered","Import items & get insights instantly","M9 12l2 2 4-4","var(--green)"],
            ["Works for Any Business","Restaurants, salons, retail & more","M3 3h18v18H3zM3 9h18M9 3v18","var(--amber)"],
          ].map(([title,desc,path,color]) => (
            <div key={title} style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--t2)", fontSize: "0.9rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" width="20" height="20"><path d={path}/></svg>
              </div>
              <div><strong style={{ color: "var(--t1)", display: "block", fontSize: "0.95rem" }}>{title}</strong>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PROBLEM ═══ */}
      <section style={{ padding: "100px 0" }}>
        <div className="ctn">
          <div className="fade-up">
            <div className="slbl">The Problem</div>
            <h2 className="stitle">Inventory chaos is costing<br/>you thousands</h2>
            <p className="ssub">Most small businesses still manage stock with pen-and-paper, messy spreadsheets, or pure guesswork. The result? Over-ordering, waste, and margin erosion every single week.</p>
          </div>
          <div className="prob-grid fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 48 }}>
            {[
              ["📋","Spreadsheets from hell","Manual tracking across tabs, notebooks, and sticky notes leads to errors that snowball into wasted money.","var(--rose)"],
              ["🗑️","Invisible waste","Without tracking what gets tossed and why, you can't fix the problem. Thousands go in the trash silently.","var(--amber)"],
              ["📈","Supplier price creep","Vendors quietly raise prices week over week. Without tracking, you don't catch it until margins are crushed.","var(--rose)"],
              ["🤷","Ordering by gut feeling","Guessing how much to order means you're always over-stocked or running out. Both cost you real money.","var(--amber)"],
            ].map(([emoji,title,desc,color]) => (
              <div key={title} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 32, position: "relative", overflow: "hidden", transition: "all 0.3s" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 3, background: color }} />
                <div style={{ fontSize: "1.5rem", marginBottom: 16 }}>{emoji}</div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: 8, letterSpacing: "-0.01em" }}>{title}</h3>
                <p style={{ fontSize: "0.9rem", color: "var(--t2)", lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" style={{ padding: "100px 0" }}>
        <div className="ctn">
          <div className="fade-up" style={{ textAlign: "center", marginBottom: 64 }}>
            <div className="slbl">How MOE Fixes It</div>
            <h2 className="stitle">Everything you need to<br/>order smarter</h2>
            <p className="ssub" style={{ margin: "0 auto" }}>One app replaces the spreadsheets, the guesswork, and the late-night ordering scramble.</p>
          </div>

          {[
            { tag: "Inventory", tagCls: "rgba(56,189,248,0.12)", tagCol: "var(--accent)", title: "Know exactly what you have — and what to order", desc: "Do a quick count and MOE builds the order for you based on what you actually use. No more guessing, no more spreadsheets.", bullets: ["Fast stock counts by section","Usage-based par suggestions","Orders build themselves"],
              mock: [["Mozzarella (5lb)","12 units","blu"],["Flour (50lb bag)","8 units","grn"],["Olive Oil (gal)","2 units ⚠","red"],["Pepperoni (10lb)","6 units","grn"]], mockTitle: "Your Stock Count" },
            { tag: "Delivery Check-In", tagCls: "rgba(56,189,248,0.12)", tagCol: "var(--accent)", title: "Never get blindsided by a missing item again", desc: "When a delivery arrives, check it in seconds. MOE flags anything short, out of stock, or left off the truck — so you find out today, not when you've run out mid-rush.", bullets: ["Catch shortfalls the day they happen","One-tap add back to your next order","Flags items you forgot to order at all"],
              mock: [["Penne (case)","Out of stock ⚠","red"],["Mozzarella (5lb)","Came in ✓","grn"],["Tomatoes (case)","Short 2 of 5 ⚠","red"],["Flour (50lb)","Came in ✓","grn"]], mockTitle: "Delivery Check-In" },
            { tag: "Usage Insights", tagCls: "rgba(167,139,250,0.12)", tagCol: "#a78bfa", title: "See what you actually use every week", desc: "MOE measures real usage from your stock counts — so if you carry 20 but only use 13, it tells you to trim to 16 and stop tying up cash in your walk-in.", bullets: ["Tracks true weekly usage","Flags over-ordering & dead stock","Set the right par in one tap"],
              mock: [["Flour","13 used / 20 stocked","amb"],["→ Recommended par","16 units","grn"],["Mozzarella","9 used / 14 stocked","amb"],["→ You're over by","5 cases","red"]], mockTitle: "Usage Insights" },
            { tag: "Waste Log", tagCls: "rgba(251,113,133,0.12)", tagCol: "var(--rose)", title: "See where your money goes to die", desc: "Log every item that hits the trash with reason codes and cost estimates. Spot the patterns, fix the leaks.", bullets: ["Reason-coded waste tracking","Automatic cost estimation","Weekly trend analysis"],
              mock: [["Total waste cost","-$127.40","red"],["vs. last week","↓ 34%","grn"],["Expired produce","$68.20","red"],["Over-prepped","$41.00","red"]], mockTitle: "This Week's Waste" },
            { tag: "Price Tracker", tagCls: "rgba(251,191,36,0.12)", tagCol: "var(--amber)", title: "Catch price hikes before they eat your margin", desc: "Set a price once and MOE carries it across every order. After each order, do a 30-second price check — confirm what's the same, edit only what changed, and get a weekly food spend total.", bullets: ["Set it once, it carries over","Flags week-over-week increases","Weekly food spend, automatically"],
              mock: [["Chicken breast (/lb)","$3.89 → $4.42 ↑14%","red"],["Heavy cream (qt)","$4.10 → $4.55 ↑11%","red"],["Romaine lettuce","$2.20 → $2.15 ↓2%","grn"],["This week's spend","$3,840","blu"]], mockTitle: "Price Alerts" },
            { tag: "AI Import", tagCls: "rgba(52,211,153,0.12)", tagCol: "var(--green)", title: "Build your inventory in minutes, not hours", desc: "Just snap a photo of your invoice and MOE's AI builds your full item list.", bullets: ["AI-generated item lists","Pre-set categories & units","Edit anything after import"],
              mock: [["✓ Dough & Flour (6 items)","Added","blu"],["✓ Cheese & Dairy (8 items)","Added","blu"],["✓ Meats & Proteins (10 items)","Added","blu"],["✓ Produce & Vegetables (12 items)","Added","blu"]], mockTitle: "AI Import" },
          ].map((feat, idx) => (
            <div key={feat.tag} className="feat-row fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", marginBottom: 80 }}>
              <div style={{ order: idx % 2 === 1 ? 1 : 0 }}>
                <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, background: feat.tagCls, color: feat.tagCol }}>{feat.tag}</span>
                <h3 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 12, lineHeight: 1.2 }}>{feat.title}</h3>
                <p style={{ fontSize: "1rem", color: "var(--t2)", lineHeight: 1.7, marginBottom: 20 }}>{feat.desc}</p>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                  {feat.bullets.map(b => <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.9rem", color: "var(--t2)" }}>{bulletSvg} {b}</li>)}
                </ul>
              </div>
              <div className="feat-vis" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--rl)", padding: 40, minHeight: 320, order: idx % 2 === 1 ? -1 : 1 }}>
                <div className="mock-hdr">{feat.mockTitle}</div>
                {feat.mock.map(([lb,vl,cl]) => (
                  <div key={lb} className="mock-row"><span className="lb">{lb}</span><span className={"vl " + cl}>{vl}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ WHO IT'S FOR ═══ */}
      <section id="audience" style={{ padding: "100px 0", background: "var(--card)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="ctn">
          <div className="fade-up" style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="slbl">Who It's For</div>
            <h2 className="stitle">Built for any business with inventory</h2>
            <p className="ssub" style={{ margin: "0 auto" }}>If you order supplies, track stock, or deal with waste — MOE was built for you.</p>
          </div>
          <div className="aud-grid fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              ["🍕","Restaurants & Cafés","Kitchens, pizzerias, bakeries, food trucks"],
              ["💇","Salons & Spas","Hair products, skincare, supplies, retail"],
              ["🏪","Retail & Convenience","Shops, bodegas, boutiques, specialty stores"],
              ["🔧","Contractors & Trades","Parts, materials, tools, equipment"],
              ["💪","Fitness & Wellness","Supplements, retail, cleaning, equipment"],
              ["🏥","Medical & Dental","Office supplies, consumables, disposables"],
            ].map(([icon,title,desc]) => (
              <div key={title} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 28, textAlign: "center", transition: "all 0.3s" }}>
                <div style={{ fontSize: "2rem", marginBottom: 12 }}>{icon}</div>
                <h4 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 6 }}>{title}</h4>
                <p style={{ fontSize: "0.82rem", color: "var(--t3)", lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" style={{ padding: "100px 0" }}>
        <div className="ctn">
          <div className="fade-up" style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="slbl">Simple Pricing</div>
            <h2 className="stitle">Start free. Upgrade when you're ready.</h2>
            <p className="ssub" style={{ margin: "0 auto" }}>Every plan starts with a 14-day free trial. No credit card required.</p>
          </div>
          <div className="price-grid fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, alignItems: "start" }}>
            {[
              { name: "Starter", desc: "For solo operators getting organized", price: "$299", features: ["Inventory tracking","Waste log","Order generation","1 team member"], featured: false },
              { name: "Pro", desc: "For growing teams that need full visibility", price: "$399", features: ["Everything in Starter","Price tracker & alerts","AI item import","Par level insights","Up to 5 team members"], featured: true },
              { name: "Enterprise", desc: "For multi-location operations", price: "$499", features: ["Everything in Pro","Unlimited team members","Multi-location support","Priority support","Custom integrations"], featured: false },
            ].map(plan => (
              <div key={plan.name} className={plan.featured ? "price-card feat" : "price-card"} style={{ background: "var(--card)", border: plan.featured ? "1px solid var(--accent)" : "1px solid var(--border)", borderRadius: "var(--rl)", padding: "36px 28px", position: "relative", boxShadow: plan.featured ? "0 0 60px var(--glow)" : "none", transform: plan.featured ? "scale(1.04)" : "none" }}>
                {plan.featured && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 16px", background: "var(--accent)", color: "var(--bg)", fontSize: "0.7rem", fontWeight: 700, borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>Most Popular</div>}
                <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>{plan.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--t3)", marginBottom: 24 }}>{plan.desc}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 24 }}>
                  <span style={{ fontFamily: "var(--fm)", fontSize: "2.8rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--t3)" }}>/month</span>
                </div>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                  {plan.features.map(f => <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.85rem", color: "var(--t2)" }}>{checkSvg} {f}</li>)}
                </ul>
                <button onClick={() => window.__moeNavigate("/quiz")} style={{ display: "block", width: "100%", padding: 14, textAlign: "center", borderRadius: 10, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", background: plan.featured ? "var(--accent)" : "transparent", color: plan.featured ? "var(--bg)" : "var(--t1)", border: plan.featured ? "none" : "1px solid var(--border-b)" }}>
                  Start Free Trial
                </button>
              </div>
            ))}
          </div>
          <p className="fade-up" style={{ textAlign: "center", marginTop: 20, fontSize: "0.8rem", color: "var(--t3)" }}>All plans include a 14-day free trial · No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* ═══ TESTIMONIAL ═══ */}
      <section style={{ padding: "80px 0", borderTop: "1px solid var(--border)" }}>
        <div className="ctn">
          <div className="fade-up" style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
            <p style={{ fontSize: "1.25rem", fontStyle: "italic", lineHeight: 1.7, marginBottom: 24, position: "relative" }}>
              <span style={{ position: "absolute", top: -20, left: -10, fontSize: "4rem", color: "var(--accent)", fontFamily: "Georgia,serif", opacity: 0.5 }}>"</span>
              I built MOE because I was tired of losing money on over-ordering and catching supplier price hikes too late. If you run a small business with inventory, this is the tool I wish I had years ago.
            </p>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Ronnie</div>
            <div style={{ fontSize: "0.82rem", color: "var(--t3)" }}>Pizzeria Owner & MOE Creator</div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" style={{ padding: "100px 0" }}>
        <div className="ctn">
          <div className="fade-up" style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="slbl">FAQ</div>
            <h2 className="stitle">Questions? Answered.</h2>
          </div>
          <div className="fade-up" style={{ maxWidth: 640, margin: "0 auto" }}>
            {faqs.map((faq, i) => (
              <div key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <button onClick={() => faqToggle(i)} style={{ width: "100%", background: "none", border: "none", color: "var(--t1)", fontFamily: "var(--ff)", fontSize: "1rem", fontWeight: 600, padding: "20px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
                  {faq.q}
                  <span style={{ transition: "transform 0.3s", transform: openFaq === i ? "rotate(45deg)" : "none", color: "var(--t3)", flexShrink: 0, marginLeft: 12 }}>{plusSvg}</span>
                </button>
                <div style={{ maxHeight: openFaq === i ? 200 : 0, overflow: "hidden", transition: "max-height 0.35s ease" }}>
                  <p style={{ paddingBottom: 20, fontSize: "0.9rem", color: "var(--t2)", lineHeight: 1.7 }}>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section style={{ padding: "100px 0", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", bottom: -300, left: "50%", transform: "translateX(-50%)", width: 800, height: 800, background: "radial-gradient(circle, var(--glow) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="ctn fade-up" style={{ position: "relative", zIndex: 2 }}>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16, lineHeight: 1.15 }}>Ready to stop bleeding money<br/>on inventory?</h2>
          <p style={{ fontSize: "1.1rem", color: "var(--t2)", marginBottom: 36 }}>Join the small businesses saving $500+ per week with smarter ordering.</p>
          <button className="btn-p" onClick={() => window.__moeNavigate("/quiz")} style={{ fontSize: "1.1rem", padding: "18px 48px" }}>
            Start Your Free 14-Day Trial {arrowSvg}
          </button>
          <p style={{ fontSize: "0.82rem", color: "var(--t3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
            {checkSvg} No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ padding: "40px 0", borderTop: "1px solid var(--border)" }}>
        <div className="ctn" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ fontSize: "0.8rem", color: "var(--t3)" }}>© {new Date().getFullYear()} MOE — Make Ordering Easy. All rights reserved.</div>
          <div style={{ display: "flex", gap: 24 }}>
            <a href="/privacy" style={{ fontSize: "0.8rem", color: "var(--t3)" }}>Privacy</a>
            <a href="/terms" style={{ fontSize: "0.8rem", color: "var(--t3)" }}>Terms</a>
            <a href="/contact" style={{ fontSize: "0.8rem", color: "var(--t3)" }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER — getmoe.ai/ → Landing, getmoe.ai/app → MOE App
// ═══════════════════════════════════════════════════════════════════════════════
export default function Router() {
  const getRoute = () => {
    const p = window.location.pathname;
    const h = window.location.hash;
    if (p === "/app" || p.startsWith("/app/") || h === "#/app") return "app";
    if (p === "/quiz" || p.startsWith("/quiz") || h === "#/quiz") return "quiz";
    return "landing";
  };

  const [route, setRoute] = useState(getRoute);

  useEffect(() => {
    const onNav = () => setRoute(getRoute());
    window.addEventListener("popstate", onNav);
    window.addEventListener("hashchange", onNav);
    return () => { window.removeEventListener("popstate", onNav); window.removeEventListener("hashchange", onNav); };
  }, []);

  window.__moeNavigate = (to) => {
    // /app is the simplified shell owned by src/App.jsx. Full load avoids
    // rendering classic MOE for a moment on the way out of the marketing page.
    if (typeof to === "string" && (to === "/app" || to.startsWith("/app/") || to.startsWith("/app?") || to.startsWith("/classic"))) {
      window.location.assign(to);
      return;
    }
    try { window.history.pushState({}, "", to); } catch {
      window.location.hash = to;
    }
    if (to === "/quiz" || (typeof to === "string" && to.startsWith("/quiz"))) setRoute("quiz");
    else setRoute("landing");
  };

  if (route === "app") { window.location.assign("/app"); return null; }
  if (route === "quiz") return <SavingsQuiz />;
  return <LandingPage />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WASTE LOG — Track items going in the trash
// ═══════════════════════════════════════════════════════════════════════════════
function WasteLogView({ inventory, wasteLog, saveWasteLog, userName, priceHistory }) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [wasteUnit, setWasteUnit] = useState("each");
  const [reason, setReason] = useState("expired");
  const [note, setNote] = useState("");
  const [viewMode, setViewMode] = useState("log"); // "log" | "summary"
  const [filterWeek, setFilterWeek] = useState("all");

  const allItems = flatItems(inventory);
  const wk = weekKey();

  // Get latest price for an item from price tracker — per INDIVIDUAL unit,
  // since waste is logged in individual units (blocks, gallons, pieces).
  const getPrice = (itemId) => {
    const item = allItems.find(i => i.id === itemId);
    return latestPerUnit(priceHistory, item || { id: itemId, upu: 1 });
  };
  // Prices are per individual unit; a logged "case" is upu individual units.
  const getCost = (entry) => {
    const p = getPrice(entry.itemId);
    if (!p) return null;
    const item = allItems.find(i => i.id === entry.itemId);
    const mult = entry.unit === "case" ? Math.max(1, Number(item?.upu) || 1) : 1;
    return p * entry.qty * mult;
  };

  const reasons = [
    { key: "expired", label: "Expired", icon: "📅" },
    { key: "spoiled", label: "Spoiled", icon: "🤢" },
    { key: "damaged", label: "Damaged", icon: "💥" },
    { key: "overproduced", label: "Over-produced", icon: "📈" },
    { key: "dropped", label: "Dropped / Spilled", icon: "💧" },
    { key: "other", label: "Other", icon: "📝" },
  ];

  // Add waste entry
  const logWaste = () => {
    if (!selectedItem || qty < 1) return;
    const entry = {
      id: Date.now(),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      qty,
      unit: wasteUnit,
      reason,
      note: note.trim(),
      loggedBy: userName,
      date: new Date().toISOString(),
      weekKey: wk,
      vendor: selectedItem.vendor || "",
      section: selectedItem.section || "",
    };
    saveWasteLog([entry, ...wasteLog]);
    setSelectedItem(null); setQty(1); setWasteUnit("each"); setReason("expired"); setNote(""); setShowAdd(false); setSearch("");
  };

  const removeEntry = (id) => saveWasteLog(wasteLog.filter(e => e.id !== id));

  // Filter items for search
  const filteredItems = allItems.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.section || "").toLowerCase().includes(search.toLowerCase())
  );

  // Get all week keys from log
  const weekKeys = [...new Set(wasteLog.map(e => e.weekKey))].sort().reverse();

  // Filter log entries
  const displayLog = filterWeek === "all" ? wasteLog : wasteLog.filter(e => e.weekKey === filterWeek);

  // Summary stats
  const summaryData = {};
  const targetEntries = filterWeek === "all" ? wasteLog : wasteLog.filter(e => e.weekKey === filterWeek);
  targetEntries.forEach(e => {
    if (!summaryData[e.itemId]) summaryData[e.itemId] = { name: e.itemName, unit: e.unit, vendor: e.vendor, totalQty: 0, totalCost: 0, reasons: {}, entries: 0 };
    summaryData[e.itemId].totalQty += e.qty;
    summaryData[e.itemId].totalCost += getCost(e) || 0;
    summaryData[e.itemId].entries++;
    summaryData[e.itemId].reasons[e.reason] = (summaryData[e.itemId].reasons[e.reason] || 0) + e.qty;
  });
  const summaryRows = Object.values(summaryData).sort((a, b) => b.totalQty - a.totalQty);
  const totalWasted = targetEntries.reduce((s, e) => s + e.qty, 0);
  const totalEntries = targetEntries.length;

  // Reason breakdown
  const reasonTotals = {};
  targetEntries.forEach(e => { reasonTotals[e.reason] = (reasonTotals[e.reason] || 0) + e.qty; });

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0 }}>🗑️ Waste Log</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Track what's going in the trash to reduce waste over time</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {[{ key:"log", label:"Log" }, { key:"summary", label:"Summary" }].map(tab => (
            <button key={tab.key} onClick={() => setViewMode(tab.key)}
              style={{ background:viewMode===tab.key?"#e2e8f0":"transparent", border:`1px solid ${viewMode===tab.key?"#e2e8f0":"#1e2d45"}`, borderRadius:8, padding:"7px 16px", color:viewMode===tab.key?"#080c14":"#64748b", fontSize:13, fontWeight:viewMode===tab.key?600:400, cursor:"pointer" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Est. $ lost", value: "$" + targetEntries.reduce((s, e) => s + (getCost(e) || 0), 0).toFixed(0), color:"#fca5a5", bg:"#450a0a", border:"#7f1d1d" },
          { label:"This week $", value: "$" + wasteLog.filter(e => e.weekKey === wk).reduce((s, e) => s + (getCost(e) || 0), 0).toFixed(0), color:"#f87171", bg:"#450a0a", border:"#7f1d1d" },
          { label:"Total units", value:totalWasted, color:"#fbbf24", bg:"#422006", border:"#d97706" },
          { label:"Items logged", value:totalEntries, color:"#a5b4fc", bg:"#0f2040", border:"#1e40af" },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"12px 16px" }}>
            <div style={{ color:c.color, fontSize:22, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{c.value}</div>
            <div style={{ color:c.color, fontSize:11, opacity:0.8, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Week filter + add button */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)}
          style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer" }}>
          <option value="all">All weeks</option>
          <option value={wk}>This week ({wk})</option>
          {weekKeys.filter(w => w !== wk).map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)}
            style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", border:"none", borderRadius:8, padding:"8px 18px", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}>
            + Log Waste
          </button>
        )}
      </div>

      {/* Add waste form */}
      {showAdd && (
        <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:600 }}>Log Wasted Item</span>
            <button onClick={() => { setShowAdd(false); setSelectedItem(null); setSearch(""); }}
              style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:16 }}>✕</button>
          </div>

          {/* Item search */}
          {!selectedItem ? (
            <div>
              <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Search Item</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Start typing item name..."
                autoFocus style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:8 }} />
              {search.length > 0 && (
                <div style={{ maxHeight:200, overflowY:"auto", borderRadius:8, border:"1px solid #1e2d45" }}>
                  {filteredItems.slice(0, 15).map((item, idx) => (
                    <div key={item.id} onClick={() => { setSelectedItem(item); setSearch(""); }}
                      style={{ padding:"10px 14px", cursor:"pointer", background:idx%2===0?"#0f1a2e":"#0a1220", borderBottom:"1px solid #080c14", display:"flex", alignItems:"center", justifyContent:"space-between" }}
                      onMouseEnter={e => e.currentTarget.style.background="#1e2d45"}
                      onMouseLeave={e => e.currentTarget.style.background=idx%2===0?"#0f1a2e":"#0a1220"}>
                      <div>
                        <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:500 }}>{item.name}</div>
                        <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{(item.section || "").replace(/[^\w\s]/g,"").trim()}</div>
                      </div>
                      <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{item.order_unit}</span>
                    </div>
                  ))}
                  {filteredItems.length === 0 && <div style={{ padding:"14px", color:"#475569", textAlign:"center", fontSize:13 }}>No items found</div>}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Selected item */}
              <div style={{ background:"#080c14", borderRadius:8, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{selectedItem.name}</div>
                  <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{selectedItem.order_unit}{selectedItem.vendor ? ` · ${selectedItem.vendor}` : ""}</div>
                </div>
                <button onClick={() => setSelectedItem(null)} style={{ background:"none", border:"1px solid #1e2d45", borderRadius:6, color:"#64748b", cursor:"pointer", fontSize:11, padding:"3px 8px" }}>Change</button>
              </div>

              {/* Quantity + Unit + Reason */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Quantity Wasted</label>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <button onClick={() => setQty(Math.max(1, qty-1))} style={{ width:32, height:32, background:"#1e2d45", border:"none", borderRadius:8, color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                    <input type="number" value={qty} min={1} onChange={e => setQty(Math.max(1, parseInt(e.target.value)||1))}
                      style={{ width:50, background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"6px", color:"#f1f5f9", fontSize:16, fontWeight:700, textAlign:"center", outline:"none", fontFamily:"'DM Mono',monospace" }} />
                    <button onClick={() => setQty(qty+1)} style={{ width:32, height:32, background:"#1e2d45", border:"none", borderRadius:8, color:"#94a3b8", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                    <select value={wasteUnit} onChange={e => setWasteUnit(e.target.value)}
                      style={{ background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"6px 8px", color:"#f1f5f9", fontSize:12, outline:"none", cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>
                      {["lbs","oz","qt","gal","each","slices","pies","case"].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Reason</label>
                  <select value={reason} onChange={e => setReason(e.target.value)}
                    style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", cursor:"pointer", boxSizing:"border-box" }}>
                    {reasons.map(r => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Note (optional)</label>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. left out overnight, past date by 2 days..."
                  style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:13, outline:"none", boxSizing:"border-box" }} />
              </div>

              <div style={{ display:"flex", gap:10 }}>
                <button onClick={logWaste}
                  style={{ background:"linear-gradient(135deg,#ef4444,#dc2626)", border:"none", borderRadius:8, padding:"10px 20px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  Log Waste
                </button>
                <button onClick={() => { setShowAdd(false); setSelectedItem(null); setSearch(""); }}
                  style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 16px", color:"#94a3b8", fontSize:13, cursor:"pointer" }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LOG VIEW ── */}
      {viewMode === "log" && (
        <>
          {displayLog.length === 0 ? (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
              <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No waste logged yet</div>
              <div style={{ color:"#475569", fontSize:13, marginTop:6 }}>Tap "Log Waste" to start tracking what's being thrown away</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {displayLog.map(entry => {
                const r = reasons.find(r => r.key === entry.reason) || { icon:"📝", label:entry.reason };
                return (
                  <div key={entry.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, flex:1, minWidth:200 }}>
                      <span style={{ fontSize:20 }}>{r.icon}</span>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{entry.itemName}</span>
                          <span style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:5, padding:"1px 7px", color:"#fca5a5", fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{entry.qty} {entry.unit}</span>
                          {getCost(entry) !== null && <span style={{ color:"#ef4444", fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>−${getCost(entry).toFixed(2)}</span>}
                        </div>
                        <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                          {r.label}{entry.note ? ` — ${entry.note}` : ""} · {entry.loggedBy} · {new Date(entry.date).toLocaleDateString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" })}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeEntry(entry.id)}
                      style={{ background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:14, flexShrink:0 }}
                      onMouseEnter={e => e.currentTarget.style.color="#ef4444"}
                      onMouseLeave={e => e.currentTarget.style.color="#334155"}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── SUMMARY VIEW ── */}
      {viewMode === "summary" && (
        <>
          {/* Reason breakdown */}
          {Object.keys(reasonTotals).length > 0 && (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:"16px 20px", marginBottom:16 }}>
              <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Waste by Reason</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {Object.entries(reasonTotals).sort((a,b) => b[1]-a[1]).map(([key, total]) => {
                  const r = reasons.find(r => r.key === key) || { icon:"📝", label:key };
                  const pct = totalWasted > 0 ? Math.round((total / totalWasted) * 100) : 0;
                  return (
                    <div key={key} style={{ background:"#080c14", borderRadius:8, padding:"10px 14px", minWidth:100, flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                        <span style={{ fontSize:14 }}>{r.icon}</span>
                        <span style={{ color:"#94a3b8", fontSize:12, fontWeight:600 }}>{r.label}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                        <span style={{ color:"#fca5a5", fontSize:20, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{total}</span>
                        <span style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{pct}%</span>
                      </div>
                      <div style={{ background:"#1e2d45", borderRadius:3, height:4, marginTop:6, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:"#ef4444", borderRadius:3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top wasted items */}
          {summaryRows.length === 0 ? (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:32, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📊</div>
              <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>No waste data to summarize</div>
            </div>
          ) : (
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 80px 80px 1fr", background:"#080c14", padding:"8px 16px", gap:8 }}>
                {["Item", "Wasted", "$ Lost", "Times", "Top Reason"].map(h => (
                  <span key={h} style={{ color:"#475569", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", letterSpacing:"0.5px", textTransform:"uppercase" }}>{h}</span>
                ))}
              </div>
              {summaryRows.map((row, idx) => {
                const topReason = Object.entries(row.reasons).sort((a,b) => b[1]-a[1])[0];
                const r = reasons.find(r => r.key === topReason?.[0]) || { icon:"📝", label:topReason?.[0] || "—" };
                return (
                  <div key={row.name} style={{ display:"grid", gridTemplateColumns:"2fr 80px 80px 80px 1fr", padding:"10px 16px", gap:8, alignItems:"center", background:idx%2===0?"#0f1a2e":"#0a1220", borderTop:"1px solid #080c14" }}>
                    <div>
                      <div style={{ color:"#f1f5f9", fontSize:13, fontWeight:500 }}>{row.name}</div>
                      {row.vendor && <div style={{ color:"#475569", fontSize:10, fontFamily:"'DM Mono',monospace" }}>{row.vendor}</div>}
                    </div>
                    <span style={{ color:"#fca5a5", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{row.totalQty} <span style={{ fontSize:10, color:"#475569" }}>{row.unit}</span></span>
                    <span style={{ color:"#ef4444", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{row.totalCost > 0 ? `$${row.totalCost.toFixed(0)}` : "—"}</span>
                    <span style={{ color:"#a5b4fc", fontSize:13, fontFamily:"'DM Mono',monospace" }}>{row.entries}x</span>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:12 }}>{r.icon}</span>
                      <span style={{ color:"#94a3b8", fontSize:12 }}>{r.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE TRACKER — Track vendor prices, flag increases, upload invoices
// ═══════════════════════════════════════════════════════════════════════════════
function PriceTrackerView({ inventory, priceHistory, savePriceHistory, vendors, foodCost = false, history = [], saveHistory, saveInventory }) {
  const [mode, setMode] = useState("dashboard"); // "dashboard" | "enter" | "upload"
  const [filterVendor, setFilterVendor] = useState("ALL");
  const [search, setSearch] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedPrices, setParsedPrices] = useState([]);
  const photoRef = React.useRef(null);
  const fileRef = React.useRef(null);

  const allItems = flatItems(inventory);
  const currentWk = weekKey();
  const [selectedWeek, setSelectedWeek] = useState(currentWk);
  const wk = selectedWeek; // Use selected week for all price entries
  const vendorNames = [...new Set(allItems.map(i => (i.vendor || "").trim()).filter(Boolean))].sort();

  // Build list of past weeks for the picker (current + past 12 weeks)
  const weekOptions = [];
  const weekDates = {};
  for (let i = 0; i < 13; i++) {
    const d = new Date(); d.setDate(d.getDate() - (i * 7));
    const yr = getWeekYear(d);
    const wkNum = getWeekNumber(d);
    const key = `${yr}-WK${String(wkNum).padStart(2, "0")}`;
    if (!weekOptions.some(w => w.key === key)) {
      const mon = getWeekMonday(wkNum, yr);
      const monStr = mon.toLocaleDateString("en-US", { month:"short", day:"numeric" });
      weekOptions.push({ key, label: i === 0 ? `This week · Mon ${monStr}` : `WK${wkNum} · Mon ${monStr}` });
      weekDates[key] = d.toISOString();
    }
  }
  const getSelectedDate = () => weekDates[selectedWeek] || new Date().toISOString();

  // ── Manual price entry ──────────────────────────────────────────────────
  const [manualPrices, setManualPrices] = useState({});
  const updateManualPrice = (itemId, price) => setManualPrices(prev => ({ ...prev, [itemId]: price }));

  // ── Inline price edit (dashboard) ────────────────────────────────────────
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const startEdit = (itemId, current) => { setEditingId(itemId); setEditVal(current != null ? String(current) : ""); };
  const saveEdit = (itemId) => {
    const price = parseFloat(editVal);
    if (isNaN(price) || price < 0) { setEditingId(null); return; }
    const rounded = Math.round(price * 100) / 100;
    const item = allItems.find(i => String(i.id) === String(itemId));
    const upu = Math.max(1, Number(item?.upu) || 1);
    const newPH = { ...priceHistory };
    if (!newPH[itemId]) newPH[itemId] = [];
    const curWkKey = weekKey();
    // Typed value = price per ORDER unit (case/bag/each). perUnit = per individual unit.
    newPH[itemId] = [...newPH[itemId], { price: rounded, perUnit: Math.round((rounded / upu) * 10000) / 10000, basis: "unit", qty: upu, unit: item?.order_unit || "", date: new Date().toISOString(), weekKey: curWkKey, vendor: item?.vendor || "", source: "manual" }];
    savePriceHistory(newPH);
    setEditingId(null); setEditVal("");
  };

  const saveManualPrices = () => {
    const newPH = { ...priceHistory };
    Object.entries(manualPrices).forEach(([id, entry]) => {
      const total = parseFloat(entry.total);
      if (isNaN(total) || total <= 0) return;
      const qty = Math.max(1, parseInt(entry.qty) || 1);
      const perUnit = Math.round((total / qty) * 10000) / 10000;
      const item = allItems.find(i => String(i.id) === String(id));
      if (!newPH[id]) newPH[id] = [];
      newPH[id].push({ price: perUnit, perUnit, basis: "unit", date: getSelectedDate(), weekKey: wk, vendor: item?.vendor || "", source: "manual" });
    });
    savePriceHistory(newPH);
    setManualPrices({});
    setMode("dashboard");
  };

  // ── Photo upload — AI extracts prices ───────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(""); setParsedPrices([]); setParsing(true);
    try {
      const base64 = await compressImage(file);
      // Build a list of inventory item names so Claude can match against them
      const itemNames = allItems.map(i => i.name).join(", ");
      const response = await callClaude({
          model: "claude-sonnet-4-20250514", max_tokens: 4000,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: `Extract ALL item prices from this invoice/receipt image.

My inventory items are: ${itemNames}

For each line item on the invoice, return:
- "invoice_name": the exact name as printed on the invoice
- "matched_name": the closest matching item from my inventory list above (or "" if no match)
- "price": the TOTAL line price (the extended amount for all units on that line, not the per-unit price)
- "unit": the unit of measure (Case, Each, Lb, Gal, etc.)
- "qty": quantity ordered (number)

Return ONLY a JSON array, no markdown, no explanation. Example:
[{"invoice_name":"MOZZ WM 5LB","matched_name":"Mozzarella","price":85.16,"unit":"Case","qty":4}]
In this example, 4 cases at $21.29 each = $85.16 total. Return the $85.16 total, not $21.29.` }
          ]}]
        });
      const data = await response.json();
      if (data.error) { setParseError(data.error.message || "API error"); setParsing(false); return; }
      const rawText = (data.content || []).map(c => c.text || "").join("");
      // Clean up the response — remove markdown fences, fix common JSON issues
      let cleaned = rawText.replace(/```json|```/g, "").trim();
      // Fix trailing commas before ] or }
      cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
      // Fix unescaped quotes inside strings by finding the array
      const arrayStart = cleaned.indexOf("[");
      const arrayEnd = cleaned.lastIndexOf("]");
      if (arrayStart !== -1 && arrayEnd !== -1) cleaned = cleaned.slice(arrayStart, arrayEnd + 1);
      let items;
      try {
        items = JSON.parse(cleaned);
      } catch (e1) {
        // Fallback: try to extract individual objects with regex
        try {
          const matches = cleaned.match(/\{[^{}]+\}/g);
          if (matches) {
            items = matches.map(m => { try { return JSON.parse(m); } catch { return null; } }).filter(Boolean);
          }
        } catch (e2) { /* give up */ }
      }
      if (Array.isArray(items) && items.length > 0) {
        setParsedPrices(items.map((p, i) => ({
          id: Date.now() + i,
          name: p.invoice_name || p.name || "",
          price: typeof p.price === "number" ? p.price : parseFloat(p.price) || 0,
          unit: p.unit || "",
          qty: p.qty || 1,
          matched: null,
          suggestedMatch: p.matched_name || "",
        })));
      } else setParseError("No prices found in image.");
    } catch (err) { setParseError("Failed to process: " + err.message); }
    setParsing(false);
  };

  // ── CSV upload ──────────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(""); setParsedPrices([]);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setParseError("No data rows found."); return; }
        const sep = lines[0].includes("\t") ? "\t" : ",";
        const headers = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ""));
        let nameCol = headers.findIndex(h => h.match(/item|name|product|description/i));
        let priceCol = headers.findIndex(h => h.match(/price|cost|amount|total/i));
        let unitCol = headers.findIndex(h => h.match(/unit|uom|pkg/i));
        if (nameCol === -1) nameCol = 0;
        if (priceCol === -1) priceCol = 1;
        const items = lines.slice(1).map((line, i) => {
          const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
          const name = cols[nameCol] || "";
          const price = parseFloat((cols[priceCol] || "").replace(/[$,]/g, ""));
          if (!name || isNaN(price)) return null;
          return { id: Date.now() + i, name, price, unit: cols[unitCol] || "", matched: null };
        }).filter(Boolean);
        if (items.length > 0) setParsedPrices(items);
        else setParseError("No valid price rows found.");
      } catch (err) { setParseError("Parse error: " + err.message); }
    };
    reader.readAsText(file);
  };

  // ── Match parsed prices to inventory items ──────────────────────────────
  const matchItem = (parsedIdx, itemId) => {
    const item = allItems.find(i => i.id === itemId);
    const upu = item?.upu || 1;
    setParsedPrices(prev => prev.map((p, i) => {
      if (i !== parsedIdx) return p;
      // If UPU > 1 and the qty hasn't already been expanded, multiply it
      const currentQty = p.qty || 1;
      const alreadyExpanded = p._upu && p._upu > 1;
      const newQty = (!alreadyExpanded && upu > 1) ? currentQty * upu : currentQty;
      return { ...p, matched: itemId, qty: newQty, _upu: upu };
    }));
  };

  const saveParsedPrices = (source) => {
    const newPH = { ...priceHistory };
    parsedPrices.forEach(p => {
      if (!p.matched || isNaN(p.price)) return;
      const item = allItems.find(i => i.id === p.matched);
      const qty = Math.max(1, p.qty || 1);
      const perUnit = Math.round((p.price / qty) * 10000) / 10000;
      if (!newPH[p.matched]) newPH[p.matched] = [];
      newPH[p.matched].push({ price: perUnit, perUnit, basis: "unit", date: getSelectedDate(), weekKey: wk, vendor: item?.vendor || "", source });
    });
    savePriceHistory(newPH);
    setParsedPrices([]);
    setMode("dashboard");
  };

  // ── Auto-match by name similarity ───────────────────────────────────────
  const autoMatchItem = (p) => {
    let match = null;
    // 1. Try AI's suggested match first
    if (p.suggestedMatch) {
      match = allItems.find(i => i.name.toLowerCase() === p.suggestedMatch.toLowerCase());
      if (!match) match = allItems.find(i => i.name.toLowerCase().includes(p.suggestedMatch.toLowerCase()) || p.suggestedMatch.toLowerCase().includes(i.name.toLowerCase()));
    }
    // 2. Exact name match
    if (!match) {
      const lower = (p.name || "").toLowerCase().replace(/[^a-z0-9 ]/g, "");
      match = allItems.find(i => i.name.toLowerCase() === lower);
      // 3. Fuzzy — check if key words overlap
      if (!match) {
        const words = lower.split(/\s+/).filter(w => w.length > 2);
        let bestMatch = null, bestScore = 0;
        allItems.forEach(item => {
          const iWords = item.name.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(w => w.length > 2);
          const overlap = words.filter(w => iWords.some(iw => iw.includes(w) || w.includes(iw))).length;
          const score = overlap / Math.max(words.length, iWords.length, 1);
          if (score > bestScore && score >= 0.4) { bestScore = score; bestMatch = item; }
        });
        match = bestMatch;
      }
    }
    if (!match) return p;
    // Auto-expand qty by UPU if item has units-per-package > 1
    // e.g. Frank's Red Hot: invoice says 1 Case, UPU=4 → qty becomes 4 so price tracks per gallon
    const upu = match.upu || 1;
    const invoiceQty = p.qty || 1;
    const expandedQty = invoiceQty * upu;
    return { ...p, matched: match.id, qty: expandedQty, _upu: upu };
  };

  React.useEffect(() => {
    if (parsedPrices.length === 0) return;
    setParsedPrices(prev => prev.map(p => p.matched ? p : autoMatchItem(p)));
  }, [parsedPrices.length]);

  // ── Build dashboard data ────────────────────────────────────────────────
  // Everything compared/displayed per ORDER unit (what you pay the vendor for a
  // case/bag/each) via the shared helpers — consistent across mixed entry formats.
  const flagged = [];
  const allTracked = [];
  allItems.forEach(item => {
    const itemPH = priceHistory[item.id];
    if (!itemPH || itemPH.length === 0) return;
    const upu = Math.max(1, Number(item.upu) || 1);
    const sorted = [...itemPH].sort((a, b) => new Date(b.date) - new Date(a.date));
    const current = sorted[0];
    const previous = sorted[1];
    const curPrice = entryPerUnit(current, upu) * upu;
    const prevPrice = previous ? entryPerUnit(previous, upu) * upu : null;
    const entry = { id: item.id, name: item.name, vendor: item.vendor || "", unit: item.order_unit, currentPrice: curPrice, currentDate: current.date, currentWeek: current.weekKey, previousPrice: prevPrice, previousDate: previous?.date || null, totalEntries: sorted.length, priceHistory: sorted };
    if (previous && prevPrice > 0) {
      entry.change = curPrice - prevPrice;
      entry.changePct = ((entry.change / prevPrice) * 100).toFixed(1);
    }
    allTracked.push(entry);
    if (entry.change && entry.change > 0.001) flagged.push(entry);
  });

  flagged.sort((a, b) => parseFloat(b.changePct) - parseFloat(a.changePct));
  const filteredTracked = allTracked.filter(e => (filterVendor === "ALL" || e.vendor === filterVendor) && (!search || e.name.toLowerCase().includes(search.toLowerCase())));

  // Items for manual entry
  const manualItems = allItems.filter(i => (filterVendor === "ALL" || (i.vendor || "") === filterVendor) && (!search || i.name.toLowerCase().includes(search.toLowerCase())));

  // ══ FOOD COST ADD-ON ═══════════════════════════════════════════════════════
  // Standing price PER ORDER UNIT (what one case/bag/each costs) — this is what
  // the review inputs hold, since line totals = price × qty-in-order-units.
  const standingPrice = (itemId) => {
    const item = allItems.find(i => i.id === itemId);
    const p = latestPerOrderUnit(priceHistory, item || { id: itemId, upu: 1 });
    return p == null ? null : Math.round(p * 100) / 100;
  };
  // Last price an item was costed at in a previous order (for comparison)
  const lastOrderedPrice = (itemId, beforeDate) => {
    const costedOrders = (history || [])
      .filter(o => o.costed && new Date(o.date) < new Date(beforeDate))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const o of costedOrders) {
      const line = (o.lines || []).find(l => l.id === itemId && l.unitPrice != null);
      if (line) return line.unitPrice;
    }
    return null;
  };

  // All orders with line items, newest first (the dashboard is order-driven)
  const allOrders = (history || [])
    .filter(o => (o.lines || []).length > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const pendingOrders = allOrders.filter(o => !o.costed);
  const reviewedOrders = allOrders.filter(o => o.costed);
  const [openOrders, setOpenOrders] = useState({}); // re-opened confirmed orders

  // Weekly food spend from costed orders
  const weeklySpend = {};
  if (foodCost) {
    (history || []).forEach(o => {
      if (!o.costed) return;
      const key = `${o.year}-WK${String(o.weekNumber).padStart(2,"0")}`;
      if (!weeklySpend[key]) weeklySpend[key] = { total: 0, orders: 0, vendors: {} };
      weeklySpend[key].total += o.total || 0;
      weeklySpend[key].orders += 1;
      weeklySpend[key].vendors[o.vendor] = (weeklySpend[key].vendors[o.vendor] || 0) + (o.total || 0);
    });
  }
  const spendWeeks = Object.keys(weeklySpend).sort().reverse();

  // ── Order lookup: by week or custom date range ──────────────────────────
  const [lookupMode, setLookupMode] = useState("none"); // "none" | "week" | "range"
  const [lookupWeek, setLookupWeek] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  // Build week options from all orders (for the week dropdown)
  const orderWeeks = [...new Set(allOrders.map(o => `${o.year}-WK${String(o.weekNumber).padStart(2,"0")}`))].sort().reverse();

  const lookupResults = (() => {
    if (lookupMode === "week" && lookupWeek) {
      return allOrders.filter(o => `${o.year}-WK${String(o.weekNumber).padStart(2,"0")}` === lookupWeek);
    }
    if (lookupMode === "range" && rangeStart && rangeEnd) {
      const s = new Date(rangeStart); s.setHours(0,0,0,0);
      const e = new Date(rangeEnd); e.setHours(23,59,59,999);
      return allOrders.filter(o => { const d = new Date(o.date); return d >= s && d <= e; });
    }
    return null;
  })();
  const lookupTotal = lookupResults ? lookupResults.reduce((sum, o) => sum + (o.total || 0), 0) : 0;
  const lookupVendor = (() => {
    if (!lookupResults) return {};
    const v = {};
    lookupResults.forEach(o => { v[o.vendor] = (v[o.vendor] || 0) + (o.total || 0); });
    return v;
  })();

  // Local editable review state: { [orderId]: { [lineIdx]: { price, status } } }
  const [reviewEdits, setReviewEdits] = useState({});
  // Defaults come from the line itself (standing price + what check-in recorded);
  // reviewEdits only holds what the user changed here.
  const getLineEdit = (orderId, idx, line) => {
    const sp = standingPrice(line.id);
    const base = { price: sp != null ? String(sp) : "", status: line.delivered || "delivered" };
    return { ...base, ...(reviewEdits[orderId]?.[idx] || {}) };
  };
  const setLineEdit = (orderId, idx, patch) => {
    setReviewEdits(prev => ({ ...prev, [orderId]: { ...(prev[orderId] || {}), [idx]: { ...(prev[orderId]?.[idx] || {}), ...patch } } }));
  };
  // Quantity actually received for costing: short deliveries use the checked-in count.
  const receivedQtyOf = (line, status) => {
    if (status === "delivered") return Number(line.qty) || 0;
    if (status === "short") return Number(line.receivedQty ?? 0) || 0;
    return 0;
  };

  const confirmReview = (order) => {
    let total = 0;
    const newLines = (order.lines || []).map((line, idx) => {
      const e = getLineEdit(order.id, idx, line);
      const price = parseFloat(e.price) || 0;
      const lineTotal = price * receivedQtyOf(line, e.status);
      total += lineTotal;
      return { ...line, unitPrice: price, delivered: e.status };
    });
    // Update standing prices in inventory's priceHistory where changed
    const newPH = { ...priceHistory };
    newLines.forEach(line => {
      if (line.unitPrice > 0 && line.delivered === "delivered") {
        const sp = standingPrice(line.id);
        if (sp == null || Math.abs(sp - line.unitPrice) > 0.001) {
          const invItem = allItems.find(i => i.id === line.id);
          const upu = Math.max(1, Number(invItem?.upu) || 1);
          if (!newPH[line.id]) newPH[line.id] = [];
          // unitPrice is per ORDER unit — store per-individual perUnit alongside it
          newPH[line.id] = [...newPH[line.id], { price: line.unitPrice, perUnit: Math.round((line.unitPrice / upu) * 10000) / 10000, basis: "unit", qty: upu, unit: line.order_unit, date: order.date, weekKey: `${order.year}-WK${String(order.weekNumber).padStart(2,"0")}`, vendor: order.vendor, source: "order-review" }];
        }
      }
    });
    savePriceHistory(newPH);
    // Mark order costed
    const newHistory = (history || []).map(o => o.id === order.id ? { ...o, costed: true, total: Math.round(total * 100) / 100, lines: newLines, costedAt: new Date().toISOString() } : o);
    saveHistory(newHistory);
    setReviewEdits(prev => { const n = { ...prev }; delete n[order.id]; return n; });
  };

  const reviewTotal = (order) => {
    let total = 0;
    (order.lines || []).forEach((line, idx) => {
      const e = getLineEdit(order.id, idx, line);
      total += (parseFloat(e.price) || 0) * receivedQtyOf(line, e.status);
    });
    return total;
  };

  // Re-open a confirmed order to edit its prices again
  const reopenOrder = (order) => {
    // seed review edits from the saved line prices/status
    const seed = {};
    (order.lines || []).forEach((line, idx) => {
      seed[idx] = { price: line.unitPrice != null ? String(line.unitPrice) : (standingPrice(line.id) != null ? String(standingPrice(line.id)) : ""), status: line.delivered || "delivered" };
    });
    setReviewEdits(prev => ({ ...prev, [order.id]: seed }));
    const newHistory = (history || []).map(o => o.id === order.id ? { ...o, costed: false } : o);
    saveHistory(newHistory);
    setOpenOrders(prev => ({ ...prev, [order.id]: true }));
  };

  const statusOpts = [
    { v:"delivered", label:"Delivered" },
    { v:"out_of_stock", label:"Out of stock" },
    { v:"damaged", label:"Damaged" },
    { v:"not_ordered", label:"Not on order" },
  ];

  // Full editable order card (used for pending + re-opened orders)
  const renderOrderCard = (order, editable) => {
    const wn = order.weekNumber;
    const mon = getWeekMonday(wn, order.year).toLocaleDateString("en-US",{month:"short",day:"numeric"});
    return (
      <div key={order.id} style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:14, overflow:"hidden" }}>
        <div style={{ background:"#0f1a2e", padding:"12px 16px", borderBottom:"1px solid #1e2d45", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Icon name="orders" size={16} color="#38bdf8" />
            <span style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>{order.vendor}</span>
            <span style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace" }}>WK{wn} · Mon {mon}</span>
          </div>
          <div style={{ color:"#34d399", fontSize:18, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>${reviewTotal(order).toFixed(2)}</div>
        </div>
        <div style={{ padding:"4px 0" }}>
          {(order.lines || []).map((line, idx) => {
            const e = getLineEdit(order.id, idx, line);
            const last = lastOrderedPrice(line.id, order.date);
            const changed = last != null && Math.abs((parseFloat(e.price)||0) - last) > 0.001;
            const notDelivered = e.status !== "delivered";
            return (
              <div key={idx} style={{ padding:"10px 16px", borderBottom: idx < order.lines.length-1 ? "1px solid #0f1a2e" : "none", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", opacity: notDelivered ? 0.55 : 1 }}>
                <div style={{ flex:"1 1 140px", minWidth:0 }}>
                  <div style={{ color:"#e2e8f0", fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{line.name}</div>
                  <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{qtyText(line)}</div>
                </div>
                <div style={{ textAlign:"right", minWidth:60 }}>
                  <div style={{ color:"#475569", fontSize:9, fontFamily:"'DM Mono',monospace" }}>LAST</div>
                  <div style={{ color:"#64748b", fontSize:13, fontFamily:"'DM Mono',monospace" }}>{last != null ? `$${last.toFixed(2)}` : "—"}</div>
                </div>
                <div style={{ minWidth:80 }}>
                  <div style={{ color: changed ? "#fbbf24" : "#475569", fontSize:9, fontFamily:"'DM Mono',monospace", textAlign:"right" }}>{changed ? "CHANGED" : "PRICE"}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:2 }}>
                    <span style={{ color:"#64748b", fontSize:13 }}>$</span>
                    <input type="number" inputMode="decimal" value={e.price} disabled={notDelivered}
                      onFocus={ev => ev.target.select()}
                      onChange={ev => setLineEdit(order.id, idx, { price: ev.target.value, status: e.status, id: line.id })}
                      style={{ width:62, background:"#080c14", border:`1px solid ${changed ? "#d97706" : "#1e2d45"}`, borderRadius:6, padding:"6px 8px", color: changed ? "#fbbf24" : "#f1f5f9", fontSize:14, outline:"none", fontFamily:"'DM Mono',monospace", textAlign:"right" }} />
                  </div>
                </div>
                <select value={e.status} onChange={ev => setLineEdit(order.id, idx, { status: ev.target.value, price: e.price, id: line.id })}
                  style={{ background:"#080c14", border:`1px solid ${notDelivered ? "#7f1d1d" : "#1e2d45"}`, borderRadius:6, padding:"6px 8px", color: notDelivered ? "#fca5a5" : "#94a3b8", fontSize:11, outline:"none", cursor:"pointer" }}>
                  {statusOpts.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
                <div style={{ minWidth:64, textAlign:"right" }}>
                  <div style={{ color:"#475569", fontSize:9, fontFamily:"'DM Mono',monospace" }}>TOTAL</div>
                  <div style={{ color: notDelivered ? "#475569" : "#34d399", fontSize:14, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{notDelivered ? "—" : `$${((parseFloat(e.price)||0)*(line.qty||0)).toFixed(2)}`}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding:"12px 16px", borderTop:"1px solid #1e2d45", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <span style={{ color:"#64748b", fontSize:12 }}>Order total <strong style={{ color:"#34d399", fontFamily:"'DM Mono',monospace" }}>${reviewTotal(order).toFixed(2)}</strong></span>
          <button onClick={() => { confirmReview(order); setOpenOrders(prev => { const n = {...prev}; delete n[order.id]; return n; }); }}
            style={{ background:"#34d399", border:"none", borderRadius:8, padding:"9px 20px", color:"#060a12", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            Confirm prices
          </button>
        </div>
      </div>
    );
  };

  // Collapsed confirmed order row — tap to re-open
  const renderConfirmedRow = (order) => {
    const wn = order.weekNumber;
    const mon = getWeekMonday(wn, order.year).toLocaleDateString("en-US",{month:"short",day:"numeric"});
    const notDelivered = (order.lines || []).filter(l => l.delivered && l.delivered !== "delivered").length;
    return (
      <div key={order.id} style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
          <Icon name="check" size={15} color="#34d399" />
          <span style={{ color:"#e2e8f0", fontSize:14, fontWeight:600 }}>{order.vendor}</span>
          <span style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace" }}>WK{wn} · Mon {mon} · {order.totalItems} item{order.totalItems!==1?"s":""}{notDelivered ? ` · ${notDelivered} not delivered` : ""}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ color:"#34d399", fontSize:16, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>${(order.total || 0).toFixed(2)}</span>
          <button onClick={() => reopenOrder(order)}
            style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:7, padding:"6px 12px", color:"#60a5fa", fontSize:12, cursor:"pointer" }}>
            Edit
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:0, display:"flex", alignItems:"center", gap:8 }}><Icon name="prices" size={20} color="#38bdf8" />Price Tracker</h2>
          <p style={{ color:"#475569", fontSize:13, margin:"4px 0 0" }}>Track vendor prices week to week — flag increases automatically</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Items tracked", value:allTracked.length, color:"#a5b4fc", bg:"#0f2040", border:"#1e40af" },
          { label:"Price increases", value:flagged.length, color:"#fca5a5", bg:"#450a0a", border:"#7f1d1d" },
          { label:"Biggest jump", value: flagged[0] ? `+${flagged[0].changePct}%` : "—", color:"#fbbf24", bg:"#422006", border:"#d97706" },
          { label:"This week", value: allTracked.filter(e => e.currentWeek === wk).length, color:"#4ade80", bg:"#052e16", border:"#16a34a" },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:"12px 16px" }}>
            <div style={{ color:c.color, fontSize:22, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{c.value}</div>
            <div style={{ color:c.color, fontSize:11, opacity:0.8, marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap", alignItems:"center" }}>
        {[
          { key:"dashboard", label:"Dashboard" },
          { key:"upload", label:"Upload Invoice" },
        ].map(tab => (
          <button key={tab.key} onClick={() => { setMode(tab.key); setParsedPrices([]); setParseError(""); }}
            style={{ background:mode===tab.key?"#e2e8f0":"transparent", border:`1px solid ${mode===tab.key?"#e2e8f0":"#1e2d45"}`, borderRadius:8, padding:"7px 16px", color:mode===tab.key?"#080c14":"#64748b", fontSize:13, fontWeight:mode===tab.key?600:400, cursor:"pointer" }}>
            {tab.label}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:8, flexWrap:"wrap" }}>
          {vendorNames.length > 0 && (
            <select value={filterVendor} onChange={e => setFilterVendor(e.target.value)}
              style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"7px 12px", color:"#f1f5f9", fontSize:12, outline:"none", cursor:"pointer" }}>
              <option value="ALL">All Vendors</option>
              {vendorNames.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}
          {mode === "dashboard" && <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:8, padding:"7px 12px", color:"#f1f5f9", fontSize:12, outline:"none", width:140 }} />}
        </div>
      </div>

      {/* Week picker — shown when uploading prices */}
      {(mode === "upload") && (
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <span style={{ color:"#94a3b8", fontSize:12, fontWeight:600 }}>Prices for:</span>
          <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
            style={{ background:"#0f1a2e", border:`1px solid ${selectedWeek !== currentWk ? "#d97706" : "#1e2d45"}`, borderRadius:8, padding:"7px 12px", color: selectedWeek !== currentWk ? "#fbbf24" : "#f1f5f9", fontSize:12, outline:"none", cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>
            {weekOptions.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
          </select>
          {selectedWeek !== currentWk && (
            <span style={{ background:"#422006", border:"1px solid #d97706", borderRadius:6, padding:"3px 10px", color:"#fbbf24", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
              Past week
            </span>
          )}
        </div>
      )}

      {/* ── ORDERS (review pending, view/edit confirmed) + WEEKLY SPEND ── */}
      {mode === "dashboard" && (
        <>
          {/* Weekly spend summary — only when food cost add-on is on */}
          {foodCost && spendWeeks.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ color:"#34d399", fontSize:13, fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                <Icon name="prices" size={15} color="#34d399" /> Weekly Food Spend
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10 }}>
                {spendWeeks.slice(0, 4).map((wkKey, i) => {
                  const w = weeklySpend[wkKey];
                  const wn = wkKey.split("-WK")[1];
                  const mon = getWeekMonday(parseInt(wn), parseInt(wkKey.split("-WK")[0])).toLocaleDateString("en-US",{month:"short",day:"numeric"});
                  const prevW = weeklySpend[spendWeeks[i+1]];
                  const diff = prevW ? w.total - prevW.total : 0;
                  return (
                    <div key={wkKey} style={{ background: i===0 ? "rgba(52,211,153,0.08)" : "#0c1220", border:`1px solid ${i===0 ? "rgba(52,211,153,0.3)" : "#1e2d45"}`, borderRadius:12, padding:"14px 16px" }}>
                      <div style={{ color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", marginBottom:4 }}>WK{wn} · Mon {mon}</div>
                      <div style={{ color: i===0 ? "#34d399" : "#e2e8f0", fontSize:24, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>${w.total.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
                      <div style={{ color:"#64748b", fontSize:11, marginTop:3 }}>
                        {w.orders} order{w.orders!==1?"s":""}
                        {prevW && diff !== 0 && <span style={{ color: diff > 0 ? "#fca5a5" : "#34d399", marginLeft:6 }}>{diff > 0 ? "▲" : "▼"} ${Math.abs(Math.round(diff))}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LOOK UP A WEEK OR DATE RANGE ── */}
          {allOrders.length > 0 && (
            <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: lookupMode !== "none" ? 12 : 0, flexWrap:"wrap" }}>
                <Icon name="history" size={15} color="#60a5fa" />
                <span style={{ color:"#e2e8f0", fontSize:13, fontWeight:600 }}>Look up orders</span>
                <div style={{ display:"flex", gap:6, marginLeft:"auto", flexWrap:"wrap" }}>
                  {[{k:"none",l:"Off"},{k:"week",l:"By week"},{k:"range",l:"Date range"}].map(o => (
                    <button key={o.k} onClick={() => setLookupMode(o.k)}
                      style={{ background: lookupMode===o.k ? "#1e3a5f" : "transparent", border:`1px solid ${lookupMode===o.k ? "#38bdf8" : "#1e2d45"}`, borderRadius:7, padding:"5px 12px", color: lookupMode===o.k ? "#38bdf8" : "#64748b", fontSize:12, fontWeight:lookupMode===o.k?600:400, cursor:"pointer" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {lookupMode === "week" && (
                <select value={lookupWeek} onChange={e => setLookupWeek(e.target.value)}
                  style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"9px 12px", color:"#f1f5f9", fontSize:14, outline:"none", cursor:"pointer" }}>
                  <option value="">Select a week…</option>
                  {orderWeeks.map(wk => {
                    const wn = wk.split("-WK")[1]; const yr = wk.split("-WK")[0];
                    const mon = getWeekMonday(parseInt(wn), parseInt(yr)).toLocaleDateString("en-US",{month:"short",day:"numeric"});
                    return <option key={wk} value={wk}>WK{wn} · Mon {mon}, {yr}</option>;
                  })}
                </select>
              )}

              {lookupMode === "range" && (
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                  <div style={{ flex:"1 1 140px" }}>
                    <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>From</label>
                    <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                      style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
                  </div>
                  <div style={{ flex:"1 1 140px" }}>
                    <label style={{ display:"block", color:"#64748b", fontSize:10, fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>To</label>
                    <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                      style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 12px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lookup results */}
          {lookupResults && (
            <div style={{ marginBottom:24 }}>
              {lookupResults.length === 0 ? (
                <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:12, padding:24, textAlign:"center", color:"#64748b", fontSize:14 }}>
                  No orders found for this {lookupMode === "week" ? "week" : "date range"}.
                </div>
              ) : (
                <>
                  {/* Period summary */}
                  <div style={{ background:"rgba(96,165,250,0.06)", border:"1px solid rgba(96,165,250,0.25)", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
                    <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                      <div>
                        <div style={{ color:"#64748b", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{lookupResults.length} order{lookupResults.length!==1?"s":""} found</div>
                        {foodCost && <div style={{ color:"#60a5fa", fontSize:26, fontWeight:700, fontFamily:"'DM Mono',monospace", marginTop:2 }}>${lookupTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>}
                      </div>
                      {foodCost && Object.keys(lookupVendor).length > 0 && (
                        <div style={{ textAlign:"right" }}>
                          {Object.entries(lookupVendor).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([v,amt]) => (
                            <div key={v} style={{ color:"#94a3b8", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{v} <span style={{ color:"#e2e8f0", fontWeight:600 }}>${amt.toFixed(0)}</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Order rows */}
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {lookupResults.map(order => order.costed && !openOrders[order.id] ? renderConfirmedRow(order) : renderOrderCard(order, true))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Submitted orders awaiting price review */}
          {lookupMode === "none" && pendingOrders.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ color:"#fbbf24", fontSize:13, fontWeight:700, marginBottom:4, display:"flex", alignItems:"center", gap:6 }}>
                <Icon name="doc" size={15} color="#fbbf24" /> Price check ({pendingOrders.length})
              </div>
              <p style={{ color:"#64748b", fontSize:12, margin:"0 0 12px", lineHeight:1.5 }}>
                Last price is carried over — only edit what changed. Mark anything that didn't arrive.{foodCost ? " Confirm to add it to your weekly spend." : " Confirm to lock in the prices."}
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {pendingOrders.map(order => renderOrderCard(order, true))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── FLAGGED INCREASES ── */}
      {mode === "dashboard" && flagged.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ color:"#fca5a5", fontSize:13, fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>🚩 Price Increases Detected <span style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:10, padding:"1px 8px", fontSize:11 }}>{flagged.length}</span></div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {flagged.map(e => (
              <div key={e.id} style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:180 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:600 }}>{e.name}</span>
                    {e.vendor && <span style={{ background:"#0f2040", border:"1px solid #1e3a5f", borderRadius:4, padding:"1px 6px", color:"#94a3b8", fontSize:9, fontFamily:"'DM Mono',monospace" }}>{e.vendor}</span>}
                  </div>
                  <div style={{ color:"#7f1d1d", fontSize:11, fontFamily:"'DM Mono',monospace", marginTop:3 }}>{e.unit}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#64748b", fontSize:10, fontFamily:"'DM Mono',monospace" }}>PREVIOUS</div>
                    <div style={{ color:"#94a3b8", fontSize:15, fontFamily:"'DM Mono',monospace", textDecoration:"line-through" }}>${e.previousPrice.toFixed(2)}</div>
                  </div>
                  <span style={{ color:"#475569", fontSize:14 }}>→</span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ color:"#64748b", fontSize:10, fontFamily:"'DM Mono',monospace" }}>CURRENT</div>
                    <div style={{ color:"#fca5a5", fontSize:15, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>${e.currentPrice.toFixed(2)}</div>
                  </div>
                  <span style={{ background:"#7f1d1d", color:"#fca5a5", borderRadius:6, padding:"4px 10px", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>+{e.changePct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DASHBOARD ── */}
      {mode === "dashboard" && lookupMode === "none" && pendingOrders.length === 0 && (
        <div style={{ background:"#0c1220", border:"1px solid #1e2d45", borderRadius:16, padding:36, textAlign:"center" }}>
          <Icon name="check" size={34} color="#34d399" style={{ marginBottom:12 }} />
          <div style={{ color:"#94a3b8", fontSize:16, fontWeight:600 }}>{allOrders.length > 0 ? "All caught up" : "No orders yet"}</div>
          <div style={{ color:"#475569", fontSize:13, marginTop:6, lineHeight:1.6, maxWidth:380, margin:"6px auto 0" }}>
            {allOrders.length > 0
              ? "Every submitted order has been priced. New orders will show up here for a quick price check."
              : "Submit an order and it shows up here grouped by vendor — like that vendor's receipt. Set each item's price once, then just confirm or tweak what changed each week."}
          </div>
        </div>
      )}

      {/* ── UPLOAD INVOICE ── */}
      {mode === "upload" && parsedPrices.length === 0 && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
            <div style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"32px 20px", textAlign:"center", cursor:"pointer" }}
              onClick={() => photoRef.current?.click()}
              onMouseEnter={e => e.currentTarget.style.borderColor="#e2e8f0"} onMouseLeave={e => e.currentTarget.style.borderColor="#1e2d45"}>
              <input ref={photoRef} type="file" accept="image/*,application/pdf" onChange={handlePhotoUpload} style={{ display:"none" }} />
              <div style={{ fontSize:32, marginBottom:8 }}>📸</div>
              <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600, marginBottom:4 }}>Photo or PDF of Invoice</div>
              <div style={{ color:"#475569", fontSize:12 }}>AI extracts item prices from photos & PDFs</div>
            </div>
            <div style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:16, padding:"32px 20px", textAlign:"center", cursor:"pointer" }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => e.currentTarget.style.borderColor="#e2e8f0"} onMouseLeave={e => e.currentTarget.style.borderColor="#1e2d45"}>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileUpload} style={{ display:"none" }} />
              <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
              <div style={{ color:"#f1f5f9", fontSize:14, fontWeight:600, marginBottom:4 }}>Upload Price List</div>
              <div style={{ color:"#475569", fontSize:12 }}>CSV with item names & prices</div>
            </div>
          </div>
          {parsing && <div style={{ textAlign:"center", color:"#a5b4fc", fontSize:14, padding:20 }}>Analyzing invoice with AI...</div>}
          {parseError && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13 }}>{parseError}</div>}
        </div>
      )}

      {/* ── MATCH & SAVE PARSED PRICES ── */}
      {parsedPrices.length > 0 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ color:"#f1f5f9", fontSize:15, fontWeight:700 }}>{parsedPrices.length} prices extracted</div>
              <div style={{ color:"#475569", fontSize:12 }}>{parsedPrices.filter(p => p.matched).length} matched · Click any field to edit · ✕ to remove</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => { setParsedPrices([]); setMode("dashboard"); }} style={{ background:"transparent", border:"1px solid #1e2d45", borderRadius:8, padding:"8px 14px", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>Cancel</button>
              <button onClick={() => saveParsedPrices("invoice")} style={{ background:"linear-gradient(135deg,#22c55e,#16a34a)", border:"none", borderRadius:8, padding:"8px 18px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                Save {parsedPrices.filter(p => p.matched).length} Prices
              </button>
            </div>
          </div>
          <div style={{ overflowX:"auto", border:"1px solid #1e2d45", borderRadius:12 }}>
            <table style={{ width:"100%", minWidth:700, borderCollapse:"collapse", background:"#0f1a2e" }}>
              <thead>
                <tr style={{ background:"#080c14" }}>
                  <th style={{ padding:"8px 10px", textAlign:"left", color:"#64748b", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>Invoice Item</th>
                  <th style={{ padding:"8px 10px", textAlign:"right", color:"#64748b", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.5px", width:80 }}>Total $</th>
                  <th style={{ padding:"8px 10px", textAlign:"center", color:"#64748b", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.5px", width:50 }}>Qty</th>
                  <th style={{ padding:"8px 10px", textAlign:"right", color:"#64748b", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.5px", width:80 }}>Per Unit</th>
                  <th style={{ padding:"8px 10px", textAlign:"left", color:"#64748b", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.5px", width:55 }}>Unit</th>
                  <th style={{ padding:"8px 10px", textAlign:"left", color:"#64748b", fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.5px", minWidth:140 }}>Match To</th>
                  <th style={{ width:30 }} />
                </tr>
              </thead>
              <tbody>
                {parsedPrices.map((p, idx) => {
                  const matchedItem = p.matched ? allItems.find(i => i.id === p.matched) : null;
                  const updateField = (field, val) => setParsedPrices(prev => prev.map((pp, i) => i === idx ? { ...pp, [field]: val } : pp));
                  const removeRow = () => setParsedPrices(prev => prev.filter((_, i) => i !== idx));
                  const perUnit = (p.qty && p.qty > 0) ? (p.price / p.qty) : p.price;
                  const rowBg = idx % 2 === 0 ? "#0f1a2e" : "#0a1220";
                  return (
                    <tr key={p.id} style={{ background:rowBg, borderTop:idx>0?"1px solid #080c14":"none" }}>
                      <td style={{ padding:"6px 10px" }}>
                        <input value={p.name} onChange={e => updateField("name", e.target.value)}
                          style={{ width:"100%", minWidth:120, background:"transparent", border:"1px solid transparent", borderRadius:4, padding:"4px 6px", color:"#f1f5f9", fontSize:12, outline:"none", boxSizing:"border-box" }}
                          onFocus={e => { e.currentTarget.style.borderColor="#1e2d45"; e.target.select(); }} onBlur={e => e.currentTarget.style.borderColor="transparent"} />
                      </td>
                      <td style={{ padding:"6px 10px" }}>
                        <input type="number" value={p.price} step="0.01" onChange={e => updateField("price", parseFloat(e.target.value) || 0)}
                          style={{ width:70, background:"transparent", border:"1px solid transparent", borderRadius:4, padding:"4px 6px", color:"#f1f5f9", fontSize:13, fontWeight:600, fontFamily:"'DM Mono',monospace", textAlign:"right", outline:"none", boxSizing:"border-box" }}
                          onFocus={e => { e.currentTarget.style.borderColor="#1e2d45"; e.target.select(); }} onBlur={e => e.currentTarget.style.borderColor="transparent"} />
                      </td>
                      <td style={{ padding:"6px 10px", textAlign:"center" }}>
                        <input type="number" value={p.qty || 1} min={1} onChange={e => updateField("qty", parseInt(e.target.value) || 1)}
                          style={{ width:40, background:"transparent", border:"1px solid transparent", borderRadius:4, padding:"4px 4px", color:"#94a3b8", fontSize:12, fontFamily:"'DM Mono',monospace", textAlign:"center", outline:"none", boxSizing:"border-box" }}
                          onFocus={e => { e.currentTarget.style.borderColor="#1e2d45"; e.target.select(); }} onBlur={e => e.currentTarget.style.borderColor="transparent"} />
                      </td>
                      <td style={{ padding:"6px 10px", textAlign:"right" }}>
                        <span style={{ color:"#4ade80", fontSize:13, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>${perUnit.toFixed(2)}</span>
                        {p._upu > 1 && <div style={{ color:"#475569", fontSize:8, fontFamily:"'DM Mono',monospace" }}>{p._upu}/pkg</div>}
                      </td>
                      <td style={{ padding:"6px 10px" }}>
                        <input value={p.unit || ""} onChange={e => updateField("unit", e.target.value)} placeholder="—"
                          style={{ width:45, background:"transparent", border:"1px solid transparent", borderRadius:4, padding:"4px 4px", color:"#475569", fontSize:11, fontFamily:"'DM Mono',monospace", outline:"none", boxSizing:"border-box" }}
                          onFocus={e => { e.currentTarget.style.borderColor="#1e2d45"; e.target.select(); }} onBlur={e => e.currentTarget.style.borderColor="transparent"} />
                      </td>
                      <td style={{ padding:"6px 10px" }}>
                        <select value={p.matched || ""} onChange={e => { if (e.target.value) matchItem(idx, parseInt(e.target.value)); else updateField("matched", null); }}
                          style={{ width:"100%", minWidth:130, background:"#080c14", border:`1px solid ${matchedItem ? "#16a34a" : "#7f1d1d"}`, borderRadius:6, padding:"4px 6px", color:matchedItem ? "#4ade80" : "#fca5a5", fontSize:11, outline:"none", cursor:"pointer" }}>
                          <option value="">Match to item...</option>
                          {allItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:"6px 4px", textAlign:"center" }}>
                        <button onClick={removeRow} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:14, padding:0 }}
                          onMouseEnter={e => e.currentTarget.style.color="#ef4444"} onMouseLeave={e => e.currentTarget.style.color="#475569"}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING FLOW — Guide new owners through setup
// ═══════════════════════════════════════════════════════════════════════════════
function OnboardingFlow({ user, step, vendors, saveVendors, inventory, saveInventory, onStep, onComplete }) {
  const [currentStep, setCurrentStep] = useState(step || 1);
  const [vendorName, setVendorName] = useState("");
  const [vendorDays, setVendorDays] = useState([]);
  const [addedVendors, setAddedVendors] = useState(vendors.filter(v => v.name.trim()));
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const photoRef = React.useRef(null);

  const goTo = (s) => { setCurrentStep(s); onStep(s); };

  // Add a vendor
  const addVendor = () => {
    if (!vendorName.trim()) return;
    const newVendor = { id: Date.now(), name: vendorName.trim(), orderDays: vendorDays };
    const updated = [...addedVendors, newVendor];
    setAddedVendors(updated);
    saveVendors(updated);
    setVendorName(""); setVendorDays([]);
  };

  const toggleDay = (dayIdx) => {
    setVendorDays(prev => prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort());
  };

  // Photo import
  const handlePhotoImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const base64 = await compressImage(file);
      const response = await callClaude({
          model: "claude-sonnet-4-20250514", max_tokens: 4000,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: `Extract ALL inventory items from this image. Return ONLY a JSON array, no markdown. Each object: {"name":"item name","order_unit":"Case","vendor":"","max_stock":10,"reorder":2,"upu":1,"section":""}` }
          ]}]
        });
      const data = await response.json();
      const text = (data.content || []).map(c => c.text || "").join("");
      const items = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(items) && items.length > 0) {
        const newSection = { section: "📦  Imported Items", items: items.map((item, idx) => ({
          id: Date.now() + idx, name: item.name || "Item", order_unit: item.order_unit || "Case",
          upu: Math.max(1, intOr(item.upu, 1)), vendor: item.vendor || "", max_stock: intOr(item.max_stock, 10), reorder: intOr(item.reorder, 2),
        }))};
        saveInventory([...inventory, newSection]);
        setImportResult({ success: true, count: items.length });
      } else {
        setImportResult({ success: false, error: "No items found in image." });
      }
    } catch (err) {
      setImportResult({ success: false, error: err.message });
    }
    setImporting(false);
  };

  const inp = { width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 14px", color:"#f1f5f9", fontSize:16, outline:"none", boxSizing:"border-box" };
  const lbl = { display:"block", color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" };

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width:"100%", maxWidth:480 }}>

        {/* Progress bar */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:32 }}>
          {[1,2,3,4].map(s => (
            <React.Fragment key={s}>
              <div style={{ width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, fontFamily:"'DM Mono',monospace",
                background: currentStep >= s ? "#e2e8f0" : "#1e2d45", color: currentStep >= s ? "#080c14" : "#475569", transition:"all 0.3s" }}>
                {currentStep > s ? "✓" : s}
              </div>
              {s < 4 && <div style={{ flex:1, height:2, background: currentStep > s ? "#e2e8f0" : "#1e2d45", borderRadius:1, transition:"all 0.3s" }} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1: WELCOME ── */}
        {currentStep === 1 && (
          <div style={{ textAlign:"center" }}>
            <MoeLogo size="lg" />
            <h1 style={{ color:"#f1f5f9", fontSize:24, fontWeight:700, margin:"24px 0 8px" }}>Welcome to MOE, {user.name?.split(" ")[0]}!</h1>
            <p style={{ color:"#475569", fontSize:14, lineHeight:1.6, margin:"0 0 8px" }}>Let's get your business set up. This takes about 2 minutes.</p>
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:20, margin:"24px 0", textAlign:"left" }}>
              <div style={{ color:"#94a3b8", fontSize:12, fontWeight:600, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Here's what we'll do:</div>
              {[
                { icon:"📦", text:"Add your vendors and order days" },
                { icon:"📋", text:"Import your items (photo, file, or manual)" },
                { icon:"👥", text:"Invite your team (optional)" },
              ].map((item, idx) => (
                <div key={idx} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderTop:idx>0?"1px solid #080c14":"none" }}>
                  <span style={{ fontSize:18 }}>{item.icon}</span>
                  <span style={{ color:"#e2e8f0", fontSize:14 }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => goTo(2)} style={{ width:"100%", background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:10, padding:"14px", color:"#080c14", fontSize:16, fontWeight:700, cursor:"pointer" }}>
              Let's Go
            </button>
            <p style={{ color:"#334155", fontSize:12, marginTop:12 }}>Your 14-day free trial is active</p>
          </div>
        )}

        {/* ── STEP 2: ADD VENDORS ── */}
        {currentStep === 2 && (
          <div>
            <h2 style={{ color:"#f1f5f9", fontSize:20, fontWeight:700, margin:"0 0 6px" }}>Add Your Vendors</h2>
            <p style={{ color:"#475569", fontSize:13, margin:"0 0 20px" }}>Who do you order supplies from? Add at least one to continue.</p>

            {/* Added vendors list */}
            {addedVendors.filter(v => v.name.trim()).length > 0 && (
              <div style={{ marginBottom:16 }}>
                {addedVendors.filter(v => v.name.trim()).map(v => (
                  <div key={v.id} style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:8, padding:"10px 14px", marginBottom:6, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div>
                      <span style={{ color:"#4ade80", fontSize:14, fontWeight:600 }}>✓ {v.name}</span>
                      {v.orderDays?.length > 0 && <span style={{ color:"#16a34a", fontSize:11, marginLeft:8, fontFamily:"'DM Mono',monospace" }}>{v.orderDays.map(d => DAYS_SHORT[d]).join(", ")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add vendor form */}
            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:20, marginBottom:16 }}>
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Vendor Name</label>
                <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="e.g. Sysco, US Foods, Anacapri..." style={inp}
                  onKeyDown={e => { if (e.key === "Enter" && vendorName.trim()) addVendor(); }} />
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={lbl}>Order Days (optional)</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {DAYS_SHORT.map((day, i) => (
                    <button key={day} onClick={() => toggleDay(i)}
                      style={{ padding:"8px 12px", borderRadius:8, background:vendorDays.includes(i)?"#e2e8f0":"#080c14", border:`1px solid ${vendorDays.includes(i)?"#e2e8f0":"#1e2d45"}`, color:vendorDays.includes(i)?"#080c14":"#64748b", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={addVendor} disabled={!vendorName.trim()}
                style={{ width:"100%", background:vendorName.trim()?"linear-gradient(135deg,#22c55e,#16a34a)":"#1e2d45", border:"none", borderRadius:8, padding:"10px", color:vendorName.trim()?"#fff":"#475569", fontSize:14, fontWeight:600, cursor:vendorName.trim()?"pointer":"default" }}>
                + Add Vendor
              </button>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => goTo(1)} style={{ flex:1, background:"transparent", border:"1px solid #1e2d45", borderRadius:10, padding:"12px", color:"#94a3b8", fontSize:14, cursor:"pointer" }}>Back</button>
              <button onClick={() => goTo(3)} disabled={addedVendors.filter(v => v.name.trim()).length === 0}
                style={{ flex:2, background:addedVendors.filter(v=>v.name.trim()).length>0?"linear-gradient(135deg,#e2e8f0,#94a3b8)":"#1e2d45", border:"none", borderRadius:10, padding:"12px", color:addedVendors.filter(v=>v.name.trim()).length>0?"#080c14":"#475569", fontSize:14, fontWeight:700, cursor:addedVendors.filter(v=>v.name.trim()).length>0?"pointer":"default" }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: ADD ITEMS ── */}
        {currentStep === 3 && (
          <div>
            <h2 style={{ color:"#f1f5f9", fontSize:20, fontWeight:700, margin:"0 0 6px" }}>Add Your Items</h2>
            <p style={{ color:"#475569", fontSize:13, margin:"0 0 20px" }}>The fastest way: take a photo of an invoice. Or skip and add items later in the Backend.</p>

            {/* Import result */}
            {importResult?.success && (
              <div style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:10, padding:"14px 18px", marginBottom:16, textAlign:"center" }}>
                <div style={{ color:"#4ade80", fontSize:28, marginBottom:6 }}>✅</div>
                <div style={{ color:"#4ade80", fontSize:16, fontWeight:700 }}>{importResult.count} items imported!</div>
                <div style={{ color:"#22c55e", fontSize:12, marginTop:4 }}>You can edit them anytime in the Backend</div>
              </div>
            )}
            {importResult?.success === false && (
              <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:10, padding:"12px 16px", marginBottom:16, color:"#fca5a5", fontSize:13 }}>{importResult.error}</div>
            )}

            {/* Import options */}
            {!importResult?.success && (
              <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
                <button onClick={() => photoRef.current?.click()}
                  style={{ background:"#0f1a2e", border:"2px dashed #1e2d45", borderRadius:14, padding:"28px 20px", cursor:"pointer", textAlign:"center" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor="#e2e8f0"} onMouseLeave={e => e.currentTarget.style.borderColor="#1e2d45"}>
                  <input ref={photoRef} type="file" accept="image/*,application/pdf" onChange={handlePhotoImport} style={{ display:"none" }} />
                  <div style={{ fontSize:32, marginBottom:8 }}>📸</div>
                  <div style={{ color:"#f1f5f9", fontSize:15, fontWeight:600, marginBottom:4 }}>Upload Invoice Photo or PDF</div>
                  <div style={{ color:"#475569", fontSize:12 }}>AI will extract all items automatically</div>
                </button>
                {importing && (
                  <div style={{ textAlign:"center", padding:16 }}>
                    <div style={{ color:"#a5b4fc", fontSize:14, fontWeight:600 }}>Analyzing your invoice...</div>
                    <div style={{ color:"#475569", fontSize:12, marginTop:4 }}>This takes a few seconds</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => goTo(2)} style={{ flex:1, background:"transparent", border:"1px solid #1e2d45", borderRadius:10, padding:"12px", color:"#94a3b8", fontSize:14, cursor:"pointer" }}>Back</button>
              <button onClick={() => goTo(4)}
                style={{ flex:2, background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:10, padding:"12px", color:"#080c14", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                {importResult?.success ? "Continue" : "Skip for Now"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: INVITE TEAM ── */}
        {currentStep === 4 && (
          <div>
            <h2 style={{ color:"#f1f5f9", fontSize:20, fontWeight:700, margin:"0 0 6px" }}>Invite Your Team</h2>
            <p style={{ color:"#475569", fontSize:13, margin:"0 0 20px" }}>Create an invite and text it to each employee. They pick their own password. You can always do this later in Settings → Team.</p>

            <div style={{ background:"#f4f1ea", color:"#1c1917", borderRadius:12, padding:16, marginBottom:16 }}>
              <TeamPanel user={user} />
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => goTo(3)} style={{ flex:1, background:"transparent", border:"1px solid #1e2d45", borderRadius:10, padding:"12px", color:"#94a3b8", fontSize:14, cursor:"pointer" }}>Back</button>
              <button onClick={onComplete}
                style={{ flex:2, background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:10, padding:"14px", color:"#080c14", fontSize:16, fontWeight:700, cursor:"pointer" }}>
                Finish Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAVINGS QUIZ — Pre-signup conversion flow
// ═══════════════════════════════════════════════════════════════════════════════
function SavingsQuiz() {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState({ bizType: "", vendors: "", weeklySpend: "", teamSize: "", overOrder: "", emergencyRuns: "", trackWaste: "" });
  const [showResults, setShowResults] = useState(false);
  const [animatedTotal, setAnimatedTotal] = useState(0);

  const update = (field, val) => setAnswers(prev => ({ ...prev, [field]: val }));

  const savings = calcQuizSavings(answers);
  const paybackDays = quizPaybackDays(savings.monthly);

  useEffect(() => {
    if (!showResults) return;
    const target = savings.monthly;
    let current = 0;
    const inc = Math.max(1, Math.floor(target / 40));
    const timer = setInterval(() => { current += inc; if (current >= target) { current = target; clearInterval(timer); } setAnimatedTotal(current); }, 30);
    return () => clearInterval(timer);
  }, [showResults]);

  const optBtn = (field, value, icon) => {
    const sel = answers[field] === value;
    return (
      <button key={value} onClick={() => update(field, value)}
        style={{ flex:1, minWidth:130, background:sel?"#0f2040":"#0f1a2e", border:"2px solid "+(sel?"#a5b4fc":"#1e2d45"), borderRadius:12, padding:"14px 12px", cursor:"pointer", textAlign:"center", transition:"all 0.2s" }}
        onMouseEnter={e => { if(!sel) e.currentTarget.style.borderColor="#475569"; }}
        onMouseLeave={e => { if(!sel) e.currentTarget.style.borderColor="#1e2d45"; }}>
        {icon && <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>}
        <div style={{ color:sel?"#a5b4fc":"#e2e8f0", fontSize:13, fontWeight:sel?700:500 }}>{value}</div>
      </button>
    );
  };

  const canContinue = { 1: !!answers.bizType, 2: !!answers.vendors && !!answers.weeklySpend && !!answers.teamSize, 3: !!answers.overOrder && !!answers.emergencyRuns && !!answers.trackWaste };

  const nextBtn = (nextStep) => (
    <button onClick={() => { if (nextStep === "results") { setShowResults(true); } else setStep(nextStep); }}
      disabled={!canContinue[step]}
      style={{ width:"100%", background:canContinue[step]?"linear-gradient(135deg,#e2e8f0,#94a3b8)":"#1e2d45", border:"none", borderRadius:10, padding:"14px", color:canContinue[step]?"#080c14":"#475569", fontSize:16, fontWeight:700, cursor:canContinue[step]?"pointer":"default", marginTop:20 }}>
      Continue
    </button>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ width:"100%", maxWidth:520 }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <MoeLogo size="md" />
          {step > 1 && !showResults && <button onClick={() => setStep(step-1)} style={{ background:"none", border:"1px solid #1e2d45", borderRadius:6, color:"#64748b", padding:"4px 12px", cursor:"pointer", fontSize:12 }}>Back</button>}
          {(step === 1 || showResults) && <button onClick={() => window.__moeNavigate("/")} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:12 }}>Back to site</button>}
        </div>

        {!showResults && (
          <div style={{ display:"flex", gap:6, marginBottom:28 }}>
            {[1,2,3].map(s => <div key={s} style={{ flex:1, height:4, borderRadius:2, background:step>=s?"#a5b4fc":"#1e2d45", transition:"all 0.3s" }} />)}
          </div>
        )}

        {step === 1 && !showResults && (
          <div>
            <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:700, margin:"0 0 6px" }}>How much is your business losing?</h1>
            <p style={{ color:"#475569", fontSize:14, margin:"0 0 24px" }}>Answer 3 quick questions. Takes 30 seconds.</p>
            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>What type of business do you run?</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {[["Restaurant","🍕"],["Pizzeria","🍕"],["Bakery","🥐"],["Deli","🥪"],["Retail Shop","🏪"],["Salon","💇"],["Auto Shop","🔧"],["Warehouse","📦"],["Other","🏢"]].map(([v,i]) => optBtn("bizType", v, i))}
            </div>
            {nextBtn(2)}
          </div>
        )}

        {step === 2 && !showResults && (
          <div>
            <h2 style={{ color:"#f1f5f9", fontSize:20, fontWeight:700, margin:"0 0 6px" }}>Tell us about your ordering</h2>
            <p style={{ color:"#475569", fontSize:14, margin:"0 0 20px" }}>No exact numbers needed — just your best estimate.</p>

            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>How many vendors do you order from?</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {["1-2","3-5","6-10","10+"].map(v => optBtn("vendors", v))}
            </div>

            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>How much do you spend on supplies per week?</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {["$1,000-$3,000","$3,000-$5,000","$5,000-$10,000","$10,000+"].map(v => optBtn("weeklySpend", v))}
            </div>

            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>How many people on your team?</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {["Just me","2-5","6-10","10+"].map(v => optBtn("teamSize", v))}
            </div>

            {nextBtn(3)}
          </div>
        )}

        {step === 3 && !showResults && (
          <div>
            <h2 style={{ color:"#f1f5f9", fontSize:20, fontWeight:700, margin:"0 0 6px" }}>Where does the money go?</h2>
            <p style={{ color:"#475569", fontSize:14, margin:"0 0 20px" }}>Be honest — this is just for you.</p>

            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>How often do you over-order?</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {["Rarely","Sometimes","Often","All the time"].map(v => optBtn("overOrder", v))}
            </div>

            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Emergency supply runs at retail prices?</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {["Never","1-2x/month","Weekly","Multiple/week"].map(v => optBtn("emergencyRuns", v))}
            </div>

            <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Do you currently track waste?</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {["Yes","No","Sort of"].map(v => optBtn("trackWaste", v))}
            </div>

            <button onClick={() => setShowResults(true)} disabled={!canContinue[3]}
              style={{ width:"100%", background:canContinue[3]?"linear-gradient(135deg,#e2e8f0,#94a3b8)":"#1e2d45", border:"none", borderRadius:10, padding:"14px", color:canContinue[3]?"#080c14":"#475569", fontSize:16, fontWeight:700, cursor:canContinue[3]?"pointer":"default", marginTop:20 }}>
              Show My Results
            </button>
          </div>
        )}

        {showResults && (
          <div style={{ textAlign:"center" }}>
            <div style={{ color:"#475569", fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:"1px", fontFamily:"'DM Mono',monospace", marginBottom:8 }}>Your estimated losses</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:52, fontWeight:800, color:"#ef4444", letterSpacing:"-2px" }}>
              ${animatedTotal.toLocaleString()}
            </div>
            <div style={{ color:"#fca5a5", fontSize:16, fontWeight:600, marginBottom:4 }}>per month</div>
            <div style={{ color:"#475569", fontSize:13, marginBottom:8 }}>${savings.annual.toLocaleString()} per year · monthly total × 12</div>
            <div style={{ color:"#334155", fontSize:12, marginBottom:24 }}>Each line is a month. They add up to the total above.</div>

            <div style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:14, padding:"20px", marginBottom:20, textAlign:"left" }}>
              <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, marginBottom:14, textTransform:"uppercase", letterSpacing:"0.5px", fontFamily:"'DM Mono',monospace" }}>Where it is going</div>
              {[
                { label:"Over-ordering and spoilage", value:savings.overOrdering, icon:"📦", color:"#fca5a5" },
                { label:"Emergency supply runs", value:savings.emergency, icon:"🚗", color:"#fbbf24" },
                { label:"Manager time on manual ordering", value:savings.labor, icon:"⏰", color:"#a5b4fc" },
                { label:"Untracked waste", value:savings.waste, icon:"🗑️", color:"#f87171" },
              ].map(item => (
                <div key={item.label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderTop:"1px solid #080c14" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:16 }}>{item.icon}</span>
                    <span style={{ color:"#94a3b8", fontSize:13 }}>{item.label}</span>
                  </div>
                  <span style={{ color:item.color, fontSize:15, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>${item.value.toLocaleString()}/mo</span>
                </div>
              ))}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 0 0", borderTop:"2px solid #1e2d45", marginTop:6 }}>
                <span style={{ color:"#f1f5f9", fontSize:14, fontWeight:700 }}>Monthly total</span>
                <span style={{ color:"#ef4444", fontSize:18, fontWeight:800, fontFamily:"'DM Mono',monospace" }}>${savings.monthly.toLocaleString()}/mo</span>
              </div>
            </div>

            <div style={{ background:"#052e16", border:"1px solid #16a34a", borderRadius:12, padding:"16px 20px", marginBottom:20, textAlign:"left" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ color:"#4ade80", fontSize:14, fontWeight:700 }}>MOE Pro — $399/month</div>
                  <div style={{ color:"#22c55e", fontSize:12, marginTop:2 }}>{paybackDays ? `Pays for itself in ${paybackDays} days` : "These answers do not show a monthly loss"}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ color:"#4ade80", fontSize:20, fontWeight:800, fontFamily:"'DM Mono',monospace" }}>{quizRoiMultiple(savings.monthly)}x</div>
                  <div style={{ color:"#22c55e", fontSize:10 }}>ROI</div>
                </div>
              </div>
            </div>

            <button onClick={() => window.__moeNavigate("/app?signup=1")}
              style={{ width:"100%", background:"linear-gradient(135deg,#e2e8f0,#94a3b8)", border:"none", borderRadius:12, padding:"16px", color:"#080c14", fontSize:17, fontWeight:700, cursor:"pointer", letterSpacing:"-0.3px", marginBottom:10 }}>
              Start Your Free 14-Day Trial
            </button>
            <p style={{ color:"#334155", fontSize:12 }}>No credit card required. Set up in 2 minutes.</p>

            <button onClick={() => { setShowResults(false); setStep(1); setAnswers({ bizType:"", vendors:"", weeklySpend:"", teamSize:"", overOrder:"", emergencyRuns:"", trackWaste:"" }); }}
              style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:12, marginTop:12 }}>
              Retake quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Classic wrapper around the shared item-cost + recipe costing screens.
function ClassicCosts({ inventory, priceHistory, recipes, group, setRecipes, setPriceHistory, saveInventory }) {
  const [panel, setPanel] = useState("recipes");
  const kitchen = {
    group, inventory, priceHistory: priceHistory || {}, recipes: Array.isArray(recipes) ? recipes.filter(r => r && r.type) : [],
    saveInventory,
    savePrice: async (itemId, entry) => {
      const list = [...((priceHistory || {})[itemId] || []), entry];
      const res = await sbMerge(group, "priceHistory", { [itemId]: list });
      if (res.ok && res.value) setPriceHistory(res.value);
      return res;
    },
    saveRecipe: async (r) => { const res = await sbArrayUpsert(group, "recipes", r, 1000); if (res.ok) setRecipes(res.value); return res; },
    deleteRecipe: async (id) => { const res = await sbArrayRemove(group, "recipes", id); if (res.ok) setRecipes(res.value); return res; },
  };
  return (
    <div>
      <div className="seg" role="group" style={{ marginBottom: 10 }}>
        <button type="button" aria-pressed={panel === "recipes"} onClick={() => setPanel("recipes")}>Recipes</button>
        <button type="button" aria-pressed={panel === "items"} onClick={() => setPanel("items")}>Item costs</button>
      </div>
      {panel === "recipes" ? <CostRecipes kitchen={kitchen} /> : <ItemCosts kitchen={kitchen} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM ADMIN — every restaurant account, its trial/plan, and a switch to
// activate it after payment. Server-checked: only moe_platform_admins can call it.
// ═══════════════════════════════════════════════════════════════════════════════
function AdminView() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await sbRpc("moe_admin_kitchens");
    if (!res.ok) { setError(res.error); setRows([]); return; }
    setError(""); setRows(Array.isArray(res.value) ? res.value : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setSub = async (k, patch) => {
    setBusy(k.id);
    const next = { ...(k.subscription || {}), ...patch, updatedBy: "admin", updatedAt: new Date().toISOString() };
    const res = await sbRpc("moe_admin_set_subscription", { p_kitchen: k.id, p_sub: next });
    setBusy("");
    if (!res.ok) { setError(res.error); return; }
    load();
  };
  const extendTrial = (k, days) => {
    const base = k.subscription?.trialEnd && new Date(k.subscription.trialEnd) > new Date() ? new Date(k.subscription.trialEnd) : new Date();
    base.setDate(base.getDate() + days);
    setSub(k, { status: "trialing", trialEnd: base.toISOString() });
  };

  const statusOf = (sub) => {
    if (!sub) return { label: "NO PLAN", color: "#94a3b8" };
    if (sub.status === "active") return { label: `ACTIVE · ${(PLANS[sub.plan]?.name || sub.plan || "").toUpperCase()}`, color: "#22c55e" };
    const end = sub.trialEnd ? new Date(sub.trialEnd) : null;
    if (sub.status === "trialing" && end && end > new Date()) return { label: `TRIAL · ${Math.ceil((end - new Date()) / 86400000)}d left`, color: "#fbbf24" };
    return { label: sub.status === "canceled" ? "CANCELED" : "EXPIRED", color: "#ef4444" };
  };

  const list = (rows || []).filter(k => !q || `${k.name} ${k.id} ${k.owner_email}`.toLowerCase().includes(q.toLowerCase()));
  const counts = (rows || []).reduce((acc, k) => { const l = statusOf(k.subscription).label.split(" ")[0]; acc[l] = (acc[l] || 0) + 1; return acc; }, {});
  const mrr = (rows || []).filter(k => k.subscription?.status === "active" && k.id !== "demo").reduce((sum, k) => sum + (PLANS[k.subscription.plan]?.price || 0), 0);
  const btn = { background:"transparent", border:"1px solid #1e2d45", borderRadius:7, color:"#cbd5e1", padding:"6px 10px", fontSize:12, cursor:"pointer" };

  return (
    <div>
      <h2 style={{ color:"#f1f5f9", fontSize:18, fontWeight:700, margin:"0 0 4px" }}>Admin — Restaurants</h2>
      <p style={{ color:"#64748b", fontSize:13, margin:"0 0 16px" }}>
        {rows ? `${rows.length} accounts · ${counts.ACTIVE || 0} active · ${counts.TRIAL || 0} trialing · ${counts.EXPIRED || 0} expired · $${mrr.toLocaleString()}/mo` : "Loading…"}
      </p>
      {error && <div style={{ background:"#450a0a", border:"1px solid #7f1d1d", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:12 }}>{error}</div>}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search restaurant, id, or owner email"
        style={{ width:"100%", background:"#080c14", border:"1px solid #1e2d45", borderRadius:8, padding:"10px 12px", color:"#f1f5f9", marginBottom:12, boxSizing:"border-box" }} />
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {list.map(k => {
          const st = statusOf(k.subscription);
          return (
            <div key={k.id} style={{ background:"#0f1a2e", border:"1px solid #1e2d45", borderRadius:12, padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                <div>
                  <div style={{ color:"#f1f5f9", fontWeight:700 }}>{k.name}</div>
                  <div style={{ color:"#64748b", fontSize:12, fontFamily:"'DM Mono',monospace" }}>{k.id} · {k.owner_email || "no owner"} · {k.members} user{k.members !== 1 ? "s" : ""}{k.business?.phone ? ` · ${k.business.phone}` : ""}</div>
                  <div style={{ color:"#475569", fontSize:11, marginTop:2 }}>Signed up {new Date(k.created_at).toLocaleDateString()} · last activity {k.last_activity ? new Date(k.last_activity).toLocaleDateString() : "—"}</div>
                </div>
                <span style={{ color:st.color, fontSize:11, fontWeight:700, fontFamily:"'DM Mono',monospace", alignSelf:"flex-start" }}>{st.label}</span>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
                {Object.entries(PLANS).map(([key, plan]) => (
                  <button key={key} type="button" disabled={busy === k.id} style={btn}
                    onClick={() => setSub(k, { status: "active", plan: key, subscribedAt: k.subscription?.subscribedAt || new Date().toISOString() })}>
                    Activate {plan.name} ${plan.price}
                  </button>
                ))}
                <button type="button" disabled={busy === k.id} style={btn} onClick={() => extendTrial(k, 7)}>+7 day trial</button>
                {k.subscription?.status === "active" && (
                  <button type="button" disabled={busy === k.id} style={{ ...btn, color:"#fca5a5", borderColor:"#7f1d1d" }}
                    onClick={() => { if (window.confirm(`Cancel ${k.name}? They will be locked out until reactivated.`)) setSub(k, { status: "canceled", canceledAt: new Date().toISOString() }); }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
