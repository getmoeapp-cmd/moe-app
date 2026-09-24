export const ORDER_UNITS = ["Case", "Each", "Piece", "Unit", "Bag", "Bundle", "Gallon", "Roll", "Lbs"];

export function nextItemId(inventory) {
  const ids = (inventory || []).flatMap((section) => (section.items || []).map((item) => Number(item.id) || 0));
  return Math.max(0, ...ids) + 1;
}

export function updateItem(inventory, id, patch) {
  return (inventory || []).map((section) => ({
    ...section,
    items: (section.items || []).map((item) => (item.id === id ? { ...item, ...patch } : item)),
  }));
}

export function removeItem(inventory, id) {
  return (inventory || [])
    .map((section) => ({ ...section, items: (section.items || []).filter((item) => item.id !== id) }))
    .filter((section) => section.items.length > 0);
}

export function moveItem(inventory, id, sectionName, patch) {
  let found = null;
  const stripped = (inventory || [])
    .map((section) => ({
      ...section,
      items: (section.items || []).filter((item) => {
        if (item.id !== id) return true;
        found = { ...item, ...patch };
        return false;
      }),
    }))
    .filter((section) => section.items.length > 0);
  if (!found) return inventory || [];
  const name = (sectionName || "General").trim() || "General";
  const index = stripped.findIndex((section) => section.section === name);
  if (index === -1) return [...stripped, { section: name, items: [found] }];
  return stripped.map((section, i) => (i === index ? { ...section, items: [...section.items, found] } : section));
}

export function addItem(inventory, item) {
  const name = (item.section || "General").trim() || "General";
  const stored = { ...item };
  delete stored.section;
  const index = (inventory || []).findIndex((entry) => entry.section === name);
  if (index === -1) return [...(inventory || []), { section: name, items: [stored] }];
  return inventory.map((entry, i) => (i === index ? { ...entry, items: [...entry.items, stored] } : entry));
}

export function renameVendorOnItems(inventory, from, to) {
  if (!from || from === to) return inventory;
  return (inventory || []).map((section) => ({
    ...section,
    items: (section.items || []).map((item) => (item.vendor === from ? { ...item, vendor: to } : item)),
  }));
}
