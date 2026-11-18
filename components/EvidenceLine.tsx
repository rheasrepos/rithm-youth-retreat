import type { Evidence } from "@/lib/types";
import { AI } from "@/components/AI";

export function EvidenceLine({ e }: { e?: Evidence }) {
  if (!e) return <span className="evl">No linkable project found yet.</span>;
  return (
    <span className="evl">
      <b>{e.title}</b>{e.year ? ` (${e.year})` : ""}. <AI>{e.what}</AI>{" "}
      {e.url && <a href={e.url} target="_blank" rel="noopener">Source ↗</a>}
    </span>
  );
}
