// Item costing — cost per case → cost per unit → cost per ounce / each — and
// recipe costing for prep items (batches) and menu items (plates).
//
// For each item:
//   case price            what you pay the supplier for one case/bag/order unit
//   units per case (upu)  how many individual units are in it (6 gallons, 10 lbs, 72 pens)
//   each unit is          lb / oz / gal / qt / L / kg / each / pack…
//   base per unit         ounces (or pieces) in one unit — automatic for lb, gal, etc.
//
//   cost per unit  = case price ÷ units per case
//   cost per oz/ea = cost per unit ÷ base per unit

import { flatItems, weekKey } from "./stockMath";

// Everything converts to ounces (weight and fluid ounces treated alike, like a
// kitchen costing card) or to "each".
export const UNITS = {
  oz:     { base: "oz", per: 1, label: "oz" },
  "fl oz":{ base: "oz", per: 1, label: "fl oz" },
  lb:     { base: "oz", per: 16, label: "lb" },
  g:      { base: "oz", per: 0.035274, label: "g" },
  kg:     { base: "oz", per: 35.274, label: "kg" },
  tsp:    { base: "oz", per: 1 / 6, label: "tsp" },
  tbsp:   { base: "oz", per: 0.5, label: "tbsp" },
  cup:    { base: "oz", per: 8, label: "cup" },
  pt:     { base: "oz", per: 16, label: "pint" },
  qt:     { base: "oz", per: 32, label: "quart" },
  gal:    { base: "oz", per: 128, label: "gallon" },
  ml:     { base: "oz", per: 0.033814, label: "ml" },
  L:      { base: "oz", per: 33.814, label: "liter" },
  each:   { base: "each", per: 1, label: "each" },
  dozen:  { base: "each", per: 12, label: "dozen" },
};

// What one individual unit of an item can be (Settings → Items → costing).
export const UNIT_KINDS = [
  ["lb", "Pound (lb)"], ["oz", "Ounce (oz)"], ["kg", "Kilogram"], ["gal", "Gallon"],
  ["qt", "Quart"], ["L", "Liter"], ["each", "Each / piece"], ["pack", "Pack / box (enter count inside)"],
  ["piece_oz", "Bottle / wheel / tub (enter oz inside)"],
];

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

// Guess what one unit is from the order unit, for items never set up.
function guessUnit(item) {
  const u = String(item.order_unit || "").toLowerCase();
  if (u === "lbs" || u === "lb") return "lb";
  if (u === "gallon") return "gal";
  return "each";
}

export function unitSetup(item) {
  const kind = item.unit_name || guessUnit(item);
  const packCount = Math.max(1, n(item.upu) || 1);
  if (kind === "pack") {
    return { kind, packCount, basePer: Math.max(1, n(item.base_per_unit) || 1), base: "each", set: !!item.unit_name };
  }
  if (kind === "piece_oz") {
    return { kind, packCount, basePer: Math.max(0.01, n(item.base_per_unit) || 1), base: "oz", set: !!item.unit_name };
  }
  const u = UNITS[kind] || UNITS.each;
  const basePer = n(item.base_per_unit) > 0 && item.unit_name ? n(item.base_per_unit) : u.per;
  return { kind, packCount, basePer, base: u.base, set: !!item.unit_name };
}

// Latest price for one ORDER unit (case). Handles every priceHistory format MOE has written.
export function casePrice(item, priceHistory) {
  const upu = Math.max(1, n(item.upu) || 1);
  const list = priceHistory?.[item.id] || priceHistory?.[String(item.id)];
  if (Array.isArray(list) && list.length) {
    const e = [...list].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    let perIndividual = null;
    if (e.basis === "unit" && e.perUnit != null) perIndividual = n(e.perUnit);
    else if (e.perUnit != null) perIndividual = n(e.perUnit) / upu;
    else if (e.price != null) perIndividual = n(e.price);
    if (perIndividual != null) return { price: perIndividual * upu, date: e.date, source: e.source || "" };
  }
  if (n(item.case_price) > 0) return { price: n(item.case_price), date: null, source: "item" };
  return null;
}

