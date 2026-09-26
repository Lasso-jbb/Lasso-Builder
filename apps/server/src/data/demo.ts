import {
  formatAmount,
  searchKey,
  type BeneficialOwnershipVM,
  type CompanyRowVM,
  type CompanyVM,
  type ContactPersonVM,
  type ContactPersonsVM,
  type ContactVM,
  type FinancialsVM,
  type FinancialStatementsVM,
  type NewsVM,
  type AuditorIndependenceVM,
  type AuditorRelationVM,
  type ObservationRowVM,
  type ObservationsVM,
  type OwnershipVM,
  type PersonRowVM,
  type ScoreVM,
  type LivestockVM,
  type PropertiesVM,
  type ProductionUnitsVM,
  type SearchQuery,
  type SearchResultVM,
  type TextSectionsVM,
  type TimelineVM,
} from "@lasso/spec";
import { applyCriteria, sortRows } from "./criteria-eval.js";
import { demoOwnershipGraph } from "./demoGraph.js";
import { demoFindPersons, demoPerson, demoPersonIds, demoPersonNetwork } from "./demoPeople.js";
import { NotFoundError, type DataProvider, type OwnershipGraphOptions } from "./provider.js";

/**
 * Opdigtede demodata, så UI og MCP-flow kan bygges og testes uden adgang til
 * Lassos API. Alle navne indeholder "Eksempel"/"Prøve", og CVR-numrene ligger
 * i et interval, der ikke findes i CVR. Bruges automatisk, når der ikke er
 * Lasso-credentials (LASSO_DATA_SOURCE=auto).
 */

interface DemoCompany extends CompanyVM {
  base: number;
  growth: number;
  people: PersonRowVM[];
  owners: OwnershipVM["owners"];
  auditor: string;
}

const P = (name: string, role: string, from: string, to?: string): PersonRowVM => ({ name, role, from, to });

