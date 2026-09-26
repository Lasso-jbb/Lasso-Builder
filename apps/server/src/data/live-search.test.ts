import assert from "node:assert/strict";
import { test } from "node:test";
import { searchQuerySchema } from "@lasso/spec";
import { loadConfig } from "../config.js";
import type { LassoClient } from "../lasso/client.js";
import { LiveProvider } from "./live.js";

// Falsk klient: tre revisorer i stigende rækkefølge efter ansatte, som Lasso sorterer.
const COMPANIES: Record<string, { name: string; employees: number; revenue: number | null }> = {
  "CVR-1-1": { name: "Lille Revision ApS", employees: 10, revenue: 5_000_000 },
  "CVR-1-2": { name: "Mellem Revision A/S", employees: 40, revenue: null },
  "CVR-1-3": { name: "Stor Revision P/S", employees: 300, revenue: 90_000_000 },
};
function fakeClient(calls: unknown[]) {
  return {
    hasSearchCredentials: true,
    async searchByFilters(filters: unknown, orderBy?: string) {
      calls.push({ filters, orderBy });
      return { results: ["CVR-1-1", "CVR-1-2", "CVR-1-3"], resultsFound: 3, totalPages: 1 };
    },
    async searchPrompt(text: string) {
      if (text === "Novo Nordisk") throw new Error("500");
      return [
        { filterName: "basic-industry", fieldName: "industrycode", operator: "Equal", values: ["692000"] },
        { filterName: "ContactConfiguration", fieldName: "ContactRoles", operator: "ContactConfiguration", values: [] },
      ];
    },
    async company(id: string) {
      const c = COMPANIES[id]!;
      return { lassoId: id, cvr: id.slice(6), name: c.name, status: "Normal", employees: { count: c.employees }, address: { postalCode: 8000, postalDistrict: "Aarhus C" } };
    },
    async reports(id: string) {
      const c = COMPANIES[id]!;
      return [{ lassoId: id, reportYear: 2025, period: { to: "2025-12-31" }, data: { company: { facts: { incomeStatement: { facts: { revenue: { value: c.revenue }, grossProfit: { value: 1_000_000 } } } } } } }];
    },
  } as unknown as LassoClient;
}

test("kriterier søges hos Lasso, og faldende sortering vendes", async () => {
  const calls: unknown[] = [];
  const provider = new LiveProvider(fakeClient(calls), loadConfig({}));
  const q = searchQuerySchema.parse({
    criteria: [{ field: "region", operator: "eq", value: "Midtjylland" }, { field: "ansatte", operator: "gte", value: 10 }],
    sort: { field: "ansatte", direction: "desc" },
    limit: 2,
  });
  const r = await provider.search(q);
  assert.equal(r.source, "lasso-search");
  assert.equal(r.total, 3);
  assert.deepEqual(r.rows.map((x) => x.name), ["Stor Revision P/S", "Mellem Revision A/S"]);
  assert.deepEqual(calls[0], {
    orderBy: "employees",
    filters: [
      { filterName: "geography-region", fieldName: "BasicInfo.region", fieldNames: null, fallbackFields: null, operator: "Equal", values: ["4"] },
      { filterName: "basic-employees-value", fieldName: "employees", fieldNames: null, fallbackFields: null, operator: "GreaterEqual", values: ["10"] },
      // Standardfilter: ingen statuskriterie givet, så kun aktive virksomheder søges (P1-5).
      { filterName: "basic-company-status", fieldName: "BasicInfo.CompanyStatus", fieldNames: null, fallbackFields: null, operator: "Equal", values: ["Aktiv", "Normal"] },
    ],
  });
  assert.match(r.note ?? "", /Kun aktive virksomheder/);
});

test("et statuskriterie fra brugeren fortrænger standardfilteret", async () => {
  const calls: unknown[] = [];
  const provider = new LiveProvider(fakeClient(calls), loadConfig({}));
  const q = searchQuerySchema.parse({
    criteria: [
      { field: "region", operator: "eq", value: "Midtjylland" },
      { field: "status", operator: "eq", value: "ophørt" },
    ],
  });
  const r = await provider.search(q);
  const filters = (calls[0] as { filters: { filterName: string }[] }).filters;
  assert.deepEqual(
    filters.map((f) => f.filterName),
    ["geography-region", "basic-company-status"],
  );
  assert.doesNotMatch(r.note ?? "", /Kun aktive virksomheder/);
});

test("det, Lasso ikke kan filtrere på, anvendes lokalt", async () => {
  const provider = new LiveProvider(fakeClient([]), loadConfig({}));
  const q = searchQuerySchema.parse({
    criteria: [{ field: "branchekode", operator: "eq", value: "692000" }, { field: "omsaetning", operator: "gt", value: 10_000_000 }],
  });
  const r = await provider.search(q);
  assert.deepEqual(r.rows.map((x) => x.name), ["Stor Revision P/S"]);
  assert.equal(r.total, 1);
});

test("interpret giver kriterier fra prompt-søgningen og null for navne", async () => {
  const provider = new LiveProvider(fakeClient([]), loadConfig({}));
  assert.deepEqual(await provider.interpret("revisorer"), { criteria: [{ field: "branchekode", operator: "eq", value: "692000" }], unknown: [] });
  assert.equal(await provider.interpret("Novo Nordisk"), null);
});
