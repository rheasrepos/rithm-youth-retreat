import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { getModel } from "@/lib/data";
import { AI } from "@/components/AI";
import { buildIndex } from "@/lib/search";
import { EveryoneSection, UntappedSection } from "@/components/MapSections";

export const revalidate = 3600;

export default async function Home() {
  const m = await getModel();
  const index = buildIndex(m);
  const untapped = m.untapped.none.length + m.untapped.nearby.length;
  return (
    <>
      <header className="hero">
        <h1>Find who&apos;s working on <em className="ul">what you care about<svg viewBox="0 0 300 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 8 C 60 2, 140 3, 200 6 S 280 9, 297 4" /></svg></em></h1>
        <p className="lede">At the October retreat, young changemakers wrote what worries them on sticky notes across eight parts of life. Every note is quoted here <em>word for word</em>. Next to each one: the organizations in the Rithm network with real, linked work on it, and the problems nobody has picked up yet. It builds on <a href="https://readymag.website/u918716038/6521655/" target="_blank" rel="noopener">Rithm&apos;s existing work ↗</a>.</p>
        <SearchBox index={index} />
        <div className="legend">
          <span><span className="vb">Verified</span> a named project, report, product or law we could link to</span>
          <span><span className="vb" style={{ background: "transparent", color: "var(--muted)", border: "1px solid var(--line)" }}>Nearby</span> works in the area, but nothing specific to this note</span>
          <span><a href="#untapped" style={{ color: "var(--pink)", fontWeight: 700 }}>{untapped} untapped problems ↓</a></span>
        </div>
        <p className="jump"><span className="eyebrow">On this page</span> <a href="#mapTitle">The eight domains</a> · <a href="#untapped">Untapped problems</a> · <a href="#everyone">Everyone in the network</a></p>
      </header>

      <section className="mapsec" aria-labelledby="mapTitle">
        <div className="maphead">
          <h2 id="mapTitle">The eight domains</h2>
          <p>Pick one to read the sticky notes, see who in the network is already on each concern (and the evidence), and how to reach them.</p>
        </div>
        <div className="tiles">
          {m.domains.map((d) => {
            const orgs = m.orgs.filter((o) => o.domains.includes(d.id) || o.links.some((l) => m.themes[l.themeId]?.domainId === d.id));
            const people = orgs.reduce((a, o) => a + o.people.length, 0);
            const open = d.themes.filter((t) => t.status !== "covered").length;
            return (
              <div className="tile" key={d.id}><div className="inner"><div className="face front">
                <Link className="open" href={`/domain/${d.id}`}>
                  <span className="nm">{d.name}</span>
                  <span className="ct">{d.stickyCount} sticky notes · {orgs.length} organizations · {people} people</span>
                  {open > 0 && <span className="hit">{open} untapped</span>}
                </Link>
                <span className="desc"><AI>{d.description}</AI></span>
                <ul className="tnotes">{d.themes.map((t) => <li key={t.id}><AI>{t.label}</AI></li>)}</ul>
              </div></div></div>
            );
          })}
        </div>
      </section>
      <UntappedSection m={m} />
      <EveryoneSection m={m} />
      <p className="status">Data loaded from {m.loadedFrom === "sheet" ? "the network sheet" : "the bundled seed file"}; refreshed nightly and whenever the Rithm team approves a submission.</p>
    </>
  );
}
