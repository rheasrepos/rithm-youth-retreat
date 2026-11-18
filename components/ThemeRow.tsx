import Link from "next/link";
import type { Model, Theme } from "@/lib/types";
import { EvidenceLine } from "./EvidenceLine";
import { Notes } from "./Notes";
import { AI } from "@/components/AI";
import { Quote } from "./Quote";

export function ThemeRow({ model, t, showDomain }: { model: Model; t: Theme; showDomain?: boolean }) {
  const verified = t.orgs.filter((x) => x.verdict === "verified");
  return (
    <div className="concern" id={`theme-${t.id}`}>
      <div>
        <span className="q"><AI>{t.label}</AI>{showDomain && <span className="tag"> · {model.domainById[t.domainId]?.name}</span>}</span>
        <div className="quotes">{t.stickies.map((s) => <Quote key={s.id} s={s} />)}</div>
        <Notes model={model} id={t.id} />
      </div>
      <div className="who">
        {t.orgs.length === 0 ? (
          <span className="gap"><b>Untapped.</b> Nobody in the network has linked work here yet. Room to start something. <Link href={`/submit?theme=${t.id}`}>Claim it →</Link></span>
        ) : (
          <div className="whol">
            {t.orgs.map(({ org, verdict, evidence }) => (
              <div key={org.id} className={`wrow${verdict === "nearby" ? " weak" : ""}`}>
                <div className="top">
                  <Link className="orgbtn link" href={`/org/${org.id}`}>{org.name}</Link>
                  <span className="vb">{verdict === "nearby" ? "Nearby" : "Verified"}</span>
                </div>
                <EvidenceLine e={evidence} />
              </div>
            ))}
            {verified.length === 0 && <span className="gap"><b>Untapped.</b> Only nearby work so far; nobody is on this specific note. <Link href={`/submit?theme=${t.id}`}>Claim it →</Link></span>}
          </div>
        )}
      </div>
    </div>
  );
}
