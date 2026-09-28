import { z } from "zod";
import { criterionSchema } from "./criteria.js";
import { currencyUnit, formatAmount, formatNumber, formatPercent } from "./format.js";
import { CHANGE_TYPES, type FinancialYear } from "./models.js";
import { TEXT_SECTIONS_VARIANTS } from "./textSections.js";

/**
 * Den deklarative visnings-spec. Modellen skriver aldrig HTML/CSS; den sender
 * denne JSON, og Lassos kode henter data og tegner den. Specen gemmes (ikke
 * data), så et delt link altid viser friske tal.
 */

export const METRICS = [
  "omsaetning",
  "bruttofortjeneste",
  "resultat",
  "egenkapital",
  "ansatte",
  "ebitda",
  "balancesum",
  "gaeld",
  "soliditetsgrad",
  "overskudsgrad",
  "likviditetsgrad",
] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_LABELS: Record<Metric, string> = {
  omsaetning: "Omsætning",
  bruttofortjeneste: "Bruttofortjeneste",
  resultat: "Årets resultat",
  egenkapital: "Egenkapital",
  ansatte: "Ansatte",
  ebitda: "EBITDA",
  balancesum: "Balancesum",
  gaeld: "Gæld i alt",
  soliditetsgrad: "Soliditetsgrad",
  overskudsgrad: "Overskudsgrad",
  likviditetsgrad: "Likviditetsgrad",
};

/** Hvilket felt i et regnskabsår et nøgletal læses fra. */
export const METRIC_FIELD: Record<Metric, keyof FinancialYear> = {
  omsaetning: "revenue",
  bruttofortjeneste: "grossProfit",
  resultat: "profit",
  egenkapital: "equity",
  ansatte: "employees",
  ebitda: "ebitda",
  balancesum: "assetsTotal",
  gaeld: "liabilities",
  soliditetsgrad: "soliditetsgrad",
  overskudsgrad: "overskudsgrad",
  likviditetsgrad: "likviditetsgrad",
};

/** Hvordan et nøgletal formateres og skaleres: beløb (kr., fælles skala), antal (rent tal) eller procent/ratio. */
export type MetricKind = "amount" | "count" | "percent";
export const METRIC_KIND: Record<Metric, MetricKind> = {
  omsaetning: "amount",
  bruttofortjeneste: "amount",
  resultat: "amount",
  egenkapital: "amount",
  ansatte: "count",
  ebitda: "amount",
  balancesum: "amount",
  gaeld: "amount",
  soliditetsgrad: "percent",
  overskudsgrad: "percent",
  likviditetsgrad: "percent",
};

/** Nøgletallets værdi som tekst, uden fælles skala (til enkeltværdier; en serie bruger amountScale/formatScaled i stedet). */
export function formatMetricValue(m: Metric, v: number | null | undefined, currency?: string): string {
  const kind = METRIC_KIND[m];
  if (kind === "count") return formatNumber(v);
  if (kind === "percent") return formatPercent(v, false);
  return formatAmount(v, currencyUnit(currency));
}

export const TABLE_COLUMNS = [
  "navn",
  "cvr",
  "by",
  "region",
  "branche",
  "status",
  "ansatte",
  "omsaetning",
  "bruttofortjeneste",
  "resultat",
  "udvikling",
] as const;
export type TableColumn = (typeof TABLE_COLUMNS)[number];

export const TABLE_COLUMN_LABELS: Record<TableColumn, string> = {
  navn: "Navn",
  cvr: "CVR",
  by: "By",
  region: "Region",
  branche: "Branche",
  status: "Status",
  ansatte: "Ansatte",
  omsaetning: "Omsætning",
  bruttofortjeneste: "Bruttofortjeneste",
  resultat: "Resultat",
  udvikling: "Udvikling",
};

export const DEFAULT_TABLE_COLUMNS: readonly TableColumn[] = ["navn", "by", "branche", "ansatte", "bruttofortjeneste", "udvikling"];

