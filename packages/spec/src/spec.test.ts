import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountScale,
  companyTemplate,
  formatScaled,
  formatAmount,
  formatCriterion,
  listTemplate,
  parseViewSpec,
  searchQuerySchema,
  toLassoId,
  validateCriteria,
} from "./index.js";

test("toLassoId normaliserer CVR-numre", () => {
  assert.equal(toLassoId("12345678"), "CVR-1-12345678");
  assert.equal(toLassoId("1234 5678"), "CVR-1-12345678");
  assert.equal(toLassoId("CVR-1-12345678"), "CVR-1-12345678");
});

test("formatAmount bruger danske enheder", () => {
  assert.equal(formatAmount(12_500_000), "12,5 mio. kr.");
  assert.equal(formatAmount(950_000), "950 t. kr.");
  assert.equal(formatAmount(null), "–");
});

test("formatCriterion bruger én fælles operatorliste og skelner gt og gte", () => {
  assert.equal(formatCriterion({ field: "omsaetning", operator: "gt", value: 10_000_000 }), "Omsætning er større end 10 mio. kr.");
  assert.equal(formatCriterion({ field: "ansatte", operator: "gte", value: 50 }), "Ansatte er mindst 50");
  assert.equal(formatCriterion({ field: "ansatte", operator: "between", value: [10, 49] }), "Ansatte er mellem 10 og 49");
  assert.equal(formatCriterion({ field: "region", operator: "eq", value: "Midtjylland" }), "Region: Midtjylland");
  assert.equal(
    formatCriterion({ field: "status", operator: "in", value: ["aktiv", "ophørt", "under konkurs", "under likvidation"] }),
    "Status: aktiv, ophørt og 2 flere",
  );
  assert.equal(formatCriterion({ field: "stiftet", operator: "after", value: "2015-03-01" }), "Stiftet efter den 01.03.2015");
  assert.equal(formatCriterion({ field: "stiftet", operator: "eq", value: "2015-03-01" }), "Stiftet præcis den 01.03.2015");
});

test("validateCriteria fanger forkerte felter, operatorer og værdier", () => {
  const issues = validateCriteria([
    { field: "findesikke", operator: "eq", value: 1 },
    { field: "region", operator: "gt", value: "Midtjylland" },
    { field: "region", operator: "eq", value: "Midt" },
    { field: "omsaetning", operator: "between", value: 5 },
    { field: "region", operator: "in", value: ["Midtjylland", "Nordjylland"] },
  ]);
  assert.deepEqual(issues.map((i) => i.index), [0, 1, 2, 3]);
});

test("companyTemplate har låst rækkefølge og respekterer sections", () => {
  const full = companyTemplate("CVR-1-12345678");
  assert.deepEqual(full.components.map((c) => c.type), [
    "LassoCompanyHeader",
    "LassoKeyFigures",
    "LassoFinancialChart",
    "LassoPeopleList",
    "LassoOwnership",
    "LassoActions",
  ]);
  const small = companyTemplate("CVR-1-12345678", { sections: ["graf", "noegletal"] });
  assert.deepEqual(small.components.map((c) => c.type), ["LassoCompanyHeader", "LassoKeyFigures", "LassoFinancialChart"]);
});

test("listTemplate lægger kriterier i rammen og tabellen", () => {
  const search = searchQuerySchema.parse({ query: "revision", criteria: [{ field: "region", operator: "eq", value: "Midtjylland" }] });
  const spec = listTemplate(search);
  assert.equal(spec.kind, "list");
  assert.equal(spec.criteria.length, 1);
  assert.equal(spec.components[0]!.type, "LassoTable");
});

test("parseViewSpec afviser ukendte komponenter", () => {
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "Ukendt" }] }));
});

test("amountScale giver én enhed for en række beløb", () => {
  const scale = amountScale([117_142_000_000, 250_276_000_000]);
  assert.equal(scale.label, "mia. kr.");
  assert.equal(formatScaled(250_276_000_000, scale), "250,3");
  assert.equal(formatScaled(176_954_000_000, scale), "177,0");
  assert.equal(amountScale([41_100_000, 400_000]).label, "mio. kr.");
  assert.equal(formatScaled(950_000, amountScale([950_000])), "950");
});
