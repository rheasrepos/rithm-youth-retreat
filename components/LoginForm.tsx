"use client";
import { useState } from "react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      if (r.ok) {
        const from = new URLSearchParams(window.location.search).get("from");
        window.location.assign(from && from.startsWith("/") && !from.startsWith("//") ? from : "/");
        return;
      }
      const j = await r.json().catch(() => null);
      setMsg(j?.reason ?? "Couldn't check the password. Try again.");
    } catch { setMsg("Couldn't reach the site. Try again."); }
    setBusy(false);
  };
  return (
    <form className="loginform" onSubmit={submit}>
      <label htmlFor="pw">Password</label>
      <div className="loginrow">
        <input id="pw" type="password" autoComplete="current-password" autoFocus required value={password} onChange={(e) => { setPassword(e.target.value); setMsg(""); }} />
        <button type="submit" className="btn" disabled={busy || !password}>{busy ? "Checking…" : "Come in"}</button>
      </div>
      <p className="loginmsg" role="alert">{msg}</p>
      <p className="thint">Don’t have it? Ask Rhea, Nahom or Celine, or anyone on the Rithm team.</p>
    </form>
  );
}
