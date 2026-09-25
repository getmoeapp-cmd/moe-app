// Order day flow:
//   1. On a supplier's order day, a fresh COUNT SHEET opens for that supplier.
//      Every item starts at 0; staff enter what's on the shelf right now.
//   2. When someone taps "Done" — or automatically once the day is over — the
//      sheet closes and becomes a DRAFT ORDER (quantities = what's needed to get
//      back to par).
//   3. Owner/manager reviews the draft in Orders, edits if needed, approves.
//   4. Approving saves the order and makes a PDF to send to the supplier's rep.

import { calcOrderQty, flatItems, getWeekNumber, getWeekYear, DAYS } from "./stockMath";

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

const norm = (v) => String(v || "").trim().toLowerCase();

export function itemsForVendor(inventory, vendorName) {
  return flatItems(inventory).filter((i) => norm(i.vendor) === norm(vendorName));
}

export function vendorsDueOn(vendors, date = new Date()) {
  const dow = date.getDay();
  return (vendors || []).filter((v) => (v.name || "").trim() && (v.orderDays || []).includes(dow));
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
      if (sheets[sheetKey(ds, v.id)]) return;
      const since = d.getTime();
      const ordered = (history || []).some((h) => norm(h.vendor) === norm(v.name) && new Date(h.date).getTime() >= since);
      const drafted = (drafts || []).some((x) => norm(x.vendor) === norm(v.name) && parseDay(x.date).getTime() >= since);
      if (!ordered && !drafted && !out.some((m) => m.vendor.id === v.id)) out.push({ vendor: v, date: ds });
    });
  }
  return out;
}

// Build the draft order a closed count sheet turns into.
export function buildDraft({ id, vendor, date, counts, inventory, closedBy = "", auto = false, source = "count" }) {
  const lines = itemsForVendor(inventory, vendor.name).map((item) => {
    const c = counts[String(item.id)];
    const counted = !!c;
    const onHand = counted ? Number(c.q) || 0 : 0;   // not counted → treated as 0, flagged
    const suggested = calcOrderQty(item, onHand);
    return {
      id: item.id,
      name: item.name,
      section: item.section || "",
      order_unit: item.order_unit || "",
      upu: Math.max(1, Number(item.upu) || 1),
      par: Number(item.max_stock) || 0,
      reorder: Number(item.reorder) || 0,
      onHand,
      counted,
      countedBy: c?.by || "",
      suggested,
      qty: suggested,
    };
  });
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
    .filter((l) => Number(l.qty) > 0)
    .map((l) => ({
      id: l.id, name: l.name, section: l.section, order_unit: l.order_unit,
      vendor: draft.vendor, qty: Number(l.qty), currentStock: l.onHand,
      ...(l.counted ? {} : { notCounted: true }),
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

// Most an order line may bring an item up to (par), in order units.
export function capToPar(line) {
  return Math.max(0, Math.ceil(((Number(line.par) || 0) - (Number(line.onHand) || 0)) / Math.max(1, Number(line.upu) || 1)));
}

// Plain-text version of an order for email/text bodies.
export function orderText({ order, business, vendor }) {
  const rows = (order.lines || []).map((l) => `- ${l.qty} ${l.order_unit || ""}  ${l.name}`.replace(/\s+/g, " "));
  return [
    `Order from ${business?.name || "our restaurant"}`,
    vendor?.repName ? `Attn: ${vendor.repName}` : "",
    `Date: ${new Date(order.date).toLocaleDateString("en-US")}`,
    "",
    ...rows,
    "",
    order.note ? `Note: ${order.note}` : "",
    `Ordered by ${order.approvedBy || order.orderedBy || ""}${business?.phone ? ` · ${business.phone}` : ""}`,
  ].filter((x, i, a) => x !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
}
