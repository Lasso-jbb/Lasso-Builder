import {
  CREDIT_LOCKED_REASON,
  CREDIT_SOURCE,
  formatAmount,
  searchKey,
  type BeneficialOwnershipVM,
  type ChangeEntryVM,
  type ChangeFeedVM,
  foldChangeEntries,
  type CompanyEventsVM,
  type CompanyRowVM,
  type CompanyVM,
  type ContactPersonVM,
  type ContactPersonsVM,
  type ContactVM,
  type CreditAssessment,
  type CreditRatingVM,
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
  type TextSegment,
  type TimelineVM,
  hasReportingDuty,
  isPersonId,
  statusKind,
} from "@lasso/spec";
import { publicationsFromYears } from "../lasso/eventAdapters.js";
import { CREDIT_NONE_REASON } from "../lasso/creditAdapters.js";
import { applyCriteria, sortRows } from "./criteria-eval.js";
import { demoOwnershipGraph, demoPersonOwnershipGraph } from "./demoGraph.js";
import { demoFindPersons, demoPerson, demoPersonIds, demoPersonNetwork, demoPersonNews } from "./demoPeople.js";
import { NotFoundError, searchPersonsTable, type ActivityHeatmapOptions, type ChangeFeedOptions, type DataProvider, type OwnershipGraphOptions } from "./provider.js";
import { demoHeatmap, demoIndustry, demoMap, demoScore, demoScoreHistory } from "./demoCharts.js";

/**
 * Opdigtede demodata, så UI og MCP-flow kan bygges og testes uden adgang til
 * Lassos API. Alle navne indeholder "Eksempel"/"Prøve", og CVR-numrene ligger
 * i et interval, der ikke findes i CVR. Bruges automatisk, når der ikke er
 * Lasso-credentials (LASSO_DATA_SOURCE=auto).
 */

