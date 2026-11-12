import type { Model } from "./types";

export interface SearchIndex {
  themes: { id: string; domainId: string; domainName: string; label: string; text: string; status: string }[];
  orgs: { id: string; name: string; body: string; themes: string; dom: string; ppl: string }[];
}

export function buildIndex(m: Model): SearchIndex {
  return {
    themes: Object.values(m.themes).map((t) => ({
      id: t.id, domainId: t.domainId, domainName: m.domainById[t.domainId]?.name ?? "", label: t.label,
      text: t.stickies.map((s) => s.text).join(" ").toLowerCase(), status: t.status,
    })),
    orgs: m.orgs.map((o) => ({
      id: o.id, name: o.name,
      body: (o.blurb + " " + o.evidence.map((e) => e.title + " " + e.what).join(" ")).toLowerCase(),
      themes: o.links.map((l) => m.labelOf(l.themeId)).join(" | ").toLowerCase(),
      dom: o.domains.map((d) => m.domainById[d]?.name ?? "").join(" ").toLowerCase(),
      ppl: o.people.map((p) => p.name + " " + p.note).join(" ").toLowerCase(),
    })),
  };
}

export const SYN: Record<string, string> = {
  lonely: "loneliness isolation isolating connection belonging alone", loneliness: "isolation connection belonging", isolation: "loneliness connection", isolated: "loneliness isolation",
  friend: "relationships friendship reaching", friends: "relationships friendship reaching", friendship: "relationships reaching",
  dating: "relationships romance dating gender", romance: "dating relationships", love: "dating relationships", gender: "dating gender",
  phone: "phones screens social media", phones: "screens social media", screen: "screens social media", screens: "social media phones", scrolling: "social media screens", instagram: "social media", tiktok: "social media",
  social: "social media community",
  therapy: "mental health emotional therapist", therapist: "therapy mental health", mental: "mental health wellbeing", anxiety: "mental health wellbeing", depression: "mental health", wellbeing: "mental health wellness", wellness: "mental health wellbeing",
  companion: "companion companions emotional", companions: "companion emotional", chatbot: "companion ai chatbots", chatbots: "companion ai chatbot", robot: "robots companion", robots: "companion",
  job: "jobs careers hiring", jobs: "careers hiring", career: "careers jobs", careers: "jobs", work: "careers jobs workplace", hiring: "jobs careers", internship: "careers jobs",
  college: "college university", university: "college", campus: "college",
  school: "schools education teachers students", teachers: "teachers schools", students: "students college schools", learning: "education schools",
  policy: "policy legislation advocacy", law: "policy legislation", laws: "policy legislation", legislation: "policy", government: "policy", congress: "policy federal", advocacy: "policy organizing", organizing: "advocacy organizing",
  art: "art creative", music: "art creative", film: "storytelling film media", writing: "storytelling writing poetry", poetry: "poem poetry voice", story: "storytelling stories", stories: "storytelling", storytelling: "stories story", media: "media news",
  nature: "nature outdoors", outdoors: "nature outdoors", parks: "nature third spaces",
  third: "third spaces", spaces: "third spaces", hangout: "third spaces", library: "third spaces",
  data: "data centers privacy", datacenter: "data centers infrastructure", datacenters: "data centers infrastructure", energy: "data centers infrastructure", climate: "data centers infrastructure", environment: "data centers infrastructure",
  safety: "ai safety trust", risk: "ai safety",
  privacy: "privacy consent", consent: "privacy",
  money: "funder grants", grant: "funder grants", grants: "funder", funding: "funder grants", fund: "funder grants", funder: "grants", funders: "funder",
  neighbors: "neighborhood local community", neighborhood: "neighbors local community", local: "neighborhood community",
  debate: "dialogue debate", dialogue: "debate listening", polarization: "dialogue",
  news: "news media literacy", misinformation: "news literacy media", deepfake: "news literacy media",
  power: "power concentration big tech", bigtech: "ai companies big tech",
  design: "product design design", product: "product design", startup: "startups entrepreneurship", startups: "entrepreneurship",
};
const STOP = new Set("i im i'm a an the and or of to in on for with about at by is are be my me we our want do work working care worried worry how what who into more less".split(" "));

export function terms(q: string) {
  const base = q.toLowerCase().replace(/[^a-z0-9&'\- ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
  const phrase = q.toLowerCase().trim();
  const ex = new Map<string, number>(); base.forEach((w) => ex.set(w, 1));
  base.forEach((w) => (SYN[w] || "").split(" ").forEach((s) => { if (s && !ex.has(s)) ex.set(s, 0.6); }));
  return { phrase, list: [...ex.entries()] };
}

export function runSearch(idx: SearchIndex, q: string) {
  const t = terms(q);
  const orgs = idx.orgs.map((o) => {
    let s = 0;
    if (t.phrase.length > 3 && (o.name.toLowerCase().includes(t.phrase) || o.themes.includes(t.phrase) || o.body.includes(t.phrase))) s += 6;
    for (const [w, wt] of t.list) {
      if (w.length < 3) continue;
      if (o.name.toLowerCase().includes(w)) s += 4 * wt;
      if (o.themes.includes(w)) s += 3 * wt;
      if (o.body.includes(w)) s += 2 * wt;
      if (o.ppl.includes(w)) s += 3 * wt;
      if (o.dom.includes(w)) s += 0.8 * wt;
    }
    return { o, s };
  }).filter((r) => r.s >= 1.5).sort((a, b) => b.s - a.s);
  const themes = idx.themes.map((th) => {
    const l = (th.label + " " + th.text).toLowerCase(); let s = 0;
    if (t.phrase.length > 3 && l.includes(t.phrase)) s += 5;
    t.list.forEach(([w, wt]) => { if (w.length >= 3 && l.includes(w)) s += 2 * wt; });
    return { th, s };
  }).filter((r) => r.s >= 1.2).sort((a, b) => b.s - a.s);
  return { orgs: orgs.slice(0, 18), themes: themes.slice(0, 8) };
}
