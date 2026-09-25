import { useEffect, useState } from "react";
import { ORDER_UNITS, addItem, moveItem, nextItemId, removeItem, renameVendorOnItems } from "../lib/inventoryEdits";
import TeamPanel from "./TeamPanel";
import { DAYS_SHORT, flatItems, itemsMissingSupplier } from "../lib/stockMath";

function SupplierEditor({ vendors, inventory, saveVendors, saveInventory }) {
  const [draft, setDraft] = useState(vendors);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setDraft(vendors); }, [vendors, dirty]);

  function update(id, patch) {
    setDraft((prev) => prev.map((vendor) => (vendor.id === id ? { ...vendor, ...patch } : vendor)));
    setDirty(true);
  }

  function toggleDay(id, day) {
    setDraft((prev) => prev.map((vendor) => {
      if (vendor.id !== id) return vendor;
      const days = vendor.orderDays || [];
      const orderDays = days.includes(day) ? days.filter((value) => value !== day) : [...days, day].sort();
      return { ...vendor, orderDays };
    }));
    setDirty(true);
  }

  function save() {
    const cleaned = draft.map((vendor) => ({ ...vendor, name: vendor.name.trim() })).filter((vendor) => vendor.name);
    let nextInventory = inventory;
    vendors.forEach((vendor) => {
      const match = cleaned.find((entry) => entry.id === vendor.id);
      if (match && vendor.name && match.name !== vendor.name) {
        nextInventory = renameVendorOnItems(nextInventory, vendor.name, match.name);
      }
    });
    if (nextInventory !== inventory) saveInventory(nextInventory);
    saveVendors(cleaned);
    setDraft(cleaned);
    setDirty(false);
  }

  return (
    <div>
      {draft.map((vendor) => (
        <article className="card" key={vendor.id}>
          <label className="field">Supplier
            <input value={vendor.name} onChange={(event) => update(vendor.id, { name: event.target.value })} placeholder="Anacapri" />
          </label>
          <p className="note" style={{ margin: "6px 0 4px" }}>Order days — a count opens for this supplier on these days</p>
          <div className="days" role="group" aria-label={`Order days for ${vendor.name || "supplier"}`}>
            {DAYS_SHORT.map((label, day) => (
              <button key={label} type="button" aria-pressed={(vendor.orderDays || []).includes(day)} onClick={() => toggleDay(vendor.id, day)}>{label}</button>
            ))}
          </div>
          <div className="grid">
            <label className="field">Sales rep
              <input value={vendor.repName || ""} onChange={(event) => update(vendor.id, { repName: event.target.value })} placeholder="Name" />
            </label>
            <label className="field">Rep phone
              <input type="tel" value={vendor.repPhone || ""} onChange={(event) => update(vendor.id, { repPhone: event.target.value })} />
            </label>
          </div>
          <label className="field">Rep email
            <input type="email" value={vendor.repEmail || ""} onChange={(event) => update(vendor.id, { repEmail: event.target.value })} />
          </label>
          <button type="button" className="btn quiet danger" onClick={() => { setDraft((prev) => prev.filter((entry) => entry.id !== vendor.id)); setDirty(true); }}>Remove</button>
        </article>
      ))}
      <div className="stack">
        <button type="button" className="btn" onClick={() => { setDraft((prev) => [...prev, { id: Date.now(), name: "", orderDays: [] }]); setDirty(true); }}>Add supplier</button>
        <button type="button" className="btn primary" disabled={!dirty} onClick={save}>Save suppliers</button>
      </div>
    </div>
  );
}

