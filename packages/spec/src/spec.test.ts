import assert from "node:assert/strict";
import { test } from "node:test";
import {
  amountScale,
  personSearchKey,
  personTableRow,
  changeFeedKey,
  CHANGE_TYPES,
  COMPONENT_CATALOG,
  creditChange,
  creditRatingText,
  creditScoreWord,
  creditTone,
  currencyUnit,
  foldChangeEntries,
  type ChangeEntryVM,
  type ChangeType,
  isForeignCurrency,
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

test("group (30, mønster 8/9) er valgfri, og pattern skal være cards eller accordion", () => {
  const spec = parseViewSpec({
    title: "x",
    components: [
      { type: "LassoIncomeStatement", company: "CVR-1-1", group: { id: "regnskab", pattern: "accordion", title: "Regnskab" } },
      { type: "LassoBalanceSheet", company: "CVR-1-1", group: { id: "regnskab", pattern: "accordion" } },
      { type: "LassoNews", company: "CVR-1-1" },
    ],
  });
  assert.deepEqual(spec.components.map((c) => c.group?.pattern), ["accordion", "accordion", undefined]);
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoNews", company: "CVR-1-1", group: { id: "n", pattern: "tabs" } }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoNews", company: "CVR-1-1", group: { id: "", pattern: "cards" } }] }));
});

test("LassoContact og LassoContactPersons parses med standardbredde half", () => {
  const spec = parseViewSpec({
    title: "Kontakt",
    components: [
      { type: "LassoContact", company: "CVR-1-12345678" },
      { type: "LassoContactPersons", company: "CVR-1-12345678", title: "Kontaktpersoner" },
    ],
  });
  assert.deepEqual(spec.components.map((c) => c.type), ["LassoContact", "LassoContactPersons"]);
  assert.deepEqual(spec.components.map((c) => widthOf(c, spec.layout)), ["half", "half"]);
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

  // Risikoobservationer komponeres ikke (fjernet 27.09.2026), heller ikke ved alvorlige observationer.
  const risky = base();
  risky.observations[id] = { lassoId: id, observations: [{ id: "1", severity: 100, title: "Negativ egenkapital" }] };
  assert.ok(!composeCompany(id, risky).components.some((c) => c.type === "LassoRiskObservations"));

  // Kolonnerne er fyldt fra 1 uden huller.
  for (const spec of [mSpec, oSpec, none]) {
    const cols = [...new Set(spec.components.map((c) => c.column).filter(Boolean))].sort();
    assert.deepEqual(cols, cols.map((_, i) => i + 1));
  }
});

test("valuta: DKK giver stadig 'kr.', EUR/USD giver koden (bagudkompatibelt)", () => {
  assert.equal(currencyUnit(undefined), "kr.");
  assert.equal(currencyUnit("DKK"), "kr.");
  assert.equal(currencyUnit("eur"), "EUR");
  assert.equal(isForeignCurrency("DKK"), false);
  assert.equal(isForeignCurrency("USD"), true);
  assert.equal(formatAmount(18_822_000_000), "18,8 mia. kr.");
  assert.equal(formatAmount(18_822_000_000, currencyUnit("EUR")), "18,8 mia. EUR");
  assert.equal(formatMetricValue("omsaetning", 53_988_000_000, "USD"), "54 mia. USD");
  assert.equal(formatMetricValue("omsaetning", 12_500_000), "12,5 mio. kr.");
  assert.equal(formatMetricValue("ansatte", 42, "EUR"), "42");
  assert.equal(amountScale([117e9, 250e9], currencyUnit("EUR")).label, "mia. EUR");
});

test("LassoChangeFeed (katalog 21): schema, standardværdier, bredde og katalog", () => {
  const spec = parseViewSpec({ title: "Overvågning", components: [{ type: "LassoChangeFeed", list: "Kunder" }] });
  const c = spec.components[0]!;
  if (c.type !== "LassoChangeFeed") throw new Error("forkert type");
  assert.equal(c.days, 7);
  assert.equal(c.list, "Kunder");
  assert.equal(c.types, undefined);
  assert.equal(widthOf(c, "dashboard"), "full");
  assert.equal(changeFeedKey(c), "Kunder|7|");
  const typed = parseViewSpec({ title: "x", components: [{ type: "LassoChangeFeed", days: 30, types: ["status", "regnskab"] }] }).components[0]!;
  if (typed.type !== "LassoChangeFeed") throw new Error("forkert type");
  assert.equal(changeFeedKey(typed), "|30|status,regnskab");
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoChangeFeed", days: 0 }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoChangeFeed", days: 91 }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoChangeFeed", types: ["nyheder"] }] }));
  const entry = COMPONENT_CATALOG.find((e) => e.type === "LassoChangeFeed");
  assert.ok(entry);
  for (const part of ["Brug til:", "Brug ikke når:", "Kræver:", "Eksempel:"]) assert.ok(entry.description.includes(part), part);
  assert.deepEqual([...CHANGE_TYPES], ["regnskab", "ledelse", "ejerskab", "status", "stamdata", "kredit"]);
});

