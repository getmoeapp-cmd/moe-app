import { getSB, sbRpc } from "./supabaseClient";

export function canManage(user) {
  const role = (user?.role || "").toLowerCase();
  return role === "owner" || role === "manager";
}

function clean(value) {
  return String(value || "").trim();
}

function friendly(error) {
  const msg = error?.message || String(error || "");
  if (/invalid login credentials/i.test(msg)) return "Email or password doesn't match.";
  if (/already registered|already exists/i.test(msg)) return "An account with this email already exists. Sign in instead.";
  if (/email not confirmed/i.test(msg)) return "Confirm your email first — check your inbox for the link.";
  if (/password should be at least/i.test(msg)) return "Use at least 8 characters for the password.";
  if (/rate limit/i.test(msg)) return "Too many tries. Wait a minute and try again.";
  if (/failed to fetch|network/i.test(msg)) return "Couldn't reach MOE. Check the connection and try again.";
  return msg || "Something went wrong.";
}

// Turn the server profile into the user object the app screens use.
export function toUser(profile, authUser) {
  if (!profile) return null;
  return {
    id: profile.user_id,
    name: profile.name || authUser?.user_metadata?.name || "",
    role: profile.role || "employee",
    group: profile.group ?? null,
    email: profile.email || authUser?.email || "",
    business: profile.business || null,
    isAdmin: !!profile.is_admin,
  };
}

async function finishSignIn(authUser) {
  const sb = getSB();
  // A new owner whose email had to be confirmed first: create the kitchen now.
  const pending = authUser?.user_metadata?.pending_kitchen;
  let prof = await sbRpc("moe_my_profile");
  if (!prof.ok) return { ok: false, error: friendly(prof.error) };
  if (!prof.value?.group && pending?.business) {
    const made = await sbRpc("moe_create_kitchen", {
      p_name: pending.business, p_phone: pending.phone || "", p_first: pending.first || "", p_last: pending.last || "",
    });
    if (!made.ok) return { ok: false, error: friendly(made.error) };
    await sb.auth.updateUser({ data: { pending_kitchen: null } });
    prof = await sbRpc("moe_my_profile");
  }
  if (!prof.value?.group && pending?.invite) {
    const joined = await sbRpc("moe_join_kitchen", { p_code: pending.invite, p_name: pending.name || "" });
    if (!joined.ok) return { ok: false, error: friendly(joined.error) };
    await sb.auth.updateUser({ data: { pending_kitchen: null } });
    prof = await sbRpc("moe_my_profile");
  }
  // A login with no kitchen yet (for example an account made in another app)
  // still signs in; the app then offers to set up a kitchen or join one.
  return { ok: true, user: toUser(prof.value, authUser) };
}

export async function currentUser() {
  const sb = getSB();
  if (!sb) return { ok: false, error: "Supabase is not configured" };
  const { data } = await sb.auth.getSession();
  if (!data?.session) return { ok: true, user: null };
  return finishSignIn(data.session.user);
}

export async function signIn(email, password) {
  const sb = getSB();
  if (!sb) return { ok: false, error: "Supabase is not configured" };
  const { data, error } = await sb.auth.signInWithPassword({ email: clean(email).toLowerCase(), password: String(password || "") });
  if (error) return { ok: false, error: friendly(error) };
  const result = await finishSignIn(data.user);
  if (!result.ok) await sb.auth.signOut();
  return result;
}

export async function createKitchenForMe({ business, phone }) {
  if (!clean(business)) return { ok: false, error: "Enter the restaurant name." };
  const made = await sbRpc("moe_create_kitchen", { p_name: clean(business), p_phone: clean(phone), p_first: "", p_last: "" });
  if (!made.ok) return { ok: false, error: friendly(made.error) };
  return { ok: true };
}

export async function joinKitchenAsMe(code) {
  if (!clean(code)) return { ok: false, error: "Enter the invite code." };
  const joined = await sbRpc("moe_join_kitchen", { p_code: clean(code), p_name: "" });
  if (!joined.ok) return { ok: false, error: friendly(joined.error) };
  return { ok: true };
}

