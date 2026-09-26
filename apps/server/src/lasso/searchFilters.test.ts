import assert from "node:assert/strict";
import { test } from "node:test";
import { criteriaToFilters, DEFAULT_ACTIVE_STATUS_FILTER, filtersToCriteria, type LassoFilter } from "./searchFilters.js";

const strip = (fs: LassoFilter[]) => fs.map(({ fieldName, operator, values }) => ({ fieldName, operator, values }));

test("kriterier bliver til Lasso-filtre i det kortlagte format", () => {
  const { filters, rest } = criteriaToFilters([
    { field: "region", operator: "eq", value: "Midtjylland" },
    { field: "ansatte", operator: "gte", value: 10 },
    { field: "branchekode", operator: "in", value: ["692000", "433200"] },
    { field: "kommune", operator: "in", value: ["Aarhus Kommune", "Odense"] },
    { field: "virksomhedsform", operator: "eq", value: "Fond" },
    { field: "status", operator: "eq", value: "under konkurs" },
    { field: "bruttofortjeneste", operator: "between", value: [5_000_000, 20_000_000] },
    { field: "stiftet", operator: "after", value: "2020-01-01" },
    { field: "region", operator: "neq", value: "Hovedstaden" },
    { field: "omsaetning", operator: "gt", value: 10_000_000 },
    { field: "branchekode", operator: "starts_with", value: "43" },
  ]);
  assert.deepEqual(strip(filters), [
    { fieldName: "BasicInfo.region", operator: "Equal", values: ["4"] },
    { fieldName: "employees", operator: "GreaterEqual", values: ["10"] },
    { fieldName: "industrycode", operator: "Equal", values: ["692000", "433200"] },
    { fieldName: "BasicInfo.municipalityCode", operator: "Equal", values: ["751", "461"] },
    { fieldName: "BasicInfo.formCode", operator: "Equal", values: ["90", "100"] },
    { fieldName: "BasicInfo.CompanyStatus", operator: "Equal", values: ["UNDERKONKURS"] },
    { fieldName: "Financial.Reports[0].GrossProfitLoss.Value", operator: "Between", values: ["5000000", "20000000"] },
    { fieldName: "BasicInfo.CreationDate", operator: "After", values: ["2020-01-01"] },
    { fieldName: "BasicInfo.region", operator: "NotEqual", values: ["1"] },
  ]);
  // Omsætning og branchegrupper kan Lasso ikke filtrere på; de anvendes lokalt.
  assert.deepEqual(rest.map((c) => c.field), ["omsaetning", "branchekode"]);
  assert.equal(filters[0]!.filterName, "geography-region");
});

test("Lassos svar fra prompt-søgningen bliver til kriterier i filterpanelet", () => {
  // Rigtigt svar for "Revisorer i Region Midtjylland med mindst 10 ansatte" (25.09.2026).
  const { criteria, unknown } = filtersToCriteria([
    { filterName: "basic-industry", fieldName: "industrycode", fieldNames: null, operator: "Equal", values: ["692000"], fallbackFields: null },
    { filterName: "geography-region", fieldName: "BasicInfo.region", fieldNames: null, operator: "Equal", values: ["4"], fallbackFields: null },
    { filterName: "basic-employees-value", fieldName: "employees", fieldNames: null, operator: "GreaterThan", values: ["9"], fallbackFields: null },
    { config: { personas: [], requireContact: false }, filterName: "ContactConfiguration", fieldName: "ContactRoles", fieldNames: null, operator: "ContactConfiguration", values: [], fallbackFields: null },
  ]);
  assert.deepEqual(criteria, [
    { field: "branchekode", operator: "eq", value: "692000" },
    { field: "region", operator: "eq", value: "Midtjylland" },
    { field: "ansatte", operator: "gt", value: 9 },
  ]);
  assert.deepEqual(unknown, []);
});

test("Lassos rå prompt-filtre for 'revisorer i Region Midtjylland med mindst 10 ansatte' (26.09.2026, P0-1)", () => {
  // Den faktiske raw-liste fra POST /apps/search/query/prompt, bekræftet mod live 26.09.2026.
  // fieldName har en anden case/form end det kortlagte format (BasicInfo.IndustryCode/Region i
  // stedet for industrycode/BasicInfo.region), og GreaterEqual bruges direkte i stedet for
  // GreaterThan én mindre - filtersToCriteria skal stadig finde alle tre kriterier via filterName.
  const raw: LassoFilter[] = [
    {
      filterName: "basic-industry",
      fieldName: "BasicInfo.IndustryCode",
      fieldNames: ["BasicInfo.AlternateIndustryCodes[0]", "BasicInfo.AlternateIndustryCodes[1]", "BasicInfo.AlternateIndustryCodes[2]"],
      operator: "Equal",
      values: ["692000"],
    },
    { filterName: "geography-region", fieldName: "BasicInfo.Region", operator: "Equal", values: ["4"] },
    { filterName: "basic-employees-value", fieldName: "employees", operator: "GreaterEqual", values: ["10"] },
  ];
  const { criteria, unknown } = filtersToCriteria(raw);
  assert.deepEqual(criteria, [
    { field: "branchekode", operator: "eq", value: "692000" },
    { field: "region", operator: "eq", value: "Midtjylland" },
    { field: "ansatte", operator: "gte", value: 10 },
  ]);
  assert.deepEqual(unknown, []);

  // Kriterierne skal kunne genskabes til filtre, som reelt gav 83 resultater hos Lasso (probeLasso),
  // plus standard-statusfilteret (P1-5), når de sendes videre til selve søgningen.
  const { filters, rest } = criteriaToFilters(criteria);
  assert.deepEqual(rest, []);
  assert.deepEqual(strip(filters), [
    { fieldName: "industrycode", operator: "Equal", values: ["692000"] },
    { fieldName: "BasicInfo.region", operator: "Equal", values: ["4"] },
    { fieldName: "employees", operator: "GreaterEqual", values: ["10"] },
  ]);
  assert.deepEqual(
    filters.map((f) => f.filterName),
    ["basic-industry", "geography-region", "basic-employees-value"],
  );
  assert.deepEqual(strip([...filters, DEFAULT_ACTIVE_STATUS_FILTER]).at(-1), {
    fieldName: "BasicInfo.CompanyStatus",
    operator: "Equal",
    values: ["Aktiv", "Normal"],
  });
});

test("flere værdier, datoer, status og ukendte felter", () => {
  const { criteria, unknown } = filtersToCriteria([
    { filterName: "basic-company-type", fieldName: "BasicInfo.formCode", operator: "Equal", values: ["110", "115", "130"] },
    { filterName: "basic-company-status", fieldName: "BasicInfo.CompanyStatus", operator: "Equal", values: ["UNDERTVANGSOPLØSNING"] },
    { filterName: "basic-creation-date", fieldName: "BasicInfo.CreationDate", operator: "Between", values: ["2010-01-01", "2015-12-31"] },
    { filterName: "geography-municipality", fieldName: "BasicInfo.municipalityCode", operator: "Equal", values: ["751", "461"] },
    { filterName: "something-new", fieldName: "Foo.Bar", operator: "Equal", values: ["1"] },
  ]);
  assert.deepEqual(criteria, [
    { field: "virksomhedsform", operator: "eq", value: "Forening" },
    { field: "status", operator: "eq", value: "under likvidation" },
    { field: "stiftet", operator: "between", value: ["2010-01-01", "2015-12-31"] },
    { field: "kommune", operator: "in", value: ["Aarhus", "Odense"] },
  ]);
  assert.deepEqual(unknown, ["something-new Equal 1"]);
});
