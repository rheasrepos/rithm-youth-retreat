import { cache } from "react";
import seedJson from "@/data/seed.json";
import { readSheet, sheetsConfigured } from "./sheets";
import type { Domain, Evidence, Model, Note, Org, Seed, Sticky, Theme, ThemeOrgLink } from "./types";

const truthy = (v: string | undefined) => /^(true|yes|1|y)$/i.test(String(v ?? "").trim());
const active = (s: string | undefined) => !s || /^(active|approved|)$/i.test(s.trim());
const num = (v: string | undefined) => { const n = parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : 0; };
const list = (v: string | undefined) => String(v ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);

/** Turns raw sheet rows into the structures the pages render. Status fields are computed here, never stored. */
export function buildModel(seed: Seed, loadedFrom: Model["loadedFrom"]): Model {
  const stickies: Record<string, Sticky> = {};
  seed.stickies
    .filter((s) => truthy(s.show))
    .forEach((s) => { stickies[s.id] = { id: s.id, text: s.text, color: s.color.toLowerCase(), uncertain: truthy(s.uncertain), kind: s.kind, photo: s.photo }; });
  const stickyRows = seed.stickies.filter((s) => stickies[s.id]).sort((a, b) => num(a.sort) - num(b.sort));

  const orgRows = seed.orgs.filter((o) => active(o.status));
  const orgById: Record<string, Org> = {};
  orgRows.forEach((o) => {
    orgById[o.id] = {
      id: o.id, name: o.name, url: o.url, blurb: o.blurb, domains: list(o.domains), funder: truthy(o.funder),
      retreatNote: o.retreat_note, people: [], evidence: [], links: [],
    };
  });
  seed.people.filter((p) => active(p.status) && p.org_id && orgById[p.org_id]).forEach((p) => orgById[p.org_id].people.push({ name: p.name, note: p.note }));
  seed.evidence.filter((e) => active(e.status) && orgById[e.org_id]).forEach((e) => {
    orgById[e.org_id].evidence.push({ id: e.id, title: e.title, what: e.what, url: e.url, year: e.year, themes: list(e.themes), verifiedOn: e.verified_on });
  });

  const themes: Record<string, Theme> = {};
  const domains: Domain[] = seed.domains
    .slice().sort((a, b) => num(a.sort) - num(b.sort))
    .map((d) => ({ id: d.id, name: d.name, description: d.description, themes: [], building: [], other: [], stickyCount: 0 }));
  const domainById: Record<string, Domain> = Object.fromEntries(domains.map((d) => [d.id, d]));

  seed.themes.slice().sort((a, b) => num(a.sort) - num(b.sort)).forEach((t) => {
    const d = domainById[t.domain_id]; if (!d) return;
    const theme: Theme = { id: t.id, domainId: t.domain_id, label: t.label, stickies: [], orgs: [], status: "untapped" };
    themes[t.id] = theme; d.themes.push(theme);
  });
  stickyRows.forEach((s) => {
    const d = domainById[s.domain_id]; if (!d) return;
    const st = stickies[s.id]; d.stickyCount++;
    if (s.theme_id && themes[s.theme_id]) themes[s.theme_id].stickies.push(st);
    else if (s.kind === "working_on") d.building.push(st);
    else d.other.push(st);
  });
  seed.theme_orgs.forEach((l) => {
    const t = themes[l.theme_id], o = orgById[l.org_id]; if (!t || !o) return;
    const verdict: ThemeOrgLink["verdict"] = /^(verified|supported|s)$/i.test(l.verdict) ? "verified" : "nearby";
    const evidence: Evidence | undefined = o.evidence.find((e) => e.themes.includes(t.id)) ?? o.evidence[0];
    t.orgs.push({ org: o, verdict, evidence, note: l.note });
    o.links.push({ themeId: t.id, verdict, note: l.note });
  });
  Object.values(themes).forEach((t) => {
    t.orgs.sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === "verified" ? -1 : 1));
    const verified = t.orgs.filter((x) => x.verdict === "verified").length;
    t.status = verified ? "covered" : t.orgs.length ? "nearby-only" : "untapped";
  });

  const labelOf = (id: string) => themes[id]?.label ?? stickies[id]?.text ?? id;
  const domainOf = (id: string) => (themes[id] ? domainById[themes[id].domainId] : stickyRows.find((s) => s.id === id) ? domainById[stickyRows.find((s) => s.id === id)!.domain_id] : undefined);
  const notesFor = (id: string): Note[] => {
    const out: Note[] = [];
    seed.links.filter((l) => l.a_theme === id || l.b_theme === id).forEach((l) => {
      const other = l.a_theme === id ? l.b_theme : l.a_theme;
      out.push({ kind: "link", title: `Connects to ${labelOf(other)}`, body: l.note, targetId: other, targetDomain: domainOf(other)?.name });
    });
    const byWho = new Map<string, { what: string; note: string }>();
    seed.workshops.filter((w) => w.target_id === id).forEach((w) => byWho.set(w.who, { what: w.what, note: w.note }));
    byWho.forEach((v, who) => out.push({ kind: "workshop", title: `Came up in ${who}'s ${v.what}`, body: v.note }));
    return out;
  };

  const orgs = Object.values(orgById).sort((a, b) => a.name.localeCompare(b.name));
  const people = seed.people.filter((p) => active(p.status)).map((p) => ({ name: p.name, org: orgById[p.org_id], orgName: p.org_name || orgById[p.org_id]?.name || "", note: p.note }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const all = Object.values(themes);
  return {
    domains, orgs, people, themes, stickies, orgById, domainById, labelOf, domainOf, notesFor,
    untapped: { none: all.filter((t) => t.status === "untapped"), nearby: all.filter((t) => t.status === "nearby-only") },
    loadedFrom, loadedAt: new Date().toISOString(),
  };
}

/** One model per request (React cache); the underlying fetch is cached for an hour and purged nightly. */
export const getModel = cache(async (): Promise<Model> => {
  if (sheetsConfigured()) {
    try { return buildModel(await readSheet(), "sheet"); }
    catch (err) { console.error("Sheet read failed, using seed:", err); }
  }
  return buildModel(seedJson as unknown as Seed, "seed");
});
