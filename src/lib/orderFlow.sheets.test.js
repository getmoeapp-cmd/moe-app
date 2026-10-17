import { hasOrderForSheet, recentSheets, sheetKey } from "./orderFlow";

test("recentSheets keeps sheets from the cutoff day on and drops other keys", () => {
  const v = { [sheetKey("2026-10-17", "9")]: { a: 1 }, [sheetKey("2026-09-01", "9")]: { a: 2 }, other: {} };
  expect(Object.keys(recentSheets(v, "2026-10-03"))).toEqual([sheetKey("2026-10-17", "9")]);
});

test("hasOrderForSheet matches orders made from that sheet only", () => {
  const key = sheetKey("2026-10-17", "9");
  expect(hasOrderForSheet([{ id: `ord_${key}_abc` }], key)).toBe(true);
  expect(hasOrderForSheet([{ id: `ord_${sheetKey("2026-10-17", "90")}_abc` }], key)).toBe(false);
  expect(hasOrderForSheet([], key)).toBe(false);
});