export const SORT_FIELDS = ["relevans", "navn", "ansatte", "omsaetning", "bruttofortjeneste", "resultat"] as const;

const companyRef = z
  .string()
  .min(1)
  .describe("Lasso-ID (fx 'CVR-1-12345678') eller et 8-cifret CVR-nummer.");

/* Personsiden (katalog 16). */
/** LassoPersonRoles: tidsbånd (all) eller en kort liste med de aktive, ophørte eller ejede selskaber. */
export const PERSON_ROLES_SHOW = ["all", "current", "ended", "owner"] as const;
export type PersonRolesShow = (typeof PERSON_ROLES_SHOW)[number];
/** Personens tidslinje afgrænset til selskaberne med konkurs eller tvangsopløsning (fokus risiko). */
export const TIMELINE_FILTERS = ["risiko"] as const;

const personRef = z
  .string()
  .min(1)
  .describe("Lasso-ID for en person, fx 'CVR-3-4000000001' (personer har ikke CVR-nummer).");

/**
 * Tidslinje, nyheder og ejerdiagram findes både for en virksomhed og en person: præcis én af
 * `company` og `person` skal være sat. Refinementet følger med gennem `.extend()` (zod 4).
 */
const companyOrPerson = {
  company: companyRef.optional().describe("Virksomheden: Lasso-ID (fx 'CVR-1-12345678') eller et 8-cifret CVR-nummer. Udelades, når komponenten gælder en person."),
  person: personRef.optional().describe("Personen: Lasso-ID 'CVR-3-…'. Udelades, når komponenten gælder en virksomhed."),
};
const exactlyOneEntity = (c: { company?: string; person?: string }) => Boolean(c.company) !== Boolean(c.person);
const EXACTLY_ONE_ENTITY = { message: "Angiv præcis én af 'company' (virksomhed) og 'person' (Lasso-ID 'CVR-3-…').", path: ["company"] };

const metric = z.enum(METRICS);

export const searchQuerySchema = z
  .object({
    query: z.string().max(200).default("").describe("Fritekst: navn, branche, by eller søgeord. Må være tom, hvis kriterierne er nok."),
    criteria: z.array(criterionSchema).max(20).default([]).describe("Strukturerede kriterier. Vises som et udfyldt filterpanel over resultatet."),
    sort: z
      .object({
        field: z.enum(SORT_FIELDS),
        direction: z.enum(["asc", "desc"]).default("desc"),
      })
      .optional()
      .describe("Sortering, fx { field: 'omsaetning', direction: 'desc' } for 'top 20 efter omsætning'."),
    limit: z.number().int().min(1).max(100).default(20).describe("Antal rækker. Standard 20."),
  })
  .describe("En virksomhedssøgning.");
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const companyHeaderSchema = z.object({
  type: z.literal("LassoCompanyHead"),
  company: companyRef,
});

export const keyFiguresSchema = z.object({
  type: z.literal("LassoKeyFigureCards"),
  company: companyRef,
  metrics: z.array(metric).min(1).max(6).optional().describe("Standard: omsætning/bruttofortjeneste, resultat, egenkapital, ansatte."),
});

export const financialChartSchema = z.object({
  type: z.literal("LassoBarChart"),
  company: companyRef,
  metric: metric.default("bruttofortjeneste"),
  years: z.number().int().min(2).max(10).default(5),
});

export const groupedBarChartSchema = z.object({
  type: z.literal("LassoGroupedBarChart"),
  company: companyRef,
  metrics: z.array(metric).min(2).max(3).default(["omsaetning", "resultat"]).describe("2–3 nøgletal side om side pr. år."),
  years: z.number().int().min(2).max(10).default(5),
});

export const stackedBarChartSchema = z.object({
  type: z.literal("LassoStackedBarChart"),
  company: companyRef,
  years: z.number().int().min(2).max(10).default(5),
}).describe("Egenkapital og gæld som dele af balancen, pr. år.");