function ItemEditor({ inventory, vendors, saveInventory }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(null);
  const items = flatItems(inventory).filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()));
  const supplierNames = vendors.map((vendor) => vendor.name).filter(Boolean);

  function open(item) {
    setOpenId(item.id);
    setDraft({
      name: item.name,
      section: item.section || "General",
      vendor: item.vendor || "",
      reorder: item.reorder ?? 0,
      max_stock: item.max_stock ?? 0,
      order_unit: item.order_unit || "Case",
      upu: item.upu || 1,
    });
  }

  function saveOpen() {
    const patch = {
      name: draft.name.trim(),
      vendor: draft.vendor,
      reorder: Math.max(0, Number(draft.reorder) || 0),
      max_stock: Math.max(0, Number(draft.max_stock) || 0),
      order_unit: draft.order_unit,
      upu: Math.max(1, Number(draft.upu) || 1),
    };
    if (!patch.name) return;
    saveInventory(moveItem(inventory, openId, draft.section, patch));
    setOpenId(null);
  }

  function createItem(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const item = {
      id: nextItemId(inventory),
      name,
      section: String(data.get("section") || "General"),
      vendor: String(data.get("vendor") || ""),
      reorder: Math.max(0, Number(data.get("reorder")) || 0),
      max_stock: Math.max(0, Number(data.get("par")) || 0),
      order_unit: String(data.get("unit") || "Case"),
      upu: Math.max(1, Number(data.get("upu")) || 1),
    };
    saveInventory(addItem(inventory, item));
    event.target.reset();
    setAdding(false);
  }

  return (
    <div>
      <label className="field">Find an item
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button type="button" className="btn" onClick={() => setAdding((value) => !value)}>{adding ? "Close" : "Add item"}</button>
      {adding && (
        <form className="card block" onSubmit={createItem}>
          <label className="field">Name<input name="name" required /></label>
          <label className="field">Section<input name="section" defaultValue="General" /></label>
          <label className="field">Supplier
            <select name="vendor" defaultValue="">
              <option value="">No supplier</option>
              {supplierNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <div className="grid">
            <label className="field">Reorder at<input name="reorder" inputMode="numeric" defaultValue="1" /></label>
            <label className="field">Par<input name="par" inputMode="numeric" defaultValue="1" /></label>
          </div>
          <div className="grid">
            <label className="field">Order unit
              <select name="unit" defaultValue="Case">{ORDER_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select>
            </label>
            <label className="field">Units per order<input name="upu" inputMode="numeric" defaultValue="1" /></label>
          </div>
          <button className="btn primary" type="submit">Save item</button>
        </form>
      )}
      {items.map((item) => (
        <article className="card" key={item.id}>
          <h2>{item.name}</h2>
          <p>{item.section} · reorder {item.reorder} · par {item.max_stock} · {item.vendor || "No supplier"}</p>
          {openId !== item.id ? (
            <button type="button" className="btn block" onClick={() => open(item)}>Edit</button>
          ) : (
            <div className="block">
              <label className="field">Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label className="field">Section<input value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} /></label>
              <label className="field">Supplier
                <select value={draft.vendor} onChange={(event) => setDraft({ ...draft, vendor: event.target.value })}>
                  <option value="">No supplier</option>
                  {supplierNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <div className="grid">
                <label className="field">Reorder at<input inputMode="numeric" value={draft.reorder} onChange={(event) => setDraft({ ...draft, reorder: event.target.value })} /></label>
                <label className="field">Par<input inputMode="numeric" value={draft.max_stock} onChange={(event) => setDraft({ ...draft, max_stock: event.target.value })} /></label>
              </div>
              <div className="grid">
                <label className="field">Order unit
                  <select value={draft.order_unit} onChange={(event) => setDraft({ ...draft, order_unit: event.target.value })}>
                    {ORDER_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                </label>
                <label className="field">Units per order<input inputMode="numeric" value={draft.upu} onChange={(event) => setDraft({ ...draft, upu: event.target.value })} /></label>
              </div>
              <div className="stack">
                <button type="button" className="btn primary" onClick={saveOpen}>Save item</button>
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
      ))}
    </div>
  );
}

const PLAN_NAMES = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

export default function SettingsScreen({ user, inventory, vendors, subscription, trialDays, isTrialing, canEdit, saveInventory, saveVendors, onLogout }) {
  const [panel, setPanel] = useState(canEdit ? "suppliers" : "account");
  const missing = itemsMissingSupplier(inventory, vendors);

  return (
    <section>
      <div className="seg" role="group" aria-label="Settings sections">
        {canEdit && <button type="button" aria-pressed={panel === "suppliers"} onClick={() => setPanel("suppliers")}>Suppliers</button>}
        {canEdit && <button type="button" aria-pressed={panel === "items"} onClick={() => setPanel("items")}>Items</button>}
        {canEdit && <button type="button" aria-pressed={panel === "team"} onClick={() => setPanel("team")}>Team</button>}
        <button type="button" aria-pressed={panel === "account"} onClick={() => setPanel("account")}>Account</button>
      </div>
      {canEdit && panel === "suppliers" && <SupplierEditor vendors={vendors} inventory={inventory} saveVendors={saveVendors} saveInventory={saveInventory} />}
      {canEdit && panel === "items" && <ItemEditor inventory={inventory} vendors={vendors} saveInventory={saveInventory} />}
      {canEdit && panel === "team" && <TeamPanel user={user} />}
      {panel === "account" && (
        <div className="card">
          <h2>{user.business?.name || "Kitchen"}</h2>
          <p>{user.name} · {user.email}</p>
          {isTrialing && <p>Pro trial · {trialDays} day{trialDays === 1 ? "" : "s"} left</p>}
          {subscription?.status === "active" && <p>{PLAN_NAMES[subscription.plan] || "MOE"} plan · active</p>}
          {missing.length > 0 && <p>{missing.length} items still need a supplier.</p>}
          <p>Recipes, invoices, waste, insights, and role permissions are in the full app.</p>
          <div className="stack block">
            <a className="btn" href="/app?classic=1">Open full MOE</a>
            <button type="button" className="btn quiet" onClick={onLogout}>Sign out</button>
          </div>
        </div>
      )}
    </section>
  );
}
