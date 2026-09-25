import { calcOrderQty, flatItems, getWeekNumber, getWeekYear, isCounted, onHandValue, DAYS } from "./stockMath";

export function linesForVendor(inventory, stock, vendorName) {
  const target = (vendorName || "").trim().toLowerCase();
  return flatItems(inventory)
    .filter((item) => (item.vendor || "").trim().toLowerCase() === target)
    .map((item) => {
      const counted = isCounted(stock, item.id);
      const onHand = onHandValue(stock, item.id);
      return {
        ...item,
        counted,
        onHand,
        suggested: counted ? calcOrderQty(item, onHand) : 0,
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function buildHistoryEntry({ vendorName, lines, user }) {
  const orderLines = lines
    .filter((line) => Number(line.qty) > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      section: item.section,
      order_unit: item.order_unit,
      vendor: vendorName,
      qty: Number(item.qty),
      currentStock: item.onHand ?? 0,
    }));
  const now = new Date();
  return {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    vendor: vendorName,
    weekNumber: getWeekNumber(now),
    year: getWeekYear(now),
    day: DAYS[now.getDay()],
    date: now.toISOString(),
    lines: orderLines,
    totalItems: orderLines.length,
    orderedBy: user?.name || "",
    received: false,
  };
}

export function weekKeyOf(entry) {
  return `${entry.year}-WK${String(entry.weekNumber).padStart(2, "0")}`;
}

export function appendUsage(usageLog, entry, inventory) {
  const week = weekKeyOf(entry);
  const next = { ...(usageLog || {}) };
  if (!next[week]) next[week] = {};
  if (!next[week][entry.vendor]) next[week][entry.vendor] = {};
  const items = flatItems(inventory);
  entry.lines.forEach((line) => {
    const source = items.find((item) => item.id === line.id);
    next[week][entry.vendor][line.id] = {
      name: line.name,
      qty: line.qty,
      order_unit: line.order_unit,
      stockBefore: line.currentStock,
      maxStock: source?.max_stock || 0,
    };
  });
  return next;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function printOrder({ vendorName, lines, businessName, orderedBy }) {
  const printable = (lines || []).filter((line) => Number(line.qty) > 0);
  const win = window.open("", "_blank");
  if (!win) return false;
  const rows = printable.map((line) => (
    `<tr><td>${escapeHtml(line.name)}</td><td>${escapeHtml(line.order_unit || "")}</td><td>${escapeHtml(line.qty)}</td></tr>`
  )).join("");
  const when = new Date().toLocaleString();
  win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(vendorName)} order</title>
    <style>
      body{font-family:Georgia,serif;color:#1c1917;margin:32px;max-width:640px}
      h1{font-size:22px;margin:0 0 4px} p{color:#57534e;margin:0 0 20px}
      table{width:100%;border-collapse:collapse} th,td{text-align:left;padding:8px 0;border-bottom:1px solid #e7e0d6}
      th:last-child,td:last-child{text-align:right}
    </style></head><body>
    <h1>${escapeHtml(businessName || "Kitchen")}</h1>
    <p>${escapeHtml(vendorName)} · ${escapeHtml(when)} · ${escapeHtml(orderedBy || "")}</p>
    <table><thead><tr><th>Item</th><th>Unit</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  win.document.close();
  return true;
}
