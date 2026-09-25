import { costContext } from "./costing";
import { englishSource, fmtQty, ingredientLines, missingSpanish, recipeName, recipeSteps, stepsFromText, yieldInfo } from "./recipeView";
import { parseJsonBlock } from "./ai";

const mozz = { id: 1, name: "Mozzarella", upu: 6, unit_name: "lb", case_price: 90, piece_name: "" };
const cream = { id: 2, name: "Heavy cream", upu: 12, unit_name: "qt", case_price: 60 };
const eggs = { id: 3, name: "Eggs", upu: 180, unit_name: "each", case_price: 40 };
const inventory = [{ section: "Dairy", items: [mozz, cream, eggs] }];

const sauce = {
  id: "p1", name: "Vodka sauce", type: "prep", servings: 10,
  ingredients: [{ ref: "item:2", qty: 1, unit: "qt" }, { ref: "item:1", qty: 0.5, unit: "lb" }],
  steps: ["Heat cream", "Melt cheese in"],
  es: { name: "Salsa de vodka", steps: ["Calentar la crema", "Derretir el queso"], ing: { "item:2": "Crema espesa" } },
};
const pie = {
  id: "m1", name: "Vodka pie", type: "menu", menuPrice: 20,
  ingredients: [{ ref: "item:1", qty: 7, unit: "oz" }, { ref: "prep:p1", qty: 1.5, unit: "serving" }, { ref: "item:3", qty: 2, unit: "each" }],
};
const ctx = costContext(inventory, [sauce, pie], {});

test("amounts read like a recipe card", () => {
  expect(fmtQty(1.5)).toBe("1½");
  expect(fmtQty(0.25)).toBe("¼");
  expect(fmtQty(2)).toBe("2");
  expect(fmtQty(0.999)).toBe("1");
  expect(fmtQty(2.37)).toBe("2.37");
  expect(fmtQty(1 / 3)).toBe("⅓");
});

test("ingredients scale with batches and never carry a price", () => {
  const lines = ingredientLines(sauce, ctx, "en", 2);
  expect(lines.map((l) => [l.amount, l.unit, l.name])).toEqual([["2", "quarts", "Heavy cream"], ["1", "lb", "Mozzarella"]]);
  lines.forEach((l) => expect(JSON.stringify(l)).not.toMatch(/\$|cost|price/i));
  const pl = ingredientLines(pie, ctx, "en", 1);
  expect(pl[1]).toMatchObject({ amount: "1½", unit: "servings", name: "Vodka sauce", prepId: "p1" });
  expect(pl[2]).toMatchObject({ amount: "2", unit: "", name: "Eggs" });
});

test("Spanish uses the translation and falls back to English", () => {
  const lines = ingredientLines(sauce, ctx, "es", 1);
  expect(lines[0]).toMatchObject({ unit: "cuarto", name: "Crema espesa" });
  expect(lines[1]).toMatchObject({ name: "Mozzarella" }); // not translated → English
  expect(recipeName(sauce, "es")).toBe("Salsa de vodka");
  expect(recipeSteps(sauce, "es")[0]).toBe("Calentar la crema");
  expect(recipeSteps(pie, "es")).toEqual([]);
  expect(missingSpanish(pie, "es")).toBe(true);
  expect(missingSpanish(sauce, "es")).toBe(false);
  expect(ingredientLines(pie, ctx, "es", 1)[1].name).toBe("Salsa de vodka");
});

test("yield text", () => {
  expect(yieldInfo(sauce, ctx, "en", 2)).toBe("This makes 20 servings · ≈ 80 oz (5 lb)");
  expect(yieldInfo(pie, ctx, "en", 1)).toBe("Makes 1 plate");
  expect(yieldInfo(pie, ctx, "es", 3)).toBe("Rinde 3 platos");
});

test("steps typed one per line, numbers and bullets stripped", () => {
  expect(stepsFromText("1. Stretch dough\n\n2) Sauce edge to edge\n- Bake 8 min")).toEqual(["Stretch dough", "Sauce edge to edge", "Bake 8 min"]);
});

test("english fingerprint changes when the recipe text changes", () => {
  const a = englishSource(sauce, ctx, sauce.steps);
  expect(englishSource(sauce, ctx, [...sauce.steps, "Season"])).not.toBe(a);
  expect(englishSource(sauce, ctx, sauce.steps)).toBe(a);
});

test("AI JSON is pulled out of surrounding text", () => {
  expect(parseJsonBlock('Here you go:\n{"name":"Salsa","steps":["a"]}\nDone')).toEqual({ name: "Salsa", steps: ["a"] });
  expect(parseJsonBlock("no json")).toBe(null);
});
