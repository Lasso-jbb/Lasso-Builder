import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountScale,
  formatShare,
  ownershipGraphKey,
  percentChange,
  chartSeries,
  companyTemplate,
  formatScaled,
  formatAmount,
  formatCriterion,
  formatMetricValue,
  listTemplate,
  METRIC_FIELD,
  METRIC_KIND,
  METRIC_LABELS,
  METRICS,
  parseViewSpec,
  searchQuerySchema,
  toLassoId,
  validateCriteria,
  widthOf,
} from "./index.js";

test("toLassoId normaliserer CVR-numre", () => {
  assert.equal(toLassoId("12345678"), "CVR-1-12345678");
  assert.equal(toLassoId("1234 5678"), "CVR-1-12345678");
  assert.equal(toLassoId("CVR-1-12345678"), "CVR-1-12345678");
});

test("formatAmount bruger danske enheder", () => {
  assert.equal(formatAmount(12_500_000), "12,5 mio. kr.");
  assert.equal(formatAmount(950_000), "950 t. kr.");
  assert.equal(formatAmount(null), "—");
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

test("companyTemplate er ét cockpit i guidens rækkefølge og respekterer sections", () => {
  const full = companyTemplate("CVR-1-12345678");
  assert.equal(full.layout, "dashboard");
  assert.deepEqual(full.components.map((c) => c.type), [
    "LassoCompanyHead",
    "LassoKeyFigureCards",
    "LassoBarChart",
    "LassoKeyValueList",
    "LassoPersonList",
    "LassoOwnerList",
    "LassoFollowUps",
  ]);
  // Graf og stamdata står side om side, ledelse og ejere ligeså.
  assert.deepEqual(full.components.map((c) => widthOf(c, full.layout)), ["full", "full", "half", "half", "half", "half", "full"]);
  const small = companyTemplate("CVR-1-12345678", { sections: ["graf", "noegletal"] });
  assert.deepEqual(small.components.map((c) => c.type), ["LassoCompanyHead", "LassoKeyFigureCards", "LassoBarChart"]);
  // Uden stamdata står grafen ikke alene i en halv række.
  assert.equal(widthOf(small.components[2]!, small.layout), "full");
});

test("width er valgfri på alle komponenter, og stack giver altid fuld bredde", () => {
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoRelations", company: "CVR-1-1", width: "quarter" }, { type: "LassoTimeline", company: "CVR-1-1", width: "three-quarters" }] });
  assert.equal(spec.layout, "dashboard");
  assert.deepEqual(spec.components.map((c) => widthOf(c, spec.layout)), ["quarter", "three-quarters"]);
  assert.deepEqual(spec.components.map((c) => widthOf(c, "stack")), ["full", "full"]);
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoRelations", company: "CVR-1-1", width: "third" }] }));
});

test("listTemplate lægger kriterier i rammen og tabellen", () => {
  const search = searchQuerySchema.parse({ query: "revision", criteria: [{ field: "region", operator: "eq", value: "Midtjylland" }] });
  const spec = listTemplate(search);
  assert.equal(spec.kind, "list");
  assert.equal(spec.criteria.length, 1);
  assert.equal(spec.components[0]!.type, "LassoCompanyTable");
});

test("parseViewSpec afviser ukendte komponenter", () => {
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "Ukendt" }] }));
});

test("LassoKeyValueList, LassoMultiYearTable og LassoScoreGauge parses med standardværdier (katalog 09-10)", () => {
  const spec = parseViewSpec({
    title: "x",
    components: [
      { type: "LassoKeyValueList", company: "CVR-1-12345678" },
      { type: "LassoKeyValueList", company: "CVR-1-12345678", variant: "financials" },
      { type: "LassoMultiYearTable", company: "CVR-1-12345678" },
      { type: "LassoScoreGauge", company: "CVR-1-12345678" },
    ],
  });
  const [kv1, kv2, myt, gauge] = spec.components;
  assert.equal(kv1!.type, "LassoKeyValueList");
  assert.equal((kv1 as { variant: string }).variant, "company");
  assert.equal((kv2 as { variant: string }).variant, "financials");
  assert.equal((myt as { years: number }).years, 5);
  assert.equal(gauge!.type, "LassoScoreGauge");
});

