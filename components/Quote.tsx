import type { Sticky } from "@/lib/types";

export function Quote({ s, small }: { s: Sticky; small?: boolean }) {
  const c = (s.color || "").split(/[^a-z]/)[0];
  return (
    <blockquote className={`qt c-${c}${small ? " small" : ""}`} data-sticky={s.id}>
      “{s.text}”{s.uncertain && <span className="unc"> (handwriting partly uncertain)</span>}
    </blockquote>
  );
}
