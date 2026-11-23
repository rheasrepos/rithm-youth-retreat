import { WordCloud, type CloudNote } from "@/components/WordCloud";
import { AIFigure } from "@/components/AI";
import { getModel } from "@/lib/data";
import quotes from "@/data/zine-quotes.json";

export const revalidate = 3600;
export const metadata = { title: "The words" };

export default async function Words() {
  const m = await getModel();
  // counted live from the notes, so approved new notes join the cloud on the next rebuild (hidden notes never reach the page)
  const notes: CloudNote[] = [];
  for (const d of m.domains) for (const s of [...d.themes.flatMap((t) => t.stickies), ...d.building, ...d.other]) notes.push({ id: s.id, text: s.text, kind: s.kind, color: s.color, domain: d.id });
  const domains = m.domains.map((d) => ({ id: d.id, name: d.name }));
  // what people said out loud in the sessions (Granola transcripts, personal stories already left out), for the "+ What we talked about" button
  // Left out on top of that: the personal second half of Leorah's session (from "An approachability standpoint" on), and lines that touch
  // health, family, identity, religion or party politics, so clicking a word never pulls up someone's personal share.
  const SKIP = /\b(ocd|anxiety|hair|stabbed|cried|lesbian|gay|trans|parents?|mom|dad|mother|father|sister|brother|grandma|family|trauma|suicid\w*|immigra\w*|religio\w*|church|god|pray\w*|addict\w*|drugs?|diagnos\w*|medication|disorder|depress\w*|condition|been in therapy|my therapy|went through therapy|stop therapy|severe|boyfriend|girlfriend|in love|prostitute|fuck\w*|maga|trump|republican|democrat|conservative|liberal|turning point|october 7|israel|palestin\w*|abortion|middle school)\b/i;
  const all = quotes.quotes as { t: string; kind: string; src: string }[];
  const cut = all.findIndex((q) => q.t.startsWith("An approachability standpoint"));
  const talk: CloudNote[] = all.filter((q, i) => q.kind === "transcript" && !SKIP.test(q.t) && !(cut >= 0 && i >= cut && q.src.includes("Leorah")))
    .map((q, i) => ({ id: `talk-${i}`, text: q.t.replace(/\brhythm\b/gi, "Rithm"), kind: "said", color: "purple", domain: "talk" }));
  return (
    <section className="words" aria-labelledby="wordsTitle">
      <div className="rhead"><span className="eyebrow">The sticky notes, word by word</span><h2 id="wordsTitle">What we wrote, all at once</h2>
        <p>Every word used on two or more notes. The bigger the word, the more notes use it. Switch between worries and work already under way and watch the words grow and shrink, or add your own note below and watch it change the cloud. Press “+ What we talked about” to add what people said out loud in the sessions.</p></div>
      <AIFigure caption="Counted and drawn by code Claude wrote: every word on two or more notes, sized by how many notes use it."><WordCloud notes={notes} domains={domains} talk={talk} /></AIFigure>
      <p className="status">Common words (the, want, I&apos;m) and “working”, which only echoes the prompt, are left out. Plurals are counted with the singular, and phrases that repeat, like “human connection”, are kept whole.</p>
    </section>
  );
}