export const lineChartSchema = z.object({
  type: z.literal("LassoLineChart"),
  company: companyRef,
  metric: metric.default("bruttofortjeneste"),
  years: z.number().int().min(2).max(10).default(5),
  benchmark: companyRef.optional().describe("Valgfri sammenligningsvirksomhed, vist som stiplet benchmark-linje (chart-5)."),
});

export const waterfallChartSchema = z.object({
  type: z.literal("LassoWaterfallChart"),
  company: companyRef,
}).describe("Fra omsætning/bruttofortjeneste til årets resultat for seneste regnskabsår.");

export const shareBarsSchema = z.object({
  type: z.literal("LassoShareBars"),
  company: companyRef,
}).describe("Egenkapital og gæld som andele af balancen for seneste regnskabsår.");

export const rankingSchema = z.object({
  type: z.literal("LassoRanking"),
  companies: z.array(companyRef).min(2).max(10).describe("Første virksomhed er den, der fremhæves i koral."),
  metric: metric.default("bruttofortjeneste"),
  title: z.string().max(80).optional(),
});

export const peopleListSchema = z.object({
  type: z.literal("LassoPersonList"),
  company: companyRef,
  show: z.enum(["current", "all"]).default("current").describe("'all' tager fratrådte med, så man kan se udskiftning."),
  title: z.string().max(80).optional(),
});

export const ownershipSchema = z.object({
  type: z.literal("LassoOwnerList"),
  company: companyRef,
});

export const relationsSchema = z.object({
  type: z.literal("LassoRelations"),
  company: companyRef,
  title: z.string().max(80).optional(),
});

export const beneficialOwnersSchema = z.object({
  type: z.literal("LassoBeneficialOwners"),
  company: companyRef,
});

export const textSectionsSchema = z.object({
  type: z.literal("LassoTextSections"),
  company: companyRef,
  variant: z
    .enum(TEXT_SECTIONS_VARIANTS)
    .default("profil")
    .describe("'profil' (standard): formål og tegningsregler fra CVR plus regnskabsanalysens konklusion, resultat og likviditet. 'analyse': hele regnskabsanalysen (alle afsnit), foldet efter konklusionen."),
  title: z.string().max(80).optional(),
});

export const summarySchema = z.object({
  type: z.literal("LassoSummary"),
  title: z.string().max(80).optional(),
  text: z.string().min(1).max(4000).describe("Resumeteksten, skrevet af modellen ud fra kendte tal og fakta. Ingen 'Skrevet af AI'-mærke vises."),
  source: z.string().max(80).default("Lasso").describe("Kildetekst i kildelinjen, fx 'Lasso' eller modellens navn."),
  updated: z.string().max(40).optional().describe("Dato for resumeet (ÅÅÅÅ-MM-DD). Standard: i dag."),
});

export const timelineSchema = z
  .object({
    type: z.literal("LassoTimeline"),
    ...companyOrPerson,
    title: z.string().max(80).optional(),
    limit: z.number().int().min(1).max(20).optional().describe("Antal begivenheder før 'Se alle N begivenheder'. Standard 5; overblikket viser 3 (regel 9)."),
    filter: z
      .enum(TIMELINE_FILTERS)
      .optional()
      .describe("Kun med person: 'risiko' viser kun forløbet i de selskaber, der er gået konkurs eller tvangsopløst (roller ind og ud og selskabets status)."),
  })
  .refine(exactlyOneEntity, EXACTLY_ONE_ENTITY)
  .describe("Virksomhed: stiftelse, ledelsesskift og regnskaber. Person: indtrådt/udtrådt som X i selskaber og selskabernes konkurser/tvangsopløsninger.");

export const newsSchema = z
  .object({
    type: z.literal("LassoNews"),
    ...companyOrPerson,
    limit: z.number().int().min(1).max(10).default(5),
  })
  .refine(exactlyOneEntity, EXACTLY_ONE_ENTITY);

