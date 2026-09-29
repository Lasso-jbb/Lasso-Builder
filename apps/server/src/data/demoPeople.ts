import {
  longestPeriodYears,
  roleKind,
  type CompanyVM,
  type NewsItemVM,
  type NewsVM,
  type OwnerVM,
  type PeriodInput,
  type PersonNetworkCompanyVM,
  type PersonNetworkRowVM,
  type PersonNetworkVM,
  type PersonRoleVM,
  type PersonRowVM,
  type PersonSearchRowVM,
  type PersonVM,
} from "@lasso/spec";
import { NotFoundError } from "./provider.js";

/**
 * Demopersoner (katalog 16), bygget ud fra demovirksomhedernes ledelse og ejere, så
 * personsiden og virksomhedssiderne fortæller samme historie. Alle navne indeholder
 * "Eksempel" eller "Prøve". Lasso-ID'erne ("CVR-3-40000000NN") findes ikke i CVR.
 */

export interface DemoPersonSource extends CompanyVM {
  people: PersonRowVM[];
  owners: OwnerVM[];
}

const TODAY = "2026-09-26";

/** Hvornår en demovirksomhed ophørte eller gik konkurs (til markøren i tidsbåndet). */
const ENDED: Record<string, string> = { "CVR-1-99000011": "2026-02-02", "CVR-1-99000009": "2023-12-31" };

/** Demopersoner med beskyttet adresse (stamoplysningerne viser "Adressebeskyttet"). */
const PROTECTED_ADDRESS = new Set(["Uffe Prøve"]);

/** Personnavne i fast rækkefølge, så ID'erne er stabile. */
function names(companies: readonly DemoPersonSource[]): string[] {
  const all = new Set<string>();
  for (const c of companies) {
    c.people.forEach((p) => all.add(p.name));
    c.owners.filter((o) => o.kind === "person").forEach((o) => all.add(o.name));
  }
  return [...all];
}

export function demoPersonIds(companies: readonly DemoPersonSource[]): Map<string, string> {
  return new Map(names(companies).map((n, i) => [n, `CVR-3-${4000000001 + i}`]));
}

function nameFor(companies: readonly DemoPersonSource[], id: string): string {
  for (const [name, pid] of demoPersonIds(companies)) if (pid === id) return name;
  throw new NotFoundError(`Personen ${id}`);
}

function companyRole(c: DemoPersonSource, patch: Partial<PersonRoleVM> & Pick<PersonRoleVM, "role" | "kind" | "active">): PersonRoleVM {
  return {
    companyId: c.lassoId,
    companyName: c.name,
    cvr: c.cvr,
    companyForm: c.form,
    companyStatus: c.status,
    companyStatusKind: c.statusKind,
    companyEnded: ENDED[c.lassoId],
    ...patch,
  };
}

/**
 * Katalog 16.4: eksempler på PEP-opslag, stråmandsindikator og sanktionslister (LiveProvider har intet
 * bekræftet endpoint). Bo Eksempel viser en mulig stråmandsindikator og ingen PEP-match; Anne Eksempel
 * alle opslag uden fund; resten "Ikke tjekket".
 */
const RISK_SIGNALS: Record<string, Pick<PersonVM, "pep" | "strawman" | "sanctions">> = {
  "Bo Eksempel": {
    pep: { match: false, checkedAt: "2026-09-25" },
    strawman: { level: "possible", detail: "Direktør eller bestyrelse i 3 selskaber uden ejerskab, heraf ét stiftet inden for 4 måneder (eksempel)." },
    sanctions: { available: false },
  },
  "Anne Eksempel": { pep: { match: false, checkedAt: "2026-09-25" }, strawman: { level: "none" }, sanctions: { available: false } },
};

export function demoPerson(companies: readonly DemoPersonSource[], id: string): PersonVM {
  const name = nameFor(companies, id);
  const roles: PersonRoleVM[] = [];
  // Bopælen er den første virksomheds by (kun postnummer, by og kommune; aldrig gaden).
  let home: CompanyVM["address"];
  for (const c of companies) {
    for (const p of c.people.filter((x) => x.name === name)) {
      roles.push(companyRole(c, { role: p.role, kind: roleKind(p.role), from: p.from, to: p.to, active: !p.to && c.statusKind !== "inactive" }));
      home ??= c.address;
    }
    for (const o of c.owners.filter((x) => x.kind === "person" && x.name === name)) {
      roles.push(companyRole(c, { role: "Ejer", kind: "owner", share: o.share?.replace(/(\d)-(\d)/, "$1–$2"), from: c.founded, to: c.statusKind === "inactive" ? ENDED[c.lassoId] : undefined, active: c.statusKind !== "inactive" }));
      home ??= c.address;
    }
  }
  const unitNumber = /^CVR-3-(\d+)$/.exec(id)?.[1];
  const signals = RISK_SIGNALS[name] ?? {};
  // Eksempelfødselsår (1950–1989) ud fra ID'et; kun året, aldrig fuld dato.
  const birthYear = unitNumber ? 1950 + (Number(unitNumber.slice(-3)) * 7) % 40 : undefined;
  if (PROTECTED_ADDRESS.has(name)) return { lassoId: id, name, addressProtected: true, unitNumber, roles, updated: "2026-09-12", ...signals };
  return { lassoId: id, name, city: home?.city, zip: home?.zip, municipality: home?.municipality, unitNumber, roles, updated: "2026-09-12", birthYear, ...signals };
}

const later = (a?: string, b?: string) => (!a ? b : !b ? a : a > b ? a : b);
const earlier = (a?: string, b?: string) => (!a ? b : !b ? a : a < b ? a : b);

