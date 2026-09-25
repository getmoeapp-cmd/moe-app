import { getSB } from "./supabaseClient";

// Ask Claude through MOE's server proxy (/api/claude), signed in as the current user.
export async function askClaude(prompt, maxTokens = 2000) {
  const sb = getSB();
  const { data } = sb ? await sb.auth.getSession() : { data: null };
  const token = data?.session?.access_token || "";
  let res;
  try {
    res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
    });
  } catch {
    return { ok: false, error: "Can't reach MOE. Check the connection." };
  }
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const e = body?.error;
    return { ok: false, error: (typeof e === "string" ? e : e?.message) || `Request failed (${res.status})` };
  }
  const text = (body?.content || []).map((c) => c?.text || "").join("");
  return { ok: true, text };
}

export function parseJsonBlock(text) {
  const s = String(text || "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// { name, steps: [], ingredients: { ref: englishName } } → Spanish of the same shape.
export async function translateRecipe({ name, steps, ingredients }) {
  const prompt = [
    "Translate this restaurant kitchen recipe from English to Spanish for prep cooks and line cooks in a New York restaurant.",
    "Use simple, everyday Latin American kitchen Spanish that a cook reads quickly on a phone.",
    "Keep every number, measurement, temperature, and time exactly as written. Keep brand names as they are.",
    'Return ONLY JSON in this exact shape: {"name": "...", "steps": ["..."], "ingredients": {"<same key>": "..."}}',
    "Use the same ingredient keys and the same number of steps, in the same order.",
    "",
    JSON.stringify({ name, steps, ingredients }),
  ].join("\n");
  const r = await askClaude(prompt);
  if (!r.ok) return r;
  const j = parseJsonBlock(r.text);
  if (!j || typeof j.name !== "string" || !Array.isArray(j.steps)) {
    return { ok: false, error: "The translation came back in the wrong shape. Try again." };
  }
  const ing = {};
  if (j.ingredients && typeof j.ingredients === "object") {
    Object.keys(ingredients || {}).forEach((k) => { if (typeof j.ingredients[k] === "string") ing[k] = j.ingredients[k]; });
  }
  return { ok: true, value: { name: j.name.trim(), steps: j.steps.map((s) => String(s).trim()).filter(Boolean), ing } };
}
