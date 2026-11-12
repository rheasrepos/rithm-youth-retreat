/** Row shapes: one interface per sheet tab. Column names are the header row, verbatim. */

export interface DomainRow { id: string; name: string; description: string; sort: string }
export interface ThemeRow { id: string; domain_id: string; label: string; sort: string }
export interface StickyRow {
  id: string; domain_id: string; theme_id: string;
  kind: "concern" | "working_on" | "other" | string;
  text: string; color: string; uncertain: string; show: string; photo: string; sort: string;
}
export interface OrgRow {
  id: string; name: string; url: string; blurb: string; domains: string;
  funder: string; retreat_note: string; status: string;
}
export interface PersonRow { name: string; org_id: string; org_name: string; note: string; status: string }
export interface ThemeOrgRow { theme_id: string; org_id: string; verdict: "verified" | "nearby" | string; note: string }
export interface EvidenceRow {
  id: string; org_id: string; title: string; what: string; url: string; year: string;
  themes: string; verified_on: string; submitted_by: string; status: string;
}
export interface LinkRow { a_theme: string; b_theme: string; label: string; note: string }
export interface WorkshopRow { who: string; what: string; target_id: string; note: string }
export interface SubmissionRow {
  timestamp: string; type: string; name: string; email: string; org: string; url: string;
  message: string; theme_id: string; sticky_id: string; status: string; reviewer_notes: string;
}

export interface Seed {
  domains: DomainRow[]; themes: ThemeRow[]; stickies: StickyRow[]; orgs: OrgRow[]; people: PersonRow[];
  theme_orgs: ThemeOrgRow[]; evidence: EvidenceRow[]; links: LinkRow[]; workshops: WorkshopRow[]; submissions: SubmissionRow[];
}

/* Derived model used by pages */
export interface Evidence { id: string; title: string; what: string; url: string; year: string; themes: string[]; verifiedOn: string }
export interface Org {
  id: string; name: string; url: string; blurb: string; domains: string[]; funder: boolean; retreatNote: string;
  people: { name: string; note: string }[];
  evidence: Evidence[];
  links: { themeId: string; verdict: "verified" | "nearby"; note: string }[];
}
export interface Sticky { id: string; text: string; color: string; uncertain: boolean; kind: string; photo: string }
export interface ThemeOrgLink { org: Org; verdict: "verified" | "nearby"; evidence?: Evidence; note: string }
export interface Theme {
  id: string; domainId: string; label: string; stickies: Sticky[]; orgs: ThemeOrgLink[];
  /** computed, never stored */
  status: "covered" | "nearby-only" | "untapped";
}
export interface Domain {
  id: string; name: string; description: string;
  themes: Theme[]; building: Sticky[]; other: Sticky[];
  stickyCount: number;
}
export interface Note { kind: "link" | "workshop"; title: string; body: string; targetId?: string; targetDomain?: string }
export interface Model {
  domains: Domain[];
  orgs: Org[];
  people: { name: string; org?: Org; orgName: string; note: string }[];
  themes: Record<string, Theme>;
  stickies: Record<string, Sticky>;
  orgById: Record<string, Org>;
  domainById: Record<string, Domain>;
  labelOf: (id: string) => string;
  domainOf: (id: string) => Domain | undefined;
  notesFor: (id: string) => Note[];
  untapped: { none: Theme[]; nearby: Theme[] };
  loadedFrom: "sheet" | "seed";
  loadedAt: string;
}
