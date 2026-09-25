export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const getWeekNumber = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

// ISO-8601 week-numbering year. Dec 29 2025 is week 1 of 2026; Jan 1 2027 is week 53 of 2026.
// Always pair getWeekNumber() with this year, never with getFullYear().
export const getWeekYear = (d = new Date()) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  return date.getUTCFullYear();
};

export const weekKey = (d = new Date()) => `${getWeekYear(d)}-WK${String(getWeekNumber(d)).padStart(2, "0")}`;

export const getToday = () => new Date().getDay();

export const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const getWeekMonday = (weekNum, year = new Date().getFullYear()) => {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(year, 0, 4 - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setDate(monday.getDate() + (weekNum - 1) * 7);
  return monday;
};

export const fmtWeekLabel = (weekNum, year) => {
  const mon = getWeekMonday(weekNum, year);
  return `WK${weekNum} · Mon ${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
};

// The ordering rule for an item:
//   count on hand (single units) → if it's BELOW the reorder point → order.
//   How much: the item's fixed order amount (e.g. "1 case"), or more cases if one
//   case still wouldn't get it back above the reorder point.
//   Older items with no order amount fill back up to par instead.
// Counts are single units (pieces, lbs); the answer is in ORDER units (cases, bags).
export const orderAmount = (item) => {
  const q = Number(item.order_qty);
  return Number.isFinite(q) && q > 0 ? q : null;
};

export const calcOrderQty = (item, stock) => {
  const s = Number(stock ?? 0) || 0;
  const reorder = Number(item.reorder) || 0;
  if (s >= reorder) return 0;
  const upu = Math.max(1, Number(item.upu) || 1);
  const fixed = orderAmount(item);
  if (fixed != null) return Math.max(fixed, Math.ceil((reorder - s) / upu));
  return Math.ceil(Math.max(0, (Number(item.max_stock) || 0) - s) / upu);
};

// Split-case items (the vendor will break a case): top back up to the owner's
// "bring back up to" level with whole cases first, then single pieces for the rest.
// Full-case items: { cases: calcOrderQty, each: 0 }.
export const calcOrderSplit = (item, stock) => {
  if (!item.sells_split) return { cases: calcOrderQty(item, stock), each: 0 };
  const s = Number(stock ?? 0) || 0;
  if (s >= (Number(item.reorder) || 0)) return { cases: 0, each: 0 };
  const upu = Math.max(1, Number(item.upu) || 1);
  const need = Math.max(0, (Number(item.max_stock) || 0) - s);
  let cases = Math.floor(need / upu);
  let each = Math.max(0, Math.ceil(need - cases * upu - 1e-9)) || 0;
  if (each >= upu) { cases += 1; each = 0; }
  return { cases, each };
};

// Most a manager may order, in SINGLE units (owner can go over).
export const orderCapUnits = (item, stock) => {
  const upu = Math.max(1, Number(item.upu) || 1);
  if (item.sells_split) return Math.max(0, (Number(item.max_stock) || 0) - (Number(stock ?? 0) || 0));
  return orderCap(item, stock) * upu;
};

// Most a manager may order of an item (the owner can go over).
export const orderCap = (item, stock) => {
  const s = Number(stock ?? 0) || 0;
  const upu = Math.max(1, Number(item.upu) || 1);
  const fixed = orderAmount(item);
  if (fixed != null) return Math.max(fixed, Math.ceil(((Number(item.reorder) || 0) - s) / upu));
  return Math.max(0, Math.ceil(((Number(item.max_stock) || 0) - s) / upu));
};

export const getStatus = (item, stock) => {
  const s = stock ?? 0;
  if (s >= item.max_stock) return { label: "FULL", color: "#16a34a", bg: "#052e16" };
  if (s >= item.reorder) return { label: "OK", color: "#22c55e", bg: "#052e16" };
  if (s > 0) return { label: "LOW", color: "#f59e0b", bg: "#422006" };
  return { label: "EMPTY", color: "#ef4444", bg: "#450a0a" };
};

export const flatItems = (inventory) =>
  (Array.isArray(inventory) ? inventory : []).flatMap((section) =>
    (section.items || []).map((item) => ({ ...item, section: section.section }))
  );

export const vendorsOrderingToday = (vendors) => {
  const today = getToday();
  return (vendors || []).filter((vendor) => vendor.orderDays && vendor.orderDays.includes(today));
};

export function isCounted(stock, id) {
  return !!stock && Object.prototype.hasOwnProperty.call(stock, id);
}

export function onHandValue(stock, id) {
  if (!isCounted(stock, id)) return null;
  const n = Number(stock[id]);
  return Number.isFinite(n) ? n : 0;
}

export function stockLevel(item, stock) {
  if (!isCounted(stock, item.id)) return "uncounted";
  const onHand = onHandValue(stock, item.id);
  if (onHand <= 0) return "empty";
  if (onHand < Number(item.reorder || 0)) return "low";
  if (onHand >= Number(item.max_stock || 0)) return "full";
  return "ok";
}

export function lowItems(inventory, stock) {
  return flatItems(inventory)
    .filter((item) => {
      const onHand = onHandValue(stock, item.id);
      return onHand !== null && onHand < Number(item.reorder || 0);
    })
    .sort((a, b) => {
      const aEmpty = onHandValue(stock, a.id) <= 0 ? 0 : 1;
      const bEmpty = onHandValue(stock, b.id) <= 0 ? 0 : 1;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
      return String(a.name).localeCompare(String(b.name));
    });
}

export function sectionLabel(section) {
  return String(section || "Other")
    .replace(/[\u2600-\u27BF\uFE0F\u200D]/g, "")
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Other";
}

export function vendorNames(vendors) {
  return new Set((vendors || []).map((vendor) => (vendor.name || "").trim().toLowerCase()).filter(Boolean));
}

export function itemsMissingSupplier(inventory, vendors) {
  const names = vendorNames(vendors);
  return flatItems(inventory).filter((item) => !names.has((item.vendor || "").trim().toLowerCase()));
}
