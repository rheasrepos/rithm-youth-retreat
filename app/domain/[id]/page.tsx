import Link from "next/link";
import { notFound } from "next/navigation";
import { Notes } from "@/components/Notes";
import { OrgCard } from "@/components/OrgCard";
import { Quote } from "@/components/Quote";
import { ThemeRow } from "@/components/ThemeRow";
import { AI } from "@/components/AI";
import { getModel } from "@/lib/data";
/* eslint-disable @next/next/no-img-element */

export const revalidate = 3600;

/** The summary sheets each domain group wrote by hand at the retreat (scans in public/domain-summaries). Only some groups made one. */
const SUMMARIES: Record<string, string[]> = { rel: ["rel-1"], com: ["com-1", "com-2"], phy: ["phy-1", "phy-2"], pol: ["pol-1", "pol-2"] };

export async function generateStaticParams() {
  const m = await getModel();
  return m.domains.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const m = await getModel();
  return { title: m.domainById[id]?.name ?? "Domain" };
}

export default async function DomainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getModel();
  const d = m.domainById[id];
  if (!d) notFound();
  const themeIds = d.themes.map((t) => t.id);
  const orgs = m.orgs.filter((o) => o.domains.includes(d.id) || o.links.some((l) => themeIds.includes(l.themeId)));
  const score = (o: (typeof orgs)[number]) => o.links.filter((l) => themeIds.includes(l.themeId)).reduce((a, l) => a + (l.verdict === "verified" ? 2 : 1), 0);
  orgs.sort((a, b) => score(b) - score(a) || Number(a.funder) - Number(b.funder) || a.name.localeCompare(b.name));
  const people = m.people.filter((p) => p.org && orgs.includes(p.org));
  return (
    <section className="results">
      <div className="rhead">
        <span className="crumb"><Link href="/">Map</Link> · Domain</span>
        {SUMMARIES[d.id] ? (
          <details className="dsum">
            <summary><h2 className="handtitle"><img src={`/domain-cards/${d.id}-card.jpg`} alt={d.name} /></h2><span className="dsumhint">Tap to see our group&apos;s handwritten summary</span></summary>
            <div className="dsumimgs">{SUMMARIES[d.id].map((f, k) => <a key={f} href={`/domain-summaries/${f}.jpg`} target="_blank" rel="noopener"><img src={`/domain-summaries/${f}.jpg`} alt={`${d.name}: the group's handwritten summary, page ${k + 1}`} loading="lazy" /></a>)}</div>
          </details>
        ) : <h2 className="handtitle"><img src={`/domain-cards/${d.id}-card.jpg`} alt={d.name} /></h2>}
        <p className="ddesc"><AI>{d.description}</AI></p>
        <p>{d.stickyCount} sticky notes, grouped into {d.themes.length} concerns · {orgs.length} organizations and {people.length} people in the network.</p>
        <div className="topnav domnav">{m.domains.map((x) => <Link key={x.id} href={`/domain/${x.id}`} aria-current={x.id === d.id ? "page" : undefined}>{x.name}</Link>)}</div>
      </div>

      <div className="block"><span className="eyebrow">What changemakers wrote, and who&apos;s on it</span>
        <div className="concerns">{d.themes.map((t) => <ThemeRow key={t.id} model={m} t={t} />)}</div>
      </div>

      {d.building.length > 0 && (
        <div className="block"><span className="eyebrow">Changemakers already building here (from the wall)</span>
          <div className="concerns">{d.building.map((s) => (
            <div className="concern" key={s.id}><div><Quote s={s} /><Notes model={m} id={s.id} /></div>
              <div className="who"><span className="gap">Anonymous sticky. Find the person on the Network Walk or through Rithm. Is this you? <Link href={`/submit?sticky=${s.id}`}>Put your name on it →</Link></span></div></div>
          ))}</div>
        </div>
      )}

      {d.other.length > 0 && (
        <div className="block"><span className="eyebrow">Also on the wall</span><div className="also">{d.other.map((s) => <Quote key={s.id} s={s} small />)}</div></div>
      )}

      <div className="block"><span className="eyebrow">Organizations</span>
        <div className="cards">{orgs.map((o) => <OrgCard key={o.id} model={m} o={o} themeFilter={themeIds} />)}</div>
      </div>

      <div className="block"><span className="eyebrow">People</span>
        {people.length ? (
          <div className="tablewrap"><table><thead><tr><th>Name</th><th>Organization</th><th>In the network as</th></tr></thead><tbody>
            {people.map((p, i) => <tr key={i}><td className="nm">{p.name}</td><td>{p.org ? <Link href={`/org/${p.org.id}`}>{p.orgName}</Link> : p.orgName}</td><td>{p.note}</td></tr>)}
          </tbody></table></div>
        ) : <p className="empty">No people yet.</p>}
      </div>
    </section>
  );
}
