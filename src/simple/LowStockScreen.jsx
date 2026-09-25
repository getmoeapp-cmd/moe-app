import { calcOrderQty, lowItems, onHandValue, sectionLabel } from "../lib/stockMath";

export default function LowStockScreen({ inventory, stock, canOrder, onCount, onOrder }) {
  const items = lowItems(inventory, stock);
  const grouped = new Map();
  items.forEach((item) => {
    const vendor = item.vendor || "No supplier";
    if (!grouped.has(vendor)) grouped.set(vendor, []);
    grouped.get(vendor).push(item);
  });
  const groups = [...grouped.entries()].map(([vendor, rows]) => ({ vendor, items: rows }));

  return (
    <section>
      <h2 className="page-title">Below reorder point</h2>
      {items.length === 0 ? (
        <div className="empty">
          <h2>Nothing is low</h2>
          <p>Counted items show up here when they are under the reorder point. Items you have not counted yet stay off this list.</p>
        </div>
      ) : groups.map((group) => (
        <div key={group.vendor}>
          <h2 className="section-h">{group.vendor}</h2>
          {group.items.map((item) => {
            const onHand = onHandValue(stock, item.id);
            const qty = calcOrderQty(item, onHand);
            return (
              <article className="card" key={item.id}>
                <h2>{item.name}</h2>
                <p>
                  {onHand <= 0 ? "Out" : `${onHand} on hand`}
                  {" · "}reorder at {item.reorder}
                  {qty > 0 ? ` · suggest ${qty} ${item.order_unit || "units"}` : ""}
                </p>
                <p>{sectionLabel(item.section)}</p>
                <button type="button" className="btn block" onClick={() => onCount(item.name)}>Count</button>
              </article>
            );
          })}
          {canOrder && group.vendor !== "No supplier" && (
            <button type="button" className="btn primary block" onClick={() => onOrder(group.vendor)}>Order {group.vendor}</button>
          )}
        </div>
      ))}
    </section>
  );
}
