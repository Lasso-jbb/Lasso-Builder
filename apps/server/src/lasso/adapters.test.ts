import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adaptBeneficialOwnership,
  adaptCompany,
  adaptContact,
  adaptContactPersons,
  fillContactInfo,
  adaptFinancials,
  adaptFinancialStatements,
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
  currencyCode,
  participantKind,
  looksLikeOrganisation,
  participantNames,
  applyGraphNames,
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

test("adaptFinancials bruger ét scope pr. rapport: koncernen, når den har et regnskab (aldrig blandet)", () => {
  const node = (value: number | null, facts: Record<string, unknown> = {}) => ({ value, facts, abstract: value === null, label: "", section: "", source: "" });
  const vm = adaptFinancials("CVR-1-1", [
    {
      lassoId: "CVR-1-1",
      period: { from: "2024-01-01", to: "2024-12-31" },
      reportYear: 2024,
      data: {
        company: {
          facts: {
            incomeStatement: node(null, { "fsa:Revenue": node(1000), "fsa:GrossProfitLoss": node(400), "fsa:ProfitLoss": node(90), "fsa:AverageNumberOfEmployees": node(3) }),
            statementOfFinancialPosition: node(null, { EquityAndLiabilities: node(null, { Equity: node(700) }) }),
          },
        },
        group: {
          facts: {
            incomeStatement: node(null, { Revenue: node(5000), ProfitLossFromOrdinaryOperatingActivities: node(600), ProfitLoss: node(450), AverageNumberOfEmployees: node(12) }),
            statementOfFinancialPosition: node(null, { Equity: node(2000) }),
          },
        },
      },
    },
    { lassoId: "CVR-1-1", period: { from: "2005-01-01", to: "2005-12-31" }, reportYear: 2005, data: { company: null, group: null } },
  ]);
  assert.deepEqual(vm.years, [
    {
      year: 2024,
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
      published: undefined,
      scope: "Koncern",
      revenue: 5000,
      // Selskabets bruttofortjeneste må ikke blandes ind i koncernens år.
      grossProfit: null,
      profit: 450,
      equity: 2000,
      employees: 12,
      liabilities: null,
      assetsTotal: null,
      ebitda: null,
      soliditetsgrad: null,
      overskudsgrad: 12,
      likviditetsgrad: null,
    },
  ]);
});

