import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adaptBeneficialOwnership,
  adaptCompany,
  adaptFinancials,
  adaptNews,
  adaptOwnership,
  adaptPeople,
  adaptSearch,
  adaptTextSections,
  adaptTimeline,
  regionFromZip,
  statusKind,
  adaptObservations,
  adaptLivestock,
  adaptProductionUnits,
  adaptProperties,
  ejfBbrRefs,
  mergeBbr,
  adaptOwnershipGraph,
  graphFromOwnership,
  shareRange,
} from "./adapters.js";

test("adaptCompany tåler forskellige feltnavne", () => {
  const vm = adaptCompany("CVR-1-11111111", {
    Name: "Test A/S",
    cvrNumber: 11111111,
    companyStatus: "Normal",
    address: { streetName: "Vej", houseNumber: "2", zipCode: "8000", cityName: "Aarhus C" },
    industry: { code: "692000", text: "Revision" },
  });
  assert.equal(vm.name, "Test A/S");
  assert.equal(vm.cvr, "11111111");
  assert.equal(vm.statusKind, "active");
  assert.equal(vm.address?.street, "Vej 2");
  assert.equal(vm.industryText, "Revision");
});

test("adaptFinancials finder år og nøgletal og sorterer stigende", () => {
  const vm = adaptFinancials("x", {
    reports: [
      { period: { end: "2023-12-31" }, figures: { grossProfit: 200, profitLoss: 20 } },
      { fiscalYear: 2022, grossProfit: 150, netResult: 10 },
    ],
  });
  assert.deepEqual(vm.years.map((y) => y.year), [2022, 2023]);
  assert.equal(vm.years[1]!.grossProfit, 200);
  assert.equal(vm.years[1]!.profit, 20);
});

test("adaptSearch springer personer over", () => {
  const { rows } = adaptSearch({ results: [{ lassoId: "CVR-1-1", name: "Firma" }, { lassoId: "CVR-3-2", name: "Person", type: "person" }] }, "CVR-1-");
  assert.deepEqual(rows.map((r) => r.name), ["Firma"]);
});

test("statusKind", () => {
  assert.equal(statusKind("Under konkurs"), "warning");
  assert.equal(statusKind("Ophørt"), "inactive");
});

test("adaptProductionUnits finder hovedenheden og sorterer den først (katalog 20, UBEKRÆFTET form)", () => {
  const vm = adaptProductionUnits("CVR-1-1", {
    mainUnit: { pNumber: "1000000020", name: "Firma A/S", status: "Normal" },
    productionUnits: [
      { pNumber: "1000000021", name: "Filial", employees: { count: 4 }, status: "Normal" },
      { pNumber: "1000000022", name: "Lager", status: "Ophørt", validTo: "2024-06-01" },
    ],
  });
  assert.equal(vm.units.length, 3);
  assert.equal(vm.units[0]!.pNumber, "1000000020");
  assert.equal(vm.units[0]!.isMain, true);
  assert.equal(vm.units[1]!.employees, 4);
  assert.equal(vm.units[2]!.endedYear, 2024);
  assert.equal(vm.units[2]!.statusKind, "inactive");
});

test("adaptProductionUnits tåler et svar uden produktionsenheder", () => {
  const vm = adaptProductionUnits("CVR-1-1", { name: "Firma A/S" });
  assert.deepEqual(vm.units, []);
});

test("adaptProperties og mergeBbr samler ejendom og bygninger (UBEKRÆFTET form)", () => {
  const ejf = [
    {
      property: { address1: "Vej 1", postalCode: "8000", city: "Aarhus C", bfeNumber: "123", propertyNumber: "79972", municipalityCode: "751" },
      ownershipType: "Ejer",
      from: "2019-06-01",
    },
  ];
  const base = adaptProperties("CVR-1-1", ejf);
  assert.equal(base.properties.length, 1);
  assert.equal(base.properties[0]!.bfeNumber, "123");
  assert.equal(base.properties[0]!.ownership, "Ejer, tinglyst 2019");

  const refs = ejfBbrRefs(ejf);
  assert.deepEqual(refs, [{ bfeNumber: "123" }]);

  const merged = mergeBbr(base.properties[0]!, {
    buildings: [{ buildingNumber: 1, usageText: "Kontor", builtYear: 1998, floors: 3, totalArea: 1860, unitCount: 6 }],
    builtUpArea: 1860,
  });
  assert.equal(merged.buildings.length, 1);
  assert.equal(merged.buildings[0]!.areaM2, 1860);
  assert.equal(merged.builtAreaM2, 1860);
});

