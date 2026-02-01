"use client";

import { useState } from "react";

type AuthPanelProps = {
  user: {
    id: string;
    username: string;
    currencyBalance: number;
    achievementCount: number;
    playtimeSeconds: number;
    createdAt: string;
  } | null;
};

export default function AuthPanel({ user }: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.error || "Unable to authenticate.");
      } else {
        window.location.reload();
      }
    } catch (err) {
      setMessage("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  if (user) {
    const hours = Math.floor(user.playtimeSeconds / 3600);
    const joinDate = new Date(user.createdAt);
    return (
      <section className="panel auth-panel">
        <div className="panel-header">Profile</div>
        <div className="panel-body">
          <div className="profile-row">
            <div className="avatar">{user.username.slice(0, 2).toUpperCase()}</div>
            <div>
              <div className="profile-name">{user.username}</div>
              <div className="profile-sub">Member since {joinDate.toLocaleDateString()}</div>
            </div>
          </div>
          <div className="stats-grid">
            <div>
              <div className="stat-label">Currency</div>
              <div className="stat-value">{user.currencyBalance.toLocaleString()}</div>
            </div>
            <div>
              <div className="stat-label">Achievements</div>
              <div className="stat-value">{user.achievementCount}</div>
            </div>
            <div>
              <div className="stat-label">Playtime</div>
              <div className="stat-value">{hours}h</div>
            </div>
          </div>
          <button className="ghost-btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel auth-panel">
      <div className="panel-header">Account</div>
      <div className="panel-body">
        <div className="tab-row">
          <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>
            Sign In
          </button>
          <button className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")}>
            Register
          </button>
        </div>
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="nebula_rider" />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
        </label>
        {message ? <div className="hint error">{message}</div> : <div className="hint">Passwords are salted + hashed.</div>}
        <button className="primary-btn" onClick={submit} disabled={loading}>
          {loading ? "Working..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </div>
    </section>
  );
}
