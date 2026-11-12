import Link from "next/link";
import { notFound } from "next/navigation";
import { OrgCard } from "@/components/OrgCard";
import { Quote } from "@/components/Quote";
import { getModel } from "@/lib/data";

export const revalidate = 3600;

export async function generateStaticParams() {
  const m = await getModel();
  return m.orgs.map((o) => ({ id: o.id }));
}
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const m = await getModel();
  return { title: m.orgById[id]?.name ?? "Organization" };
}

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await getModel();
  const o = m.orgById[id];
  if (!o) notFound();
  return (
    <section className="orgpage">
      <span className="crumb"><Link href="/">Map</Link> · Organization</span>
      <div className="cards" style={{ gridTemplateColumns: "minmax(0,1fr)", maxWidth: 760 }}><OrgCard model={m} o={o} full /></div>
      {o.links.length > 0 && (
        <div className="block"><span className="eyebrow">The sticky notes this organization is placed next to</span>
          <div className="concerns">{o.links.map((l) => { const t = m.themes[l.themeId]; if (!t) return null; return (
            <div className="concern" key={t.id}><div>
              <span className="q"><Link href={`/domain/${t.domainId}#theme-${t.id}`} style={{ textDecoration: "none" }}>{t.label}</Link> <span className="tag">· {m.domainById[t.domainId]?.name}</span></span>
              <div className="quotes">{t.stickies.map((s) => <Quote key={s.id} s={s} small />)}</div></div>
              <div className="who"><span className={`vb${l.verdict === "nearby" ? " weak" : ""}`} style={l.verdict === "nearby" ? { background: "transparent", color: "var(--muted)", border: "1px solid var(--line)" } : undefined}>{l.verdict === "nearby" ? "Nearby" : "Verified"}</span>{l.note && <span className="evl"> {l.note}</span>}</div>
            </div>); })}</div>
        </div>
      )}
      <p className="status">Something out of date? <Link href={`/submit?org=${o.id}`}>Send an update or new evidence →</Link></p>
    </section>
  );
}
