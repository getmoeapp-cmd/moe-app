import { existedOn, missedCounts, vendorCreatedMs } from "./orderFlow";

const sat = new Date(2026, 9, 17, 12);   // Sat Oct 17 2026
test("supplier created today is not 'missed' on earlier days", () => {
  const v = { id: 1, name: "New", orderDays: [2], createdAt: sat.toISOString() };   // Tuesday
  expect(missedCounts({ vendors: [v], sheets: {}, history: [], drafts: [], today: sat })).toEqual([]);
});
test("old supplier still shows a missed day", () => {
  const v = { id: 1, name: "Old", orderDays: [2] };
  expect(missedCounts({ vendors: [v], sheets: {}, history: [], drafts: [], today: sat })).toHaveLength(1);
});
test("id timestamp is used when createdAt is missing", () => {
  const v = { id: sat.getTime(), name: "X", orderDays: [2] };
  expect(vendorCreatedMs(v)).toBe(sat.getTime());
  expect(existedOn(v, new Date(2026, 9, 13))).toBe(false);
  expect(existedOn(v, new Date(2026, 9, 17))).toBe(true);
});
