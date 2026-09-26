import type { CompanyVM } from "./models.js";

/**
 * Personsiden (katalog 16). Én person på tværs af alle selskaber: hoved, roller over tid,
 * netværk og risiko. Serveren oversætter Lassos personsvar (GET /{lassoId} og
 * /{lassoId}/history for et "CVR-3-…"-ID) og netværket (GET /modules/network/{lassoId})
 * til disse former; se docs/lasso-endpoints.md.
 */

export type PersonRoleKind = "direction" | "board" | "owner" | "founder" | "other";

export interface PersonRoleVM {
  companyId?: string;
  companyName: string;
  cvr?: string;
  companyForm?: string;
  companyStatus?: string;
  companyStatusKind?: CompanyVM["statusKind"];
  /** Dato, hvor selskabet ophørte eller gik konkurs, hvis kendt. */
  companyEnded?: string;
  kind: PersonRoleKind;
  /** Rollen som tekst, fx "Adm. direktør", "Bestyrelsesmedlem", "Ejer". */
  role: string;
  /** Ejerandel for ejerroller, fx "10–14,99 %". */
  share?: string;
  from?: string;
  to?: string;
  active: boolean;
}

export interface PersonVM {
  lassoId: string;
  name: string;
  city?: string;
  municipality?: string;
  roles: PersonRoleVM[];
  /** Hvornår Lasso sidst opdaterede personen (kildelinjen). */
  updated?: string;
}

export interface PersonNetworkCompanyVM {
  companyId?: string;
  companyName: string;
  /** Den andens rolle i selskabet, fx "bestyrelse". */
  role?: string;
  from?: string;
  to?: string;
  status?: string;
  statusKind?: CompanyVM["statusKind"];
}

export interface PersonNetworkRowVM {
  lassoId?: string;
  name: string;
  companies: PersonNetworkCompanyVM[];
  /** Samlet tid i fælles selskaber, i hele år. */
  overlapYears: number;
  since?: string;
  until?: string;
  /** Sidder de stadig sammen i mindst ét selskab. */
  active: boolean;
}

export interface PersonNetworkVM {
  lassoId: string;
  people: PersonNetworkRowVM[];
}

/** Søgerække ved opslag på navn. */
export interface PersonSearchRowVM {
  lassoId: string;
  name: string;
  city?: string;
}

/** Personers Lasso-ID'er: "CVR-3-…" (CVR-deltagere) eller "CVR-4-…". */
export function isPersonId(id: string | undefined): id is string {
  return typeof id === "string" && /^CVR-[34]-\d+$/i.test(id.trim());
}

/** Rolletype ud fra CVR's rolletekst (og evt. gruppen, rollen kom fra). */
export function roleKind(role: string, group?: string): PersonRoleKind {
  const g = (group ?? "").toLowerCase();
  const r = role.toLowerCase();
  if (/owner|ejer|register/.test(g) || /\bejer|owner|reel/.test(r)) return "owner";
  if (/board|bestyrelse/.test(g) || /bestyrelse|formand|suppleant|board/.test(r)) return "board";
  if (/management|direktion|ledelse/.test(g) || /direkt|ceo|adm\./.test(r)) return "direction";
  if (/founder|stift/.test(g) || /stift/.test(r)) return "founder";
  return "other";
}

export const ROLE_KIND_LABELS: Record<PersonRoleKind, string> = {
  direction: "Direktion",
  board: "Bestyrelse",
  owner: "Ejer",
  founder: "Stifter",
  other: "Anden rolle",
};

export interface PersonCompanyVM {
  key: string;
  companyId?: string;
  companyName: string;
  companyStatus?: string;
  companyStatusKind?: CompanyVM["statusKind"];
  companyEnded?: string;
  roles: PersonRoleVM[];
  active: boolean;
  firstFrom?: string;
}

