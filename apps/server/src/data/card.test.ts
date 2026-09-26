import assert from "node:assert/strict";
import { test } from "node:test";
import {
  companyTemplate,
  emptyDataset,
  listTemplate,
  parseViewSpec,
  searchKey,
  searchQuerySchema,
  type Dataset,
  ownershipGraphKey,
} from "@lasso/spec";
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
  assert.match(card, /Resultat\s+−2 mia\.\s+▼ underskud/);
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

test("resumeet skrives som en sektion med kildelinje, uden AI-mærke", () => {
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
  assert.ok(card.includes("Kilde: Lasso"));
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
