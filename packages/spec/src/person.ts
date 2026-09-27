import type { CompanyVM, TextSegment, TimelineEventVM, TimelineVM } from "./models.js";
import type { PersonRolesShow, ViewComponent } from "./spec.js";

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
  /** Postnummer til bopælen. Gade og husnummer gemmes aldrig (se LassoPersonFacts). */
  zip?: string;
  /** Land, når bopælen ikke er i Danmark (fx "Sverige"). Udeladt for danske adresser. */
  country?: string;
  /** Adressebeskyttet i CVR: by, postnummer og kommune er da udeladt. */
  addressProtected?: boolean;
  /** CVR's enhedsnummer for personen (personer har ikke CVR-nummer). */
  unitNumber?: string;
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
  /**
   * Længste sammenhængende periode, de to har siddet sammen i mindst ét selskab, i hele år
   * (longestPeriodYears). Perioder i flere selskaber, der overlapper eller støder op til
   * hinanden, er én periode; et hul imellem bryder den. Aldrig summen på tværs af selskaber.
   */
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

/** Nøglerne (som i personCompanies) for de selskaber, der er gået konkurs eller tvangsopløst. */
function riskKeys(p: PersonVM): Set<string> {
  const r = personRisk(p);
  return new Set([...r.bankruptcies, ...r.dissolutions].map((c) => c.companyId ?? c.companyName.toLowerCase()));
}

/**
 * Fokus risiko: personens historik afgrænset til selskaberne med konkurs eller tvangsopløsning,
 * dvs. hvornår personen kom ind og ud, og hvornår det skete (LassoTimeline filter 'risiko').
 * Kun statushændelserne alene ville gentage risikoens sager 1:1; forløbet sætter dem i sammenhæng.
 */
export function riskTimeline(t: TimelineVM, p: PersonVM): TimelineVM {
  const keys = riskKeys(p);
  const hit = (s: TextSegment) => (s.lassoId ? keys.has(s.lassoId) : keys.has(s.text.toLowerCase()));
  return { ...t, events: t.events.filter((e) => e.titleSegments?.some(hit)) };
}

/* ---------- Rollelister (LassoPersonRoles show current, ended og owner) ---------- */

export interface PersonRoleRowVM {
  key: string;
  companyId?: string;
  companyName: string;
  /** Selskabets status, kun når det er ophørt, under konkurs o.l. (vises med ord i rødt). */
  companyStatus?: string;
  companyEnded?: string;
  /** Rækkens roller (kun dem, listen handler om). */
  roles: PersonRoleVM[];
  /** Rollerne som tekst, fx "Direktør, ejer 100 %" eller "Direktør 2010–2015, bestyrelsesmedlem 2012–2018". */
  text: string;
  /** "siden 2005", "2014–2018" eller "til 2018". */
  period: string;
}

const yearOf = (d?: string) => (d ? d.slice(0, 4) : "");
const span = (r: PersonRoleVM) => [yearOf(r.from), yearOf(r.to)].filter(Boolean).join("–");
const roleText = (r: PersonRoleVM) => `${r.role}${r.share ? ` ${r.share}` : ""}`;
/** "Direktør" + "Ejer 100 %" -> "Direktør, ejer 100 %" (forkortelser som "CEO" røres ikke). */
function joinRoles(texts: string[]): string {
  return texts.map((t, i) => (i === 0 ? t : roleInSentence(t))).join(", ");
}

/**
 * Rækkerne i personens rollelister, én pr. selskab: 'current' (de aktive roller), 'owner' (de
 * selskaber, personen ejer nu, legalt eller reelt) og 'ended' (de ophørte roller, senest ophørte
 * først). `except: "risiko"` udelader selskaber med konkurs eller tvangsopløsning (fokus risiko,
 * hvor de står i forløbet ved siden af).
 */