test("adaptLivestock læser besætninger og hændelser (UBEKRÆFTET endpoint)", () => {
  const vm = adaptLivestock("CVR-1-1", {
    chrNumber: "100001",
    herds: [{ species: "Svin", category: "slagtesvin", capacity: 4200 }],
    events: [{ title: "Restriktion", type: "restriktion", date: "2026-03-14" }],
  });
  assert.equal(vm.chrNumber, "100001");
  assert.equal(vm.herds[0]!.count, 4200);
  assert.equal(vm.herds[0]!.unit, "stipladser");
  assert.equal(vm.events[0]!.severity, "active");
});

test("adaptSearch læser Lassos rigtige søgesvar (companies.results)", () => {
  const { rows, total } = adaptSearch(
    {
      companies: {
        results: [{ lassoId: "CVR-1-11111111", name: "Lasso X A/S", status: "Normal", entityType: "Company", address1: "Vej 1", postalCode: 1000, city: "København K", country: "DK", score: 1 }],
        resultsFound: 42,
        resultsReturned: 1,
      },
      people: { results: [{ lassoId: "CVR-4-1", name: "Person", entityType: "Person" }] },
    },
    "CVR-1-",
  );
  assert.equal(total, 42);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.name, "Lasso X A/S");
  assert.equal(rows[0]!.city, "København K");
  assert.equal(rows[0]!.statusKind, "active");
});

// Struktur bekræftet mod api.lassox.com/{lassoId} 24.09.2026 (værdier opdigtede).
const REAL_COMPANY = {
  lassoId: "CVR-1-11111111",
  cvr: 11111111,
  name: "Test ApS",
  status: "Normal",
  lifeTime: { from: "2022-11-01T00:00:00", to: null },
  email: "info@test.dk",
  creationDate: "2022-11-01T00:00:00",
  address: { address1: "Testvej 1", postalCode: 8000, postalDistrict: "Aarhus C", cityName: null, municipality: { name: "Aarhus", code: 751 }, countryCode: "DK" },
  form: { code: 80, shortDescription: "ApS", longDescription: "Anpartsselskab" },
  industry: { text: "Computerprogrammering", code: "620100" },
  employees: null,
  accounting: { accountant: null, optedOut: true },
  stakeholders: [
    { name: "Anne Test", type: "Person", lassoId: "CVR-3-1", role: { mainType: "DIREKTION", type: "direktør", originalType: "DIREKTØR" }, from: "2022-11-01T00:00:00" },
    { name: "Holding ApS", type: "Company", lassoId: "CVR-1-22222222", role: { mainType: "EJER", type: "legal ejer", originalType: "EJER" }, from: "2022-11-01T00:00:00" },
  ],
  management: { ceo: null, members: [] },
  board: { chairman: null, members: [], alternates: [] },
  ownership: { hasOwnersUnderFivePercent: false, owners: [{ ownership: null, voteRights: null, name: "Holding ApS", type: "Company", lassoId: "CVR-1-22222222", unitNumber: 1 }] },
};

test("adaptCompany læser Lassos rigtige virksomhedssvar", () => {
  const vm = adaptCompany("CVR-1-11111111", REAL_COMPANY);
  assert.equal(vm.cvr, "11111111");
  assert.equal(vm.form, "ApS");
  assert.equal(vm.industryText, "Computerprogrammering");
  assert.equal(vm.industryCode, "620100");
  assert.equal(vm.address?.street, "Testvej 1");
  assert.equal(vm.address?.city, "Aarhus C");
  assert.equal(vm.address?.municipality, "Aarhus");
  assert.equal(vm.address?.region, "Midtjylland");
  assert.equal(vm.founded, "2022-11-01");
});

