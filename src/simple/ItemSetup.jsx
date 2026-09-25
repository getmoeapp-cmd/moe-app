import { useState } from "react";
import {
  UNIT_KINDS, caseWords, countUnit, fromCount, itemCost, kindFromSizeDesc, manualPriceEntry, money,
  orderPhrase, packDescription, pieceWords, smallMoney, toCount, unitSetup,
} from "../lib/costing";
import { ORDER_UNITS, addItem, moveItem, nextItemId, removeItem } from "../lib/inventoryEdits";
import { calcOrderSplit, flatItems, sectionLabel } from "../lib/stockMath";

// The product list — one row per item, same columns as a kitchen costing sheet:
// section · description · vendor · vendor item # · case price · # per case ·
// size (what one unit is) · conversion · → cost per unit / per oz, plus how it's
// counted and its par.

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

function toDraft(item, priceHistory) {
  const s = unitSetup(item);
  const c = itemCost(item, priceHistory);
  return {
    name: item.name || "", section: item.section || "General", vendor: item.vendor || "", vendor_sku: item.vendor_sku || "",
    price: c.casePrice != null ? c.casePrice.toFixed(2) : "", upu: String(item.upu || 1),
    kind: item.unit_name || s.kind, basePer: item.base_per_unit != null ? String(item.base_per_unit) : "",
    order_unit: item.order_unit || "Case", count_by: item.count_by || "unit",
    reorder: String(toCount(item, item.reorder ?? 0) ?? 0),
    order_qty: String(Number(item.order_qty) > 0 ? item.order_qty
      : Math.max(1, Math.ceil(((Number(item.max_stock) || 0) - (Number(item.reorder) || 0)) / Math.max(1, Number(item.upu) || 1)))),
    fill_to: String(toCount(item, item.max_stock ?? 0) ?? 0),
    sells_split: item.sells_split ? "split" : "case",
    piece_name: item.piece_name || "",
    each_price: item.each_price != null ? String(item.each_price) : "",
  };
}

function draftToPatch(d) {
  const base = {
    name: d.name.trim(), vendor: d.vendor, vendor_sku: d.vendor_sku.trim(),
    upu: Math.max(1, parseInt(d.upu, 10) || 1), unit_name: d.kind,
    base_per_unit: d.kind === "pack" || d.kind === "piece_oz" ? Math.max(0.01, num(d.basePer) || 1) : null,
    order_unit: d.order_unit, count_by: d.count_by,
    piece_name: (d.piece_name || "").trim(), sells_split: d.sells_split === "split",
    each_price: num(d.each_price) > 0 ? Math.round(num(d.each_price) * 100) / 100 : null,
  };
  // Reorder point / top-up level are typed in the count unit (stored in single units).
  const reorder = fromCount(base, Math.max(0, num(d.reorder)));
  if (base.sells_split) {
    const fill = Math.max(reorder, fromCount(base, Math.max(0, num(d.fill_to))));
    return { ...base, reorder, order_qty: null, max_stock: fill };
  }
  const orderQty = Math.max(0, Math.round(num(d.order_qty) * 100) / 100);
  return { ...base, reorder, order_qty: orderQty, max_stock: reorder + orderQty * base.upu };
}

function ruleText(item) {
  const cu = countUnit(item);
  const ou = String(item.order_unit || "case").toLowerCase();
  if (item.sells_split) return `below ${toCount(item, item.reorder ?? 0)} ${cu.label} → back up to ${toCount(item, item.max_stock ?? 0)} (cases + singles)`;
  if (Number(item.order_qty) > 0) return `below ${toCount(item, item.reorder ?? 0)} ${cu.label} → order ${item.order_qty} ${ou}${Number(item.order_qty) === 1 ? "" : "s"}`;
  return `below ${toCount(item, item.reorder ?? 0)} → fill to ${toCount(item, item.max_stock ?? 0)} ${cu.label}`;
}

