"use client";
import { useState } from "react";

type Opt = { id: string; label?: string; name?: string; status?: string };
type Preset = { theme: string; sticky: string; org: string };

const TYPES = [
  ["join", "Add me to the network map (new person and/or organization)"],
  ["claim_theme", "My organization works on one of the concerns (claim a sticky-note cluster)"],
  ["claim_sticky", "One of the “already building” notes is mine"],
  ["evidence", "Add or correct evidence for an organization"],
  ["other", "Something else (correction, new concern, question)"],
] as const;

export function SubmitForm({ themes, stickies, orgs, preset }: { themes: Opt[]; stickies: Opt[]; orgs: Opt[]; preset: Preset }) {
  const initialType = preset.sticky ? "claim_sticky" : preset.theme ? "claim_theme" : preset.org ? "evidence" : "join";
  const [type, setType] = useState<string>(initialType);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending"); setError("");
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch("/api/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) setState("done");
    else { setState("error"); setError((await res.json().catch(() => ({})))?.error ?? "Something went wrong. Email the Rithm team instead."); }
  }

  if (state === "done") return <div className="ok"><b>Thank you.</b> Your submission is in the review queue. The Rithm team will check the link and add it to the map; this usually shows up within a few days.</div>;

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>What are you sending?
        <select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Your name <input name="name" required maxLength={120} /></label>
      <label>Your email <span className="hint">Only used by the Rithm team to follow up; never published.</span><input name="email" type="email" required maxLength={200} /></label>

      {(type === "join" || type === "claim_theme" || type === "evidence") && (
        <label>Organization <span className="hint">Pick one already on the map, or type a new one below.</span>
          <select name="org_id" defaultValue={preset.org}>
            <option value="">— New or not listed —</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      )}
      {(type === "join" || type === "claim_theme" || type === "evidence") && <label>Organization name (if new) <input name="org" maxLength={200} /></label>}
      {type === "join" && <label>How you&apos;re in the network <span className="hint">e.g. Cohort 5, youth fellow, facilitator</span><input name="role" maxLength={120} /></label>}

      {(type === "claim_theme" || type === "evidence") && (
        <label>Which concern? <span className="hint">Untapped ones are marked.</span>
          <select name="theme_id" defaultValue={preset.theme}>
            <option value="">— choose —</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.status !== "covered" ? "★ " : ""}{t.label}</option>)}
          </select>
        </label>
      )}
      {type === "claim_sticky" && (
        <label>Which note?
          <select name="sticky_id" defaultValue={preset.sticky} required>
            <option value="">— choose —</option>
            {stickies.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      )}

      <label>Link to the work <span className="hint">A project page, report, product, bill, article: something a stranger could open and see the work. This is what gets a “Verified” badge.</span>
        <input name="url" type="url" placeholder="https://" maxLength={500} /></label>
      <label>Tell us about it <span className="hint">One or two sentences: what it is, and how it speaks to the note(s).</span>
        <textarea name="message" required maxLength={2000} /></label>

      <label className="hp" aria-hidden="true">Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {state === "error" && <p className="err">{error}</p>}
      <div><button className="btn" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send to the Rithm team"}</button></div>
    </form>
  );
}