test("adaptPeople tager stakeholders og udelader ejere", () => {
  const people = adaptPeople(REAL_COMPANY);
  assert.deepEqual(people.map((p) => [p.name, p.role]), [["Anne Test", "Direktør"]]);
  assert.equal(people[0]!.from, "2022-11-01");
});

test("adaptOwnership læser ownership.owners", () => {
  const o = adaptOwnership("CVR-1-11111111", REAL_COMPANY);
  assert.equal(o.owners.length, 1);
  assert.equal(o.owners[0]!.name, "Holding ApS");
  assert.equal(o.owners[0]!.kind, "company");
});

test("regionFromZip", () => {
  assert.equal(regionFromZip(2100), "Hovedstaden");
  assert.equal(regionFromZip(8600), "Midtjylland");
  assert.equal(regionFromZip(7400), "Midtjylland");
  assert.equal(regionFromZip(7100), "Syddanmark");
  assert.equal(regionFromZip(9000), "Nordjylland");
  assert.equal(regionFromZip(4000), "Sjælland");
});

test("adaptOwnership viser Lassos brøk-intervaller som procent og stemmeandel", () => {
  const o = adaptOwnership("CVR-1-24256790", {
    ownership: {
      owners: [
        { ownership: { from: 0.25, to: 0.3332 }, voteRights: { from: 0.6667, to: 0.8999 }, name: "Holding A/S", type: "Company", lassoId: "CVR-1-1" },
        { ownership: { from: 1, to: 1 }, voteRights: { from: 1, to: 1 }, name: "Moder ApS", type: "Company", lassoId: "CVR-1-2" },
      ],
    },
  });
  // Sorteret med største ejer først.
  assert.equal(o.owners[0]!.share, "100 %");
  assert.equal(o.owners[0]!.votes, undefined);
  assert.equal(o.owners[1]!.share, "25–33,32 %");
  assert.equal(o.owners[1]!.votes, "66,67–89,99 %");
});

test("adaptPeople udelader revisorer fra otherParticipants og læser employees.count", () => {
  const raw = {
    ...REAL_COMPANY,
    employees: { count: 21000, fullTimeEquivalentCount: 20500, interval: "1000-999999", type: "month", month: 8, year: 2026 },
    otherParticipants: [{ name: "Revisionsfirma P/S", type: "Company", role: { mainType: "REVISION", type: "Bæredygtighedsrevision" } }],
  };
  assert.deepEqual(adaptPeople(raw).map((p) => p.name), ["Anne Test"]);
  assert.equal(adaptCompany("CVR-1-11111111", raw).employees, 21000);
});

test("adaptFinancials læser XBRL-træet i reports/advanced (selskab før koncern)", () => {
  const node = (value: number | null, facts: Record<string, unknown> = {}) => ({ value, facts, abstract: value === null, label: "", section: "", source: "" });
  const vm = adaptFinancials("CVR-1-1", [
    {
      lassoId: "CVR-1-1",
      period: { from: "2024-01-01", to: "2024-12-31" },
      reportYear: 2024,
      data: {
        company: {
          facts: {
            incomeStatement: node(null, { "fsa:Revenue": node(1000), "fsa:GrossProfitLoss": node(400), "fsa:ProfitLoss": node(90) }),
            statementOfFinancialPosition: node(null, { EquityAndLiabilities: node(null, { Equity: node(700) }) }),
          },
        },
        group: { facts: { incomeStatement: node(null, { Revenue: node(5000), AverageNumberOfEmployees: node(12) }) } },
      },
    },
    { lassoId: "CVR-1-1", period: { from: "2005-01-01", to: "2005-12-31" }, reportYear: 2005, data: { company: null, group: null } },
  ]);
  assert.deepEqual(vm.years, [
    { year: 2024, periodStart: "2024-01-01", periodEnd: "2024-12-31", published: undefined, revenue: 1000, grossProfit: 400, profit: 90, equity: 700, employees: 12, liabilities: null },
  ]);
});

test("adaptFinancials læser period.from og publicationTime (LassoKeyValueList/LassoMultiYearTable, katalog 09-10)", () => {
  const vm = adaptFinancials("CVR-1-1", [
    { period: { from: "2025-01-01", to: "2025-12-31" }, reportYear: 2025, publicationTime: "2026-04-15T10:00:00", figures: { grossProfit: 100 } },
  ]);
  assert.equal(vm.years[0]!.periodStart, "2025-01-01");
  assert.equal(vm.years[0]!.periodEnd, "2025-12-31");
  assert.equal(vm.years[0]!.published, "2026-04-15");
});

