import { useMemo, useState } from "react";
import { BASELINE_INTERVALS, analyzeUsage, fmtUnits, sortForReview } from "../lib/usage";
import { updateItem } from "../lib/inventoryEdits";
import { countUnit, toCount } from "../lib/costing";

const ou = (row, n) => { const w = String(row.item.order_unit || "case").toLowerCase(); return `${n} ${w}${n === 1 ? "" : "s"}`; };
const rule = (row, reorder, qty) => `below ${toCount(row.item, reorder)} ${countUnit(row.item).label} → order ${ou(row, qty)}`;
const splitRule = (row, reorder, fill) => `below ${toCount(row.item, reorder)} ${countUnit(row.item).label} → back up to ${toCount(row.item, fill)}`;
const recRule = (row) => (row.split ? splitRule(row, row.recReorder, row.recPar) : rule(row, row.recReorder, row.recOrder));

const LABEL = { raise: "Order more", lower: "Order less", idle: "Not moving", ok: "Rule looks right", learning: "Learning" };

function readDismissed() {
  try { return JSON.parse(localStorage.getItem("moe_usage_dismissed") || "{}"); } catch { return {}; }
}

function unitLabel(row) {
  if (row.upu > 1) return "units";
  const u = String(row.item.order_unit || "unit").toLowerCase();
  if (u === "each" || u === "lbs" || u.endsWith("s")) return u;
  return `${u}s`;
}

function inOrderUnits(n, row) {
  if (n == null || row.upu <= 1) return "";
  return ` (${fmtUnits(n / row.upu)} ${String(row.item.order_unit || "case").toLowerCase()}${n / row.upu === 1 ? "" : "s"})`;
}

function Row({ row, isOwner, onApply, onKeep }) {
  const unit = unitLabel(row);
  const perWeek = row.intervals.map((g) => (g.used / g.days) * 7);
  const peak = Math.max(1, ...perWeek);
  return (
    <article className="card usage-row">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <h2>{row.item.name}</h2>
        <span className={`tag ${row.status}`}>{LABEL[row.status]}</span>
      </div>
      <p className="meta">{row.item.vendor || "No supplier"} · now: {row.split ? splitRule(row, row.reorder, row.par) : row.fixed != null ? rule(row, row.reorder, row.fixed) : `below ${toCount(row.item, row.reorder)} → fill to ${toCount(row.item, row.par)}`}</p>

      {row.status === "learning" ? (
        <>
          <div className="progress" aria-label="Weeks of data"><i style={{ width: `${(row.progress / BASELINE_INTERVALS) * 100}%` }} /></div>
          <p className="why">
            {row.progress === 0
              ? "Count this item at each order. After 3 weeks MOE knows how much you use."
              : `${row.progress} of ${BASELINE_INTERVALS} weeks counted${row.weekly != null ? ` · about ${fmtUnits(row.weekly)} ${unit}/week so far` : ""}.`}
          </p>
        </>
      ) : (
        <>
          <div className="bars" aria-hidden="true">
            {perWeek.map((v, n) => <span key={n} style={{ height: `${(v / peak) * 100}%` }} />)}
          </div>
          <p className="why">
            Uses about <strong>{fmtUnits(row.weekly)} {unit}/week</strong>{inOrderUnits(row.weekly, row)} over the last {Math.round(row.totalDays / 7)} weeks
            {row.perWeek > 1 ? `, delivered ${row.perWeek}× a week` : ""}.
            {row.avgLeft != null ? ` Usually ${fmtUnits(row.avgLeft)} left when you count.` : ""}
          </p>
          {(row.status === "raise" || row.status === "lower" || row.status === "idle") && (
            <>
              <div className="rec">
                <span>Suggested:</span><strong>{recRule(row)}</strong>
              </div>
              <p className="why">
                {row.status === "raise" && "You're going through it faster than this rule covers — risk of running out before the next delivery."}
                {row.status === "raise" && row.avgLeft === 0 && " It was empty at most counts, so real use may be even higher — check again in a couple of weeks."}
                {row.status === "lower" && `You're ordering more than you use between deliveries — money sitting on the shelf.`}
                {row.status === "idle" && "Nothing used in the last few weeks. Keep a minimum or stop ordering it."}
              </p>
              {isOwner ? (
                <div className="stack">
                  <button type="button" className="btn primary" onClick={() => onApply(row)}>Use suggested rule</button>
                  <button type="button" className="btn quiet" onClick={() => onKeep(row)}>Keep current</button>
                </div>
              ) : (
                <p className="muted">The owner can apply this.</p>
              )}
            </>
          )}
        </>
      )}
    </article>
  );
}

export default function UsageScreen({ user, inventory, vendors, history, countLog, saveInventory }) {
  const [filter, setFilter] = useState("review");
  const [dismissed, setDismissed] = useState(readDismissed);
  const [flash, setFlash] = useState("");
  const isOwner = user.role === "owner";

  const rows = useMemo(
    () => sortForReview(analyzeUsage({ inventory, countLog, history, vendors })),
    [inventory, countLog, history, vendors]
  );
  const isDismissed = (row) => dismissed[String(row.item.id)] === `${row.recReorder}/${row.recOrder}`;
  const actionable = rows.filter((r) => ["raise", "lower", "idle"].includes(r.status) && !isDismissed(r));
  const learning = rows.filter((r) => r.status === "learning");
  const known = rows.filter((r) => r.status !== "learning");
  const shown = filter === "review" ? actionable : filter === "learning" ? learning : rows;

  async function apply(row) {
    const next = updateItem(inventory, row.item.id, row.split
      ? { reorder: row.recReorder, max_stock: row.recPar }
      : { reorder: row.recReorder, order_qty: row.recOrder, max_stock: row.recPar });
    const res = await saveInventory(next);
    setFlash(res?.ok === false ? `Not saved: ${res.error}` : `${row.item.name}: ${recRule(row)}`);
  }
  function keep(row) {
    const next = { ...dismissed, [String(row.item.id)]: `${row.recReorder}/${row.recOrder}` };
    setDismissed(next);
    try { localStorage.setItem("moe_usage_dismissed", JSON.stringify(next)); } catch { /* ignore */ }
  }

  return (
    <section>
      <h2 className="section-h" style={{ marginTop: 0 }}>How much you use</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Each count + order teaches MOE your real usage. Once an item has 3 weeks of counts, MOE tells you if its reorder rule orders too much or too little.
      </p>
      <div className="summary" style={{ margin: "8px 0 12px" }}>
        <span>{actionable.length} to review</span>
        <span>{known.length} learned</span>
        <span>{learning.length} learning</span>
      </div>
      <div className="seg" role="group" aria-label="Show">
        <button type="button" aria-pressed={filter === "review"} onClick={() => setFilter("review")}>To review</button>
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All items</button>
        <button type="button" aria-pressed={filter === "learning"} onClick={() => setFilter("learning")}>Learning</button>
      </div>
      {flash && <p className="note" role="status">{flash}</p>}
      {shown.length === 0 && (
        <div className="empty">
          <h2>{filter === "review" ? "Nothing to change" : "No items"}</h2>
          <p>{filter === "review" ? (known.length ? "Every learned item's rule matches what you use." : "Keep counting at each order. Suggestions show up after 3 weeks.") : ""}</p>
        </div>
      )}
      {shown.map((row) => <Row key={row.item.id} row={row} isOwner={isOwner} onApply={apply} onKeep={keep} />)}
    </section>
  );
}
