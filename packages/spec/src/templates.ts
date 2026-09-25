import { formatCriterion } from "./format.js";
import type { Criterion } from "./criteria.js";
import {
  DEFAULT_TABLE_COLUMNS,
  viewSpecSchema,
  type Metric,
  type SearchQuery,
  type TableColumn,
  type ViewComponent,
  type ViewSpec,
} from "./spec.js";

/**
 * Faste skabeloner. Enkeltvirksomhed har en låst rækkefølge:
 * header -> nøgletal -> graf -> ledelse -> ejerskab/revisor -> handlinger.
 * Variation styres med parametre, ikke med fri komposition.
 */
export const COMPANY_SECTIONS = ["header", "noegletal", "graf", "ledelse", "ejerskab", "handlinger"] as const;
export type CompanySection = (typeof COMPANY_SECTIONS)[number];

export interface CompanyTemplateOptions {
  sections?: readonly CompanySection[];
  chartMetric?: Metric;
  years?: number;
  /** Navn, hvis det allerede kendes; ellers udfyldes titlen af rammen. */
  name?: string;
}

export function companyTemplate(lassoId: string, options: CompanyTemplateOptions = {}): ViewSpec {
  const sections = new Set<CompanySection>(options.sections?.length ? options.sections : COMPANY_SECTIONS);
  sections.add("header");
  const components: ViewComponent[] = [];
  const add = (s: CompanySection, c: ViewComponent) => {
    if (sections.has(s)) components.push(c);
  };
  add("header", { type: "LassoCompanyHead", company: lassoId });
  add("noegletal", { type: "LassoKeyFigureCards", company: lassoId });
  add("graf", {
    type: "LassoBarChart",
    company: lassoId,
    metric: options.chartMetric ?? "bruttofortjeneste",
    years: options.years ?? 5,
  });
  add("ledelse", { type: "LassoPersonList", company: lassoId, show: "all" });
  add("ejerskab", { type: "LassoOwnerList", company: lassoId });
  add("handlinger", {
    type: "LassoFollowUps",
    prompts: [
      { label: "Nye i ledelsen?", prompt: `Hvem er kommet ind i ledelsen og bestyrelsen i ${options.name ?? lassoId} de seneste to år?` },
      { label: "Sammenlign med konkurrenter", prompt: `Sammenlign ${options.name ?? lassoId} med de nærmeste konkurrenter på bruttofortjeneste og ansatte.` },
      { label: "Ejerstruktur", prompt: `Hvem ejer ${options.name ?? lassoId}, og hvad ejer de ellers?` },
    ],
  });

  return viewSpecSchema.parse({
    kind: "company",
    title: options.name ?? lassoId,
    layout: "stack",
    components,
  });
}

export function listTemplate(search: SearchQuery, options: { title?: string; columns?: readonly TableColumn[] } = {}): ViewSpec {
  const title = options.title ?? defaultListTitle(search.query, search.criteria);
  return viewSpecSchema.parse({
    kind: "list",
    title,
    layout: "stack",
    criteria: search.criteria,
    components: [
      {
        type: "LassoCompanyTable",
        source: "search",
        search,
        columns: options.columns?.length ? [...options.columns] : [...DEFAULT_TABLE_COLUMNS],
      },
    ],
  });
}

function defaultListTitle(query: string, criteria: readonly Criterion[]): string {
  const q = query.trim();
  if (q) return `Søgning: ${q}`;
  if (criteria.length > 0) return criteria.slice(0, 2).map(formatCriterion).join(" · ");
  return "Virksomheder";
}
