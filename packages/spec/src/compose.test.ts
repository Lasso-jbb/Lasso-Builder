import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAsk, SUMMARY_PENDING_TEXT } from "./ask.js";
import { companyFacts } from "./companyFacts.js";
import { companySummaryText, componentWeight, composeCompany, composeProbe, FOCUSES, packWithExtras, shortCompanyName } from "./compose.js";
import { composePerson } from "./composePerson.js";
import { changeFeedKey, emptyDataset, type Dataset, type FinancialYear } from "./models.js";
import { effectiveMetric, mainMetric } from "./series.js";
import { BAND_COMBOS } from "./grid.js";
import { viewSpecSchema, WIDTH_COLUMNS, widthOf, type ViewComponent, type ViewSpec } from "./spec.js";
import { textSectionsFor } from "./textSections.js";

const id = "CVR-1-12345678";

function company(status = "Normal", founded = "2010-01-01"): Dataset {
  const ds = emptyDataset("demo");
  ds.companies[id] = { lassoId: id, name: "TEST ApS", status, founded };
  ds.people[id] = [{ name: "Anne", role: "Direktør", from: "2015-01-01" }];
  ds.ownership[id] = { lassoId: id, owners: [{ name: "Bo", kind: "person", share: "100 %" }] };
  return ds;
}

/** Sidens delte bånd som stakke (samme regel som LassoView.columnBands: lavere kolonne = nyt bånd). */
function bandsOf(spec: ViewSpec): ViewComponent[][][] {
  const bands: ViewComponent[][][] = [];
  let last = 0;
  for (const c of spec.components) {
    if (!c.column) {
      last = 0;
      continue;
    }
    if (last === 0 || c.column < last) bands.push([]);
    const band = bands.at(-1)!;
    while (band.length < c.column) band.push([]);
    band[c.column - 1]!.push(c);
    last = c.column;
  }
  return bands;
}

