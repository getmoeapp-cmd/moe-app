import { useEffect, useState } from "react";
import ClassicRouter, { MoeApp } from "./kitchen_inventory_app";
import SimpleApp from "./simple/SimpleApp";

export function currentSurface() {
  const path = window.location.pathname;
  const hash = window.location.hash || "";
  const classic = new URLSearchParams(window.location.search).get("classic") === "1"
    || path.startsWith("/classic")
    || hash.startsWith("#/classic");
  const app = path === "/app" || path.startsWith("/app/") || hash === "#/app" || hash.startsWith("#/app") || path.startsWith("/classic");
  if (app && classic) return "classic";
  if (app) return "simple";
  return "marketing";
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

  if (surface === "classic") return <MoeApp />;
  if (surface === "simple") return <SimpleApp />;
  return <ClassicRouter />;
}
