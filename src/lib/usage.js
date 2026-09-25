// Usage engine: learns how much of each item the kitchen goes through.
//
// Every time someone counts, MOE knows what was on hand. Every order says what
// came in. Between two counts:
//
//     used = on hand at count A + delivered after A − on hand at count B
//
// After a few weeks that gives a baseline weekly usage per item, and from it a
// recommended par (enough to last until the next delivery, plus a cushion).

import { flatItems } from "./stockMath";

const DAY = 86400000;
export const BASELINE_INTERVALS = 3;   // counts→count gaps needed before recommending
export const BASELINE_DAYS = 14;       // …covering at least two weeks
export const MAX_INTERVALS = 8;        // only the most recent gaps shape the average
export const CUSHION = 1.25;           // par = usage until next delivery × 1.25
const MIN_GAP_DAYS = 2;                // ignore same-weekend recounts
const MAX_GAP_DAYS = 21;               // ignore gaps where nobody counted for weeks

const dayKey = (t) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const key = (id) => String(id);

// Units that actually arrived for one order line, in INDIVIDUAL units.
export function receivedUnits(line, item) {
  const upu = Math.max(1, Number(item?.upu) || 1);
  const status = line.delivered;
  const each = Number(line.each_qty) || 0;          // single pieces from a split case
  let qty = Number(line.qty) || 0;
  if (status === "short") return (Number(line.receivedQty ?? 0) || 0) * upu;
  if (status === "out_of_stock" || status === "damaged") return 0;
  return qty * upu + each;
}

// Latest count per item per day, oldest day first: { [id]: [{ day, at, q }] }
export function countTimeline(countLog, history) {
  const byItem = {};
  const add = (id, q, at) => {
    const n = Number(q);
    const t = new Date(at).getTime();
    if (!Number.isFinite(n) || !Number.isFinite(t)) return;
    const k = key(id);
    const day = dayKey(t);
    const list = byItem[k] || (byItem[k] = new Map());
    const prev = list.get(day);
    if (!prev || prev.at <= t) list.set(day, { day, at: t, q: n });
  };
  (countLog || []).forEach((e) => add(e.i, e.q, e.at));
  (history || []).forEach((order) => {
    if (order.type === "auto") return;
    const at = order.date;
    if (order.counts && typeof order.counts === "object") {
      Object.entries(order.counts).forEach(([id, q]) => add(id, q, at));
    }
    (order.lines || []).forEach((line) => {
      if (line.currentStock != null && !(order.counts && key(line.id) in order.counts)) add(line.id, line.currentStock, at);
    });
  });
  const out = {};
  Object.entries(byItem).forEach(([k, m]) => { out[k] = [...m.values()].sort((a, b) => a.day - b.day); });
  return out;
}

// Deliveries per item: { [id]: [{ day, units }] }. Auto-submitted orders are
// MOE's own guesses, not real deliveries, so they are left out.
export function deliveryTimeline(history, itemsById) {
  const out = {};
  (history || []).forEach((order) => {
    if (order.type === "auto") return;
    const t = new Date(order.date).getTime();
    if (!Number.isFinite(t)) return;
    const day = dayKey(t);
    (order.lines || []).forEach((line) => {
      const units = receivedUnits(line, itemsById[key(line.id)]);
      if (units <= 0) return;
      (out[key(line.id)] || (out[key(line.id)] = [])).push({ day, units });
    });
  });
  return out;
}

// Usage between consecutive count days for one item.
export function intervalsFor(counts, deliveries) {
  const res = [];
  for (let n = 1; n < (counts || []).length; n++) {
    const a = counts[n - 1];
    const b = counts[n];
    const days = Math.round((b.day - a.day) / DAY);
    if (days < MIN_GAP_DAYS || days > MAX_GAP_DAYS) continue;
    // An order placed on the day of count A (after counting) up to the day before count B arrives in this gap.
    const delivered = (deliveries || []).filter((d) => d.day >= a.day && d.day < b.day).reduce((s, d) => s + d.units, 0);
    const used = a.q + delivered - b.q;
    if (used < 0) continue; // count went up with no recorded delivery — can't trust this gap
    res.push({ from: a.day, to: b.day, days, start: a.q, delivered, end: b.q, used });
  }
  return res.slice(-MAX_INTERVALS);
}

function ordersPerWeek(vendors, vendorName) {
  const v = (vendors || []).find((x) => (x.name || "").trim().toLowerCase() === (vendorName || "").trim().toLowerCase());
  return Math.max(1, (v?.orderDays || []).length || 1);
}