export const ownershipDiagramSchema = z.object({
  type: z.literal("LassoOwnershipDiagram"),
  ...companyOrPerson,
  ingoingDepth: z.number().int().min(0).max(10).default(2).describe("Lag op (ejere). Standard 2. For en person: 0 (personer har ingen ejere)."),
  outgoingDepth: z.number().int().min(0).max(10).default(1).describe("Lag ned (datterselskaber). Standard 1. For en person: de selskaber, personen ejer (1), og deres datterselskaber (2)."),
  onDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Øjebliksbillede pr. dato (ÅÅÅÅ-MM-DD). Udelades for i dag."),
  title: z.string().max(80).optional(),
}).refine(exactlyOneEntity, EXACTLY_ONE_ENTITY);

export const tableSchema = z.object({
  type: z.literal("LassoCompanyTable"),
  source: z.literal("search"),
  search: searchQuerySchema,
  columns: z.array(z.enum(TABLE_COLUMNS)).min(1).max(8).optional(),
  title: z.string().max(80).optional(),
});

/** Katalog 15.3: persontabel, samme tabel som virksomhedstabellen med personkolonner. */
export const personTableSchema = z.object({
  type: z.literal("LassoPersonTable"),
  query: z.string().min(2).max(120).describe("Navnet eller den del af navnet, der søges på, fx 'Mette Holm'."),
  limit: z.number().int().min(1).max(50).default(25),
  title: z.string().max(80).optional(),
});

export const comparisonSchema = z.object({
  type: z.literal("LassoCompareTable"),
  companies: z.array(companyRef).min(2).max(6),
  metrics: z.array(metric).min(1).max(5).default(["omsaetning", "bruttofortjeneste", "resultat", "ansatte"]),
  title: z.string().max(80).optional(),
});

export const keyValueListSchema = z.object({
  type: z.literal("LassoKeyValueList"),
  company: companyRef,
  variant: z
    .enum(["company", "financials"])
    .default("company")
    .describe("'company': stamdata og revisor. 'financials': regnskabstal med årsvælger, tal højrestillet."),
  title: z.string().max(80).optional(),
  exclude: z
    .array(metric)
    .max(METRICS.length)
    .optional()
    .describe("Kun variant 'financials': nøgletal, der allerede står på siden (fx i LassoKeyFigureCards), og som listen derfor udelader."),
});

export const contactSchema = z.object({
  type: z.literal("LassoContact"),
  company: companyRef,
  title: z.string().max(80).optional(),
}).describe("Kontaktblok: telefon, e-mail, web og adresse, klikbare.");

export const contactPersonsSchema = z.object({
  type: z.literal("LassoContactPersons"),
  company: companyRef,
  title: z.string().max(80).optional(),
}).describe("Kontaktpersoner med rolle, telefon og e-mail.");

export const multiYearTableSchema = z.object({
  type: z.literal("LassoMultiYearTable"),
  company: companyRef,
  metrics: z.array(metric).min(1).max(6).optional().describe("Standard: bruttofortjeneste/omsætning, resultat, egenkapital, ansatte."),
  years: z.number().int().min(2).max(10).default(5),
  title: z.string().max(80).optional(),
});

export const incomeStatementSchema = z.object({
  type: z.literal("LassoIncomeStatement"),
  company: companyRef,
  years: z.number().int().min(2).max(3).default(2).describe("Antal år side om side, standard 2 (maks 3)."),
  title: z.string().max(80).optional(),
}).describe("Hele resultatopgørelsen med subtotaler (EBITDA, resultat før skat, årets resultat), 2–3 år side om side med udvikling.");

export const balanceSheetSchema = z.object({
  type: z.literal("LassoBalanceSheet"),
  company: companyRef,
  years: z.number().int().min(2).max(3).default(2).describe("Antal år side om side, standard 2 (maks 3)."),
  title: z.string().max(80).optional(),
}).describe("Hele balancen (aktiver og passiver) med subtotaler og balancesum, 2–3 år side om side.");

export const cashFlowSchema = z.object({
  type: z.literal("LassoCashFlow"),
  company: companyRef,
  years: z.number().int().min(2).max(3).default(2).describe("Antal år side om side, standard 2 (maks 3)."),
  title: z.string().max(80).optional(),
}).describe("Pengestrømsopgørelsen (drift, investering, finansiering), 2–3 år side om side. Tom tilstand, når selskabet ikke aflægger den (klasse B).");

