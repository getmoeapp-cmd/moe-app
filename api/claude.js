// Server-side proxy to Anthropic for invoice / photo import.
// Only signed-in MOE users may call it, and the request shape is limited so the
// key can't be used as a general-purpose Claude endpoint.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || "https://fsvlxosbbevzyvegbqry.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY ||
  // Public anon key (same one the browser uses). Safe to ship; row-level security protects the data.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdmx4b3NiYmV2enl2ZWdicXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NzQ2MjgsImV4cCI6MjA4OTA1MDYyOH0.AcnnB4QecNHEu3-N_VS6aPHrpt9kq464arjNc2DNugU";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const MAX_TOKENS = 4000;
const MAX_BODY_BYTES = 4_000_000;

async function verifyUser(token) {
  if (!token || !SUPABASE_ANON_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  if (!user?.id) return null;
  // Must belong to a kitchen (or be a platform admin).
  const p = await fetch(`${SUPABASE_URL}/rest/v1/rpc/moe_my_profile`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!p.ok) return null;
  const profile = await p.json();
  return profile?.group || profile?.is_admin ? { id: user.id, group: profile.group } : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: "AI import is not configured" });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let user = null;
  try { user = await verifyUser(token); } catch { user = null; }
  if (!user) return res.status(401).json({ error: "Sign in to use import" });

  const body = req.body || {};
  const raw = JSON.stringify(body);
  if (raw.length > MAX_BODY_BYTES) return res.status(413).json({ error: "Image is too large" });
  if (!Array.isArray(body.messages) || body.messages.length !== 1 || body.messages[0].role !== "user") {
    return res.status(400).json({ error: "Bad request" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: Math.min(Number(body.max_tokens) || MAX_TOKENS, MAX_TOKENS),
        messages: body.messages,
        metadata: { user_id: user.id },
      }),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "AI import failed. Try again." });
  }
};
