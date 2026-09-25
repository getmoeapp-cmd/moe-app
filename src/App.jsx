import { useEffect, useState } from "react";
import ClassicRouter, { MoeApp } from "./kitchen_inventory_app";
import SimpleApp from "./simple/SimpleApp";
import LoginScreen, { SetPasswordScreen } from "./simple/LoginScreen";
import LegalPage from "./pages/LegalPage";
import { useSession } from "./lib/useSession";
import "./simple/simple.css";

export function currentSurface() {
  const path = (window.location.pathname.replace(/\/$/, "") || "/");
  const hash = window.location.hash || "";
  if (path === "/privacy" || hash === "#/privacy") return "privacy";
  if (path === "/terms" || hash === "#/terms") return "terms";
  if (path === "/contact" || hash === "#/contact") return "contact";
  const classic = new URLSearchParams(window.location.search).get("classic") === "1"
    || path.startsWith("/classic")
    || hash.startsWith("#/classic");
  const app = path === "/app" || path.startsWith("/app/") || hash === "#/app" || hash.startsWith("#/app")
    || path.startsWith("/classic") || hash.startsWith("#/classic");
  if (app && classic) return "classic";
  if (app) return "simple";
  return "marketing";
}

// Everything under /app and /classic needs a signed-in user. One session is
// shared by both apps, so switching between them no longer asks to sign in again.
function AppGate({ surface }) {
  const session = useSession();
  if (session.status === "loading") {
    return <main className="shell"><p className="brand">MOE</p><h1>Loading…</h1></main>;
  }
  if (session.status === "recovery") return <SetPasswordScreen onDone={session.doneRecovery} />;
  if (session.status !== "signedIn" || !session.user) {
    return <LoginScreen onLogin={session.onLogin} notice={session.error} />;
  }
  if (surface === "classic" && (session.user.group || session.user.isAdmin)) return <MoeApp key={session.user.id} initialUser={session.user} onLogout={session.onLogout} />;
  return <SimpleApp key={session.user.id} user={session.user} onLogout={session.onLogout} onRefresh={session.refresh} />;
}

export default function App() {
  const [surface, setSurface] = useState(currentSurface);
  useEffect(() => {
    const sync = () => setSurface(currentSurface());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  if (surface === "privacy" || surface === "terms" || surface === "contact") return <LegalPage page={surface} />;
  if (surface === "classic" || surface === "simple") return <AppGate surface={surface} />;
  return <ClassicRouter />;
}
