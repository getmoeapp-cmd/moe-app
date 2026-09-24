import { PLANS } from "../lib/config";

export default function TrialGate({ onSelectPlan, onLogout }) {
  return (
    <main className="shell">
      <p className="brand">MOE</p>
      <h1>The trial ended</h1>
      <p className="muted">Pick a plan to keep counting and ordering. Choosing one marks it active on this account. This screen does not collect a card — that matches how the previous app recorded a plan.</p>
      <div className="stack" style={{ marginTop: 20 }}>
        {PLANS.map((plan) => (
          <button key={plan.id} type="button" className="btn" onClick={() => onSelectPlan(plan.id)}>
            {plan.name} · ${plan.price}/month
          </button>
        ))}
        <button type="button" className="btn quiet" onClick={onLogout}>Sign out</button>
      </div>
    </main>
  );
}