// Full analysis for every item.
export function analyzeUsage({ inventory, countLog, history, vendors }) {
  const items = flatItems(inventory);
  const byId = {};
  items.forEach((i) => { byId[key(i.id)] = i; });
  const counts = countTimeline(countLog, history);
  const deliveries = deliveryTimeline(history, byId);

  return items.map((item) => {
    const k = key(item.id);
    const intervals = intervalsFor(counts[k], deliveries[k]);
    const totalDays = intervals.reduce((s, x) => s + x.days, 0);
    const totalUsed = intervals.reduce((s, x) => s + x.used, 0);
    const weekly = totalDays > 0 ? (totalUsed / totalDays) * 7 : null;
    const ready = intervals.length >= BASELINE_INTERVALS && totalDays >= BASELINE_DAYS;
    const par = Number(item.max_stock) || 0;
    const reorder = Number(item.reorder) || 0;
    const upu = Math.max(1, Number(item.upu) || 1);
    const perWeek = ordersPerWeek(vendors, item.vendor);
    const cycleUse = weekly != null ? weekly / perWeek : null;   // used between two deliveries
    // Average left on the shelf at count time — a high number means over-ordering.
    const avgLeft = intervals.length ? intervals.reduce((s, x) => s + x.end, 0) / intervals.length : null;

    // The rule MOE suggests: "reorder when below R single units → order Q cases".
    //   R = what you use until the next delivery, +10%
    //   Q = enough cases to cover that usage
    const fixed = Number(item.order_qty) > 0 ? Number(item.order_qty) : null;
    const curOrder = fixed ?? Math.max(0, Math.ceil((par - reorder) / upu));
    let recReorder = null;
    let recOrder = null;
    let status = "learning";
    if (ready) {
      if (weekly === 0) {
        recReorder = 0;
        recOrder = 1;
        status = reorder > 0 ? "idle" : "ok";
      } else {
        recReorder = Math.max(1, Math.ceil(cycleUse * 1.1));
        recOrder = Math.max(1, Math.ceil(cycleUse / upu));
        const tol = Math.max(1, Math.ceil(reorder * 0.15));
        // The order amount decides the direction (that's the money); the reorder point breaks ties.
        if (recOrder > curOrder) status = "raise";
        else if (recOrder < curOrder) status = "lower";
        else if (recReorder - reorder >= tol) status = "raise";
        else if (reorder - recReorder >= tol) status = "lower";
        else status = "ok";
      }
    }
    let recPar = recReorder == null ? null : recReorder + recOrder * upu;
    // Split-case items: "below R → bring back up to F single units".
    const split = !!item.sells_split;
    if (split && ready && weekly > 0) {
      recPar = recReorder + Math.ceil(cycleUse);
      const tolF = Math.max(1, Math.ceil(par * 0.15));
      if (recPar - par >= tolF) status = "raise";
      else if (par - recPar >= tolF) status = "lower";
      else if (recReorder - reorder >= Math.max(1, Math.ceil(reorder * 0.15))) status = "raise";
      else if (reorder - recReorder >= Math.max(1, Math.ceil(reorder * 0.15))) status = "lower";
      else status = "ok";
    }
    return {
      item, intervals, weekly, totalDays, ready, status,
      par, reorder, upu, perWeek, cycleUse, avgLeft, fixed, curOrder, split,
      recPar, recReorder, recOrder,
      progress: Math.min(intervals.length, BASELINE_INTERVALS),
    };
  });
}

// Most-actionable first: changes, then idle stock, then learning, then fine.
export function sortForReview(rows) {
  const rank = { raise: 0, lower: 1, idle: 2, learning: 3, ok: 4 };
  return [...rows].sort((a, b) => (rank[a.status] - rank[b.status])
    || ((b.weekly || 0) - (a.weekly || 0))
    || String(a.item.name).localeCompare(String(b.item.name)));
}

// Most an order line may bring the item up to (par), in ORDER units.
export function maxToPar(item, onHand) {
  if (onHand != null && Number(item.order_qty) > 0) return Math.max(Number(item.order_qty), Math.ceil(((Number(item.reorder) || 0) - onHand) / Math.max(1, Number(item.upu) || 1)));
  const par = Number(item.max_stock) || 0;
  const upu = Math.max(1, Number(item.upu) || 1);
  if (onHand == null) return 0;
  return Math.max(0, Math.ceil((par - onHand) / upu));
}

export const fmtUnits = (n) => (n == null ? "—" : (Math.round(n * 10) / 10).toLocaleString());