function Fields({ d, set, vendors }) {
  const p = draftToPatch(d);
  const preview = itemCost({ ...p, case_price: num(d.price) }, {});
  const cu = countUnit(p);
    // Example: what the rep would see the first time it drops just under the reorder point.
  const ex = calcOrderSplit(p, Math.max(0, p.reorder - 1));
  const example = orderPhrase(p, ex.cases, ex.each);
  return (
    <>
      <label className="field">Item description<input value={d.name} onChange={(e) => set({ name: e.target.value })} required /></label>
      <div className="grid">
        <label className="field">Section<input value={d.section} onChange={(e) => set({ section: e.target.value })} /></label>
        <label className="field">Vendor
          <select value={d.vendor} onChange={(e) => set({ vendor: e.target.value })}>
            <option value="">No supplier</option>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <div className="grid">
        <label className="field">Vendor item #<input value={d.vendor_sku} onChange={(e) => set({ vendor_sku: e.target.value })} placeholder="On the PDF" /></label>
        <label className="field">Order unit
          <select value={d.order_unit} onChange={(e) => set({ order_unit: e.target.value })}>{ORDER_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        </label>
      </div>
      <div className="grid">
        <label className="field">Purchase price ($)<input inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} /></label>
        <label className="field"># per {d.order_unit.toLowerCase()}<input inputMode="numeric" value={d.upu} onChange={(e) => set({ upu: e.target.value })} /></label>
      </div>
      <label className="field">Size — each one is
        <select value={d.kind} onChange={(e) => set({ kind: e.target.value })}>{UNIT_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      {(d.kind === "pack" || d.kind === "piece_oz") && (
        <label className="field">{d.kind === "pack" ? "Pieces in each one" : "Ounces in each one"}<input inputMode="decimal" value={d.basePer} onChange={(e) => set({ basePer: e.target.value })} /></label>
      )}
      {(d.kind === "each" || d.kind === "pack" || d.kind === "piece_oz") && (
        <label className="field">What one is called (optional)<input value={d.piece_name} onChange={(e) => set({ piece_name: e.target.value })} placeholder="loaf, bottle, bag, tub…" /></label>
      )}
      {preview.perBase != null && (
        <p className="note">Item cost {money(preview.perUnit)} · <strong>{smallMoney(preview.perBase)} per {preview.base === "oz" ? "oz" : "piece"}</strong> · orders as {packDescription(draftToPatch(d))}</p>
      )}
      <label className="field">Count it by
        <select value={d.count_by} onChange={(e) => set({ count_by: e.target.value })}>
          <option value="unit">Single units ({countUnit({ ...draftToPatch(d), count_by: "unit" }).label})</option>
          <option value="case">Whole {d.order_unit.toLowerCase()}s (halves OK)</option>
        </select>
      </label>
      <label className="field">Vendor sells it as
        <select value={d.sells_split} onChange={(e) => set({ sells_split: e.target.value })}>
          <option value="case">Full {caseWords(p).one} only</option>
          <option value="split">{caseWords(p).one.replace(/^./, (c) => c.toUpperCase())} or single {pieceWords(p).many} (they'll break a {caseWords(p).one})</option>
        </select>
      </label>
      {d.sells_split === "split" ? (
        <>
          <div className="grid">
            <label className="field">Reorder when below ({cu.label})<input inputMode="decimal" value={d.reorder} onChange={(e) => set({ reorder: e.target.value })} /></label>
            <label className="field">Bring back up to ({cu.label})<input inputMode="decimal" value={d.fill_to} onChange={(e) => set({ fill_to: e.target.value })} /></label>
          </div>
          <label className="field">Price for a single {pieceWords(p).one} ($, optional)<input inputMode="decimal" value={d.each_price} onChange={(e) => set({ each_price: e.target.value })} placeholder={preview.perUnit != null ? `${money(preview.perUnit)} if left blank` : ""} /></label>
        </>
      ) : (
        <div className="grid">
          <label className="field">Reorder when below ({cu.label})<input inputMode="decimal" value={d.reorder} onChange={(e) => set({ reorder: e.target.value })} /></label>
          <label className="field">Then order ({caseWords(p).many})<input inputMode="decimal" value={d.order_qty} onChange={(e) => set({ order_qty: e.target.value })} /></label>
        </div>
      )}
      <div className="rule-box">
        <p style={{ margin: 0 }}><strong>Store counts:</strong> {cu.label}{cu.hint ? ` (${cu.hint})` : ""}</p>
        <p style={{ margin: "4px 0 0" }}><strong>Rule:</strong> {d.sells_split === "split"
          ? `fewer than ${d.reorder || 0} ${cu.label} → order back up to ${d.fill_to || 0} ${cu.label}, whole ${caseWords(p).many} first, singles for the rest.`
          : `fewer than ${d.reorder || 0} ${cu.label} → order ${d.order_qty || 0} ${Number(d.order_qty) === 1 ? caseWords(p).one : caseWords(p).many}.`}</p>
        <p style={{ margin: "4px 0 0" }}><strong>Rep sees on the PDF:</strong> {example.main}{example.detail ? ` — ${example.detail}` : ""} · {packDescription(p)}</p>
      </div>
    </>
  );
}

// ── Import a costing-sheet CSV (Google Sheets: File → Download → CSV) ─────
function splitCsv(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseProductCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const hi = lines.findIndex((l) => /item description|description|item name/i.test(l));
  if (hi < 0) return { error: "Couldn't find a header row with “Item Description”." };
  const head = splitCsv(lines[hi]).map((h) => h.toLowerCase());
  const col = (re) => head.findIndex((h) => re.test(h));
  const c = {
    section: col(/usage section|section|category/), name: col(/item description|description|item name/),
    vendor: col(/^vendor$|^vendor\b(?!.*(order|#|number))/), sku: col(/order number|item #|item number|sku/),
    price: col(/purchase price|case price|price/), per: col(/# per|per case|pack/), size: col(/size desc|size|unit/),
    conv: col(/conv/),
  };
  const money = (v) => num(String(v || "").replace(/[$,]/g, ""));
  const rows = lines.slice(hi + 1).map(splitCsv).map((r) => ({
    section: (c.section >= 0 && r[c.section]) || "Imported",
    name: (r[c.name] || "").trim(),
    vendor: c.vendor >= 0 ? r[c.vendor] || "" : "",
    vendor_sku: c.sku >= 0 ? r[c.sku] || "" : "",
    price: c.price >= 0 ? money(r[c.price]) : 0,
    upu: c.per >= 0 ? Math.max(1, Math.round(num(r[c.per])) || 1) : 1,
    ...kindFromSizeDesc(c.size >= 0 ? r[c.size] : "", c.conv >= 0 ? num(r[c.conv]) : 0),
  })).filter((r) => r.name && !/^total/i.test(r.name));
  return { rows };
}

function ImportCsv({ inventory, vendors, saveInventory, saveVendors, savePrices, onDone }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const existing = Object.fromEntries(flatItems(inventory).map((i) => [i.name.trim().toLowerCase(), i]));

  function read(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseProductCsv(String(reader.result || ""));
      if (res.error) { setError(res.error); setRows(null); return; }
      setError(""); setRows(res.rows);
    };
    reader.readAsText(file);
  }

  async function run() {
    setBusy(true);
    let inv = inventory;
    const prices = {};
    const now = [];
    rows.forEach((r) => {
      const match = existing[r.name.toLowerCase()];
      const patch = { name: r.name, vendor: r.vendor || match?.vendor || "", vendor_sku: r.vendor_sku, upu: r.upu, unit_name: r.unit_name, base_per_unit: r.base_per_unit ?? null };
      let item;
      if (match) {
        item = { ...match, ...patch };
        inv = moveItem(inv, match.id, match.section, patch);
      } else {
        item = { id: nextItemId(inv), section: r.section, order_unit: "Case", max_stock: r.upu, reorder: 0, order_qty: 1, count_by: "unit", ...patch };
        inv = addItem(inv, item);
      }
      if (r.price > 0) prices[item.id] = manualPriceEntry(item, r.price);
      now.push(item);
    });
    const vendorNames = new Set(vendors.map((v) => (v.name || "").trim().toLowerCase()));
    const newVendors = [...new Set(rows.map((r) => r.vendor.trim()).filter((v) => v && !vendorNames.has(v.toLowerCase())))];
    if (newVendors.length) await saveVendors([...vendors, ...newVendors.map((name, i) => ({ id: Date.now() + i, name, orderDays: [] }))]);
    await saveInventory(inv);
    if (Object.keys(prices).length) await savePrices(prices);
    setBusy(false);
    onDone(`Imported ${rows.length} items${newVendors.length ? ` and ${newVendors.length} new supplier${newVendors.length === 1 ? "" : "s"}` : ""}. Set each new item's reorder point so MOE knows when to order.`);
  }

  const newCount = rows ? rows.filter((r) => !existing[r.name.toLowerCase()]).length : 0;
  return (
    <article className="card">
      <h2 style={{ marginTop: 0 }}>Import a product list</h2>
      <p className="muted">From a costing sheet: in Google Sheets open the product list tab → File → Download → CSV. Columns MOE reads: Usage Section, Item Description, Vendor, Vendor Item Order Number, Purchase Price, # Per Case, Size Desc, Conv to Ounces or Units.</p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
      {error && <p className="alert">{error}</p>}
      {rows && (
        <>
          <p className="note">{rows.length} rows · {newCount} new · {rows.length - newCount} update items with the same name</p>
          <div style={{ maxHeight: 220, overflow: "auto", fontSize: 13 }}>
            {rows.slice(0, 50).map((r, i) => (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
                <strong>{r.name}</strong> · {r.vendor || "—"} · {r.price ? money(r.price) : "no price"} · {r.upu} × {r.unit_name}{r.base_per_unit ? ` (${r.base_per_unit})` : ""}
              </div>
            ))}
          </div>
          <div className="stack block">
            <button type="button" className="btn primary" disabled={busy} onClick={run}>{busy ? "Importing…" : `Import ${rows.length} items`}</button>
            <button type="button" className="btn quiet" onClick={() => setRows(null)}>Cancel</button>
          </div>
        </>
      )}
    </article>
  );
}

export default function ItemSetup({ inventory, vendors, priceHistory, saveInventory, saveVendors, savePrice, savePrices }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [adding, setAdding] = useState(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");
  const vendorNames = vendors.map((v) => v.name).filter(Boolean);
  const items = flatItems(inventory).filter((i) => !query.trim() || `${i.name} ${i.vendor} ${i.vendor_sku || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function persistPrice(item, d, before) {
    const p = num(d.price);
    if (p > 0 && (before == null || Math.abs(p - before) > 0.004 || (Number(item.upu) || 1) !== (parseInt(d.upu, 10) || 1))) {
      await savePrice(item.id, manualPriceEntry({ ...item, ...draftToPatch(d) }, p));
    }
  }

  async function saveOpen(item) {
    const patch = draftToPatch(draft);
    if (!patch.name) return;
    await saveInventory(moveItem(inventory, item.id, draft.section || "General", patch));
    await persistPrice(item, draft, itemCost(item, priceHistory).casePrice);
    setOpenId(null);
  }

  async function create() {
    const patch = draftToPatch(adding);
    if (!patch.name) return;
    const item = { id: nextItemId(inventory), section: adding.section || "General", ...patch };
    await saveInventory(addItem(inventory, item));
    await persistPrice(item, adding, null);
    setAdding(null);
  }

  const blank = { name: "", section: "General", vendor: "", vendor_sku: "", price: "", upu: "1", kind: "each", basePer: "", order_unit: "Case", count_by: "unit", reorder: "0", order_qty: "1", fill_to: "0", sells_split: "case", piece_name: "", each_price: "" };
  let lastSection = null;
  return (
    <div>
      <label className="field">Find an item<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, vendor, or item #" /></label>
      <div className="stack">
        <button type="button" className="btn" onClick={() => { setAdding(adding ? null : blank); }}>{adding ? "Close" : "Add item"}</button>
        <button type="button" className="btn quiet" onClick={() => setImporting((v) => !v)}>{importing ? "Close import" : "Import from costing sheet"}</button>
      </div>
      {msg && <p className="note" role="status">{msg}</p>}
      {importing && (
        <ImportCsv inventory={inventory} vendors={vendors} saveInventory={saveInventory} saveVendors={saveVendors} savePrices={savePrices}
          onDone={(m) => { setMsg(m); setImporting(false); }} />
      )}
      {adding && (
        <div className="card block">
          <Fields d={adding} set={(p) => setAdding({ ...adding, ...p })} vendors={vendorNames} />
          <button type="button" className="btn primary" onClick={create}>Save item</button>
        </div>
      )}
      {items.map((item) => {
        const c = itemCost(item, priceHistory);
        const cu = countUnit(item);
        const label = sectionLabel(item.section);
        const head = label !== lastSection ? <h2 className="section-h" key={`h_${label}`}>{label}</h2> : null;
        lastSection = label;
        return [head, (
          <article className="card" key={item.id}>
            <h2 style={{ margin: 0, fontSize: "1.02rem" }}>{item.name}</h2>
            <p className="muted" style={{ margin: "2px 0 8px" }}>
              {item.vendor || "No supplier"}{item.vendor_sku ? ` · #${item.vendor_sku}` : ""} · {packDescription(item)}
              {c.casePrice != null ? ` · ${money(c.casePrice)} → ${smallMoney(c.perBase)}/${c.base === "oz" ? "oz" : "pc"}` : " · no price"}
              <br />Counted in {cu.label} · {ruleText(item)}
            </p>
            {openId !== item.id ? (
              <button type="button" className="btn block" onClick={() => { setDraft(toDraft(item, priceHistory)); setOpenId(item.id); }}>Edit</button>
            ) : (
              <div className="block">
                <Fields d={draft} set={(p) => setDraft({ ...draft, ...p })} vendors={vendorNames} />
                <div className="stack">
                  <button type="button" className="btn primary" onClick={() => saveOpen(item)}>Save item</button>
                  <button type="button" className="btn danger" onClick={() => {
                    if (!window.confirm(`Remove ${item.name} from the kitchen list?`)) return;
                    saveInventory(removeItem(inventory, item.id));
                    setOpenId(null);
                  }}>Remove item</button>
                  <button type="button" className="btn quiet" onClick={() => setOpenId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </article>
        )];
      })}
    </div>
  );
}
