import { useMemo, useState } from "react";
import {
  UNIT_KINDS, UNITS, costContext, ingredientOptions, itemCost, manualPriceEntry,
  money, packDescription, pct, recipeCost, smallMoney, unitSetup,
} from "../lib/costing";
import { updateItem } from "../lib/inventoryEdits";
import { flatItems, sectionLabel } from "../lib/stockMath";
import UsageScreen from "./UsageScreen";
import { englishIngredientName, englishSource, stepsFromText } from "../lib/recipeView";
import { translateRecipe } from "../lib/ai";
import { preparePhoto, savePhoto, usePhotos } from "../lib/photo";

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
  const [stepsText, setStepsText] = useState((recipe.steps || []).join("\n"));
  const [esStepsText, setEsStepsText] = useState((recipe.es?.steps || []).join("\n"));
  const [photo, setPhoto] = useState(null);          // new photo picked, not saved yet
  const [photoGone, setPhotoGone] = useState(false);  // owner removed the photo
  const [photoMsg, setPhotoMsg] = useState("");
  const [translating, setTranslating] = useState(false);
  const saved = usePhotos(kitchen.group, [recipe], "full")[recipe.id];
  const shownPhoto = photo ? photo.full : photoGone ? null : saved;
  const options = useMemo(() => ingredientOptions(kitchen.inventory, kitchen.recipes, recipe.id), [kitchen.inventory, kitchen.recipes, recipe.id]);
  const byRef = Object.fromEntries(options.map((o) => [o.ref, o]));
  const ctx = costContext(kitchen.inventory, [...kitchen.recipes.filter((x) => x.id !== r.id), r], kitchen.priceHistory);
  const cost = recipeCost(r, ctx);

  const setIng = (idx, patch) => setR((prev) => ({ ...prev, ingredients: prev.ingredients.map((g, i) => (i === idx ? { ...g, ...patch } : g)) }));
  function pick(idx, ref) {
    const choices = unitChoices(byRef[ref]);
    setIng(idx, { ref, unit: choices[0]?.[0] || "oz" });
  }

  const steps = stepsFromText(stepsText);
  const sourceNow = englishSource(r, ctx, steps);
  const esStale = !!r.es && r.es.src && r.es.src !== sourceNow;
  const refs = [...new Set(r.ingredients.map((g) => g.ref).filter(Boolean))];

  async function pickPhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setPhotoMsg("");
    try {
      setPhoto(await preparePhoto(file));
      setPhotoGone(false);
    } catch (err) {
      setPhotoMsg(err.message);
    }
  }

  async function translate() {
    setTranslating(true); setMsg("");
    const ingredients = {};
    refs.forEach((ref) => { ingredients[ref] = englishIngredientName({ ref }, ctx); });
    const res = await translateRecipe({ name: r.name.trim(), steps, ingredients });
    setTranslating(false);
    if (!res.ok) { setMsg(`Couldn't translate: ${res.error} You can type the Spanish yourself below.`); return; }
    setR((prev) => ({ ...prev, es: { ...res.value, src: sourceNow, at: new Date().toISOString() } }));
    setEsStepsText(res.value.steps.join("\n"));
  }

  const setEs = (patch) => setR((prev) => ({ ...prev, es: { name: "", steps: [], ing: {}, ...(prev.es || {}), ...patch } }));

  async function save() {
    if (!r.name.trim()) { setMsg("Give it a name."); return; }
    setBusy(true); setMsg("");
    const now = new Date().toISOString();
    let photoAt = r.photoAt || null;
    if (photo || (photoGone && r.photoAt)) {
      photoAt = photo ? now : null;
      const ph = await savePhoto(kitchen.group, r.id, photo, photoAt);
      if (!ph.ok) { setBusy(false); setMsg(`Photo didn't save: ${ph.error}`); return; }
    }
    const next = { ...r, name: r.name.trim(), steps, photoAt, updatedAt: now };
    if (r.es) {
      const esSteps = stepsFromText(esStepsText);
      const ing = {};
      refs.forEach((ref) => { if (r.es.ing?.[ref]?.trim()) ing[ref] = r.es.ing[ref].trim(); });
      next.es = { ...r.es, name: (r.es.name || "").trim(), steps: esSteps, ing };
      if (!next.es.name && !esSteps.length && !Object.keys(ing).length) delete next.es;
    }
    const res = await kitchen.saveRecipe(next);
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    onClose(next);
  }
  async function remove() {
    const usedBy = kitchen.recipes.filter((x) => (x.ingredients || []).some((g) => g.ref === `prep:${r.id}`));
    if (usedBy.length) { setMsg(`Used in ${usedBy.map((x) => x.name).join(", ")} — remove it there first.`); return; }
    if (!window.confirm(`Delete ${r.name || "this recipe"}?`)) return;
    await kitchen.deleteRecipe(r.id);
    if (r.photoAt) await savePhoto(kitchen.group, r.id, null, null);
    onClose(null);
  }

  const isMenu = r.type === "menu";
  const pctVal = cost.foodCostPct;
  return (
    <section>
      <button type="button" className="btn quiet" onClick={() => onClose()}>← Back</button>
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

      <h2 className="section-h">Steps</h2>
      <label className="field">One step per line — this is what the {isMenu ? "cooks" : "prep guys"} see
        <textarea rows={6} value={stepsText} onChange={(e) => setStepsText(e.target.value)}
          placeholder={isMenu ? "Stretch dough to 18 inches\nSauce edge to edge, leave ½ inch crust\nBake 500°F for 8 minutes" : "Open 2 cans crushed tomato\nAdd salt, oregano, basil\nMix and label with today's date"} />
      </label>

      <h2 className="section-h">Photo of the finished {isMenu ? "plate" : "batch"}</h2>
      {shownPhoto ? <img className="recipe-photo" src={shownPhoto} alt={r.name || "Recipe"} /> : <p className="muted" style={{ marginTop: 0 }}>No photo yet. A photo shows staff exactly how it should look.</p>}
      <div className="stack">
        <label className="btn">
          {shownPhoto ? "Change photo" : "Add photo"}
          <input type="file" accept="image/*" onChange={pickPhoto} hidden />
        </label>
        {shownPhoto && <button type="button" className="btn quiet danger" onClick={() => { setPhoto(null); setPhotoGone(true); }}>Remove photo</button>}
      </div>
      {photoMsg && <p className="alert">{photoMsg}</p>}

      <label className="check-row">
        <input type="checkbox" checked={!r.staffHidden} onChange={(e) => setR({ ...r, staffHidden: !e.target.checked })} />
        <span>Show this recipe on staff phones (Recipes tab)</span>
      </label>

      <h2 className="section-h">Spanish</h2>
      <p className="muted" style={{ marginTop: 0 }}>Staff can switch any recipe to Spanish. Translate it, then fix anything that reads wrong.</p>
      <button type="button" className="btn" disabled={translating || !r.name.trim()} onClick={translate}>
        {translating ? "Translating…" : r.es ? "Translate again" : "Translate to Spanish"}
      </button>
      {!r.es && <button type="button" className="btn quiet" onClick={() => setEs({})}>Type it myself</button>}
      {esStale && <p className="alert">The English changed since this was translated. Translate again or update the Spanish.</p>}
      {r.es && (
        <div className="card" style={{ marginTop: 10 }}>
          <label className="field">Name in Spanish<input value={r.es.name || ""} onChange={(e) => setEs({ name: e.target.value })} placeholder="Pizza de queso grande" /></label>
          <label className="field">Steps in Spanish (one per line)
            <textarea rows={6} value={esStepsText} onChange={(e) => setEsStepsText(e.target.value)} />
          </label>
          {refs.length > 0 && <p className="field" style={{ marginBottom: 6 }}>Ingredient names in Spanish</p>}
          {refs.map((ref) => (
            <label className="field" key={ref} style={{ fontWeight: 500 }}>{englishIngredientName({ ref }, ctx) || "Ingredient"}
              <input value={r.es.ing?.[ref] || ""} placeholder="(same as English)" onChange={(e) => setEs({ ing: { ...(r.es.ing || {}), [ref]: e.target.value } })} />
            </label>
          ))}
        </div>
      )}

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

export { ItemCosts, Recipes, RecipeEditor };

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
