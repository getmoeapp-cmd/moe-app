import { useMemo, useState } from "react";
import {
  UNIT_KINDS, UNITS, costContext, ingredientOptions, itemCost, manualPriceEntry,
  money, packDescription, pct, recipeCost, smallMoney, unitSetup,
} from "../lib/costing";
import { updateItem } from "../lib/inventoryEdits";
import { flatItems, sectionLabel } from "../lib/stockMath";
import UsageScreen from "./UsageScreen";

const baseLabel = (c) => (c.base === "oz" ? "oz" : c.kind === "pack" ? "piece" : "each");
const unitWord = (kind) => ({ lb: "lb", oz: "oz", kg: "kg", gal: "gal", qt: "qt", L: "L", each: "each", pack: "pack", piece_oz: "piece" }[kind] || "unit");

// ── Item costs (the product list) ─────────────────────────────────────────
function ItemCostRow({ item, priceHistory, onSave }) {
  const c = itemCost(item, priceHistory);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  function start() {
    const s = unitSetup(item);
    setDraft({
      price: c.casePrice != null ? c.casePrice.toFixed(2) : "",
      upu: String(item.upu || 1),
      kind: item.unit_name || s.kind,
      basePer: item.base_per_unit != null ? String(item.base_per_unit) : "",
    });
    setOpen(true);
  }

  const preview = draft && itemCost({ ...item, upu: Number(draft.upu) || 1, unit_name: draft.kind, base_per_unit: Number(draft.basePer) || undefined, case_price: Number(draft.price) || 0 }, {});

  async function save() {
    setBusy(true);
    await onSave(item, draft, c);
    setBusy(false);
    setOpen(false);
  }

  return (
    <article className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: "1.02rem" }}>{item.name}</h2>
        {c.casePrice == null ? <span className="tag lower">No price</span> : !c.set ? <span className="tag learning">Check unit</span> : null}
      </div>
      <p className="muted" style={{ margin: "2px 0 6px" }}>{item.vendor || "No supplier"} · {packDescription(item)}</p>
      {c.casePrice != null && (
        <p style={{ margin: "0 0 8px", fontSize: 15 }}>
          <strong>{money(c.casePrice)}</strong> / {String(item.order_unit || "case").toLowerCase()}
          {" → "}{money(c.perUnit)} / {unitWord(c.kind)}
          {c.basePer !== 1 || c.base === "oz" ? <> · <strong>{smallMoney(c.perBase)} / {baseLabel(c)}</strong></> : null}
        </p>
      )}
      {!open ? (
        <button type="button" className="btn quiet" onClick={start}>{c.casePrice == null ? "Add price" : "Edit"}</button>
      ) : (
        <div className="block">
          <div className="grid">
            <label className="field">Case price ($)<input inputMode="decimal" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></label>
            <label className="field">Units per {String(item.order_unit || "case").toLowerCase()}<input inputMode="numeric" value={draft.upu} onChange={(e) => setDraft({ ...draft, upu: e.target.value })} /></label>
          </div>
          <label className="field">Each unit is
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              {UNIT_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          {(draft.kind === "pack" || draft.kind === "piece_oz") && (
            <label className="field">{draft.kind === "pack" ? "Pieces in each pack" : "Ounces in each one"}
              <input inputMode="decimal" value={draft.basePer} onChange={(e) => setDraft({ ...draft, basePer: e.target.value })} />
            </label>
          )}
          {preview?.perBase != null && (
            <p className="note">= {money(preview.perUnit)} per {unitWord(preview.kind)} · {smallMoney(preview.perBase)} per {baseLabel(preview)}</p>
          )}
          <div className="stack">
            <button type="button" className="btn primary" disabled={busy} onClick={save}>Save</button>
            <button type="button" className="btn quiet" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </article>
  );
}

function ItemCosts({ kitchen }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const items = flatItems(kitchen.inventory);
  const costs = items.map((i) => ({ item: i, c: itemCost(i, kitchen.priceHistory) }));
  const missing = costs.filter((x) => x.c.casePrice == null).length;
  const shown = costs.filter(({ item, c }) =>
    (!q || item.name.toLowerCase().includes(q.toLowerCase()))
    && (filter === "all" || (filter === "missing" && c.casePrice == null) || (filter === "check" && c.casePrice != null && !c.set)));

  async function onSave(item, d, before) {
    const patch = {
      upu: Math.max(1, parseInt(d.upu, 10) || 1),
      unit_name: d.kind,
      base_per_unit: (d.kind === "pack" || d.kind === "piece_oz") ? Math.max(0.01, Number(d.basePer) || 1) : null,
    };
    await kitchen.saveInventory(updateItem(kitchen.inventory, item.id, patch));
    const price = Number(d.price);
    if (price > 0 && (before.casePrice == null || Math.abs(price - before.casePrice) > 0.004 || patch.upu !== (Number(item.upu) || 1))) {
      await kitchen.savePrice(item.id, manualPriceEntry({ ...item, ...patch }, price));
    }
  }

  let lastSection = null;
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Case price ÷ units in the case = cost per unit ÷ ounces (or pieces) per unit = <strong>cost per ounce / each</strong>. Recipes use these numbers. Invoice prices from the price tracker update them automatically.
      </p>
      <div className="summary" style={{ marginBottom: 8 }}>
        <span>{items.length} items</span>
        <span className={missing ? "low" : ""}>{missing} without a price</span>
      </div>
      <label className="field">Find an item<input value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="seg" role="group" aria-label="Filter">
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        <button type="button" aria-pressed={filter === "missing"} onClick={() => setFilter("missing")}>No price</button>
        <button type="button" aria-pressed={filter === "check"} onClick={() => setFilter("check")}>Check unit</button>
      </div>
      {shown.map(({ item }) => {
        const label = sectionLabel(item.section);
        const head = label !== lastSection ? <h2 className="section-h" key={`h_${label}`}>{label}</h2> : null;
        lastSection = label;
        return [head, <ItemCostRow key={item.id} item={item} priceHistory={kitchen.priceHistory} onSave={onSave} />];
      })}
    </div>
  );
}

