import assert from "node:assert/strict";
import { test } from "node:test";
import { companyFacts } from "./companyFacts.js";
import { componentWeight, composeCompany, composeProbe, FOCUSES, shortCompanyName } from "./compose.js";
import { composePerson } from "./composePerson.js";
import { emptyDataset, type Dataset, type FinancialYear } from "./models.js";
import { effectiveMetric, mainMetric } from "./series.js";
import { viewSpecSchema, widthOf, type ViewComponent, type ViewSpec } from "./spec.js";
import { textSectionsFor } from "./textSections.js";

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

/** Sidens elementer med plads: "Type@kolonne" for en halv, "Type" for fuld bredde (uden opfølgning). */
const placed = (spec: ViewSpec) => spec.components.filter((c) => c.type !== "LassoFollowUps").map((c) => `${c.type}${c.column ? `@${c.column}` : ""}`);

test("ejerskab og kontakt låner ikke ledelsen som fyld; et element alene står i fuld bredde", () => {
  const ds = company();
  // Ejerskab uden reelle ejere: ejerlisten alene i fuld bredde, ingen relationer eller ledelse.
  assert.deepEqual(placed(composeCompany(id, ds, { focus: "ejerskab" })), ["LassoCompanyHead", "LassoOwnerList"]);
  ds.beneficialOwnership[id] = { lassoId: id, owners: [{ name: "Bo", share: "100 %" }] };
  assert.deepEqual(placed(composeCompany(id, ds, { focus: "ejerskab" })), ["LassoCompanyHead", "LassoOwnerList@1", "LassoBeneficialOwners@2"]);
  // Ingen ejere: ejerlistens tomme tilstand er svaret, stadig ikke ledelsen i stedet.
  const none = company();
  none.ownership[id] = { lassoId: id, owners: [] };
  assert.deepEqual(placed(composeCompany(id, none, { focus: "ejerskab" })), ["LassoCompanyHead", "LassoOwnerList"]);
  // Kontakt uden kontaktpersoner: kontaktblokken alene i fuld bredde, ingen "Ledelse (CVR)" eller oplysninger.
  assert.deepEqual(placed(composeCompany(id, ds, { focus: "kontakt" })), ["LassoCompanyHead", "LassoContact"]);
  ds.contactPersons[id] = { lassoId: id, people: [{ name: "Bo", role: "Direktør" }] };
  assert.deepEqual(placed(composeCompany(id, ds, { focus: "kontakt" })), ["LassoCompanyHead", "LassoContact@1", "LassoContactPersons@2"]);
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

/** Revisoruafhængighed til komponisten (risiko). */
function withAuditor(ds: Dataset): Dataset {
  ds.auditorIndependence[id] = { lassoId: id, auditorName: "Revisor ApS", relations: [{ id: "r1", assessment: 50, name: "Bo", relation: "Tidligere ansat hos revisor" }] };
  return ds;
}

test("risiko: kreditvurdering (½) | revisoruafhængighed (½), også låst; intet lånt fra andre faner", () => {
  for (const state of ["ok", "locked"] as const) {
    const spec = composeCompany(id, withAuditor(withCredit(holding(), state)), { focus: "risiko" });
    assert.deepEqual(placed(spec), ["LassoCompanyHead", "LassoCreditRating@1", "LassoAuditorIndependence@2"], state);
    const credit = spec.components.find((c) => c.type === "LassoCreditRating")!;
    assert.equal(widthOf(credit, spec.layout), "half");
    // Ingen risikoboks (fjernet 27.09.2026); Creditsafe er et eget element, aldrig en del af måleren.
    assert.ok(!spec.components.some((c) => c.type === "LassoRiskObservations" || c.type === "LassoScoreGauge"));
  }
  // Kun den ene: fuld bredde. En hentningsfejl vises også (fejltilstand med "Prøv igen").
  assert.deepEqual(placed(composeCompany(id, withCredit(holding()), { focus: "risiko" })), ["LassoCompanyHead", "LassoCreditRating"]);
  assert.deepEqual(placed(composeCompany(id, withAuditor(holding()), { focus: "risiko" })), ["LassoCompanyHead", "LassoAuditorIndependence"]);
  const failed = holding();
  failed.errors[`creditRating:${id}`] = "Lasso API svarede ikke i tide";
  assert.deepEqual(placed(composeCompany(id, failed, { focus: "risiko" })), ["LassoCompanyHead", "LassoCreditRating"]);
  // Hverken kreditvurdering eller revisoruafhængighed: kreditvurderingen viser sin egen tilstand, så
  // siden aldrig er tom, og ingen oplysninger, ledelse, historik eller ejere som fyld.
  assert.deepEqual(placed(composeCompany(id, holding(), { focus: "risiko" })), ["LassoCompanyHead", "LassoCreditRating"]);
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

/* ---------- Ingen 1:1-gentagelser og balancerede sider ---------- */

const LONG = "Selskabets aktiviteter er beskrevet udførligt her, så afsnittet fylder flere linjer end en kolonne kan vise uden at folde det sammen. ";
const ANALYSIS = ["Regnskabsanalyse: konklusion", "Resultat", "Likviditet", "Balance og kapitalforhold", "Branchestatistik", "Revisoroplysninger", "Spørgsmål til overvejelse"];

/**
 * Et holdingselskab som i brugerens eksempel: lang profil (formål og hele regnskabsanalysen),
 * 3 nyheder, 8 begivenheder, én direktør og én ejer, kontaktblok og seks regnskabsår.
 */
function holding(): Dataset {
  const ds = emptyDataset("demo");
  const address = { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" };
  ds.companies[id] = { lassoId: id, cvr: "12345678", name: "TEST HOLDING ApS", status: "Normal", form: "ApS", founded: "2005-01-01", employees: 1, industryCode: "642120", industryText: "Ikke-finansielle holdingselskaber", address, phone: "86123456" };
  ds.people[id] = [{ name: "Bo", role: "Direktør", from: "2005-01-01", lassoId: "CVR-3-4000000001" }];
  ds.ownership[id] = { lassoId: id, owners: [{ name: "Bo", kind: "person", share: "100 %" }], auditor: { name: "Revisor ApS", lassoId: "CVR-1-99000002", from: "2019-01-01" } };
  ds.financials[id] = {
    lassoId: id,
    currency: "DKK",
    years: [2020, 2021, 2022, 2023, 2024, 2025].map((year, i) => ({ year, periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, revenue: 10_000_000 + i, grossProfit: 4_000_000 + i, profit: 300_000 + i, equity: 3_000_000 + i, assetsTotal: 5_000_000, employees: 1 })),
  };
  ds.textSections[id] = {
    lassoId: id,
    title: "Virksomhedsprofil",
    sections: [
      { heading: "Branche", body: "Ikke-finansielle holdingselskaber", note: "NACE 642120" },
      { heading: "Formål", body: LONG.repeat(4) },
      { heading: "Tegningsregler", body: "Selskabet tegnes af direktøren alene." },
      ...ANALYSIS.map((heading) => ({ heading, body: LONG.repeat(3), note: "Kilde: Lasso regnskabsanalyse" })),
    ],
  };
  ds.news[id] = { lassoId: id, items: [1, 2, 3].map((n) => ({ source: "Avis", headline: `Nyhed ${n} om holdingselskabet`, excerpt: "Uddrag af artiklen på to linjer.", time: "2025-04-15" })) };
  ds.timeline[id] = { lassoId: id, events: Array.from({ length: 8 }, (_, i) => ({ date: `${2025 - i}-04-15`, title: `Årsrapport ${2025 - i} offentliggjort`, category: "Regnskab" })) };
  ds.contact[id] = { lassoId: id, phone: "86123456", email: "info@test.dk", website: "https://test.dk", address, source: "CVR" };
  return ds;
}

/** Summen af vægte pr. kolonne, som komponisten ser siden. */
function columnWeights(spec: ViewSpec, ds: Dataset): number[] {
  const sums: number[] = [];
  for (const c of spec.components) if (c.column) sums[c.column - 1] = (sums[c.column - 1] ?? 0) + componentWeight(c, ds, spec.components);
  return sums;
}

test("nøgletalskortene står kun på overblik og oekonomi", () => {
  const ds = holding();
  for (const focus of FOCUSES) {
    const has = composeCompany(id, ds, { focus }).components.some((c) => c.type === "LassoKeyFigureCards");
    assert.equal(has, focus === "overblik" || focus === "oekonomi", focus);
  }
  // Heller ikke i regnskab uden offentliggjort regnskab.
  const enk = holding();
  enk.financialStatements[id] = { lassoId: id, currency: "DKK", incomeStatement: [], balanceSheet: [], cashFlow: [] };
  assert.ok(!composeCompany(id, enk, { focus: "regnskab" }).components.some((c) => c.type === "LassoKeyFigureCards"));
});

test("oekonomi: regnskabslisten udelader kortenes nøgletal og står aldrig to gange", () => {
  const spec = composeCompany(id, holding(), { focus: "oekonomi" });
  const cards = spec.components.find((c) => c.type === "LassoKeyFigureCards");
  const lists = spec.components.filter((c) => c.type === "LassoKeyValueList");
  assert.ok(cards?.type === "LassoKeyFigureCards");
  assert.equal(lists.length, 1);
  const list = lists[0]!;
  assert.ok(list.type === "LassoKeyValueList" && list.variant === "financials");
  assert.deepEqual(list.exclude, cards.metrics);
  assert.deepEqual(list.exclude, ["omsaetning", "bruttofortjeneste", "resultat", "egenkapital", "ansatte"]);
  // Under 3 år er listen selv "grafen" i kolonne 1; den gentages ikke i kolonne 2.
  const short = holding();
  short.financials[id]!.years = short.financials[id]!.years.slice(-2);
  const s = composeCompany(id, short, { focus: "oekonomi" });
  assert.equal(s.components.filter((c) => c.type === "LassoKeyValueList").length, 1);
  // På overblikket med få år udelader regnskabslisten også kortenes tal.
  const o = composeCompany(id, short, { focus: "overblik" }).components.find((c) => c.type === "LassoKeyValueList" && c.variant === "financials");
  assert.ok(o?.type === "LassoKeyValueList");
  assert.deepEqual(o.exclude, ["omsaetning", "resultat", "egenkapital", "ansatte"]);
  // Historik uden nyheder låner ikke regnskabslisten eller grafen som fyld: historikken står alene.
  short.news[id] = { lassoId: id, items: [] };
  assert.deepEqual(placed(composeCompany(id, short, { focus: "historik" })), ["LassoCompanyHead", "LassoTimeline"]);
});

test("virksomhedsoplysninger gentager ikke hovedet, kontaktblokken eller ejerlisten og udelades under 2 rækker", () => {
  const ds = holding();
  const co = ds.companies[id]!;
  const last = ds.financials[id]!.years.at(-1);
  const labels = (o: Parameters<typeof companyFacts>[3]) => companyFacts(co, ds.ownership[id], last, o).map((r) => r.label);
  assert.deepEqual(labels({ hideIdentity: true, hideContact: true }), ["Revisor", "Seneste revisorskift", "Regnskabsperiode", "Branchekode", "Kommune", "Region"]);
  assert.deepEqual(labels({ hideIdentity: true }), ["Revisor", "Seneste revisorskift", "Regnskabsperiode", "Branchekode", "Kommune", "Region", "Telefon"]);
  assert.deepEqual(labels({ hideIdentity: true, hideContact: true, hideAuditor: true }), ["Regnskabsperiode", "Branchekode", "Kommune", "Region"]);
  // Uden hoved på siden (fx en render_view-spec) står identiteten i listen som før.
  assert.deepEqual(labels({}).slice(3, 8), ["Stiftet", "Virksomhedsform", "Branche", "Ansatte", "Adresse"]);
  assert.equal(companyFacts(co, ds.ownership[id], last, { hideIdentity: true }).find((r) => r.label === "Revisor")?.lassoId, "CVR-1-99000002");

  // Kun én ny oplysning (branchekoden): listen udelades på alle fokus.
  const thin = holding();
  thin.companies[id] = { ...co, address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg" }, phone: undefined };
  thin.ownership[id] = { lassoId: id, owners: [] };
  thin.financials[id] = { lassoId: id, currency: "DKK", years: [] };
  for (const focus of FOCUSES) {
    assert.ok(!composeCompany(id, thin, { focus }).components.some((c) => c.type === "LassoKeyValueList" && c.variant === "company"), focus);
  }
});

test("ledelse: hele ledelsen i fuld bredde, uden historik og ejere (de har deres egne faner)", () => {
  const spec = composeCompany(id, holding(), { focus: "ledelse" });
  assert.deepEqual(placed(spec), ["LassoCompanyHead", "LassoPersonList"]);
  const list = spec.components.find((c) => c.type === "LassoPersonList");
  assert.ok(list?.type === "LassoPersonList" && list.show === "all");
  // Også uden personer: listens tomme tilstand er svaret.
  const none = holding();
  none.people[id] = [];
  assert.deepEqual(placed(composeCompany(id, none, { focus: "ledelse" })), ["LassoCompanyHead", "LassoPersonList"]);
});

test("historik: historik (5, folder ud på stedet) | nyheder (5); uden nyheder historikken alene i fuld bredde", () => {
  const ds = holding();
  const spec = composeCompany(id, ds, { focus: "historik" });
  assert.deepEqual(placed(spec), ["LassoCompanyHead", "LassoTimeline@1", "LassoNews@2"]);
  const timeline = spec.components.find((c) => c.type === "LassoTimeline");
  const news = spec.components.find((c) => c.type === "LassoNews");
  // Fanen ejer elementerne: "Se alle" folder ud på stedet, ingen henvisning videre.
  assert.ok(timeline?.type === "LassoTimeline" && timeline.limit === undefined && timeline.more === undefined);
  assert.ok(news?.type === "LassoNews" && news.limit === 5 && news.more === undefined);
  ds.news[id] = { lassoId: id, items: [] };
  assert.deepEqual(placed(composeCompany(id, ds, { focus: "historik" })), ["LassoCompanyHead", "LassoTimeline"]);
  // Kunne nyhederne ikke hentes, står nyhedernes fejltilstand ved siden af.
  ds.errors[`news:${id}`] = "Lasso API-fejl (500)";
  assert.deepEqual(placed(composeCompany(id, ds, { focus: "historik" })), ["LassoCompanyHead", "LassoTimeline@1", "LassoNews@2"]);
  // Ingen begivenheder: historikkens tomme tilstand, ikke en graf i stedet.
  const empty = holding();
  empty.timeline[id] = { lassoId: id, events: [] };
  empty.news[id] = { lassoId: id, items: [] };
  assert.deepEqual(placed(composeCompany(id, empty, { focus: "historik" })), ["LassoCompanyHead", "LassoTimeline"]);
});

test("overblik: nyheder og historik er smagsprøver, hvis 'Se alle' åbner fanen Historik (more)", () => {
  const spec = composeCompany(id, holding(), { focus: "overblik" });
  const timeline = spec.components.find((c) => c.type === "LassoTimeline");
  const news = spec.components.find((c) => c.type === "LassoNews");
  assert.ok(timeline?.type === "LassoTimeline" && timeline.limit === 3 && timeline.more === "historik");
  assert.ok(news?.type === "LassoNews" && news.limit === 3 && news.more === "historik");
  // Ingen andre elementer peger videre; more gemmes med specen (delt link) og overlever en ny validering.
  assert.deepEqual(spec.components.filter((c) => "more" in c && c.more).map((c) => c.type).sort(), ["LassoNews", "LassoTimeline"]);
  const saved = viewSpecSchema.parse(JSON.parse(JSON.stringify(spec)));
  assert.deepEqual(saved.components.filter((c) => "more" in c && c.more).map((c) => ("more" in c ? c.more : "")), ["historik", "historik"]);
  // Ukendte faner afvises.
  assert.throws(() => viewSpecSchema.parse({ title: "x", components: [{ type: "LassoTimeline", company: id, more: "ledelse" }] }));
});

test("hvert modul ejer sit indhold: ingen elementtype står på to fokus ud over overblikket", () => {
  // Alt, en virksomhed kan have: reelle ejere, kontaktpersoner, kreditvurdering, revisoruafhængighed og regnskab.
  const ds = withAuditor(withCredit(holding()));
  ds.beneficialOwnership[id] = { lassoId: id, owners: [{ name: "Bo", share: "100 %" }] };
  ds.contactPersons[id] = { lassoId: id, people: [{ name: "Bo", role: "Direktør" }] };
  ds.ownership[id]!.owners.push({ name: "Holding ApS", kind: "company", share: "10 %", lassoId: "CVR-1-99000003" });
  ds.financialStatements[id] = { lassoId: id, currency: "DKK", incomeStatement: [{ year: 2025, revenue: 1 }], balanceSheet: [{ year: 2025, assetsTotal: 1 }], cashFlow: [{ year: 2025 }] };
  // Hovedet på alle fokus, nøgletalskortene på overblik og oekonomi og opfølgningen er rammen, ikke indhold.
  const frame = new Set(["LassoCompanyHead", "LassoKeyFigureCards", "LassoFollowUps"]);
  const key = (c: ViewComponent) => `${c.type}${"variant" in c && c.variant ? `:${c.variant}` : ""}`;
  const owner = new Map<string, string>();
  for (const focus of FOCUSES.filter((f) => f !== "overblik")) {
    for (const c of composeCompany(id, ds, { focus }).components) {
      if (frame.has(c.type)) continue;
      const k = key(c);
      assert.ok(!owner.has(k) || owner.get(k) === focus, `${k} står på både ${owner.get(k)} og ${focus}`);
      owner.set(k, focus);
    }
  }
  assert.deepEqual(Object.fromEntries(owner), {
    "LassoGroupedBarChart": "oekonomi",
    "LassoWaterfallChart": "oekonomi",
    "LassoKeyValueList:financials": "oekonomi",
    "LassoShareBars": "oekonomi",
    "LassoTextSections:analyse": "oekonomi",
    "LassoMultiYearTable": "oekonomi",
    "LassoIncomeStatement": "regnskab",
    "LassoBalanceSheet": "regnskab",
    "LassoCashFlow": "regnskab",
    "LassoOwnerList": "ejerskab",
    "LassoBeneficialOwners": "ejerskab",
    "LassoOwnershipDiagram": "ejerskab",
    "LassoPersonList": "ledelse",
    "LassoCreditRating": "risiko",
    "LassoAuditorIndependence": "risiko",
    "LassoTimeline": "historik",
    "LassoNews": "historik",
    "LassoContact": "kontakt",
    "LassoContactPersons": "kontakt",
  });
  // Overblikket: det, der også står på en fane, er en smagsprøve (kort) eller peger på fanen.
  const overview = composeCompany(id, ds, { focus: "overblik" }).components.filter((c) => !frame.has(c.type));
  for (const c of overview) {
    const tab = owner.get(key(c));
    if (!tab) continue;
    if (c.type === "LassoTimeline" || c.type === "LassoNews") assert.equal(c.more, "historik", c.type);
    else assert.ok(["LassoContact", "LassoBarChart"].includes(c.type), `${key(c)} står på overblik og ${tab}`);
  }
});

test("overblik: nyheder og historik lægges i den kolonne, der vejer mindst (brugerens holdingeksempel)", () => {
  const ds = holding();
  const spec = composeCompany(id, ds, { focus: "overblik" });
  const col = (type: ViewComponent["type"]) => spec.components.find((c) => c.type === type)?.column;
  // Faste pladser: relationer | profil | kontakt, oplysninger og graf.
  assert.equal(col("LassoRelations"), 1);
  assert.equal(col("LassoTextSections"), 2);
  assert.deepEqual(
    spec.components.filter((c) => c.column === 3).map((c) => c.type),
    ["LassoContact", "LassoKeyValueList", "LassoBarChart"],
  );
  // Historikken viser 3 + "Se alle" på overblikket.
  const timeline = spec.components.find((c) => c.type === "LassoTimeline");
  assert.ok(timeline?.type === "LassoTimeline" && timeline.limit === 3);
  // Den lange profil får hverken nyheder eller historik, og ingen kolonne står halvtom.
  assert.notEqual(col("LassoNews"), 2);
  assert.notEqual(col("LassoTimeline"), 2);
  const w = columnWeights(spec, ds);
  assert.equal(w.length, 3);
  assert.ok(Math.max(...w) / Math.min(...w) < 1.5, `kolonnevægte ${w.map((x) => x.toFixed(1)).join("/")}`);
  // Nyheder og historik i samme kolonne kun, når ingen anden kolonne er nær tom.
  if (col("LassoNews") === col("LassoTimeline")) assert.ok(Math.min(...w) > 0.6 * Math.max(...w));

  // En kort profil (kun CVR-tekster) får historikken, så kolonne 1 ikke bærer begge.
  const short = holding();
  short.textSections[id]!.sections = short.textSections[id]!.sections
    .filter((s) => s.heading === "Formål" || s.heading === "Tegningsregler")
    .map((s) => ({ ...s, body: "Kort tekst." }));
  const s2 = composeCompany(id, short, { focus: "overblik" });
  const col2 = (type: ViewComponent["type"]) => s2.components.find((c) => c.type === type)?.column;
  assert.equal(col2("LassoNews"), 1);
  assert.equal(col2("LassoTimeline"), 2);

  // Uden relationer fylder nyhederne kolonne 1 i stedet for et hul.
  const alone = holding();
  alone.people[id] = [];
  alone.ownership[id] = { lassoId: id, owners: [], auditor: alone.ownership[id]!.auditor };
  const s3 = composeCompany(id, alone, { focus: "overblik" });
  assert.equal(s3.columns, 3);
  assert.equal(s3.components.find((c) => c.type === "LassoNews")?.column, 1);
});

test("componentWeight: vægten følger datas form", () => {
  const ds = holding();
  const news = componentWeight({ type: "LassoNews", company: id, limit: 3 }, ds);
  const timeline5 = componentWeight({ type: "LassoTimeline", company: id }, ds);
  const timeline3 = componentWeight({ type: "LassoTimeline", company: id, limit: 3 }, ds);
  assert.ok(timeline3 < timeline5);
  assert.ok(news > 10 && news < timeline5);
  // Kontaktfelterne tæller ikke med i listen, når kontaktblokken står på siden.
  const list: ViewComponent = { type: "LassoKeyValueList", company: id, variant: "company" };
  const head: ViewComponent = { type: "LassoCompanyHead", company: id };
  const contact: ViewComponent = { type: "LassoContact", company: id };
  assert.ok(componentWeight(list, ds, [head, contact, list]) < componentWeight(list, ds, [head, list]));
  // Hele analysen er foldet efter konklusionen og vejer derfor mindre end profilen.
  const profil = componentWeight({ type: "LassoTextSections", company: id, variant: "profil" }, ds);
  const analyse = componentWeight({ type: "LassoTextSections", company: id, variant: "analyse" }, ds);
  assert.ok(profil > analyse);
});

test("regnskabsanalysen: overblikket viser konklusion, resultat og likviditet, oekonomi hele analysen i fuld bredde", () => {
  const ds = holding();
  const sections = ds.textSections[id]!.sections;
  assert.deepEqual(
    textSectionsFor(sections, "profil").map((s) => s.heading),
    ["Formål", "Tegningsregler", "Regnskabsanalyse: konklusion", "Resultat", "Likviditet"],
  );
  assert.deepEqual(textSectionsFor(sections, "analyse").map((s) => s.heading), ANALYSIS);
  // Ældre gemte specs uden variant opfører sig som profilen.
  assert.deepEqual(textSectionsFor(sections).map((s) => s.heading), textSectionsFor(sections, "profil").map((s) => s.heading));

  const overblik = composeCompany(id, ds, { focus: "overblik" });
  const profile = overblik.components.filter((c) => c.type === "LassoTextSections");
  assert.equal(profile.length, 1);
  assert.ok(profile[0]!.type === "LassoTextSections" && profile[0]!.variant === "profil" && profile[0]!.title === "Virksomhedsprofil");

  const eco = composeCompany(id, ds, { focus: "oekonomi" });
  const types = eco.components.map((c) => c.type);
  const analysis = eco.components.find((c) => c.type === "LassoTextSections");
  assert.ok(analysis?.type === "LassoTextSections" && analysis.variant === "analyse" && analysis.title === "Regnskabsanalyse");
  assert.equal(analysis.column, undefined, "fuld bredde");
  // Under graferne (kolonnebåndet) og over flerårstabellen.
  const lastColumn = eco.components.reduce((last, c, i) => (c.column ? i : last), -1);
  assert.ok(types.indexOf("LassoTextSections") > lastColumn);
  assert.ok(types.indexOf("LassoTextSections") < types.indexOf("LassoMultiYearTable"));

  // Uden analyse: ingen tom sektion på oekonomi.
  const cvr = holding();
  cvr.textSections[id]!.sections = sections.filter((s) => !ANALYSIS.includes(s.heading));
  assert.ok(!composeCompany(id, cvr, { focus: "oekonomi" }).components.some((c) => c.type === "LassoTextSections"));
  // Kun branche (står i hovedet): ingen profil på overblikket.
  cvr.textSections[id]!.sections = sections.filter((s) => s.heading === "Branche");
  assert.ok(!composeCompany(id, cvr, { focus: "overblik" }).components.some((c) => c.type === "LassoTextSections"));
});

test("composeProbe: hvert fokus henter kun det, det viser (hovedet altid)", () => {
  const probe = (focus?: (typeof FOCUSES)[number]) => composeProbe(id, focus).components.map((c) => c.type);
  assert.deepEqual(probe(), ["LassoCompanyHead", "LassoKeyFigureCards", "LassoPersonList", "LassoOwnerList", "LassoTimeline", "LassoNews", "LassoTextSections", "LassoContact"]);
  assert.deepEqual(probe("overblik"), probe());
  assert.deepEqual(probe("oekonomi"), ["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections"]);
  assert.deepEqual(probe("regnskab"), ["LassoCompanyHead", "LassoIncomeStatement"]);
  assert.deepEqual(probe("ejerskab"), ["LassoCompanyHead", "LassoOwnerList", "LassoBeneficialOwners", "LassoOwnershipDiagram"]);
  assert.deepEqual(probe("ledelse"), ["LassoCompanyHead", "LassoPersonList"]);
  assert.deepEqual(probe("risiko"), ["LassoCompanyHead", "LassoCreditRating", "LassoAuditorIndependence"]);
  assert.deepEqual(probe("historik"), ["LassoCompanyHead", "LassoTimeline", "LassoNews"]);
  assert.deepEqual(probe("kontakt"), ["LassoCompanyHead", "LassoContact", "LassoContactPersons"]);
  // Fx: ledelse henter hverken historik eller ejere, risiko hverken personer eller historik.
  for (const focus of FOCUSES) {
    assert.equal(probe(focus).includes("LassoTimeline"), focus === "overblik" || focus === "historik", focus);
    assert.equal(probe(focus).includes("LassoPersonList"), focus === "overblik" || focus === "ledelse", focus);
    assert.equal(probe(focus).includes("LassoOwnerList"), focus === "overblik" || focus === "ejerskab", focus);
    assert.ok(!probe(focus).includes("LassoKeyValueList"), focus);
  }
});

test("opfølgninger: data, fokus ikke har hentet, tæller som 'måske' (vises); hentet og tomt skjules", () => {
  const ds = emptyDataset("demo");
  ds.companies[id] = { lassoId: id, name: "TEST ApS", status: "Normal" };
  const labels = (focus: (typeof FOCUSES)[number], d = ds) => {
    const f = composeCompany(id, d, { focus }).components.find((c) => c.type === "LassoFollowUps");
    return f?.type === "LassoFollowUps" ? f.prompts.map((p) => p.label) : [];
  };
  // Ledelse henter ikke ejerne: "Ejere" står, og fanen Ejerskab svarer selv (også med en tom tilstand).
  assert.deepEqual(labels("ledelse"), ["Ejere", "Historik"]);
  ds.ownership[id] = { lassoId: id, owners: [] };
  assert.deepEqual(labels("ledelse"), ["Historik"]);
  // Risiko: økonomien og ejerne ukendte, altså med.
  assert.deepEqual(labels("risiko"), ["Økonomien"]);
  // Regnskab uden offentliggjort regnskab: ingen "Udvikling over år".
  ds.financialStatements[id] = { lassoId: id, currency: "DKK", incomeStatement: [], balanceSheet: [], cashFlow: [] };
  assert.deepEqual(labels("regnskab"), ["Risiko", "Kreditvurdering", "Ledelse"]);
  ds.financialStatements[id] = { lassoId: id, currency: "DKK", incomeStatement: [{ year: 2025, revenue: 1 }], balanceSheet: [], cashFlow: [] };
  assert.deepEqual(labels("regnskab"), ["Udvikling over år", "Risiko", "Kreditvurdering"]);
});

test("composeProbe henter tekstsektionerne til overblik og oekonomi", () => {
  for (const focus of FOCUSES) {
    assert.equal(composeProbe(id, focus).components.some((c) => c.type === "LassoTextSections"), focus === "overblik" || focus === "oekonomi", focus);
  }
});

test("intet fokus har samme element to gange, og relationerne står aldrig ved siden af person- eller ejerlisten", () => {
  const ds = holding();
  ds.beneficialOwnership[id] = { lassoId: id, owners: [{ name: "Bo", share: "100 %" }] };
  ds.contactPersons[id] = { lassoId: id, people: [{ name: "Bo", role: "Direktør" }] };
  for (const focus of FOCUSES) {
    const spec = composeCompany(id, ds, { focus });
    const keys = spec.components.map((c) => `${c.type}:${"variant" in c ? c.variant : ""}`);
    assert.equal(new Set(keys).size, keys.length, `${focus}: ${keys.join(", ")}`);
    if (keys.some((k) => k.startsWith("LassoRelations"))) assert.ok(!keys.some((k) => k.startsWith("LassoPersonList") || k.startsWith("LassoOwnerList")), focus);
  }
});
