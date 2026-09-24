import { DEMO_USERS } from "./defaults";
import { sbGet, sbSet } from "./supabaseClient";

export function canManage(user) {
  const role = (user?.role || "").toLowerCase();
  return role === "owner" || role === "manager";
}

export function publicUser(user) {
  return {
    name: user.name || "",
    role: user.role || "employee",
    group: user.group ?? null,
    email: user.email || "",
    business: user.business || null,
    repCode: user.repCode || "",
    repCompany: user.repCompany || "",
  };
}

function slugGroup(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "kitchen";
}

export async function signIn(email, password) {
  const emailLower = String(email || "").toLowerCase().trim();
  const demo = DEMO_USERS[emailLower];
  if (demo && demo.password === password) {
    return { ok: true, user: publicUser({ ...demo, email: emailLower }) };
  }

  const remote = await sbGet("__moe_accounts__", "accounts");
  if (!remote.ok) {
    return { ok: false, error: `Couldn't reach accounts (${remote.error}).` };
  }
  const accounts = remote.value && typeof remote.value === "object" ? remote.value : {};
  const account = accounts[emailLower];
  if (account && account.password === password) {
    return {
      ok: true,
      user: publicUser({
        name: `${account.ownerFirst || ""} ${account.ownerLast || ""}`.trim(),
        role: account.role || "owner",
        group: account.group,
        email: account.email,
        business: account.business,
      }),
    };
  }

  for (const owner of Object.values(accounts)) {
    if (!owner?.group) continue;
    const team = await sbGet(owner.group, "team");
    if (!team.ok || !Array.isArray(team.value)) continue;
    const member = team.value.find((row) => (row.email || "").toLowerCase() === emailLower && row.password === password);
    if (member) {
      return {
        ok: true,
        user: publicUser({
          name: member.name,
          role: member.role || "employee",
          group: owner.group,
          email: member.email,
          business: owner.business,
        }),
      };
    }
  }

  const reps = await sbGet("__moe_reps__", "reps");
  if (reps.ok && reps.value && typeof reps.value === "object") {
    const rep = reps.value[emailLower];
    if (rep && rep.password === password) {
      return {
        ok: true,
        user: publicUser({
          name: rep.name,
          role: "rep",
          repCode: rep.code,
          repCompany: rep.company || "",
          email: emailLower,
          group: null,
        }),
      };
    }
  }

  return { ok: false, error: "Email or password doesn't match." };
}

export async function signUp({ first, last, email, phone, password, business }) {
  const emailLower = String(email || "").toLowerCase().trim();
  const firstName = String(first || "");
  const lastName = String(last || "");
  const phoneNumber = String(phone || "");
  const businessName = String(business || "");
  if (!firstName.trim() || !lastName.trim()) return { ok: false, error: "Enter a first and last name." };
  if (!emailLower.includes("@")) return { ok: false, error: "Enter a valid email." };
  if (!phoneNumber.trim()) return { ok: false, error: "Enter a phone number." };
  if (!password || password.length < 6) return { ok: false, error: "Use at least 6 characters for the password." };
  if (!businessName.trim()) return { ok: false, error: "Enter the restaurant name." };

  const remote = await sbGet("__moe_accounts__", "accounts");
  if (!remote.ok) return { ok: false, error: `Couldn't reach accounts (${remote.error}).` };
  const existing = remote.value && typeof remote.value === "object" ? { ...remote.value } : {};
  if (existing[emailLower]) return { ok: false, error: "An account with this email already exists." };

  let group = slugGroup(businessName);
  const used = new Set(Object.values(existing).map((account) => account?.group).filter(Boolean));
  if (used.has(group)) group = `${group.slice(0, 24)}_${Date.now().toString().slice(-4)}`;

  const record = {
    ownerFirst: firstName.trim(),
    ownerLast: lastName.trim(),
    email: emailLower,
    phone: phoneNumber.trim(),
    password,
    role: "owner",
    group,
    business: {
      name: businessName.trim(),
      type: "restaurant",
      phone: phoneNumber.trim(),
      address: "",
      city: "",
      state: "",
      zip: "",
    },
    createdAt: new Date().toISOString(),
    repCode: "",
  };
  existing[emailLower] = record;
  const wrote = await sbSet("__moe_accounts__", "accounts", existing);
  if (!wrote.ok) return { ok: false, error: `Couldn't save the account (${wrote.error}).` };

  return {
    ok: true,
    user: publicUser({
      name: `${record.ownerFirst} ${record.ownerLast}`,
      role: "owner",
      group,
      email: emailLower,
      business: record.business,
    }),
  };
}
