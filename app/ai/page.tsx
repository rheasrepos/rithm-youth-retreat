import Link from "next/link";
import { AI } from "@/components/AI";

export const metadata = { title: "How we used AI" };

/* The AI disclosure. Drafted by Claude in the shape of the "How We Leveraged AI in Our Analysis" note in Rithm's
   March 2026 report (which tool, for what, and what people checked). Rhea: rewrite freely, then take the <AI> wrapper off. */
export default function AIPage() {
  return (
    <>
      <header className="hero">
        <h1>How we used <em>AI</em></h1>
        <p className="lede">A retreat about AI and human connection, documented partly with AI. Here is exactly where it came in, and where it didn’t.</p>
      </header>
      <section className="aidisc">
        <AI block>
          <h2>Where AI came in</h2>
          <p>During the retreat and in the weeks after, the Story &amp; Momentum committee used AI as a working tool to help capture and make sense of a weekend’s worth of talk, notes and making. Specifically:</p>
          <ul>
            <li><strong>Granola</strong> recorded and summarized some of the sessions. We announced this on the first night, and anyone could ask for their parts to be left out.</li>
            <li><strong>Claude</strong>, Anthropic’s AI assistant, read the sticky notes and handwritten notes from photos and scans; drafted the concern labels, the domain and organization descriptions and the evidence summaries; pulled candidate quotes out of the transcripts; and wrote the code behind this site, the wall, the word cloud and the zine editor.</li>
            <li><strong>An AI background-removal tool</strong> cut each sticky note out of its photo, so the notes could be moved around on the wall and in the zine.</li>
            <li><strong>A small open language model</strong> (all-MiniLM-L6-v2), run on a laptop, places the sticky notes by meaning in the regrouping views on <Link href="/wall">the wall</Link>.</li>
          </ul>
          <h2>Where it didn’t</h2>
          <p>Every sticky note, poem, zine page and photo was made by a person. The story in the zine is Rhea’s, as she spoke it, with only names corrected. People chose which quotes, photos and pages to keep. Sticky notes are anonymous, and names appear only with permission.</p>
          <h2>How to tell which is which</h2>
          <p>Text drafted by AI has a dashed underline, like this page, and figures made by code sit in a dashed frame. People’s own words are never underlined. Transcriptions were checked by hand against the photos. Where the AI’s reading and ours sit side by side, ours comes first, and people’s judgment had the final say on what was kept.</p>
        </AI>
      </section>
    </>
  );
}