test("adaptFinancials bruger selskabets tal, når koncernen kun har enkelte tal", () => {
  const node = (value: number | null, facts: Record<string, unknown> = {}) => ({ value, facts });
  const vm = adaptFinancials("CVR-1-1", [
    {
      period: { to: "2024-12-31" },
      reportYear: 2024,
      data: {
        company: { facts: { incomeStatement: node(null, { Revenue: node(1000), GrossProfitLoss: node(400), ProfitLoss: node(90) }) } },
        group: { facts: { incomeStatement: node(null, { AverageNumberOfEmployees: node(12) }) } },
      },
    },
  ]);
  const y = vm.years[0]!;
  assert.equal(y.scope, "Selskab");
  assert.equal(y.revenue, 1000);
  assert.equal(y.employees, null, "koncernens ansatte blandes ikke ind i selskabets år");
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

test("adaptFinancialStatements læser resultatopgørelse og balance fra XBRL-træet (katalog 19)", () => {
  const node = (value: number | null, facts: Record<string, unknown> = {}) => ({ value, facts, abstract: value === null, label: "", section: "", source: "" });
  const vm = adaptFinancialStatements("CVR-1-1", [
    {
      reportYear: 2024,
      period: { from: "2024-01-01", to: "2024-12-31" },
      data: {
        company: {
          facts: {
            incomeStatement: node(null, {
              "fsa:Revenue": node(1000),
              "fsa:GrossProfitLoss": node(400),
              "fsa:EmployeeBenefitsExpense": node(-150),
              "fsa:OtherExternalExpenses": node(-100),
              "fsa:ProfitLossFromOrdinaryActivitiesBeforeTax": node(120),
              "fsa:TaxExpenseOnOrdinaryActivities": node(-30),
              "fsa:ProfitLoss": node(90),
            }),
            statementOfFinancialPosition: node(null, {
              "fsa:Equity": node(700),
              "fsa:Liabilities": node(300),
              "fsa:CurrentAssets": node(600),
            }),
          },
        },
      },
    },
  ]);
  assert.equal(vm.incomeStatement.length, 1);
  const y = vm.incomeStatement[0]!;
  assert.equal(y.year, 2024);
  assert.equal(y.revenue, 1000);
  assert.equal(y.grossProfit, 400);
  assert.equal(y.staffCosts, -150);
  assert.equal(y.otherOperatingCosts, -100);
  // Intet direkte EBITDA-begreb: udregnes som bruttofortjeneste + personale + andre drift.
  assert.equal(y.ebitda, 400 - 150 - 100);
  assert.equal(y.profitBeforeTax, 120);
  assert.equal(y.tax, -30);
  assert.equal(y.profit, 90);

  assert.equal(vm.balanceSheet.length, 1);
  const b = vm.balanceSheet[0]!;
  assert.equal(b.equityTotal, 700);
  assert.equal(b.liabilitiesTotal, 300);
  // Intet direkte samlet aktiv-begreb: udregnes som egenkapital + gæld.
  assert.equal(b.assetsTotal, 1000);
  assert.equal(b.liabilitiesAndEquityTotal, 1000);

  // Ingen pengestrømsbegreber i svaret: opgørelsen er tom (klasse B).
  assert.deepEqual(vm.cashFlow, []);
});

test("adaptFinancialStatements medtager pengestrøm, når mindst ét begreb er fundet", () => {
  const node = (value: number | null, facts: Record<string, unknown> = {}) => ({ value, facts, abstract: value === null, label: "", section: "", source: "" });
  const vm = adaptFinancialStatements("CVR-1-1", [
    {
      reportYear: 2024,
      period: { to: "2024-12-31" },
      data: {
        company: {
          facts: {
            statementOfCashFlows: node(null, {
              "fsa:CashFlowsFromUsedInOperatingActivities": node(200),
              "fsa:CashAndCashEquivalentsAtEndOfPeriod": node(50),
            }),
          },
        },
      },
    },
  ]);
  assert.equal(vm.cashFlow.length, 1);
  assert.equal(vm.cashFlow[0]!.operatingCashFlow, 200);
  assert.equal(vm.cashFlow[0]!.cashEnding, 50);
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

test("fillContactInfo lader CVR-svarets felter stå, når de allerede findes", () => {
  const co = adaptCompany("CVR-1-1", { name: "X", phone: "12345678", email: "x@x.dk", website: "https://x.dk" });
  const filled = fillContactInfo(co, { urls: [{ url: "https://andet.dk" }] }, { emails: ["andet@x.dk"] });
  assert.equal(filled.phone, "12345678");
  assert.equal(filled.email, "x@x.dk");
  assert.equal(filled.website, "https://x.dk");
});

test("fillContactInfo henter fra websites()/contacts(), når CVR-svaret ikke selv har felterne", () => {
  const co = adaptCompany("CVR-1-1", { name: "X" });
  const filled = fillContactInfo(
    co,
    { urls: [{ url: "https://eksempel.dk", verifiedAt: "2026-01-01" }] },
    { phonenumbers: ["70200000"], emails: [{ email: "kontakt@eksempel.dk" }] },
  );
  assert.equal(filled.phone, "70200000");
  assert.equal(filled.email, "kontakt@eksempel.dk");
  assert.equal(filled.website, "https://eksempel.dk");
});

test("adaptContact sætter kilden til CVR eller virksomhedens hjemmeside, og lader kontakt være tom uden data", () => {
  const withCvrPhone = adaptContact("CVR-1-1", { name: "X", phone: "12345678" }, undefined, undefined);
  assert.equal(withCvrPhone.source, "CVR");
  assert.equal(withCvrPhone.phone, "12345678");

  const fromWebsite = adaptContact("CVR-1-1", { name: "X" }, { urls: [{ url: "https://eksempel.dk" }] }, undefined);
  assert.equal(fromWebsite.source, "Virksomhedens hjemmeside");
  assert.equal(fromWebsite.website, "https://eksempel.dk");

  const empty = adaptContact("CVR-1-1", { name: "X" }, undefined, undefined);
  assert.equal(empty.source, undefined);
  assert.equal(empty.phone, undefined);
});

test("adaptContactPersons læser navn, rolle, telefon og e-mail, og udelader personer uden navn", () => {
  const people = adaptContactPersons("CVR-1-1", {
    contacts: [
      { name: "Anne Eksempel", role: "Direktør", phone: "12345678", email: "anne@eksempel.dk" },
      { title: "Uden navn" },
      { navn: "Bo Eksempel", jobTitle: "Salgschef" },
    ],
  });
  assert.deepEqual(people.people.map((p) => [p.name, p.role, p.phone, p.email]), [
    ["Anne Eksempel", "Direktør", "12345678", "anne@eksempel.dk"],
    ["Bo Eksempel", "Salgschef", undefined, undefined],
  ]);
  assert.equal(people.source, "Virksomhedens hjemmeside");

  const none = adaptContactPersons("CVR-1-1", []);
  assert.deepEqual(none.people, []);
  assert.equal(none.source, undefined);
});

test("adaptFinancialStatements læser IFRS/ESEF (børsnoteret, funktionsopdelt) med fortegn fra debit/credit", () => {
  // Uddrag af det rigtige svar for NOVO NORDISK A/S 2025 (startup-probe på staging).
  const n = (value: number, balance: "debit" | "credit") => ({ value, unit: "DKK", xbrlType: "xbrli:monetaryItemType", balance });
  const vm = adaptFinancialStatements("CVR-1-24256790", [
    {
      reportYear: 2025,
      period: { from: "2025-01-01", to: "2025-12-31" },
      data: {
        company: {
          facts: {
            incomeStatement: {
              facts: {
                revenue: n(309064000000, "credit"),
                costOfSales: n(58788000000, "debit"),
                grossProfit: n(250276000000, "credit"),
                sellingExpenseAndDistributionCosts: n(64310000000, "debit"),
                researchAndDevelopmentExpense: n(52039000000, "debit"),
                administrativeExpense: n(5969000000, "debit"),
                otherOperatingIncomeExpense: n(-300000000, "credit"),
                profitLossFromOperatingActivities: n(127658000000, "credit"),
                financeIncome: n(9660000000, "credit"),
                financeCosts: n(6778000000, "debit"),
                profitLossBeforeTax: n(130540000000, "credit"),
                incomeTaxExpenseContinuingOperations: n(28106000000, "debit"),
                profitLoss: n(102434000000, "credit"),
              },
            },
          },
        },
      },
    },
  ]);
  const y = vm.incomeStatement[0]!;
  assert.equal(y.revenue, 309064000000);
  assert.equal(y.grossProfit, 250276000000);
  // Salg + forskning + administration + andre driftsposter = bruttofortjeneste − driftsresultat.
  assert.equal(y.otherOperatingCosts, -(64310000000 + 52039000000 + 5969000000 + 300000000));
  assert.equal(y.financialItemsNet, 9660000000 - 6778000000);
  assert.equal(y.profitBeforeTax, 130540000000);
  assert.equal(y.tax, -28106000000);
  assert.equal(y.profit, 102434000000);
  // Ingen afskrivninger i svaret: EBITDA kan ikke beregnes og må ikke gættes som driftsresultatet.
  assert.equal(y.ebitda, null);
});

/* ---------- Rettelser efter review 26.09.2026 ---------- */

test("statusKind: afsluttede forløb er inaktive, igangværende er advarsler (alle CVR-statusser)", () => {
  const cases: [string, ReturnType<typeof statusKind>][] = [
    ["Normal", "active"],
    ["Aktiv", "active"],
    ["NORMAL", "active"],
    ["Ophørt", "inactive"],
    ["Opløst", "inactive"],
    ["Opløst efter frivillig likvidation", "inactive"],
    ["Opløst efter konkurs", "inactive"],
    ["Opløst efter fusion", "inactive"],
    ["Opløst efter spaltning", "inactive"],
    ["Opløst efter tvangsopløsning", "inactive"],
    ["Slettet", "inactive"],
    ["Under konkurs", "warning"],
    ["Under frivillig likvidation", "warning"],
    ["Under tvangsopløsning", "warning"],
    ["Tvangsopløst", "warning"],
    ["Under reassumering", "warning"],
    ["Under rekonstruktion", "warning"],
  ];
  for (const [status, kind] of cases) assert.equal(statusKind(status), kind, status);
  assert.equal(statusKind(undefined), undefined);
});

/** XBRL-blad som i reports/advanced: { value, unit, balance, … }. */
const leaf = (value: number | null, unit?: string, extra: Record<string, unknown> = {}) => ({ value, unit, xbrlType: "monetaryItemType", ...extra });
const tree = (facts: Record<string, unknown>) => ({ value: null, facts, abstract: true });

/** Vestas-lignende rapport i EUR (IFRS, koncern). */
const VESTAS_2025 = {
  lassoId: "CVR-1-10403782",
  period: { from: "2025-01-01", to: "2025-12-31" },
  reportYear: 2025,
  data: {
    group: {
      facts: {
        incomeStatement: tree({
          "ifrs-full:Revenue": leaf(18_822_000_000, "iso4217:EUR"),
          "ifrs-full:ProfitLossFromOperatingActivities": leaf(1_200_000_000, "iso4217:EUR"),
          "ifrs-full:ProfitLoss": leaf(800_000_000, "iso4217:EUR"),
          "ifrs-full:AverageNumberOfEmployees": leaf(35_000, "xbrli:pure"),
        }),
        statementOfFinancialPosition: tree({
          "ifrs-full:Assets": leaf(22_000_000_000, "iso4217:EUR"),
          "ifrs-full:Equity": leaf(4_000_000_000, "iso4217:EUR"),
          "ifrs-full:Liabilities": leaf(18_000_000_000, "iso4217:EUR"),
        }),
      },
    },
  },
};

test("adaptFinancials læser valutaen fra XBRL unit (Vestas i EUR), ikke altid DKK", () => {
  const vm = adaptFinancials("CVR-1-10403782", [VESTAS_2025]);
  assert.equal(vm.currency, "EUR");
  assert.equal(vm.years[0]!.currency, "EUR");
  assert.equal(vm.years[0]!.revenue, 18_822_000_000);
  assert.equal(vm.years[0]!.employees, 35_000);
  const st = adaptFinancialStatements("CVR-1-10403782", [VESTAS_2025]);
  assert.equal(st.currency, "EUR");
});

test("adaptFinancials: Mærsk-lignende USD-regnskab og unit som objekt eller ren kode", () => {
  const maersk = (unit: unknown) => [
    { period: { to: "2025-12-31" }, reportYear: 2025, data: { group: { facts: { incomeStatement: tree({ Revenue: { value: 53_988_000_000, unit }, ProfitLoss: { value: 3_000_000_000, unit }, Equity: { value: 55e9, unit } }) } } } },
  ];
  assert.equal(adaptFinancials("CVR-1-22756214", maersk("iso4217:USD")).currency, "USD");
  assert.equal(adaptFinancials("CVR-1-22756214", maersk({ measure: "iso4217:USD" })).currency, "USD");
  assert.equal(adaptFinancials("CVR-1-22756214", maersk("USD")).currency, "USD");
  // Uden unit: DKK som hidtil.
  assert.equal(adaptFinancials("CVR-1-1", maersk(undefined)).currency, "DKK");
});

test("adaptFinancials tager valutaen fra det nyeste regnskab, når selskabet har skiftet", () => {
  const rep = (year: number, unit: string) => ({ period: { to: `${year}-12-31` }, reportYear: year, data: { company: { facts: { incomeStatement: tree({ GrossProfitLoss: leaf(100, unit), ProfitLoss: leaf(10, unit) }) } } } });
  const vm = adaptFinancials("CVR-1-1", [rep(2025, "iso4217:EUR"), rep(2024, "iso4217:DKK")]);
  assert.equal(vm.currency, "EUR");
  assert.deepEqual(vm.years.map((y) => y.currency), ["DKK", "EUR"]);
});

test("currencyCode genkender ISO 4217 og afviser ikke-monetære enheder", () => {
  assert.equal(currencyCode("iso4217:EUR"), "EUR");
  assert.equal(currencyCode("ISO4217_usd"), "USD");
  assert.equal(currencyCode("DKK"), "DKK");
  assert.equal(currencyCode({ measure: "iso4217:SEK" }), "SEK");
  assert.equal(currencyCode("xbrli:pure"), undefined);
  assert.equal(currencyCode("xbrli:shares"), undefined);
  assert.equal(currencyCode("ANT"), undefined);
  assert.equal(currencyCode(undefined), undefined);
});

test("adaptTimeline skriver beløb i regnskabets valuta", () => {
  const tl = adaptTimeline("CVR-1-1", {}, [], [{ year: 2025, periodEnd: "2025-12-31", grossProfit: 18_822_000_000, profit: 800_000_000, currency: "EUR" }]);
  assert.equal(tl.events[0]!.detail, "Bruttofortjeneste 18,8 mia. EUR, resultat 800,0 mio. EUR");
});

/** Arne Elkjær-lignende ÅRL klasse C (tal fra live 2024): gæld uden hensatte, som CVR/ÅRL tagger den. */
const ARL_2024 = {
  period: { from: "2024-01-01", to: "2024-12-31" },
  reportYear: 2024,
  data: {
    company: {
      facts: {
        incomeStatement: tree({
          "fsa:Revenue": leaf(60_000_000, "iso4217:DKK"),
          "fsa:GrossProfitLoss": leaf(24_992_309, "iso4217:DKK"),
          "fsa:ProfitLossFromOrdinaryOperatingActivities": leaf(1_800_000, "iso4217:DKK"),
          "fsa:ProfitLoss": leaf(1_027_633, "iso4217:DKK"),
        }),
        statementOfFinancialPosition: tree({
          "fsa:CurrentAssets": leaf(15_278_985, "iso4217:DKK"),
          "fsa:Equity": leaf(5_000_000, "iso4217:DKK"),
          "fsa:Provisions": leaf(200_000, "iso4217:DKK"),
          "fsa:LiabilitiesOtherThanProvisions": tree({
            "fsa:LongtermLiabilitiesOtherThanProvisions": leaf(3_024_007, "iso4217:DKK"),
            "fsa:ShorttermLiabilitiesOtherThanProvisions": leaf(9_716_227, "iso4217:DKK"),
          }),
        }),
      },
    },
  },
};

test("adaptFinancials: ÅRL-gæld (…OtherThanProvisions) giver gæld og likviditetsgrad, ikke '—'", () => {
  const y = adaptFinancials("CVR-1-1", [ARL_2024]).years[0]!;
  // Ingen samlet gæld tagget: kort + lang + hensatte.
  assert.equal(y.liabilities, 9_716_227 + 3_024_007 + 200_000);
  assert.equal(y.likviditetsgrad, 157.3);
  assert.equal(y.assetsTotal, 5_000_000 + 12_940_234);
  // Samme tal i regnskabstabellen.
  const b = adaptFinancialStatements("CVR-1-1", [ARL_2024]).balanceSheet[0]!;
  assert.equal(b.shortTermLiabilities, 9_716_227);
  assert.equal(b.longTermLiabilities, 3_024_007);
  assert.equal(b.liabilitiesTotal, y.liabilities);
  assert.equal(b.currentAssetsTotal, 15_278_985);
});

test("adaptFinancials: samlet ÅRL-gæld uden hensatte + hensatte, når det samlede begreb er tagget", () => {
  const r = { period: { to: "2024-12-31" }, reportYear: 2024, data: { company: { facts: { statementOfFinancialPosition: tree({ Equity: leaf(100), LiabilitiesOtherThanProvisions: leaf(400), Provisions: leaf(50), ShorttermLiabilitiesOtherThanProvisions: leaf(300) }) } } } };
  const y = adaptFinancials("CVR-1-1", [r]).years[0]!;
  assert.equal(y.liabilities, 450);
  assert.equal(adaptFinancialStatements("CVR-1-1", [r]).balanceSheet[0]!.liabilitiesTotal, 450);
});

test("overskudsgrad = resultat af primær drift (EBIT) / omsætning; '—' uden omsætning", () => {
  const y = adaptFinancials("CVR-1-1", [ARL_2024]).years[0]!;
  assert.equal(y.overskudsgrad, 3); // 1,8 mio. / 60 mio.
  const klasseB = { period: { to: "2023-12-31" }, reportYear: 2023, data: { company: { facts: { incomeStatement: tree({ GrossProfitLoss: leaf(24_992_309), ProfitLossFromOrdinaryOperatingActivities: leaf(1_500_000), ProfitLoss: leaf(1_027_633) }) } } } };
  assert.equal(adaptFinancials("CVR-1-1", [klasseB]).years[0]!.overskudsgrad, null, "ikke årets resultat / bruttofortjeneste");
  const utenEbit = { period: { to: "2023-12-31" }, reportYear: 2023, data: { company: { facts: { incomeStatement: tree({ Revenue: leaf(1000), ProfitLoss: leaf(90) }) } } } };
  assert.equal(adaptFinancials("CVR-1-1", [utenEbit]).years[0]!.overskudsgrad, null);
});

test("adaptFinancials vælger årets tal og ikke sammenligningstal fra året før (Novo 2022/2023)", () => {
  // Sammenligningstallet (2022) står først i træet; det må ikke skygge for 2023-tallet.
  const withPeriods = {
    period: { from: "2023-01-01", to: "2023-12-31" },
    reportYear: 2023,
    data: {
      group: {
        facts: {
          incomeStatement: tree({
            Revenue: leaf(232_261_000_000, "iso4217:DKK", { period: { from: "2023-01-01", to: "2023-12-31" } }),
            ProfitLoss: leaf(83_683_000_000, "iso4217:DKK"),
          }),
          notes: tree({
            "ifrs-full:AverageNumberOfEmployees": { value: 51_046, period: { from: "2022-01-01", to: "2022-12-31" } },
            employeesNote: tree({ "ifrs-full:AverageNumberOfEmployees": { value: 59_000, period: { from: "2023-01-01", to: "2023-12-31" } } }),
          }),
        },
      },
    },
  };
  assert.equal(adaptFinancials("CVR-1-24256790", [withPeriods]).years[0]!.employees, 59_000);

  // Liste af værdier med perioder: den med rapportens period.to vælges.
  const withValues = {
    period: { to: "2023-12-31" },
    reportYear: 2023,
    data: { group: { facts: { incomeStatement: tree({ Revenue: leaf(1), ProfitLoss: leaf(1), AverageNumberOfEmployees: { values: [{ value: 51_046, period: { to: "2022-12-31" } }, { value: 59_000, period: { to: "2023-12-31" } }] } }) } } },
  };
  assert.equal(adaptFinancials("CVR-1-24256790", [withValues]).years[0]!.employees, 59_000);

  // Kun forrige års tal findes: hellere "—" end forrige års tal.
  const onlyPrior = {
    period: { to: "2023-12-31" },
    reportYear: 2023,
    data: { group: { facts: { incomeStatement: tree({ Revenue: leaf(1), ProfitLoss: leaf(1), AverageNumberOfEmployees: { values: [{ value: 51_046, period: { to: "2022-12-31" } }] } }) } } },
  };
  assert.equal(adaptFinancials("CVR-1-24256790", [onlyPrior]).years[0]!.employees, null);
});

test("adaptOwnership: udenlandske selskaber og fonde (BlackRock, CVR-3-…) er ikke personer", () => {
  const o = adaptOwnership("CVR-1-61126228", {
    ownership: {
      owners: [
        { name: "BlackRock, Inc", lassoId: "CVR-3-4010801698", ownership: { from: 0.05, to: 0.0999 } },
        { name: "A.P. Møller Holding A/S", lassoId: "CVR-1-25679288", type: "Company", ownership: { from: 0.2, to: 0.2499 } },
        { name: "Anne Test", lassoId: "CVR-3-4000000001", ownership: { from: 0.05, to: 0.0999 } },
        { name: "Norges Bank", lassoId: "CVR-3-4000000002", type: "ForeignCompany", ownership: { from: 0.05, to: 0.0999 } },
        { name: "Ole Hansen", lassoId: "CVR-3-4000000003", type: "PERSON", ownership: { from: 0.05, to: 0.0999 } },
      ],
    },
  });
  const kind = Object.fromEntries(o.owners.map((w) => [w.name, w.kind]));
  assert.equal(kind["BlackRock, Inc"], "company");
  assert.equal(kind["A.P. Møller Holding A/S"], "company");
  assert.equal(kind["Anne Test"], "person");
  assert.equal(kind["Norges Bank"], "company");
  assert.equal(kind["Ole Hansen"], "person");
});

test("participantKind og looksLikeOrganisation", () => {
  assert.equal(participantKind("PERSON", "CVR-3-1", "Kirk Kristiansen"), "person");
  assert.equal(participantKind("Company", "CVR-3-1", "Noget"), "company");
  assert.equal(participantKind(undefined, "CVR-1-12345678", "X"), "company");
  assert.equal(participantKind(undefined, "CVR-3-4000543165", "Kjeld Kirk Kristiansen"), "person");
  assert.equal(participantKind(undefined, "CVR-3-4010801698", "The Vanguard Group, Inc."), "company");
  for (const n of ["BlackRock, Inc", "KIRKBI A/S", "Novo Holdings A/S", "Norges Bank", "Capital Group Companies", "ATP Pension", "Stichting Pensioenfonds", "Allianz SE", "Fidelity Management & Research Company LLC"]) {
    assert.equal(looksLikeOrganisation(n), true, n);
  }
  for (const n of ["Thomas Kirk Kristiansen", "Anne Marie Sweeney", "Søren Thorup Sørensen", "Lars Rebien Sørensen"]) assert.equal(looksLikeOrganisation(n), false, n);
});

test("ejergrafen: personnoder får navn fra nodens egne navnefelter og fra opslag", () => {
  const g = adaptOwnershipGraph(
    "CVR-1-54562519",
    {
      nodes: [
        { id: "CVR-1-54562519", name: "LEGO A/S", type: "Company" },
        { id: "CVR-3-4000550457", fullName: "Thomas Kirk Kristiansen" },
        { id: "CVR-3-4000543165" },
        { id: "CVR-3-4010801698" },
      ],
      edges: [
        { from: "CVR-3-4000550457", to: "CVR-1-54562519", ownership: { from: 0.1, to: 0.1 } },
        { from: "CVR-3-4000543165", to: "CVR-1-54562519", ownership: { from: 0.1, to: 0.1 } },
        { from: "CVR-3-4010801698", to: "CVR-1-54562519", ownership: { from: 0.05, to: 0.05 } },
      ],
    },
    { ingoingDepth: 2, outgoingDepth: 1 },
  );
  assert.equal(g.nodes.find((n) => n.id === "CVR-3-4000550457")!.name, "Thomas Kirk Kristiansen");
  assert.equal(g.nodes.find((n) => n.id === "CVR-3-4000543165")!.name, "CVR-3-4000543165");
  const names = participantNames({
    ownership: { owners: [{ name: "Kjeld Kirk Kristiansen", lassoId: "CVR-3-4000543165", type: "Person" }, { name: "BlackRock, Inc", lassoId: "CVR-3-4010801698" }] },
    stakeholders: [{ name: "Niels B. Christiansen", lassoId: "CVR-3-4003923508" }],
  });
  const named = applyGraphNames(g, names);
  const kjeld = named.nodes.find((n) => n.id === "CVR-3-4000543165")!;
  assert.equal(kjeld.name, "Kjeld Kirk Kristiansen");
  assert.equal(kjeld.kind, "person");
  const br = named.nodes.find((n) => n.id === "CVR-3-4010801698")!;
  assert.equal(br.name, "BlackRock, Inc");
  assert.equal(br.kind, "company");
  // Invariant: ingen navngivet node har navn = ID, når opslaget kender den.
  assert.ok(named.nodes.every((n) => n.name !== n.id));
});
