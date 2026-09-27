import { buildDraft, draftToOrder } from "./orderFlow";
import { countTimeline } from "./usage";

const vendor = { id: 1, name: "Anacapri" };
const fixed = { id: 1, name: "Chopped meat", vendor: "Anacapri", upu: 10, order_qty: 1, reorder: 30, max_stock: 30 };
const topUp = { id: 2, name: "Mozz", vendor: "Anacapri", upu: 6, reorder: 12, max_stock: 30 };
const counted = { id: 3, name: "Cream", vendor: "Anacapri", upu: 12, order_qty: 1, reorder: 7, max_stock: 19 };
const inventory = [{ section: "All", items: [fixed, topUp, counted] }];

test("an item nobody counted never suggests more than the limit", () => {
  const d = buildDraft({ id: "d1", vendor, date: "2026-09-25", counts: { 3: { q: 6, by: "Luis" } }, inventory });
  const meat = d.lines.find((l) => l.id === 1);
  expect(meat.counted).toBe(false);
  expect(meat.qty).toBe(1);                 // was 3 cases before the fix
  expect(meat.overPar).toBe(0);
  const mozz = d.lines.find((l) => l.id === 2);
  expect(mozz.qty * 6).toBeLessThanOrEqual(30);
  const cream = d.lines.find((l) => l.id === 3);
  expect(cream.qty).toBe(1);                // 6 on hand, under 7 → 1 case
});

test("uncounted lines don't become fake 0 counts in usage", () => {
  const d = buildDraft({ id: "d2", vendor, date: "2026-09-25", counts: { 3: { q: 6, by: "Luis" } }, inventory });
  const order = draftToOrder(d, { name: "Owner" });
  const meat = order.lines.find((l) => l.id === 1);
  expect(meat.notCounted).toBe(true);
  expect(meat.currentStock).toBeUndefined();
  const tl = countTimeline([], [order]);
  expect(tl["1"]).toBeUndefined();          // meat: no count recorded
  expect(tl["3"][0].q).toBe(6);             // cream: real count
  // counts are dated on the count day, not the approval day
  expect(new Date(order.countedAt).getDate()).toBe(25);
});