test("foldChangeEntries folder kun små ændringer (stamdata/kredit) af samme type samme dag, fra 3 stk., nyeste først", () => {
  const e = (companyName: string, type: ChangeType, at: string, text = "Antal ansatte opdateret", read = true): ChangeEntryVM => ({ companyName, type, text, at, source: "CVR", read });
  const folded = foldChangeEntries([
    e("A", "stamdata", "2026-09-24T06:00:00Z"),
    e("B", "stamdata", "2026-09-24T06:00:00Z", "Antal ansatte opdateret", false),
    e("C", "stamdata", "2026-09-24T06:00:00Z"),
    e("D", "stamdata", "2026-09-23T06:00:00Z"),
    e("E", "status", "2026-09-25T09:14:00Z", "Status ændret"),
    e("F", "status", "2026-09-25T09:10:00Z", "Status ændret"),
    e("G", "kredit", "2026-09-24T07:00:00Z", "Kreditscore ændret"),
    e("H", "kredit", "2026-09-24T07:00:00Z", "Kreditscore ændret"),
  ]);
  assert.deepEqual(
    folded.map((x) => `${x.companyName}:${x.count ?? 1}`),
    ["E:1", "F:1", "G:1", "H:1", "A:3", "D:1"],
  );
  const group = folded.find((x) => x.companyName === "A")!;
  assert.deepEqual(group.companies, ["A", "B", "C"]);
  assert.equal(group.read, false, "en foldet række er ulæst, når ét medlem er det");
  assert.equal(foldChangeEntries([]).length, 0);
});

test("LassoCreditRating (katalog 17): schema, bredde ½ og katalogtekst efter skabelonen", () => {
  const spec = parseViewSpec({ title: "Kredit", components: [{ type: "LassoCreditRating", company: "CVR-1-12345678" }] });
  const c = spec.components[0]!;
  assert.equal(c.type, "LassoCreditRating");
  assert.equal(widthOf(c, "dashboard"), "half");
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoCreditRating" }] }), "company er påkrævet");
  const entry = COMPONENT_CATALOG.find((e) => e.type === "LassoCreditRating");
  assert.ok(entry);
  for (const part of ["Brug til:", "Brug ikke når:", "Kræver:", "Eksempel:", "LassoScoreGauge", "låst"]) assert.ok(entry.description.includes(part), part);
});

test("Creditsafe-skalaen A–E: tone, ord, ændring og tekstlinje (blandes aldrig med 0–100)", () => {
  assert.deepEqual((["A", "B", "C", "D", "E"] as const).map(creditTone), ["ok", "ok", "warning", "danger", "danger"]);
  assert.deepEqual((["A", "B", "C", "D", "E"] as const).map((s) => creditScoreWord(s)), ["Meget lav risiko", "Lav risiko", "Moderat risiko", "Høj risiko", "Meget høj risiko"]);
  // Creditsafes egen beskrivelse vinder, på dansk når den er kendt, ellers som den står.
  assert.equal(creditScoreWord("B", "Low"), "Lav risiko");
  assert.equal(creditScoreWord("E", "Not Rated"), "Ikke vurderet");
  assert.equal(creditScoreWord("C", "Særlig vurdering"), "Særlig vurdering");
  // Stigning i risiko = ▲ dårligere, fald = ▼ bedre (datatyper del A, risikoskala).
  assert.deepEqual(creditChange("B", "C"), { direction: "better", arrow: "▼", word: "bedre" });
  assert.deepEqual(creditChange("D", "B"), { direction: "worse", arrow: "▲", word: "dårligere" });
  assert.equal(creditChange("B", "B")?.word, "uændret");
  assert.equal(creditChange("B", undefined), null);
  const base = { lassoId: "CVR-1-1", source: "Creditsafe via Lasso" };
  assert.equal(
    creditRatingText({ ...base, state: "ok", current: { internationalScore: "B", internationalDescription: "Low", creditMax: 250_000, creditCurrency: "DKK" }, previous: { internationalScore: "C" } }),
    "B, lav risiko, kreditmaksimum 250 t. kr., forrige C",
  );
  assert.equal(creditRatingText({ ...base, state: "ok", current: { internationalScore: "A", creditMax: 1_200_000, creditCurrency: "EUR" } }), "A, meget lav risiko, kreditmaksimum 1,2 mio. EUR");
  assert.equal(creditRatingText({ ...base, state: "locked" }), "låst: kræver Creditsafe-tilføjelse");
  assert.equal(creditRatingText({ ...base, state: "ok" }), "ikke oplyst");
});

test("LassoPersonTable (15.3): navn påkrævet, standard 25 rækker, personrækken fra PersonVM", () => {
  const spec = parseViewSpec({ title: "P", components: [{ type: "LassoPersonTable", query: "Mette Holm" }] });
  const c = spec.components[0]!;
  assert.equal(c.type, "LassoPersonTable");
  if (c.type === "LassoPersonTable") assert.equal(c.limit, 25);
  assert.throws(() => parseViewSpec({ title: "P", components: [{ type: "LassoPersonTable", query: "" }] }));
  const row = personTableRow({
    lassoId: "CVR-3-1",
    name: "Mette Eksempel",
    city: "København",
    birthYear: 1978,
    roles: [
      { companyName: "B Eksempel ApS", kind: "owner", role: "Ejer", share: "100 %", active: true },
      { companyName: "A Eksempel A/S", kind: "direction", role: "Direktør", active: true },
      { companyName: "C Eksempel A/S", kind: "board", role: "Bestyrelsesmedlem", active: false, companyStatus: "Under konkurs" },
    ],
  });
  assert.deepEqual(row.roles.map((r) => r.role), ["direktør", "ejer 100 %"]);
  assert.equal(row.bankruptcies, 1);
  assert.equal(personSearchKey({ query: " Mette Holm ", limit: 25 }), "mette holm|25");
});
