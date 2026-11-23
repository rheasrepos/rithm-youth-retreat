"use client";
import { useEffect, useRef, useState } from "react";

export interface TeamPerson { id: string; photo: string; name: string; crew: string; did: string; linkedin?: string }

/** A wall of Polaroids. Pressing one opens that person's card in a little window. */
export function Team({ people }: { people: TeamPerson[] }) {
  const [open, setOpen] = useState<TeamPerson | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <ul className="teamgrid">
        {people.map((p, i) => (
          <li key={p.id}>
            <button type="button" className="teamcard" style={{ ["--r" as string]: `${((i * 37) % 9) - 4}deg` }} onClick={() => setOpen(p)} aria-label={p.name ? `Open ${p.name}'s card` : "Open this Polaroid"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photo} alt={p.name ? `Polaroid of ${p.name}` : "Polaroid from the retreat"} loading="lazy" />
              <span className="cap">{p.name}</span>
              {p.crew && <span className="crew">{p.crew}</span>}
            </button>
            {p.linkedin && <a className="tli" href={p.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${p.name || "This person"} on LinkedIn`} title="LinkedIn">in</a>}
          </li>
        ))}
      </ul>
      <dialog ref={dlg} className="teamdlg" onClose={() => setOpen(null)} onClick={(e) => { if (e.target === dlg.current) setOpen(null); }}>
        {open && (
          <>
            <div className="bar"><span>{open.name || "Polaroid"}</span><button type="button" onClick={() => setOpen(null)} aria-label="Close">×</button></div>
            <div className="body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={open.photo} alt="" />
              <div>
                <h3>{open.name || <span className="todo">Name to come</span>}</h3>
                {open.crew && <p className="eyebrow">{open.crew}</p>}
                {open.linkedin && <p><a className="tli inline" href={open.linkedin} target="_blank" rel="noopener noreferrer">in</a> <a href={open.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></p>}
                <p className="did">{open.did || <span className="todo">Something they did or said at the retreat goes here.</span>}</p>
              </div>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
