import { costContext, itemCost, recipeCost } from "./costing";

// Rows modeled on a standard kitchen costing card.
const oil = { id: 1, name: "Extra Virgin Olive Oil", upu: 6, unit_name: "gal", case_price: 99.48 };
const napkins = { id: 2, name: "Napkins", upu: 16, unit_name: "pack", base_per_unit: 250, case_price: 36.57 };
const brie = { id: 3, name: "Brie", upu: 1, unit_name: "piece_oz", base_per_unit: 105.8218857, case_price: 40.93 };
const croutons = { id: 4, name: "Croutons", upu: 10, unit_name: "lb", case_price: 15.95 };
const garlic = { id: 5, name: "Garlic", upu: 5, unit_name: "lb", case_price: 11.68 };
const dough = { id: 6, name: "Dough ball", upu: 40, unit_name: "each", case_price: 30 };
const inventory = [{ section: "All", items: [oil, napkins, brie, croutons, garlic, dough] }];

test("cost per ounce / unit matches the costing card", () => {
  expect(itemCost(oil, {}).perBase).toBeCloseTo(0.12953125, 6);
  expect(itemCost(oil, {}).perUnit).toBeCloseTo(16.58, 2);
  expect(itemCost(napkins, {}).perBase).toBeCloseTo(0.0091425, 7);
  expect(itemCost(brie, {}).perBase).toBeCloseTo(0.386782, 5);
  expect(itemCost(croutons, {}).perBase).toBeCloseTo(0.0996875, 7);
});

test("latest invoice price beats the typed case price", () => {
  const ph = { 5: [{ price: 2.5, date: "2026-09-01T00:00:00Z" }] }; // legacy: per individual lb
  expect(itemCost(garlic, ph).casePrice).toBeCloseTo(12.5, 4);
});

test("prep batch → cost per oz / serving; menu item → food cost %", () => {
  const sauce = { id: "p1", name: "Garlic oil", type: "prep", servings: 4, ingredients: [
    { ref: "item:1", qty: 1, unit: "cup" },      // 8 oz oil
    { ref: "item:5", qty: 2, unit: "oz" },
  ] };
  const pizza = { id: "m1", name: "Garlic knot pie", type: "menu", menuPrice: 12, ingredients: [
    { ref: "item:6", qty: 1, unit: "each" },
    { ref: "prep:p1", qty: 1, unit: "serving" },
  ] };
  const ctx = costContext(inventory, [sauce, pizza], {});
  const s = recipeCost(sauce, ctx);
  expect(s.totalOz).toBe(10);
  expect(s.total).toBeCloseTo(8 * 0.12953125 + 2 * 0.146, 6);
  expect(s.perServing).toBeCloseTo(s.total / 4, 6);
  const m = recipeCost(pizza, ctx);
  expect(m.total).toBeCloseTo(0.75 + s.perServing, 6);
  expect(m.foodCostPct).toBeCloseTo(m.total / 12, 6);
});

test("unit mismatch is flagged instead of guessed", () => {
  const bad = { id: "x", type: "menu", ingredients: [{ ref: "item:6", qty: 3, unit: "oz" }] };
  const r = recipeCost(bad, costContext(inventory, [bad], {}));
  expect(r.lines[0].cost).toBeNull();
  expect(r.missing).toBe(1);
});

import { countUnit, fromCount, kindFromSizeDesc, packDescription, toCount } from "./costing";

test("count by case converts to and from stored units", () => {
  const mozz = { id: 9, upu: 6, unit_name: "lb", count_by: "case", order_unit: "Case" };
  expect(countUnit(mozz).label).toBe("cases");
  expect(fromCount(mozz, 2.5)).toBe(15);
  expect(toCount(mozz, 15)).toBe(2.5);
  expect(countUnit({ ...mozz, count_by: "unit" }).label).toBe("lbs");
  expect(packDescription(mozz)).toBe("Case (6 lbs)");
});

test("costing-sheet size descriptions map to units", () => {
  expect(kindFromSizeDesc("Lbs", 16)).toEqual({ unit_name: "lb" });
  expect(kindFromSizeDesc("Gallons", 128)).toEqual({ unit_name: "gal" });
  expect(kindFromSizeDesc("Count", 250)).toEqual({ unit_name: "pack", base_per_unit: 250 });
  expect(kindFromSizeDesc("Count", 33.8)).toEqual({ unit_name: "piece_oz", base_per_unit: 33.8 });
  expect(kindFromSizeDesc("Count", 1)).toEqual({ unit_name: "each" });
  expect(kindFromSizeDesc("Case", 100)).toEqual({ unit_name: "pack", base_per_unit: 100 });
});

import { orderPhrase, pieceWords } from "./costing";
import { calcOrderSplit, orderCapUnits } from "./stockMath";

test("rep-proof wording: cases, singles, both", () => {
  const mozz = { upu: 6, unit_name: "each", piece_name: "loaf", order_unit: "Case" };
  expect(pieceWords(mozz)).toEqual({ one: "loaf", many: "loaves" });
  expect(orderPhrase(mozz, 2, 0)).toMatchObject({ main: "2 CASES", detail: "6 loaves each · 12 loaves total" });
  expect(orderPhrase(mozz, 0, 3)).toMatchObject({ main: "3 EACH", detail: "single loaves — split case" });
  expect(orderPhrase(mozz, 1, 3)).toMatchObject({ main: "1 CASE + 3 EACH", detail: "9 loaves total (6 per case)" });
  expect(orderPhrase({ ...mozz, order_unit: "Bag" }, 1, 0).main).toBe("1 BAG");
});

test("split case: whole cases first, then singles, never past the top-up level", () => {
  const parm = { upu: 6, sells_split: true, reorder: 3, max_stock: 6 };
  expect(calcOrderSplit(parm, 2)).toEqual({ cases: 0, each: 4 });
  expect(calcOrderSplit(parm, 3)).toEqual({ cases: 0, each: 0 });
  expect(calcOrderSplit({ ...parm, reorder: 10, max_stock: 20 }, 5)).toEqual({ cases: 2, each: 3 });
  expect(calcOrderSplit({ ...parm, max_stock: 12 }, 0)).toEqual({ cases: 2, each: 0 });
  expect(orderCapUnits(parm, 2)).toBe(4);
  const cream = { upu: 12, reorder: 7, order_qty: 1 };
  expect(calcOrderSplit(cream, 6)).toEqual({ cases: 1, each: 0 });
  expect(orderCapUnits(cream, 6)).toBe(12);
});

test("order unit 'Each' never becomes 'EACHES'", () => {
  expect(orderPhrase({ upu: 1, order_unit: "Each" }, 4, 0).main).toBe("4 EACH");
  expect(orderPhrase({ upu: 1, order_unit: "Lbs" }, 3, 0).main).toBe("3 LBS");
});
