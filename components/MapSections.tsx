import Link from "next/link";
import { Quote } from "@/components/Quote";
import { AI } from "@/components/AI";
import { PeopleFilter } from "@/components/PeopleFilter";
import type { Model, Theme } from "@/lib/types";

/* The two lists that used to be their own pages and now sit inside the Changemaker Network map. */

function Card({ m, t }: { m: Model; t: Theme }) {
  const d = m.domainById[t.domainId];
  return (
    <div className="ucard">
      <span className="dn">{d?.name}</span>
      <h3><AI>{t.label}</AI></h3>
      <div className="quotes">{t.stickies.map((s) => <Quote key={s.id} s={s} small />)}</div>
      {t.orgs.length > 0 && <span className="near">Nearby: {t.orgs.map((l, i) => <span key={l.org.id}>{i > 0 && ", "}<Link href={`/org/${l.org.id}`}>{l.org.name}</Link></span>)}</span>}
      <Link className="goto" href={`/domain/${t.domainId}#theme-${t.id}`}>Open in {d?.name} →</Link>
      <Link className="goto" href={`/submit?theme=${t.id}`}>I work on this →</Link>
    </div>
  );
}

export function UntappedSection({ m }: { m: Model }) {
  const { none, nearby } = m.untapped;
  return (
    <section className="untapped" id="untapped" aria-labelledby="untappedTitle">
      <div className="rhead"><span className="eyebrow">Open problems</span><h2 id="untappedTitle">Untapped problems</h2>
        <p>Sticky notes that no organization in the network has linked work on. This list is computed from the data every time the site rebuilds, so it shrinks the moment someone claims a note.</p></div>
      <div className="sub"><span className="eyebrow">Nobody on it ({none.length})</span>
        {none.length ? <div className="ugrid">{none.map((t) => <Card key={t.id} m={m} t={t} />)}</div> : <p>Every concern has at least one verified organization.</p>}
      </div>
      <div className="sub"><span className="eyebrow">Only nearby work ({nearby.length})</span>
        <p>Organizations that work in the area, but no project aimed at this specific note has been linked yet.</p>
        <div className="ugrid">{nearby.map((t) => <Card key={t.id} m={m} t={t} />)}</div>
      </div>
    </section>
  );
}

export function EveryoneSection({ m }: { m: Model }) {
  const rows = m.people.map((p) => ({ name: p.name, orgId: p.org?.id ?? "", orgName: p.orgName, note: p.note, url: p.org?.url ?? "" }));
  return (
    <section className="results" id="everyone" aria-labelledby="everyoneTitle">
      <div className="rhead"><span className="eyebrow">The network</span><h2 id="everyoneTitle">Everyone in the network</h2>
        <p>{rows.length} people. Not here yet? <Link href="/submit">Add yourself →</Link></p></div>
      <PeopleFilter rows={rows} />
    </section>
  );
}