test("adaptCompany skriver CVR's versal-kommuner pænt", () => {
  const vm = adaptCompany("CVR-1-1", { name: "X", address: { postalCode: 2800, postalDistrict: "Kongens Lyngby", municipality: { name: "LYNGBY-TAARBÆK", code: 173 } } });
  assert.equal(vm.address?.municipality, "Lyngby-Taarbæk");
  assert.equal(adaptCompany("CVR-1-1", { name: "X", address: { municipality: { name: "GLADSAXE" } } }).address?.municipality, "Gladsaxe");
});

test("adaptFinancials læser gæld: ét samlet begreb vinder over kort+langfristet", () => {
  const node = (value: number | null, facts: Record<string, unknown> = {}) => ({ value, facts, abstract: value === null, label: "", section: "", source: "" });
  const vm = adaptFinancials("CVR-1-1", [
    {
      reportYear: 2024,
      period: { to: "2024-12-31" },
      data: {
        company: {
          facts: {
            statementOfFinancialPosition: node(null, {
              Liabilities: node(900),
              CurrentLiabilities: node(500),
              NonCurrentLiabilities: node(300),
            }),
          },
        },
      },
    },
  ]);
  assert.equal(vm.years[0]!.liabilities, 900);
});

test("adaptFinancials lægger kort- og langfristet gæld sammen, når der ikke er ét samlet begreb", () => {
  const node = (value: number | null, facts: Record<string, unknown> = {}) => ({ value, facts, abstract: value === null, label: "", section: "", source: "" });
  const vm = adaptFinancials("CVR-1-1", [
    {
      reportYear: 2024,
      period: { to: "2024-12-31" },
      data: {
        company: {
          facts: {
            statementOfFinancialPosition: node(null, {
              CurrentLiabilities: node(500),
              NonCurrentLiabilities: node(300),
            }),
          },
        },
      },
    },
  ]);
  assert.equal(vm.years[0]!.liabilities, 800);
});

test("adaptFinancials giver null for gæld, når intet gældsbegreb er oplyst", () => {
  const vm = adaptFinancials("CVR-1-1", [{ reportYear: 2024, period: { to: "2024-12-31" }, figures: { grossProfit: 100 } }]);
  assert.equal(vm.years[0]!.liabilities, null);
});

test("adaptTextSections læser branche og udelader ubekræftede felter, når de mangler", () => {
  const t = adaptTextSections("CVR-1-1", { industry: { text: "Revision", code: "692000" } });
  assert.deepEqual(t.sections, [{ heading: "Branche", body: "Revision", note: "NACE 692000" }]);
});

test("adaptTextSections tager formål og tegningsregler med, når de findes", () => {
  const t = adaptTextSections("CVR-1-1", { industry: { text: "Revision", code: "692000" }, purpose: "At drive revision.", signingRule: "Direktøren alene." });
  assert.deepEqual(
    t.sections.map((s) => s.heading),
    ["Branche", "Formål", "Tegningsregler"],
  );
});

test("adaptTimeline samler stiftelse, ledelsesskift og regnskaber, nyeste øverst", () => {
  const people = [{ name: "Anne Test", role: "Direktør", from: "2022-11-01" }];
  const years = [{ year: 2024, periodEnd: "2024-12-31", publicationTime: "2025-04-15", revenue: 1000, grossProfit: 400, profit: 90, equity: 700, employees: 12 }];
  const tl = adaptTimeline("CVR-1-1", { lifeTime: { from: "2020-01-01" } }, people, years);
  assert.deepEqual(
    tl.events.map((e) => e.category),
    ["Regnskab", "Ledelse", "Stamdata"],
  );
  assert.equal(tl.events[0]!.date, "2025-04-15");
});

