import { analyzeUsage, intervalsFor, maxToPar, receivedUnits } from "./usage";

const DAY = 86400000;
const at = (d) => new Date(2026, 8, d, 21, 0).toISOString(); // Sept d, 9pm

const inventory = [{ section: "Dairy", items: [
  { id: 1, name: "Mozzarella", vendor: "Anacapri", upu: 6, max_stock: 30, reorder: 12, order_unit: "Case" },
  { id: 2, name: "Ricotta", vendor: "Anacapri", upu: 1, max_stock: 20, reorder: 5, order_unit: "Each" },
] }];
const vendors = [{ name: "Anacapri", orderDays: [3] }];

test("used = start + delivered − end, per gap between counts", () => {
  const counts = [{ day: 0, q: 10 }, { day: 7 * DAY, q: 4 }];
  const deliveries = [{ day: 0, units: 12 }];
  const [g] = intervalsFor(counts, deliveries);
  expect(g.used).toBe(18);
  expect(g.days).toBe(7);
});

test("short deliveries count only what arrived", () => {
  expect(receivedUnits({ qty: 3, delivered: "short", receivedQty: 1 }, { upu: 6 })).toBe(6);
  expect(receivedUnits({ qty: 3, delivered: "out_of_stock" }, { upu: 6 })).toBe(0);
  expect(receivedUnits({ qty: 3 }, { upu: 6 })).toBe(18);
});

test("learns weekly usage and recommends lowering an over-set par", () => {
  // Every Wednesday: count, then order back up. Kitchen really uses 12 mozz/week.
  const countLog = [];
  const history = [];
  [2, 9, 16, 23].forEach((d, n) => {
    const onHand = 18; // topped up to 30 each week, 12 used → 18 left
    countLog.unshift({ i: 1, q: onHand, at: at(d) });
    const qty = Math.ceil((30 - onHand) / 6); // topped up to par 30
    history.unshift({ id: `o${d}`, vendor: "Anacapri", date: at(d), lines: [{ id: 1, qty, currentStock: onHand }] });
  });
  const [mozz] = analyzeUsage({ inventory, countLog, history, vendors });
  expect(mozz.ready).toBe(true);
  expect(Math.round(mozz.weekly)).toBe(12);
  expect(mozz.recPar).toBe(15);           // 12 per weekly delivery × 1.25
  expect(mozz.status).toBe("lower");      // par 30 is double what's needed
});

test("not enough history → still learning", () => {
  const countLog = [{ i: 2, q: 10, at: at(2) }, { i: 2, q: 6, at: at(9) }];
  const rows = analyzeUsage({ inventory, countLog, history: [], vendors });
  expect(rows[1].status).toBe("learning");
  expect(rows[1].progress).toBe(1);
});

test("auto-submitted orders are ignored as deliveries", () => {
  const countLog = [{ i: 2, q: 10, at: at(2) }, { i: 2, q: 6, at: at(9) }];
  const history = [{ type: "auto", date: at(3), lines: [{ id: 2, qty: 50 }] }];
  const rows = analyzeUsage({ inventory, countLog, history, vendors });
  expect(rows[1].intervals[0].used).toBe(4);
});

test("order cap brings an item to par, never past it", () => {
  expect(maxToPar(inventory[0].items[0], 18)).toBe(2); // need 12 → 2 cases of 6
  expect(maxToPar(inventory[0].items[0], 40)).toBe(0);
  expect(maxToPar(inventory[0].items[0], null)).toBe(0);
});
