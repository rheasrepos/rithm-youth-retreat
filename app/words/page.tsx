import { WordCloud, type CloudNote } from "@/components/WordCloud";
import { getModel } from "@/lib/data";

export const revalidate = 3600;
export const metadata = { title: "The words" };

export default async function Words() {
  const m = await getModel();
  // counted live from the notes, so approved new notes join the cloud on the next rebuild (hidden notes never reach the page)
  const notes: CloudNote[] = [];
  for (const d of m.domains) for (const s of [...d.themes.flatMap((t) => t.stickies), ...d.building, ...d.other]) notes.push({ id: s.id, text: s.text, kind: s.kind, color: s.color, domain: d.id });
  const domains = m.domains.map((d) => ({ id: d.id, name: d.name }));
  return (
    <section className="words" aria-labelledby="wordsTitle">
      <div className="rhead"><span className="eyebrow">The sticky notes, word by word</span><h2 id="wordsTitle">What we wrote, all at once</h2>
        <p>Every word used on two or more notes. The bigger the word, the more notes use it. Switch between worries and work already under way and watch the words grow and shrink, or add your own note below and watch it change the cloud.</p></div>
      <WordCloud notes={notes} domains={domains} />
      <p className="status">Common words (the, want, I&apos;m) and “working”, which only echoes the prompt, are left out. Plurals are counted with the singular, and phrases that repeat, like “human connection”, are kept whole.</p>
    </section>
  );
}
