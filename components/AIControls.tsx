"use client";
import { useEffect, useState } from "react";

/** Fades AI-marked text in the first time it scrolls into view, and lets visitors blur it all (remembered in this browser). */
export function AIControls() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem("aiHidden") === "1"); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("hide-ai", hidden);
    try { localStorage.setItem("aiHidden", hidden ? "1" : "0"); } catch { /* storage blocked */ }
  }, [hidden]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    // Watch each text's parent, not the text: the hidden text is clipped to nothing (for the type-on reveal), and Chrome then
    // never reports it as on screen, so text below the fold stayed invisible.
    const waiting = new Map<Element, Element[]>();
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      (waiting.get(e.target) ?? []).forEach((el) => el.classList.add("ai-in"));
      waiting.delete(e.target); io.unobserve(e.target);
    }), { threshold: 0 });
    const seen = new WeakSet<Element>();
    const scan = () => document.querySelectorAll(".ai-generated:not(.ai-in), .ai-figure:not(.ai-in)").forEach((el) => {
      if (seen.has(el)) return; seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) { el.classList.add("ai-in"); return; }   // already on screen: no flash
      el.classList.add("ai-wait");
      const box = el.parentElement ?? el;
      const list = waiting.get(box); if (list) list.push(el); else { waiting.set(box, [el]); io.observe(box); }
    });
    scan();
    const mo = new MutationObserver(scan); mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);
  return (
    <button type="button" className="aichip" aria-pressed={hidden} onClick={() => setHidden((h) => !h)}>
      <span className="ai-generated">AI-drafted</span> text: {hidden ? "blurred. Show it" : "shown. Blur it"}
    </button>
  );
}
