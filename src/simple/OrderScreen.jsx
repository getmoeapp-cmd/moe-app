import { useEffect, useMemo, useState } from "react";
import { buildHistoryEntry, linesForVendor, printOrder } from "../lib/orders";
import { fmtDate, getToday, itemsMissingSupplier } from "../lib/stockMath";

function Draft({ vendor, inventory, stock, user, canOrder, placeOrder }) {
  const catalog = useMemo(() => linesForVendor(inventory, stock, vendor), [inventory, stock, vendor]);
  const [qty, setQty] = useState(() => {
    const initial = {};
    catalog.forEach((line) => { if (line.suggested > 0) initial[line.id] = line.suggested; });
    return initial;
  });
  const [showAll, setShowAll] = useState(false);
  const [phase, setPhase] = useState("edit");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const chosen = catalog
    .map((line) => ({ ...line, qty: Number(qty[line.id] || 0) }))
    .filter((line) => line.qty > 0);
  const visible = showAll ? catalog : catalog.filter((line) => line.suggested > 0 || qty[line.id]);
  const uncounted = catalog.filter((line) => !line.counted).length;

  async function send() {
    setBusy(true);
    const entry = buildHistoryEntry({ vendorName: vendor, lines: chosen, user });
    const saved = await placeOrder(entry);
    setBusy(false);
    if (!saved.ok) {
      setResult(saved.error || "Couldn't reach MOE.");
      return; // stay on review so they can retry
    }
    setResult("placed");
    setPhase("done");
  }

  if (phase === "done") {
    return (
      <div className="card">
        <h2>Order placed</h2>
        <p>{vendor} · {chosen.length} item{chosen.length === 1 ? "" : "s"}.</p>
        <div className="stack block">
          <button type="button" className="btn primary" onClick={() => printOrder({
            vendorName: vendor,
            lines: chosen,
            businessName: user.business?.name,
            orderedBy: user.name,
          })}>Print</button>
          <button type="button" className="btn quiet" onClick={() => { setQty({}); setResult(null); setPhase("edit"); }}>Start a new order</button>
        </div>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="card">
        <h2>Review {vendor}</h2>
        {chosen.map((line) => (
          <div className="item" key={line.id}>
            <div>
              <h2>{line.name}</h2>
              <p>{line.order_unit || "units"}</p>
            </div>
            <strong>{line.qty}</strong>
          </div>
        ))}
        {result && result !== "placed" && <p className="alert" role="alert">Not placed: {result} Try again.</p>}
        <div className="stack block">
          <button type="button" className="btn primary" disabled={busy || !canOrder} onClick={send}>
            {busy ? "Placing…" : "Place order"}
          </button>
          <button type="button" className="btn quiet" onClick={() => setPhase("edit")}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {uncounted > 0 && <p className="muted">{uncounted} {vendor} item{uncounted === 1 ? "" : "s"} not counted, so they are not suggested.</p>}
      {visible.length === 0 && <div className="empty"><h2>Nothing to order</h2><p>Everything counted for {vendor} is above its reorder point.</p></div>}
      {visible.map((line) => (
        <div className="item" key={line.id}>
          <div>
            <h2>{line.name}</h2>
            <p>{line.counted ? `${line.onHand} on hand` : "Not counted"}{line.suggested > 0 ? ` · suggest ${line.suggested}` : ""}</p>
          </div>
          <div>
          <div className="stepper">
            <button type="button" aria-label={`Decrease ${line.name}`} onClick={() => setQty((prev) => ({ ...prev, [line.id]: Math.max(0, Number(prev[line.id] ?? 0) - 1) }))}>−</button>
            <input
              inputMode="numeric"
              aria-label={`${line.name} order quantity`}
              value={qty[line.id] ?? ""}
              placeholder="0"
              onChange={(event) => {
                const parsed = parseInt(event.target.value, 10);
                setQty((prev) => ({ ...prev, [line.id]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) }));
              }}
            />
            <button type="button" aria-label={`Increase ${line.name}`} onClick={() => setQty((prev) => ({ ...prev, [line.id]: Number(prev[line.id] ?? 0) + 1 }))}>+</button>
          </div>
          <p style={{ textAlign: "right" }}>{line.order_unit || "units"}</p>
          </div>
        </div>
      ))}
      <div className="stack block">
        <button type="button" className="btn quiet" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Hide items that do not need ordering" : "Add something else from this supplier"}
        </button>
        <button type="button" className="btn primary" disabled={chosen.length === 0 || !canOrder} onClick={() => setPhase("review")}>
          {canOrder ? `Review ${chosen.length} item${chosen.length === 1 ? "" : "s"}` : "A manager places orders"}
        </button>
      </div>
    </div>
  );
}

export default function OrderScreen({ inventory, stock, vendors, history, user, canOrder, placeOrder, preferredVendor, onOpenSettings }) {
  const [vendor, setVendor] = useState(preferredVendor || "");
  useEffect(() => { if (preferredVendor) setVendor(preferredVendor); }, [preferredVendor]);
  const today = getToday();
  const named = (vendors || []).filter((entry) => (entry.name || "").trim());
  const missing = itemsMissingSupplier(inventory, named);
  const recent = (history || []).slice(0, 6);

  return (
    <section>
      {named.length === 0 ? (
        <div className="empty">
          <h2>No suppliers yet</h2>
          <p>Add the companies you order from, then assign them to items.</p>
          <button type="button" className="btn primary block" onClick={onOpenSettings}>Add a supplier</button>
        </div>
      ) : (
        <>
          <div className="choices" role="group" aria-label="Suppliers">
            {named.map((entry) => {
              const ordersToday = (entry.orderDays || []).includes(today);
              return (
                <button key={entry.id} type="button" aria-pressed={vendor === entry.name} onClick={() => setVendor(entry.name)}>
                  {entry.name}
                  {ordersToday ? <span className="pill">Today</span> : null}
                </button>
              );
            })}
          </div>
          {vendor && (
            <Draft key={vendor} vendor={vendor} inventory={inventory} stock={stock} user={user} canOrder={canOrder} placeOrder={placeOrder} />
          )}
        </>
      )}
      {missing.length > 0 && <p className="muted">{missing.length} item{missing.length === 1 ? "" : "s"} have no supplier, so they cannot be ordered yet.</p>}
      {recent.length > 0 && (
        <>
          <h2 className="section-h">Recent orders</h2>
          {recent.map((order) => (
            <article className="card" key={order.id}>
              <h2>{order.vendor || "Order"}</h2>
              <p>{fmtDate(order.date)} · {order.totalItems || (order.lines || []).length} items{order.orderedBy ? ` · ${order.orderedBy}` : ""}</p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