// Full cost breakdown for one item.
export function itemCost(item, priceHistory) {
  const setup = unitSetup(item);
  const cp = casePrice(item, priceHistory);
  if (!cp) return { ...setup, casePrice: null, perUnit: null, perBase: null };
  const perUnit = cp.price / setup.packCount;
  return { ...setup, casePrice: cp.price, priceDate: cp.date, priceSource: cp.source, perUnit, perBase: perUnit / setup.basePer };
}

// A new priceHistory entry for a case price typed in by hand.
export function manualPriceEntry(item, price) {
  const upu = Math.max(1, n(item.upu) || 1);
  const p = Math.round(n(price) * 100) / 100;
  return { price: p, perUnit: Math.round((p / upu) * 10000) / 10000, basis: "unit", qty: upu, unit: item.order_unit || "", date: new Date().toISOString(), weekKey: weekKey(), vendor: item.vendor || "", source: "manual" };
}

// ── Recipes ────────────────────────────────────────────────────────────────
// recipe = { id, name, type: "prep"|"menu", servings, yieldOz, menuPrice, ingredients: [{ ref, qty, unit }] }
// ref = "item:<id>" | "prep:<recipeId>"
// Units on an ingredient: any key of UNITS, "unit" (one of the item's units), "case", or "serving" (prep only).

export function ingredientOptions(inventory, recipes, excludeId) {
  const items = flatItems(inventory).map((i) => ({ ref: `item:${i.id}`, name: i.name, kind: "item", item: i }));
  const preps = (recipes || []).filter((r) => r.type === "prep" && r.id !== excludeId)
    .map((r) => ({ ref: `prep:${r.id}`, name: `${r.name} (prep)`, kind: "prep", recipe: r }));
  return [...preps, ...items].sort((a, b) => a.name.localeCompare(b.name));
}

function lineCost(ing, ctx, seen) {
  const qty = n(ing.qty);
  const [kind, id] = String(ing.ref || "").split(":");
  if (kind === "item") {
    const item = ctx.itemsById[id];
    if (!item) return { cost: null, oz: 0, error: "Item removed" };
    const c = itemCost(item, ctx.priceHistory);
    let baseQty;
    if (ing.unit === "unit") baseQty = qty * c.basePer;
    else if (ing.unit === "case") baseQty = qty * c.basePer * c.packCount;
    else {
      const u = UNITS[ing.unit];
      if (!u) return { cost: null, oz: 0, error: "Pick a unit" };
      if (u.base !== c.base) return { cost: null, oz: 0, error: c.base === "each" ? `Priced by the piece — use "each" or "unit"` : `Priced by weight/volume — use oz, lb, cup…` };
      baseQty = qty * u.per;
    }
    const oz = c.base === "oz" ? baseQty : 0;
    if (c.perBase == null) return { cost: null, oz, error: "No price yet" };
    return { cost: baseQty * c.perBase, oz };
  }
  if (kind === "prep") {
    if (seen.has(id)) return { cost: null, oz: 0, error: "Recipe uses itself" };
    const r = ctx.recipesById[id];
    if (!r) return { cost: null, oz: 0, error: "Prep item removed" };
    const pc = recipeCost(r, ctx, new Set([...seen, id]));
    if (ing.unit === "serving") return { cost: pc.perServing == null ? null : qty * pc.perServing, oz: qty * (pc.servingOz || 0), error: pc.missing ? "Prep item has missing prices" : "" };
    const u = UNITS[ing.unit];
    if (!u || u.base !== "oz") return { cost: null, oz: 0, error: "Use oz, lb, cup… or serving" };
    const oz = qty * u.per;
    return { cost: pc.perOz == null ? null : oz * pc.perOz, oz, error: pc.missing ? "Prep item has missing prices" : "" };
  }
  return { cost: null, oz: 0, error: "Pick an ingredient" };
}