test("parseViewSpec accepterer de nye graftyper i katalog 13 med deres standardværdier", () => {
  const spec = parseViewSpec({
    title: "Datavisualisering",
    components: [
      { type: "LassoGroupedBarChart", company: "CVR-1-12345678" },
      { type: "LassoStackedBarChart", company: "CVR-1-12345678" },
      { type: "LassoLineChart", company: "CVR-1-12345678" },
      { type: "LassoLineChart", company: "CVR-1-12345678", benchmark: "CVR-1-99999999" },
      { type: "LassoWaterfallChart", company: "CVR-1-12345678" },
      { type: "LassoShareBars", company: "CVR-1-12345678" },
      { type: "LassoRanking", companies: ["CVR-1-12345678", "CVR-1-87654321"] },
    ],
  });
  const [grouped, stacked, line, lineWithBench, waterfall, shareBars, ranking] = spec.components;
  assert.deepEqual(grouped, { type: "LassoGroupedBarChart", company: "CVR-1-12345678", metrics: ["omsaetning", "resultat"], years: 5 });
  assert.deepEqual(stacked, { type: "LassoStackedBarChart", company: "CVR-1-12345678", years: 5 });
  assert.deepEqual(line, { type: "LassoLineChart", company: "CVR-1-12345678", metric: "bruttofortjeneste", years: 5 });
  assert.deepEqual(lineWithBench, { type: "LassoLineChart", company: "CVR-1-12345678", metric: "bruttofortjeneste", years: 5, benchmark: "CVR-1-99999999" });
  assert.deepEqual(waterfall, { type: "LassoWaterfallChart", company: "CVR-1-12345678" });
  assert.deepEqual(shareBars, { type: "LassoShareBars", company: "CVR-1-12345678" });
  assert.deepEqual(ranking, { type: "LassoRanking", companies: ["CVR-1-12345678", "CVR-1-87654321"], metric: "bruttofortjeneste" });
});

test("LassoGroupedBarChart kræver 2–3 nøgletal og LassoRanking mindst 2 virksomheder", () => {
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoGroupedBarChart", company: "CVR-1-1", metrics: ["ansatte"] }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoGroupedBarChart", company: "CVR-1-1", metrics: ["ansatte", "resultat", "omsaetning", "egenkapital"] }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoRanking", companies: ["CVR-1-1"] }] }));
});

test("parseViewSpec accepterer de nye Paper-komponenter", () => {
  const spec = parseViewSpec({
    title: "Test",
    components: [
      { type: "LassoRelations", company: "CVR-1-1" },
      { type: "LassoBeneficialOwners", company: "CVR-1-1" },
      { type: "LassoTextSections", company: "CVR-1-1" },
      { type: "LassoSummary", text: "Et resumé." },
      { type: "LassoTimeline", company: "CVR-1-1" },
      { type: "LassoNews", company: "CVR-1-1" },
    ],
  });
  assert.equal(spec.components.length, 6);
  const summary = spec.components.find((c) => c.type === "LassoSummary");
  assert.equal(summary && summary.type === "LassoSummary" ? summary.source : undefined, "Lasso");
});

test("parseViewSpec accepterer LassoRiskObservations og LassoAuditorIndependence", () => {
  const spec = parseViewSpec({
    title: "Test",
    components: [
      { type: "LassoRiskObservations", company: "CVR-1-12345678" },
      { type: "LassoAuditorIndependence", company: "CVR-1-12345678", title: "Uafhængighed" },
    ],
  });
  assert.deepEqual(spec.components.map((c) => c.type), ["LassoRiskObservations", "LassoAuditorIndependence"]);
});

test("amountScale giver én enhed for en række beløb", () => {
  const scale = amountScale([117_142_000_000, 250_276_000_000]);
  assert.equal(scale.label, "mia. kr.");
  assert.equal(formatScaled(250_276_000_000, scale), "250,3");
  assert.equal(formatScaled(176_954_000_000, scale), "177,0");
  assert.equal(amountScale([41_100_000, 400_000]).label, "mio. kr.");
  assert.equal(formatScaled(950_000, amountScale([950_000])), "950");
});