export async function signUp({ first, last, email, phone, password, business }) {
  const sb = getSB();
  if (!sb) return { ok: false, error: "Supabase is not configured" };
  const emailLower = clean(email).toLowerCase();
  if (!clean(first) || !clean(last)) return { ok: false, error: "Enter a first and last name." };
  if (!emailLower.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (!clean(phone)) return { ok: false, error: "Enter a phone number." };
  if (!password || password.length < 8) return { ok: false, error: "Use at least 8 characters for the password." };
  if (!clean(business)) return { ok: false, error: "Enter the restaurant name." };

  const pending = { business: clean(business), phone: clean(phone), first: clean(first), last: clean(last) };
  const { data, error } = await sb.auth.signUp({
    email: emailLower,
    password,
    options: {
      data: { name: `${pending.first} ${pending.last}`, phone: pending.phone, pending_kitchen: pending },
      emailRedirectTo: `${window.location.origin}/app`,
    },
  });
  if (error) return { ok: false, error: friendly(error) };
  // Supabase returns a user with no identities when the email is already taken.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }
  if (!data.session) return { ok: true, needsConfirm: true, email: emailLower };
  return finishSignIn(data.user);
}

// Employee/manager joins with an invite code from the owner.
export async function joinWithInvite({ code, name, email, password }) {
  const sb = getSB();
  if (!sb) return { ok: false, error: "Supabase is not configured" };
  const emailLower = clean(email).toLowerCase();
  if (!clean(code)) return { ok: false, error: "Enter the invite code." };
  if (!clean(name)) return { ok: false, error: "Enter your name." };
  if (!emailLower.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (!password || password.length < 8) return { ok: false, error: "Use at least 8 characters for the password." };

  const info = await sbRpc("moe_invite_info", { p_code: clean(code) });
  if (!info.ok) return { ok: false, error: friendly(info.error) };
  if (!info.value) return { ok: false, error: "That invite code is not valid or has expired. Ask your manager for a new one." };

  const pending = { invite: clean(code).toUpperCase(), name: clean(name) };
  let { data, error } = await sb.auth.signUp({
    email: emailLower, password,
    options: { data: { name: pending.name, pending_kitchen: pending }, emailRedirectTo: `${window.location.origin}/app` },
  });
  if (!error && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    // Existing login (for example someone who works at two places): sign in and join.
    ({ data, error } = await sb.auth.signInWithPassword({ email: emailLower, password }));
    if (error) return { ok: false, error: "That email already has a MOE login. Use its password to join." };
    const joined = await sbRpc("moe_join_kitchen", { p_code: pending.invite, p_name: pending.name });
    if (!joined.ok) return { ok: false, error: friendly(joined.error) };
    return finishSignIn(data.user);
  }
  if (error) return { ok: false, error: friendly(error) };
  if (!data.session) return { ok: true, needsConfirm: true, email: emailLower };
  return finishSignIn(data.user);
}

export async function sendPasswordReset(email) {
  const sb = getSB();
  const emailLower = clean(email).toLowerCase();
  if (!emailLower.includes("@")) return { ok: false, error: "Enter the email you sign in with." };
  const { error } = await sb.auth.resetPasswordForEmail(emailLower, { redirectTo: `${window.location.origin}/app?reset=1` });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true };
}

export async function setNewPassword(password) {
  const sb = getSB();
  if (!password || password.length < 8) return { ok: false, error: "Use at least 8 characters for the password." };
  const { error } = await sb.auth.updateUser({ password });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true };
}

export async function signOut() {
  const sb = getSB();
  try { await sb?.auth.signOut(); } catch { /* already signed out */ }
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("moe_") && k !== "moe_last_email").forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem("moe_session");
  } catch { /* storage blocked */ }
}

// ── Team ──────────────────────────────────────────────────────────────────
export async function listTeam(group) {
  const sb = getSB();
  const { data, error } = await sb.from("moe_members").select("user_id, role, name, email, created_at").eq("kitchen_id", group).order("created_at");
  if (error) return { ok: false, error: friendly(error), members: [] };
  return { ok: true, members: data || [] };
}

export const createInvite = (group, role = "employee") => sbRpc("moe_create_invite", { p_kitchen: group, p_role: role });
export const removeMember = (group, userId) => sbRpc("moe_remove_member", { p_kitchen: group, p_user: userId });
export const setMemberRole = (group, userId, role) => sbRpc("moe_set_member_role", { p_kitchen: group, p_user: userId, p_role: role });
export const inviteLink = (code) => `${window.location.origin}/app?join=${encodeURIComponent(code)}`;
