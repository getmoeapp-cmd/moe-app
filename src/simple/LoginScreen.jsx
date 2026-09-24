import { useState } from "react";
import { signIn, signUp } from "../lib/auth";

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("signup") === "1" ? "register" : "signin";
    } catch {
      return "signin";
    }
  });
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem("moe_last_email") || ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  const [form, setForm] = useState({ first: "", last: "", email: "", phone: "", password: "", business: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try { localStorage.setItem("moe_last_email", email.toLowerCase().trim()); } catch { /* ignore */ }
    onLogin(result.user);
  }

  async function submitSignUp(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await signUp(form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    try { localStorage.setItem("moe_last_email", result.user.email); } catch { /* ignore */ }
    onLogin(result.user);
  }

  return (
    <main className="shell login">
      <p className="brand">MOE</p>
      <h1>{mode === "register" ? "Create your kitchen account" : "Count stock. Order what you are low on."}</h1>
      <p className="muted">Kitchen inventory and supplier orders. One restaurant at a time.</p>

      {mode === "signin" ? (
        <form onSubmit={submitSignIn} style={{ marginTop: 24 }}>
          <label className="field">Email
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <p className="note">
            New restaurant?{" "}
            <button type="button" className="btn quiet" onClick={() => { setMode("register"); setError(""); }}>Create an account</button>
          </p>
        </form>
      ) : (
        <form onSubmit={submitSignUp} style={{ marginTop: 24 }}>
          <div className="grid">
            <label className="field">First name
              <input value={form.first} onChange={(event) => setForm({ ...form, first: event.target.value })} required />
            </label>
            <label className="field">Last name
              <input value={form.last} onChange={(event) => setForm({ ...form, last: event.target.value })} required />
            </label>
          </div>
          <label className="field">Email
            <input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label className="field">Phone
            <input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          </label>
          <label className="field">Restaurant
            <input value={form.business} onChange={(event) => setForm({ ...form, business: event.target.value })} required />
          </label>
          <label className="field">Password
            <input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
          <p className="note">
            <button type="button" className="btn quiet" onClick={() => { setMode("signin"); setError(""); }}>Back to sign in</button>
          </p>
        </form>
      )}
    </main>
  );
}
