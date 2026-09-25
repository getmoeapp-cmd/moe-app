import { useState } from "react";
import { joinWithInvite, sendPasswordReset, setNewPassword, signIn, signUp } from "../lib/auth";

function initialMode() {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("join")) return "join";
    if (q.get("signup") === "1") return "register";
  } catch { /* ignore */ }
  return "signin";
}

function initialCode() {
  try { return new URLSearchParams(window.location.search).get("join") || ""; } catch { return ""; }
}

export function SetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    const result = await setNewPassword(password);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    onDone();
  }
  return (
    <main className="shell login">
      <p className="brand">MOE</p>
      <h1>Set a new password</h1>
      <form onSubmit={submit} style={{ marginTop: 24 }}>
        <label className="field">New password
          <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </main>
  );
}

export default function LoginScreen({ onLogin, notice }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem("moe_last_email") || ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  const [form, setForm] = useState({ first: "", last: "", email: "", phone: "", password: "", business: "" });
  const [join, setJoin] = useState({ code: initialCode(), name: "", email: "", password: "" });
  const [error, setError] = useState(notice || "");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function go(next) { setMode(next); setError(""); setInfo(""); }

  function remember(addr) {
    try { localStorage.setItem("moe_last_email", String(addr || "").toLowerCase().trim()); } catch { /* ignore */ }
  }

  async function run(fn, addr) {
    setBusy(true); setError(""); setInfo("");
    const result = await fn();
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    remember(addr);
    if (result.needsConfirm) { setEmail(result.email); setMode("confirm"); return; }
    try { window.history.replaceState(null, "", "/app"); } catch { /* ignore */ }
    onLogin(result.user);
  }

  async function submitForgot(event) {
    event.preventDefault();
    setBusy(true); setError(""); setInfo("");
    const result = await sendPasswordReset(email);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setInfo("If that email has a MOE login, a reset link is on its way. Check your inbox (and spam).");
  }

  const titles = {
    signin: "Count stock. Order what you are low on.",
    register: "Create your kitchen account",
    join: "Join your kitchen",
    forgot: "Reset your password",
    confirm: "Check your email",
  };

  return (
    <main className="shell login">
      <p className="brand">MOE</p>
      <h1>{titles[mode]}</h1>
      <p className="muted">Kitchen inventory and supplier orders.</p>

      {mode === "signin" && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => signIn(email, password), email); }} style={{ marginTop: 24 }}>
          <label className="field">Email
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">Password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="note">
            <button type="button" className="btn quiet" onClick={() => go("forgot")}>Forgot password?</button>
          </p>
          <p className="note">
            New restaurant?{" "}
            <button type="button" className="btn quiet" onClick={() => go("register")}>Create an account</button>
          </p>
          <p className="note">
            Got an invite code from your manager?{" "}
            <button type="button" className="btn quiet" onClick={() => go("join")}>Join a kitchen</button>
          </p>
        </form>
      )}

      {mode === "register" && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => signUp(form), form.email); }} style={{ marginTop: 24 }}>
          <div className="grid">
            <label className="field">First name
              <input autoComplete="given-name" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} required />
            </label>
            <label className="field">Last name
              <input autoComplete="family-name" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} required />
            </label>
          </div>
          <label className="field">Email
            <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="field">Phone
            <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </label>
          <label className="field">Restaurant
            <input autoComplete="organization" value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} required />
          </label>
          <label className="field">Password (8+ characters)
            <input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Start 14-day free trial"}</button>
          <p className="note">No card needed. <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></p>
          <p className="note">
            <button type="button" className="btn quiet" onClick={() => go("signin")}>Back to sign in</button>
          </p>
        </form>
      )}

      {mode === "join" && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => joinWithInvite(join), join.email); }} style={{ marginTop: 24 }}>
          <label className="field">Invite code
            <input value={join.code} onChange={(e) => setJoin({ ...join, code: e.target.value.toUpperCase() })} autoCapitalize="characters" required />
          </label>
          <label className="field">Your name
            <input autoComplete="name" value={join.name} onChange={(e) => setJoin({ ...join, name: e.target.value })} required />
          </label>
          <label className="field">Email
            <input type="email" autoComplete="email" value={join.email} onChange={(e) => setJoin({ ...join, email: e.target.value })} required />
          </label>
          <label className="field">Password (8+ characters)
            <input type="password" autoComplete="new-password" minLength={8} value={join.password} onChange={(e) => setJoin({ ...join, password: e.target.value })} required />
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Joining…" : "Join kitchen"}</button>
          <p className="note">
            <button type="button" className="btn quiet" onClick={() => go("signin")}>Back to sign in</button>
          </p>
        </form>
      )}

      {mode === "forgot" && (
        <form onSubmit={submitForgot} style={{ marginTop: 24 }}>
          <label className="field">Email
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          {info && <p className="note" role="status">{info}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          <p className="note">
            <button type="button" className="btn quiet" onClick={() => go("signin")}>Back to sign in</button>
          </p>
        </form>
      )}

      {mode === "confirm" && (
        <div style={{ marginTop: 24 }}>
          <p>We sent a confirmation link to <strong>{email}</strong>. Open it on this device to finish setting up.</p>
          <p className="note">
            <button type="button" className="btn quiet" onClick={() => go("signin")}>Back to sign in</button>
          </p>
        </div>
      )}
    </main>
  );
}
