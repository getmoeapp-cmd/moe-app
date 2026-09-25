import { SUPPORT_EMAIL } from "../lib/config";

export default function TrialGate({ user, onLogout }) {
  const subject = encodeURIComponent(`MOE subscription — ${user?.business?.name || "my kitchen"}`);
  const body = encodeURIComponent(`Hi, I'd like to keep using MOE.\n\nRestaurant: ${user?.business?.name || ""}\nLogin email: ${user?.email || ""}\n`);
  const isOwner = user?.role === "owner";
  return (
    <main className="shell">
      <p className="brand">MOE</p>
      <h1>Your free trial has ended</h1>
      {isOwner ? (
        <>
          <p className="muted">Your counts, suppliers, and orders are saved. Subscribe to keep counting and ordering — we'll switch your kitchen back on right away.</p>
          <div className="stack" style={{ marginTop: 20 }}>
            <a className="btn primary" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}>Subscribe — email {SUPPORT_EMAIL}</a>
            <button type="button" className="btn quiet" onClick={onLogout}>Sign out</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">Ask the owner of {user?.business?.name || "this kitchen"} to renew MOE. Your team's data is saved.</p>
          <div className="stack" style={{ marginTop: 20 }}>
            <button type="button" className="btn quiet" onClick={onLogout}>Sign out</button>
          </div>
        </>
      )}
    </main>
  );
}