export function personRoleRows(p: PersonVM, show: Exclude<PersonRolesShow, "all">, opts: { except?: "risiko" } = {}): PersonRoleRowVM[] {
  const skip = opts.except === "risiko" ? riskKeys(p) : new Set<string>();
  const rows: PersonRoleRowVM[] = [];
  for (const c of personCompanies(p)) {
    if (skip.has(c.key)) continue;
    const roles =
      show === "ended"
        ? c.roles.filter((r) => !r.active).sort((a, b) => (b.to ?? "").localeCompare(a.to ?? ""))
        : c.roles.filter((r) => r.active && (show === "current" || r.kind === "owner"));
    if (roles.length === 0) continue;
    const status = c.companyStatusKind === "warning" || c.companyStatusKind === "inactive" ? (c.companyStatus ?? "Ophørt") : undefined;
    let text: string;
    let period: string;
    if (show === "ended") {
      const spans = new Set(roles.map(span));
      text = spans.size <= 1 ? joinRoles(roles.map(roleText)) : joinRoles(roles.map((r) => `${roleText(r)} ${span(r)}`.trim()));
      const last = roles.map((r) => r.to).filter((t): t is string => Boolean(t)).sort().at(-1);
      period = spans.size <= 1 ? [...spans][0] ?? "" : last ? `til ${yearOf(last)}` : "";
    } else {
      text = joinRoles(roles.map(roleText));
      const first = roles.map((r) => r.from).filter((f): f is string => Boolean(f)).sort()[0];
      period = first ? `siden ${yearOf(first)}` : "";
    }
    rows.push({ key: c.key, companyId: c.companyId, companyName: c.companyName, ...(status ? { companyStatus: status } : {}), ...(c.companyEnded ? { companyEnded: c.companyEnded } : {}), roles, text, period });
  }
  // Ophørte: senest ophørte først (selskaber uden slutdato til sidst).
  if (show === "ended") {
    const lastTo = (r: PersonRoleRowVM) => r.roles.map((x) => x.to ?? "").sort().at(-1) ?? "";
    rows.sort((a, b) => lastTo(b).localeCompare(lastTo(a)));
  }
  return rows;
}

/* ---------- Perioder: "år sammen" er den længste sammenhængende periode ---------- */

const DAY_MS = 86_400_000;
const YEAR_MS = 365.25 * DAY_MS;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);

export interface PeriodInput {
  from?: string;
  /** Udeladt = stadig i gang (regnes til i dag). */
  to?: string;
}

export interface MergedPeriod {
  from: string;
  /** Slutdato; i dag, når perioden stadig er i gang. */
  to: string;
  /** Mindst én af de sammenlagte perioder er stadig i gang. */
  open: boolean;
  /** Længden i dage. */
  days: number;
}

/**
 * Lægger perioder sammen, der overlapper eller støder op til hinanden (højst én dags
 * mellemrum, fx en rolle, der slutter 31.12, og en ny, der begynder 01.01). Et større hul
 * giver to perioder. Perioder uden startdato kan ikke placeres og springes over; `to`
 * udeladt = i dag. Resultatet står i tidsorden.
 */
