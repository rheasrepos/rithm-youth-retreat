"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { runSearch, type SearchIndex } from "@/lib/search";

const TRIES = ["AI companions", "third spaces", "leaving social media", "AI policy", "lonely in college", "storytelling", "jobs and AI", "funding"];

export function SearchBox({ index }: { index: SearchIndex }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const res = useMemo(() => (active ? runSearch(index, active) : null), [index, active]);
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
            <p>{res.orgs.length || res.themes.length ? `${res.themes.length} matching concern${res.themes.length === 1 ? "" : "s"} and ${res.orgs.length} organization${res.orgs.length === 1 ? "" : "s"}.` : "Nothing matched those words. Try a broader word, like loneliness, school, social media or policy, or pick a domain below."}</p>
            <div><button className="btn ghost" type="button" onClick={() => { setQ(""); setActive(""); }}>Clear search</button></div></div>
          {res.themes.length > 0 && (
            <div className="block"><span className="eyebrow">Matching sticky notes</span>
              <div className="whol">{res.themes.map(({ th }) => (
                <div key={th.id} className={`wrow${th.status === "covered" ? "" : " weak"}`}>
                  <div className="top"><Link className="orgbtn link" href={`/domain/${th.domainId}#theme-${th.id}`}>{th.label}</Link><span className="tag">{th.domainName}</span>
                    {th.status !== "covered" && <span className="vb">Untapped</span>}</div>
                </div>))}</div>
            </div>
          )}
          {res.orgs.length > 0 && (
            <div className="block"><span className="eyebrow">Organizations</span>
              <div className="whol">{res.orgs.map(({ o }) => (
                <div key={o.id} className="wrow"><div className="top"><Link className="orgbtn link" href={`/org/${o.id}`}>{o.name}</Link></div>
                  {o.themes && <span className="evl">Works on: {o.themes}</span>}</div>))}</div>
            </div>
          )}
        </section>
      )}
    </>
  );
}