export function costContext(inventory, recipes, priceHistory) {
  const itemsById = {};
  flatItems(inventory).forEach((i) => { itemsById[String(i.id)] = i; });
  const recipesById = {};
  (recipes || []).forEach((r) => { recipesById[String(r.id)] = r; });
  return { itemsById, recipesById, priceHistory: priceHistory || {} };
}

export function recipeCost(recipe, ctx, seen = new Set([String(recipe.id)])) {
  const lines = (recipe.ingredients || []).map((ing) => ({ ing, ...lineCost(ing, ctx, seen) }));
  const total = lines.reduce((s, l) => s + (l.cost || 0), 0);
  const missing = lines.filter((l) => l.cost == null || l.error).length;
  const totalOz = n(recipe.yieldOz) > 0 ? n(recipe.yieldOz) : lines.reduce((s, l) => s + (l.oz || 0), 0);
  const servings = Math.max(1, n(recipe.servings) || 1);
  const out = { lines, total, missing, totalOz, servings, perServing: total / servings, servingOz: totalOz / servings, perOz: totalOz > 0 ? total / totalOz : null };
  if (recipe.type === "menu") {
    const price = n(recipe.menuPrice);
    out.menuPrice = price;
    out.foodCostPct = price > 0 ? total / price : null;
    out.profit = price > 0 ? price - total : null;
  }
  return out;
}

export const money = (v, digits = 2) => (v == null || !Number.isFinite(v) ? "—" : `$${v.toFixed(digits)}`);
export const smallMoney = (v) => (v == null ? "—" : v < 1 ? `$${v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}` : `$${v.toFixed(2)}`);
export const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

// ── How an item is counted ────────────────────────────────────────────────
// Stock is always stored in individual units (lbs, gallons, pieces). An item can
// be counted by the unit (default) or by the case — then 2.5 counted = 2.5 × units per case.
const PLURAL = { lb: "lbs", oz: "oz", kg: "kg", gal: "gallons", qt: "quarts", L: "liters", each: "pieces", pack: "packs", piece_oz: "pieces" };
const SINGULAR = { lb: "lb", oz: "oz", kg: "kg", gal: "gallon", qt: "quart", L: "liter", each: "piece", pack: "pack", piece_oz: "piece" };

const plural = (w) => {
  const x = String(w || "").trim();
  if (!x) return x;
  if (/(s|x|z|ch|sh)$/i.test(x)) return `${x}es`;
  if (/[^aeiou]y$/i.test(x)) return `${x.slice(0, -1)}ies`;
  if (/f$/i.test(x) && !/ff$/i.test(x)) return `${x.slice(0, -1)}ves`;   // loaf → loaves
  return `${x}s`;
};

// What ONE thing inside the case is called: "loaf/loaves", "bottle/bottles", "lb/lbs".
export function pieceWords(item) {
  const s = unitSetup(item);
  const name = String(item.piece_name || "").trim().toLowerCase();
  if (name && (s.kind === "each" || s.kind === "pack" || s.kind === "piece_oz")) return { one: name, many: plural(name) };
  return { one: SINGULAR[s.kind] || "unit", many: PLURAL[s.kind] || "units" };
}

export function caseWords(item) {
  const one = String(item.order_unit || "Case").trim().toLowerCase() || "case";
  return { one, many: one === "each" ? "each" : one === "lbs" ? "lbs" : plural(one) };
}

export function countUnit(item) {
  const s = unitSetup(item);
  const pw = pieceWords(item);
  const cw = caseWords(item);
  if (item.count_by === "case" && s.packCount > 1) {
    return { by: "case", factor: s.packCount, label: cw.many, hint: `${s.packCount} ${pw.many} per ${cw.one}` };
  }
  return { by: "unit", factor: 1, label: pw.many, hint: s.packCount > 1 ? `${s.packCount} per ${cw.one}` : "" };
}

