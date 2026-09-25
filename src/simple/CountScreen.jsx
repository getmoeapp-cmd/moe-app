import { useMemo, useState } from "react";
import { dayStr, fmtDay, itemsForVendor, missedCounts, sheetCounts, sheetKey, sheetProgress, vendorsDueOn } from "../lib/orderFlow";
import { sectionLabel } from "../lib/stockMath";

function Sheet({ sheetId, vendor, date, sheet, inventory, flow, onBack }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const items = useMemo(() => itemsForVendor(inventory, vendor.name), [inventory, vendor.name]);
  const counts = sheetCounts(sheet);
  const closed = !!sheet?._closed;
  const { counted, total } = sheetProgress(sheet, items);
  const q = query.trim().toLowerCase();
  const visible = items.filter((i) => !q || i.name.toLowerCase().includes(q));

  const sections = [];
  visible.forEach((item) => {
    const label = sectionLabel(item.section);
    const last = sections[sections.length - 1];
    if (!last || last.label !== label) sections.push({ label, items: [item] });
    else last.items.push(item);
  });

  async function done() {
    const left = total - counted;
    if (left > 0 && !window.confirm(`${left} item${left === 1 ? " is" : "s are"} still at 0. Send to review as empty?`)) return;
    setBusy(true);
    const res = await flow.closeSheet(sheetId);
    setBusy(false);
    if (!res?.ok) { setMsg(res?.error || "Couldn't send. Try again."); return; }
    setMsg("");
    onBack("sent");
  }

  return (
    <section>
      <button type="button" className="btn quiet" onClick={() => onBack()}>← All suppliers</button>
      <h2 className="section-h" style={{ marginTop: 8 }}>{vendor.name} count</h2>
      <p className="muted" style={{ marginTop: 0 }}>{fmtDay(date)} · count what's on the shelf right now. Every item starts at 0.</p>
      <div className="progress" aria-label="Counted"><i style={{ width: `${total ? (counted / total) * 100 : 0}%` }} /></div>
      <p className="note" style={{ marginTop: 4 }}>{counted} of {total} counted{closed ? " · sent to review" : ""}</p>
      {closed && <div className="banner" role="status">This count was sent to review{sheet._closed.by ? ` by ${sheet._closed.by}` : ""}. Changes here update stock but not the order.</div>}
      <label className="field">Find an item
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {items.length === 0 && <div className="empty"><h2>No items for {vendor.name}</h2><p>Assign items to this supplier in Settings → Items.</p></div>}
      {sections.map((section) => (
        <div key={section.label}>
          <h2 className="section-h">{section.label}</h2>
          {section.items.map((item) => {
            const c = counts[String(item.id)];
            const val = c ? c.q : 0;
            const upu = Math.max(1, Number(item.upu) || 1);
            return (
              <div className="item" key={item.id} data-counted={c ? "yes" : "no"}>
                <div>
                  <h2>{item.name}</h2>
                  <p>{upu > 1 ? `Count single units (${upu} per ${String(item.order_unit || "case").toLowerCase()})` : `Count in ${String(item.order_unit || "units").toLowerCase()}`}{c ? ` · ✓ ${c.by || "counted"}` : ""}</p>
                </div>
                <div className="stepper">
                  <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => flow.countItem(sheetId, vendor, item, val - 1)}>−</button>
                  <input
                    inputMode="numeric"
                    aria-label={`${item.name} on hand`}
                    value={c ? String(val) : ""}
                    placeholder="0"
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => flow.countItem(sheetId, vendor, item, e.target.value === "" ? 0 : e.target.value)}
                  />
                  <button type="button" aria-label={`Increase ${item.name}`} onClick={() => flow.countItem(sheetId, vendor, item, val + 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {msg && <p className="alert" role="alert">{msg}</p>}
      {!closed && items.length > 0 && (
        <div className="stack block" style={{ position: "sticky", bottom: 84, background: "var(--bg)", paddingTop: 8 }}>
          <button type="button" className="btn primary" disabled={busy} onClick={done}>{busy ? "Sending…" : `Done — send ${vendor.name} to review`}</button>
          <p className="note" style={{ margin: 0 }}>Not done? It sends itself at the end of the day.</p>
        </div>
      )}
    </section>
  );
}

export default function CountScreen({ user, kitchen, flow }) {
  const [open, setOpen] = useState(null); // { id, vendor, date }
  const [flash, setFlash] = useState("");
  const [other, setOther] = useState("");
  const today = dayStr();
  const due = vendorsDueOn(kitchen.vendors);
  const missed = missedCounts({ vendors: kitchen.vendors, sheets: flow.sheets, history: kitchen.history, drafts: flow.drafts });
  const named = (kitchen.vendors || []).filter((v) => (v.name || "").trim());

  if (open) {
    return (
      <Sheet
        sheetId={open.id} vendor={open.vendor} date={open.date}
        sheet={flow.sheets[open.id]} inventory={kitchen.inventory} flow={flow}
        onBack={(result) => { setOpen(null); setFlash(result === "sent" ? `${open.vendor.name} sent to review.` : ""); }}
      />
    );
  }

  const start = (vendor, date = today) => setOpen({ id: sheetKey(date, vendor.id), vendor, date });
  const card = (vendor, date, label) => {
    const id = sheetKey(date, vendor.id);
    const sheet = flow.sheets[id];
    const { counted, total } = sheetProgress(sheet, itemsForVendor(kitchen.inventory, vendor.name));
    const closed = !!sheet?._closed;
    return (
      <article className="card" key={id}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <h2 style={{ margin: 0 }}>{vendor.name}</h2>
          <span className={`tag ${closed ? "ok" : counted ? "lower" : "learning"}`}>{closed ? "Sent to review" : counted ? "In progress" : label}</span>
        </div>
        <p className="muted" style={{ margin: "4px 0 10px" }}>{counted} of {total} counted</p>
        <button type="button" className={`btn block ${closed ? "" : "primary"}`} onClick={() => start(vendor, date)}>
          {closed ? "View count" : counted ? "Continue counting" : "Start counting"}
        </button>
      </article>
    );
  };

  return (
    <section>
      <h2 className="section-h" style={{ marginTop: 0 }}>Today · {fmtDay(today)}</h2>
      {flash && <p className="note" role="status">{flash}</p>}
      {!flow.ready && !flow.error && <p className="muted">Loading today's counts…</p>}
      {flow.error && <p className="alert" role="alert">{flow.error}</p>}
      {named.length === 0 && <div className="empty"><h2>No suppliers yet</h2><p>{user.role === "owner" ? "Add suppliers and their order days in Settings." : "Ask the owner to add suppliers."}</p></div>}
      {named.length > 0 && due.length === 0 && (
        <div className="empty"><h2>No orders due today</h2><p>Order days are set per supplier in Settings → Suppliers.</p></div>
      )}
      {due.map((v) => card(v, today, "Due today"))}

      {missed.length > 0 && (
        <>
          <h2 className="section-h">Missed this week</h2>
          {missed.map((m) => (
            <article className="card" key={`m_${m.vendor.id}`}>
              <h2 style={{ margin: 0 }}>{m.vendor.name}</h2>
              <p className="muted" style={{ margin: "4px 0 10px" }}>Was due {fmtDay(m.date)} — nobody counted.</p>
              <button type="button" className="btn block" onClick={() => start(m.vendor)}>Count now</button>
            </article>
          ))}
        </>
      )}

      {named.length > 0 && (
        <>
          <h2 className="section-h">Count another supplier</h2>
          <div className="stack">
            <select value={other} onChange={(e) => setOther(e.target.value)} aria-label="Supplier">
              <option value="">Pick a supplier…</option>
              {named.filter((v) => !due.includes(v)).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button type="button" className="btn" disabled={!other} onClick={() => { const v = named.find((x) => String(x.id) === other); if (v) start(v); }}>Start</button>
          </div>
        </>
      )}
    </section>
  );
}