/** Ingen live datakilde endnu (se resolve.ts og LiveProvider.score); demodata i DemoProvider, "ikke oplyst" i live. */
export const scoreGaugeSchema = z.object({
  type: z.literal("LassoScoreGauge"),
  company: companyRef,
  title: z.string().max(80).optional().describe("Standard: 'Score'."),
});

/** Fjernet fra visningerne 27.09.2026. Skemaet bliver, så ældre gemte visninger stadig kan læses; komponenten vises og hentes ikke. */
export const riskObservationsSchema = z.object({
  type: z.literal("LassoRiskObservations"),
  company: companyRef,
  title: z.string().max(80).optional(),
  /** Uden for focus risiko: kun fundene (højst 3) og "Se alle", ingen alvorsskala, ingen relaterede udfoldet. */
  compact: z.boolean().optional(),
});

/** Katalog 17: kreditvurdering fra Creditsafe (A–E + lokal score). Egen skala; blandes aldrig med 0–100 eller 0/25/50/100. */
export const creditRatingSchema = z.object({
  type: z.literal("LassoCreditRating"),
  company: companyRef,
  title: z.string().max(80).optional().describe("Standard: 'Kreditvurdering'."),
});

export const productionUnitsSchema = z.object({
  type: z.literal("LassoProductionUnits"),
  company: companyRef,
});

export const propertiesSchema = z.object({
  type: z.literal("LassoProperties"),
  company: companyRef,
  title: z.string().max(80).optional(),
});

export const auditorIndependenceSchema = z.object({
  type: z.literal("LassoAuditorIndependence"),
  company: companyRef,
  title: z.string().max(80).optional(),
});

export const livestockSchema = z.object({
  type: z.literal("LassoLivestock"),
  company: companyRef,
});

/* Personsiden (katalog 16); personRef står øverst, fordi tidslinje, nyheder og ejerdiagram også bruger den. */
export const personHeadSchema = z.object({
  type: z.literal("LassoPersonHead"),
  person: personRef,
});

export const personRolesSchema = z.object({
  type: z.literal("LassoPersonRoles"),
  person: personRef,
  show: z
    .enum(PERSON_ROLES_SHOW)
    .optional()
    .describe(
      "'all' (standard): alle roller som tidsbånd fra–til. 'current': de aktive roller som kort liste pr. selskab. 'ended': de ophørte roller som liste, senest ophørte først. 'owner': de selskaber, personen ejer nu, med ejerandel og siden-dato.",
    ),
  limit: z.number().int().min(1).max(50).optional().describe("Antal selskaber før 'Se alle N selskaber'. Standard 3 for tidsbåndene og 5 for listerne (regel 9)."),
  except: z
    .enum(TIMELINE_FILTERS)
    .optional()
    .describe("Kun show 'ended': 'risiko' udelader selskaber, der er gået konkurs eller tvangsopløst (de står i risikoens forløb)."),
  title: z.string().max(80).optional(),
});

export const personNetworkSchema = z.object({
  type: z.literal("LassoPersonNetwork"),
  person: personRef,
  limit: z.number().int().min(1).max(50).optional().describe("Antal personer før 'Se alle N'. Standard 3 (regel 9)."),
  title: z.string().max(80).optional(),
});

export const personRiskSchema = z.object({
  type: z.literal("LassoPersonRisk"),
  person: personRef,
  title: z.string().max(80).optional(),
});

export const personFactsSchema = z
  .object({
    type: z.literal("LassoPersonFacts"),
    person: personRef,
    title: z.string().max(80).optional().describe("Standard: 'Stamoplysninger'."),
  })
  .describe("Stamoplysninger om personen som nøgle-værdi (¼): bopæl (postnummer og by, aldrig gade), kommune, enhedsnummer, roller, ejerskaber, første registrering og seneste ændring.");

