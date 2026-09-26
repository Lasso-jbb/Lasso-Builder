import { z } from "zod";
import { criterionSchema } from "./criteria.js";
import { formatAmount, formatNumber, formatPercent } from "./format.js";
import type { FinancialYear } from "./models.js";

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
export function formatMetricValue(m: Metric, v: number | null | undefined): string {
  const kind = METRIC_KIND[m];
  if (kind === "count") return formatNumber(v);
  if (kind === "percent") return formatPercent(v, false);
  return formatAmount(v);
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
  title: z.string().max(80).optional(),
});

export const summarySchema = z.object({
  type: z.literal("LassoSummary"),
  title: z.string().max(80).optional(),
  text: z.string().min(1).max(4000).describe("Resumeteksten, skrevet af modellen ud fra kendte tal og fakta. Ingen 'Skrevet af AI'-mærke vises."),
  source: z.string().max(80).default("Lasso").describe("Kildetekst i kildelinjen, fx 'Lasso' eller modellens navn."),
  updated: z.string().max(40).optional().describe("Dato for resumeet (ÅÅÅÅ-MM-DD). Standard: i dag."),
});

export const timelineSchema = z.object({
  type: z.literal("LassoTimeline"),
  company: companyRef,
  title: z.string().max(80).optional(),
});

export const newsSchema = z.object({
  type: z.literal("LassoNews"),
  company: companyRef,
  limit: z.number().int().min(1).max(10).default(5),
});

export const ownershipDiagramSchema = z.object({
  type: z.literal("LassoOwnershipDiagram"),
  company: companyRef,
  ingoingDepth: z.number().int().min(0).max(10).default(2).describe("Lag op (ejere). Standard 2."),
  outgoingDepth: z.number().int().min(0).max(10).default(1).describe("Lag ned (datterselskaber). Standard 1."),
  onDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Øjebliksbillede pr. dato (ÅÅÅÅ-MM-DD). Udelades for i dag."),
  title: z.string().max(80).optional(),
});

export const tableSchema = z.object({
  type: z.literal("LassoCompanyTable"),
  source: z.literal("search"),
  search: searchQuerySchema,
  columns: z.array(z.enum(TABLE_COLUMNS)).min(1).max(8).optional(),
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

export const riskObservationsSchema = z.object({
  type: z.literal("LassoRiskObservations"),
  company: companyRef,
  title: z.string().max(80).optional(),
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
    .describe("Kun layout 'columns': hvilken kolonne komponenten stables i. Udeladt = fuld bredde over eller under kolonnerne."),
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
  kind: z.enum(["company", "list", "custom"]).default("custom"),
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
};

/** Den bredde, en komponent får i visningen. 'stack' giver altid fuld bredde. */
export function widthOf(c: ViewComponent, layout: ViewSpec["layout"]): Width {
  if (layout === "stack") return "full";
  return c.width ?? DEFAULT_WIDTH[c.type];
}
