/** Marks text Claude drafted or a figure made by code Claude wrote. Same convention as rheamad.vercel.app:
 *  a dashed underline, a short "generating" fade the first time it scrolls into view (see AIControls),
 *  and a site-wide switch that hides it. Quotes from people never go inside this. */
const TIP = "Drafted with AI (Claude) from the retreat materials. Check it against the sources.";

export function AI({ children, block, title = TIP }: { children: React.ReactNode; block?: boolean; title?: string }) {
  return block ? <div className="ai-generated" title={title}>{children}</div> : <span className="ai-generated" title={title}>{children}</span>;
}

/** A chart or layout computed by code Claude wrote. The caption says what the code did. */
export function AIFigure({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <figure className="ai-figure">
      {children}
      <figcaption><span className="ai-generated" title="Made by code Claude wrote, run on the retreat data.">{caption}</span></figcaption>
    </figure>
  );
}
