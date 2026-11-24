"use client";
import { useEffect, useState } from "react";

/** A domain tile that flips over to show what people cared about there (Nahom's network map had this). */
export function FlipTile({ id, front, back }: { id: string; front: React.ReactNode; back: React.ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className={`tile${flipped ? " flipped" : ""}`} data-tile={id}>
      <div className="inner">
        <div className="face front" aria-hidden={flipped || undefined}>
          {front}
          <button className="flipbtn" type="button" tabIndex={flipped ? -1 : undefined} onClick={() => setFlipped(true)}>See what they cared about ↻</button>
        </div>
        <div className="face back" aria-hidden={!flipped || undefined}>
          {back}
          <div className="backbtns">
            <button className="flipbtn" type="button" tabIndex={flipped ? undefined : -1} onClick={() => setFlipped(false)}>↺ Flip back</button>
            <a className="flipbtn" href={`/domain/${id}`} tabIndex={flipped ? undefined : -1}>Open domain →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/** "3 matches" on a tile while a search is showing; SearchBox announces the counts. */
export function TileHit({ id }: { id: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = (e: Event) => setN(((e as CustomEvent).detail?.[id] as number) || 0);
    window.addEventListener("rithm-search", f);
    return () => window.removeEventListener("rithm-search", f);
  }, [id]);
  return n > 0 ? <span className="hit match">{n} match{n > 1 ? "es" : ""}</span> : null;
}
