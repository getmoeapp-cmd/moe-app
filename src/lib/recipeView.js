// The kitchen's view of a recipe: what prep and line cooks see on their phones.
// No prices anywhere in here — only amounts, units, steps, and batch scaling,
// in English or Spanish.

import { UNITS, caseWords, pieceWords, recipeCost } from "./costing";

const WORDS = {
  en: {
    recipes: "Recipes", dishes: "Dishes", prep: "Prep", search: "Find a recipe",
    ingredients: "Ingredients", steps: "Steps", batches: "Batches", howMany: "How many",
    plate: "plate", plates: "plates", serving: "serving", servings: "servings",
    makes: "Makes", batchMakes: "This makes", noSteps: "No steps written yet — ask a manager.",
    none: "No recipes yet.", noneHint: "A manager adds recipes under Costs → Recipes.",
    noMatch: "No recipe matches that.", back: "← Back", edit: "Edit recipe", seeRecipe: "See recipe",
    hidden: "Hidden from staff", updated: "Updated", ingredientCount: (n) => `${n} ingredient${n === 1 ? "" : "s"}`,
    notTranslated: "", less: "Less", more: "More",
  },
  es: {
    recipes: "Recetas", dishes: "Platos", prep: "Preparación", search: "Buscar receta",
    ingredients: "Ingredientes", steps: "Pasos", batches: "Tandas", howMany: "Cuántos",
    plate: "plato", plates: "platos", serving: "porción", servings: "porciones",
    makes: "Rinde", batchMakes: "Esto rinde", noSteps: "Todavía no hay pasos — pregúntale al encargado.",
    none: "Todavía no hay recetas.", noneHint: "El encargado agrega recetas en Costos → Recetas.",
    noMatch: "Ninguna receta coincide.", back: "← Atrás", edit: "Editar receta", seeRecipe: "Ver receta",
    hidden: "Oculta para el personal", updated: "Actualizada", ingredientCount: (n) => `${n} ingrediente${n === 1 ? "" : "s"}`,
    notTranslated: "Esta receta todavía no está en español — se muestra en inglés.", less: "Menos", more: "Más",
  },
};
export const tr = (lang) => WORDS[lang] || WORDS.en;

// [one, many]. "each" shows no unit word: "2  Eggs".
const UNIT_WORDS = {
  en: {
    oz: ["oz", "oz"], "fl oz": ["fl oz", "fl oz"], lb: ["lb", "lbs"], g: ["g", "g"], kg: ["kg", "kg"],
    tsp: ["tsp", "tsp"], tbsp: ["tbsp", "tbsp"], cup: ["cup", "cups"], pt: ["pint", "pints"], qt: ["quart", "quarts"],
    gal: ["gallon", "gallons"], ml: ["ml", "ml"], L: ["liter", "liters"], each: ["", ""], dozen: ["dozen", "dozen"],
    serving: ["serving", "servings"],
  },
  es: {
    oz: ["oz", "oz"], "fl oz": ["oz líq.", "oz líq."], lb: ["lb", "lb"], g: ["g", "g"], kg: ["kg", "kg"],
    tsp: ["cdta", "cdtas"], tbsp: ["cda", "cdas"], cup: ["taza", "tazas"], pt: ["pinta", "pintas"], qt: ["cuarto", "cuartos"],
    gal: ["galón", "galones"], ml: ["ml", "ml"], L: ["litro", "litros"], each: ["", ""], dozen: ["docena", "docenas"],
    serving: ["porción", "porciones"],
  },
};
const ES_PIECE = {
  lb: ["lb", "lb"], oz: ["oz", "oz"], kg: ["kg", "kg"], gallon: ["galón", "galones"], quart: ["cuarto", "cuartos"],
  liter: ["litro", "litros"], piece: ["pieza", "piezas"], pack: ["paquete", "paquetes"], unit: ["unidad", "unidades"],
};
const ES_CASE = { case: ["caja", "cajas"], box: ["caja", "cajas"], bag: ["bolsa", "bolsas"], pack: ["paquete", "paquetes"], each: ["", ""] };

export function unitWord(unit, item, lang, one) {
  const i = one ? 0 : 1;
  if (unit === "unit") {
    const pw = item ? pieceWords(item) : { one: "unit", many: "units" };
    if (lang === "es" && ES_PIECE[pw.one]) return ES_PIECE[pw.one][i];
    return one ? pw.one : pw.many;
  }
  if (unit === "case") {
    const cw = item ? caseWords(item) : { one: "case", many: "cases" };
    if (lang === "es" && ES_CASE[cw.one]) return ES_CASE[cw.one][i];
    return one ? cw.one : cw.many;
  }
  const w = (UNIT_WORDS[lang] || UNIT_WORDS.en)[unit];
  return w ? w[i] : (UNITS[unit]?.label || unit || "");
}

