import { useEffect, useMemo, useState } from "react";
import { canManage, publicUser } from "../lib/auth";
import { DEMO_GROUPS } from "../lib/config";
import { lowItems } from "../lib/stockMath";
import LoginScreen from "./LoginScreen";
import LowStockScreen from "./LowStockScreen";
import OrderScreen from "./OrderScreen";
import SettingsScreen from "./SettingsScreen";
import StockScreen from "./StockScreen";
import TrialGate from "./TrialGate";
import { useKitchenData } from "./useKitchenData";
import "./simple.css";

const SAVE_LABEL = { saving: "Saving…", saved: "Saved", local: "On this device" };

function readSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem("moe_session") || "null");
    if (!stored || typeof stored.email !== "string" || typeof stored.role !== "string") return null;
    return stored;
  } catch {
    return null;
  }
}

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
    expired: !isDemo && !!subscription && !trialing && !active,
  };
}

function RepNotice({ onLogout }) {
  return (
    <main className="shell">
      <p className="brand">MOE</p>
      <h1>Sales rep tools</h1>
      <p className="muted">Rep accounts still use the classic app.</p>
      <div className="stack" style={{ marginTop: 16 }}>
        <a className="btn primary" href="/app?classic=1">Open classic MOE</a>
        <button type="button" className="btn quiet" onClick={onLogout}>Sign out</button>
      </div>
    </main>
  );
}

function Kitchen({ user, onLogout }) {
  const data = useKitchenData(user);
  const [tab, setTab] = useState("stock");
  const [query, setQuery] = useState("");
  const [preferredVendor, setPreferredVendor] = useState("");
  const manager = canManage(user);
  const access = accessFor(user.group, data.subscription);
  const low = useMemo(() => lowItems(data.inventory, data.stock), [data.inventory, data.stock]);

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

  if (access.expired) {
    return <TrialGate onSelectPlan={data.selectPlan} onLogout={onLogout} />;
  }

  const tabs = [
    ["stock", "Stock"],
    ["low", "Low"],
    ["order", "Order"],
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
            <strong>Saved on this device only.</strong> {data.saveError}
          </div>
        )}
        {tab === "stock" && (
          <StockScreen inventory={data.inventory} stock={data.stock} updateStock={data.updateStock} query={query} onQuery={setQuery} />
        )}
        {tab === "low" && (
          <LowStockScreen
            inventory={data.inventory}
            stock={data.stock}
            canOrder={manager}
            onCount={(name) => { setQuery(name); setTab("stock"); }}
            onOrder={(vendor) => { setPreferredVendor(vendor); setTab("order"); }}
          />
        )}
        {tab === "order" && (
          <OrderScreen
            inventory={data.inventory}
            stock={data.stock}
            vendors={data.vendors}
            history={data.history}
            user={user}
            canOrder={manager}
            placeOrder={data.placeOrder}
            preferredVendor={preferredVendor}
            onOpenSettings={() => setTab("settings")}
          />
        )}
        <div hidden={tab !== "settings"}>
          <SettingsScreen
            user={user}
            inventory={data.inventory}
            vendors={data.vendors}
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
            {key === "low" && low.length > 0 ? <span className="badge">{low.length}</span> : null}
          </button>
        ))}
      </nav>
    </>
  );
}

export default function SimpleApp() {
  const [user, setUser] = useState(readSession);

  function onLogin(next) {
    const safe = publicUser(next);
    try { sessionStorage.setItem("moe_session", JSON.stringify(safe)); } catch { /* ignore */ }
    setUser(safe);
  }

  function onLogout() {
    try { sessionStorage.removeItem("moe_session"); } catch { /* ignore */ }
    setUser(null);
  }

  if (!user) return <LoginScreen onLogin={onLogin} />;
  if (user.role === "rep") return <RepNotice onLogout={onLogout} />;
  return <Kitchen user={user} onLogout={onLogout} />;
}
