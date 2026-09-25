import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptCompany, adaptFinancials, adaptOwnership, adaptPeople, adaptSearch, regionFromZip, statusKind } from "./adapters.js";

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
  assert.deepEqual(vm.years, [{ year: 2024, periodEnd: "2024-12-31", revenue: 1000, grossProfit: 400, profit: 90, equity: 700, employees: 12, liabilities: null }]);
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
