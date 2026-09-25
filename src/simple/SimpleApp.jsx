import { useEffect, useState } from "react";
import { canManage, createKitchenForMe, joinKitchenAsMe } from "../lib/auth";
import { DEMO_GROUPS } from "../lib/config";
import CountScreen from "./CountScreen";
import OrdersScreen from "./OrdersScreen";
import SettingsScreen from "./SettingsScreen";
import StockScreen from "./StockScreen";
import TrialGate from "./TrialGate";
import CostsScreen from "./CostsScreen";
import { useKitchenData } from "./useKitchenData";
import { useOrderFlow } from "./useOrderFlow";
import "./simple.css";

const SAVE_LABEL = { saving: "Saving…", saved: "Saved", local: "On this device" };

function accessFor(group, subscription) {
  const isDemo = DEMO_GROUPS.includes(group);
  const end = subscription?.trialEnd ? new Date(subscription.trialEnd) : null;
  const days = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)) : 0;
  const trialing = subscription?.status === "trialing" && days > 0;
  const active = subscription?.status === "active";
  return {
    isDemo,
    days,
    trialing,
    expired: !isDemo && !trialing && !active,
  };
}

function Kitchen({ user, onLogout }) {
  const data = useKitchenData(user);
  const flow = useOrderFlow(user, data);
  const [tab, setTab] = useState("count");
  const [query, setQuery] = useState("");
  const manager = canManage(user);
  const access = accessFor(user.group, data.subscription);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previous = meta?.getAttribute("content");
    if (meta) meta.setAttribute("content", "#f4f1ea");
    document.title = "MOE — Kitchen";
    return () => {
      if (meta && previous) meta.setAttribute("content", previous);
      document.title = "MOE — Make Ordering Easy";
    };
  }, []);

  if (!user.group) {
    return (
      <main className="shell">
        <h1>This account has no kitchen</h1>
        <button type="button" className="btn" onClick={onLogout}>Sign out</button>
      </main>
    );
  }

  if (data.status === "loading") {
    return <main className="shell"><p className="brand">MOE</p><h1>Loading the kitchen…</h1></main>;
  }

  if (data.status === "offline" && data.inventory.length === 0) {
    return (
      <main className="shell">
        <p className="brand">MOE</p>
        <h1>Can't reach MOE</h1>
        <p className="muted">{data.loadError || "Check the connection."} Nothing was changed.</p>
        <div className="stack" style={{ marginTop: 16 }}>
          <button type="button" className="btn primary" onClick={data.reload}>Try again</button>
          <button type="button" className="btn quiet" onClick={onLogout}>Sign out</button>
        </div>
      </main>
    );
  }

  if (data.status === "ready" && access.expired) {
    return <TrialGate user={user} onLogout={onLogout} />;
  }

  const tabs = [
    ["count", "Count"],
    ...(manager ? [["orders", "Orders"]] : []),
    ["stock", "Stock"],
    ...(manager ? [["costs", "Costs"]] : []),
    ["settings", "Settings"],
  ];

  return (
    <>
      <div className="shell">
        <header className="topbar">
          <div>
            <p className="brand">MOE</p>
            <h1>{user.business?.name || "Kitchen"}</h1>
            {access.trialing && !access.isDemo && <p className="subline">Trial · {access.days} day{access.days === 1 ? "" : "s"} left</p>}
          </div>
          <p className="save" data-state={data.saveState}>{SAVE_LABEL[data.saveState]}</p>
        </header>
        {data.saveError && (
          <div className="banner" role="status">
            <strong>Not synced.</strong> {data.saveError}
          </div>
        )}
        {tab === "stock" && (
          <StockScreen inventory={data.inventory} stock={data.stock} updateStock={data.updateStock} query={query} onQuery={setQuery} />
        )}
        {tab === "count" && <CountScreen user={user} kitchen={data} flow={flow} />}
        {tab === "orders" && manager && <OrdersScreen user={user} kitchen={data} flow={flow} />}
        {tab === "costs" && manager && <CostsScreen user={user} kitchen={data} />}
        <div hidden={tab !== "settings"}>
          <SettingsScreen
            user={user}
            inventory={data.inventory}
            vendors={data.vendors}
            priceHistory={data.priceHistory}
            savePrice={data.savePrice}
            savePrices={data.savePrices}
            subscription={data.subscription}
            trialDays={access.days}
            isTrialing={access.trialing && !access.isDemo}
            canEdit={manager}
            saveInventory={data.saveInventory}
            saveVendors={data.saveVendors}
            onLogout={onLogout}
          />
        </div>
      </div>
      <nav className="tabs" aria-label="Kitchen">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>
            {label}
            {key === "orders" && flow.drafts.length > 0 ? <span className="badge">{flow.drafts.length}</span> : null}
          </button>
        ))}
      </nav>
    </>
  );
}

function NoKitchen({ user, onLogout, onRefresh }) {
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(fn) {
    setBusy(true); setError("");
    const result = await fn();
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onRefresh();
  }
  return (
    <main className="shell login">
      <p className="brand">MOE</p>
      <h1>Set up your kitchen</h1>
      <p className="muted">Signed in as {user.email}. This login isn't part of a kitchen yet.</p>
      {user.isAdmin && <p><a className="btn" href="/app?classic=1">Open admin</a></p>}
      <form onSubmit={(e) => { e.preventDefault(); run(() => createKitchenForMe({ business, phone })); }} style={{ marginTop: 20 }}>
        <label className="field">Restaurant name
          <input value={business} onChange={(e) => setBusiness(e.target.value)} required />
        </label>
        <label className="field">Phone
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>Start 14-day free trial</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); run(() => joinKitchenAsMe(code)); }} style={{ marginTop: 28 }}>
        <label className="field">Or join with an invite code
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        </label>
        <button className="btn" type="submit" disabled={busy || !code.trim()}>Join kitchen</button>
      </form>
      {error && <p className="alert" role="alert">{error}</p>}
      <p className="note"><button type="button" className="btn quiet" onClick={onLogout}>Sign out</button></p>
    </main>
  );
}

export default function SimpleApp({ user, onLogout, onRefresh }) {
  if (!user.group) return <NoKitchen user={user} onLogout={onLogout} onRefresh={onRefresh} />;
  return <Kitchen user={user} onLogout={onLogout} />;
}
