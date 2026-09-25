import { analyzeUsage, intervalsFor, maxToPar, receivedUnits } from "./usage";
import { calcOrderQty } from "./stockMath";

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
  expect(mozz.recReorder).toBe(14);       // reorder below 12 used/week + 10%
  expect(mozz.recOrder).toBe(2);          // 2 cases of 6 covers a week
  expect(mozz.status).toBe("lower");      // it was filling to par 30 (3 cases)
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

test("reorder point + fixed case amount (heavy cream: 12 per case, below 7 → 1 case)", () => {
  const cream = { id: 7, upu: 12, reorder: 7, order_qty: 1, max_stock: 19 };
  expect(calcOrderQty(cream, 6)).toBe(1);
  expect(calcOrderQty(cream, 7)).toBe(0);
  expect(calcOrderQty(cream, 0)).toBe(1);
  expect(calcOrderQty({ ...cream, reorder: 30 }, 0)).toBe(3); // one case wouldn't get back above 30
  expect(maxToPar(cream, 6)).toBe(1);
});

test("order cap brings an item to par, never past it", () => {
  expect(maxToPar(inventory[0].items[0], 18)).toBe(2); // need 12 → 2 cases of 6
  expect(maxToPar(inventory[0].items[0], 40)).toBe(0);
  expect(maxToPar(inventory[0].items[0], null)).toBe(0);
});