/** Rollerne samlet pr. selskab: aktive selskaber først, derefter ældste rolle først. */
export function personCompanies(p: PersonVM): PersonCompanyVM[] {
  const map = new Map<string, PersonCompanyVM>();
  for (const r of p.roles) {
    const key = r.companyId ?? r.companyName.toLowerCase();
    let c = map.get(key);
    if (!c) {
      c = { key, companyId: r.companyId, companyName: r.companyName, companyStatus: r.companyStatus, companyStatusKind: r.companyStatusKind, companyEnded: r.companyEnded, roles: [], active: false };
      map.set(key, c);
    }
    c.roles.push(r);
    c.active ||= r.active;
    if (r.from && (!c.firstFrom || r.from < c.firstFrom)) c.firstFrom = r.from;
  }
  const order: Record<PersonRoleKind, number> = { direction: 0, board: 1, other: 2, founder: 3, owner: 4 };
  for (const c of map.values()) c.roles.sort((a, b) => Number(b.active) - Number(a.active) || order[a.kind] - order[b.kind]);
  return [...map.values()].sort(
    (a, b) => Number(b.active) - Number(a.active) || (a.firstFrom ?? "9999").localeCompare(b.firstFrom ?? "9999") || a.companyName.localeCompare(b.companyName, "da"),
  );
}

export interface PersonCounts {
  activeRoles: number;
  endedRoles: number;
  activeCompanies: number;
  companies: number;
  /** År for den første registrerede rolle. */
  firstYear?: number;
}

export function personCounts(p: PersonVM): PersonCounts {
  const companies = personCompanies(p);
  const firstFrom = p.roles.map((r) => r.from).filter((f): f is string => Boolean(f)).sort()[0];
  return {
    activeRoles: p.roles.filter((r) => r.active).length,
    endedRoles: p.roles.filter((r) => !r.active).length,
    activeCompanies: companies.filter((c) => c.active).length,
    companies: companies.length,
    firstYear: firstFrom ? Number(firstFrom.slice(0, 4)) : undefined,
  };
}

export interface PersonRiskCaseVM {
  companyId?: string;
  companyName: string;
  status: string;
  /** Hvornår selskabet gik konkurs eller blev opløst, hvis kendt. */
  date?: string;
  /** Hvornår personen forlod selskabet; udeladt, hvis personen stadig har en rolle. */
  personLeft?: string;
  /** Hele år mellem personens fratræden og hændelsen. */
  yearsBefore?: number;
  /** Personen havde en rolle ved hændelsen eller højst et år før. */
  involved: boolean;
}

export interface PersonRiskVM {
  bankruptcies: PersonRiskCaseVM[];
  dissolutions: PersonRiskCaseVM[];
}

const yearsBetween = (a: string, b: string) => Math.floor((Date.parse(b) - Date.parse(a)) / (365.25 * 86_400_000));

/**
 * Konkurser og tvangsopløsninger blandt de selskaber, personen har eller har haft en rolle i.
 * Kun ud fra selskabernes CVR-status; der er ingen dom om personen.
 */
export function personRisk(p: PersonVM): PersonRiskVM {
  const out: PersonRiskVM = { bankruptcies: [], dissolutions: [] };
  for (const c of personCompanies(p)) {
    const status = c.companyStatus ?? "";
    const bankrupt = /konkurs|bankrupt/i.test(status);
    const forced = /tvangs|compulsory/i.test(status);
    if (!bankrupt && !forced) continue;
    const lefts = c.roles.map((r) => r.to).filter((t): t is string => Boolean(t)).sort();
    const personLeft = c.active ? undefined : lefts.at(-1);
    const date = c.companyEnded;
    const yearsBefore = personLeft && date ? Math.max(0, yearsBetween(personLeft, date)) : undefined;
    const involved = c.active || (personLeft !== undefined && date !== undefined && yearsBetween(personLeft, date) < 1);
    const item: PersonRiskCaseVM = { companyId: c.companyId, companyName: c.companyName, status, date, personLeft, yearsBefore, involved };
    (bankrupt ? out.bankruptcies : out.dissolutions).push(item);
  }
  return out;
}
