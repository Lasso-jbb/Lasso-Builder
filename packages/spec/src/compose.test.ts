import assert from "node:assert/strict";
import { test } from "node:test";
import { composeCompany, shortCompanyName } from "./compose.js";
import { composePerson } from "./composePerson.js";
import { emptyDataset, type Dataset, type FinancialYear } from "./models.js";
import { mergedObservations, riskSignals } from "./riskSignals.js";
import { effectiveMetric, mainMetric } from "./series.js";

const id = "CVR-1-12345678";
const NOW = new Date("2026-09-26T12:00:00Z");

function company(status = "Normal", founded = "2010-01-01"): Dataset {
  const ds = emptyDataset("demo");
  ds.companies[id] = { lassoId: id, name: "TEST ApS", status, founded };
  ds.people[id] = [{ name: "Anne", role: "Direktør", from: "2015-01-01" }];
  ds.ownership[id] = { lassoId: id, owners: [{ name: "Bo", kind: "person", share: "100 %" }] };
  return ds;
}

/** Lasso X-mønstret: omsætning oplyst 2012–2019, derefter kun bruttofortjeneste. */
function lassoXYears(): FinancialYear[] {
  return Array.from({ length: 14 }, (_, i) => {
    const year = 2012 + i;
    return { year, revenue: year <= 2019 ? 1_000_000 * i : null, grossProfit: 500_000 * i, profit: 100_000, equity: 1_000_000, employees: 10 };
  });
}

test("mainMetric vælger ud fra de seneste år, ikke antal år i alt (Lasso X)", () => {
  const years = lassoXYears();
  assert.equal(mainMetric(years), "bruttofortjeneste");
  assert.equal(effectiveMetric(years, "omsaetning"), "bruttofortjeneste");
  // Omsætning i seneste regnskab: omsætning.
  const withRevenue = years.map((y) => ({ ...y, revenue: 2_000_000 }));
  assert.equal(mainMetric(withRevenue), "omsaetning");
  // Omsætning i 2 af de seneste 3 år (seneste mangler, og der er ingen bruttofortjeneste): omsætning.
  const gaps = [{ year: 2023, revenue: 1 }, { year: 2024, revenue: 2 }, { year: 2025, revenue: null }] as FinancialYear[];
  assert.equal(mainMetric(gaps), "omsaetning");
  assert.equal(mainMetric([]), "bruttofortjeneste");
});

test("komponisten viser aldrig 'Omsætning – Ikke oplyst' først, og grafen når frem til seneste år", () => {
  const ds = company();
  ds.financials[id] = { lassoId: id, currency: "DKK", years: lassoXYears() };
  for (const focus of ["overblik", "oekonomi"] as const) {
    const spec = composeCompany(id, ds, { focus });
    const cards = spec.components.find((c) => c.type === "LassoKeyFigureCards");
    assert.ok(cards && cards.type === "LassoKeyFigureCards");
    assert.equal(cards.metrics![0], "bruttofortjeneste", focus);
    assert.ok(!cards.metrics!.includes("omsaetning"), focus);
    const chart = spec.components.find((c) => c.type === "LassoBarChart" || c.type === "LassoGroupedBarChart");
    assert.ok(chart, focus);
    if (chart?.type === "LassoGroupedBarChart") assert.deepEqual(chart.metrics, ["bruttofortjeneste", "resultat"]);
    if (chart?.type === "LassoBarChart") assert.equal(chart.metric, "bruttofortjeneste");
  }
  // Uden omsætning i seneste år er vandfaldet "Fra omsætning til resultat" udeladt.
  assert.ok(!composeCompany(id, ds, { focus: "oekonomi" }).components.some((c) => c.type === "LassoWaterfallChart"));
});

test("fordelingen af balancen kræver gæld eller balancesum, ikke kun egenkapital", () => {
  const ds = company();
  const years = lassoXYears();
  ds.financials[id] = { lassoId: id, currency: "DKK", years };
  assert.ok(!composeCompany(id, ds, { focus: "oekonomi" }).components.some((c) => c.type === "LassoShareBars"));
  ds.financials[id] = { lassoId: id, currency: "DKK", years: years.map((y) => ({ ...y, assetsTotal: 5_000_000 })) };
  assert.ok(composeCompany(id, ds, { focus: "oekonomi" }).components.some((c) => c.type === "LassoShareBars"));
});

test("riskSignals: under konkurs er vigtig (100), opløst er mulig vigtig (50)", () => {
  const konkurs = riskSignals(id, company("Under konkurs"), NOW);
  assert.equal(konkurs.signals[0]!.severity, 100);
  assert.match(konkurs.signals[0]!.title, /Under konkurs/);
  assert.equal(riskSignals(id, company("Under tvangsopløsning"), NOW).signals[0]!.severity, 100);
  assert.equal(riskSignals(id, company("Opløst efter spaltning"), NOW).signals[0]!.severity, 50);
  assert.equal(riskSignals(id, company("Normal"), NOW).signals.length, 0);
});

