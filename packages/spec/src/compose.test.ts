import assert from "node:assert/strict";
import { test } from "node:test";
import { composeCompany, composeProbe, shortCompanyName } from "./compose.js";
import { composePerson } from "./composePerson.js";
import { emptyDataset, type Dataset, type FinancialYear } from "./models.js";
import { effectiveMetric, mainMetric } from "./series.js";
import { widthOf } from "./spec.js";

const id = "CVR-1-12345678";

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

/** Creditsafe-vurdering til komponisten (katalog 17). */
function withCredit(ds: Dataset, state: "ok" | "locked" = "ok"): Dataset {
  ds.creditRatings[id] =
    state === "ok"
      ? { lassoId: id, state, source: "Creditsafe via Lasso", current: { internationalScore: "B", creditMax: 250_000, creditCurrency: "DKK", localScore: 62 }, previous: { internationalScore: "C" } }
      : { lassoId: id, state, reason: "Kræver Creditsafe-tilføjelse til Lasso-abonnementet", source: "Creditsafe via Lasso" };
  return ds;
}

test("Creditsafe hentes kun til focus risiko: overblik og de andre fokus koster aldrig en kredit", () => {
  assert.ok(composeProbe(id, "risiko").components.some((c) => c.type === "LassoCreditRating"));
  for (const focus of ["overblik", "oekonomi", "regnskab", "ejerskab", "ledelse", "historik", "kontakt"] as const) {
    assert.ok(!composeProbe(id, focus).components.some((c) => c.type === "LassoCreditRating"), focus);
  }
});

test("risiko viser kreditvurderingen (½) øverst i kolonne 2 ved siden af oplysningerne, også låst", () => {
  for (const state of ["ok", "locked"] as const) {
    const spec = composeCompany(id, withCredit(company(), state), { focus: "risiko" });
    const credit = spec.components.find((c) => c.type === "LassoCreditRating");
    assert.ok(credit, state);
    assert.equal(credit.column, 2);
    assert.equal(widthOf(credit, spec.layout), "half");
    // Ingen risikoboks (fjernet 27.09.2026); Creditsafe er et eget element, aldrig en del af måleren.
    assert.ok(!spec.components.some((c) => c.type === "LassoRiskObservations"));
    assert.ok(!spec.components.some((c) => c.type === "LassoScoreGauge"));
    const col2 = spec.components.filter((c) => c.column === 2);
    assert.equal(col2[0]!.type, "LassoCreditRating");
  }
  // En hentningsfejl vises også (fejltilstand med "Prøv igen"), men uden data eller fejl står den ikke.
  const failed = company();
  failed.errors[`creditRating:${id}`] = "Lasso API svarede ikke i tide";
  assert.ok(composeCompany(id, failed, { focus: "risiko" }).components.some((c) => c.type === "LassoCreditRating"));
  assert.ok(!composeCompany(id, company(), { focus: "risiko" }).components.some((c) => c.type === "LassoCreditRating"));
});

test("overblik viser ikke kreditvurderingen, heller ikke når den findes i datasættet", () => {
  const spec = composeCompany(id, withCredit(company()), { focus: "overblik" });
  assert.ok(!spec.components.some((c) => c.type === "LassoCreditRating"));
  for (const focus of ["oekonomi", "ejerskab", "ledelse", "historik", "kontakt"] as const) {
    assert.ok(!composeCompany(id, withCredit(company()), { focus }).components.some((c) => c.type === "LassoCreditRating"), focus);
  }
  // Heller ikke for et konkursbo med en allerede hentet vurdering: kreditvurderingen hører til focus risiko.
  assert.ok(!composeCompany(id, withCredit(company("Under konkurs")), { focus: "overblik" }).components.some((c) => c.type === "LassoCreditRating"));
});

test("risikoobservationer komponeres ikke længere, uanset fokus og alvor", () => {
  const ds = company("Under konkurs");
  ds.observations[id] = { lassoId: id, observations: [{ id: "o1", title: "Selskabet er under konkurs", severity: 100 }] };
  for (const focus of ["overblik", "oekonomi", "regnskab", "ejerskab", "ledelse", "risiko", "historik", "kontakt"] as const) {
    assert.ok(!composeCompany(id, ds, { focus }).components.some((c) => c.type === "LassoRiskObservations"), focus);
    assert.ok(!composeProbe(id, focus).components.some((c) => c.type === "LassoRiskObservations"), focus);
  }
});
