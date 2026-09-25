import { useEffect, useState } from "react";
import { renameVendorOnItems } from "../lib/inventoryEdits";
import TeamPanel from "./TeamPanel";
import ItemSetup from "./ItemSetup";
import { DAYS_SHORT, itemsMissingSupplier } from "../lib/stockMath";

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

const PLAN_NAMES = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

export default function SettingsScreen({ user, inventory, vendors, priceHistory, savePrice, savePrices, subscription, trialDays, isTrialing, canEdit, saveInventory, saveVendors, onLogout }) {
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
      {canEdit && panel === "items" && <ItemSetup inventory={inventory} vendors={vendors} priceHistory={priceHistory} saveInventory={saveInventory} saveVendors={saveVendors} savePrice={savePrice} savePrices={savePrices} />}
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