test("riskSignals: negativ egenkapital, underskud i træk og manglende regnskab", () => {
  const ds = company();
  const y = (year: number, profit: number, equity: number): FinancialYear => ({ year, profit, equity, grossProfit: 1 });
  ds.financials[id] = { lassoId: id, currency: "DKK", years: [y(2022, 5, 10), y(2023, -1, 5), y(2024, -2, 3), y(2025, -3, -752_000)] };
  const s = riskSignals(id, ds, NOW).signals;
  const by = (key: string) => s.find((x) => x.id === `afledt:${key}`);
  assert.equal(by("egenkapital")?.severity, 50);
  assert.equal(by("underskud")?.severity, 50);
  assert.equal(by("underskud")?.title, "Underskud 3 år i træk");
  assert.equal(by("regnskab"), undefined);

  ds.financials[id] = { lassoId: id, currency: "DKK", years: [y(2024, -1, 5), y(2025, -2, 3)] };
  assert.equal(riskSignals(id, ds, NOW).signals.find((x) => x.id === "afledt:underskud")?.severity, 25);

  // Seneste regnskab for 2021 i 2026: mangler.
  ds.financials[id] = { lassoId: id, currency: "DKK", years: [y(2021, 1, 5)] };
  assert.equal(riskSignals(id, ds, NOW).signals.find((x) => x.id === "afledt:regnskab")?.severity, 50);
  // Et nystiftet selskab uden regnskab er ikke et signal.
  const young = company("Normal", "2026-01-01");
  young.financials[id] = { lassoId: id, currency: "DKK", years: [] };
  assert.equal(riskSignals(id, young, NOW).signals.length, 0);
});

test("riskSignals: revisorskift for nylig og mange ledelsesskift (25)", () => {
  const ds = company();
  ds.ownership[id] = { lassoId: id, owners: [], auditor: { name: "Revisor ApS", from: "2026-05-01" } };
  ds.people[id] = [
    { name: "A", role: "Direktør", from: "2025-01-01" },
    { name: "B", role: "Direktør", from: "2020-01-01", to: "2025-01-01" },
    { name: "C", role: "Bestyrelsesmedlem", from: "2025-06-01" },
    { name: "D", role: "Bestyrelsesmedlem", from: "2019-01-01", to: "2025-06-01" },
  ];
  const s = riskSignals(id, ds, NOW);
  assert.equal(s.signals.find((x) => x.id === "afledt:revisor")?.severity, 25);
  assert.equal(s.signals.find((x) => x.id === "afledt:ledelse")?.severity, 25);
  assert.deepEqual(s.checked, ["status", "revisor", "ledelse"]);
});

test("et selskab under konkurs får altid risikoboksen, også når Lassos observationer er tomme (TIGA)", () => {
  const ds = company("Under konkurs");
  ds.people[id] = [];
  ds.observations[id] = { lassoId: id, observations: [] };
  ds.financials[id] = { lassoId: id, currency: "DKK", years: [{ year: 2024, equity: -752_000, profit: -70_000, grossProfit: -36_000 }] };
  for (const focus of ["overblik", "risiko", "oekonomi"] as const) {
    const spec = composeCompany(id, ds, { focus });
    assert.equal(spec.components[1]!.type, "LassoRiskObservations", focus);
  }
  const merged = mergedObservations(id, ds, NOW);
  assert.equal(merged.observations[0]!.severity, 100);
  // Ingen "ingen ledelse"-signal for et konkursbo (forventeligt) og ingen dubletter.
  assert.ok(!merged.observations.some((o) => o.id === "afledt:ingen-ledelse"));
});

test("mergedObservations: Lassos egen observation om samme emne vinder over den afledte", () => {
  const ds = company("Under konkurs");
  ds.observations[id] = { lassoId: id, observations: [{ id: "l1", severity: 100, title: "Selskabet er under konkurs" }] };
  const merged = mergedObservations(id, ds, NOW);
  assert.deepEqual(merged.observations.map((o) => o.id), ["l1"]);
});

test("ejerskab gentager ikke ejerne i relationer, kontakt viser CVR-ledelsen uden kontaktpersoner", () => {
  const ds = company();
  const own = composeCompany(id, ds, { focus: "ejerskab" });
  assert.ok(!own.components.some((c) => c.type === "LassoRelations"));
  assert.ok(own.components.some((c) => c.type === "LassoPersonList"));
  const contact = composeCompany(id, ds, { focus: "kontakt" });
  assert.ok(contact.components.some((c) => c.type === "LassoPersonList" && c.title === "Ledelse (CVR)"));
});

test("opfølgninger bruger kortnavnet, ikke det juridiske navn i versaler", () => {
  assert.equal(shortCompanyName("NOVO NORDISK A/S"), "Novo Nordisk");
  assert.equal(shortCompanyName("Lasso X A/S"), "Lasso X");
  assert.equal(shortCompanyName("OBTON SOLENERGI SAN BENEDETTO I KOMPLEMENTARANPARTSSELSKAB"), "Obton Solenergi San Benedetto I");
  const ds = company();
  ds.companies[id]!.name = "NOVO NORDISK A/S";
  ds.financials[id] = { lassoId: id, currency: "DKK", years: lassoXYears() };
  const spec = composeCompany(id, ds, { name: "NOVO NORDISK A/S" });
  const f = spec.components.find((c) => c.type === "LassoFollowUps");
  assert.ok(f && f.type === "LassoFollowUps");
  assert.match(f.prompts[0]!.prompt, /for Novo Nordisk\?/);
});

test("personsiden har opfølgninger (review P2-5)", () => {
  const ds = emptyDataset("demo");
  const pid = "CVR-3-4000000001";
  ds.persons[pid] = {
    lassoId: pid,
    name: "Mette Holm",
    roles: [{ companyId: id, companyName: "TEST ApS", kind: "direction", role: "Direktør", from: "2015-01-01", active: true }],
  } as Dataset["persons"][string];
  const spec = composePerson(pid, ds);
  const f = spec.components.find((c) => c.type === "LassoFollowUps");
  assert.ok(f && f.type === "LassoFollowUps");
  assert.ok(f.prompts.some((p) => /Mette/.test(p.prompt)));
  assert.equal(composePerson(pid, ds, { followUps: false }).components.some((c) => c.type === "LassoFollowUps"), false);
});
