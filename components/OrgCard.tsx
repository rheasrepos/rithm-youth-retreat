import Link from "next/link";
import type { Model, Org } from "@/lib/types";
import { CopyEmail } from "./CopyEmail";

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "info@therithmproject.org";

export function OrgCard({ model, o, themeFilter, full }: { model: Model; o: Org; themeFilter?: string[]; full?: boolean }) {
  const links = o.links.filter((l) => !themeFilter || themeFilter.includes(l.themeId));
  const site = o.url
    ? <a className="ext" href={o.url} target="_blank" rel="noopener">Website ↗</a>
    : <a className="ext" href={`https://www.google.com/search?q=${encodeURIComponent(o.name)}`} target="_blank" rel="noopener">Look up ↗</a>;
  return (
    <article className="card" id={`org-${o.id}`}>
      <div className="meta">
        {o.funder && <span className="fund">Funder</span>}
        <span className="tag">{o.domains.map((d) => model.domainById[d]?.name.split(" & ")[0].split(",")[0]).filter(Boolean).join(" · ")}</span>
      </div>
      <h3>{full ? o.name : <Link href={`/org/${o.id}`} style={{ textDecoration: "none" }}>{o.name}</Link>}</h3>
      <p className="b">{o.blurb}</p>
      {o.retreatNote && <p className="retreat"><b>At the retreat:</b> {o.retreatNote}</p>}
      {o.people.length > 0 && (
        <p className="ppl">In the network: {o.people.map((p, i) => <span key={i}>{i > 0 && "; "}<b>{p.name}</b> <span>({p.note})</span></span>)}</p>
      )}
      {links.length > 0 && (
        <span className="why">On this map for: {links.map((l, i) => (
          <span key={l.themeId}>{i > 0 && "; "}<Link href={`/domain/${model.themes[l.themeId]?.domainId}#theme-${l.themeId}`}>{model.labelOf(l.themeId)}</Link>{l.verdict === "nearby" ? " (nearby)" : ""}</span>
        ))}</span>
      )}
      {o.evidence.length ? (
        <ul className="evs">
          {o.evidence.map((e) => (
            <li key={e.id}>
              <b>{e.title}</b>{e.year ? ` (${e.year})` : ""}. {e.what}{" "}
              {e.url && <a href={e.url} target="_blank" rel="noopener">Source ↗</a>}
              {e.themes.length > 0 && <span className="for">Evidence for: {e.themes.map((t) => model.labelOf(t)).join("; ")}{e.verifiedOn ? ` · checked ${e.verifiedOn}` : ""}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="noev">No linkable project found online yet; placement rests on the retreat.</p>
      )}
      <div className="meta">{site} {o.people[0] && <CopyEmail email={EMAIL} who={o.people[0].name} />}</div>
    </article>
  );
}
