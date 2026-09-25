import { z } from "zod";
import { criterionSchema } from "./criteria.js";
import type { FinancialYear } from "./models.js";

/**
 * Den deklarative visnings-spec. Modellen skriver aldrig HTML/CSS; den sender
 * denne JSON, og Lassos kode henter data og tegner den. Specen gemmes (ikke
 * data), så et delt link altid viser friske tal.
 */

export const METRICS = ["omsaetning", "bruttofortjeneste", "resultat", "egenkapital", "ansatte"] as const;
export type Metric = (typeof METRICS)[number];

export const METRIC_LABELS: Record<Metric, string> = {
  omsaetning: "Omsætning",
  bruttofortjeneste: "Bruttofortjeneste",
  resultat: "Årets resultat",
  egenkapital: "Egenkapital",
  ansatte: "Ansatte",
};

/** Hvilket felt i et regnskabsår et nøgletal læses fra. */
export const METRIC_FIELD: Record<Metric, keyof FinancialYear> = {
  omsaetning: "revenue",
  bruttofortjeneste: "grossProfit",
  resultat: "profit",
  egenkapital: "equity",
  ansatte: "employees",
};

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

export const multiYearTableSchema = z.object({
  type: z.literal("LassoMultiYearTable"),
  company: companyRef,
  metrics: z.array(metric).min(1).max(6).optional().describe("Standard: bruttofortjeneste/omsætning, resultat, egenkapital, ansatte."),
  years: z.number().int().min(2).max(10).default(5),
  title: z.string().max(80).optional(),
});

/** Ingen live datakilde endnu (se resolve.ts og LiveProvider.score); demodata i DemoProvider, "ikke oplyst" i live. */
export const scoreGaugeSchema = z.object({
  type: z.literal("LassoScoreGauge"),
  company: companyRef,
  title: z.string().max(80).optional().describe("Standard: 'Score'."),
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

export const componentSchema = z.discriminatedUnion("type", [
  companyHeaderSchema,
  keyFiguresSchema,
  financialChartSchema,
  peopleListSchema,
  ownershipSchema,
  tableSchema,
  comparisonSchema,
  keyValueListSchema,
  multiYearTableSchema,
  scoreGaugeSchema,
  actionsSchema,
]);
export type ViewComponent = z.infer<typeof componentSchema>;
export type ComponentType = ViewComponent["type"];

export const LAYOUTS = ["stack", "grid-2"] as const;

export const viewSpecSchema = z.object({
  /** v2: komponentsættet bygget fra Paper-kataloget. v1-visninger (gamle komponentnavne) afvises. */
  version: z.literal(2).default(2),
  kind: z.enum(["company", "list", "custom"]).default("custom"),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  layout: z.enum(LAYOUTS).default("stack").describe("'stack' = én kolonne. 'grid-2' = to kolonner på desktop, én på mobil."),
  criteria: z.array(criterionSchema).max(20).default([]).describe("Vises som chips i rammen under titlen."),
  components: z.array(componentSchema).min(1).max(12),
});
export type ViewSpec = z.infer<typeof viewSpecSchema>;
export type ViewSpecInput = z.input<typeof viewSpecSchema>;

export function parseViewSpec(input: unknown): ViewSpec {
  return viewSpecSchema.parse(input);
}