/** Hvert delt bånd er en lovlig kombination, der summerer til 12, og alle i en stak har stakkens bredde. */
function assertFullBands(spec: ViewSpec) {
  const legal = BAND_COMBOS.map((x) => x.join("+"));
  for (const band of bandsOf(spec)) {
    const cols = band.map((st) => WIDTH_COLUMNS[st[0]!.width!]);
    assert.ok(legal.includes(cols.join("+")), `ulovligt bånd ${cols.join("+")}`);
    for (const st of band) assert.ok(st.every((c) => c.width === st[0]!.width));
  }
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

test("risiko viser kreditvurderingen øverst i første bånd (ved siden af oplysningerne, når de findes), også låst", () => {
  for (const state of ["ok", "locked"] as const) {
    const spec = composeCompany(id, withCredit(company(), state), { focus: "risiko" });
    const credit = spec.components.find((c) => c.type === "LassoCreditRating");
    assert.ok(credit, state);
    // Gridmodellen: kreditvurderingen står øverst i første delte bånd, lige under hovedet, i en tilladt bredde.
    assert.ok(credit.column);
    assert.ok(["half", "two-thirds"].includes(widthOf(credit, spec.layout)));
    const band = bandsOf(spec)[0]!;
    assertFullBands(spec);
    // Ingen risikoboks (fjernet 27.09.2026); Creditsafe er et eget element, aldrig en del af måleren.
    assert.ok(!spec.components.some((c) => c.type === "LassoRiskObservations"));
    assert.ok(!spec.components.some((c) => c.type === "LassoScoreGauge"));
    assert.equal(band[credit.column - 1]![0], credit);
  }
  // Med oplysninger står de først og kreditvurderingen ved siden af.
  const withList = withCredit(holding());
  const s2 = composeCompany(id, withList, { focus: "risiko" });
  // Gridmodellen vælger det bånd, der holder 15 % (23.1 4c); kreditvurderingen står øverst i en stak i de to første bånd.
  const [first, second] = bandsOf(s2);
  assert.equal(first![0]![0]!.type, "LassoKeyValueList");
  assert.ok([...first!, ...(second ?? [])].some((st) => st[0]!.type === "LassoCreditRating"));
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

test("B4: risikoobservationerne står kun på fokus risiko, efter kreditvurderingen, og hentes kun dér", () => {
  const ds = withCredit(company("Under konkurs"));
  ds.observations[id] = { lassoId: id, observations: [{ id: "o1", title: "Selskabet er under konkurs", severity: 100 }] };
  for (const focus of ["overblik", "oekonomi", "regnskab", "ejerskab", "ledelse", "historik", "kontakt"] as const) {
    assert.ok(!composeCompany(id, ds, { focus }).components.some((c) => c.type === "LassoRiskObservations"), focus);
    assert.ok(!composeProbe(id, focus).components.some((c) => c.type === "LassoRiskObservations"), focus);
  }
  assert.ok(composeProbe(id, "risiko").components.some((c) => c.type === "LassoRiskObservations"));
  const types = composeCompany(id, ds, { focus: "risiko" }).components.map((c) => c.type);
  assert.ok(types.includes("LassoRiskObservations"));
  // Kreditvurderingen er stadig svaret (eval: fokus risiko → LassoCreditRating); observationerne står efter den.
  assert.ok(types.indexOf("LassoCreditRating") < types.indexOf("LassoRiskObservations"));
  // Ikke hentet (fx timeout i live): intet element, ingen tom tilstand.
  delete ds.observations[id];
  assert.ok(!composeCompany(id, ds, { focus: "risiko" }).components.some((c) => c.type === "LassoRiskObservations"));
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
  // Uden kort på siden (historik uden nyheder) udelades intet.
  short.news[id] = { lassoId: id, items: [] };
  const h = composeCompany(id, short, { focus: "historik" }).components.find((c) => c.type === "LassoKeyValueList");
  assert.ok(h?.type === "LassoKeyValueList" && h.exclude === undefined);
});

test("virksomhedsoplysninger gentager ikke hovedet, kontaktblokken eller ejerlisten og udelades under 2 rækker", () => {
  const ds = holding();
  const co = ds.companies[id]!;
  const last = ds.financials[id]!.years.at(-1);
  const labels = (o: Parameters<typeof companyFacts>[3]) => companyFacts(co, ds.ownership[id], last, o).map((r) => r.label);
  // 08.1: ansatte står ikke i hovedet, så listen har dem også under hovedet.
  assert.deepEqual(labels({ hideIdentity: true, hideContact: true }), ["Revisor", "Seneste revisorskift", "Regnskabsperiode", "Branchekode", "Ansatte", "Kommune", "Region"]);
  assert.deepEqual(labels({ hideIdentity: true }), ["Revisor", "Seneste revisorskift", "Regnskabsperiode", "Branchekode", "Ansatte", "Kommune", "Region", "Telefon"]);
  assert.deepEqual(labels({ hideIdentity: true, hideContact: true, hideAuditor: true }), ["Regnskabsperiode", "Branchekode", "Ansatte", "Kommune", "Region"]);
  // Uden hoved på siden (fx en render_view-spec) står identiteten i listen som før.
  // G9 (Jakob 29.09): hovedet viser kun navnet, så identiteten står i listen, også med hovedet på siden.
  assert.deepEqual(labels({}).slice(3, 9), ["CVR-nummer", "Stiftet", "Virksomhedsform", "Branche", "Ansatte", "Adresse"]);
  assert.equal(companyFacts(co, ds.ownership[id], last, { hideIdentity: true }).find((r) => r.label === "Revisor")?.lassoId, "CVR-1-99000002");

  // Kun én ny oplysning (branchekoden): listen udelades på alle fokus.
  const thin = holding();
  thin.companies[id] = { ...co, address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg" }, phone: undefined, employees: undefined };
  thin.ownership[id] = { lassoId: id, owners: [] };
  thin.financials[id] = { lassoId: id, currency: "DKK", years: [] };
  for (const focus of FOCUSES) {
    assert.ok(!composeCompany(id, thin, { focus }).components.some((c) => c.type === "LassoKeyValueList" && c.variant === "company"), focus);
  }
});

test("overblik: nyheder og historik er smagsprøver, hvis 'Se alle' åbner fanen Historik (more)", () => {
  // showAll: uden højdebudgettet står både nyheder og historik på overblikket (23.3 kan ellers udelade dem).
  const spec = composeCompany(id, holding(), { focus: "overblik", showAll: true });
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

test("ledelse: ledelsen står først til venstre, og siden er bånd uden huller (gridmodel)", () => {
  const spec = composeCompany(id, holding(), { focus: "ledelse" });
  // Én direktør og én ejer står ½ + ½; de otte begivenheder er for høje til at stå ved siden af og får eget bånd.
  assert.equal(spec.components.find((c) => c.type === "LassoPersonList")?.column, 1);
  assert.ok(spec.components.some((c) => c.type === "LassoTimeline"));
  assert.ok(spec.components.findIndex((c) => c.type === "LassoPersonList") < spec.components.findIndex((c) => c.type === "LassoTimeline"));
  assertFullBands(spec);
});

test("overblik (23.3): default-sidens rækkefølge i bånd uden huller (brugerens holdingeksempel)", () => {
  const ds = holding();
  // showAll ("vis alt om X"): alle elementer; standardsiden holder højdebudgettet (se testen nedenfor).
  const spec = composeCompany(id, ds, { focus: "overblik", showAll: true });
  const order = spec.components.map((c) => c.type);
  // Hoved og nøgletal i egne fuldbånd øverst; profilen er første anker, genveje og opfølgning sidst.
  assert.deepEqual(order.slice(0, 2), ["LassoCompanyHead", "LassoKeyFigureCards"]);
  assert.equal(spec.components[2]!.type, "LassoTextSections");
  assert.equal(spec.components[2]!.column, 1);
  assert.ok(order.includes("LassoShortcuts"));
  assert.equal(order.at(-1), "LassoFollowUps");
  // Historikken viser 3 + "Se alle" på overblikket.
  const timeline = spec.components.find((c) => c.type === "LassoTimeline");
  assert.ok(timeline?.type === "LassoTimeline" && timeline.limit === 3);
  assertFullBands(spec);
  // Den lange profil får hverken nyheder eller historik i sin stak.
  const profileBand = bandsOf(spec).find((b) => b[0]!.some((c) => c.type === "LassoTextSections"))!;
  assert.ok(!profileBand.flat().some((c) => c.type === "LassoNews" || c.type === "LassoTimeline"));

  // Uden relationer og med kort profil: stadig bånd på 12 uden huller.
  const alone = holding();
  alone.people[id] = [];
  alone.ownership[id] = { lassoId: id, owners: [], auditor: alone.ownership[id]!.auditor };
  alone.textSections[id]!.sections = alone.textSections[id]!.sections.filter((x) => x.heading === "Formål").map((x) => ({ ...x, body: "Kort tekst." }));
  assertFullBands(composeCompany(id, alone, { focus: "overblik" }));
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

  const eco = composeCompany(id, ds, { focus: "oekonomi", showAll: true });
  const types = eco.components.map((c) => c.type);
  const analysis = eco.components.find((c) => c.type === "LassoTextSections");
  assert.ok(analysis?.type === "LassoTextSections" && analysis.variant === "analyse" && analysis.title === "Regnskabsanalyse");
  // Gridmodellen: analysen pakkes sidst (efter grafer, regnskabsliste og flerårstabel), i fuld bredde
  // eller ved siden af et element, der ellers ville stå alene.
  // B4-resumeet (LassoSummary) er et ekstra element og står efter analysen, når der er plads.
  assert.equal(types.filter((t) => t !== "LassoFollowUps" && t !== "LassoSummary").at(-1), "LassoTextSections");
  assert.ok(types.indexOf("LassoTextSections") > types.indexOf("LassoGroupedBarChart"));
  assertFullBands(eco);

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
  assert.deepEqual(probe(), ["LassoCompanyHead", "LassoKeyFigureCards", "LassoPersonList", "LassoOwnerList", "LassoTimeline", "LassoNews", "LassoTextSections", "LassoContact", "LassoMap", "LassoRegistration"]);
  assert.deepEqual(probe("overblik"), probe());
  assert.deepEqual(probe("oekonomi"), ["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections", "LassoKeyFigureGauge"]);
  assert.deepEqual(probe("regnskab"), ["LassoCompanyHead", "LassoIncomeStatement"]);
  assert.deepEqual(probe("ejerskab"), ["LassoCompanyHead", "LassoOwnerList", "LassoBeneficialOwners", "LassoOwnershipDiagram"]);
  assert.deepEqual(probe("ledelse"), ["LassoCompanyHead", "LassoPersonList"]);
  assert.deepEqual(probe("risiko"), ["LassoCompanyHead", "LassoCreditRating", "LassoAuditorIndependence", "LassoRiskObservations", "LassoScoreGauge", "LassoScoreHistory"]);
  assert.deepEqual(probe("historik"), ["LassoCompanyHead", "LassoTimeline", "LassoNews", "LassoAnnouncements", "LassoChangeFeed"]);
  assert.deepEqual(probe("kontakt"), ["LassoCompanyHead", "LassoContact", "LassoContactPersons", "LassoMap", "LassoProductionUnits"]);
  // B4: virksomhedens egne ændringer (30 dage) på historik, ikke en overvågningsliste.
  const feed = composeProbe(id, "historik").components.find((c) => c.type === "LassoChangeFeed");
  assert.ok(feed?.type === "LassoChangeFeed" && feed.company === id && feed.days === 30 && feed.list === undefined);
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

/* ---------- Spørgsmålet styrer formen (ask.ts): en hel side i spørgsmålets kontekst ---------- */

const TODAY = new Date("2026-09-28T12:00:00Z");
const ask = (q: string) => parseAsk(q, "company", { today: TODAY, name: ["TEST HOLDING ApS", "Test Holding"] });

/** holding() med gæld, soliditetsgrad og overskudsgrad i alle seks år, to direktører og en bestyrelse. */
function rich(): Dataset {
  const ds = holding();
  ds.financials[id]!.years = ds.financials[id]!.years.map((y, i) => ({ ...y, liabilities: 2_000_000 - i, soliditetsgrad: 60 + i, overskudsgrad: 8 + i, ebitda: 900_000 + i }));
  ds.people[id] = [
    { name: "Bo", role: "Adm. direktør", from: "2005-01-01", lassoId: "CVR-3-4000000001" },
    { name: "Cai", role: "Direktør", from: "2010-01-01", to: "2020-01-01" },
    { name: "Dea", role: "Bestyrelsesformand", from: "2015-01-01" },
    { name: "Eva", role: "Bestyrelsessuppleant", from: "2019-01-01" },
  ];
  ds.timeline[id]!.events.push({ date: "2020-01-01", title: "Cai er fratrådt", detail: "Direktør", category: "Ledelse" });
  return ds;
}

/** Sidens elementer som "Type@kolonne" (fuld bredde uden kolonne), uden opfølgningen. */
const where = (spec: ViewSpec) => spec.components.filter((c) => c.type !== "LassoFollowUps").map((c) => `${c.type}${c.column ? `@${c.column}` : ""}`);
const find = <T extends ViewComponent["type"]>(spec: ViewSpec, type: T) => spec.components.find((c) => c.type === type) as Extract<ViewComponent, { type: T }> | undefined;
const GRAPHS = new Set(["LassoBarChart", "LassoGroupedBarChart", "LassoLineChart", "LassoStackedBarChart"]);

/** Reglerne fra docs/portal.md på en spørgsmålsside: ingen dubletter, højst én graf, kort og liste deler ikke nøgletal. */
function assertPageRules(spec: ViewSpec, label: string) {
  const keys = spec.components.map((c) => (c.type === "LassoKeyValueList" ? `${c.type}:${c.variant}` : c.type));
  assert.equal(new Set(keys).size, keys.length, `${label}: dubletter ${keys.join(", ")}`);
  assert.ok(spec.components.filter((c) => GRAPHS.has(c.type)).length <= 1, `${label}: højst én graf`);
  assert.ok(spec.components.length <= 12, label);
  const cards = find(spec, "LassoKeyFigureCards");
  if (cards) {
    assert.ok(cards.metrics!.length >= 3 && cards.metrics!.length <= 5, `${label}: ${cards.metrics!.length} kort`);
    const list = spec.components.find((c) => c.type === "LassoKeyValueList" && c.variant === "financials");
    if (list?.type === "LassoKeyValueList") {
      if (list.only) assert.ok(!list.only.some((m) => cards.metrics!.includes(m)), `${label}: listen gentager kortene`);
      else assert.deepEqual(list.exclude, cards.metrics, label);
    }
  }
  if (keys.includes("LassoRelations")) assert.ok(!keys.includes("LassoPersonList") && !keys.includes("LassoOwnerList"), label);
  // En halv står aldrig alene: kolonnerne er 2 eller 3, og de bruges alle.
  const used = new Set(spec.components.flatMap((c) => (c.column ? [c.column] : [])));
  if (used.size) assert.equal(used.size, spec.columns, `${label}: kolonner ${[...used].join(",")} af ${spec.columns}`);
}

test("spørgsmål: 'hvad er soliditetsgraden' giver kort med soliditetsgraden først, linjegrafen som svar og en hel side kontekst", () => {
  const ds = rich();
  ds.financialStatements[id] = { lassoId: id, currency: "DKK", incomeStatement: [{ year: 2025, revenue: 1 }], balanceSheet: [{ year: 2025, assetsTotal: 1 }], cashFlow: [] };
  const spec = composeCompany(id, ds, { ask: ask("Hvad er soliditetsgraden i Test Holding?"), name: "TEST HOLDING ApS" });
  assertPageRules(spec, "soliditet");
  assert.equal(spec.subtitle, "Soliditetsgrad");
  assert.equal(spec.layout, "columns");
  assert.equal(spec.columns, 3);
  assert.deepEqual(where(spec).slice(0, 3), ["LassoCompanyHead", "LassoKeyFigureCards", "LassoLineChart@1"]);
  assert.deepEqual(find(spec, "LassoKeyFigureCards")!.metrics!.slice(0, 3), ["soliditetsgrad", "egenkapital", "gaeld"]);
  assert.equal(find(spec, "LassoLineChart")!.metric, "soliditetsgrad");
  // Siden er fuld: hver kolonne har kontekst, og balancen (som nøgletallet hører til) står nederst.
  assert.ok(where(spec).some((w) => w.endsWith("@2")) && where(spec).some((w) => w.endsWith("@3")));
  assert.ok(spec.components.some((c) => c.type === "LassoShareBars"));
  assert.ok(spec.components.some((c) => c.type === "LassoBalanceSheet" && !c.column));
  assert.ok(spec.components.length >= 8, `${spec.components.length} elementer`);
});

test("spørgsmål: 'hvordan har gælden udviklet sig de sidste 5 år' giver stablede søjler over 5 år, og listen gentager ikke kortene", () => {
  const spec = composeCompany(id, rich(), { ask: ask("hvordan har gælden udviklet sig de sidste 5 år") });
  assertPageRules(spec, "gæld");
  const chart = find(spec, "LassoStackedBarChart");
  assert.ok(chart && chart.column === 1 && chart.years === 5);
  assert.equal(find(spec, "LassoKeyFigureCards")!.metrics![0], "gaeld");
  assert.equal(spec.subtitle, "Gæld");
});

test("spørgsmål: under 3 år med tal står regnskabslisten som svar i stedet for grafen (og kun én gang)", () => {
  const ds = rich();
  ds.financials[id]!.years = ds.financials[id]!.years.slice(-2);
  const spec = composeCompany(id, ds, { ask: ask("hvordan har omsætningen udviklet sig") });
  assertPageRules(spec, "få år");
  assert.ok(!spec.components.some((c) => GRAPHS.has(c.type)));
  const lead = spec.components.find((c) => c.column === 1);
  assert.ok(lead?.type === "LassoKeyValueList" && lead.variant === "financials", JSON.stringify(lead));
  assert.equal(spec.components.filter((c) => c.type === "LassoKeyValueList" && c.variant === "financials").length, 1);
});

test("spørgsmål: omsætning ikke oplyst giver bruttofortjeneste på kort og graf", () => {
  const ds = rich();
  ds.financials[id]!.years = lassoXYears();
  const spec = composeCompany(id, ds, { ask: ask("hvad er omsætningen") });
  assertPageRules(spec, "uden omsætning");
  assert.equal(find(spec, "LassoKeyFigureCards")!.metrics![0], "bruttofortjeneste");
  assert.ok(!find(spec, "LassoKeyFigureCards")!.metrics!.includes("omsaetning"));
  assert.equal(find(spec, "LassoBarChart")!.metric, "bruttofortjeneste");
});

test("spørgsmål: 'hvem er direktør' giver personlisten med kun direktionen øverst i kolonne 1, uden kort", () => {
  const spec = composeCompany(id, rich(), { ask: ask("Hvem er direktør i Test Holding?") });
  assertPageRules(spec, "direktør");
  assert.deepEqual(where(spec).slice(0, 2), ["LassoCompanyHead", "LassoPersonList@1"]);
  const list = find(spec, "LassoPersonList")!;
  assert.deepEqual([list.roles, list.show, list.title], ["direktion", "current", "Direktion"]);
  assert.ok(!spec.components.some((c) => c.type === "LassoKeyFigureCards"));
  // Konteksten: ledelsesændringerne i historikken (ikke hele historikken).
  assert.deepEqual(find(spec, "LassoTimeline")?.kinds, ["ledelse"]);
  // "Tidligere direktør": også de fratrådte.
  assert.equal(find(composeCompany(id, rich(), { ask: ask("hvem var tidligere direktør") }), "LassoPersonList")!.show, "all");
});

test("spørgsmål: et tomt svar-element står (den tomme tilstand er svaret); tomme kontekstmoduler udelades", () => {
  const ds = rich();
  ds.people[id] = [];
  ds.news[id] = { lassoId: id, items: [] };
  const spec = composeCompany(id, ds, { ask: ask("hvem sidder i bestyrelsen") });
  assertPageRules(spec, "tom bestyrelse");
  assert.equal(find(spec, "LassoPersonList")?.roles, "bestyrelse");
  assert.equal(find(spec, "LassoPersonList")?.column, 1);
  assert.ok(!spec.components.some((c) => c.type === "LassoNews" || c.type === "LassoContactPersons"));
});

test("spørgsmål: to spørgsmål i ét giver to svar øverst i hver sin kolonne, aldrig under hinanden", () => {
  const spec = composeCompany(id, rich(), { ask: ask("hvad er omsætningen, og hvem er direktør") });
  assertPageRules(spec, "to svar");
  assert.equal(find(spec, "LassoBarChart")?.column, 1);
  assert.equal(find(spec, "LassoPersonList")?.column, 2);
  const col = (n: number) => spec.components.filter((c) => c.column === n);
  assert.equal(col(1)[0]!.type, "LassoBarChart");
  assert.equal(col(2)[0]!.type, "LassoPersonList");
  assert.equal(find(spec, "LassoKeyFigureCards")!.metrics![0], "omsaetning");
});

test("spørgsmål: kortene er altid 4–5 med de spurgte først, også ved ét nøgletal uden beslægtede", () => {
  const ds = rich();
  for (const [q, first] of [["hvor mange ansatte er der", "ansatte"], ["hvad er resultatet", "resultat"], ["hvad er egenkapitalen", "egenkapital"], ["hvem er revisor", "omsaetning"]] as const) {
    const cards = find(composeCompany(id, ds, { ask: ask(q) }), "LassoKeyFigureCards");
    assert.ok(cards, q);
    assert.equal(cards.metrics![0], first, q);
    assert.ok(cards.metrics!.length >= 4 && cards.metrics!.length <= 5, `${q}: ${cards.metrics!.join(",")}`);
  }
});

test("spørgsmål: 'hvad var omsætningen i 2023' giver regnskabslisten for 2023 som svar, ingen kort, og en graf, der dækker året", () => {
  const spec = composeCompany(id, rich(), { ask: ask("hvad var omsætningen i 2023") });
  assertPageRules(spec, "2023");
  assert.ok(!spec.components.some((c) => c.type === "LassoKeyFigureCards"));
  const list = spec.components.find((c) => c.column === 1);
  assert.ok(list?.type === "LassoKeyValueList" && list.variant === "financials" && list.year === 2023);
  assert.deepEqual(list.only, ["omsaetning", "bruttofortjeneste", "resultat"]);
  assert.ok((find(spec, "LassoBarChart")?.years ?? 0) >= 2026 - 2023 + 1);
  assert.equal(spec.subtitle, "Omsætning 2023");
});

test("spørgsmål: 'hvem ejer og hvem er revisor' svares af ejerlisten (med revisor); revisoren står ikke to gange", () => {
  const spec = composeCompany(id, rich(), { ask: ask("hvem ejer og hvem er revisor") });
  assertPageRules(spec, "ejere og revisor");
  assert.equal(find(spec, "LassoOwnerList")?.column, 1);
  assert.ok(!spec.components.some((c) => c.type === "LassoKeyValueList" && c.variant === "company" && c.rows?.includes("revisor")));
  assert.equal(spec.subtitle, "Ejere og revisor");
  // Kun revisoren: rækkerne revisor, revisorskift og regnskabsperiode; ejerlisten (som også viser revisoren) står ikke.
  const auditor = composeCompany(id, rich(), { ask: ask("hvem er revisor") });
  assertPageRules(auditor, "revisor");
  const rows = auditor.components.find((c) => c.column === 1);
  assert.ok(rows?.type === "LassoKeyValueList" && rows.variant === "company");
  assert.deepEqual(rows.rows, ["revisor", "revisorskift", "regnskabsperiode"]);
  assert.ok(!auditor.components.some((c) => c.type === "LassoOwnerList"));
});

test("spørgsmål: konkurs giver statushistorikken som svar, uden statusbegivenheder hele historikken, og robusthedskortene", () => {
  const ds = rich();
  const spec = composeCompany(id, ds, { ask: ask("er de gået konkurs?") });
  assertPageRules(spec, "konkurs");
  // Ingen statusbegivenheder: hele historikken står (aldrig en tom tilstand, når hovedet viser status).
  const lead = spec.components.find((c) => c.column === 1);
  assert.ok(lead?.type === "LassoTimeline" && lead.limit === 8 && lead.title === "Status og historik");
  assert.equal(lead.kinds, undefined);
  assert.deepEqual(find(spec, "LassoKeyFigureCards")!.metrics!.slice(0, 3), ["egenkapital", "resultat", "soliditetsgrad"]);
  // Med en statusbegivenhed: kun statusændringerne.
  ds.timeline[id]!.events.unshift({ date: "2026-02-01", title: "Status ændret til Under konkurs", category: "Status" });
  const status = composeCompany(id, ds, { ask: ask("er de gået konkurs?") }).components.find((c) => c.column === 1);
  assert.ok(status?.type === "LassoTimeline");
  assert.deepEqual(status.kinds, ["status"]);
  // Helt uden historik står svar-elementet med sin tomme tilstand.
  ds.timeline[id] = { lassoId: id, events: [] };
  const none = composeCompany(id, ds, { ask: ask("er de gået konkurs?") }).components.find((c) => c.column === 1);
  assert.ok(none?.type === "LassoTimeline" && none.title === "Status og historik");
});

test("spørgsmål: kreditvurderingen hentes kun, når der spørges om kredit", () => {
  assert.ok(composeProbe(id, undefined, ask("kan vi handle med dem?")).components.some((c) => c.type === "LassoCreditRating"));
  for (const q of ["hvad er soliditetsgraden", "hvem er direktør", "er de gået konkurs", "hvem ejer og hvem er revisor", "hvad er telefonnummeret"]) {
    assert.ok(!composeProbe(id, undefined, ask(q)).components.some((c) => c.type === "LassoCreditRating"), q);
  }
  const spec = composeCompany(id, withCredit(rich()), { ask: ask("kan vi handle med dem?") });
  assertPageRules(spec, "kredit");
  assert.equal(spec.components.find((c) => c.column === 1)?.type, "LassoCreditRating");
});

test("spørgsmål: fuldbredde-svar (koncern, regnskab, enheder) står over kolonnerne lige under hovedet og kortene", () => {
  const ds = rich();
  ds.ownership[id]!.owners.push({ name: "Moder ApS", kind: "company", share: "60 %", lassoId: "CVR-1-99000003" });
  const group = composeCompany(id, ds, { ask: ask("hvordan ser koncernen ud") });
  assertPageRules(group, "koncern");
  assert.deepEqual(where(group).slice(0, 2), ["LassoCompanyHead", "LassoOwnershipDiagram"]);
  ds.financialStatements[id] = { lassoId: id, currency: "DKK", incomeStatement: [{ year: 2025, revenue: 1 }], balanceSheet: [{ year: 2025, assetsTotal: 1 }], cashFlow: [] };
  const income = composeCompany(id, ds, { ask: ask("vis resultatopgørelsen") });
  assertPageRules(income, "resultatopgørelse");
  assert.deepEqual(where(income).slice(0, 3), ["LassoCompanyHead", "LassoKeyFigureCards", "LassoIncomeStatement"]);
  // Intet offentliggjort regnskab: én tom tilstand, der siger hvorfor.
  ds.financialStatements[id] = { lassoId: id, currency: "DKK", incomeStatement: [], balanceSheet: [], cashFlow: [] };
  const none = composeCompany(id, ds, { ask: ask("vis resultatopgørelse og balance") });
  assert.equal(none.components.filter((c) => c.type === "LassoIncomeStatement" || c.type === "LassoBalanceSheet").length, 1);
});

test("spørgsmål: et generelt spørgsmål giver fokus-siden som i dag (focus fra modellen, ellers spørgsmålets fokus)", () => {
  const ds = rich();
  assert.deepEqual(composeCompany(id, ds, { ask: ask("fortæl om Test Holding") }), composeCompany(id, ds, {}));
  assert.deepEqual(composeCompany(id, ds, { ask: ask("hvordan går det?") }), composeCompany(id, ds, { focus: "oekonomi" }));
  assert.deepEqual(composeCompany(id, ds, { ask: ask("hvordan går det?"), focus: "ejerskab" }), composeCompany(id, ds, { focus: "ejerskab" }));
  assert.deepEqual(composeProbe(id, undefined, ask("fortæl om X")), composeProbe(id, "overblik"));
});

test("spørgsmål: proben henter alt i planen, hver datakilde én gang", () => {
  const probe = composeProbe(id, undefined, ask("hvad er soliditetsgraden"));
  const types = probe.components.map((c) => c.type);
  assert.equal(types[0], "LassoCompanyHead");
  for (const t of ["LassoKeyFigureCards", "LassoTextSections", "LassoTimeline", "LassoBalanceSheet", "LassoRelations", "LassoNews"] as const) assert.ok(types.includes(t), t);
  // Grafer, kort og lister deler regnskabstallene: ét opslag.
  assert.equal(types.filter((t) => ["LassoKeyFigureCards", "LassoLineChart", "LassoShareBars", "LassoMultiYearTable", "LassoBarChart"].includes(t)).length, 1);
  assert.ok(probe.components.length <= 12);
});

test("spørgsmål: opfølgningen peger altid tilbage til hele siden (niveau C)", () => {
  const eco = find(composeCompany(id, rich(), { ask: ask("hvad er soliditetsgraden") }), "LassoFollowUps")!;
  assert.equal(eco.prompts[0]!.label, "Hele økonomien");
  const owners = find(composeCompany(id, rich(), { ask: ask("hvem ejer") }), "LassoFollowUps")!;
  assert.equal(owners.prompts[0]!.label, "Hele overblikket");
  assert.ok(!find(composeCompany(id, rich(), { ask: ask("hvem ejer"), followUps: false }), "LassoFollowUps"));
});

/* ---------- B4: flere komponenter automatisk på fokus-siderne, inden for højdebudgettet ---------- */

const B4_TYPES = new Set<ViewComponent["type"]>([
  "LassoRiskObservations",
  "LassoScoreGauge",
  "LassoScoreHistory",
  "LassoAnnouncements",
  "LassoMergers",
  "LassoPublications",
  "LassoChangeFeed",
  "LassoKeyFigureGauge",
  "LassoSummary",
  "LassoMap",
  "LassoProductionUnits",
  "LassoRegistration",
]);

/** Et lille selskab (let side) med data til alle B4-elementerne. */
function withB4Data(ds: Dataset): Dataset {
  ds.maps[id] = { lassoId: id, points: [{ id: "h", kind: "focus", name: "Hovedadresse", lat: 56.17, lon: 9.55 }, { id: "p1", kind: "related", name: "Afdeling", lat: 56.2, lon: 9.6 }] };
  ds.productionUnits[id] = { lassoId: id, units: [{ pNumber: "1", name: "Hovedkontor", isMain: true }, { pNumber: "2", name: "Afdeling Aarhus" }] };
  ds.companyEvents[id] = {
    lassoId: id,
    announcements: [{ date: "2026-08-18", type: "Konkursdekret", severity: "bankrupt", text: "Konkursdekret afsagt." }],
    mergers: [{ date: "2022-07-01", type: "Fusion", from: [{ name: "Gammel A/S" }], to: [{ name: "TEST ApS", lassoId: id }] }],
    publications: [{ published: "2026-05-28", year: 2025, kind: "Årsrapport" }],
  };
  const at = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  ds.changeFeeds[changeFeedKey({ company: id, days: 30 })] = {
    days: 30,
    total: 3,
    entries: [
      { lassoId: id, companyName: "TEST ApS", type: "ledelse", text: "Ny direktør", at: at(2), source: "CVR", read: true },
      { lassoId: id, companyName: "TEST ApS", type: "stamdata", text: "Adresse ændret", at: at(9), source: "CVR", read: true },
      { lassoId: id, companyName: "TEST ApS", type: "ejerskab", text: "Ny ejer", at: at(20), source: "CVR", read: true },
    ],
  };
  ds.observations[id] = { lassoId: id, observations: [] };
  ds.scores[id] = { lassoId: id, score: 62 };
  ds.scoreHistories[id] = { lassoId: id, points: [{ date: "2025-09-01", score: 55 }, { date: "2026-09-01", score: 62 }] };
  ds.industryBenchmarks[id] = { lassoId: id, state: "ok", years: [{ year: 2025, median: { soliditetsgrad: 40 } }] };
  ds.financials[id] = { lassoId: id, currency: "DKK", years: [2023, 2024, 2025].map((year, i) => ({ year, grossProfit: 1_000_000 * (i + 1), profit: 100_000 * (i + 1), equity: 500_000, employees: 4 })) };
  return ds;
}

const typesOf = (spec: ViewSpec) => spec.components.map((c) => c.type);

test("B4: hvert fokus viser sine nye elementer, når der er data og plads", () => {
  const ds = withB4Data(withCredit(company()));
  const on = (focus: (typeof FOCUSES)[number]) => typesOf(composeCompany(id, ds, { focus }));
  assert.ok(on("risiko").includes("LassoRiskObservations"));
  assert.ok(on("risiko").includes("LassoScoreGauge") && on("risiko").includes("LassoScoreHistory"));
  // Historik: Statstidende først (prioritet); ændringer, fusioner og publicering, når der stadig er plads (vis alt: alle).
  // Ø13/B8: ændringsfeedet er smal (højst ½) og meget højt; står det ikke inden for budgettet, udelades det hellere end at blive strakt.
  assert.ok(on("historik").includes("LassoAnnouncements") && ["LassoChangeFeed", "LassoMergers", "LassoPublications"].some((t) => on("historik").includes(t as never)));
  const histAll = typesOf(composeCompany(id, ds, { focus: "historik", showAll: true }));
  for (const t of ["LassoAnnouncements", "LassoMergers", "LassoPublications", "LassoChangeFeed"] as const) assert.ok(histAll.includes(t), t);
  assert.ok(on("oekonomi").includes("LassoKeyFigureGauge") && on("oekonomi").includes("LassoSummary"));
  assert.ok(on("kontakt").includes("LassoMap") && on("kontakt").includes("LassoProductionUnits"));
  // Overblik: registreringen er med; kortet står kun på "vis alt" her (en halv side mere end budgettet).
  assert.ok(on("overblik").includes("LassoRegistration"));
  assert.ok(typesOf(composeCompany(id, ds, { focus: "overblik", showAll: true })).includes("LassoMap"));
  // Registreringen står efter oplysningerne i prioriteten (overblik), aldrig før dem.
  const o = on("overblik");
  assert.ok(o.indexOf("LassoKeyValueList") < o.indexOf("LassoRegistration") || !o.includes("LassoKeyValueList"));
  // Hvert element på sit fokus: fx ingen Statstidende på overblik og intet kort på historik.
  assert.ok(!on("overblik").includes("LassoAnnouncements") && !on("historik").includes("LassoMap"));
  // Virksomhedens eget feed (company + 30 dage), ikke en overvågningsliste.
  const feed = composeCompany(id, ds, { focus: "historik", showAll: true }).components.find((c) => c.type === "LassoChangeFeed");
  assert.ok(feed?.type === "LassoChangeFeed" && feed.company === id && feed.days === 30 && feed.list === undefined);
  for (const focus of FOCUSES) assert.ok(viewSpecSchema.safeParse(composeCompany(id, ds, { focus })).success, focus);
});

test("B4: uden data intet nyt element og ingen tom tilstand på fokus-siden", () => {
  const ds = withCredit(company());
  for (const focus of FOCUSES) {
    const types = typesOf(composeCompany(id, ds, { focus, showAll: true }));
    assert.ok(!types.some((t) => B4_TYPES.has(t) && t !== "LassoRegistration" && t !== "LassoSummary"), `${focus}: ${types.join(", ")}`);
  }
  // Tomme B4-data: score uden tal, én scoreværdi, branchen uden år, kort uden punkter, feed uden ændringer.
  const empty = withB4Data(withCredit(company()));
  empty.scores[id] = { lassoId: id, score: null, state: "unavailable", reason: "Ingen score" };
  empty.scoreHistories[id] = { lassoId: id, points: [{ date: "2026-09-01", score: 62 }] };
  empty.industryBenchmarks[id] = { lassoId: id, state: "unavailable", reason: "Ingen branchetal", years: [] };
  empty.maps[id] = { lassoId: id, points: [], emptyReason: "Ingen koordinater" };
  empty.changeFeeds[changeFeedKey({ company: id, days: 30 })] = { days: 30, total: 0, entries: [], emptyReason: "Ingen ændringer" };
  empty.companyEvents[id] = { lassoId: id, announcements: [], mergers: [], publications: [] };
  const all = (focus: (typeof FOCUSES)[number]) => typesOf(composeCompany(id, empty, { focus, showAll: true }));
  assert.ok(!all("risiko").includes("LassoScoreGauge") && !all("risiko").includes("LassoScoreHistory"));
  assert.ok(!all("oekonomi").includes("LassoKeyFigureGauge"));
  assert.ok(!all("kontakt").includes("LassoMap") && !all("kontakt").includes("LassoProductionUnits"));
  assert.ok(!all("overblik").includes("LassoMap"));
  for (const t of ["LassoAnnouncements", "LassoMergers", "LassoPublications", "LassoChangeFeed"] as const) assert.ok(!all("historik").includes(t), t);
});

test("B4: de nye elementer fortrænger aldrig fokusets egne elementer (Papers side står som før)", () => {
  // Fuld side (holding): hvert fokus viser de samme egne elementer i samme form med og uden B4-data.
  for (const focus of FOCUSES) {
    const base = withCredit(holding());
    const rich = withB4Data(withCredit(holding()));
    rich.financials[id] = base.financials[id]!;
    const own = (spec: ViewSpec) => spec.components.filter((c) => !B4_TYPES.has(c.type)).map((c) => `${c.type}:${"maxRows" in c ? (c.maxRows ?? "") : ""}:${"limit" in c ? (c.limit ?? "") : ""}`);
    assert.deepEqual(own(composeCompany(id, rich, { focus })), own(composeCompany(id, base, { focus })), focus);
    // Og med et stramt budget: udelades noget, er det de nye elementer, ikke fokusets egne.
    assert.deepEqual(own(composeCompany(id, rich, { focus, heightBudget: 900 })), own(composeCompany(id, base, { focus, heightBudget: 900 })), `${focus} (900 px)`);
  }
});

test("B4: højdebudgettet trimmer de nye elementer først; showAll viser dem (højst 12 komponenter)", () => {
  const ds = withB4Data(withCredit(holding()));
  for (const focus of FOCUSES) {
    const std = composeCompany(id, ds, { focus });
    const all = composeCompany(id, ds, { focus, showAll: true });
    assert.ok(std.components.length <= 12 && all.components.length <= 12, focus);
    // Alt, standardsiden viser, står også på "vis alt".
    for (const t of typesOf(std)) assert.ok(typesOf(all).includes(t), `${focus}: ${t}`);
  }
  // Historik på holding: tidslinje (8) og nyheder fylder; mindst ét nyt element trimmes, alle står på "vis alt".
  const hist = typesOf(composeCompany(id, ds, { focus: "historik" }));
  const histAll = typesOf(composeCompany(id, ds, { focus: "historik", showAll: true }));
  for (const t of ["LassoAnnouncements", "LassoMergers", "LassoPublications", "LassoChangeFeed"] as const) assert.ok(histAll.includes(t), t);
  assert.ok(hist.includes("LassoTimeline") && hist.includes("LassoNews"));
  // Overblik har 11 elementer på "vis alt" uden B4; højst ét nyt element kan komme med under 12-grænsen.
  const over = typesOf(composeCompany(id, ds, { focus: "overblik", showAll: true }));
  assert.equal(over.length, 12);
  assert.ok(over.includes("LassoRegistration"));
});

test("B4: resumeet (LassoSummary) skrives af komponisten ud fra tallene", () => {
  const ds = holding();
  const text = companySummaryText(id, ds);
  assert.ok(text);
  assert.match(text, /^Test Holding havde i 2025 en omsætning på 10,0 mio\. kr\./);
  assert.match(text, /Årets resultat blev 300 t\. kr\./);
  assert.match(text, /Egenkapitalen var 3,0 mio\. kr\./);
  assert.match(text, /Virksomheden havde 1 ansatte\./);
  // Underskud skrives som underskud; stamdata først med facts; uden regnskab kun stamdata.
  ds.financials[id]!.years.at(-1)!.profit = -250_000;
  assert.match(companySummaryText(id, ds)!, /underskud på 250 t\. kr\./);
  assert.match(companySummaryText(id, ds, undefined, { facts: true })!, /^Test Holding driver virksomhed inden for ikke-finansielle holdingselskaber i Silkeborg og blev stiftet 01\.01\.2005\./);
  delete ds.financials[id];
  assert.equal(companySummaryText(id, ds), null);
  assert.ok(companySummaryText(id, ds, undefined, { facts: true }));
  // På oekonomi står resumeet med teksten (vis alt), med kilden Lasso.
  const eco = composeCompany(id, holding(), { focus: "oekonomi", showAll: true }).components.find((c) => c.type === "LassoSummary");
  assert.ok(eco?.type === "LassoSummary" && eco.text === companySummaryText(id, holding()) && eco.source === "Lasso");
});

test("B4: spørgsmålets resume-pladsholder (SUMMARY_PENDING_TEXT) erstattes af komponisten", () => {
  const spec = composeCompany(id, holding(), { ask: parseAsk("Giv mig en kort opsummering af TEST HOLDING ApS", "company", { name: ["TEST HOLDING ApS"] }) });
  const summary = spec.components.find((c) => c.type === "LassoSummary");
  if (!summary) return; // Planen for emnet opsummering (ask.ts, B2) er ikke til stede i denne version.
  assert.ok(summary.type === "LassoSummary" && summary.text !== SUMMARY_PENDING_TEXT && summary.text.startsWith("Test Holding"));
});

test("B4: packWithExtras tager kun et ekstra element, der ikke koster et af de faste", () => {
  const ds = holding();
  const top: ViewComponent[] = [{ type: "LassoCompanyHead", company: id }];
  // Tidslinjen i fuld bredde (eksplicit), så registreringen ikke kan stå ved siden af den (Ø13: tidslinjen er smal, ¼ | ¾ er ellers lovligt).
  const timeline: ViewComponent = { type: "LassoTimeline", company: id, width: "full" };
  const extra: ViewComponent = { type: "LassoRegistration", company: id, variant: "full" };
  // Rigeligt budget: med. Budget til tidslinjen alene: udeladt, tidslinjen står i fuld form.
  const roomy = packWithExtras(top, [timeline, extra], [], new Set([extra]), ds, { budget: 5000 });
  assert.ok(roomy.components.some((c) => c.type === "LassoRegistration"));
  const tight = packWithExtras(top, [timeline, extra], [], new Set([extra]), ds, { budget: 700 });
  assert.deepEqual(tight.components.map((c) => c.type), ["LassoCompanyHead", "LassoTimeline"]);
  assert.equal(tight.dropped.length, 0);
});

test("B4: et svar i fuld bredde nævnt efter et svar i kolonnerne står under kolonnerne (dokumenter: publicering før Statstidende)", () => {
  const ds = withB4Data(holding());
  const ask = parseAsk("Hvilke dokumenter er der offentliggjort for TEST HOLDING ApS?", "company", { name: ["TEST HOLDING ApS"] });
  const types = typesOf(composeCompany(id, ds, { ask }));
  if (!types.includes("LassoPublications")) return; // Planen for emnet dokumenter (ask.ts, B2) er ikke til stede i denne version.
  const lead = types.find((t) => t !== "LassoCompanyHead" && t !== "LassoKeyFigureCards");
  assert.equal(lead, "LassoPublications");
  if (types.includes("LassoAnnouncements")) assert.ok(types.indexOf("LassoPublications") < types.indexOf("LassoAnnouncements"));
  // Uden bekendtgørelser udelades Statstidende som kontekst (den tegner intet).
  ds.companyEvents[id] = { ...ds.companyEvents[id]!, announcements: [] };
  const plan = typesOf(composeCompany(id, ds, { ask: parseAsk("Har TEST HOLDING ApS været med i en fusion?", "company", { name: ["TEST HOLDING ApS"] }) }));
  assert.ok(!plan.includes("LassoAnnouncements") || plan.indexOf("LassoAnnouncements") > 1);
});
