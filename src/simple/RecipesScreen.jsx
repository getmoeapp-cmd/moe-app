import { useMemo, useState } from "react";
import { costContext } from "../lib/costing";
import { fmtQty, ingredientLines, missingSpanish, recipeName, recipeSteps, tr, yieldInfo } from "../lib/recipeView";
import { usePhotos } from "../lib/photo";
import { RecipeEditor } from "./CostsScreen";

// The kitchen's recipe book: prep guys see prep recipes, cooks see dishes.
// Amounts, steps and photos only — no prices, costs or margins on this screen.

const LANG_KEY = "moe-recipe-lang";
function readLang() {
  try { return window.localStorage.getItem(LANG_KEY) === "es" ? "es" : "en"; } catch { return "en"; }
}
function storeLang(lang) {
  try { window.localStorage.setItem(LANG_KEY, lang); } catch { /* private mode — the choice just isn't remembered */ }
}

function LangToggle({ lang, setLang }) {
  return (
    <div className="lang">
      <div className="seg" role="group" aria-label="Language / Idioma">
        <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
        <button type="button" aria-pressed={lang === "es"} onClick={() => setLang("es")}>Español</button>
      </div>
    </div>
  );
}

function RecipeDetail({ recipe, ctx, group, lang, setLang, manager, onBack, onEdit, onOpen }) {
  const t = tr(lang);
  const isPrep = recipe.type === "prep";
  const [scale, setScale] = useState(1);
  const step = isPrep ? 0.5 : 1;
  const photo = usePhotos(group, [recipe], "full")[recipe.id];
  const lines = ingredientLines(recipe, ctx, lang, scale);
  const steps = recipeSteps(recipe, lang);
  const updated = recipe.updatedAt ? new Date(recipe.updatedAt).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric" }) : "";

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button type="button" className="btn quiet" onClick={onBack}>{t.back}</button>
        <LangToggle lang={lang} setLang={setLang} />
      </div>
      {photo && <img className="recipe-photo" src={photo} alt={recipeName(recipe, lang)} />}
      <h1 className="recipe-title">{recipeName(recipe, lang)}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {isPrep ? t.prep : t.dishes}{updated ? ` · ${t.updated} ${updated}` : ""}
        {manager && recipe.staffHidden ? <span className="tag lower" style={{ marginLeft: 8 }}>{t.hidden}</span> : null}
      </p>
      {missingSpanish(recipe, lang) && <p className="note">{t.notTranslated}</p>}

      <div className="scale">
        <span className="label">{isPrep ? t.batches : t.howMany}</span>
        <button type="button" aria-label={t.less} disabled={scale <= step} onClick={() => setScale((s) => Math.max(step, s - step))}>−</button>
        <output aria-live="polite">{fmtQty(scale)}</output>
        <button type="button" aria-label={t.more} disabled={scale >= 50} onClick={() => setScale((s) => Math.min(50, s + step))}>+</button>
      </div>
      <p className="muted" style={{ margin: "0 0 4px" }}>{yieldInfo(recipe, ctx, lang, scale)}</p>

      <h2 className="section-h">{t.ingredients}</h2>
      <ul className="ing-list">
        {lines.map((l) => (
          <li key={l.key}>
            <span className="amt">{l.amount}{l.unit ? ` ${l.unit}` : ""}</span>
            <span>{l.name}</span>
            {l.prepId ? <button type="button" className="btn" onClick={() => onOpen(l.prepId)}>{t.seeRecipe}</button> : <span />}
          </li>
        ))}
      </ul>

      <h2 className="section-h">{t.steps}</h2>
      {steps.length ? (
        <ol className="steps-list">{steps.map((s, i) => <li key={i}><span>{s}</span></li>)}</ol>
      ) : (
        <p className="muted">{t.noSteps}</p>
      )}

      {manager && (
        <div className="stack block" style={{ marginTop: 20 }}>
          <button type="button" className="btn" onClick={onEdit}>{t.edit}</button>
        </div>
      )}
    </section>
  );
}

export default function RecipesScreen({ kitchen, manager }) {
  const [lang, setLangState] = useState(readLang);
  const [kind, setKind] = useState("menu");
  const [q, setQ] = useState("");
  const [trail, setTrail] = useState([]);       // recipe ids opened, newest last ("See recipe" pushes)
  const [editing, setEditing] = useState(null);
  const t = tr(lang);
  const setLang = (l) => { setLangState(l); storeLang(l); };

  // Staff never get prices here: the context is built without price history, and
  // nothing on this screen reads a cost.
  const ctx = useMemo(() => costContext(kitchen.inventory, kitchen.recipes, {}), [kitchen.inventory, kitchen.recipes]);
  const visible = useMemo(() => kitchen.recipes.filter((r) => manager || !r.staffHidden), [kitchen.recipes, manager]);
  const thumbs = usePhotos(kitchen.group, visible, "thumb");

  if (editing) {
    return <RecipeEditor recipe={editing} kitchen={kitchen} onClose={() => setEditing(null)} />;
  }

  const openId = trail[trail.length - 1];
  const open = openId ? visible.find((r) => r.id === openId) : null;
  if (open) {
    return (
      <RecipeDetail
        key={open.id}
        recipe={open}
        ctx={ctx}
        group={kitchen.group}
        lang={lang}
        setLang={setLang}
        manager={manager}
        onBack={() => setTrail((tr0) => tr0.slice(0, -1))}
        onEdit={() => setEditing(open)}
        onOpen={(id) => setTrail((tr0) => (visible.some((r) => r.id === id) ? [...tr0, id] : tr0))}
      />
    );
  }

  const needle = q.trim().toLowerCase();
  const list = visible
    .filter((r) => (kind === "prep" ? r.type === "prep" : r.type !== "prep"))
    .filter((r) => !needle || r.name.toLowerCase().includes(needle) || recipeName(r, "es").toLowerCase().includes(needle))
    .sort((a, b) => recipeName(a, lang).localeCompare(recipeName(b, lang)));

  return (
    <section>
      <LangToggle lang={lang} setLang={setLang} />
      <div className="seg" role="group" aria-label={t.recipes}>
        <button type="button" aria-pressed={kind === "menu"} onClick={() => setKind("menu")}>{t.dishes}</button>
        <button type="button" aria-pressed={kind === "prep"} onClick={() => setKind("prep")}>{t.prep}</button>
      </div>
      <label className="field" style={{ marginTop: 10 }}>{t.search}
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" />
      </label>
      {visible.length === 0 ? (
        <div className="card"><p style={{ margin: 0, fontWeight: 700 }}>{t.none}</p><p className="muted" style={{ margin: "4px 0 0" }}>{t.noneHint}</p></div>
      ) : list.length === 0 ? (
        <p className="muted">{t.noMatch}</p>
      ) : (
        list.map((r) => {
          const n = (r.ingredients || []).filter((g) => g.ref).length;
          const thumb = thumbs[r.id];
          return (
            <button type="button" className="recipe-row" key={r.id} onClick={() => setTrail([r.id])}>
              {thumb ? <img className="recipe-thumb" src={thumb} alt="" /> : <span className="recipe-thumb" aria-hidden="true">{(recipeName(r, lang)[0] || "?").toUpperCase()}</span>}
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{recipeName(r, lang)}</strong>
                <span className="muted">
                  {r.type === "prep" ? yieldInfo(r, ctx, lang, 1) : t.ingredientCount(n)}
                  {manager && r.staffHidden ? ` · ${t.hidden}` : ""}
                </span>
              </span>
            </button>
          );
        })
      )}
    </section>
  );
}
