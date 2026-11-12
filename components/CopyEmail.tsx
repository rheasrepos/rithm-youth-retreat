"use client";
import { useState } from "react";

export function CopyEmail({ email, who }: { email: string; who?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(email); setMsg(who ? `Copied ${email}. Ask them to introduce you to ${who}.` : `Copied ${email}`); }
    catch { setMsg(`Email the Rithm team at ${email}`); }
    setTimeout(() => setMsg(null), 2600);
  };
  return (
    <>
      <button className="copy" type="button" onClick={copy}>{who ? "Ask Rithm for intro" : "Copy email"}</button>
      {msg && <div className="toast" role="status">{msg}</div>}
    </>
  );
}
