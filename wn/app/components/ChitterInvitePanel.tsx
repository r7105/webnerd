"use client";

import { useEffect, useMemo, useState } from "react";

type Invite = {
  id: string;
  toUsername: string;
  status: string;
};

type ChitterInvitePanelProps = {
  enabled: boolean;
  invites: Invite[];
};

export default function ChitterInvitePanel({ enabled, invites }: ChitterInvitePanelProps) {
  const [users, setUsers] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [localInvites, setLocalInvites] = useState(invites);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    setLoading(true);
    fetch("/api/chitterhaven/users")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setUsers(Array.isArray(data.users) ? data.users : []);
      })
      .catch(() => {
        if (!mounted) return;
        setMessage("Unable to load ChitterHaven friends.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [enabled]);

  const filtered = useMemo(() => {
    return users.filter((u) => u.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  }, [users, query]);

  async function invite(username: string) {
    setMessage(null);
    const res = await fetch("/api/chitterhaven/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data?.error || "Invite failed.");
      return;
    }
    setLocalInvites((prev) => [{ id: data.invite.id, toUsername: data.invite.toUsername, status: data.invite.status }, ...prev]);
  }

  return (
    <section className="panel invite-panel">
      <div className="panel-header">ChitterHaven Friends</div>
      <div className="panel-body">
        {!enabled ? (
          <div className="hint">Sign in to see your ChitterHaven friends.</div>
        ) : (
          <>
            <input className="search" placeholder="Search friends..." value={query} onChange={(e) => setQuery(e.target.value)} />
            {loading ? (
              <div className="hint">Loading ChitterHaven directory...</div>
            ) : (
              <div className="friend-list">
                {filtered.map((name) => (
                  <button key={name} className="friend-chip" onClick={() => invite(name)}>
                    <span>{name}</span>
                    <span className="chip-cta">Invite</span>
                  </button>
                ))}
                {filtered.length === 0 && <div className="hint">No matches yet.</div>}
              </div>
            )}
            {message && <div className="hint error">{message}</div>}
            <div className="invite-history">
              <div className="subhead">Recent invites</div>
              {localInvites.length === 0 ? (
                <div className="hint">No invites sent yet.</div>
              ) : (
                localInvites.slice(0, 4).map((inviteItem) => (
                  <div key={inviteItem.id} className="invite-row">
                    <span>{inviteItem.toUsername}</span>
                    <span className="tag">{inviteItem.status}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