// 1.5 → "1½", 0.25 → "¼", 7 → "7", 2.37 → "2.37"
const FRACTIONS = [[0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"], [1, ""]];
export function fmtQty(v) {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return "0";
  const whole = Math.floor(x);
  const frac = x - whole;
  for (const [f, glyph] of FRACTIONS) {
    if (Math.abs(frac - f) < 0.02) {
      const w = f === 1 ? whole + 1 : whole;
      if (!glyph) return String(w);
      return w ? `${w}${glyph}` : glyph;
    }
  }
  return String(Math.round(x * 100) / 100);
}

export const recipeName = (r, lang) => (lang === "es" && r?.es?.name?.trim() ? r.es.name.trim() : r?.name || "");

export function recipeSteps(r, lang) {
  const en = Array.isArray(r?.steps) ? r.steps.filter((s) => String(s).trim()) : [];
  const es = Array.isArray(r?.es?.steps) ? r.es.steps.filter((s) => String(s).trim()) : [];
  return lang === "es" && es.length ? es : en;
}

// True when the viewer asked for Spanish but this recipe has none yet.
export const missingSpanish = (r, lang) => lang === "es" && !(r?.es?.name?.trim() || (r?.es?.steps || []).length);

// English name of an ingredient line (the item name, or the prep recipe's name).
export function englishIngredientName(ing, ctx) {
  const [kind, id] = String(ing?.ref || "").split(":");
  if (kind === "item") return ctx.itemsById[id]?.name || "";
  if (kind === "prep") return ctx.recipesById[id]?.name || "";
  return "";
}

// Ingredient lines as staff see them, scaled. No cost.
export function ingredientLines(recipe, ctx, lang, scale = 1) {
  return (recipe.ingredients || [])
    .filter((ing) => ing && ing.ref)
    .map((ing, idx) => {
      const [kind, id] = String(ing.ref).split(":");
      const qty = (Number(ing.qty) || 0) * scale;
      const one = qty <= 1 + 1e-9;
      const item = kind === "item" ? ctx.itemsById[id] : null;
      const prep = kind === "prep" ? ctx.recipesById[id] : null;
      const es = lang === "es" ? String(recipe.es?.ing?.[ing.ref] || "").trim() : "";
      let name = es;
      if (!name) name = prep ? recipeName(prep, lang) : item ? item.name : lang === "es" ? "(ya no existe)" : "(removed)";
      return {
        key: `${ing.ref}_${idx}`,
        amount: fmtQty(qty),
        unit: unitWord(ing.unit, item, lang, one),
        name,
        prepId: prep ? prep.id : null,
      };
    });
}

// What the recipe makes at this scale. Uses the costing math only for ounces.
export function yieldInfo(recipe, ctx, lang, scale = 1) {
  const t = tr(lang);
  if (recipe.type === "prep") {
    const servings = Math.max(1, Number(recipe.servings) || 1) * scale;
    const oz = recipeCost(recipe, ctx).totalOz * scale;
    const parts = [`${fmtQty(servings)} ${servings <= 1 ? t.serving : t.servings}`];
    if (oz > 0) parts.push(oz >= 16 ? `≈ ${fmtQty(oz)} oz (${fmtQty(Math.round((oz / 16) * 4) / 4)} lb)` : `≈ ${fmtQty(oz)} oz`);
    return `${t.batchMakes} ${parts.join(" · ")}`;
  }
  return `${t.makes} ${fmtQty(scale)} ${scale <= 1 ? t.plate : t.plates}`;
}

// "1. Stretch dough\n- Sauce" → ["Stretch dough", "Sauce"]
export function stepsFromText(text) {
  return String(text || "")
    .split(/\n+/)
    .map((s) => s.replace(/^\s*(\d+\s*[.)-]|[-•*])\s*/, "").trim())
    .filter(Boolean);
}

// Fingerprint of the English text, so the editor can tell when Spanish is out of date.
export function englishSource(recipe, ctx, steps) {
  const ing = {};
  (recipe.ingredients || []).forEach((g) => { if (g.ref) ing[g.ref] = englishIngredientName(g, ctx); });
  return JSON.stringify({ name: String(recipe.name || "").trim(), steps, ing });
}