export const toCount = (item, units) => (units == null ? null : Math.round((Number(units) / countUnit(item).factor) * 100) / 100);
export const fromCount = (item, v) => Math.round(Number(v) * countUnit(item).factor * 100) / 100;

// What one order unit is, in words the rep can't misread: "Case (6 loaves)", "Case (16 packs × 250)".
export function packDescription(item) {
  const s = unitSetup(item);
  const ou = item.order_unit || "Case";
  const pw = pieceWords(item);
  if (s.kind === "pack") return `${ou} (${s.packCount} ${s.packCount === 1 ? pw.one : pw.many} × ${s.basePer})`;
  if (s.kind === "piece_oz") return `${ou} (${s.packCount} ${s.packCount === 1 ? pw.one : pw.many} × ${s.basePer} oz)`;
  if (s.packCount === 1 && s.kind === "each" && !item.piece_name) return ou;
  return `${ou} (${s.packCount} ${s.packCount === 1 ? pw.one : pw.many})`;
}

// The quantity exactly as the rep should enter it, e.g.
//   { main: "2 CASES", detail: "6 loaves each · 12 loaves total" }
//   { main: "3 EACH", detail: "single loaves — split case" }
//   { main: "1 CASE + 3 EACH", detail: "15 loaves total" }
// Works on an item or an order line (lines carry the same fields).
export function orderPhrase(x, cases, each) {
  const c = Math.max(0, Number(cases) || 0);
  const e = Math.max(0, Number(each) || 0);
  const upu = Math.max(1, Number(x.upu) || 1);
  const pw = x.pieceOne ? { one: x.pieceOne, many: x.pieceMany } : pieceWords(x);
  const cw = x.caseOne ? { one: x.caseOne, many: x.caseMany } : caseWords(x);
  const caseTxt = c ? `${c} ${(c === 1 ? cw.one : cw.many).toUpperCase()}` : "";
  const eachTxt = e ? `${e} EACH` : "";
  const total = c * upu + e;
  const main = [caseTxt, eachTxt].filter(Boolean).join(" + ") || "0";
  let detail = "";
  if (c && !e) detail = upu > 1 ? `${upu} ${pw.many} each · ${total} ${total === 1 ? pw.one : pw.many} total` : "";
  else if (!c && e) detail = `single ${e === 1 ? pw.one : pw.many} — split ${cw.one}`;
  else if (c && e) detail = `${total} ${pw.many} total (${upu} per ${cw.one})`;
  return { main, detail, total };
}

// Map a costing-sheet "Size Desc" + "Conv" to MOE's unit kind.
export function kindFromSizeDesc(desc, conv) {
  const d = String(desc || "").trim().toLowerCase();
  const c = Number(conv) || 0;
  if (/^lbs?$|pound/.test(d)) return { unit_name: "lb" };
  if (/^oz|ounce/.test(d)) return { unit_name: "oz" };
  if (/^kg|kilo/.test(d)) return { unit_name: "kg" };
  if (/gal/.test(d)) return { unit_name: "gal" };
  if (/^qt|quart/.test(d)) return { unit_name: "qt" };
  if (/^l$|liter|litre/.test(d)) return { unit_name: "L" };
  if (/case|box|pack|sleeve|roll/.test(d)) return c > 1 ? { unit_name: "pack", base_per_unit: c } : { unit_name: "each" };
  // "Count": 1 = plain pieces; up to ~a gallon of ounces = bottle/can/wheel; more = pieces in a pack
  if (c > 1 && c <= 128) return { unit_name: "piece_oz", base_per_unit: c };
  if (c > 128) return { unit_name: "pack", base_per_unit: c };
  return { unit_name: "each" };
}