/** Katalog 21: ændringsfeed på tværs af de overvågede virksomheder. Live-endpoint ubekræftet (docs/lasso-endpoints.md). */
export const changeFeedSchema = z
  .object({
    type: z.literal("LassoChangeFeed"),
    list: z.string().max(80).optional().describe("Navnet på overvågningslisten, fx 'Kunder'. Udeladt = alle overvågede virksomheder."),
    days: z.number().int().min(1).max(90).default(7).describe("Antal dage tilbage, standard 7 (1–90)."),
    types: z.array(z.enum(CHANGE_TYPES)).min(1).optional().describe("Delmængde af ændringstyper; udeladt = alle."),
    title: z.string().max(80).optional(),
  })
  .describe("Ændringer i de overvågede virksomheder, grupperet pr. dag, med filter på ændringstype.");

/** Gem-laget (docs/gem-lag.md): brugerens gemte virksomheds- og personsider. Vises af list_saved_pages. */
export const savedPagesSchema = z
  .object({
    type: z.literal("LassoSavedPages"),
    kind: z.enum(["company", "person", "all"]).default("all").describe("Kun virksomheder, kun personer eller begge (standard)."),
    limit: z.number().int().min(1).max(100).default(20).describe("Højst så mange sider, nyeste først. Standard 20."),
    title: z.string().max(80).optional(),
  })
  .describe("Brugerens gemte sider (virksomheder og personer), nyeste først, med åbn og fjern.");

export const actionsSchema = z.object({
  type: z.literal("LassoFollowUps"),
  prompts: z
    .array(
      z.object({
        label: z.string().min(1).max(60).describe("Knaptekst, kort."),
        prompt: z.string().min(1).max(500).describe("Teksten, der sendes til modellen som brugerens næste besked."),
      }),
    )
    .min(1)
    .max(4),
});

/**
 * Bredde i 4-kolonne-grid'et (guide 23: kun ¼, ½, ¾ og fuld). Udeladt = komponentens
 * standardbredde (DEFAULT_WIDTH). På tablet og mobil lægger elementerne sig under hinanden.
 */
export const WIDTHS = ["quarter", "half", "three-quarters", "full"] as const;
export type Width = (typeof WIDTHS)[number];
const widthShape = {
  width: z.enum(WIDTHS).optional().describe("Bredde i dashboardet: quarter (¼), half (½), three-quarters (¾) eller full. Udelad for standardbredden."),
  column: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .describe(
      "Kun layout 'columns': hvilken kolonne komponenten stables i. Udeladt = fuld bredde over eller under kolonnerne. Et lavere kolonnenummer end forrige komponents starter et nyt bånd af kolonner; står width på båndets komponenter, bestemmer den kolonnernes forhold (fx ¾ + ¼).",
    ),
};
function w<S extends z.ZodRawShape>(schema: z.ZodObject<S>) {
  return schema.extend(widthShape);
}

export const componentSchema = z.discriminatedUnion("type", [
  w(companyHeaderSchema),
  w(keyFiguresSchema),
  w(financialChartSchema),
  w(groupedBarChartSchema),
  w(stackedBarChartSchema),
  w(lineChartSchema),
  w(waterfallChartSchema),
  w(shareBarsSchema),
  w(rankingSchema),
  w(peopleListSchema),
  w(ownershipSchema),
  w(ownershipDiagramSchema),
  w(tableSchema),
  w(personTableSchema),
  w(comparisonSchema),
  w(keyValueListSchema),
  w(contactSchema),
  w(contactPersonsSchema),
  w(multiYearTableSchema),
  w(incomeStatementSchema),
  w(balanceSheetSchema),
  w(cashFlowSchema),
  w(scoreGaugeSchema),
  w(riskObservationsSchema),
  w(creditRatingSchema),
  w(auditorIndependenceSchema),
  w(productionUnitsSchema),
  w(propertiesSchema),
  w(livestockSchema),
  w(actionsSchema),
  w(relationsSchema),
  w(beneficialOwnersSchema),
  w(textSectionsSchema),
  w(summarySchema),
  w(timelineSchema),
  w(newsSchema),
  w(personHeadSchema),
  w(personRolesSchema),
  w(personNetworkSchema),
  w(personRiskSchema),
  w(personFactsSchema),
  w(changeFeedSchema),
  w(savedPagesSchema),
]);
export type ViewComponent = z.infer<typeof componentSchema>;
export type ComponentType = ViewComponent["type"];