const RAW: Omit<DemoCompany, "lassoId" | "statusKind">[] = [
  { cvr: "99000001", name: "Eksempel Byg A/S", status: "Aktiv", form: "A/S", industryCode: "412000", industryText: "Opførelse af bygninger", address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, founded: "1998-04-01", employees: 64, base: 38_000_000, growth: 0.07,
    phone: "86123456", email: "kontakt@eksempelbyg.dk", website: "https://eksempelbyg.dk",
    people: [P("Anne Eksempel", "Direktør", "2015-01-01"), P("Bo Eksempel", "Bestyrelsesformand", "2012-05-01"), P("Carla Prøve", "Bestyrelsesmedlem", "2024-03-15"), P("Dan Prøve", "Bestyrelsesmedlem", "2016-06-01", "2024-03-15")],
    owners: [{ name: "Eksempel Holding ApS", share: "66,67-89,99 %", kind: "company", lassoId: "CVR-1-99000010" }, { name: "Anne Eksempel", share: "10-14,99 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000002", name: "Eksempel Revision Midt ApS", status: "Aktiv", form: "ApS", industryCode: "692000", industryText: "Revision og bogføring", address: { street: "Tællegade 12", zip: "8000", city: "Aarhus C", municipality: "Aarhus", region: "Midtjylland" }, founded: "2006-09-01", employees: 22, base: 14_500_000, growth: 0.05,
    people: [P("Erik Prøve", "Direktør", "2006-09-01"), P("Fie Eksempel", "Bestyrelsesformand", "2019-01-01")],
    owners: [{ name: "Erik Prøve", share: "50-66,66 %", kind: "person" }, { name: "Fie Eksempel", share: "33,34-49,99 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000003", name: "Eksempel Revision Nord ApS", status: "Aktiv", form: "ApS", industryCode: "692000", industryText: "Revision og bogføring", address: { street: "Bilagsvej 4", zip: "9000", city: "Aalborg", municipality: "Aalborg", region: "Nordjylland" }, founded: "2011-02-01", employees: 17, base: 11_200_000, growth: 0.03,
    people: [P("Gitte Prøve", "Direktør", "2011-02-01")], owners: [{ name: "Gitte Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000004", name: "Eksempel Transport A/S", status: "Aktiv", form: "A/S", industryCode: "494100", industryText: "Vejgodstransport", address: { street: "Lastvej 20", zip: "7100", city: "Vejle", municipality: "Vejle", region: "Syddanmark" }, founded: "1987-11-01", employees: 118, base: 52_000_000, growth: -0.02,
    people: [P("Hans Eksempel", "Direktør", "2020-08-01"), P("Ida Prøve", "Direktør", "2009-01-01", "2020-08-01"), P("Jens Eksempel", "Bestyrelsesformand", "2018-04-01")],
    owners: [{ name: "Eksempel Holding ApS", share: "100 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000005", name: "Eksempel Software ApS", status: "Aktiv", form: "ApS", industryCode: "620100", industryText: "Computerprogrammering", address: { street: "Kodevej 3", zip: "8200", city: "Aarhus N", municipality: "Aarhus", region: "Midtjylland" }, founded: "2017-03-01", employees: 41, base: 21_000_000, growth: 0.22,
    people: [P("Kim Prøve", "Direktør", "2017-03-01"), P("Lene Eksempel", "Bestyrelsesmedlem", "2023-10-01")], owners: [{ name: "Kim Prøve", share: "50-66,66 %", kind: "person" }, { name: "Lene Eksempel", share: "20-24,99 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000006", name: "Eksempel Tømrer ApS", status: "Aktiv", form: "ApS", industryCode: "433200", industryText: "Tømrer- og bygningssnedkervirksomhed", address: { street: "Høvlvej 8", zip: "8800", city: "Viborg", municipality: "Viborg", region: "Midtjylland" }, founded: "2009-06-01", employees: 12, base: 6_800_000, growth: 0.04,
    people: [P("Mads Eksempel", "Direktør", "2009-06-01")], owners: [{ name: "Mads Eksempel", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000007", name: "Eksempel Rådgivning A/S", status: "Aktiv", form: "A/S", industryCode: "702200", industryText: "Virksomhedsrådgivning", address: { street: "Strategistræde 2", zip: "1150", city: "København K", municipality: "København", region: "Hovedstaden" }, founded: "2002-01-01", employees: 35, base: 29_000_000, growth: 0.09,
    people: [P("Nina Prøve", "Direktør", "2021-01-01"), P("Ole Eksempel", "Bestyrelsesformand", "2002-01-01")], owners: [{ name: "Ole Eksempel", share: "90-100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000008", name: "Eksempel Maskinfabrik A/S", status: "Aktiv", form: "A/S", industryCode: "282900", industryText: "Fremstilling af maskiner", address: { street: "Smedevej 15", zip: "7400", city: "Herning", municipality: "Herning", region: "Midtjylland" }, founded: "1974-05-01", employees: 210, base: 96_000_000, growth: 0.01,
    people: [P("Per Eksempel", "Direktør", "2016-01-01"), P("Rikke Prøve", "Bestyrelsesformand", "2024-06-01"), P("Søren Eksempel", "Bestyrelsesformand", "2010-01-01", "2024-06-01")], owners: [{ name: "Eksempel Holding ApS", share: "50-66,66 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000009", name: "Eksempel Café I/S", status: "Ophørt", form: "I/S", industryCode: "563000", industryText: "Caféer og barer", address: { street: "Torvet 1", zip: "8660", city: "Skanderborg", municipality: "Skanderborg", region: "Midtjylland" }, founded: "2015-05-01", employees: 0, base: 1_200_000, growth: -0.3,
    people: [P("Tina Prøve", "Interessent", "2015-05-01", "2023-12-31")], owners: [{ name: "Tina Prøve", share: "50-66,66 %", kind: "person" }], auditor: "Ingen" },
  { cvr: "99000010", name: "Eksempel Holding ApS", status: "Aktiv", form: "ApS", industryCode: "642020", industryText: "Ikke-finansielle holdingselskaber", address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, founded: "2005-01-01", employees: 1, base: 3_000_000, growth: 0.1,
    people: [P("Bo Eksempel", "Direktør", "2005-01-01")], owners: [{ name: "Bo Eksempel", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000011", name: "Eksempel Energi A/S", status: "Under konkurs", form: "A/S", industryCode: "351100", industryText: "Produktion af elektricitet", address: { street: "Vindvej 9", zip: "6700", city: "Esbjerg", municipality: "Esbjerg", region: "Syddanmark" }, founded: "2012-08-01", employees: 8, base: 9_000_000, growth: -0.18,
    people: [P("Uffe Prøve", "Direktør", "2012-08-01"), P("Bo Eksempel", "Bestyrelsesmedlem", "2014-03-01", "2018-06-30")], owners: [{ name: "Uffe Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000012", name: "Eksempel Ejendomme ApS", status: "Aktiv", form: "ApS", industryCode: "682040", industryText: "Udlejning af erhvervsejendomme", address: { street: "Murervej 5", zip: "8700", city: "Horsens", municipality: "Horsens", region: "Midtjylland" }, founded: "2013-10-01", employees: 3, base: 7_500_000, growth: 0.06,
    people: [P("Vera Eksempel", "Direktør", "2013-10-01"), P("Bo Eksempel", "Bestyrelsesmedlem", "2013-10-01")], owners: [{ name: "Eksempel Holding ApS", share: "100 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Midt ApS" },
  // Katalog 20: eneste demovirksomhed med et CHR-nummer, så LassoLivestock har eksempeldata (LiveProvider har intet bekræftet CHR-endpoint).
  { cvr: "99000013", name: "Eksempel Landbrug I/S", status: "Aktiv", form: "I/S", industryCode: "014700", industryText: "Avl af fjerkræ og svin", address: { street: "Gårdvej 3", zip: "7830", city: "Vinderup", municipality: "Holstebro", region: "Midtjylland" }, founded: "1985-01-01", employees: 5, base: 4_200_000, growth: 0.02,
    people: [P("William Prøve", "Direktør", "1985-01-01")], owners: [{ name: "William Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
];

/** Reelle ejere til demo: genbruger historien fra ownership (Eksempel Holding ApS -> Bo Eksempel). */
function beneficialOwnersFor(c: DemoCompany): BeneficialOwnershipVM {
  if (c.status === "Ophørt") {
    return { lassoId: c.lassoId, owners: [], gaps: [{ share: "50–66,66 %", reason: "CVR har ikke registreret en reel ejer for denne andel (eksempel)." }] };
  }
  const owners = c.owners.flatMap((o) => {
    if (o.kind === "company") {
      const holder = COMPANIES.find((x) => x.lassoId === o.lassoId);
      const person = holder?.owners.find((p) => p.kind === "person");
      if (!person) return [];
      return [{ name: person.name, lassoId: person.lassoId, chain: `via ${o.name}, ${o.share ?? "100 %"}`, share: o.share }];
    }
    return [{ name: o.name, lassoId: o.lassoId, share: o.share }];
  });
  return { lassoId: c.lassoId, owners };
}

function textSectionsFor(c: DemoCompany): TextSectionsVM {
  return {
    lassoId: c.lassoId,
    title: "Virksomhedsprofil",
    sections: [
      { heading: "Branche", body: c.industryText ?? "Ikke oplyst", note: c.industryCode ? `NACE ${c.industryCode}` : undefined },
      {
        heading: "Formål",
        body: `Selskabets formål er at drive virksomhed inden for ${(c.industryText ?? "sin branche").toLowerCase()} og hermed beslægtet virksomhed (eksempeltekst).`,
      },
      { heading: "Tegningsregler", body: "Selskabet tegnes af en direktør alene eller af den samlede bestyrelse (eksempeltekst)." },
    ],
  };
}

function timelineFor(c: DemoCompany): TimelineVM {
  const events: TimelineVM["events"] = [];
  if (c.founded) events.push({ date: c.founded, title: "Virksomheden stiftet", detail: c.name, category: "Stamdata" });
  for (const p of c.people) {
    if (p.from) events.push({ date: p.from, title: `${p.name} er indtrådt`, detail: p.role, category: "Ledelse" });
    if (p.to) events.push({ date: p.to, title: `${p.name} er fratrådt`, detail: p.role, category: "Ledelse" });
  }
  for (const y of financialsFor(c).years) {
    const bits = [y.grossProfit != null ? `Bruttofortjeneste ${formatAmount(y.grossProfit)}` : null, y.profit != null ? `resultat ${formatAmount(y.profit)}` : null].filter(
      (x): x is string => Boolean(x),
    );
    events.push({ date: `${y.year}-04-15`, title: `Årsrapport ${y.year} offentliggjort`, detail: bits.join(", ") || undefined, category: "Regnskab" });
  }
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { lassoId: c.lassoId, events };
}

function newsFor(c: DemoCompany, limit: number): NewsVM {
  const lastYear = YEARS.at(-1);
  const items: NewsVM["items"] = [
    { source: "Lasso News", time: `${lastYear}-04-15`, headline: `Ny årsrapport fra ${c.name} (eksempel)`, excerpt: `Skrevet ud fra regnskabet for ${lastYear}.` },
    {
      source: "Prøve Medier",
      time: `${lastYear}-02-02`,
      headline: `${c.name} i vækst (eksempel)`,
      excerpt: `Eksempelartikel om udviklingen i ${(c.industryText ?? "branchen").toLowerCase()}.`,
    },
    { source: "Eksempel Erhverv", time: "2024-11-10", headline: `${c.name} nævnt i oversigt (eksempel)`, excerpt: "Nævnt i en artikel om branchen, ikke hovedhistorie.", language: "engelsk" },
  ].slice(0, limit);
  return { lassoId: c.lassoId, items };
}

function statusKindOf(s: string | undefined): CompanyVM["statusKind"] {
  if (!s) return undefined;
  if (/konkurs|likvid/i.test(s)) return "warning";
  if (/ophørt/i.test(s)) return "inactive";
  return "active";
}

const COMPANIES: DemoCompany[] = RAW.map((c) => ({ ...c, lassoId: `CVR-1-${c.cvr}`, statusKind: statusKindOf(c.status) }));
const BY_ID = new Map(COMPANIES.map((c) => [c.lassoId, c]));
/** Katalog 16: personerne får Lasso-ID'er, så de kan åbnes fra lister og relationer. */
const PERSON_IDS = demoPersonIds(COMPANIES);

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

function financialsFor(c: DemoCompany): FinancialsVM {
  // Deterministisk "støj", så graferne ikke er helt glatte.
  const seed = Number(c.cvr!.slice(-2));
  return {
    lassoId: c.lassoId,
    currency: "DKK",
    years: YEARS.map((year, i) => {
      const wobble = 1 + (((seed * (i + 3)) % 7) - 3) / 100;
      const gross = Math.round(c.base * Math.pow(1 + c.growth, i) * wobble);
      const equity = Math.round(gross * (0.4 + i * 0.05));
      return {
        year,
        periodStart: `${year}-01-01`,
        periodEnd: `${year}-12-31`,
        published: `${year + 1}-04-${String(10 + (seed % 15)).padStart(2, "0")}`,
        revenue: Math.round(gross * 2.6),
        grossProfit: gross,
        profit: Math.round(gross * (0.08 + (seed % 5) / 100) * (c.growth < 0 ? -0.5 : 1)),
        equity,
        employees: Math.max(0, Math.round((c.employees ?? 0) * (1 - (YEARS.length - 1 - i) * c.growth * 0.5))),
        // Opdigtet gæld: plausibel i forhold til egenkapitalen, deterministisk "støj" som resten.
        liabilities: Math.round(equity * (0.8 + ((seed * (i + 5)) % 9) / 20)),
      };
    }).map((y) => {
      // Afledte nøgletal, beregnet som i adaptFinancials (samme formler som live).
      const assetsTotal = (y.equity ?? 0) + (y.liabilities ?? 0);
      const pct = (a: number | null | undefined, b: number | null | undefined) => (typeof a === "number" && typeof b === "number" && b !== 0 ? Math.round((a / b) * 1000) / 10 : null);
      return {
        ...y,
        assetsTotal,
        ebitda: Math.round((y.grossProfit ?? 0) * (1 - 0.62 - 0.045)),
        soliditetsgrad: pct(y.equity, assetsTotal),
        // Overskudsgrad = EBIT / omsætning; EBIT her = EBITDA minus opdigtede afskrivninger (3 % af bruttofortjenesten).
        overskudsgrad: pct(Math.round((y.grossProfit ?? 0) * (1 - 0.62 - 0.045 - 0.03)), y.revenue),
        likviditetsgrad: null,
      };
    }),
  };
}

/**
 * Katalog 19, "Regnskabsdetaljer": fuldt eksempelregnskab afledt af `financialsFor`, så
 * hovedtallene (bruttofortjeneste, resultat, egenkapital, balancesum) er identiske med dem,
 * andre komponenter (LassoKeyFigureCards, LassoMultiYearTable) allerede viser for samme
 * virksomhed. Underposterne er opdigtede, men deterministiske og indbyrdes konsistente
 * (bruttofortjeneste - personale - andre drift = EBITDA osv.), som i den rigtige tabel.
 * Én demovirksomhed (Eksempel Café I/S) har bevidst ingen pengestrømsopgørelse, så
 * LassoCashFlows tomme tilstand ("ikke indberettet") kan ses.
 */
function financialStatementsFor(c: DemoCompany): FinancialStatementsVM {
  const f = financialsFor(c);
  const seed = Number(c.cvr!.slice(-2));
  const hasCashFlow = c.cvr !== "99000009";
  const incomeStatement: FinancialStatementsVM["incomeStatement"] = [];
  const balanceSheet: FinancialStatementsVM["balanceSheet"] = [];
  const cashFlow: FinancialStatementsVM["cashFlow"] = [];
  let cashCursor = Math.round((f.years[0]?.liabilities ?? 2_000_000) * 0.18);
  f.years.forEach((y) => {
    const gp = y.grossProfit ?? 0;
    const staffCosts = -Math.round(gp * 0.62);
    const otherOperatingCosts = -Math.round(gp * 0.045);
    const ebitda = gp + staffCosts + otherOperatingCosts;
    const depreciation = -Math.round(Math.abs(ebitda) * 0.3 + 150 + (seed % 7) * 20);
    const profit = y.profit ?? 0;
    const tax = profit >= 0 ? -Math.round(profit * 0.22) : Math.round(-profit * 0.29);
    const profitBeforeTax = profit - tax;
    const financialItemsNet = profitBeforeTax - (ebitda + depreciation);
    incomeStatement.push({
      year: y.year,
      periodStart: y.periodStart,
      periodEnd: y.periodEnd,
      revenue: y.revenue,
      grossProfit: gp,
      staffCosts,
      otherOperatingCosts,
      ebitda,
      depreciation,
      financialItemsNet,
      profitBeforeTax,
      tax,
      profit,
    });

    const equityTotal = y.equity ?? 0;
    const liabilitiesTotal = y.liabilities ?? 0;
    const assetsTotal = equityTotal + liabilitiesTotal;
    const longTermLiabilities = Math.round(liabilitiesTotal * 0.45);
    const shortTermLiabilities = liabilitiesTotal - longTermLiabilities;
    const fixedAssetsTotal = Math.round(assetsTotal * 0.36);
    const intangibleAssets = Math.round(fixedAssetsTotal * 0.65);
    const tangibleAssets = fixedAssetsTotal - intangibleAssets;
    const currentAssetsTotal = assetsTotal - fixedAssetsTotal;
    const shareCapital = Math.min(equityTotal, Math.round(assetsTotal * 0.06) || 1000);
    const retainedEarnings = equityTotal - shareCapital;

    let cash: number;
    if (hasCashFlow) {
      const workingCapitalChange = -Math.round(Math.abs(otherOperatingCosts) * 0.5 + (seed % 5) * 40);
      const operatingCashFlow = profit + Math.abs(depreciation) + workingCapitalChange;
      const intangibleInvestments = -Math.round(intangibleAssets * 0.2 + 100);
      const investingCashFlow = intangibleInvestments;
      const capitalIncrease = y.year === f.years.at(-1)!.year ? Math.round(shareCapital * 0.02) : 0;
      const loanChange = Math.round(longTermLiabilities * 0.05);
      const financingCashFlow = capitalIncrease + loanChange;
      const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
      const cashBeginning = cashCursor;
      const cashEnding = cashBeginning + netCashFlow;
      cashCursor = cashEnding;
      cash = cashEnding;
      cashFlow.push({
        year: y.year,
        periodEnd: y.periodEnd,
        profit,
        depreciation: Math.abs(depreciation),
        workingCapitalChange,
        operatingCashFlow,
        intangibleInvestments,
        investingCashFlow,
        capitalIncrease,
        loanChange,
        financingCashFlow,
        netCashFlow,
        cashBeginning,
        cashEnding,
      });
    } else {
      cash = Math.round(currentAssetsTotal * 0.28);
    }
    const tradeReceivables = Math.max(0, Math.round((currentAssetsTotal - cash) * 0.6));
    const otherReceivables = Math.max(0, currentAssetsTotal - cash - tradeReceivables);

    balanceSheet.push({
      year: y.year,
      periodEnd: y.periodEnd,
      intangibleAssets,
      tangibleAssets,
      fixedAssetsTotal,
      tradeReceivables,
      otherReceivables,
      cash,
      currentAssetsTotal,
      assetsTotal,
      shareCapital,
      retainedEarnings,
      equityTotal,
      longTermLiabilities,
      shortTermLiabilities,
      liabilitiesTotal,
      liabilitiesAndEquityTotal: assetsTotal,
    });
  });
  return { lassoId: c.lassoId, currency: "DKK", incomeStatement, balanceSheet, cashFlow };
}

function toRow(c: DemoCompany): CompanyRowVM {
  const f = financialsFor(c);
  const last = f.years.at(-1)!;
  return {
    lassoId: c.lassoId,
    cvr: c.cvr,
    name: c.name,
    city: c.address?.city,
    region: c.address?.region,
    industryText: c.industryText,
    status: c.status,
    statusKind: c.statusKind,
    employees: c.employees ?? null,
    revenue: last.revenue,
    grossProfit: last.grossProfit,
    profit: last.profit,
    trend: f.years.slice(-5).map((y) => y.grossProfit ?? 0),
  };
}

function strip(c: DemoCompany): CompanyVM {
  const { base: _b, growth: _g, people: _p, owners: _o, auditor: _a, ...vm } = c;
  return vm;
}

/** Eksempeldata til risikoobservationer (katalog 17). Afledt af de øvrige demofelter, så det følger med, hvis de ændres. */
function observationsFor(c: DemoCompany, f: FinancialsVM): ObservationsVM {
  // Én virksomhed viser bevidst den tomme, positive tilstand ("intet fundet").
  if (c.cvr === "99000012") {
    return { lassoId: c.lassoId, observations: [], checkedAt: "2026-09-25", sources: ["CVR", "regnskab", "ledelse"] };
  }
  const rows: ObservationRowVM[] = [];
  const last = f.years.at(-1);
  const prev = f.years.at(-2);
  if (/konkurs/i.test(c.status ?? "")) {
    rows.push({ id: "konkurs", severity: 100, title: "Virksomheden er under konkurs", detail: "Selskabet er registreret under konkursbehandling i CVR.", source: "CVR", date: last?.periodEnd });
  } else if (typeof last?.profit === "number" && typeof prev?.profit === "number" && last.profit < 0 && prev.profit < 0) {
    rows.push({
      id: "underskud",
      severity: 100,
      title: "Underskud to regnskabsår i træk",
      detail: `Årets resultat var ${formatAmount(prev.profit)} i ${prev.year} og ${formatAmount(last.profit)} i ${last.year}.`,
      source: "Regnskab",
      date: last.periodEnd,
    });
  } else if (c.growth < 0) {
    rows.push({ id: "fald", severity: 50, title: "Faldende bruttofortjeneste flere år i træk", detail: "Bruttofortjenesten er faldet i de seneste regnskabsår.", source: "Regnskab", date: last?.periodEnd });
  }
  if (c.auditor === "Ingen") {
    rows.push({ id: "revisor-fravalgt", severity: 50, title: "Revisor fravalgt", detail: "Selskabet har ikke registreret en revisor.", source: "CVR" });
  }
  const ended = c.people.find((p) => p.to);
  if (ended) rows.push({ id: "afgang", severity: 25, title: `${ended.name} er fratrådt som ${ended.role.toLowerCase()}`, source: "Ledelse", date: ended.to });
  const newest = [...c.people].filter((p) => !p.to).sort((a, b) => (b.from ?? "").localeCompare(a.from ?? ""))[0];
  if (newest) rows.push({ id: "tiltraadt", severity: 0, title: `Nyt medlem i ledelsen: ${newest.name}`, source: "Ledelse", date: newest.from });
  return { lassoId: c.lassoId, observations: rows, checkedAt: "2026-09-25", sources: ["CVR", "regnskab", "ledelse"] };
}

/** Eksempeldata til revisoruafhængighed (katalog 22). Kun den første demovirksomhed har relationer, så begge tilstande ses. */
function auditorIndependenceFor(c: DemoCompany): AuditorIndependenceVM {
  if (c.auditor === "Ingen") {
    return { lassoId: c.lassoId, checkedAt: "2026-09-25", relations: [], unavailableReason: "Virksomheden har ingen registreret revisor i demodata." };
  }
  const relations: AuditorRelationVM[] =
    c.lassoId === "CVR-1-99000001"
      ? [
          {
            id: "r1",
            assessment: 50,
            name: "Peter Revisor Eksempel",
            role: "Partner, Eksempel Revision Midt ApS",
            relation: "Bestyrelsesmedlem i et selskab hvor kundens ejer også sidder",
            via: "Eksempel Invest ApS",
            from: "2022-01-01",
          },
          {
            id: "r2",
            assessment: 0,
            name: "Eksempel Revision Midt ApS",
            role: "Revisionshus",
            relation: "Revisor for kundens ejer Eksempel Holding ApS",
            via: "Samme revisionshus",
            from: "2019-01-01",
          },
          {
            id: "r3",
            assessment: 0,
            name: "Lene Kontrol Eksempel",
            role: "Tidl. ansat, Eksempel Revision Midt ApS",
            relation: "Tidligere direktør i kundens datterselskab, ophørt for flere år siden",
            via: "Eksempel Data ApS",
            from: "2015-01-01",
            to: "2020-01-01",
          },
        ]
      : [];
  return {
    lassoId: c.lassoId,
    auditorName: c.auditor,
    checkedAt: "2026-09-25",
    relations,
    unavailableReason: relations.length ? undefined : "Der er ikke fundet kendte relationer mellem revisor, kunden og personer i demodata.",
  };
}

function get(lassoId: string): DemoCompany {
  const c = BY_ID.get(lassoId);
  if (!c) throw new NotFoundError(`Virksomheden ${lassoId} (demodata har kun CVR 99000001-99000013)`);
  return c;
}

/** Katalog 20: Produktionsenheder ud over hovedenheden. Kun sat for virksomheder, hvor eksemplet skal vise flere P-numre. */
const PRODUCTION_UNITS: Record<string, ProductionUnitsVM["units"]> = {
  "CVR-1-99000001": [
    { pNumber: "1000000020", name: "Eksempel Byg A/S", address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, isMain: true, industryCode: "412000", industryText: "Opførelse af bygninger", employees: 64, status: "Aktiv", statusKind: "active", created: "1998-04-01" },
    { pNumber: "1000000021", name: "Eksempel Byg, Aarhus (eksempel)", address: { street: "Eksempelvej 12", zip: "8000", city: "Aarhus C", municipality: "Aarhus", region: "Midtjylland" }, industryCode: "412000", industryText: "Opførelse af bygninger", employees: 8, status: "Aktiv", statusKind: "active", created: "2015-03-01" },
    { pNumber: "1000000022", name: "Eksempel Byg, Lager (eksempel)", address: { street: "Eksempelvej 4", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, industryCode: "521000", industryText: "Oplagring", employees: null, status: "Ophørt", statusKind: "inactive", endedYear: 2023, created: "2010-01-01" },
  ],
};

/** Katalog 20: Ejendomme/BBR. Kun sat for ejendomsselskabet, så eksemplet har bygninger at vise. */
const PROPERTIES: Record<string, PropertiesVM["properties"]> = {
  "CVR-1-99000012": [
    {
      address: { street: "Murervej 5", zip: "8700", city: "Horsens", municipality: "Horsens", region: "Midtjylland" },
      matrikel: "Matr. 7b, Horsens Markjorder",
      bfeNumber: "100000123",
      propertyType: "Erhvervsejendom",
      ownership: "Ejer, tinglyst 2015",
      landAreaM2: 3200,
      builtAreaM2: 1450,
      publicValuation: { amount: 18_500_000, year: 2024 },
      encumbrances: 1,
      hasGeometry: false,
      buildings: [
        { number: 1, usage: "Kontor og administration", builtYear: 2001, floors: 2, areaM2: 900, units: 4 },
        { number: 2, usage: "Lager og produktion", builtYear: 2001, floors: 1, areaM2: 550, units: 1 },
      ],
    },
  ],
};

/** Katalog 20: CHR. Kun landbrugsvirksomheden har et CHR-nummer, som kataloget kræver for at vise blokken. */
const LIVESTOCK: Record<string, LivestockVM> = {
  "CVR-1-99000013": {
    lassoId: "CVR-1-99000013",
    chrNumber: "100001",
    ownerName: "Eksempel Landbrug I/S",
    updated: "2026-09-01",
    herds: [
      { species: "Svin", category: "slagtesvin", count: 4200, unit: "stipladser" },
      { species: "Svin", category: "søer", count: 380, unit: "dyr" },
      { species: "Kvæg", category: "malkekøer", count: 160, unit: "dyr" },
    ],
    healthStatus: "SPF",
    events: [
      { title: "Restriktion: flytteforbud ophævet", detail: "Svin", date: "2026-03-14", dateTo: "2026-04-02", severity: "active" },
      { title: "Velfærdskontrol: ingen anmærkninger", detail: "Kvæg", date: "2025-11-21", severity: "neutral" },
      { title: "Ny besætning registreret", detail: "Svin, søer", date: "2025-06-05", severity: "neutral" },
    ],
  },
};

/** Katalog 08: kontaktpersoner. Kun sat for det første eksempel, med nok rækker til at vise "Se N flere". */
const CONTACT_PERSONS: Record<string, ContactPersonVM[]> = {
  "CVR-1-99000001": [
    { name: "Anne Eksempel", role: "Direktør", phone: "86123456", email: "anne@eksempelbyg.dk" },
    { name: "Bo Eksempel", role: "Bestyrelsesformand", phone: "86123457" },
    { name: "Carla Prøve", role: "Bestyrelsesmedlem", email: "carla@eksempelbyg.dk" },
    { name: "Dan Prøve", role: "Salgschef" },
    { name: "Eva Prøve", role: "Økonomichef", phone: "86123458", email: "eva@eksempelbyg.dk" },
    { name: "Frank Eksempel", role: "Projektleder", phone: "86123459", email: "frank@eksempelbyg.dk" },
  ],
};

function contactFor(c: DemoCompany): ContactVM {
  const hasAny = Boolean(c.phone || c.email || c.website);
  return { lassoId: c.lassoId, phone: c.phone, email: c.email, website: c.website, address: c.address, source: hasAny ? "CVR" : undefined, updated: hasAny ? "2026-09-20" : undefined };
}

function contactPersonsFor(c: DemoCompany): ContactPersonsVM {
  const people = CONTACT_PERSONS[c.lassoId] ?? [];
  return { lassoId: c.lassoId, people, source: people.length ? "Eksempeldata" : undefined, updated: people.length ? "2026-09-20" : undefined };
}

function defaultUnit(c: DemoCompany): ProductionUnitsVM["units"][number] {
  return {
    pNumber: `10${c.cvr}`,
    name: c.name,
    address: c.address,
    isMain: true,
    industryCode: c.industryCode,
    industryText: c.industryText,
    employees: c.employees ?? null,
    status: c.status,
    statusKind: c.statusKind,
    created: c.founded,
  };
}

export class DemoProvider implements DataProvider {
  readonly kind = "demo" as const;

  async search(q: SearchQuery): Promise<SearchResultVM> {
    const words = q.query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = COMPANIES.filter((c) => {
      if (words.length === 0) return true;
      const hay = [c.name, c.industryText, c.address?.city, c.address?.region, c.cvr].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const hasStatus = q.criteria.some((c) => c.field === "status");
    const rows = matches.map(toRow).filter((r) => hasStatus || r.statusKind !== "inactive");
    const filtered = applyCriteria(rows, q.criteria);
    const sorted = sortRows(filtered.rows, q.sort ?? { field: "bruttofortjeneste", direction: "desc" });
    return {
      key: searchKey(q),
      total: sorted.length,
      rows: sorted.slice(0, q.limit),
      unsupportedCriteria: filtered.unsupported.length ? filtered.unsupported : undefined,
    };
  }

  async findCompanies(name: string, limit: number) {
    const words = name.toLowerCase().split(/\s+/).filter(Boolean);
    return COMPANIES.filter((c) => words.every((w) => c.name.toLowerCase().includes(w))).map(toRow).slice(0, limit);
  }

  async company(lassoId: string) {
    return strip(get(lassoId));
  }

  async contact(lassoId: string): Promise<ContactVM> {
    return contactFor(get(lassoId));
  }

  async contactPersons(lassoId: string): Promise<ContactPersonsVM> {
    return contactPersonsFor(get(lassoId));
  }

  async financials(lassoId: string) {
    return financialsFor(get(lassoId));
  }

  async financialStatements(lassoId: string) {
    return financialStatementsFor(get(lassoId));
  }

  async people(lassoId: string) {
    return get(lassoId).people.map((p) => ({ ...p, lassoId: p.lassoId ?? PERSON_IDS.get(p.name) }));
  }

  async ownership(lassoId: string): Promise<OwnershipVM> {
    const c = get(lassoId);
    const auditor = COMPANIES.find((x) => x.name === c.auditor);
    return {
      lassoId,
      owners: c.owners.map((o) => (o.kind === "person" && !o.lassoId ? { ...o, lassoId: PERSON_IDS.get(o.name) } : o)),
      auditor: c.auditor === "Ingen" ? undefined : { name: c.auditor, lassoId: auditor?.lassoId, from: "2019-01-01" },
    };
  }

  /** Katalog 10: eksempelscore, da der endnu ikke findes en live datakilde. */
  async score(lassoId: string): Promise<ScoreVM> {
    const c = get(lassoId);
    const seed = Number(c.cvr!.slice(-2));
    if (c.status !== "Aktiv") return { lassoId, score: null };
    const score = Math.max(5, Math.min(95, 22 + ((seed * 13) % 70)));
    return { lassoId, score, source: "Eksempeldata", updated: "2026-09-12" };
  }

  async beneficialOwnership(lassoId: string) {
    return beneficialOwnersFor(get(lassoId));
  }

  async textSections(lassoId: string) {
    return textSectionsFor(get(lassoId));
  }

  async timeline(lassoId: string) {
    return timelineFor(get(lassoId));
  }

  async news(lassoId: string, limit: number) {
    return newsFor(get(lassoId), limit);
  }

  async observations(lassoId: string): Promise<ObservationsVM> {
    const c = get(lassoId);
    return observationsFor(c, financialsFor(c));
  }

  async auditorIndependence(lassoId: string): Promise<AuditorIndependenceVM> {
    return auditorIndependenceFor(get(lassoId));
  }

  async productionUnits(lassoId: string): Promise<ProductionUnitsVM> {
    const c = get(lassoId);
    return { lassoId, units: PRODUCTION_UNITS[lassoId] ?? [defaultUnit(c)] };
  }

  async properties(lassoId: string): Promise<PropertiesVM> {
    get(lassoId); // kaster NotFoundError for ukendte demo-CVR-numre
    return { lassoId, properties: PROPERTIES[lassoId] ?? [] };
  }

  async livestock(lassoId: string): Promise<LivestockVM> {
    get(lassoId);
    return LIVESTOCK[lassoId] ?? { lassoId, herds: [], events: [] };
  }

  async ownershipGraph(lassoId: string, opts: OwnershipGraphOptions) {
    get(lassoId);
    return demoOwnershipGraph(lassoId, opts, (id) => {
      const c = BY_ID.get(id);
      return c ? strip(c) : undefined;
    });
  }

  async person(lassoId: string) {
    return demoPerson(COMPANIES, lassoId);
  }

  async personNetwork(lassoId: string) {
    return demoPersonNetwork(COMPANIES, lassoId);
  }

  async findPersons(name: string, limit: number) {
    return demoFindPersons(COMPANIES, name, limit);
  }
}