test("chartSeries viser bruttofortjeneste, når omsætningen stopper før seneste regnskab", () => {
  const y = (year: number, revenue: number | null, grossProfit: number) => ({ year, revenue, grossProfit, profit: null, equity: null, employees: null });
  const f = { lassoId: "x", currency: "DKK", years: [y(2018, 3.9e6, 5e6), y(2019, 6.8e6, 7e6), y(2025, null, 18.8e6)] };
  assert.equal(chartSeries(f, "omsaetning", 10).metric, "bruttofortjeneste");
  const full = { ...f, years: [y(2024, 290e9, 245e9), y(2025, 309e9, 250e9)] };
  assert.deepEqual(chartSeries(full, "omsaetning", 10), { metric: "omsaetning", points: [{ year: 2024, value: 290e9 }, { year: 2025, value: 309e9 }] });
});

test("percentChange giver ingen procent ved skift mellem overskud og underskud", () => {
  assert.equal(percentChange([113_000, -201_000]), null);
  assert.equal(percentChange([-100, 50]), null);
  assert.equal(Math.round(percentChange([100, 150])!), 50);
});

test("LassoOwnershipDiagram har standarddybde 2 op og 1 ned og en stabil nøgle", () => {
  const spec = parseViewSpec({ title: "Ejere", components: [{ type: "LassoOwnershipDiagram", company: "CVR-1-12345678" }] });
  const c = spec.components[0]!;
  assert.equal(c.type, "LassoOwnershipDiagram");
  if (c.type !== "LassoOwnershipDiagram") return;
  assert.equal(c.ingoingDepth, 2);
  assert.equal(c.outgoingDepth, 1);
  assert.equal(ownershipGraphKey(c), "CVR-1-12345678|2|1|");
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoOwnershipDiagram", company: "CVR-1-1", onDate: "25.09.2026" }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoOwnershipDiagram", company: "CVR-1-1", ingoingDepth: 11 }] }));
});

test("parseViewSpec accepterer katalog 19 (LassoIncomeStatement, LassoBalanceSheet, LassoCashFlow) med standardværdier", () => {
  const spec = parseViewSpec({
    title: "Regnskab",
    components: [
      { type: "LassoIncomeStatement", company: "CVR-1-12345678" },
      { type: "LassoBalanceSheet", company: "CVR-1-12345678", years: 3 },
      { type: "LassoCashFlow", company: "CVR-1-12345678", title: "Pengestrøm" },
    ],
  });
  const [income, balance, cashFlow] = spec.components;
  assert.deepEqual(income, { type: "LassoIncomeStatement", company: "CVR-1-12345678", years: 2 });
  assert.deepEqual(balance, { type: "LassoBalanceSheet", company: "CVR-1-12345678", years: 3 });
  assert.deepEqual(cashFlow, { type: "LassoCashFlow", company: "CVR-1-12345678", years: 2, title: "Pengestrøm" });
  assert.deepEqual(spec.components.map((c) => widthOf(c, spec.layout)), ["full", "full", "full"]);
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoIncomeStatement", company: "CVR-1-1", years: 4 }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoBalanceSheet", company: "CVR-1-1", years: 1 }] }));
});

test("de nye nøgletal (katalog 19) er i METRICS med label, felt og formatterings-art", () => {
  const nye = ["ebitda", "balancesum", "gaeld", "soliditetsgrad", "overskudsgrad", "likviditetsgrad"] as const;
  for (const m of nye) {
    assert.ok(METRICS.includes(m), `${m} skal stå i METRICS`);
    assert.ok(METRIC_LABELS[m], `${m} skal have et label`);
    assert.ok(METRIC_FIELD[m], `${m} skal pege på et felt`);
  }
  assert.equal(METRIC_KIND.ebitda, "amount");
  assert.equal(METRIC_KIND.balancesum, "amount");
  assert.equal(METRIC_KIND.gaeld, "amount");
  assert.equal(METRIC_KIND.soliditetsgrad, "percent");
  assert.equal(METRIC_KIND.overskudsgrad, "percent");
  assert.equal(METRIC_KIND.likviditetsgrad, "percent");
  assert.equal(METRIC_KIND.ansatte, "count");
});

