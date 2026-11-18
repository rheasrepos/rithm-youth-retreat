import Link from "next/link";
import { AI } from "@/components/AI";
import type { Model } from "@/lib/types";

/** Cross-domain links and workshop mentions for a theme or sticky. */
export function Notes({ model, id }: { model: Model; id: string }) {
  const notes = model.notesFor(id);
  if (!notes.length) return null;
  return (
    <AI block><div className="notes">
      {notes.map((n, i) => (
        <span key={i}>
          <b>{n.kind === "link" && n.targetId ? <Link href={`/domain/${model.domainOf(n.targetId)?.id}#theme-${n.targetId}`} style={{ textDecoration: "none" }}>{n.title}</Link> : n.title}</b>
          {n.targetDomain && <span className="dn"> ({n.targetDomain})</span>}
          {n.body ? `. ${n.body}${/[.?!”"]$/.test(n.body) ? "" : "."}` : "."}
        </span>
      ))}
    </div></AI>
  );
}
