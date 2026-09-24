import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptCompany, adaptFinancials, adaptSearch, statusKind } from "./adapters.js";

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
