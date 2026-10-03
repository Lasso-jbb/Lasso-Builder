import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeCompany,
  composePerson,
  PERSON_GRAPH_DEPTH,
  personTimeline,
  type PersonFocus,
  changeFeedKey,
  companyTemplate,
  emptyDataset,
  listTemplate,
  parseAsk,
  parseViewSpec,
  searchKey,
  personSearchKey,
  searchQuerySchema,
  type Dataset,
  ownershipGraphKey,
} from "@lasso/spec";
import { answerText } from "./answer.js";
import { textCard } from "./card.js";

// Opdigtede tal i samme form som Lassos rigtige svar.
const ID = "CVR-1-11111111";
function dataset(): Dataset {
  const ds = emptyDataset("live");
  ds.companies[ID] = {
    lassoId: ID,
    cvr: "11111111",
    name: "TESTFIRMA A/S",
    status: "Normal",
    statusKind: "active",
    form: "A/S",
    industryCode: "212000",
    industryText: "Fremstilling af farmaceutiske præparater",
    address: { street: "Testvej 1", zip: "2880", city: "Bagsværd", municipality: "Gladsaxe", region: "Hovedstaden" },
    founded: "1931-11-28",
    employees: 27279,
    phone: "44448888",
  };
  ds.financials[ID] = {
    lassoId: ID,
    currency: "DKK",
    years: [2023, 2024, 2025].map((year, i) => ({
      year,
      revenue: [232e9, 290e9, 309e9][i]!,
      grossProfit: [196e9, 245e9, 250e9][i]!,
      profit: [83e9, 101e9, -2e9][i]!,
      equity: [106e9, 143e9, 194e9][i]!,
      employees: [51046, 69480, 76343][i]!,
      liabilities: [140e9, 155e9, 168e9][i]!,
    })),
  };
  ds.people[ID] = [
    { name: "Anne Direktør", role: "Administrerende direktør", from: "2025-08-07" },
    { name: "Bo Formand", role: "Bestyrelsesformand", from: "2025-11-14" },
    { name: "Carla Medlem", role: "Bestyrelsesmedlem", from: "2020-01-01" },
    { name: "Dan Tidligere", role: "Bestyrelsesmedlem", from: "2010-01-01", to: "2020-01-01" },
  ];
  ds.ownership[ID] = {
    lassoId: ID,
    owners: [{ name: "Holding A/S", share: "25–33,32 %", votes: "66,67–89,99 %", kind: "company" }],
    auditor: { name: "DELOITTE STATSAUTORISERET REVISIONSPARTNERSELSKAB" },
  };
  return ds;
}

test("tekstkortet har samme bredde på alle linjer og alle sektioner", () => {
  const card = textCard(companyTemplate(ID, { chartMetric: "omsaetning", years: 10 }), dataset())!;
  const lines = card.split("\n");
  for (const l of lines) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  for (const part of ["TESTFIRMA A/S", "Normal, A/S, Bagsværd", "STAMOPLYSNINGER", "CVR          11111111", "2880 Bagsværd", "präparater".replace("ä", "æ"), "28.11.1931", "27.279 (CVR)", "44 44 88 88", "Adm. dir.    Anne Direktør", "Formand      Bo Formand", "Bestyrelse   2 inkl. formand", "66,67–89,99 % stemmer", "REGNSKAB 2025, ÆNDRING FRA 2024", "▲  6,6 %", "OMSÆTNING, MIA. KR.", "2025 ████████████████████   309,0"]) {
    assert.ok(card.includes(part), `mangler "${part}":\n${card}`);
  }
  // Negativt resultat får pil ned; fratrådte personer er ikke med.
  assert.match(card, /Resultat\s+−2 mia\.\s+▼ 102,0 %/);
  assert.ok(!card.includes("Dan Tidligere"));
});

test("tekstkortet viser kun de valgte sektioner", () => {
  const card = textCard(companyTemplate(ID, { sections: ["header", "noegletal", "graf"] }), dataset())!;
  assert.ok(!card.includes("LEDELSE"));
  assert.ok(card.includes("BRUTTOFORTJENESTE, MIA. KR."));
});

test("tekstkortet viser scoren fra LassoScoreGauge, eller 'Ikke oplyst' uden score (katalog 10)", () => {
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoScoreGauge", company: ID }] });
  const ds = dataset();
  ds.scores[ID] = { lassoId: ID, score: 52, source: "Eksempeldata" };
  assert.match(textCard(spec, ds)!, /SCORE[\s\S]*52 af 100/);

  ds.scores[ID] = { lassoId: ID, score: null };
  assert.match(textCard(spec, ds)!, /Ikke oplyst/);
});

test("tekstkort for en søgeliste", () => {
  const search = searchQuerySchema.parse({ query: "test", limit: 2, sort: { field: "omsaetning" } });
  const ds = emptyDataset("live");
  ds.searches[searchKey(search)] = {
    key: searchKey(search),
    total: 722,
    rows: [
      { lassoId: "CVR-1-1", name: "Et meget langt virksomhedsnavn til test ApS", city: "Aarhus C", revenue: 12_500_000 },
      { lassoId: "CVR-1-2", name: "Kort A/S", city: "Vejle", revenue: null },
    ],
  };
  const card = textCard(listTemplate(search, { title: "Søgning: test" }), ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38);
  assert.ok(card.includes("722 virksomheder, viser 2"));
  assert.ok(card.includes("Aarhus C, 12,5 mio."));
  assert.ok(card.includes("NAVN, BY, OMSÆTNING"));
});

