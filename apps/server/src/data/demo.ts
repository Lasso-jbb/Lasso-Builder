import {
  searchKey,
  type CompanyRowVM,
  type CompanyVM,
  type FinancialsVM,
  type LivestockVM,
  type OwnershipVM,
  type PersonRowVM,
  type PropertiesVM,
  type ProductionUnitsVM,
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
  // Katalog 20: eneste demovirksomhed med et CHR-nummer, så LassoLivestock har eksempeldata (LiveProvider har intet bekræftet CHR-endpoint).
  { cvr: "99000013", name: "Eksempel Landbrug I/S", status: "Aktiv", form: "I/S", industryCode: "014700", industryText: "Avl af fjerkræ og svin", address: { street: "Gårdvej 3", zip: "7830", city: "Vinderup", municipality: "Holstebro", region: "Midtjylland" }, founded: "1985-01-01", employees: 5, base: 4_200_000, growth: 0.02,
    people: [P("William Prøve", "Direktør", "1985-01-01")], owners: [{ name: "William Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
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

function get(lassoId: string): DemoCompany {
  const c = BY_ID.get(lassoId);
  if (!c) throw new NotFoundError(`Virksomheden ${lassoId} (demodata har kun CVR 99000001-99000013)`);
  return c;
}

/** Katalog 20: Produktionsenheder ud over hovedenheden. Kun sat for virksomheder, hvor eksemplet skal vise flere P-numre. */
const PRODUCTION_UNITS: Record<string, ProductionUnitsVM["units"]> = {
  "CVR-1-99000001": [
    { pNumber: "1000000020", name: "Eksempel Byg A/S", address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, isMain: true, industryCode: "412000", industryText: "Opførelse af bygninger", employees: 64, status: "Aktiv", statusKind: "active", created: "1998-04-01" },
    { pNumber: "1000000021", name: "Eksempel Byg, Aarhus (eksempel)", address: { street: "Eksempelvej 12", zip: "8000", city: "Aarhus C", municipality: "Aarhus", region: "Midtjylland" }, industryCode: "412000", industryText: "Opførelse af bygninger", employees: 8, status: "Aktiv", statusKind: "active", created: "2015-03-01" },
    { pNumber: "1000000022", name: "Eksempel Byg, Lager (eksempel)", address: { street: "Eksempelvej 4", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, industryCode: "521000", industryText: "Oplagring", employees: null, status: "Ophørt", statusKind: "inactive", endedYear: 2023, created: "2010-01-01" },
  ],
};

/** Katalog 20: Ejendomme/BBR. Kun sat for ejendomsselskabet, så eksemplet har bygninger at vise. */
const PROPERTIES: Record<string, PropertiesVM["properties"]> = {
  "CVR-1-99000012": [
    {
      address: { street: "Murervej 5", zip: "8700", city: "Horsens", municipality: "Horsens", region: "Midtjylland" },
      matrikel: "Matr. 7b, Horsens Markjorder",
      bfeNumber: "100000123",
      propertyType: "Erhvervsejendom",
      ownership: "Ejer, tinglyst 2015",
      landAreaM2: 3200,
      builtAreaM2: 1450,
      publicValuation: { amount: 18_500_000, year: 2024 },
      encumbrances: 1,
      hasGeometry: false,
      buildings: [
        { number: 1, usage: "Kontor og administration", builtYear: 2001, floors: 2, areaM2: 900, units: 4 },
        { number: 2, usage: "Lager og produktion", builtYear: 2001, floors: 1, areaM2: 550, units: 1 },
      ],
    },
  ],
};

/** Katalog 20: CHR. Kun landbrugsvirksomheden har et CHR-nummer, som kataloget kræver for at vise blokken. */
const LIVESTOCK: Record<string, LivestockVM> = {
  "CVR-1-99000013": {
    lassoId: "CVR-1-99000013",
    chrNumber: "100001",
    ownerName: "Eksempel Landbrug I/S",
    updated: "2026-09-01",
    herds: [
      { species: "Svin", category: "slagtesvin", count: 4200, unit: "stipladser" },
      { species: "Svin", category: "søer", count: 380, unit: "dyr" },
      { species: "Kvæg", category: "malkekøer", count: 160, unit: "dyr" },
    ],
    healthStatus: "SPF",
    events: [
      { title: "Restriktion: flytteforbud ophævet", detail: "Svin", date: "2026-03-14", dateTo: "2026-04-02", severity: "active" },
      { title: "Velfærdskontrol: ingen anmærkninger", detail: "Kvæg", date: "2025-11-21", severity: "neutral" },
      { title: "Ny besætning registreret", detail: "Svin, søer", date: "2025-06-05", severity: "neutral" },
    ],
  },
};

function defaultUnit(c: DemoCompany): ProductionUnitsVM["units"][number] {
  return {
    pNumber: `10${c.cvr}`,
    name: c.name,
    address: c.address,
    isMain: true,
    industryCode: c.industryCode,
    industryText: c.industryText,
    employees: c.employees ?? null,
    status: c.status,
    statusKind: c.statusKind,
    created: c.founded,
  };
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

  async productionUnits(lassoId: string): Promise<ProductionUnitsVM> {
    const c = get(lassoId);
    return { lassoId, units: PRODUCTION_UNITS[lassoId] ?? [defaultUnit(c)] };
  }

  async properties(lassoId: string): Promise<PropertiesVM> {
    get(lassoId); // kaster NotFoundError for ukendte demo-CVR-numre
    return { lassoId, properties: PROPERTIES[lassoId] ?? [] };
  }

  async livestock(lassoId: string): Promise<LivestockVM> {
    get(lassoId);
    return LIVESTOCK[lassoId] ?? { lassoId, herds: [], events: [] };
  }
}