export function demoPersonNetwork(companies: readonly DemoPersonSource[], id: string): PersonNetworkVM {
  const name = nameFor(companies, id);
  const ids = demoPersonIds(companies);
  // "År sammen" = længste sammenhængende periode på tværs af de fælles selskaber (longestPeriodYears).
  const byPerson = new Map<string, { companies: PersonNetworkCompanyVM[]; periods: PeriodInput[]; active: boolean }>();
  for (const c of companies) {
    const mine = c.people.filter((p) => p.name === name);
    if (mine.length === 0) continue;
    for (const other of c.people.filter((p) => p.name !== name)) {
      for (const own of mine) {
        const from = later(own.from, other.from);
        const to = earlier(own.to, other.to);
        if (!from || (to && to <= from)) continue;
        const entry = byPerson.get(other.name) ?? { companies: [], periods: [], active: false };
        entry.companies.push({ companyId: c.lassoId, companyName: c.name, role: other.role.toLowerCase(), from, to, status: c.status, statusKind: c.statusKind });
        entry.periods.push({ from, to });
        entry.active ||= !to;
        byPerson.set(other.name, entry);
      }
    }
  }
  const people: PersonNetworkRowVM[] = [...byPerson].map(([n, e]) => ({
    lassoId: ids.get(n),
    name: n,
    companies: e.companies,
    overlapYears: longestPeriodYears(e.periods, TODAY),
    since: e.companies.map((c) => c.from).filter((f): f is string => Boolean(f)).sort()[0],
    until: e.active ? undefined : e.companies.map((c) => c.to).filter((t): t is string => Boolean(t)).sort().at(-1),
    active: e.active,
  }));
  people.sort((a, b) => b.overlapYears - a.overlapYears || a.name.localeCompare(b.name, "da"));
  return { lassoId: id, people };
}

const NEWS_SINCE = "2021-01-01";
const organ = (role: string) => (roleKind(role) === "board" ? "bestyrelsen" : "direktionen");

/**
 * Eksempelnyheder om en demoperson i Lasso News' form: personens egne rolleskift siden 2021 og
 * skift i ledelsen af de selskaber, personen sidder i nu (sådan nævner Lasso News også de
 * siddende medlemmer), plus én medieomtale for personer med flere aktive roller. Personer uden
 * nyere skift har ingen nyheder, så personsiden viser, at sektionen så udelades.
 */
export function demoPersonNews(companies: readonly DemoPersonSource[], id: string, limit: number): NewsVM {
  const name = nameFor(companies, id);
  const ids = demoPersonIds(companies);
  const items: (NewsItemVM & { key: string })[] = [];
  const seen = new Set<string>();
  const add = (key: string, item: NewsItemVM) => {
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ ...item, key });
  };
  for (const c of companies) {
    const mine = c.people.filter((p) => p.name === name);
    const sitsNow = mine.some((p) => !p.to) && c.statusKind !== "inactive";
    for (const p of c.people) {
      if (p.name !== name && !sitsNow) continue;
      for (const [date, joined] of [[p.from, true], [p.to, false]] as const) {
        if (!date || date < NEWS_SINCE || date > TODAY) continue;
        const where = organ(p.role);
        const board = c.people.filter((x) => roleKind(x.role) === roleKind(p.role) && (!x.to || x.to > date) && (!x.from || x.from <= date));
        add(`${c.lassoId}|${p.name}|${date}`, {
          source: "Lasso",
          time: `${date}T07:00:00Z`,
          typeLabel: where === "bestyrelsen" ? "Bestyrelsesændring" : "Ledelsesændring",
          headline: `${p.name} ${joined ? "indtræder i" : "udtræder af"} ${where} for ${c.name} (eksempel)`,
          headlineSegments: [
            { text: p.name, lassoId: ids.get(p.name) },
            { text: ` ${joined ? "indtræder i" : "udtræder af"} ${where} for ` },
            { text: c.name, lassoId: c.lassoId },
            { text: " (eksempel)" },
          ],
          excerpt: board.length ? `I ${where} sidder nu ${board.map((x) => x.name).join(", ")}.` : undefined,
        });
      }
    }
  }
  const active = companies.filter((c) => c.statusKind !== "inactive" && c.people.some((p) => p.name === name && !p.to));
  if (active.length >= 2) {
    const c = active[0]!;
    add(`medie|${id}`, {
      source: "Prøve Medier",
      time: "2026-06-12T08:30:00Z",
      headline: `${name} om ${active.length} bestyrelses- og direktionsposter (eksempel)`,
      excerpt: `Eksempelartikel, hvor ${name} fortæller om arbejdet i blandt andet ${c.name}.`,
    });
  }
  items.sort((a, b) => ((a.time ?? "") < (b.time ?? "") ? 1 : (a.time ?? "") > (b.time ?? "") ? -1 : 0));
  const shown = items.slice(0, limit).map(({ key: _key, ...item }) => item);
  const sources = [...new Set(shown.map((i) => (i.source === "Lasso" ? "Lasso News" : i.source)))];
  return { lassoId: id, items: shown, ...(shown.length ? { sources, updatedAt: shown[0]!.time } : {}) };
}

export function demoFindPersons(companies: readonly DemoPersonSource[], query: string, limit: number): PersonSearchRowVM[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const ids = demoPersonIds(companies);
  return [...ids]
    .filter(([n]) => words.every((w) => n.toLowerCase().includes(w)))
    .slice(0, limit)
    .map(([n, lassoId]) => ({ lassoId, name: n, city: demoPerson(companies, lassoId).city }));
}
