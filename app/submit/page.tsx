import Link from "next/link";
import { SubmitForm } from "@/components/SubmitForm";
import { getModel } from "@/lib/data";

export const revalidate = 3600;
export const metadata = { title: "Add yourself or claim a note" };

export default async function Submit({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const m = await getModel();
  const themes = Object.values(m.themes).map((t) => ({ id: t.id, label: `${m.domainById[t.domainId]?.name} — ${t.label}`, status: t.status }));
  const stickies = m.domains.flatMap((d) => d.building.map((s) => ({ id: s.id, label: `${d.name} — “${s.text.slice(0, 80)}${s.text.length > 80 ? "…" : ""}”` })));
  const orgs = m.orgs.map((o) => ({ id: o.id, name: o.name }));
  return (
    <section className="results">
      <div className="rhead"><span className="crumb"><Link href="/">Map</Link> · Submit</span><h2>Add yourself, your organization, or evidence</h2>
        <p>Everything sent here lands in the Rithm team&apos;s review queue. Once approved it appears on the map at the next rebuild (nightly, or sooner). Nothing you type is published automatically.</p></div>
      <SubmitForm themes={themes} stickies={stickies} orgs={orgs} preset={{ theme: sp.theme ?? "", sticky: sp.sticky ?? "", org: sp.org ?? "" }} />
    </section>
  );
}
