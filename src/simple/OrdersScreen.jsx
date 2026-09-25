import { useState } from "react";
import { fmtDay, overLimitUnits } from "../lib/orderFlow";
import { itemCost, money, orderPhrase } from "../lib/costing";
import { emailHref, sendOrderPdf, textHref } from "../lib/orderPdf";
import { fmtDate } from "../lib/stockMath";

const norm = (v) => String(v || "").trim().toLowerCase();
const fmtQty = (v) => String(Math.round(Number(v) * 100) / 100);

function DraftEditor({ draft, user, vendor, flow, kitchen, onClose, onApproved }) {
  const [lines, setLines] = useState(draft.lines);
  const [note, setNote] = useState(draft.note || "");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const isOwner = user.role === "owner";

  // field: "qty" (cases) or "each" (single pieces, split-case items only)
  function setQty(line, raw, field = "qty") {
    const want = Math.max(0, parseInt(raw, 10) || 0);
    const next = { ...line, [field]: want };
    let warn = "";
    if (!isOwner && overLimitUnits(next) > 0) {
      // Pull the edited field back down to the most allowed.
      const upu = Math.max(1, Number(line.upu) || 1);
      const other = field === "qty" ? (Number(line.each) || 0) : (Number(line.qty) || 0) * upu;
      const room = Math.max(0, (Number(line.capUnits) || 0) - other);
      next[field] = field === "qty" ? Math.floor(room / upu) : room;
      warn = "That's more than the order rule allows — only the owner can order more.";
    }
    const over = overLimitUnits(next);
    setLines((prev) => prev.map((l) => (l.id === line.id ? { ...next, warn, overPar: over } : l)));
    setDirty(true);
  }
  const hasQty = (l) => Number(l.qty) > 0 || Number(l.each) > 0;

  const ordering = lines.filter(hasQty);
  const notCounted = lines.filter((l) => !l.counted);
  const over = ordering.filter((l) => l.overPar > 0);
  const itemsById = Object.fromEntries((kitchen.inventory || []).flatMap((s) => s.items || []).map((i) => [String(i.id), i]));
  let estTotal = 0; let unpriced = 0;
  ordering.forEach((l) => {
    const it = itemsById[String(l.id)];
    const cp = it ? itemCost(it, kitchen.priceHistory).casePrice : null;
    const eachPrice = it && Number(it.each_price) > 0 ? Number(it.each_price) : cp != null ? cp / Math.max(1, Number(l.upu) || 1) : null;
    if (cp == null) unpriced++; else estTotal += cp * (Number(l.qty) || 0) + (eachPrice || 0) * (Number(l.each) || 0);
  });
  const visible = showAll ? lines : lines.filter((l) => hasQty(l) || l.suggested > 0 || l.suggestedEach > 0 || !l.counted);

  async function save() {
    setBusy(true);
    const res = await flow.saveDraft({ ...draft, lines, note });
    setBusy(false);
    setMsg(res.ok ? "Saved." : res.error);
    if (res.ok) setDirty(false);
  }

  async function approve() {
    if (over.length && !window.confirm(`${over.length} item${over.length === 1 ? " is" : "s are"} over the order limit. Approve anyway?`)) return;
    setBusy(true);
    const res = await flow.approveDraft({ ...draft, lines, note });
    setBusy(false);
    if (!res.ok) { setMsg(res.error); return; }
    onApproved(res.order);
  }

  async function remove() {
    if (!window.confirm(`Delete this ${draft.vendor} draft? The counts stay saved.`)) return;
    await flow.deleteDraft(draft.id);
    onClose();
  }

  return (
    <section>
      <button type="button" className="btn quiet" onClick={onClose}>← Orders</button>
      <h2 className="section-h" style={{ marginTop: 8 }}>{draft.vendor} — review order</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Counted {fmtDay(draft.date)}{draft.closedBy ? ` · sent by ${draft.closedBy}` : ""}{draft.source === "manual" ? " · started by hand" : ""}
        {vendor?.repName ? ` · rep: ${vendor.repName}` : ""}
      </p>
      <div className="summary" style={{ marginBottom: 10 }}>
        <span>{ordering.length} to order</span>
        {notCounted.length > 0 && <span className="low">{notCounted.length} not counted</span>}
        {over.length > 0 && <span className="low">{over.length} over limit</span>}
        <span>≈ {money(estTotal)}{unpriced ? ` (+${unpriced} unpriced)` : ""}</span>
      </div>
      {notCounted.length > 0 && (
        <div className="banner" role="status">Items marked <strong>not counted</strong> were left at 0, so MOE assumed they're empty. Check those before approving.</div>
      )}
      {visible.map((line) => (
        <div className="item" key={line.id}>
          <div>
            <h2>{line.name}</h2>
            <p>
              {line.counted ? `${fmtQty(line.onHand / (line.countFactor || 1))} ${line.countLabel || ""} on hand` : <span className="pill warn">not counted</span>}
              {` · reorder below ${fmtQty(line.reorder / (line.countFactor || 1))}`}{line.vendor_sku ? ` · #${line.vendor_sku}` : ""}
              {(line.suggested > 0 || line.suggestedEach > 0) ? ` · suggested ${orderPhrase(line, line.suggested, line.suggestedEach).main.toLowerCase()}` : ""}
            </p>
            {hasQty(line) && (() => { const ph = orderPhrase(line, line.qty, line.each); return (
              <p className="rep-sees">Rep sees: <strong>{ph.main}</strong>{ph.detail ? ` — ${ph.detail}` : ""}</p>
            ); })()}
            {line.warn ? <p className="alert" role="status">{line.warn}</p> : null}
            {line.overPar > 0 ? <p className="warn-text">{line.overPar} {line.pieceMany || "units"} over the order limit</p> : null}
          </div>
          <div>
            <div className="stepper">
              <button type="button" aria-label={`Decrease ${line.name}`} onClick={() => setQty(line, Number(line.qty) - 1)}>−</button>
              <input inputMode="numeric" aria-label={`${line.name} order quantity`} value={line.qty || ""} placeholder="0" onChange={(e) => setQty(line, e.target.value)} />
              <button type="button" aria-label={`Increase ${line.name}`} onClick={() => setQty(line, Number(line.qty) + 1)}>+</button>
            </div>
            <p style={{ textAlign: "right" }}>{(line.caseMany || "cases").replace(/^./, (c) => c.toUpperCase())}</p>
            {line.split && (
              <>
                <div className="stepper">
                  <button type="button" aria-label={`Decrease ${line.name} singles`} onClick={() => setQty(line, Number(line.each || 0) - 1, "each")}>−</button>
                  <input inputMode="numeric" aria-label={`${line.name} single pieces`} value={line.each || ""} placeholder="0" onChange={(e) => setQty(line, e.target.value, "each")} />
                  <button type="button" aria-label={`Increase ${line.name} singles`} onClick={() => setQty(line, Number(line.each || 0) + 1, "each")}>+</button>
                </div>
                <p style={{ textAlign: "right" }}>Each (single)</p>
              </>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="btn quiet" onClick={() => setShowAll((v) => !v)}>
        {showAll ? "Show only items being ordered" : `Show all ${lines.length} ${draft.vendor} items`}
      </button>
      <label className="field">Note for the supplier
        <input value={note} onChange={(e) => { setNote(e.target.value); setDirty(true); }} placeholder="Deliver before 10am, sub OK…" />
      </label>
      {msg && <p className="note" role="status">{msg}</p>}
      <div className="stack block">
        <button type="button" className="btn primary" disabled={busy || ordering.length === 0} onClick={approve}>
          {busy ? "Working…" : `Approve & make PDF (${ordering.length} item${ordering.length === 1 ? "" : "s"})`}
        </button>
        <button type="button" className="btn" disabled={busy || !dirty} onClick={save}>Save changes</button>
        <button type="button" className="btn quiet danger" onClick={remove}>Delete draft</button>
      </div>
    </section>
  );
}

function SendPanel({ order, user, vendor, kitchen, onDone }) {
  const [status, setStatus] = useState("");
  const business = user.business || {};
  async function send() {
    const r = await sendOrderPdf({ order, business, vendor });
    if (r === "cancelled") return;
    setStatus(r === "shared" ? "Sent." : "PDF downloaded — attach it to your email or text.");
    kitchen.patchOrder(order.id, { sentAt: new Date().toISOString(), sentBy: user.name || "" });
  }
  return (
    <section>
      <h2 className="section-h" style={{ marginTop: 0 }}>{order.vendor} order approved ✓</h2>
      <p className="muted">{order.lines.length} item{order.lines.length === 1 ? "" : "s"}. Send it to {vendor?.repName || "your sales rep"}.</p>
      <div className="stack block">
        <button type="button" className="btn primary" onClick={send}>Send PDF</button>
        {vendor?.repEmail && <a className="btn" href={emailHref({ order, business, vendor })}>Email {vendor.repName || "rep"}</a>}
        {vendor?.repPhone && <a className="btn" href={textHref({ order, business, vendor })}>Text {vendor.repName || "rep"}</a>}
        {!vendor?.repEmail && !vendor?.repPhone && <p className="note">Tip: add the rep's email and phone in Settings → Suppliers to send in one tap.</p>}
        {status && <p className="note" role="status">{status}</p>}
        <button type="button" className="btn quiet" onClick={onDone}>Back to orders</button>
      </div>
    </section>
  );
}

export default function OrdersScreen({ user, kitchen, flow }) {
  const [openDraft, setOpenDraft] = useState(null);
  const [approved, setApproved] = useState(null);
  const [newVendor, setNewVendor] = useState("");
  const [msg, setMsg] = useState("");
  const vendorByName = (name) => (kitchen.vendors || []).find((v) => norm(v.name) === norm(name));
  const named = (kitchen.vendors || []).filter((v) => (v.name || "").trim());

  if (approved) {
    return <SendPanel order={approved} user={user} vendor={vendorByName(approved.vendor)} kitchen={kitchen} onDone={() => setApproved(null)} />;
  }
  const draft = openDraft && flow.drafts.find((d) => d.id === openDraft);
  if (draft) {
    return (
      <DraftEditor
        key={draft.id}
        draft={draft} user={user} vendor={vendorByName(draft.vendor)} flow={flow} kitchen={kitchen}
        onClose={() => setOpenDraft(null)}
        onApproved={(order) => { setOpenDraft(null); setApproved(order); }}
      />
    );
  }

  const waiting = (kitchen.history || []).filter((o) => !o.received && o.type !== "quick" && o.type !== "auto").slice(0, 20);
  const recent = (kitchen.history || []).filter((o) => o.received).slice(0, 8);

  async function startNew() {
    const v = named.find((x) => String(x.id) === newVendor);
    if (!v) return;
    const res = await flow.newDraft(v);
    if (!res.ok) { setMsg(res.error); return; }
    setOpenDraft(res.draft.id);
  }

  return (
    <section>
      <h2 className="section-h" style={{ marginTop: 0 }}>Needs review {flow.drafts.length ? `(${flow.drafts.length})` : ""}</h2>
      {flow.drafts.length === 0 && <p className="muted">Nothing waiting. Finished counts show up here as draft orders.</p>}
      {flow.drafts.map((d) => {
        const n = d.lines.filter((l) => Number(l.qty) > 0).length;
        const nc = d.lines.filter((l) => !l.counted).length;
        return (
          <article className="card" key={d.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <h2 style={{ margin: 0 }}>{d.vendor}</h2>
              <span className="tag lower">Draft</span>
            </div>
            <p className="muted" style={{ margin: "4px 0 10px" }}>
              Counted {fmtDay(d.date)} · {n} item{n === 1 ? "" : "s"} to order{nc ? ` · ${nc} not counted` : ""}{d.auto ? " · closed at end of day" : ""}
            </p>
            <button type="button" className="btn primary block" onClick={() => setOpenDraft(d.id)}>Review & approve</button>
          </article>
        );
      })}

      {named.length > 0 && (
        <>
          <h2 className="section-h">New order</h2>
          <p className="muted" style={{ marginTop: 0 }}>Uses the latest counts from the Stock screen.</p>
          <div className="stack">
            <select value={newVendor} onChange={(e) => setNewVendor(e.target.value)} aria-label="Supplier for new order">
              <option value="">Pick a supplier…</option>
              {named.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <button type="button" className="btn" disabled={!newVendor} onClick={startNew}>Start order</button>
          </div>
          {msg && <p className="alert">{msg}</p>}
        </>
      )}

      {waiting.length > 0 && (
        <>
          <h2 className="section-h">Sent — waiting on delivery</h2>
          {waiting.map((o) => {
            const vendor = vendorByName(o.vendor);
            return (
              <article className="card" key={o.id}>
                <h2 style={{ margin: 0 }}>{o.vendor}</h2>
                <p className="muted" style={{ margin: "4px 0 10px" }}>
                  {fmtDate(o.date)} · {o.lines?.length || o.totalItems || 0} items{o.sentAt ? " · sent" : " · not sent yet"}{o.approvedBy ? ` · by ${o.approvedBy}` : ""}
                </p>
                <div className="stack">
                  <button type="button" className="btn" onClick={() => setApproved(o)}>{o.sentAt ? "Send again" : "Send PDF"}</button>
                  <button type="button" className="btn quiet" onClick={() => kitchen.patchOrder(o.id, { received: true, receivedAt: new Date().toISOString(), receivedBy: user.name || "" })}>Mark received</button>
                </div>
                {vendor?.repName ? <p className="note">Rep: {vendor.repName}</p> : null}
              </article>
            );
          })}
          <p className="note">Something short or damaged? Check it in line by line in the full app (Orders).</p>
        </>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="section-h">Received</h2>
          {recent.map((o) => (
            <article className="card" key={o.id}>
              <h2 style={{ margin: 0 }}>{o.vendor}</h2>
              <p className="muted" style={{ margin: 4 }}>{fmtDate(o.date)} · {o.lines?.length || 0} items</p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
