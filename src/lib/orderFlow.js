// Order day flow:
//   1. On a supplier's order day, a fresh COUNT SHEET opens for that supplier.
//      Every item starts at 0; staff enter what's on the shelf right now.
//   2. When someone taps "Done" — or automatically once the day is over — the
//      sheet closes and becomes a DRAFT ORDER (quantities = what's needed to get
//      back to par).
//   3. Owner/manager reviews the draft in Orders, edits if needed, approves.
//   4. Approving saves the order and makes a PDF to send to the supplier's rep.

import { calcOrderSplit, flatItems, getWeekNumber, getWeekYear, orderAmount, orderCapUnits, DAYS } from "./stockMath";
import { caseWords, countUnit, orderPhrase, packDescription, pieceWords } from "./costing";

const pad = (n) => String(n).padStart(2, "0");

// Local calendar day, "2026-09-30".
export function dayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function fmtDay(s) {
  return parseDay(s).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export const SHEET_PREFIX = "sheet_";
export const sheetKey = (date, vendorId) => `${SHEET_PREFIX}${date}_${vendorId}`;

export function parseSheetKey(key) {
  const m = /^sheet_(\d{4}-\d{2}-\d{2})_(.+)$/.exec(key || "");
  return m ? { date: m[1], vendorId: m[2] } : null;
}

// When a supplier was added, in ms (0 = unknown, so nothing is hidden for old data).
// New suppliers carry createdAt; older ones were created with id = Date.now(), which
// is a timestamp too. Tiny ids (1, 2…) are seeded defaults and count as unknown.
export function vendorCreatedMs(v) {
  const t = v?.createdAt ? new Date(v.createdAt).getTime() : NaN;
  if (Number.isFinite(t)) return t;
  const n = Number(v?.id);
  return Number.isFinite(n) && n > 1e12 && n < 4e12 ? n : 0;
}

// A supplier can't have missed an order day before it existed.
export function existedOn(v, date) {
  const made = vendorCreatedMs(v);
  if (!made) return true;
  const c = new Date(made);
  return date.getTime() >= new Date(c.getFullYear(), c.getMonth(), c.getDate()).getTime();
}

const norm = (v) => String(v || "").trim().toLowerCase();

export function itemsForVendor(inventory, vendorName) {
  return flatItems(inventory).filter((i) => norm(i.vendor) === norm(vendorName));
}

export function vendorsDueOn(vendors, date = new Date()) {
  const dow = date.getDay();
  return (vendors || []).filter((v) => (v.name || "").trim() && (v.orderDays || []).includes(dow));
}

// Keep only sheets dated on/after `fromDay` ("YYYY-MM-DD"); drops keys that aren't sheets.
export function recentSheets(values, fromDay) {
  const out = {};
  Object.entries(values || {}).forEach(([k, v]) => {
    const p = parseSheetKey(k);
    if (p && p.date >= fromDay) out[k] = v;
  });
  return out;
}

// True when an approved order already came from this count sheet (order ids are
// "ord_<sheetKey>_<time>"), so closing the sheet again must not make a second draft.
export function hasOrderForSheet(history, key) {
  const pre = `ord_${key}_`;
  return (history || []).some((o) => typeof o?.id === "string" && o.id.startsWith(pre));
}

// Counts on a sheet: { [itemId]: { q, by, at } } plus "_meta" / "_closed" keys.
export function sheetCounts(sheet) {
  const out = {};
  Object.entries(sheet || {}).forEach(([k, v]) => {
    if (k.startsWith("_") || !v || typeof v !== "object") return;
    out[k] = v;
  });
  return out;
}

export function sheetProgress(sheet, items) {
  const counts = sheetCounts(sheet);
  const counted = items.filter((i) => counts[String(i.id)]).length;
  return { counted, total: items.length };
}

// Supplier order days that already passed this week with no sheet and no order.
export function missedCounts({ vendors, sheets, history, drafts, today = new Date() }) {
  const out = [];
  for (let back = 1; back <= 6; back++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const ds = dayStr(d);
    vendorsDueOn(vendors, d).forEach((v) => {
      if (!existedOn(v, d)) return;
      if (sheets[sheetKey(ds, v.id)]) return;
      const since = d.getTime();
      const ordered = (history || []).some((h) => norm(h.vendor) === norm(v.name) && new Date(h.date).getTime() >= since);
      const drafted = (drafts || []).some((x) => norm(x.vendor) === norm(v.name) && parseDay(x.date).getTime() >= since);
      if (!ordered && !drafted && !out.some((m) => m.vendor.id === v.id)) out.push({ vendor: v, date: ds });
    });
  }
  return out;
}

// What the order will be for one item, given its count on the sheet (c = { q } or
// undefined if nobody counted it). The count screen shows this live, and the draft
// uses the same numbers, so what staff see is what the manager gets.
export function suggestOrder(item, c) {
  const counted = !!c;
  const onHand = counted ? Number(c.q) || 0 : 0;   // not counted → treated as 0, flagged
  const upu = Math.max(1, Number(item.upu) || 1);
  // Most a manager may order, in single units. Not counted → only the set amount
  // (fixed-amount items) or one fill up to par (top-up items).
  const fixedAmt = orderAmount(item);
  const capUnits = counted ? orderCapUnits(item, onHand)
    : (!item.sells_split && fixedAmt != null) ? fixedAmt * upu
    : Math.max(0, Number(item.max_stock) || 0);
  const sug = calcOrderSplit(item, onHand);
  // Never suggest more than the limit (matters for items nobody counted).
  if (sug.cases * upu + sug.each > capUnits) {
    sug.cases = Math.floor(capUnits / upu);
    sug.each = item.sells_split ? Math.max(0, capUnits - sug.cases * upu) : 0;
  }
  return { cases: sug.cases, each: sug.each, capUnits, onHand, counted };
}

// Build the draft order a closed count sheet turns into.
export function buildDraft({ id, vendor, date, counts, inventory, closedBy = "", auto = false, source = "count" }) {
  const lines = itemsForVendor(inventory, vendor.name).map((item) => {
    const c = counts[String(item.id)];
    const { cases, each, capUnits, onHand, counted } = suggestOrder(item, c);
    const sug = { cases, each };
    const split = !!item.sells_split;
    const pw = pieceWords(item);
    const cw = caseWords(item);
    return {
      id: item.id,
      name: item.name,
      section: item.section || "",
      order_unit: item.order_unit || "",
      upu: Math.max(1, Number(item.upu) || 1),
      vendor_sku: item.vendor_sku || "",
      pack: packDescription(item),
      countFactor: countUnit(item).factor,
      countLabel: countUnit(item).label,
      par: Number(item.max_stock) || 0,
      orderQty: orderAmount(item),
      split,
      pieceOne: pw.one, pieceMany: pw.many, caseOne: cw.one, caseMany: cw.many,
      capUnits,
      reorder: Number(item.reorder) || 0,
      onHand,
      counted,
      countedBy: c?.by || "",
      suggested: sug.cases,
      suggestedEach: sug.each,
      qty: sug.cases,
      each: sug.each,
    };
  }).map((line) => ({ ...line, overPar: overLimitUnits(line) }));
  return {
    id,
    vendor: vendor.name,
    vendorId: vendor.id,
    date,
    status: "review",
    source,
    auto,
    closedBy,
    createdAt: new Date().toISOString(),
    note: "",
    lines,
  };
}

// Approved draft → order history entry (the format the rest of MOE uses).
export function draftToOrder(draft, user) {
  const now = new Date();
  const lines = draft.lines
    .filter((l) => Number(l.qty) > 0 || Number(l.each) > 0)
    .map((l) => ({
      id: l.id, name: l.name, section: l.section, order_unit: l.order_unit, upu: l.upu,
      ...(l.vendor_sku ? { vendor_sku: l.vendor_sku } : {}), ...(l.pack ? { pack: l.pack } : {}),
      pieceOne: l.pieceOne, pieceMany: l.pieceMany, caseOne: l.caseOne, caseMany: l.caseMany,
      vendor: draft.vendor, qty: Number(l.qty) || 0, ...(Number(l.each) > 0 ? { each_qty: Number(l.each) } : {}),
      // Only real counts go into usage — an item nobody counted is not "0 on hand".
      ...(l.counted ? { currentStock: l.onHand } : { notCounted: true }),
      ...(l.overPar > 0 ? { overPar: l.overPar } : {}),
    }));
  const counts = {};
  draft.lines.forEach((l) => { if (l.counted) counts[l.id] = l.onHand; });
  const countDay = parseDay(draft.date);
  return {
    id: `ord_${draft.id}_${Date.now().toString(36)}`,
    vendor: draft.vendor,
    weekNumber: getWeekNumber(countDay),
    year: getWeekYear(countDay),
    day: DAYS[countDay.getDay()],
    date: now.toISOString(),
    countDate: draft.date,
    // When the counts were taken (the count day), even if approved a day later.
    countedAt: new Date(countDay.getFullYear(), countDay.getMonth(), countDay.getDate(), 20, 0, 0).toISOString(),
    lines,
    totalItems: lines.length,
    orderedBy: user?.name || "",
    approvedBy: user?.name || "",
    approvedAt: now.toISOString(),
    note: draft.note || "",
    received: false,
    counts,
  };
}

// How many single units a draft line is over what a manager may order (0 = fine).
export function overLimitUnits(line) {
  const upu = Math.max(1, Number(line.upu) || 1);
  const total = (Number(line.qty) || 0) * upu + (Number(line.each) || 0);
  const cap = line.capUnits != null ? Number(line.capUnits) || 0 : capToPar(line) * upu;
  return Math.max(0, total - cap);
}

// Most a manager may order on this line (owner can go over), in order units.
export function capToPar(line) {
  if (line.capUnits != null) return Math.floor((Number(line.capUnits) || 0) / Math.max(1, Number(line.upu) || 1));
  if (line.cap != null) return Number(line.cap) || 0;
  return Math.max(0, Math.ceil(((Number(line.par) || 0) - (Number(line.onHand) || 0)) / Math.max(1, Number(line.upu) || 1)));
}

// Plain-text version of an order for email/text bodies.
export function orderText({ order, business, vendor }) {
  const rows = (order.lines || []).map((l) => {
    const ph = orderPhrase(l, l.qty, l.each_qty);
    return `- ${ph.main} — ${l.name}${l.vendor_sku ? ` (#${l.vendor_sku})` : ""}${ph.detail ? ` [${ph.detail}]` : ""}`;
  });
  return [
    `Order from ${business?.name || "our restaurant"}`,
    vendor?.repName ? `Attn: ${vendor.repName}` : "",
    `Date: ${new Date(order.date).toLocaleDateString("en-US")}`,
    "CASE = full case as packed · EACH = single pieces · \"split case\" = break a case",
    "",
    ...rows,
    "",
    order.note ? `Note: ${order.note}` : "",
    `Ordered by ${order.approvedBy || order.orderedBy || ""}${business?.phone ? ` · ${business.phone}` : ""}`,
  ].filter((x, i, a) => x !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
}
