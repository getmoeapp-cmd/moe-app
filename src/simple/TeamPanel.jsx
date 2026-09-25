import { useCallback, useEffect, useState } from "react";
import { createInvite, inviteLink, listTeam, removeMember, setMemberRole } from "../lib/auth";

export default function TeamPanel({ user }) {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState(null);
  const [role, setRole] = useState("employee");
  const [busy, setBusy] = useState(false);
  const isOwner = user.role === "owner";

  const load = useCallback(async () => {
    const result = await listTeam(user.group);
    if (!result.ok) setError(result.error);
    setMembers(result.members);
  }, [user.group]);

  useEffect(() => { load(); }, [load]);

  async function makeInvite() {
    setBusy(true); setError("");
    const result = await createInvite(user.group, role);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    setInvite({ code: result.value, role, link: inviteLink(result.value) });
  }

  async function share() {
    if (!invite) return;
    const text = `Join ${user.business?.name || "our kitchen"} on MOE: ${invite.link} (invite code ${invite.code})`;
    try {
      if (navigator.share) { await navigator.share({ title: "MOE invite", text }); return; }
      await navigator.clipboard.writeText(text);
      setError("");
      setInvite({ ...invite, copied: true });
    } catch { /* user closed the share sheet */ }
  }

  async function remove(member) {
    if (!window.confirm(`Remove ${member.name || member.email} from the kitchen?`)) return;
    const result = await removeMember(user.group, member.user_id);
    if (!result.ok) { setError(result.error); return; }
    load();
  }

  async function changeRole(member, next) {
    const result = await setMemberRole(user.group, member.user_id, next);
    if (!result.ok) { setError(result.error); return; }
    load();
  }

  return (
    <div>
      {members.map((member) => (
        <article className="card" key={member.user_id}>
          <h2 style={{ margin: 0 }}>{member.name || member.email}</h2>
          <p className="muted" style={{ margin: "4px 0" }}>{member.email} · {member.role}</p>
          {member.role !== "owner" && member.user_id !== user.id && (
            <div className="stack">
              {isOwner && (
                <button type="button" className="btn quiet" onClick={() => changeRole(member, member.role === "manager" ? "employee" : "manager")}>
                  Make {member.role === "manager" ? "employee" : "manager"}
                </button>
              )}
              {(isOwner || member.role === "employee") && (
                <button type="button" className="btn quiet danger" onClick={() => remove(member)}>Remove</button>
              )}
            </div>
          )}
        </article>
      ))}
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Invite someone</h2>
        <p className="muted">They open the link, enter their own email and password, and land in this kitchen. Each code works once and expires in 7 days.</p>
        {isOwner && (
          <div className="seg" role="group" aria-label="Role">
            <button type="button" aria-pressed={role === "employee"} onClick={() => setRole("employee")}>Employee</button>
            <button type="button" aria-pressed={role === "manager"} onClick={() => setRole("manager")}>Manager</button>
          </div>
        )}
        <button type="button" className="btn primary" disabled={busy} onClick={makeInvite}>{busy ? "Creating…" : "Create invite"}</button>
        {invite && (
          <div style={{ marginTop: 12 }}>
            <p>Code <strong style={{ fontSize: 22, letterSpacing: 2 }} data-testid="invite-code">{invite.code}</strong> ({invite.role})</p>
            <p className="muted" style={{ wordBreak: "break-all" }}>{invite.link}</p>
            <button type="button" className="btn" onClick={share}>{invite.copied ? "Copied" : "Share invite"}</button>
          </div>
        )}
      </article>
      {error && <p className="alert" role="alert">{error}</p>}
    </div>
  );
}