test("formatMetricValue formaterer efter METRIC_KIND (beløb, antal, procent) og viser — når værdien mangler", () => {
  assert.equal(formatMetricValue("resultat", 12_500_000), "12,5 mio. kr.");
  assert.equal(formatMetricValue("ansatte", 42), "42");
  assert.equal(formatMetricValue("soliditetsgrad", 34.5), "34,5 %");
  assert.equal(formatMetricValue("ebitda", null), "—");
  assert.equal(formatMetricValue("likviditetsgrad", undefined), "—");
});

test("formatShare skriver CVR-intervaller", () => {
  assert.equal(formatShare([20, 24.99]), "20–24,99 %");
  assert.equal(formatShare([100, 100]), "100 %");
  assert.equal(formatShare([66.67, 89.99]), "66,67–89,99 %");
  assert.equal(formatShare(undefined), "—");
});

test("komponisten vælger form efter datas form, ikke efter en fast skabelon", async () => {
  const { composeCompany, emptyDataset } = await import("./index.js");
  const id = "CVR-1-12345678";
  const base = () => {
    const ds = emptyDataset("demo");
    ds.companies[id] = { lassoId: id, name: "Test A/S" };
    ds.people[id] = [{ name: "Anne", role: "Direktør" }];
    ds.ownership[id] = { lassoId: id, owners: [{ name: "Holding ApS", kind: "company", share: "100 %" }] };
    return ds;
  };
  const year = (y: number) => ({ year: y, revenue: 100 + y, grossProfit: 50, profit: 10, equity: 30, employees: 5 });

  // Mange regnskabsår: graf. Ét år: alle tal for året i stedet.
  const many = base();
  many.financials[id] = { lassoId: id, currency: "DKK", years: [2021, 2022, 2023, 2024, 2025].map(year) };
  const one = base();
  one.financials[id] = { lassoId: id, currency: "DKK", years: [year(2025)] };
  const mSpec = composeCompany(id, many);
  const oSpec = composeCompany(id, one);
  assert.ok(mSpec.components.some((c) => c.type === "LassoBarChart"));
  assert.ok(!oSpec.components.some((c) => c.type === "LassoBarChart"));
  assert.ok(oSpec.components.some((c) => c.type === "LassoKeyValueList" && c.variant === "financials"));

  // Ingen regnskaber: ingen nøgletal og ingen graf.
  const none = composeCompany(id, base());
  assert.ok(!none.components.some((c) => c.type === "LassoKeyFigureCards"));

  // Nyheder kun når der er nogen.
  const withNews = base();
  withNews.news[id] = { lassoId: id, items: [{ source: "Avis", headline: "Nyt" }] };
  assert.ok(composeCompany(id, withNews).components.some((c) => c.type === "LassoNews"));
  assert.ok(!composeCompany(id, base()).components.some((c) => c.type === "LassoNews"));

  // Ejerskab: en koncern (selskab som ejer) giver ejerdiagram; kun personer gør ikke.
  assert.ok(composeCompany(id, base(), { focus: "ejerskab" }).components.some((c) => c.type === "LassoOwnershipDiagram"));
  const persons = base();
  persons.ownership[id] = { lassoId: id, owners: [{ name: "Bo", kind: "person", share: "100 %" }] };
  assert.ok(!composeCompany(id, persons, { focus: "ejerskab" }).components.some((c) => c.type === "LassoOwnershipDiagram"));

  // Alvorlig risiko står øverst, også uden risikofokus.
  const risky = base();
  risky.observations[id] = { lassoId: id, observations: [{ id: "1", severity: 100, title: "Negativ egenkapital" }] };
  assert.equal(composeCompany(id, risky).components[1]!.type, "LassoRiskObservations");

  // Kolonnerne er fyldt fra 1 uden huller.
  for (const spec of [mSpec, oSpec, none]) {
    const cols = [...new Set(spec.components.map((c) => c.column).filter(Boolean))].sort();
    assert.deepEqual(cols, cols.map((_, i) => i + 1));
  }
});