test("adaptBeneficialOwnership læser navn, andel og UNKNOWN som et hul", () => {
  const o = adaptBeneficialOwnership("CVR-1-1", [
    { name: "Anne Eksempel", identifier: "CVR-3-1", totalOwnerPercentageMin: 20, totalOwnerPercentageMax: 24.99 },
    { type: "UNKNOWN", totalOwnerPercentageMin: 25, totalOwnerPercentageMax: 33 },
  ]);
  assert.equal(o.owners.length, 1);
  assert.equal(o.owners[0]!.name, "Anne Eksempel");
  assert.equal(o.owners[0]!.share, "20–24,99 %");
  assert.equal(o.gaps?.[0]?.share, "25–33 %");
});

test("adaptNews læser Lassos paqle-svar og begrænser til limit", () => {
  const n = adaptNews("CVR-1-1", {
    news: [
      { headline: "Test A", url: "https://x.dk/a", time: "2026-04-15T10:00:00Z", provider: "Lasso News", content: "Uddrag A" },
      { headline: "Test B", providerData: { sourceName: "Børsen", published: "2026-04-10" }, content: "Uddrag B" },
    ],
  }, 1);
  assert.equal(n.items.length, 1);
  assert.equal(n.items[0]!.headline, "Test A");
  assert.equal(n.items[0]!.source, "Lasso News");
});

test("adaptOwnership sorterer største ejer først", () => {
  const o = adaptOwnership("CVR-1-1", {
    ownership: {
      owners: [
        { ownership: { from: 0.05, to: 0.1 }, name: "Lille ApS", type: "Company" },
        { ownership: { from: 0.25, to: 0.3332 }, name: "Stor A/S", type: "Company" },
        { ownership: { from: 0.15, to: 0.1999 }, name: "Mellem ApS", type: "Company" },
      ],
    },
  });
  assert.deepEqual(o.owners.map((x) => x.name), ["Stor A/S", "Mellem ApS", "Lille ApS"]);
});

test("adaptObservations læser et rent array med numerisk og tekstlig alvor", () => {
  const vm = adaptObservations("CVR-1-1", [
    { id: "a", title: "Negativ egenkapital to år i træk", detail: "Egenkapitalen er negativ.", severity: 95, source: "Regnskab", date: "2026-04-15" },
    { headline: "Revisor fravalgt", score: "medium", occurredAt: "2026-02-02" },
    { text: "Nyt bestyrelsesmedlem", level: "low" },
  ]);
  assert.equal(vm.lassoId, "CVR-1-1");
  assert.deepEqual(
    vm.observations.map((o) => o.severity),
    [100, 50, 25],
  );
  assert.equal(vm.observations[0]!.title, "Negativ egenkapital to år i træk");
  assert.equal(vm.observations[0]!.date, "2026-04-15");
});

test("adaptObservations pakker et svar ind i {observations:[...]} og springer poster uden titel over", () => {
  const vm = adaptObservations("CVR-1-2", { observations: [{ message: "Adresse ændret" }, { foo: "ingen titel her" }], checkedAt: "2026-09-25T10:00:00Z" });
  assert.equal(vm.observations.length, 1);
  assert.equal(vm.observations[0]!.severity, 0);
  assert.equal(vm.checkedAt, "2026-09-25");
});

test("adaptObservations giver 0 observationer ved en helt ukendt form, i stedet for at kaste", () => {
  const vm = adaptObservations("CVR-1-3", { unknownField: 42 });
  assert.deepEqual(vm.observations, []);
});

test("shareRange læser brøker, procenttal og tekst", () => {
  assert.deepEqual(shareRange({ from: 0.25, to: 0.3332 }), [25, 33.32]);
  assert.deepEqual(shareRange(0.5), [50, 50]);
  assert.deepEqual(shareRange(100), [100, 100]);
  assert.deepEqual(shareRange("20–24,99 %"), [20, 24.99]);
  assert.deepEqual(shareRange({ min: 5, max: 9.99 }), [5, 9.99]);
  assert.equal(shareRange(null), undefined);
});

const OPTS = { ingoingDepth: 2, outgoingDepth: 1 };