test("tekstkortet viser de nye graftyper (13): stablede søjler, vandfald og fordeling", () => {
  const spec = parseViewSpec({
    title: "Datavisualisering",
    kind: "company",
    components: [
      { type: "LassoCompanyHead", company: ID },
      { type: "LassoGroupedBarChart", company: ID, metrics: ["omsaetning", "resultat"] },
      { type: "LassoStackedBarChart", company: ID },
      { type: "LassoWaterfallChart", company: ID },
      { type: "LassoShareBars", company: ID },
    ],
  });
  const card = textCard(spec, dataset())!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  assert.ok(card.includes("OMSÆTNING, MIA. KR."));
  assert.ok(card.includes("RESULTAT, MIA. KR."));
  assert.ok(card.includes("BALANCE, EGENKAPITAL"));
  assert.ok(card.includes("FRA OMSÆTNING TIL RESULTAT 2025"));
  assert.ok(card.includes("Resultat     −2 mia."));
  assert.ok(card.includes("FORDELING AF BALANCEN 2025"));
  assert.ok(card.includes("Egenkapital"));
  assert.ok(!card.includes("·"), "ingen midterprik nogen steder");
});

test("lange selskabsnavne forkortes og deles ved efterled", () => {
  const card = textCard(companyTemplate(ID), dataset())!;
  assert.ok(card.includes("Revisor      DELOITTE STATSAUT."), card);
  assert.ok(card.includes("             REVISIONSPARTNER-"), card);
  assert.ok(card.includes("             SELSKAB "), card);
});

