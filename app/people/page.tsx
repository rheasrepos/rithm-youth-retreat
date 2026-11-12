import Link from "next/link";
import { getModel } from "@/lib/data";
import { PeopleFilter } from "@/components/PeopleFilter";

export const revalidate = 3600;
export const metadata = { title: "Everyone in the network" };

export default async function People() {
  const m = await getModel();
  const rows = m.people.map((p) => ({ name: p.name, orgId: p.org?.id ?? "", orgName: p.orgName, note: p.note, url: p.org?.url ?? "" }));
  return (
    <section className="results">
      <div className="rhead"><span className="crumb"><Link href="/">Map</Link> · People</span><h2>Everyone in the network</h2>
        <p>{rows.length} people. Not here yet? <Link href="/submit">Add yourself →</Link></p></div>
      <PeopleFilter rows={rows} />
    </section>
  );
}