export function mergePeriods(periods: readonly PeriodInput[], today = todayIso()): MergedPeriod[] {
  const now = Date.parse(today);
  const list = periods
    .map((p) => ({ from: p.from ? Date.parse(p.from) : Number.NaN, to: p.to ? Date.parse(p.to) : now, open: !p.to }))
    .filter((p) => Number.isFinite(p.from) && Number.isFinite(p.to) && p.to >= p.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: { from: number; to: number; open: boolean }[] = [];
  for (const p of list) {
    const last = merged.at(-1);
    if (last && p.from <= last.to + DAY_MS) {
      last.to = Math.max(last.to, p.to);
      last.open ||= p.open;
    } else merged.push({ ...p });
  }
  return merged.map((m) => ({ from: isoDay(m.from), to: isoDay(m.to), open: m.open, days: Math.round((m.to - m.from) / DAY_MS) }));
}

/** Den længste sammenhængende periode (se mergePeriods), eller undefined uden perioder. */
export function longestPeriod(periods: readonly PeriodInput[], today?: string): MergedPeriod | undefined {
  let best: MergedPeriod | undefined;
  for (const m of mergePeriods(periods, today)) if (!best || m.days > best.days) best = m;
  return best;
}

/** "År sammen": den længste sammenhængende periode i hele år (afrundet); 0 uden perioder. */
export function longestPeriodYears(periods: readonly PeriodInput[], today?: string): number {
  const best = longestPeriod(periods, today);
  return best ? Math.round((best.days * DAY_MS) / YEAR_MS) : 0;
}

/* ---------- Stamoplysninger (LassoPersonFacts) ---------- */

export interface PersonFacts extends PersonCounts {
  /** Selskaber, personen ejer nu (legalt eller reelt ejerskab, hvert selskab én gang). */
  ownedCompanies: number;
  /** Den tidligste registrerede rolles startdato. */
  firstRegistered?: string;
  /** Seneste rolleskift: den nyeste dato, personen indtrådte eller udtrådte. */
  latestChange?: string;
}

/**
 * Hvad personhovedet på samme side allerede viser (antal aktive og ophørte roller, ejerskaber og
 * første registrering); stamoplysningerne gentager det ikke 1:1 (samme regel i komponisten, i
 * LassoView og i tekstkortet).
 */
export function personFactOptions(page: readonly ViewComponent[], person: string): { hideCounts: boolean } {
  return { hideCounts: page.some((c) => c.type === "LassoPersonHead" && c.person === person) };
}

export function personFacts(p: PersonVM, today = todayIso()): PersonFacts {
  const froms = p.roles.map((r) => r.from).filter((d): d is string => Boolean(d)).sort();
  // En slutdato i fremtiden (varslet fratræden) er ikke sket endnu.
  const changes = p.roles
    .flatMap((r) => [r.from, r.to])
    .filter((d): d is string => typeof d === "string" && d.slice(0, 10) <= today)
    .sort();
  const owned = new Set(p.roles.filter((r) => r.active && r.kind === "owner").map((r) => r.companyId ?? r.companyName.toLowerCase()));
  return { ...personCounts(p), ownedCompanies: owned.size, firstRegistered: froms[0], latestChange: changes.at(-1) };
}

/* ---------- Historik (LassoTimeline med en person) ---------- */

/** Rolletekst midt i en sætning: "Adm. direktør" -> "adm. direktør"; forkortelser som "CEO" røres ikke. */
function roleInSentence(role: string): string {
  return /\b[A-ZÆØÅ]{2,}\b/.test(role) ? role : role.toLowerCase();
}

const ROLE_CATEGORY: Record<PersonRoleKind, string> = {
  direction: "Ledelse",
  board: "Ledelse",
  owner: "Ejerskab",
  founder: "Andre roller",
  other: "Andre roller",
};

function companySegments(before: string, c: { companyName: string; companyId?: string }, after = ""): TextSegment[] {
  const segments: TextSegment[] = [];
  if (before) segments.push({ text: before });
  segments.push(c.companyId ? { text: c.companyName, lassoId: c.companyId } : { text: c.companyName });
  if (after) segments.push({ text: after });
  return segments;
}

/**
 * Personens historik ud fra rollerne: indtrådt og udtrådt som X i et selskab (ejere: blev
 * ejer af / ophørt som ejer af), plus konkurser og tvangsopløsninger blandt selskaberne
 * (samme sager som personRisk). Selskabsnavnet står som segment med Lasso-ID, så det kan
 * åbnes. Nyeste først; begivenheder uden dato eller med en dato i fremtiden udelades.
 */
export function personTimeline(p: PersonVM, today = todayIso()): TimelineVM {
  const events: TimelineEventVM[] = [];
  const push = (date: string | undefined, segments: TextSegment[], category: string, detail?: string) => {
    if (!date || date.slice(0, 10) > today) return;
    events.push({ date: date.slice(0, 10), title: segments.map((s) => s.text).join(""), titleSegments: segments, category, ...(detail ? { detail } : {}) });
  };
  for (const r of p.roles) {
    const role = roleInSentence(r.role);
    const category = ROLE_CATEGORY[r.kind];
    if (r.kind === "owner") {
      push(r.from, companySegments(`Blev ${role} af `, r), category, r.share ? `Ejerandel ${r.share}` : undefined);
      push(r.to, companySegments(`Ophørt som ${role} af `, r), category);
    } else if (r.kind === "founder") {
      push(r.from, companySegments("Stiftede ", r), category);
    } else {
      push(r.from, companySegments(`Indtrådt som ${role} i `, r), category);
      push(r.to, companySegments(`Udtrådt som ${role} i `, r), category);
    }
  }
  const risk = personRisk(p);
  const status = (c: PersonRiskCaseVM, what: string) =>
    push(c.date, companySegments("", c, ` ${what}`), "Status", c.personLeft ? `Personen var udtrådt i ${c.personLeft.slice(0, 4)}` : "Personen havde stadig en rolle i selskabet");
  for (const c of risk.bankruptcies) status(c, /under konkurs/i.test(c.status) ? "kom under konkurs" : "gik konkurs");
  for (const c of risk.dissolutions) status(c, "blev tvangsopløst");
  // Nyeste først; samme dag står statusændringen øverst.
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : Number(b.category === "Status") - Number(a.category === "Status")));
  return { lassoId: p.lassoId, events };
}
