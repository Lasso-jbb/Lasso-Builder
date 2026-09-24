import assert from "node:assert/strict";
import { test } from "node:test";
import type { CompanyRowVM } from "@lasso/spec";
import { applyCriteria, evaluate, sortRows } from "./criteria-eval.js";

const row = (o: Partial<CompanyRowVM>): CompanyRowVM => ({ lassoId: "x", name: "X", ...o });

test("gt er strengt større end, gte er større end eller lig med", () => {
  const r = row({ revenue: 10_000_000 });
  assert.equal(evaluate(r, { field: "omsaetning", operator: "gt", value: 10_000_000 }), false);
  assert.equal(evaluate(r, { field: "omsaetning", operator: "gte", value: 10_000_000 }), true);
});

test("between er inklusiv og tåler omvendt rækkefølge", () => {
  const r = row({ employees: 49 });
  assert.equal(evaluate(r, { field: "ansatte", operator: "between", value: [49, 10] }), true);
});

test("felter uden data rapporteres som ikke understøttet i stedet for at fjerne alt", () => {
  const rows = [row({ name: "A" }), row({ name: "B" })];
  const out = applyCriteria(rows, [{ field: "revisor", operator: "contains", value: "Deloitte" }]);
  assert.equal(out.rows.length, 2);
  assert.equal(out.unsupported.length, 1);
});

test("status 'aktiv' matcher Lassos statustekster", () => {
  assert.equal(evaluate(row({ status: "Normal" }), { field: "status", operator: "eq", value: "aktiv" }), true);
  assert.equal(evaluate(row({ status: "Ophørt" }), { field: "status", operator: "eq", value: "aktiv" }), false);
});

test("sortering lægger tomme værdier sidst", () => {
  const sorted = sortRows([row({ name: "A", revenue: null }), row({ name: "B", revenue: 5 }), row({ name: "C", revenue: 9 })], { field: "omsaetning", direction: "desc" });
  assert.deepEqual(sorted.map((r) => r.name), ["C", "B", "A"]);
});