/**
 * 'dashboard' (standard): 4-kolonne-grid, hvor hver komponent står i sin bredde, så visningen
 * læses som ét overblik. 'stack': alt i fuld bredde under hinanden. 'grid-2' er det gamle navn
 * for dashboard og behandles ens.
 */
export const LAYOUTS = ["dashboard", "stack", "grid-2", "columns"] as const;

export const viewSpecSchema = z.object({
  /** v2: komponentsættet bygget fra Paper-kataloget. v1-visninger (gamle komponentnavne) afvises. */
  version: z.literal(2).default(2),
  kind: z.enum(["company", "person", "list", "custom"]).default("custom"),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  layout: z.enum(LAYOUTS).default("dashboard").describe("'dashboard' (standard) = ét samlet overblik i 4-kolonne-grid med hver komponents bredde. 'stack' = alt i fuld bredde under hinanden."),
  criteria: z.array(criterionSchema).max(20).default([]).describe("Vises som chips i rammen under titlen."),
  columns: z.number().int().min(2).max(3).optional().describe("Kun layout 'columns': antal kolonner på desktop (2 eller 3). Serverens komponist sætter det."),
  components: z.array(componentSchema).min(1).max(12),
});
export type ViewSpec = z.infer<typeof viewSpecSchema>;
export type ViewSpecInput = z.input<typeof viewSpecSchema>;

export function parseViewSpec(input: unknown): ViewSpec {
  return viewSpecSchema.parse(input);
}

/**
 * Standardbredde pr. komponent (guide 23): nøgletal, tabeller og hoveder i fuld bredde,
 * grafer mindst ½, lister og tekst ½, smalle overblik ¼.
 */
export const DEFAULT_WIDTH: Record<ComponentType, Width> = {
  LassoCompanyHead: "full",
  LassoKeyFigureCards: "full",
  LassoBarChart: "half",
  LassoGroupedBarChart: "half",
  LassoStackedBarChart: "half",
  LassoLineChart: "half",
  LassoWaterfallChart: "half",
  LassoShareBars: "half",
  LassoRanking: "half",
  LassoPersonList: "half",
  LassoOwnerList: "half",
  LassoOwnershipDiagram: "full",
  LassoCompanyTable: "full",
  LassoPersonTable: "full",
  LassoCompareTable: "full",
  LassoKeyValueList: "half",
  LassoContact: "half",
  LassoContactPersons: "half",
  LassoMultiYearTable: "full",
  LassoIncomeStatement: "full",
  LassoBalanceSheet: "full",
  LassoCashFlow: "full",
  LassoScoreGauge: "quarter",
  LassoRiskObservations: "full",
  LassoCreditRating: "half",
  LassoAuditorIndependence: "full",
  LassoProductionUnits: "full",
  LassoProperties: "full",
  LassoLivestock: "half",
  LassoFollowUps: "full",
  LassoRelations: "quarter",
  LassoBeneficialOwners: "half",
  LassoTextSections: "half",
  LassoSummary: "full",
  LassoTimeline: "half",
  LassoNews: "half",
  LassoPersonHead: "full",
  LassoPersonRoles: "full",
  LassoPersonNetwork: "half",
  LassoPersonRisk: "half",
  LassoPersonFacts: "quarter",
  LassoChangeFeed: "full",
  LassoSavedPages: "full",
};

/** Den bredde, en komponent får i visningen. 'stack' giver altid fuld bredde. */
export function widthOf(c: ViewComponent, layout: ViewSpec["layout"]): Width {
  if (layout === "stack") return "full";
  return c.width ?? DEFAULT_WIDTH[c.type];
}
