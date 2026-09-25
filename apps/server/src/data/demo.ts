import {
  formatAmount,
  searchKey,
  type AuditorIndependenceVM,
  type AuditorRelationVM,
  type CompanyRowVM,
  type CompanyVM,
  type FinancialsVM,
  type ObservationRowVM,
  type ObservationsVM,
  type OwnershipVM,
  type PersonRowVM,
  type SearchQuery,
  type SearchResultVM,
} from "@lasso/spec";
import { applyCriteria, sortRows } from "./criteria-eval.js";
import { NotFoundError, type DataProvider } from "./provider.js";

/**
 * Opdigtede demodata, så UI og MCP-flow kan bygges og testes uden adgang til
 * Lassos API. Alle navne indeholder "Eksempel"/"Prøve", og CVR-numrene ligger
 * i et interval, der ikke findes i CVR. Bruges automatisk, når der ikke er
 * Lasso-credentials (LASSO_DATA_SOURCE=auto).
 */

interface DemoCompany extends CompanyVM {
  base: number;
  growth: number;
  people: PersonRowVM[];
  owners: OwnershipVM["owners"];
  auditor: string;
}

const P = (name: string, role: string, from: string, to?: string): PersonRowVM => ({ name, role, from, to });

const RAW: Omit<DemoCompany, "lassoId" | "statusKind">[] = [
  { cvr: "99000001", name: "Eksempel Byg A/S", status: "Aktiv", form: "A/S", industryCode: "412000", industryText: "Opførelse af bygninger", address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, founded: "1998-04-01", employees: 64, base: 38_000_000, growth: 0.07,
    people: [P("Anne Eksempel", "Direktør", "2015-01-01"), P("Bo Eksempel", "Bestyrelsesformand", "2012-05-01"), P("Carla Prøve", "Bestyrelsesmedlem", "2024-03-15"), P("Dan Prøve", "Bestyrelsesmedlem", "2016-06-01", "2024-03-15")],
    owners: [{ name: "Eksempel Holding ApS", share: "66,67-89,99 %", kind: "company", lassoId: "CVR-1-99000010" }, { name: "Anne Eksempel", share: "10-14,99 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000002", name: "Eksempel Revision Midt ApS", status: "Aktiv", form: "ApS", industryCode: "692000", industryText: "Revision og bogføring", address: { street: "Tællegade 12", zip: "8000", city: "Aarhus C", municipality: "Aarhus", region: "Midtjylland" }, founded: "2006-09-01", employees: 22, base: 14_500_000, growth: 0.05,
    people: [P("Erik Prøve", "Direktør", "2006-09-01"), P("Fie Eksempel", "Bestyrelsesformand", "2019-01-01")],
    owners: [{ name: "Erik Prøve", share: "50-66,66 %", kind: "person" }, { name: "Fie Eksempel", share: "33,34-49,99 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000003", name: "Eksempel Revision Nord ApS", status: "Aktiv", form: "ApS", industryCode: "692000", industryText: "Revision og bogføring", address: { street: "Bilagsvej 4", zip: "9000", city: "Aalborg", municipality: "Aalborg", region: "Nordjylland" }, founded: "2011-02-01", employees: 17, base: 11_200_000, growth: 0.03,
    people: [P("Gitte Prøve", "Direktør", "2011-02-01")], owners: [{ name: "Gitte Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000004", name: "Eksempel Transport A/S", status: "Aktiv", form: "A/S", industryCode: "494100", industryText: "Vejgodstransport", address: { street: "Lastvej 20", zip: "7100", city: "Vejle", municipality: "Vejle", region: "Syddanmark" }, founded: "1987-11-01", employees: 118, base: 52_000_000, growth: -0.02,
    people: [P("Hans Eksempel", "Direktør", "2020-08-01"), P("Ida Prøve", "Direktør", "2009-01-01", "2020-08-01"), P("Jens Eksempel", "Bestyrelsesformand", "2018-04-01")],
    owners: [{ name: "Eksempel Holding ApS", share: "100 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000005", name: "Eksempel Software ApS", status: "Aktiv", form: "ApS", industryCode: "620100", industryText: "Computerprogrammering", address: { street: "Kodevej 3", zip: "8200", city: "Aarhus N", municipality: "Aarhus", region: "Midtjylland" }, founded: "2017-03-01", employees: 41, base: 21_000_000, growth: 0.22,
    people: [P("Kim Prøve", "Direktør", "2017-03-01"), P("Lene Eksempel", "Bestyrelsesmedlem", "2023-10-01")], owners: [{ name: "Kim Prøve", share: "50-66,66 %", kind: "person" }, { name: "Lene Eksempel", share: "20-24,99 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000006", name: "Eksempel Tømrer ApS", status: "Aktiv", form: "ApS", industryCode: "433200", industryText: "Tømrer- og bygningssnedkervirksomhed", address: { street: "Høvlvej 8", zip: "8800", city: "Viborg", municipality: "Viborg", region: "Midtjylland" }, founded: "2009-06-01", employees: 12, base: 6_800_000, growth: 0.04,
    people: [P("Mads Eksempel", "Direktør", "2009-06-01")], owners: [{ name: "Mads Eksempel", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000007", name: "Eksempel Rådgivning A/S", status: "Aktiv", form: "A/S", industryCode: "702200", industryText: "Virksomhedsrådgivning", address: { street: "Strategistræde 2", zip: "1150", city: "København K", municipality: "København", region: "Hovedstaden" }, founded: "2002-01-01", employees: 35, base: 29_000_000, growth: 0.09,
    people: [P("Nina Prøve", "Direktør", "2021-01-01"), P("Ole Eksempel", "Bestyrelsesformand", "2002-01-01")], owners: [{ name: "Ole Eksempel", share: "90-100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000008", name: "Eksempel Maskinfabrik A/S", status: "Aktiv", form: "A/S", industryCode: "282900", industryText: "Fremstilling af maskiner", address: { street: "Smedevej 15", zip: "7400", city: "Herning", municipality: "Herning", region: "Midtjylland" }, founded: "1974-05-01", employees: 210, base: 96_000_000, growth: 0.01,
    people: [P("Per Eksempel", "Direktør", "2016-01-01"), P("Rikke Prøve", "Bestyrelsesformand", "2024-06-01"), P("Søren Eksempel", "Bestyrelsesformand", "2010-01-01", "2024-06-01")], owners: [{ name: "Eksempel Holding ApS", share: "50-66,66 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000009", name: "Eksempel Café I/S", status: "Ophørt", form: "I/S", industryCode: "563000", industryText: "Caféer og barer", address: { street: "Torvet 1", zip: "8660", city: "Skanderborg", municipality: "Skanderborg", region: "Midtjylland" }, founded: "2015-05-01", employees: 0, base: 1_200_000, growth: -0.3,
    people: [P("Tina Prøve", "Interessent", "2015-05-01", "2023-12-31")], owners: [{ name: "Tina Prøve", share: "50-66,66 %", kind: "person" }], auditor: "Ingen" },
  { cvr: "99000010", name: "Eksempel Holding ApS", status: "Aktiv", form: "ApS", industryCode: "642020", industryText: "Ikke-finansielle holdingselskaber", address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, founded: "2005-01-01", employees: 1, base: 3_000_000, growth: 0.1,
    people: [P("Bo Eksempel", "Direktør", "2005-01-01")], owners: [{ name: "Bo Eksempel", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000011", name: "Eksempel Energi A/S", status: "Under konkurs", form: "A/S", industryCode: "351100", industryText: "Produktion af elektricitet", address: { street: "Vindvej 9", zip: "6700", city: "Esbjerg", municipality: "Esbjerg", region: "Syddanmark" }, founded: "2012-08-01", employees: 8, base: 9_000_000, growth: -0.18,
    people: [P("Uffe Prøve", "Direktør", "2012-08-01")], owners: [{ name: "Uffe Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000012", name: "Eksempel Ejendomme ApS", status: "Aktiv", form: "ApS", industryCode: "682040", industryText: "Udlejning af erhvervsejendomme", address: { street: "Murervej 5", zip: "8700", city: "Horsens", municipality: "Horsens", region: "Midtjylland" }, founded: "2013-10-01", employees: 3, base: 7_500_000, growth: 0.06,
    people: [P("Vera Eksempel", "Direktør", "2013-10-01"), P("Bo Eksempel", "Bestyrelsesmedlem", "2013-10-01")], owners: [{ name: "Eksempel Holding ApS", share: "100 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Midt ApS" },
];

function statusKindOf(s: string | undefined): CompanyVM["statusKind"] {
  if (!s) return undefined;
  if (/konkurs|likvid/i.test(s)) return "warning";
  if (/ophørt/i.test(s)) return "inactive";
  return "active";
}

const COMPANIES: DemoCompany[] = RAW.map((c) => ({ ...c, lassoId: `CVR-1-${c.cvr}`, statusKind: statusKindOf(c.status) }));
const BY_ID = new Map(COMPANIES.map((c) => [c.lassoId, c]));

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

function financialsFor(c: DemoCompany): FinancialsVM {
  // Deterministisk "støj", så graferne ikke er helt glatte.
  const seed = Number(c.cvr!.slice(-2));
  return {
    lassoId: c.lassoId,
    currency: "DKK",
    years: YEARS.map((year, i) => {
      const wobble = 1 + (((seed * (i + 3)) % 7) - 3) / 100;
      const gross = Math.round(c.base * Math.pow(1 + c.growth, i) * wobble);
      return {
        year,
        periodEnd: `${year}-12-31`,
        revenue: Math.round(gross * 2.6),
        grossProfit: gross,
        profit: Math.round(gross * (0.08 + (seed % 5) / 100) * (c.growth < 0 ? -0.5 : 1)),
        equity: Math.round(gross * (0.4 + i * 0.05)),
        employees: Math.max(0, Math.round((c.employees ?? 0) * (1 - (YEARS.length - 1 - i) * c.growth * 0.5))),
      };
    }),
  };
}

function toRow(c: DemoCompany): CompanyRowVM {
  const f = financialsFor(c);
  const last = f.years.at(-1)!;
  return {
    lassoId: c.lassoId,
    cvr: c.cvr,
    name: c.name,
    city: c.address?.city,
    region: c.address?.region,
    industryText: c.industryText,
    status: c.status,
    statusKind: c.statusKind,
    employees: c.employees ?? null,
    revenue: last.revenue,
    grossProfit: last.grossProfit,
    profit: last.profit,
    trend: f.years.slice(-5).map((y) => y.grossProfit ?? 0),
  };
}

function strip(c: DemoCompany): CompanyVM {
  const { base: _b, growth: _g, people: _p, owners: _o, auditor: _a, ...vm } = c;
  return vm;
}

/** Eksempeldata til risikoobservationer (katalog 17). Afledt af de øvrige demofelter, så det følger med, hvis de ændres. */
function observationsFor(c: DemoCompany, f: FinancialsVM): ObservationsVM {
  // Én virksomhed viser bevidst den tomme, positive tilstand ("intet fundet").
  if (c.cvr === "99000012") {
    return { lassoId: c.lassoId, observations: [], checkedAt: "2026-09-25", sources: ["CVR", "regnskab", "ledelse"] };
  }
  const rows: ObservationRowVM[] = [];
  const last = f.years.at(-1);
  const prev = f.years.at(-2);
  if (/konkurs/i.test(c.status ?? "")) {
    rows.push({ id: "konkurs", severity: 100, title: "Virksomheden er under konkurs", detail: "Selskabet er registreret under konkursbehandling i CVR.", source: "CVR", date: last?.periodEnd });
  } else if (typeof last?.profit === "number" && typeof prev?.profit === "number" && last.profit < 0 && prev.profit < 0) {
    rows.push({
      id: "underskud",
      severity: 100,
      title: "Underskud to regnskabsår i træk",
      detail: `Årets resultat var ${formatAmount(prev.profit)} i ${prev.year} og ${formatAmount(last.profit)} i ${last.year}.`,
      source: "Regnskab",
      date: last.periodEnd,
    });
  } else if (c.growth < 0) {
    rows.push({ id: "fald", severity: 50, title: "Faldende bruttofortjeneste flere år i træk", detail: "Bruttofortjenesten er faldet i de seneste regnskabsår.", source: "Regnskab", date: last?.periodEnd });
  }
  if (c.auditor === "Ingen") {
    rows.push({ id: "revisor-fravalgt", severity: 50, title: "Revisor fravalgt", detail: "Selskabet har ikke registreret en revisor.", source: "CVR" });
  }
  const ended = c.people.find((p) => p.to);
  if (ended) rows.push({ id: "afgang", severity: 25, title: `${ended.name} er fratrådt som ${ended.role.toLowerCase()}`, source: "Ledelse", date: ended.to });
  const newest = [...c.people].filter((p) => !p.to).sort((a, b) => (b.from ?? "").localeCompare(a.from ?? ""))[0];
  if (newest) rows.push({ id: "tiltraadt", severity: 0, title: `Nyt medlem i ledelsen: ${newest.name}`, source: "Ledelse", date: newest.from });
  return { lassoId: c.lassoId, observations: rows, checkedAt: "2026-09-25", sources: ["CVR", "regnskab", "ledelse"] };
}

/** Eksempeldata til revisoruafhængighed (katalog 22). Kun den første demovirksomhed har relationer, så begge tilstande ses. */
function auditorIndependenceFor(c: DemoCompany): AuditorIndependenceVM {
  if (c.auditor === "Ingen") {
    return { lassoId: c.lassoId, checkedAt: "2026-09-25", relations: [], unavailableReason: "Virksomheden har ingen registreret revisor i demodata." };
  }
  const relations: AuditorRelationVM[] =
    c.lassoId === "CVR-1-99000001"
      ? [
          {
            id: "r1",
            assessment: 50,
            name: "Peter Revisor Eksempel",
            role: "Partner, Eksempel Revision Midt ApS",
            relation: "Bestyrelsesmedlem i et selskab hvor kundens ejer også sidder",
            via: "Eksempel Invest ApS",
            from: "2022-01-01",
          },
          {
            id: "r2",
            assessment: 0,
            name: "Eksempel Revision Midt ApS",
            role: "Revisionshus",
            relation: "Revisor for kundens ejer Eksempel Holding ApS",
            via: "Samme revisionshus",
            from: "2019-01-01",
          },
          {
            id: "r3",
            assessment: 0,
            name: "Lene Kontrol Eksempel",
            role: "Tidl. ansat, Eksempel Revision Midt ApS",
            relation: "Tidligere direktør i kundens datterselskab, ophørt for flere år siden",
            via: "Eksempel Data ApS",
            from: "2015-01-01",
            to: "2020-01-01",
          },
        ]
      : [];
  return {
    lassoId: c.lassoId,
    auditorName: c.auditor,
    checkedAt: "2026-09-25",
    relations,
    unavailableReason: relations.length ? undefined : "Der er ikke fundet kendte relationer mellem revisor, kunden og personer i demodata.",
  };
}

function get(lassoId: string): DemoCompany {
  const c = BY_ID.get(lassoId);
  if (!c) throw new NotFoundError(`Virksomheden ${lassoId} (demodata har kun CVR 99000001-99000012)`);
  return c;
}

export class DemoProvider implements DataProvider {
  readonly kind = "demo" as const;

  async search(q: SearchQuery): Promise<SearchResultVM> {
    const words = q.query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = COMPANIES.filter((c) => {
      if (words.length === 0) return true;
      const hay = [c.name, c.industryText, c.address?.city, c.address?.region, c.cvr].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const hasStatus = q.criteria.some((c) => c.field === "status");
    const rows = matches.map(toRow).filter((r) => hasStatus || r.statusKind !== "inactive");
    const filtered = applyCriteria(rows, q.criteria);
    const sorted = sortRows(filtered.rows, q.sort ?? { field: "bruttofortjeneste", direction: "desc" });
    return {
      key: searchKey(q),
      total: sorted.length,
      rows: sorted.slice(0, q.limit),
      unsupportedCriteria: filtered.unsupported.length ? filtered.unsupported : undefined,
    };
  }

  async findCompanies(name: string, limit: number) {
    const words = name.toLowerCase().split(/\s+/).filter(Boolean);
    return COMPANIES.filter((c) => words.every((w) => c.name.toLowerCase().includes(w))).map(toRow).slice(0, limit);
  }

  async company(lassoId: string) {
    return strip(get(lassoId));
  }

  async financials(lassoId: string) {
    return financialsFor(get(lassoId));
  }

  async people(lassoId: string) {
    return get(lassoId).people;
  }

  async ownership(lassoId: string): Promise<OwnershipVM> {
    const c = get(lassoId);
    const auditor = COMPANIES.find((x) => x.name === c.auditor);
    return {
      lassoId,
      owners: c.owners,
      auditor: c.auditor === "Ingen" ? undefined : { name: c.auditor, lassoId: auditor?.lassoId, from: "2019-01-01" },
    };
  }

  async observations(lassoId: string): Promise<ObservationsVM> {
    const c = get(lassoId);
    return observationsFor(c, financialsFor(c));
  }

  async auditorIndependence(lassoId: string): Promise<AuditorIndependenceVM> {
    return auditorIndependenceFor(get(lassoId));
  }
}
