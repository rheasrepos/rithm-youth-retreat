"use client";
import Link from "next/link";
import { useState } from "react";

type Row = { name: string; orgId: string; orgName: string; note: string; url: string };

export function PeopleFilter({ rows }: { rows: Row[] }) {
  const [f, setF] = useState("");
  const q = f.trim().toLowerCase();
  const list = rows.filter((p) => !q || (p.name + " " + p.orgName + " " + p.note).toLowerCase().includes(q));
  return (
    <div className="block">
      <label htmlFor="allFilter" className="eyebrow">Filter by name or organization</label>
      <input id="allFilter" type="search" autoComplete="off" placeholder="Type a name or organization" value={f} onChange={(e) => setF(e.target.value)}
        style={{ font: "inherit", color: "var(--ink)", background: "var(--paper)", border: "1.5px solid var(--line)", borderRadius: 999, padding: "10px 16px", maxWidth: 360, width: "100%" }} />
      <div className="tablewrap"><table><thead><tr><th>Name</th><th>Organization</th><th>In the network as</th><th>Reach out</th></tr></thead><tbody>
        {list.length ? list.map((p, i) => (
          <tr key={i}><td className="nm">{p.name}</td>
            <td>{p.orgId ? <Link href={`/org/${p.orgId}`}>{p.orgName}</Link> : p.orgName}</td>
            <td>{p.note}</td>
            <td>{p.url ? <a className="ext" href={p.url} target="_blank" rel="noopener">Website ↗</a> : <a className="ext" href={`https://www.google.com/search?q=${encodeURIComponent(p.orgName)}`} target="_blank" rel="noopener">Look up ↗</a>}</td></tr>
        )) : <tr><td colSpan={4}>No one matches that.</td></tr>}
      </tbody></table></div>
    </div>
  );
}
