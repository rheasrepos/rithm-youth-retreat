"use client";
import Link from "next/link";
import { AI } from "@/components/AI";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Everything on the rug is an item with a centre (x, y), a tilt and a stacking order. The rug is 100 units wide. */
export interface WallItem {
  id: string; kind: "note" | "pola" | "label";
  x: number; y: number; rot: number; z: number; w: number;
  src?: string; iw?: number; ih?: number;
  text?: string; uncertain?: boolean; themeId?: string; themeLabel?: string; status?: string;
  domainId?: string; domainName?: string; count?: number;
}
type Pos = { x: number; y: number; rot: number; z: number };
/** What data/wall-layout.json holds. Items that aren't listed keep their default spot. */
export interface WallLayout { height?: number; background?: string; backgroundMode?: "cover" | "tile"; items: Record<string, Pos> }

const round = (n: number) => Math.round(n * 100) / 100;

export function Wall({ items, defaultHeight, saved, canSave }: { items: WallItem[]; defaultHeight: number; saved: WallLayout | null; canSave: boolean }) {
  const defaults = useMemo(() => Object.fromEntries(items.map((i) => [i.id, { x: i.x, y: i.y, rot: i.rot, z: i.z }])) as Record<string, Pos>, [items]);
  const [pos, setPos] = useState<Record<string, Pos>>(() => ({ ...defaults, ...(saved?.items ?? {}) }));
  const [height, setHeight] = useState(saved?.height ?? defaultHeight);
  const [bg, setBg] = useState(saved?.background ?? "");
  const [bgMode, setBgMode] = useState<"cover" | "tile">(saved?.backgroundMode ?? "cover");
  const [editing, setEditing] = useState(false);
  const [canEdit, setCanEdit] = useState(canSave);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<WallItem | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ id: string; px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => { if (new URLSearchParams(window.location.search).has("edit")) { setCanEdit(true); setEditing(true); } }, []);
  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const patch = useCallback((id: string, p: Partial<Pos>) => setPos((all) => ({ ...all, [id]: { ...all[id], ...p } })), []);
  const topZ = () => Math.max(...Object.values(pos).map((p) => p.z)) + 1;
  const bottomZ = () => Math.min(...Object.values(pos).map((p) => p.z)) - 1;

  const down = (e: React.PointerEvent, id: string) => {
    if (!editing) return;
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSel(id); drag.current = { id, px: e.clientX, py: e.clientY, x: pos[id].x, y: pos[id].y };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, c = canvas.current; if (!d || !c) return;
    const unit = c.getBoundingClientRect().width / 100;
    patch(d.id, { x: round(Math.min(100, Math.max(0, d.x + (e.clientX - d.px) / unit))), y: round(Math.min(height, Math.max(0, d.y + (e.clientY - d.py) / unit))) });
  };
  const up = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent, id: string) => {
    if (!editing) return;
    const step = e.shiftKey ? 2 : 0.5, p = pos[id];
    const moves: Record<string, Partial<Pos>> = {
      ArrowLeft: { x: round(p.x - step) }, ArrowRight: { x: round(p.x + step) }, ArrowUp: { y: round(p.y - step) }, ArrowDown: { y: round(p.y + step) },
      "[": { rot: p.rot - 5 }, "]": { rot: p.rot + 5 },
    };
    if (moves[e.key]) { e.preventDefault(); setSel(id); patch(id, moves[e.key]); }
  };

  const layout = (): WallLayout => {
    const changed: Record<string, Pos> = {};
    for (const [id, p] of Object.entries(pos)) {
      const d = defaults[id];
      if (!d || p.x !== d.x || p.y !== d.y || p.rot !== d.rot || p.z !== d.z) changed[id] = { x: round(p.x), y: round(p.y), rot: round(p.rot), z: p.z };
    }
    return { height, ...(bg && !bg.startsWith("blob:") ? { background: bg.split("?")[0], backgroundMode: bgMode } : {}), items: changed };
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(layout(), null, 1) + "\n"], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "wall-layout.json"; a.click(); URL.revokeObjectURL(url);
  };
  const save = async () => {
    try {
      const r = await fetch("/api/wall-layout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(layout()) });
      if (r.ok) { setMsg("Saved to data/wall-layout.json."); return; }
    } catch { /* fall through to download */ }
    download(); setMsg("This copy of the site can't write files, so the layout was downloaded. Put wall-layout.json in the repo's data folder.");
  };
  const pickBackground = async (file: File | undefined) => {
    if (!file) return;
    const body = new FormData(); body.append("file", file);
    try {
      const r = await fetch("/api/wall-layout", { method: "POST", body });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.path) { setBg(`${j.path}?v=${Date.now()}`); setMsg(`Background saved as public${j.path}. Press Save layout to keep it.`); return; }
      if (j?.reason && j.reason !== "read-only") { setMsg(j.reason); return; }
    } catch { /* preview only */ }
    setBg(URL.createObjectURL(file));
    setMsg("Preview only here. To keep it, add the image to the repo's public folder as wall-background.jpg (or .png) and run the site on your computer.");
  };
  const reset = () => { setPos(defaults); setHeight(defaultHeight); setSel(null); setMsg("Back to the eight piles. Nothing is saved until you press Save layout."); };

  const s = sel ? pos[sel] : null;
  const rugStyle: React.CSSProperties = bg
    ? { backgroundImage: `url("${bg}")`, backgroundSize: bgMode === "tile" ? "420px auto" : "cover", backgroundRepeat: bgMode === "tile" ? "repeat" : "no-repeat", backgroundPosition: "center" }
    : {};

  return (
    <>
      {canEdit && (
        <div className="walltools" role="toolbar" aria-label="Wall layout">
          {!editing ? (
            <button type="button" className="btn ghost" onClick={() => setEditing(true)}>Edit layout</button>
          ) : (
            <>
              <div className="tgroup">
                <span className="eyebrow">Selected</span>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { rot: pos[sel].rot - 5 })} aria-label="Tilt left">↺</button>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { rot: pos[sel].rot + 5 })} aria-label="Tilt right">↻</button>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { rot: 0 })}>Straighten</button>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { z: topZ() })}>To front</button>
                <button type="button" className="btn ghost" disabled={!s} onClick={() => sel && patch(sel, { z: bottomZ() })}>To back</button>
              </div>
              <div className="tgroup">
                <span className="eyebrow">Background</span>
                <label className="btn ghost filebtn">Choose image…<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { void pickBackground(e.target.files?.[0]); e.target.value = ""; }} /></label>
                <button type="button" className="btn ghost" disabled={!bg} onClick={() => setBgMode(bgMode === "cover" ? "tile" : "cover")}>{bgMode === "cover" ? "Tile it" : "Stretch it"}</button>
                <button type="button" className="btn ghost" disabled={!bg} onClick={() => setBg("")}>Use the rug</button>
              </div>
              <div className="tgroup">
                <span className="eyebrow">Rug length</span>
                <button type="button" className="btn ghost" onClick={() => setHeight((h) => Math.max(40, h - 10))} aria-label="Shorter">−</button>
                <button type="button" className="btn ghost" onClick={() => setHeight((h) => h + 10)} aria-label="Longer">+</button>
              </div>
              <div className="tgroup">
                <button type="button" className="btn" onClick={() => void save()}>Save layout</button>
                <button type="button" className="btn ghost" onClick={download}>Download file</button>
                <button type="button" className="btn ghost" onClick={reset}>Reset to piles</button>
                <button type="button" className="btn ghost" onClick={() => { setEditing(false); setSel(null); }}>Done</button>
              </div>
              <p className="thint">Drag anything to move it. Arrow keys nudge the selected item; [ and ] tilt it.</p>
            </>
          )}
          <p className="tmsg" role="status">{msg}</p>
        </div>
      )}

      <div className={`rug${editing ? " editing" : ""}`} style={rugStyle}>
        <div className="rugcanvas" ref={canvas} style={{ aspectRatio: `100 / ${height}` }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {items.map((it) => {
            const p = pos[it.id] ?? it;
            const style = { left: `${p.x}%`, top: `${(p.y / height) * 100}%`, zIndex: p.z + 100, ["--w" as string]: it.w, ["--r" as string]: `${p.rot}deg` } as React.CSSProperties;
            const common = { style, "data-id": it.id, onPointerDown: (e: React.PointerEvent) => down(e, it.id), onKeyDown: (e: React.KeyboardEvent) => key(e, it.id) };
            const cls = `item ${it.kind}${sel === it.id ? " sel" : ""}`;
            if (it.kind === "label") {
              return editing
                ? <div key={it.id} className={cls} tabIndex={0} {...common}><span>{it.text}</span><small>{it.count} notes</small></div>
                : <Link key={it.id} className={cls} href={`/domain/${it.domainId}`} title={`Open ${it.domainName}`} style={style}><span>{it.text}</span><small>{it.count} notes</small></Link>;
            }
            if (it.kind === "pola") {
              return (
                <div key={it.id} className={cls} tabIndex={editing ? 0 : -1} aria-hidden={!editing} {...common}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.src} alt="" loading="lazy" decoding="async" draggable={false} />
                </div>
              );
            }
            return (
              <button key={it.id} type="button" className={cls} aria-label={`Sticky note: ${it.text}`} onClick={() => { if (!editing) setOpen(it); }} {...common}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.src} alt="" width={it.iw} height={it.ih} loading="lazy" decoding="async" draggable={false} />
              </button>
            );
          })}
        </div>
      </div>

      <dialog className="notedlg" ref={dlg} onClose={() => setOpen(null)} onClick={(e) => { if (e.target === dlg.current) setOpen(null); }}>
        {open && (
          <div className="notebody">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.src} alt="" width={open.iw} height={open.ih} />
            <div className="noteinfo">
              <span className="eyebrow">{open.domainName}</span>
              <blockquote>“{open.text}”{open.uncertain && <span className="unc"> (handwriting partly uncertain)</span>}</blockquote>
              {open.themeLabel && <p className="th"><AI>{open.themeLabel}</AI></p>}
              {open.themeId ? (
                <Link className="ext" href={`/domain/${open.domainId}#theme-${open.themeId}`}>
                  {open.status === "covered" ? "See who's working on this →" : "Untapped so far. See the details →"}
                </Link>
              ) : (
                <Link className="ext" href={`/domain/${open.domainId}`}>See the rest of {open.domainName} →</Link>
              )}
              <button type="button" className="btn ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
