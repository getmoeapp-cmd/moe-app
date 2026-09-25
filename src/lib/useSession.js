import { useCallback, useEffect, useRef, useState } from "react";
import { currentUser, signOut } from "./auth";
import { getSB } from "./supabaseClient";

// status: "loading" | "signedOut" | "signedIn" | "recovery"
export function useSession() {
  const [state, setState] = useState({ status: "loading", user: null, error: "" });
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const result = await currentUser();
    busy.current = false;
    if (!result.ok) {
      await signOut();
      setState({ status: "signedOut", user: null, error: result.error });
      return;
    }
    setState(result.user
      ? { status: "signedIn", user: result.user, error: "" }
      : { status: "signedOut", user: null, error: "" });
  }, []);

  useEffect(() => {
    const sb = getSB();
    const isRecovery = () => /type=recovery/.test(window.location.hash) || new URLSearchParams(window.location.search).get("reset") === "1";
    if (isRecovery()) setState({ status: "recovery", user: null, error: "" });
    else refresh();
    if (!sb) return undefined;
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setState({ status: "recovery", user: null, error: "" });
      if (event === "SIGNED_OUT") setState({ status: "signedOut", user: null, error: "" });
    });
    return () => data?.subscription?.unsubscribe();
  }, [refresh]);

  const onLogin = useCallback((user) => setState({ status: "signedIn", user, error: "" }), []);
  const onLogout = useCallback(async () => {
    await signOut();
    setState({ status: "signedOut", user: null, error: "" });
  }, []);
  const doneRecovery = useCallback(() => {
    try { window.history.replaceState(null, "", "/app"); } catch { /* ignore */ }
    refresh();
  }, [refresh]);

  return { ...state, onLogin, onLogout, refresh, doneRecovery };
}
