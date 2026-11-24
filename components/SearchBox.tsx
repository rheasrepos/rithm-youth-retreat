"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { runSearch, type SearchIndex } from "@/lib/search";

const TRIES = ["AI companions", "third spaces", "leaving social media", "AI policy", "lonely in college", "storytelling", "jobs and AI", "funding"];

type PersonRow = { name: string; orgId: string; orgName: string; note: string; url: string };

export function SearchBox({ index, themeEls, orgEls, people }: { index: SearchIndex; themeEls?: Record<string, React.ReactNode>; orgEls?: Record<string, React.ReactNode>; people?: PersonRow[] }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const res = useMemo(() => (active ? runSearch(index, active) : null), [index, active]);
  // tell the domain tiles how many matches each one has ("3 matches"), or clear them
  useEffect(() => {
    const hits: Record<string, number> = {};
    if (res) {
      res.orgs.forEach(({ o }) => o.domIds.forEach((d) => { hits[d] = (hits[d] || 0) + 1; }));
      res.themes.forEach(({ th }) => { hits[th.domainId] = (hits[th.domainId] || 0) + 1; });
    }
    window.dispatchEvent(new CustomEvent("rithm-search", { detail: hits }));
  }, [res]);
  const ql = active.toLowerCase();
  const matchPeople = res && people ? people.filter((p) => (p.orgId && res.orgs.some(({ o }) => o.id === p.orgId)) || (ql.length > 2 && (p.name + " " + p.orgName + " " + p.note).toLowerCase().includes(ql))) : [];
  return (
    <>
      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); setActive(q.trim()); }}>
        <label htmlFor="q">What do you want to work on, or what are you worried about?</label>
        <input id="q" name="q" type="search" autoComplete="off" placeholder="e.g. AI companions, third spaces, leaving social media" value={q}
          onChange={(e) => { setQ(e.target.value); if (!e.target.value.trim()) setActive(""); }} />
        <button className="btn" type="submit">Search</button>
      </form>
      <div className="tries"><span>Try:</span>{TRIES.map((t) => <button key={t} className="chip" type="button" onClick={() => { setQ(t); setActive(t); }}>{t}</button>)}</div>
      {res && (
        <section className="results" aria-live="polite" style={{ marginTop: 24 }}>
          <div className="rhead"><span className="eyebrow">Results for</span><h2>“{active}”</h2>
            <p>{res.orgs.length || res.themes.length ? `${res.themes.length} matching concern${res.themes.length === 1 ? "" : "s"}, ${res.orgs.length} organization${res.orgs.length === 1 ? "" : "s"} and ${matchPeople.length} ${matchPeople.length === 1 ? "person" : "people"}.` : "Nothing matched those words. Try a broader word, like loneliness, school, social media or policy, or pick a domain below."}</p>
            <div><button className="btn ghost" type="button" onClick={() => { setQ(""); setActive(""); }}>Clear search</button></div></div>
          {res.themes.length > 0 && (
            <div className="block"><span className="eyebrow">Matching sticky notes</span>
              {themeEls ? <div className="concerns">{res.themes.map(({ th }) => <div key={th.id}>{themeEls[th.id]}</div>)}</div> : (
              <div className="whol">{res.themes.map(({ th }) => (
                <div key={th.id} className={`wrow${th.status === "covered" ? "" : " weak"}`}>
                  <div className="top"><Link className="orgbtn link" href={`/domain/${th.domainId}#theme-${th.id}`}>{th.label}</Link><span className="tag">{th.domainName}</span>
                    {th.status !== "covered" && <span className="vb">Untapped</span>}</div>
                </div>))}</div>)}
            </div>
          )}
          {res.orgs.length > 0 && (
            <div className="block"><span className="eyebrow">Organizations</span>
              {orgEls ? <div className="cards">{res.orgs.map(({ o }) => <div key={o.id} style={{ display: "contents" }}>{orgEls[o.id]}</div>)}</div> : (
              <div className="whol">{res.orgs.map(({ o }) => (
                <div key={o.id} className="wrow"><div className="top"><Link className="orgbtn link" href={`/org/${o.id}`}>{o.name}</Link></div>
                  {o.themes && <span className="evl">Works on: {o.themes}</span>}</div>))}</div>)}
            </div>
          )}
          {matchPeople.length > 0 && (
            <div className="block"><span className="eyebrow">People</span>
              <div className="tablewrap"><table><thead><tr><th>Name</th><th>Organization</th><th>In the network as</th><th>Reach out</th></tr></thead><tbody>
                {matchPeople.map((p, i) => (
                  <tr key={i}><td className="nm">{p.name}</td>
                    <td>{p.orgId ? <Link href={`/org/${p.orgId}`}>{p.orgName}</Link> : p.orgName}</td>
                    <td>{p.note}</td>
                    <td>{p.url ? <a className="ext" href={p.url} target="_blank" rel="noopener">Website ↗</a> : <a className="ext" href={`https://www.google.com/search?q=${encodeURIComponent(p.orgName)}`} target="_blank" rel="noopener">Look up ↗</a>}</td></tr>
                ))}
              </tbody></table></div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