// ── Recipes (prep items + menu items) ─────────────────────────────────────
function unitChoices(opt) {
  if (!opt) return [];
  if (opt.kind === "prep") return [["serving", "serving"], ...Object.entries(UNITS).filter(([, u]) => u.base === "oz").map(([k, u]) => [k, u.label])];
  const s = unitSetup(opt.item);
  const own = [["unit", `${unitWord(s.kind)} (whole)`], ["case", String(opt.item.order_unit || "case").toLowerCase()]];
  const measures = Object.entries(UNITS).filter(([, u]) => u.base === s.base).map(([k, u]) => [k, u.label]);
  return [...measures, ...own];
}

function RecipeEditor({ recipe, kitchen, onClose }) {
  const [r, setR] = useState(recipe);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const options = useMemo(() => ingredientOptions(kitchen.inventory, kitchen.recipes, recipe.id), [kitchen.inventory, kitchen.recipes, recipe.id]);
  const byRef = Object.fromEntries(options.map((o) => [o.ref, o]));
  const ctx = costContext(kitchen.inventory, [...kitchen.recipes.filter((x) => x.id !== r.id), r], kitchen.priceHistory);
  const cost = recipeCost(r, ctx);

  const setIng = (idx, patch) => setR((prev) => ({ ...prev, ingredients: prev.ingredients.map((g, i) => (i === idx ? { ...g, ...patch } : g)) }));
  function pick(idx, ref) {
    const choices = unitChoices(byRef[ref]);
    setIng(idx, { ref, unit: choices[0]?.[0] || "oz" });
  }

  async function save() {
    if (!r.name.trim()) { setMsg("Give it a name."); return; }
    setBusy(true);
    const res = await kitchen.saveRecipe({ ...r, name: r.name.trim(), updatedAt: new Date().toISOString() });
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    onClose();
  }
  async function remove() {
    const usedBy = kitchen.recipes.filter((x) => (x.ingredients || []).some((g) => g.ref === `prep:${r.id}`));
    if (usedBy.length) { setMsg(`Used in ${usedBy.map((x) => x.name).join(", ")} — remove it there first.`); return; }
    if (!window.confirm(`Delete ${r.name || "this recipe"}?`)) return;
    await kitchen.deleteRecipe(r.id);
    onClose();
  }

  const isMenu = r.type === "menu";
  const pctVal = cost.foodCostPct;
  return (
    <section>
      <button type="button" className="btn quiet" onClick={onClose}>← Recipes</button>
      <div className="seg" role="group" aria-label="Type" style={{ marginTop: 8 }}>
        <button type="button" aria-pressed={!isMenu} onClick={() => setR({ ...r, type: "prep" })}>Prep item (batch)</button>
        <button type="button" aria-pressed={isMenu} onClick={() => setR({ ...r, type: "menu" })}>Menu item (plate)</button>
      </div>
      <label className="field">Name<input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder={isMenu ? "Large cheese pie" : "Pizza sauce"} /></label>

      <h2 className="section-h">Ingredients</h2>
      {r.ingredients.map((g, idx) => {
        const line = cost.lines[idx] || {};
        return (
          <article className="card" key={idx}>
            <label className="field">Ingredient
              <select value={g.ref || ""} onChange={(e) => pick(idx, e.target.value)}>
                <option value="">Pick…</option>
                {options.map((o) => <option key={o.ref} value={o.ref}>{o.name}</option>)}
              </select>
            </label>
            <div className="grid">
              <label className="field">Amount<input inputMode="decimal" value={g.qty} onChange={(e) => setIng(idx, { qty: e.target.value })} /></label>
              <label className="field">Unit
                <select value={g.unit} onChange={(e) => setIng(idx, { unit: e.target.value })}>
                  {unitChoices(byRef[g.ref]).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {line.error ? <span className="warn-text">{line.error}</span> : <strong>{money(line.cost)}</strong>}
              <button type="button" className="btn quiet danger" onClick={() => setR({ ...r, ingredients: r.ingredients.filter((_, i) => i !== idx) })}>Remove</button>
            </div>
          </article>
        );
      })}
      <button type="button" className="btn" onClick={() => setR({ ...r, ingredients: [...r.ingredients, { ref: "", qty: "1", unit: "oz" }] })}>+ Add ingredient</button>

      <div className="card" style={{ marginTop: 14 }}>
        {isMenu ? (
          <label className="field">Menu price ($)<input inputMode="decimal" value={r.menuPrice || ""} onChange={(e) => setR({ ...r, menuPrice: e.target.value })} /></label>
        ) : (
          <div className="grid">
            <label className="field">Servings the batch makes<input inputMode="numeric" value={r.servings || ""} onChange={(e) => setR({ ...r, servings: e.target.value })} /></label>
            <label className="field">Batch yield oz (optional)<input inputMode="decimal" value={r.yieldOz || ""} onChange={(e) => setR({ ...r, yieldOz: e.target.value })} placeholder={cost.totalOz ? String(Math.round(cost.totalOz * 10) / 10) : ""} /></label>
          </div>
        )}
        <p style={{ margin: "8px 0 4px", fontSize: 17 }}>Total cost <strong>{money(cost.total)}</strong>{cost.missing ? <span className="warn-text"> · {cost.missing} line{cost.missing === 1 ? "" : "s"} not priced</span> : null}</p>
        {isMenu ? (
          <p style={{ margin: 0 }}>
            Food cost <strong style={{ color: pctVal == null ? undefined : pctVal > 0.35 ? "var(--bad)" : pctVal > 0.3 ? "var(--warn)" : "var(--ok)" }}>{pct(pctVal)}</strong>
            {cost.profit != null ? ` · ${money(cost.profit)} left per plate` : ""}
          </p>
        ) : (
          <p style={{ margin: 0 }}>{money(cost.perServing)} per serving{cost.servingOz ? ` (${Math.round(cost.servingOz * 10) / 10} oz)` : ""}{cost.perOz != null ? ` · ${smallMoney(cost.perOz)} per oz` : ""}</p>
        )}
      </div>
      {msg && <p className="alert">{msg}</p>}
      <div className="stack block">
        <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save recipe"}</button>
        {kitchen.recipes.some((x) => x.id === r.id) && <button type="button" className="btn quiet danger" onClick={remove}>Delete recipe</button>}
      </div>
    </section>
  );
}

function Recipes({ kitchen }) {
  const [editing, setEditing] = useState(null);
  const ctx = costContext(kitchen.inventory, kitchen.recipes, kitchen.priceHistory);
  if (editing) return <RecipeEditor recipe={editing} kitchen={kitchen} onClose={() => setEditing(null)} />;
  const blank = (type) => ({ id: `r_${Date.now().toString(36)}`, name: "", type, servings: type === "prep" ? "1" : "", menuPrice: "", ingredients: [{ ref: "", qty: "1", unit: "oz" }] });
  const preps = kitchen.recipes.filter((r) => r.type === "prep");
  const menus = kitchen.recipes.filter((r) => r.type !== "prep");
  const row = (r) => {
    const c = recipeCost(r, ctx);
    return (
      <article className="card" key={r.id} onClick={() => setEditing(r)} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: "1.02rem" }}>{r.name}</h2>
          {r.type === "menu" ? <span className={`tag ${c.foodCostPct == null ? "learning" : c.foodCostPct > 0.35 ? "raise" : c.foodCostPct > 0.3 ? "lower" : "ok"}`}>{pct(c.foodCostPct)}</span> : null}
        </div>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {r.type === "menu"
            ? `Costs ${money(c.total)} · sells ${money(c.menuPrice)}${c.profit != null ? ` · ${money(c.profit)} left` : ""}`
            : `Batch ${money(c.total)} · ${money(c.perServing)} per serving${c.perOz != null ? ` · ${smallMoney(c.perOz)}/oz` : ""}`}
          {c.missing ? ` · ${c.missing} unpriced` : ""}
        </p>
      </article>
    );
  };
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Prep items are batches (sauce, dough) — MOE works out cost per serving and per ounce, and you can use them inside menu items. Menu items show plate cost and food cost %.
      </p>
      <div className="stack">
        <button type="button" className="btn" onClick={() => setEditing(blank("prep"))}>+ Prep item</button>
        <button type="button" className="btn primary" onClick={() => setEditing(blank("menu"))}>+ Menu item</button>
      </div>
      <h2 className="section-h">Menu items</h2>
      {menus.length === 0 ? <p className="muted">None yet.</p> : menus.map(row)}
      <h2 className="section-h">Prep items</h2>
      {preps.length === 0 ? <p className="muted">None yet.</p> : preps.map(row)}
    </div>
  );
}

export { ItemCosts, Recipes };

export default function CostsScreen({ user, kitchen }) {
  const [panel, setPanel] = useState("items");
  return (
    <section>
      <div className="seg" role="group" aria-label="Costs" style={{ marginBottom: 10 }}>
        <button type="button" aria-pressed={panel === "items"} onClick={() => setPanel("items")}>Item costs</button>
        <button type="button" aria-pressed={panel === "recipes"} onClick={() => setPanel("recipes")}>Recipes</button>
        <button type="button" aria-pressed={panel === "usage"} onClick={() => setPanel("usage")}>Usage</button>
      </div>
      {panel === "items" && <ItemCosts kitchen={kitchen} />}
      {panel === "recipes" && <Recipes kitchen={kitchen} />}
      {panel === "usage" && (
        <UsageScreen user={user} inventory={kitchen.inventory} vendors={kitchen.vendors} history={kitchen.history} countLog={kitchen.countLog} saveInventory={kitchen.saveInventory} />
      )}
    </section>
  );
}