interface DemoCompany extends CompanyVM {
  /** Bruttofortjeneste i første demoår; 0 = ingen regnskaber (personligt ejet virksomhed uden regnskabspligt). */
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
    owners: [{ name: "Eksempel Holding ApS", share: "66,67–89,99 %", kind: "company", lassoId: "CVR-1-99000010" }, { name: "Anne Eksempel", share: "10–14,99 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000002", name: "Eksempel Revision Midt ApS", status: "Aktiv", form: "ApS", industryCode: "692000", industryText: "Revision og bogføring", address: { street: "Tællegade 12", zip: "8000", city: "Aarhus C", municipality: "Aarhus", region: "Midtjylland" }, founded: "2006-09-01", employees: 22, base: 14_500_000, growth: 0.05,
    people: [P("Erik Prøve", "Direktør", "2006-09-01"), P("Fie Eksempel", "Bestyrelsesformand", "2019-01-01")],
    owners: [{ name: "Erik Prøve", share: "50–66,66 %", kind: "person" }, { name: "Fie Eksempel", share: "33,34–49,99 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000003", name: "Eksempel Revision Nord ApS", status: "Aktiv", form: "ApS", industryCode: "692000", industryText: "Revision og bogføring", address: { street: "Bilagsvej 4", zip: "9000", city: "Aalborg", municipality: "Aalborg", region: "Nordjylland" }, founded: "2011-02-01", employees: 17, base: 11_200_000, growth: 0.03,
    people: [P("Gitte Prøve", "Direktør", "2011-02-01")], owners: [{ name: "Gitte Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000004", name: "Eksempel Transport A/S", status: "Aktiv", form: "A/S", industryCode: "494100", industryText: "Vejgodstransport", address: { street: "Lastvej 20", zip: "7100", city: "Vejle", municipality: "Vejle", region: "Syddanmark" }, founded: "1987-11-01", employees: 118, base: 52_000_000, growth: -0.02,
    people: [P("Hans Eksempel", "Direktør", "2020-08-01"), P("Ida Prøve", "Direktør", "2009-01-01", "2020-08-01"), P("Jens Eksempel", "Bestyrelsesformand", "2018-04-01")],
    owners: [{ name: "Eksempel Holding ApS", share: "100 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000005", name: "Eksempel Software ApS", status: "Aktiv", form: "ApS", industryCode: "620100", industryText: "Computerprogrammering", address: { street: "Kodevej 3", zip: "8200", city: "Aarhus N", municipality: "Aarhus", region: "Midtjylland" }, founded: "2017-03-01", employees: 41, base: 21_000_000, growth: 0.22,
    people: [P("Kim Prøve", "Direktør", "2017-03-01"), P("Lene Eksempel", "Bestyrelsesmedlem", "2023-10-01")], owners: [{ name: "Kim Prøve", share: "50–66,66 %", kind: "person" }, { name: "Lene Eksempel", share: "20–24,99 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000006", name: "Eksempel Tømrer ApS", status: "Aktiv", form: "ApS", industryCode: "433200", industryText: "Tømrer- og bygningssnedkervirksomhed", address: { street: "Høvlvej 8", zip: "8800", city: "Viborg", municipality: "Viborg", region: "Midtjylland" }, founded: "2009-06-01", employees: 12, base: 6_800_000, growth: 0.04,
    people: [P("Mads Eksempel", "Direktør", "2009-06-01")], owners: [{ name: "Mads Eksempel", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000007", name: "Eksempel Rådgivning A/S", status: "Aktiv", form: "A/S", industryCode: "702200", industryText: "Virksomhedsrådgivning", address: { street: "Strategistræde 2", zip: "1150", city: "København K", municipality: "København", region: "Hovedstaden" }, founded: "2002-01-01", employees: 35, base: 29_000_000, growth: 0.09,
    people: [P("Nina Prøve", "Direktør", "2021-01-01"), P("Ole Eksempel", "Bestyrelsesformand", "2002-01-01")], owners: [{ name: "Ole Eksempel", share: "90–100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000008", name: "Eksempel Maskinfabrik A/S", status: "Aktiv", form: "A/S", industryCode: "282900", industryText: "Fremstilling af maskiner", address: { street: "Smedevej 15", zip: "7400", city: "Herning", municipality: "Herning", region: "Midtjylland" }, founded: "1974-05-01", employees: 210, base: 96_000_000, growth: 0.01,
    people: [P("Per Eksempel", "Direktør", "2016-01-01"), P("Rikke Prøve", "Bestyrelsesformand", "2024-06-01"), P("Søren Eksempel", "Bestyrelsesformand", "2010-01-01", "2024-06-01")], owners: [{ name: "Eksempel Holding ApS", share: "50–66,66 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000009", name: "Eksempel Café I/S", status: "Ophørt", statusDate: "2024-09-30", form: "I/S", industryCode: "563000", industryText: "Caféer og barer", address: { street: "Torvet 1", zip: "8660", city: "Skanderborg", municipality: "Skanderborg", region: "Midtjylland" }, founded: "2015-05-01", employees: 0, base: 1_200_000, growth: -0.3,
    people: [P("Tina Prøve", "Interessent", "2015-05-01", "2023-12-31")], owners: [{ name: "Tina Prøve", share: "50–66,66 %", kind: "person" }], auditor: "Ingen" },
  { cvr: "99000010", name: "Eksempel Holding ApS", status: "Aktiv", form: "ApS", industryCode: "642020", industryText: "Ikke-finansielle holdingselskaber", address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg", municipality: "Silkeborg", region: "Midtjylland" }, founded: "2005-01-01", employees: 1, base: 3_000_000, growth: 0.1,
    people: [P("Bo Eksempel", "Direktør", "2005-01-01")], owners: [{ name: "Bo Eksempel", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Midt ApS" },
  { cvr: "99000011", name: "Eksempel Energi A/S", status: "Under konkurs", statusDate: "2026-06-03", curator: "Advokat Eksempel & Co.", secondaryNames: ["Eksempel Vind"], form: "A/S", industryCode: "351100", industryText: "Produktion af elektricitet", address: { street: "Vindvej 9", zip: "6700", city: "Esbjerg", municipality: "Esbjerg", region: "Syddanmark" }, founded: "2012-08-01", employees: 8, base: 9_000_000, growth: -0.18,
    people: [P("Uffe Prøve", "Direktør", "2012-08-01"), P("Bo Eksempel", "Bestyrelsesmedlem", "2014-03-01", "2018-06-30")], owners: [{ name: "Uffe Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  { cvr: "99000012", name: "Eksempel Ejendomme ApS", status: "Aktiv", form: "ApS", industryCode: "682040", industryText: "Udlejning af erhvervsejendomme", address: { street: "Murervej 5", zip: "8700", city: "Horsens", municipality: "Horsens", region: "Midtjylland" }, founded: "2013-10-01", employees: 3, base: 7_500_000, growth: 0.06,
    people: [P("Vera Eksempel", "Direktør", "2013-10-01"), P("Bo Eksempel", "Bestyrelsesmedlem", "2013-10-01")], owners: [{ name: "Eksempel Holding ApS", share: "100 %", kind: "company", lassoId: "CVR-1-99000010" }], auditor: "Eksempel Revision Midt ApS" },
  // Katalog 20: eneste demovirksomhed med et CHR-nummer, så LassoLivestock har eksempeldata (LiveProvider har intet bekræftet CHR-endpoint).
  { cvr: "99000013", name: "Eksempel Landbrug I/S", status: "Aktiv", form: "I/S", industryCode: "014700", industryText: "Avl af fjerkræ og svin", address: { street: "Gårdvej 3", zip: "7830", city: "Vinderup", municipality: "Holstebro", region: "Midtjylland" }, founded: "1985-01-01", employees: 5, base: 4_200_000, growth: 0.02,
    people: [P("William Prøve", "Direktør", "1985-01-01")], owners: [{ name: "William Prøve", share: "100 %", kind: "person" }], auditor: "Eksempel Revision Nord ApS" },
  // Enkeltmandsvirksomhed uden regnskabspligt (som Lassos egen ENK): viser regnskabets tomme tilstand.
  { cvr: "99000014", name: "Eksempel Konsulent", status: "Aktiv", form: "ENK", industryCode: "622000", industryText: "Computerkonsulentbistand og forvaltning af computerfaciliteter", address: { street: "c/o Mia Eksempel, Prøveparken 16", zip: "9381", city: "Sulsted", municipality: "Aalborg", region: "Nordjylland" }, founded: "2023-01-30", base: 0, growth: 0,
    people: [P("Mia Eksempel", "Fuldt ansvarlig deltager", "2023-01-30")], owners: [], auditor: "Ingen" },
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
      // Katalog 11.4: kæden som "via …, andel → andel" (personens andel i holdingselskabet → holdingselskabets andel her).
      return [{ name: person.name, lassoId: person.lassoId, chain: `via ${o.name}, ${person.share ?? "100 %"} → ${o.share ?? "100 %"}`, share: o.share }];
    }
    return [{ name: o.name, lassoId: o.lassoId, share: o.share }];
  });
  return { lassoId: c.lassoId, owners };
}

/** Tekst med navne: strenge er almindelig tekst, [navn, Lasso-ID] et navn, der kan åbnes. */
function analysisSection(heading: string, ...parts: (string | [string, string | undefined])[]): TextSectionsVM["sections"][number] {
  const segments = parts.map((p) => (typeof p === "string" ? { text: p } : { text: p[0], lassoId: p[1] }));
  return { heading, body: segments.map((x) => x.text).join(""), segments, note: "Kilde: Lasso regnskabsanalyse" };
}

function analysisFor(c: DemoCompany): TextSectionsVM["sections"] {
  const auditor = COMPANIES.find((x) => x.name === c.auditor);
  const ceo = c.people.find((p) => /direktør/i.test(p.role) && !p.to);
  return [
    analysisSection(
      "Regnskabsanalyse: konklusion",
      `${c.name} har haft en støt stigende bruttofortjeneste de seneste fem år og et positivt resultat i alle år. Egenkapitalen er vokset hvert år, og soliditetsgraden ligger over branchens gennemsnit. Samlet set er der tale om en sund og stabil udvikling uden tegn på likviditetspres (eksempeltekst).`,
    ),
    analysisSection(
      "Resultat",
      "Årets resultat er steget med godt 8 % i forhold til sidste år, drevet af flere store projekter og en bedre udnyttelse af de faste omkostninger. Overskudsgraden er forbedret for tredje år i træk, mens personaleomkostningerne er steget mindre end bruttofortjenesten (eksempeltekst).",
    ),
    analysisSection(
      "Likviditet",
      "Likviditeten er tilfredsstillende. Pengestrømmen fra driften dækker årets investeringer, og de likvide beholdninger er øget. Den kortfristede gæld er dækket af omsætningsaktiverne med god margin (eksempeltekst).",
    ),
    analysisSection(
      "Balance og kapitalforhold",
      "Balancesummen er steget i takt med aktiviteten. Egenkapitalen udgør over halvdelen af balancen, og selskabet har ingen væsentlig langfristet gæld. Der er ikke udloddet udbytte i året, så overskuddet er lagt til egenkapitalen (eksempeltekst).",
    ),
    analysisSection(
      "Branchestatistik",
      "Sammenlignet med andre virksomheder i branchen har selskabet en højere soliditetsgrad og en overskudsgrad på niveau med de bedste 25 %. Væksten i bruttofortjeneste er over branchens median (eksempeltekst).",
    ),
    analysisSection(
      "Revisoroplysninger",
      "Årsrapporten er revideret af ",
      auditor ? [auditor.name, auditor.lassoId] : c.auditor,
      " uden forbehold eller supplerende oplysninger. Revisor har været den samme i de seneste regnskabsår (eksempeltekst).",
    ),
    analysisSection(
      "Spørgsmål til overvejelse",
      "• Hvor afhængig er virksomheden af de største kunder?\n• Hvordan påvirker renteniveauet efterspørgslen i de kommende år?\n• Hvem overtager efter ",
      ceo ? [ceo.name, PERSON_IDS.get(ceo.name)] : "den nuværende direktør",
      ", hvis direktøren fratræder? (eksempeltekst)",
    ),
  ];
}

function textSectionsFor(c: DemoCompany): TextSectionsVM {
  const sections: TextSectionsVM["sections"] = [
    { heading: "Branche", body: c.industryText ?? "Ikke oplyst", note: c.industryCode ? `NACE ${c.industryCode}` : undefined },
    {
      heading: "Formål",
      body: `Selskabets formål er at drive virksomhed inden for ${(c.industryText ?? "sin branche").toLowerCase()} og hermed beslægtet virksomhed (eksempeltekst).`,
    },
    { heading: "Tegningsregler", body: "Selskabet tegnes af en direktør alene eller af den samlede bestyrelse (eksempeltekst)." },
  ];
  // Katalog 12/19: eksempel på regnskabsanalysen (POST /modules/reportanalysis) i samme form som
  // live-svaret: ét afsnit pr. felt, med navne som segmenter med Lasso-ID. Kun for to eksempler.
  if (c.lassoId === "CVR-1-99000001" || c.lassoId === "CVR-1-99000010") {
    sections.push(...analysisFor(c));
    return {
      lassoId: c.lassoId,
      title: "Virksomhedsprofil",
      sections,
      analysisGenerated: "2026-09-12T08:00:00Z",
      analysisBasis: "2021–2025",
      analysisHeadline: "Vækst i toplinjen, men omkostningerne løber hurtigere (eksempeltekst)",
      analysisSources: ["Årsrapport 2025, Erhvervsstyrelsen", "Årsrapport 2024, Erhvervsstyrelsen", "Årsrapport 2023, Erhvervsstyrelsen", "CVR, ledelse og ejere"],
    };
  }
  return { lassoId: c.lassoId, title: "Virksomhedsprofil", sections };
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
  // Katalog 12.3: ændringer vises som "fra → til" (gammel adresse gennemstreget, kapital før og efter).
  const a = c.address;
  if (c.status === "Aktiv" && c.founded && c.founded < "2020-01-01" && a) {
    events.push({ date: "2024-06-01", title: "Kapitalforhøjelse (eksempel)", from: "1,0 mio. kr.", to: "1,2 mio. kr.", category: "Kapital" });
    events.push({ date: "2023-09-01", title: "Adresse ændret (eksempel)", from: `Gammelvej 2, ${a.zip} ${a.city}`, to: `${a.street}, ${a.zip} ${a.city}`, category: "Stamdata" });
  }
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { lassoId: c.lassoId, events };
}

function newsFor(c: DemoCompany, limit: number): NewsVM {
  const lastYear = YEARS.at(-1);
  // Som Lasso News: navne med Lasso-ID ("{Navn|LassoId}"-markup) som segmenter, så nyhedernes links
  // kan ses i demoen. Virksomheden selv, direktøren og revisoren.
  const director = c.people.find((p) => !p.to && /direkt/i.test(p.role));
  const directorId = director ? PERSON_IDS.get(director.name) : undefined;
  const auditor = COMPANIES.find((x) => x.name === c.auditor);
  const extract: TextSegment[] = [{ text: `Regnskabet for ${lastYear} er godkendt` }];
  if (director && directorId) extract.push({ text: " af direktør " }, { text: director.name, lassoId: directorId });
  if (auditor) extract.push({ text: " og revideret af " }, { text: auditor.name, lassoId: auditor.lassoId });
  extract.push({ text: " (eksempel)." });
  const items: NewsVM["items"] = [
    {
      source: "Lasso News",
      url: `https://example.com/nyheder/${c.cvr}-aarsrapport`,
      time: `${lastYear}-04-15`,
      typeLabel: "Nyt regnskab",
      headline: `Ny årsrapport fra ${c.name} (eksempel)`,
      headlineSegments: [{ text: "Ny årsrapport fra " }, { text: c.name, lassoId: c.lassoId }, { text: " (eksempel)" }],
      excerpt: extract.map((s) => s.text).join(""),
      extractSegments: extract.some((s) => s.lassoId) ? extract : undefined,
    },
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

/** Katalog 28.1: samme klassificering som live-data (fx "Tvangsopløst" og "Under rekonstruktion" er advarsler, aldrig aktive). */
const statusKindOf = statusKind;

const COMPANIES: DemoCompany[] = RAW.map((c) => ({ ...c, lassoId: `CVR-1-${c.cvr}`, statusKind: statusKindOf(c.status) }));
const BY_ID = new Map(COMPANIES.map((c) => [c.lassoId, c]));
/** Katalog 16: personerne får Lasso-ID'er, så de kan åbnes fra lister og relationer. */
const PERSON_IDS = demoPersonIds(COMPANIES);

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

/** Katalog 09.1: branchetal og kvalitetsflag til nøgletalskortene, kun for første demovirksomhed. */
const FINANCIAL_EXTRAS: Record<string, Pick<FinancialsVM, "benchmark" | "quality">> = {
  "CVR-1-99000001": {
    benchmark: { label: "branche", change: { bruttofortjeneste: 3.1, omsaetning: 2.4, resultat: -1.8, egenkapital: 4.2 } },
    quality: { ansatte: "Ansatte i regnskabet afviger fra CVR's tal. Regnskabet tæller koncernen (eksempel)." },
  },
};

function financialsFor(c: DemoCompany): FinancialsVM {
  // Ingen regnskaber: personligt ejede virksomheder (ENK, PMV) indsender ikke årsregnskab.
  if (c.base <= 0) return { lassoId: c.lassoId, currency: "DKK", years: [] };
  return { ...financialYearsFor(c), ...FINANCIAL_EXTRAS[c.lassoId] };
}

function financialYearsFor(c: DemoCompany): FinancialsVM {
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
        // 13.10: et eksempel-tal, så målerne også viser den røde tilstand (klart under branchen).
        likviditetsgrad: Math.round((48 + (seed % 5) * 16 + (y.year - YEARS[0]!) * 1.5) * 10) / 10,
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
  f.years.forEach((y, idx) => {
    const gp = y.grossProfit ?? 0;
    // Andelene svinger lidt fra år til år, så underposterne ikke har samme ændring som hovedtallet (19.2).
    const staffCosts = -Math.round(gp * (0.62 + (((idx + seed) % 3) - 1) * 0.012));
    // Katalog 19.2: kvalitetsflaget (> 10× fra året før) på "Andre driftsomkostninger" for Eksempel Byg A/S.
    const flagged = c.cvr === "99000001" && idx === f.years.length - 2;
    const otherOperatingCosts = -Math.round(gp * (flagged ? 0.003 : 0.045 + ((idx + seed) % 2) * 0.006));
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
  const opinion = c.auditor && c.auditor !== "Ingen" ? `Revideret af ${c.auditor}, udgivet 15.04.2026` : undefined;
  const note = "Underposter og tidligere år er eksempeldata.";
  const base: FinancialStatementsVM = { lassoId: c.lassoId, currency: "DKK", incomeStatement, balanceSheet, cashFlow, scope: "Selskab", periods: ["year"], note, pdfUrl: `https://regnskaber.virk.dk/eksempel/${c.cvr}.pdf`, ...(opinion ? { auditorOpinion: opinion } : {}) };
  // Katalog 19.1: eksempelvirksomheden aflægger også koncernregnskab (selskabets tal × 1,35, eksempeldata).
  if (c.cvr === "99000001") {
    const k = <T extends object>(rows: T[]): T[] => rows.map((r) => Object.fromEntries(Object.entries(r).map(([key, v]) => [key, typeof v === "number" && key !== "year" ? Math.round(v * 1.35) : v])) as T);
    base.alternate = { currency: "DKK", incomeStatement: k(incomeStatement), balanceSheet: k(balanceSheet), cashFlow: k(cashFlow), scope: "Koncern", periods: ["year"], ...(opinion ? { auditorOpinion: opinion } : {}) };
  }
  return base;
}

function toRow(c: DemoCompany): CompanyRowVM {
  const f = financialsFor(c);
  // Uden regnskaber (enkeltmandsvirksomhed) er tallene "ikke oplyst", ikke en fejl.
  const last = f.years.at(-1);
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
    revenue: last?.revenue ?? null,
    grossProfit: last?.grossProfit ?? null,
    profit: last?.profit ?? null,
    trend: f.years.slice(-5).map((y) => y.grossProfit ?? 0),
    score: demoRowScore(c),
  };
}

/** Eksempelscore 0–100 (samme tal som scoremåleren); ophørte og konkursramte har ingen. */
function demoRowScore(c: DemoCompany): number | null {
  if (c.status !== "Aktiv" || !c.cvr) return null;
  const seed = Number(c.cvr.slice(-2));
  return Math.max(5, Math.min(95, 22 + ((seed * 13) % 70)));
}

function strip(c: DemoCompany): CompanyVM {
  const { base: _b, growth: _g, people: _p, owners: _o, auditor: _a, ...vm } = c;
  // Katalog 28.7/26h.9: eksempelvirksomheden har bibrancher og registreret kapital (eksempeldata).
  if (c.cvr === "99000001") {
    return {
      ...vm,
      altIndustries: [{ code: "433200", text: "Tømrer- og bygningssnedkervirksomhed" }, { code: "711200", text: "Rådgivende ingeniørvirksomhed" }],
      registeredCapital: { amount: 2_000_000, currency: "DKK", classes: ["A-aktier 1.500.000 DKK, 10 stemmer pr. aktie", "B-aktier 500.000 DKK, 1 stemme pr. aktie"] },
      accountingClass: "B",
      firstPeriod: { start: "1998-04-01", end: "1999-12-31" },
      statutesChanged: "2024-03-12",
      advertisingProtected: false,
      listed: false,
    };
  }
  if (c.auditor === "Ingen" && c.form !== "Enkeltmandsvirksomhed" && c.form !== "I/S") return { ...vm, auditExempt: true, auditExemptSince: 2024 };
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
  // Personligt ejede virksomheder har hverken regnskabs- eller revisionspligt: ingen revisor er ikke et fund der.
  if (c.auditor === "Ingen" && hasReportingDuty(c.form)) {
    rows.push({ id: "revisor-fravalgt", severity: 50, title: "Revisor fravalgt", detail: "Selskabet har ikke registreret en revisor.", source: "CVR" });
  }
  // Katalog 26d.6: eksempelvirksomheden viser Paper-eksemplets tre alvorsgrader (høj, middel, info).
  if (c.cvr === "99000001") {
    rows.push(
      { id: "ejer-egenkapital", severity: 100, title: "Negativ egenkapital hos ejer", detail: "Eksempel Holding ApS har negativ egenkapital i seneste regnskab.", source: "Regnskab", date: "2026-06-02" },
      { id: "delt-adresse", severity: 50, title: "Adresse deles med 12 virksomheder", detail: "Eksempelvej 1 er registreret som hovedadresse for 12 aktive selskaber.", source: "CVR", date: "2026-02-14" },
    );
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
    basis: "Baseret på CVR-roller og ejerskab, 3 led",
    opinion: "Revisionspåtegning, uden forbehold (eksempeldata)",
    report: "Årsrapport 2025",
    checks: relations.length
      ? [
          { label: "Ingen fælles ledelse med revisor", ok: true },
          { label: "Ingen ejerrelation til revisor", ok: true },
          { label: "Samme revisor i 9 år", sub: "Rotation anbefales efter 7 år for PIE-selskaber", ok: false },
          { label: "Revisor har ikke revideret ejerselskaber", ok: true },
        ]
      : undefined,
    // Katalog 26e.8: revisorhistorik som proportional bjælke (eksempeldata).
    history: [
      { name: "Eksempel Revision", from: "2012-01-01", to: "2016-12-31" },
      { name: c.auditor ?? "Nuværende revisor", from: "2017-01-01" },
    ],
  };
}

/**
 * Eksempeldata til kreditvurderingen (katalog 17, Creditsafe A–E). Eksempel Byg: A med forrige B; Eksempel Transport:
 * D med forrige C; Eksempel Energi (under konkurs): E uden kreditmaksimum; Eksempel Software: låst (intet tilkøb);
 * Eksempel Café (ophørt): ikke beregnet. De øvrige afledes af væksten (B, C eller D, uændret fra forrige).
 */
function creditRatingFor(c: DemoCompany): CreditRatingVM {
  const base = { lassoId: c.lassoId, cvr: c.cvr, source: CREDIT_SOURCE, updated: "2026-09-25", cachedUntil: "2026-09-26T08:30:00Z" };
  const a = (letter: CreditAssessment["internationalScore"], creditMax: number | null, localScore: number | null, word?: string): CreditAssessment => ({
    creditMax,
    creditCurrency: "DKK",
    internationalScore: letter,
    ...(word ? { internationalDescription: word, localDescription: `${word} Risk` } : {}),
    localScore,
  });
  const pdf = (cvr: string | undefined) => `https://example.com/eksempel-kreditrapport-${cvr}.pdf`;
  switch (c.cvr) {
    case "99000005":
      return { lassoId: c.lassoId, cvr: c.cvr, source: CREDIT_SOURCE, state: "locked", reason: CREDIT_LOCKED_REASON };
    case "99000009":
      return { lassoId: c.lassoId, cvr: c.cvr, source: CREDIT_SOURCE, state: "unavailable", reason: CREDIT_NONE_REASON };
    case "99000001":
      return { ...base, state: "ok", current: a("A", 4_500_000, 91, "Very Low"), previous: a("B", 3_750_000, 68, "Low"), latestChange: "2026-04-15", pdfUrl: pdf(c.cvr), creditBalance: 12 };
    case "99000004":
      return { ...base, state: "ok", current: a("D", 150_000, 21, "High"), previous: a("C", 400_000, 38, "Moderate"), latestChange: "2026-08-02", pdfUrl: pdf(c.cvr) };
    case "99000011":
      return { ...base, state: "ok", current: a("E", null, null), previous: a("D", 50_000, 12, "High"), latestChange: "2026-06-30", pdfUrl: pdf(c.cvr) };
  }
  const seed = Number(c.cvr!.slice(-2));
  const [letter, word, low] = c.growth >= 0.05 ? (["B", "Low", 60] as const) : c.growth >= 0 ? (["C", "Moderate", 40] as const) : (["D", "High", 20] as const);
  const creditMax = Math.round((c.base * 0.04) / 10_000) * 10_000;
  const rating = a(letter, creditMax, low + (seed % 10), word);
  return { ...base, state: "ok", current: rating, previous: rating, latestChange: "2025-11-03" };
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
    // 13.12: to enheder mere i Aarhus, så kortet viser en koral klynge med antal.
    { pNumber: "1000000023", name: "Eksempel Byg, Aarhus Nord (eksempel)", address: { street: "Prøvegade 3", zip: "8000", city: "Aarhus C", municipality: "Aarhus", region: "Midtjylland" }, industryCode: "412000", industryText: "Opførelse af bygninger", employees: 5, status: "Aktiv", statusKind: "active", created: "2019-08-01" },
    { pNumber: "1000000024", name: "Eksempel Byg, Værksted Aarhus (eksempel)", address: { street: "Testvej 21", zip: "8000", city: "Aarhus C", municipality: "Aarhus", region: "Midtjylland" }, industryCode: "433200", industryText: "Tømrer- og bygningssnedkervirksomhed", employees: 3, status: "Aktiv", statusKind: "active", created: "2021-02-01" },
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
      hasGeometry: true,
      // Eksempelgeometri (meter, lokalt): skæv matrikel med to bygninger; bygning 1 er valgt.
      geometry: {
        parcel: [[0, 0], [78, 4], [74, 46], [4, 42]],
        buildings: [
          { number: 1, polygon: [[10, 10], [40, 12], [39, 30], [9, 28]] },
          { number: 2, polygon: [[48, 14], [68, 15], [67, 36], [47, 35]] },
        ],
        selected: 1,
      },
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
    // Katalog 08.6/08.7: grupper, noter, LinkedIn og kilder til "Se alle"-panelet (alle værdier er eksempler).
    {
      name: "Anne Eksempel",
      role: "Direktør",
      phone: "86123456",
      email: "anne@eksempelbyg.dk",
      phoneNote: "Direkte, eksempelnummer",
      emailNote: "Eksempeladresse",
      linkedin: "https://www.linkedin.com/in/eksempel",
      sources: [
        { label: "eksempelbyg.dk/om-os", url: "https://eksempelbyg.dk/om-os", text: "rolle og navn", date: "2026-09-20" },
        { label: "CVR", text: "registreret direktør", date: "2015-01-01" },
      ],
    },
    { name: "Bo Eksempel", role: "Bestyrelsesformand", phone: "86123457", sources: [{ label: "CVR", text: "registreret bestyrelsesformand", date: "2012-05-01" }] },
    { name: "Carla Prøve", role: "Bestyrelsesmedlem", email: "carla@eksempelbyg.dk" },
    { name: "Dan Prøve", role: "Salgschef" },
    { name: "Eva Prøve", role: "Økonomichef", phone: "86123458", email: "eva@eksempelbyg.dk" },
    { name: "Frank Eksempel", role: "Projektleder", phone: "86123459", email: "frank@eksempelbyg.dk" },
    { name: "Gustav Prøve", role: "Key Account Manager", phone: "86123460", email: "gustav@eksempelbyg.dk" },
    { name: "Hanne Eksempel", role: "CTO", group: "IT-udvikling", email: "hanne@eksempelbyg.dk" },
  ],
};

/**
 * Katalog 21: ændringsfeed for demolisten "Kunder". Tidspunkterne ligger relativt til i dag (0, 1 og 2 dage
 * tilbage), så feedet altid viser "I dag" og "I går". Fem stamdata-ændringer samme dag foldes til én række.
 */
const DEMO_LIST = "Kunder";
function changeFeedFor(opts: ChangeFeedOptions): ChangeFeedVM {
  const days = Math.max(1, Math.min(90, opts.days));
  if (opts.list && opts.list.trim().toLowerCase() !== DEMO_LIST.toLowerCase()) {
    return { listName: opts.list, days, entries: [], total: 0, emptyReason: `Der er ingen overvågningsliste med navnet "${opts.list}" i demodata (kun "${DEMO_LIST}").` };
  }
  const at = (daysAgo: number, hhmm: string) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const [h, m] = hhmm.split(":").map(Number);
    d.setHours(h!, m!, 0, 0);
    return d.toISOString();
  };
  const name = (cvr: string) => COMPANIES.find((c) => c.cvr === cvr)!;
  const E = (cvr: string, type: ChangeEntryVM["type"], text: string, daysAgo: number, hhmm: string, read: boolean, extra: Partial<ChangeEntryVM> = {}): ChangeEntryVM => {
    const c = name(cvr);
    return { lassoId: c.lassoId, companyName: c.name, type, text, at: at(daysAgo, hhmm), source: type === "kredit" ? "Kredit" : "CVR", read, ...extra };
  };
  const all: ChangeEntryVM[] = [
    E("99000011", "status", "Status ændret", 0, "09:14", false, { from: "Aktiv", to: "Under konkurs" }),
    E("99000008", "regnskab", "Årsrapport 2025 offentliggjort, bruttofortjeneste 96,4 mio. kr. (+12,1 %)", 0, "07:02", false),
    E("99000005", "kredit", "Kreditscore ændret fra 47 til 52 (+5)", 0, "06:30", false),
    E("99000001", "ledelse", "Nyt bestyrelsesmedlem: Carla Prøve indtrådt", 1, "14:40", true),
    E("99000004", "ejerskab", "Eksempel Holding ApS har øget sin ejerandel til 100 %", 1, "11:05", true),
    E("99000002", "regnskab", "Årsrapport 2025 offentliggjort, bruttofortjeneste 14,9 mio. kr. (+4,8 %)", 1, "08:15", true),
    ...["99000001", "99000004", "99000006", "99000007", "99000012"].map((cvr) => E(cvr, "stamdata", "Antal ansatte opdateret for 3. kvartal", 1, "06:00", true)),
    E("99000003", "ledelse", "Gitte Prøve er fratrådt som direktør", 2, "16:20", true),
    E("99000010", "stamdata", "Adresse ændret fra Prøvevej 1 til Prøvevej 3, 8600 Silkeborg", 2, "10:45", true),
  ];
  const cutoff = Date.now() - days * 86_400_000;
  const inPeriod = all.filter((e) => new Date(e.at).getTime() >= cutoff && (!opts.types || opts.types.includes(e.type)));
  return { listName: DEMO_LIST, days, entries: foldChangeEntries(inPeriod), total: inPeriod.length, source: "Eksempeldata", updated: new Date().toISOString().slice(0, 10) };
}

/** Katalog 08: eksempel på Lassos "live number" (kræver egen tilføjelse), kun for ét eksempel. */
const VERIFIED_NUMBERS: Record<string, { verifiedNumbers: NonNullable<ContactVM["verifiedNumbers"]>; isRobinson: boolean; verifiedAt: string }> = {
  "CVR-1-99000001": {
    verifiedNumbers: [
      { phoneNumber: "86123456", score: 91, explanation: "Bekræftet fra flere kilder (eksempel)", callable: true, sources: ["CVR", "Website"] },
      { phoneNumber: "20304050", score: 62, explanation: "Fundet på hjemmesiden (eksempel)", callable: true, sources: ["Website"] },
      // Katalog 08.5: et udgået eksempelnummer (gennemstreget, beholdes).
      { phoneNumber: "33123456", score: 20, explanation: "Nummeret er ikke længere i brug (eksempel)", callable: false, sources: ["Website"], expired: "2026-08-12" },
    ],
    isRobinson: true,
    verifiedAt: "2026-09-20",
  },
};

function contactFor(c: DemoCompany): ContactVM {
  const hasAny = Boolean(c.phone || c.email || c.website);
  const verified = VERIFIED_NUMBERS[c.lassoId];
  return {
    lassoId: c.lassoId,
    phone: c.phone,
    email: c.email,
    website: c.website,
    address: c.address,
    source: hasAny ? "CVR" : undefined,
    updated: hasAny ? "2026-09-20" : undefined,
    ...(verified ? { verifiedNumbers: verified.verifiedNumbers, isRobinson: verified.isRobinson, verifiedAt: verified.verifiedAt } : {}),
  };
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

  /** Katalog 10.1: eksempelscore og -hentetilstande, da der endnu ikke findes en live datakilde (se demoScore). */
  async score(lassoId: string): Promise<ScoreVM> {
    const c = get(lassoId);
    const base = demoScore(c, creditRatingFor(c));
    if (typeof base.score !== "number") return base;
    const score = base.score;
    // Katalog 26d.7: seks målinger over 24 måneder og tre ændringer med årsag (eksempeldata).
    const steps = [-3, -1, -4, -1, -3, 0].map((d, i) => Math.max(1, Math.min(99, score + d - (i === 4 ? 2 : 0))));
    const dates = ["2024-09-01", "2025-01-01", "2025-05-01", "2025-09-01", "2026-01-01", "2026-09-01"];
    const history = dates.map((date, i) => ({ date, score: i === dates.length - 1 ? score : steps[i]! }));
    const changes = [
      { date: "2026-06-06", label: "Regnskab 2025 indlæst", delta: 5 },
      { date: "2026-01-01", label: "Alder på selskab, eksempeldata", delta: 2 },
      { date: "2025-05-20", label: "Betalingsanmærkning, eksempeldata", delta: -4 },
    ];
    return { ...base, history, changes, historyNote: "eksempeldata før 09.2026" };
  }

  /** Katalog 18.2: eksempelhistorik, der ender i den aktuelle demoscore. */
  async scoreHistory(lassoId: string) {
    const c = get(lassoId);
    return demoScoreHistory(c, demoScore(c, creditRatingFor(c)));
  }

  /** Katalog 13.6/13.10: eksempel-branchetal afledt af virksomhedens egne nøgletal. */
  async industryBenchmark(lassoId: string) {
    const c = get(lassoId);
    return demoIndustry(c, financialsFor(c));
  }

  /** Katalog 13.11: heatmap for demolisten "Kunder". */
  async activityHeatmap(opts: ActivityHeatmapOptions) {
    return demoHeatmap(opts, DEMO_LIST);
  }

  /** Katalog 13.12: hovedadresse, P-enheder og koncernens øvrige selskaber (samme ejer) på kort. */
  async mapPoints(lassoId: string) {
    const c = get(lassoId);
    const ownerIds = new Set(c.owners.flatMap((o) => (o.lassoId ? [o.lassoId] : [])));
    const group = COMPANIES.filter((x) => x.lassoId !== c.lassoId && x.status === "Aktiv" && (ownerIds.has(x.lassoId) || x.owners.some((o) => o.lassoId && (ownerIds.has(o.lassoId) || o.lassoId === c.lassoId))));
    return demoMap(c, PRODUCTION_UNITS[lassoId] ?? [defaultUnit(c)], group);
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
    // Katalog 16: nyheder om en person (Lasso News tager både virksomheds- og person-ID'er).
    if (isPersonId(lassoId)) return demoPersonNews(COMPANIES, lassoId, limit);
    return newsFor(get(lassoId), limit);
  }

  async observations(lassoId: string): Promise<ObservationsVM> {
    const c = get(lassoId);
    return observationsFor(c, financialsFor(c));
  }

  /** Katalog 17: eksempler på alle tilstande (fuld, låst, ikke beregnet); se creditRatingFor. */
  async creditRating(lassoId: string): Promise<CreditRatingVM> {
    return creditRatingFor(get(lassoId));
  }

  /** Katalog 28.2/28.6/28.8 (eksempeldata): én fusion hos eksempelvirksomheden, konkursdekret hos konkursboet, publicering fra regnskabsårene. */
  async companyEvents(lassoId: string): Promise<CompanyEventsVM> {
    const c = get(lassoId);
    const years = financialsFor(c).years;
    const publications = publicationsFromYears(years.map((y) => ({ ...y, published: y.published ?? (y.periodEnd ? `${Number(y.periodEnd.slice(0, 4)) + 1}-05-28` : undefined) })));
    if (c.cvr === "99000001" && publications[1]?.figure) {
      // Eksempel på et korrigeret regnskab: den tidligere værdi står som "før …".
      publications[1] = { ...publications[1], corrected: true, published: publications[1].published?.replace(/-05-28$/, "-08-14"), figure: { ...publications[1].figure, previous: Math.round((publications[1].figure.value ?? 0) * 1.08) }, profit: publications[1].profit ? { ...publications[1].profit, previous: Math.round((publications[1].profit.value ?? 0) * 1.12) } : undefined };
    }
    const mergers: CompanyEventsVM["mergers"] =
      c.cvr === "99000001"
        ? [
            {
              date: "2022-07-01",
              type: "Fusion",
              from: [
                { name: "Cloud Eksempel A/S", cvr: "10000001", ceased: true },
                { name: "Data Eksempel A/S", cvr: "10000002", ceased: true },
              ],
              to: [{ name: c.name, lassoId: c.lassoId, cvr: c.cvr, role: "fortsættende selskab" }],
            },
            {
              date: "2019-03-15",
              type: "Spaltning",
              from: [{ name: c.name, lassoId: c.lassoId, cvr: c.cvr, role: "afgivende selskab" }],
              to: [{ name: "Eksempel Ejendomme ApS", lassoId: "CVR-1-99000012", role: "modtagende, nystiftet" }],
            },
          ]
        : [];
    const src = "Statstidende, sagsnr. eksempel, kreditorinformation vedlagt";
    const announcements: CompanyEventsVM["announcements"] = /konkurs/i.test(c.status ?? "")
      ? ([
          { date: "2026-08-18", type: "Konkursdekret", severity: "bankrupt", url: "https://www.statstidende.dk/", source: src, text: `Skifteretten i København har afsagt konkursdekret over ${c.name} (eksempeldata). Kurator: advokat Eksempel Prøvesen. Anmeldelse af krav senest fire uger efter bekendtgørelsen.` },
          { date: "2026-06-02", type: "Rekonstruktion indledt", severity: "warning", url: "https://www.statstidende.dk/", source: src, text: "Rekonstruktionsbehandling indledt med rekonstruktør og regnskabskyndig tillidsmand (eksempeldata)." },
          { date: "2026-01-11", type: "Kapitalnedsættelse", severity: "neutral", url: "https://www.statstidende.dk/", source: src, text: "Beslutning om nedsættelse af selskabskapitalen, opfordring til kreditorer om at anmelde krav (eksempeldata)." },
        ] as CompanyEventsVM["announcements"]).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      : [];
    return { lassoId, mergers, announcements, publications, updated: "2026-09-25" };
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
    const lookup = (id: string) => {
      const c = BY_ID.get(id);
      return c ? strip(c) : undefined;
    };
    // Katalog 16: personsidens ejerskaber med personen som rod.
    if (isPersonId(lassoId)) return demoPersonOwnershipGraph(demoPerson(COMPANIES, lassoId), opts, lookup);
    get(lassoId);
    return demoOwnershipGraph(lassoId, opts, lookup);
  }

  async person(lassoId: string) {
    return demoPerson(COMPANIES, lassoId);
  }

  async personNetwork(lassoId: string) {
    return demoPersonNetwork(COMPANIES, lassoId);
  }

  async personSearch(query: string, limit: number) {
    return searchPersonsTable(this, query, limit);
  }

  async findPersons(name: string, limit: number) {
    return demoFindPersons(COMPANIES, name, limit);
  }

  /** Katalog 21: eksempelfeed for listen "Kunder". */
  async changeFeed(opts: ChangeFeedOptions): Promise<ChangeFeedVM> {
    return changeFeedFor(opts);
  }
}
