import { useMemo, useState } from "react";
import { flatItems, onHandValue, sectionLabel, stockLevel } from "../lib/stockMath";

const LEVELS = {
  uncounted: "Not counted",
  empty: "Out",
  low: "Low",
  ok: "OK",
  full: "Full",
};

export default function StockScreen({ inventory, stock, updateStock, query, onQuery }) {
  const [filter, setFilter] = useState("all");
  const items = useMemo(() => flatItems(inventory), [inventory]);
  const q = query.trim().toLowerCase();

  const visible = items.filter((item) => {
    const level = stockLevel(item, stock);
    if (filter === "low" && level !== "low" && level !== "empty") return false;
    if (filter === "uncounted" && level !== "uncounted") return false;
    if (q && !item.name.toLowerCase().includes(q) && !sectionLabel(item.section).toLowerCase().includes(q)) return false;
    return true;
  });

  const sections = [];
  visible.forEach((item) => {
    const label = sectionLabel(item.section);
    const last = sections[sections.length - 1];
    if (!last || last.label !== label) sections.push({ label, items: [item] });
    else last.items.push(item);
  });

  const lowCount = items.filter((item) => {
    const level = stockLevel(item, stock);
    return level === "low" || level === "empty";
  }).length;
  const uncounted = items.filter((item) => stockLevel(item, stock) === "uncounted").length;

  return (
    <section>
      <div className="summary" aria-label="Count summary">
        <span>{items.length} items</span>
        <span className={lowCount ? "low" : ""}>{lowCount} low</span>
        <span>{uncounted} not counted</span>
      </div>
      <div className="search">
        <label className="field">Find an item
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Flour, produce, gloves…" />
        </label>
      </div>
      <div className="filters" role="group" aria-label="Filter items">
        {[
          ["all", "All"],
          ["low", "Low"],
          ["uncounted", "Not counted"],
        ].map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      {items.length === 0 && (
        <div className="empty">
          <h2>No items yet</h2>
          <p>Add what you keep on hand from Settings. Counts stay on this screen.</p>
        </div>
      )}
      {items.length > 0 && sections.length === 0 && <p className="muted">Nothing matches that filter.</p>}
      {sections.map((section) => (
        <div key={section.label}>
          <h2 className="section-h">{section.label}</h2>
          {section.items.map((item) => {
            const level = stockLevel(item, stock);
            const onHand = onHandValue(stock, item.id);
            return (
              <div className="item" key={item.id}>
                <div>
                  <h2>{item.name}</h2>
                  <p><span className={`pill ${level}`}>{LEVELS[level]}</span></p>
                </div>
                <div className="stepper">
                  <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => updateStock(item.id, (onHand ?? 0) - 1)}>−</button>
                  <input
                    inputMode="numeric"
                    aria-label={`${item.name} on hand`}
                    value={onHand === null ? "" : onHand}
                    placeholder="–"
                    onChange={(event) => updateStock(item.id, event.target.value === "" ? 0 : event.target.value)}
                  />
                  <button type="button" aria-label={`Increase ${item.name}`} onClick={() => updateStock(item.id, (onHand ?? 0) + 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