test("adaptOwnershipGraph: noder og kanter med from/to og brøk-intervaller", () => {
  const g = adaptOwnershipGraph("CVR-1-1", {
    nodes: [
      { lassoId: "CVR-1-1", name: "Fokus A/S", type: "company", companyInfo: { cvr: "00000001", form: { shortDescription: "A/S" }, status: "NORMAL" } },
      { lassoId: "CVR-1-2", name: "Holding ApS", entityType: "Company" },
      { lassoId: "CVR-3-9", name: "Anne Eksempel", type: "Person" },
      { id: "X-NO-1", name: "Nordic AS", country: "NO", registrationNumber: "999 000 002" },
    ],
    edges: [
      { from: "CVR-1-2", to: "CVR-1-1", relationType: "ownership", ownership: { from: 0.6667, to: 0.8999 }, voteRights: { from: 0.6667, to: 0.8999 } },
      { from: "CVR-3-9", to: "CVR-1-2", ownership: { from: 1, to: 1 }, validFrom: "2012-05-14T00:00:00" },
      { from: "CVR-1-1", to: "X-NO-1", ownership: 0.5 },
      { from: "CVR-3-9", to: "CVR-1-1", relationType: "management" },
    ],
  }, OPTS);
  assert.equal(g.rootId, "CVR-1-1");
  const root = g.nodes.find((n) => n.id === "CVR-1-1")!;
  assert.equal(root.root, true);
  assert.equal(root.cvr, "00000001");
  assert.equal(root.form, "A/S");
  assert.equal(g.nodes.find((n) => n.id === "CVR-3-9")!.kind, "person");
  const no = g.nodes.find((n) => n.id === "X-NO-1")!;
  assert.equal(no.country, "NO");
  assert.equal(no.registrationNo, "999 000 002");
  assert.equal(g.edges.length, 3, "ledelsesrelationen springes over");
  assert.deepEqual(g.edges[0]!.share, [66.67, 89.99]);
  assert.equal(g.edges[0]!.votes, undefined, "stemmer kun når de afviger");
  assert.equal(g.edges[1]!.since, "2012-05-14");
  assert.deepEqual(g.edges[2]!.share, [50, 50]);
});

test("adaptOwnershipGraph: relationsliste med indlejrede ejer/ejet-objekter og entiteter som map", () => {
  const g = adaptOwnershipGraph("CVR-1-1", {
    graph: {
      entities: { "CVR-1-1": { name: "Fokus A/S" }, "CVR-1-5": { name: "Ejer ApS", type: "company" } },
      relations: [
        { owner: { lassoId: "CVR-1-5", name: "Ejer ApS" }, owned: { lassoId: "CVR-1-1" }, properties: { share: "25–33,32 %", votingRights: "33,33–49,99 %" } },
        { source: { id: "CVR-3-7", name: "Bo Prøve", type: "person" }, target: "CVR-1-5", properties: { ownership: { from: 1, to: 1 }, validTo: "2023-06-30" } },
      ],
    },
  }, OPTS);
  assert.equal(g.nodes.find((n) => n.id === "CVR-1-5")!.name, "Ejer ApS");
  assert.equal(g.nodes.find((n) => n.id === "CVR-3-7")!.kind, "person");
  assert.deepEqual(g.edges[0]!.share, [25, 33.32]);
  assert.deepEqual(g.edges[0]!.votes, [33.33, 49.99]);
  assert.equal(g.edges[1]!.until, "2023-06-30");
});

test("adaptOwnershipGraph: tomt svar giver en graf med kun roden", () => {
  const g = adaptOwnershipGraph("CVR-1-1", {}, OPTS);
  assert.equal(g.nodes.length, 1);
  assert.equal(g.edges.length, 0);
  assert.equal(adaptOwnershipGraph("CVR-1-1", [], OPTS).nodes.length, 1);
});

test("graphFromOwnership bygger ét lag ejere som reserve", () => {
  const g = graphFromOwnership("CVR-1-1", "Fokus A/S", { lassoId: "CVR-1-1", owners: [{ name: "Holding", lassoId: "CVR-1-2", share: "50–66,66 %", kind: "company" }, { name: "Anne", share: "10–14,99 %", kind: "person" }] }, OPTS);
  assert.equal(g.nodes.length, 3);
  assert.deepEqual(g.edges.map((e) => e.share), [[50, 66.66], [10, 14.99]]);
  assert.equal(g.outgoingDepth, 0);
  assert.ok(g.note);
});