test("tekstkortet viser reelle ejere, tekstsektioner, historik og nyheder, når de er en del af specen", () => {
  const ds = dataset();
  ds.beneficialOwnership[ID] = { lassoId: ID, owners: [{ name: "Anne Eksempel", chain: "via Holding A/S, 100 %", share: "25–33,32 %" }] };
  ds.textSections[ID] = { lassoId: ID, sections: [{ heading: "Branche", body: "Fremstilling af farmaceutiske præparater", note: "NACE 212000" }] };
  ds.timeline[ID] = { lassoId: ID, events: [{ date: "2026-04-15", title: "Årsrapport 2025 offentliggjort", category: "Regnskab" }] };
  ds.news[ID] = { lassoId: ID, items: [{ source: "Børsen", headline: "Testfirma i vækst", time: "2026-04-15" }] };
  const spec = {
    version: 2 as const,
    kind: "company" as const,
    title: "Test",
    layout: "stack" as const,
    criteria: [],
    components: [
      { type: "LassoBeneficialOwners" as const, company: ID },
      { type: "LassoTextSections" as const, company: ID },
      { type: "LassoTimeline" as const, company: ID },
      { type: "LassoNews" as const, company: ID },
    ],
  };
  const card = textCard(parseViewSpec(spec), ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  for (const part of ["REELLE EJERE", "HISTORIK", "Årsrapport 2025 offentliggjort", "NYHEDER", "Testfirma i vækst"]) {
    assert.ok(card.includes(part), `mangler "${part}":\n${card}`);
  }
  assert.match(card, /Ejer\s+Anne Eksempel/);
});

test("resumeet skrives som en sektion uden kildevisning (G3) og uden AI-mærke", () => {
  const spec = {
    version: 2 as const,
    kind: "custom" as const,
    title: "Test",
    layout: "stack" as const,
    criteria: [],
    components: [{ type: "LassoSummary" as const, text: "Firmaet vokser pænt.", source: "Lasso" }],
  };
  const card = textCard(parseViewSpec(spec), emptyDataset("demo"))!;
  assert.ok(card.includes("Firmaet vokser pænt."));
  assert.ok(!card.includes("Kilde:"));
  assert.ok(!/skrevet af ai/i.test(card));
});

test("uden omsætning i de seneste år viser kortet bruttofortjeneste, og linjerne holder bredden", () => {
  const ds = dataset();
  ds.financials[ID]!.years = [2018, 2019, 2024, 2025].map((year, i) => ({
    year,
    revenue: i < 2 ? 3_900_000 + i * 2_900_000 : null,
    grossProfit: [5e6, 7e6, 17.5e6, 18.8e6][i]!,
    profit: [1e5, 2e5, 113_000, -201_000][i]!,
    equity: 3.2e6,
    employees: 19,
  }));
  const card = textCard(companyTemplate(ID, { chartMetric: "omsaetning", years: 10 }), ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  assert.ok(card.includes("BRUTTOFORTJENESTE, MIO. KR."), card);
  assert.ok(card.includes("2025 ████████████████████"), card);
  assert.match(card, /Bruttofortj\.\s+18,8 mio\./);
});

test("tekstkort for ejerdiagrammet: ejere og datterselskaber som indrykket liste", () => {
  const spec = parseViewSpec({ title: "Ejere", components: [{ type: "LassoOwnershipDiagram", company: ID }] });
  const c = spec.components[0]!;
  if (c.type !== "LassoOwnershipDiagram") throw new Error("forkert type");
  const ds = emptyDataset("live");
  ds.ownershipGraphs[ownershipGraphKey(c)] = {
    rootId: ID,
    ingoingDepth: 2,
    outgoingDepth: 1,
    nodes: [
      { id: ID, name: "TESTFIRMA A/S", kind: "company", root: true },
      { id: "CVR-1-2", name: "Et meget langt holdingselskabsnavn ApS", kind: "company" },
      { id: "CVR-3-3", name: "Anne Ejer", kind: "person" },
      { id: "CVR-1-4", name: "Datter ApS", kind: "company" },
    ],
    edges: [
      { from: "CVR-1-2", to: ID, share: [66.67, 89.99] },
      { from: "CVR-3-3", to: "CVR-1-2", share: [100, 100] },
      { from: ID, to: "CVR-1-4", share: [100, 100] },
      { from: "CVR-1-4", to: ID, share: [5, 9.99] },
    ],
  };
  const card = textCard(spec, ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  for (const part of ["EJERE", "66,67–89,99 %", "  Anne Ejer", "DATTERSELSKABER", "Datter ApS"]) assert.ok(card.includes(part), `mangler "${part}":\n${card}`);
  assert.ok(!card.includes("·"));
});

test("tekstkortet viser kontaktblokken (LassoContact) alene, uden LassoCompanyHead", () => {
  const spec = parseViewSpec({ title: "Kontakt", components: [{ type: "LassoContact", company: ID }] });
  const ds = emptyDataset("live");
  ds.contact[ID] = { lassoId: ID, phone: "44448888", email: "kontakt@testfirma.dk", website: "https://testfirma.dk", address: { street: "Testvej 1", zip: "2880", city: "Bagsværd" }, source: "CVR" };
  const card = textCard(spec, ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  for (const part of ["KONTAKT", "Testvej 1", "2880 Bagsværd", "44 44 88 88", "kontakt@testfirma.dk", "testfirma.dk"]) {
    assert.ok(card.includes(part), `mangler "${part}":\n${card}`);
  }
});

test("tekstkortet viser kontaktpersoner (LassoContactPersons), eller 'Ingen kontaktpersoner fundet' når listen er tom", () => {
  const spec = parseViewSpec({ title: "Kontaktpersoner", components: [{ type: "LassoContactPersons", company: ID }] });
  const ds = emptyDataset("live");
  ds.contactPersons[ID] = {
    lassoId: ID,
    people: [
      { name: "Anne Eksempel", role: "Direktør", phone: "44448888" },
      { name: "Bo Eksempel", role: "Salgschef", email: "bo@testfirma.dk" },
    ],
  };
  const withPeople = textCard(spec, ds)!;
  for (const l of withPeople.split("\n")) assert.equal([...l].length, 38);
  assert.ok(withPeople.includes("KONTAKTPERSONER"));
  assert.match(withPeople, /Direktør\s+Anne Eksempel/);

  ds.contactPersons[ID] = { lassoId: ID, people: [] };
  const empty = textCard(spec, ds)!;
  assert.ok(empty.includes("Ingen kontaktpersoner fundet"));
});

function financialStatementsDataset(): Dataset {
  const ds = dataset();
  ds.financialStatements[ID] = {
    lassoId: ID,
    currency: "DKK",
    incomeStatement: [2024, 2025].map((year, i) => ({
      year,
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      revenue: [290e9, 309e9][i]!,
      grossProfit: [245e9, 250e9][i]!,
      staffCosts: [-90e9, -95e9][i]!,
      otherOperatingCosts: [-40e9, -42e9][i]!,
      ebitda: [115e9, 113e9][i]!,
      depreciation: [-10e9, -11e9][i]!,
      financialItemsNet: [1e9, 0.5e9][i]!,
      profitBeforeTax: [106e9, -2.5e9][i]!,
      tax: [-23e9, 0.5e9][i]!,
      profit: [101e9, -2e9][i]!,
    })),
    balanceSheet: [2024, 2025].map((year, i) => ({
      year,
      periodEnd: `${year}-12-31`,
      intangibleAssets: null,
      tangibleAssets: null,
      fixedAssetsTotal: [120e9, 130e9][i]!,
      tradeReceivables: null,
      otherReceivables: null,
      cash: null,
      currentAssetsTotal: [178e9, 232e9][i]!,
      assetsTotal: [298e9, 362e9][i]!,
      shareCapital: null,
      retainedEarnings: null,
      equityTotal: [143e9, 194e9][i]!,
      longTermLiabilities: null,
      shortTermLiabilities: null,
      liabilitiesTotal: [155e9, 168e9][i]!,
      liabilitiesAndEquityTotal: [298e9, 362e9][i]!,
    })),
    cashFlow: [],
  };
  return ds;
}

test("tekstkortet viser resultatopgørelsen og balancen (katalog 19) med '→' mellem årene", () => {
  const spec = parseViewSpec({
    title: "Regnskab",
    components: [
      { type: "LassoIncomeStatement", company: ID },
      { type: "LassoBalanceSheet", company: ID },
    ],
  });
  const card = textCard(spec, financialStatementsDataset())!;
  assert.ok(card.includes("RESULTATOPGØRELSE 2024/2025"), card);
  assert.match(card, /EBITDA\s+115 mia\. → 113 mia\./);
  assert.ok(card.includes("BALANCE 2024/2025"), card);
  assert.match(card, /Aktiver i alt[\s│]+298 mia\. → 362 mia\./);
});

test("tekstkortet viser den præcise tekst 'Pengestrømsopgørelse er ikke indberettet.' når der ikke er pengestrømsdata (katalog 19)", () => {
  const spec = parseViewSpec({ title: "Regnskab", components: [{ type: "LassoCashFlow", company: ID }] });
  const card = textCard(spec, financialStatementsDataset())!;
  // Kortet ombryder lange linjer til kortets faste bredde; sammenlign uden linjeskift/kanter.
  const plain = card.replace(/[│┌┐└┘├┤─\n]/g, " ").replace(/\s+/g, " ");
  assert.ok(plain.includes("Pengestrømsopgørelse er ikke indberettet."), card);
});

test("tekstkortet viser pengestrømmen, når data findes (katalog 19)", () => {
  const spec = parseViewSpec({ title: "Regnskab", components: [{ type: "LassoCashFlow", company: ID }] });
  const ds = financialStatementsDataset();
  ds.financialStatements[ID]!.cashFlow = [
    {
      year: 2025,
      periodEnd: "2025-12-31",
      profit: -2e9,
      depreciation: -11e9,
      workingCapitalChange: null,
      operatingCashFlow: 90e9,
      intangibleInvestments: null,
      investingCashFlow: -30e9,
      capitalIncrease: null,
      loanChange: null,
      financingCashFlow: -20e9,
      netCashFlow: 40e9,
      cashBeginning: 10e9,
      cashEnding: 50e9,
    },
  ];
  const card = textCard(spec, ds)!;
  assert.ok(card.includes("PENGESTRØM 2025"), card);
  assert.match(card, /Fra drift\s+90 mia\./);
  assert.match(card, /Likvider ultimo[\s│]+50 mia\./);
});

test("personkortet (katalog 16) har samme bredde på alle linjer og ingen midterprik", () => {
  const id = "CVR-3-4000000001";
  const ds = emptyDataset("live");
  ds.persons[id] = {
    lassoId: id,
    name: "Mette Holm Eksempel",
    city: "København",
    roles: [
      { companyId: "CVR-1-11111111", companyName: "Data Eksempel A/S", kind: "direction", role: "Adm. direktør", from: "2012-05-14", active: true },
      { companyId: "CVR-1-33333333", companyName: "Cloud Eksempel A/S", kind: "board", role: "Bestyrelsesmedlem", from: "2014-01-01", to: "2018-06-01", active: false, companyStatus: "Under konkurs", companyStatusKind: "warning", companyEnded: "2026-02-01" },
    ],
  };
  ds.personNetworks[id] = { lassoId: id, people: [{ name: "Søren Krogh Eksempel", companies: [{ companyName: "Data Eksempel A/S" }], overlapYears: 14, active: true }] };
  const spec = parseViewSpec({
    kind: "person",
    title: "Mette",
    layout: "columns",
    components: [
      { type: "LassoPersonHead", person: id },
      { type: "LassoPersonRoles", person: id },
      { type: "LassoPersonNetwork", person: id, column: 1 },
      { type: "LassoPersonRisk", person: id, column: 2 },
    ],
  });
  const card = textCard(spec, ds)!;
  const widths = new Set(card.split("\n").map((l) => [...l].length));
  assert.equal(widths.size, 1, card);
  assert.ok(!card.includes("·"));
  assert.match(card, /Mette Holm Eksempel/);
  assert.match(card, /1 aktiv rolle i 1 selskab, 1/);
  assert.match(card, /Adm\. direktør, siden 2012/);
  assert.match(card, /Søren Krogh Eksempel\s+14 år/);
  assert.match(card, /Konkurser\s+1, Info/);
});

test("personkortet følger fokus: kun det, siden viser, i sidens rækkefølge og antal", () => {
  const id = "CVR-3-4000000001";
  const ds = emptyDataset("live");
  const person = {
    lassoId: id,
    name: "Mette Holm Eksempel",
    city: "København",
    zip: "2100",
    roles: [
      { companyId: "CVR-1-11111111", companyName: "Data Eksempel A/S", kind: "direction" as const, role: "Adm. direktør", from: "2012-05-14", active: true },
      { companyId: "CVR-1-22222222", companyName: "Holm Holding ApS", kind: "owner" as const, role: "Ejer", share: "100 %", from: "2009-01-01", active: true },
      { companyId: "CVR-1-33333333", companyName: "Cloud Eksempel A/S", kind: "board" as const, role: "Bestyrelsesmedlem", from: "2014-01-01", to: "2018-06-01", active: false, companyStatus: "Under konkurs", companyStatusKind: "warning" as const, companyEnded: "2026-02-01" },
      { companyId: "CVR-1-44444444", companyName: "Andet Eksempel ApS", kind: "direction" as const, role: "Direktør", from: "2005-01-01", to: "2008-01-01", active: false },
    ],
  };
  ds.persons[id] = person;
  ds.personNetworks[id] = {
    lassoId: id,
    people: Array.from({ length: 5 }, (_, i) => ({ name: `Person ${i} Eksempel`, companies: [{ companyName: "Data Eksempel A/S" }], overlapYears: 10 - i, active: true })),
  };
  ds.timeline[id] = personTimeline(person, "2026-09-27");
  ds.news[id] = { lassoId: id, items: [{ source: "Lasso", headline: "Mette Holm Eksempel i ny bestyrelse" }] };
  const key = ownershipGraphKey({ person: id, ...PERSON_GRAPH_DEPTH });
  ds.ownershipGraphs[key] = {
    rootId: id,
    nodes: [
      { id, name: "Mette Holm Eksempel", kind: "person", root: true },
      { id: "CVR-1-22222222", name: "Holm Holding ApS", kind: "company" },
      { id: "CVR-1-55555555", name: "Holm Datter ApS", kind: "company" },
    ],
    edges: [
      { from: id, to: "CVR-1-22222222", share: [100, 100] },
      { from: "CVR-1-22222222", to: "CVR-1-55555555", share: [100, 100] },
    ],
    ingoingDepth: 0,
    outgoingDepth: 2,
  };
  const card = (focus: PersonFocus) => textCard(composePerson(id, ds, { focus }), ds)!;
  const same = (c: string) => assert.equal(new Set(c.split("\n").map((l) => [...l].length)).size, 1, c);

  const overview = card("overblik");
  same(overview);
  assert.match(overview, /AKTIVE ROLLER/);
  assert.match(overview, /Adm\. direktør, siden 2012/);
  assert.doesNotMatch(overview, /NYHEDER/);
  // Stamoplysningerne og risikosektionen er udgået (byen står i hovedet, konkurserne i persontallene);
  // netværket viser 3 som siden, resten som "og 2 flere".
  assert.match(overview, /Person, København/);
  assert.doesNotMatch(overview, /STAMOPLYSNINGER|Bopæl|Enhedsnummer|RISIKO/);
  assert.match(overview, /NETVÆRKSTAL/);
  assert.match(overview, /Konkurser\s+1/);
  // Kortet følger sidens antal (Jakob 01.10: uden historik og ejerskab på overblikket står netværket med 3).
  const net = composePerson(id, ds).components.find((c) => c.type === "LassoPersonNetwork");
  const shown = net?.type === "LassoPersonNetwork" ? (net.limit ?? 3) : 0;
  assert.equal(shown, 3);
  assert.match(overview, new RegExp(`Person ${shown - 1} Eksempel`));
  assert.doesNotMatch(overview, new RegExp(`Person ${shown} Eksempel`));
  assert.match(overview, new RegExp(`og ${5 - shown} flere`));

  const risk = card("risiko");
  same(risk);
  assert.match(risk, /FORLØB I SELSKABERNE/);
  assert.match(risk, /Cloud Eksempel A\/S kom under/);
  // De øvrige ophørte roller hører til fanen Roller (tidsbåndene), ikke risiko.
  assert.doesNotMatch(risk, /ØVRIGE OPHØRTE ROLLER|Andet Eksempel ApS/);
  assert.doesNotMatch(risk, /Indtrådt som adm\. direktør i Data Eksempel/, "forløbet har kun konkursselskabet");
  assert.doesNotMatch(risk, /STAMOPLYSNINGER|RISIKO|NYHEDER|SIDDER SAMMEN MED/);
  assert.match(card("roller"), /Andet Eksempel ApS/);

  const owner = card("ejerskab");
  same(owner);
  assert.match(owner, /EJERSKABER/);
  assert.match(owner, /Ejer 100 %, siden 2009/);
  // Diagrammet gentager ikke de ejede selskaber, men viser strukturen under dem.
  assert.match(owner, /EJERSTRUKTUR/);
  assert.match(owner, /Under de ejede selskaber \(1\):/);
  assert.match(owner, /Holm Datter ApS, 100 %/);
  assert.doesNotMatch(owner, /Ejerandel 100 %/);

  const history = card("historik");
  assert.match(history, /NYHEDER/);
  assert.match(history, /og 2 flere begivenheder/);
  assert.doesNotMatch(card("netvaerk"), /og \d+ flere/, "netværksfanen viser alle 5");
});

test("tekstkort og resumé viser EUR/USD-regnskaber i deres valuta, ikke som kroner (Vestas/Mærsk)", async () => {
  const { summarizeView } = await import("./summary.js");
  const ds = dataset();
  ds.financials[ID] = {
    ...ds.financials[ID]!,
    currency: "EUR",
    years: ds.financials[ID]!.years.map((y) => ({ ...y, revenue: 18_822_000_000, currency: "EUR", scope: "Koncern" as const })),
  };
  const spec = companyTemplate(ID, { chartMetric: "omsaetning", years: 3 });
  const card = textCard(spec, ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  assert.ok(card.includes("OMSÆTNING, MIA. EUR"), card);
  assert.ok(/BELØB I EUR/.test(card), card);
  assert.ok(!/mia\. kr\./i.test(card), card);
  const summary = summarizeView(spec, ds);
  assert.match(summary, /omsætning 18,8 mia\. EUR/);
  assert.match(summary, /koncerntal; beløb i EUR, ikke kroner/);
  assert.ok(!summary.includes("mia. kr."), summary);
});

test("tekstkortet for DKK er uændret (ingen valutakode)", () => {
  const card = textCard(companyTemplate(ID, { chartMetric: "omsaetning", years: 3 }), dataset())!;
  assert.ok(card.includes("OMSÆTNING, MIA. KR."));
  assert.ok(!card.includes("DKK"));
});

test("ændringsfeedet (katalog 21) som tekstkort: samme bredde, ingen midterprik, status som fra -> til, 3 + Se N flere", () => {
  const spec = parseViewSpec({ title: "Overvågning", components: [{ type: "LassoChangeFeed", list: "Kunder" }] });
  const c = spec.components[0]!;
  if (c.type !== "LassoChangeFeed") throw new Error("forkert type");
  const ds = emptyDataset("demo");
  ds.changeFeeds[changeFeedKey(c)] = {
    listName: "Kunder",
    days: 7,
    total: 9,
    source: "Eksempeldata",
    entries: [
      { lassoId: "CVR-1-1", companyName: "Cloud Eksempel A/S", type: "status", text: "Status ændret", from: "Aktiv", to: "Under konkurs", at: "2026-09-25T09:14:00", source: "CVR", read: false },
      { lassoId: "CVR-1-2", companyName: "Nordisk Prøve A/S", type: "regnskab", text: "Årsrapport 2025 offentliggjort, bruttofortjeneste 96,4 mio. kr. (+12,1 %)", at: "2026-09-25T07:02:00", source: "CVR", read: false },
      { companyName: "Eksempel Byg A/S", type: "stamdata", text: "Antal ansatte opdateret for 3. kvartal", at: "2026-09-24T06:00:00", source: "CVR", read: true, count: 5, companies: ["a", "b", "c", "d", "e"] },
      { lassoId: "CVR-1-3", companyName: "Prøve ApS", type: "ledelse", text: "Nyt bestyrelsesmedlem", at: "2026-09-23T14:40:00", source: "CVR", read: true },
    ],
  };
  const card = textCard(spec, ds)!;
  const widths = new Set(card.split("\n").map((l) => [...l].length));
  assert.equal(widths.size, 1, card);
  assert.ok(!card.includes("·"));
  assert.match(card, /ÆNDRINGER I "KUNDER" \(9\)/);
  assert.match(card, /25\.09\.2026/);
  assert.match(card, /Cloud Eksempel A\/S, status/);
  assert.match(card, /Aktiv -> Under konkurs, ulæst/);
  assert.match(card, / kl\. 09\.14/);
  assert.doesNotMatch(card, /CVR, kl\./, "21.1: ingen kildetype");
  assert.match(card, /5 virksomheder, stamdata/);
  assert.match(card, /Se 1 mere/);
  assert.ok(!card.includes("Prøve ApS"), "kun 3 rækker vises");

  // Tom tilstand siger hvorfor
  ds.changeFeeds[changeFeedKey(c)] = { listName: "Kunder", days: 7, total: 0, entries: [], emptyReason: "Ingen ændringer i \"Kunder\" de seneste 7 dage." };
  assert.match(textCard(spec, ds)!, /Ingen ændringer i "Kunder"/);
});

test("tekstkort for regnskab uden regnskab: forklaringen én gang og ingen ledelse (den står på ledelse, med sine roller, når der hverken er direktør eller bestyrelse)", () => {
  const ds = dataset();
  ds.companies[ID] = { ...ds.companies[ID]!, form: "ENK", founded: "2023-01-30" };
  ds.people[ID] = [{ name: "Christian Sander Kjær", role: "Fuldt ansvarlig deltager", from: "2023-01-30" }];
  ds.financials[ID] = { lassoId: ID, currency: "DKK", years: [] };
  ds.financialStatements[ID] = { lassoId: ID, currency: "DKK", incomeStatement: [], balanceSheet: [], cashFlow: [] };
  const card = textCard(composeCompany(ID, ds, { focus: "regnskab" }), ds)!;
  assert.match(card, /REGNSKAB\s*│\n│ Enkeltmandsvirksomheder og/);
  assert.equal((card.match(/skal ikke indsende/g) ?? []).length, 1);
  // Paper (23.1): regnskab uden regnskab viser oplysninger og ledelse ved siden af den tomme tilstand.
  assert.match(card, /Christian Sander Kjær/);
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  // Ikke en tom "LEDELSE"-overskrift på ledelse: rollen står som den er (regel 9).
  const lead = textCard(composeCompany(ID, ds, { focus: "ledelse" }), ds)!;
  assert.match(lead, /LEDELSE[^\n]*│\n│ Fuldt ansvarlig deltager/);
  assert.match(lead, /Christian Sander Kjær/);
  for (const l of lead.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
});

test("resuméet på risiko har kreditvurderingen (revisoruafhængigheden er slettet, Jakob 01.10)", async () => {
  const { summarizeView } = await import("./summary.js");
  const ds = dataset();
  ds.creditRatings[ID] = { lassoId: ID, state: "ok", source: "Creditsafe via Lasso", current: { internationalScore: "B", creditMax: 250_000, creditCurrency: "DKK", localScore: 62 } };
  const summary = summarizeView(composeCompany(ID, ds, { focus: "risiko", showAll: true }), ds);
  assert.match(summary, /Kreditvurdering \(Creditsafe\): /);
  assert.doesNotMatch(summary, /Revisoruafhængighed/);
});

test("resuméet til modellen har regnskabslinjen én gang, også på regnskab, hvor nøgletalskortene ikke står", async () => {
  const { summarizeView } = await import("./summary.js");
  const ds = dataset();
  ds.financialStatements[ID] = { lassoId: ID, currency: "DKK", incomeStatement: [{ year: 2025, revenue: 1_000_000, profit: 100_000 }], balanceSheet: [{ year: 2025, assetsTotal: 500_000 }], cashFlow: [] };
  for (const focus of ["overblik", "oekonomi", "regnskab"] as const) {
    const summary = summarizeView(composeCompany(ID, ds, { focus }), ds);
    assert.equal((summary.match(/Regnskab \d{4}/g) ?? []).length, 1, `${focus}:\n${summary}`);
  }
});

test("tekstkortet viser samme tekstafsnit som visningen: profilen uden branche og de sene analyseafsnit, analysen for sig", () => {
  const ds = dataset();
  const analysis = ["Regnskabsanalyse: konklusion", "Resultat", "Likviditet", "Balance og kapitalforhold", "Branchestatistik"];
  ds.textSections[ID] = {
    lassoId: ID,
    sections: [
      { heading: "Branche", body: "Fremstilling af farmaceutiske præparater", note: "NACE 212000" },
      { heading: "Formål", body: "At drive virksomhed." },
      ...analysis.map((heading) => ({ heading, body: `Tekst om ${heading.toLowerCase()}.`, note: "Kilde: Lasso regnskabsanalyse" })),
    ],
  };
  const card = (variant: "profil" | "analyse") =>
    textCard(parseViewSpec({ version: 2, kind: "company", title: "Test", layout: "stack", criteria: [], components: [{ type: "LassoTextSections", company: ID, variant }] }), ds)!;
  const profil = card("profil");
  for (const part of ["FORMÅL", "REGNSKABSANALYSE: KONKLUSION", "RESULTAT"]) assert.ok(profil.includes(part), `mangler "${part}":\n${profil}`);
  // Jakob 03.10: Likviditet vises aldrig, heller ikke i tekstkortet.
  assert.ok(!profil.includes("LIKVIDITET") && !card("analyse").includes("LIKVIDITET"), profil);
  for (const part of ["Fremstilling af farmaceutiske", "BALANCE OG KAPITALFORHOLD", "BRANCHESTATISTIK"]) assert.ok(!profil.includes(part), `"${part}" hører ikke til profilen:\n${profil}`);
  const analyse = card("analyse");
  assert.ok(analyse.includes("BRANCHESTATISTIK") && !analyse.includes("FORMÅL"), analyse);
});

test("tekstkortet svarer på spørgsmålet først og følger elementernes filtre (roles, kinds, rows, only)", () => {
  const ds = dataset();
  ds.timeline[ID] = { lassoId: ID, events: [{ date: "2025-11-14", title: "Bo Formand er indtrådt", category: "Ledelse" }, { date: "2025-04-15", title: "Årsrapport 2024 offentliggjort", category: "Regnskab" }] };
  const ask = parseAsk("Hvem er direktør i Testfirma?", "company", { name: "TESTFIRMA A/S" });
  const spec = composeCompany(ID, ds, { ask, name: "TESTFIRMA A/S" });
  const card = textCard(spec, ds, { ask })!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  // SVAR lige under navnet og status, før stamoplysningerne.
  assert.ok(card.indexOf("SVAR") < card.indexOf("STAMOPLYSNINGER"), card);
  assert.match(card, /Direktion: Anne Direktør/);
  // Personlisten viser kun direktionen, historikken kun ledelsesændringerne.
  assert.ok(!card.includes("Bo Formand\n") && !/Formand +Bo Formand/.test(card), card);
  assert.match(card, /LEDELSESÆNDRINGER/);
  assert.ok(!card.includes("Årsrapport 2024 offentliggjort"));
  // Revisoren som rækker (rows) og nøgletallene for et år (only, year).
  const rows = parseViewSpec({
    title: "x",
    kind: "company",
    components: [
      { type: "LassoCompanyHead", company: ID },
      { type: "LassoKeyValueList", company: ID, variant: "company", rows: ["revisor", "regnskabsperiode"], title: "Revisor" },
      { type: "LassoKeyValueList", company: ID, variant: "financials", only: ["egenkapital", "gaeld"], year: 2024 },
    ],
  });
  const withRows = textCard(rows, ds)!;
  assert.match(withRows, /REVISOR[\s\S]*Revisor +DELOITTE/);
  assert.match(withRows, /REGNSKAB 2024[\s\S]*Egenkapital +143 mia\.[\s\S]*Gæld +155 mia\./);
  // Uden spørgsmål: ingen SVAR-sektion.
  assert.ok(!textCard(composeCompany(ID, ds, {}), ds)!.includes("SVAR"));
});

test("08.1/16.1: tekstkortet viser status med dato, binavn, kurator og risikolinjen som hovedet", () => {
  const ds = dataset();
  ds.companies[ID] = { ...ds.companies[ID]!, status: "Under konkurs", statusKind: "warning", statusDate: "2026-06-03", curator: "Advokat Eksempel", secondaryNames: ["Test Vind"] };
  ds.observations[ID] = { lassoId: ID, observations: [{ id: "k", severity: 100, title: "Virksomheden er under konkurs" }] };
  const card = textCard(parseViewSpec({ kind: "company", title: "X", components: [{ type: "LassoCompanyHead", company: ID, risk: true }] }), ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38, `linjen "${l}" har forkert bredde`);
  const flat = card.replace(/\s+/g, " ");
  assert.ok(flat.includes("Under konkurs, siden 03.06.2026"), card);
  assert.ok(flat.includes("binavn Test Vind"), card);
  assert.ok(flat.includes("Kurator: Advokat Eksempel"), card);
  assert.ok(flat.includes("Risiko: 1 vigtig observation"), card);
  assert.ok(!card.includes("·"));
});

test("tekstkort for persontabellen (15.3): roller, fødselsår, by og konkurser", () => {
  const spec = parseViewSpec({ title: "Personer", components: [{ type: "LassoPersonTable", query: "Mette Eksempel" }] });
  const ds = emptyDataset("demo");
  const key = personSearchKey({ query: "Mette Eksempel", limit: 25 });
  ds.personSearches = {
    [key]: {
      key,
      query: "Mette Eksempel",
      total: 1,
      rows: [{ lassoId: "CVR-3-1", name: "Mette Eksempel", birthYear: 1978, city: "København", bankruptcies: 1, roles: [{ companyName: "Data Eksempel A/S", role: "direktør" }] }],
    },
  };
  const card = textCard(spec, ds)!;
  for (const l of card.split("\n")) assert.equal([...l].length, 38);
  assert.ok(card.includes("Mette Eksempel"));
  // 15.3: kun navnet; ingen fødselsår eller by.
  assert.ok(card.includes("1 konkurs"));
  assert.doesNotMatch(card, /f\. 1978|København/);
  assert.doesNotMatch(card, /·/);
});

/* ---------- B3: svarsætninger for de nye spørgsmålstyper (Ø4: tekstkortet må ikke blive kortere) ---------- */

test("B3: 'Er der røde flag' giver både observations- og kreditsætningen på tekstkortet", () => {
  const ds = dataset();
  ds.observations[ID] = {
    lassoId: ID,
    observations: [
      { id: "o1", severity: 100, title: "Konkursramt selskab i ledelsen" },
      { id: "o2", severity: 0, title: "Ingen bemærkninger" },
    ],
  };
  ds.creditRatings = { [ID]: { lassoId: ID, state: "locked" } as never };
  const ask = parseAsk("Er der røde flag ved Testfirma?", "company", { name: "TESTFIRMA A/S", topic: "roede-flag" });
  const spec = composeCompany(ID, ds, { ask, name: "TESTFIRMA A/S" });
  const card = textCard(spec, ds, { ask })!;
  const flat = card.replace(/[│\n]/g, " ").replace(/\s+/g, " ");
  assert.match(flat, /Røde flag: 1 observation \(Konkursramt selskab i ledelsen, vigtig\)/);
  assert.match(flat, /Kreditvurdering: låst/);
  // Nævner spørgsmålet også kredit, står kreditsætningen kun én gang.
  const both = parseAsk("Er der røde flag, og kan vi handle med dem på kredit?", "company", { name: "TESTFIRMA A/S" });
  const bothCard = textCard(composeCompany(ID, ds, { ask: both, name: "TESTFIRMA A/S" }), ds, { ask: both })!;
  const bothFlat = bothCard.replace(/[│\n]/g, " ").replace(/\s+/g, " ");
  assert.equal((bothFlat.match(/Kreditvurdering:/g) ?? []).length, 1, bothCard);
  assert.match(bothFlat, /Røde flag:/);
});

test("B3: de nye spørgsmålstyper har hver en svarsætning, også som tom tilstand", () => {
  const ds = dataset();
  const spec = composeCompany(ID, ds, {});
  const answer = (q: string, topic?: string) => {
    const ask = parseAsk(q, "company", { name: "TESTFIRMA A/S", topic });
    return answerText(spec, ds, ask) ?? "";
  };
  // Tom tilstand først (ingen data i datasættet).
  assert.match(answer("Er der røde flag?"), /Røde flag: ikke hentet/);
  assert.match(answer("Har der været fusioner?"), /Fusioner og spaltninger: ingen registreret/);
  assert.match(answer("Hvilke meddelelser er der i Statstidende?"), /Statstidende: ingen meddelelser/);
  assert.match(answer("Vis de offentliggjorte dokumenter", "dokumenter"), /Offentliggjorte regnskaber: ingen offentliggjort/);
  assert.match(answer("Hvordan klarer de sig i forhold til branchen?"), /Branchesammenligning: ikke beregnet endnu/);
  assert.match(answer("Vis dem på et kort"), /Placering: ingen adresser med koordinater/);
  assert.match(answer("Vis hele regnskabet"), /Hele regnskabet: intet offentliggjort regnskab/);
  assert.match(answer("Hvad er selskabskapitalen?"), /Registrering: A\/S/);
  assert.match(answer("Giv mig en kort opsummering"), /^Opsummering: A\/S, Normal/);
  assert.match(answer("Hvad er der sket de sidste 30 dage?"), /Ændringer: ingen registrerede ændringer/);

  // Med data.
  ds.companyEvents[ID] = {
    lassoId: ID,
    mergers: [{ type: "Fusion", date: "2024-01-01", from: [{ name: "A ApS" }], to: [{ name: "B A/S" }] }],
    announcements: [{ date: "2025-03-01", type: "Rekonstruktion", severity: "bankrupt" }],
    publications: [{ kind: "Årsrapport", year: 2025 }],
  };
  ds.maps[ID] = { lassoId: ID, points: [{ id: "p", kind: "focus", name: "Hoved", lat: 55, lon: 12 }], missing: 1 };
  ds.changeFeeds[`company:${ID}|30|`] = { days: 30, total: 2, entries: [{ companyName: "TESTFIRMA A/S", type: "status", text: "Status ændret", at: "2025-05-01T10:00:00Z", source: "CVR", read: false }] };
  assert.match(answer("Har der været fusioner?"), /Fusioner og spaltninger: fusion 01\.01\.2024: A ApS → B A\/S/);
  assert.match(answer("Hvilke meddelelser er der i Statstidende?"), /Statstidende: 1 meddelelse \(01\.03\.2025 Rekonstruktion\)/);
  assert.match(answer("Vis de offentliggjorte dokumenter", "dokumenter"), /Offentliggjorte regnskaber: 1 \(årsrapport 2025\)/);
  assert.match(answer("Vis dem på et kort"), /Placering: 1 adresse på kortet, 1 uden koordinater/);
  assert.match(answer("Hvad er der sket de sidste 30 dage?"), /Ændringer seneste 30 dage: 2 \(Status ændret\)/);

  // Personen: antal roller.
  const pid = "CVR-3-4000000001";
  ds.persons[pid] = {
    lassoId: pid,
    name: "Mette Holm",
    roles: [
      { companyId: "CVR-1-1", companyName: "Et ApS", role: "Direktør", kind: "direction", active: true },
      { companyId: "CVR-1-2", companyName: "To ApS", role: "Bestyrelsesmedlem", kind: "board", active: false },
    ] as never,
  };
  const pspec = composePerson(pid, ds, { focus: "overblik" });
  const pask = parseAsk("Hvor mange roller har hun?", "person", { name: "Mette Holm" });
  assert.match(answerText(pspec, ds, pask) ?? "", /Roller: 2 selskaber, heraf 1 aktive og 1 ophørte; konkurser 0, tvangsopløsninger 0/);
});

test("compareCard: rangeringen står i samme rækkefølge som LassoRanking (asc: laveste som nr. 1)", () => {
  const ds = emptyDataset("live");
  const ids = ["CVR-1-1", "CVR-1-2", "CVR-1-3"];
  const gross = [20_000_000, 30_000_000, 10_000_000];
  ids.forEach((id, i) => {
    ds.companies[id] = { lassoId: id, cvr: String(i), name: `Firma${i}`, status: "Normal", statusKind: "active" } as never;
    ds.financials[id] = { lassoId: id, currency: "DKK", years: [{ year: 2025, grossProfit: gross[i] }] } as never;
  });
  const build = (order: "asc" | "desc") =>
    parseViewSpec({ kind: "custom", title: "t", layout: "dashboard", components: [{ type: "LassoRanking", companies: ids, metric: "bruttofortjeneste", order }] });
  const first = (o: "asc" | "desc") => textCard(build(o), ds)!.match(/1\.\s+(Firma\d)/)?.[1];
  assert.equal(first("asc"), "Firma2");
  assert.equal(first("desc"), "Firma1");
});
