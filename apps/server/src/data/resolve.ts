import {
  emptyDataset,
  searchKey,
  toLassoId,
  type Dataset,
  type ViewComponent,
  type ViewSpec,
  ownershipGraphKey,
} from "@lasso/spec";
import { LassoApiError } from "../lasso/client.js";
import { NotFoundError, type DataProvider } from "./provider.js";

/** Hvilke data en virksomhed skal have hentet, fx "company", "financials", "timeline". Nøglen matcher metoden i DataProvider. */
type Need = string;

/**
 * Én linje pr. datatype: hvad der hentes, og hvor i Dataset det lægges.
 * Fejlnøglen er "<need>:<lassoId>", som komponenterne slår op på.
 */
const FETCHERS: Record<string, (ds: Dataset, p: DataProvider, id: string) => Promise<void>> = {
  company: async (ds, p, id) => void (ds.companies[id] = await p.company(id)),
  contact: async (ds, p, id) => void (ds.contact[id] = await p.contact(id)),
  contactPersons: async (ds, p, id) => void (ds.contactPersons[id] = await p.contactPersons(id)),
  financials: async (ds, p, id) => void (ds.financials[id] = await p.financials(id)),
  financialStatements: async (ds, p, id) => void (ds.financialStatements[id] = await p.financialStatements(id)),
  people: async (ds, p, id) => void (ds.people[id] = await p.people(id)),
  ownership: async (ds, p, id) => void (ds.ownership[id] = await p.ownership(id)),
  score: async (ds, p, id) => void (ds.scores[id] = await p.score(id)),
  beneficialOwnership: async (ds, p, id) => void (ds.beneficialOwnership[id] = await p.beneficialOwnership(id)),
  textSections: async (ds, p, id) => void (ds.textSections[id] = await p.textSections(id)),
  timeline: async (ds, p, id) => void (ds.timeline[id] = await p.timeline(id)),
  observations: async (ds, p, id) => void (ds.observations[id] = await p.observations(id)),
  auditorIndependence: async (ds, p, id) => void (ds.auditorIndependence[id] = await p.auditorIndependence(id)),
  productionUnits: async (ds, p, id) => void (ds.productionUnits[id] = await p.productionUnits(id)),
  properties: async (ds, p, id) => void (ds.properties[id] = await p.properties(id)),
  livestock: async (ds, p, id) => void (ds.livestock[id] = await p.livestock(id)),
};

/** Normaliserer alle virksomhedsreferencer i specen til Lasso-ID'er. */
export function normalizeSpec(spec: ViewSpec, companyPrefix: string): ViewSpec {
  const fix = (ref: string) => toLassoId(ref, companyPrefix);
  const components = spec.components.map((c): ViewComponent => {
    if (c.type === "LassoLineChart") return { ...c, company: fix(c.company), benchmark: c.benchmark ? fix(c.benchmark) : undefined };
    if ("company" in c) return { ...c, company: fix(c.company) };
    if (c.type === "LassoCompareTable" || c.type === "LassoRanking") return { ...c, companies: c.companies.map(fix) };
    return c;
  });
  return { ...spec, components };
}

export function errorMessage(err: unknown): string {
  if (err instanceof NotFoundError) return err.message;
  if (err instanceof LassoApiError) {
    // Lassos fejlsvar: { errorMessage, httpStatusCode, errorCode }
    const detail =
      err.body && typeof err.body === "object" && typeof (err.body as { errorMessage?: unknown }).errorMessage === "string"
        ? `: ${(err.body as { errorMessage: string }).errorMessage}`
        : "";
    if (err.status === 401 || err.status === 403) return `Ingen adgang til data${detail || " (tjek Lasso-nøglen)"}`;
    if (err.status === 404) return `Ikke fundet hos Lasso${detail}`;
    if (err.status === 429) return "Lasso API: for mange kald, prøv igen om lidt";
    return `Lasso API-fejl (${err.status})${detail}`;
  }
  if (err instanceof Error && err.name === "TimeoutError") return "Lasso API svarede ikke i tide";
  if (err instanceof TypeError && /fetch failed/i.test(err.message)) return "Kunne ikke nå Lasso API";
  return err instanceof Error ? err.message : String(err);
}

/**
 * Henter præcis de data, en spec skal bruge, parallelt og uden dubletter.
 * Data går uden om modellen: det returneres til UI'en, ikke i modellens tekst.
 */
export async function resolveSpec(spec: ViewSpec, provider: DataProvider): Promise<Dataset> {
  const ds = emptyDataset(provider.kind);
  const needs = new Map<string, Set<Need>>();
  const want = (id: string, ...n: Need[]) => {
    const s = needs.get(id) ?? new Set<Need>();
    n.forEach((x) => s.add(x));
    needs.set(id, s);
  };
  const searches: Extract<ViewComponent, { type: "LassoCompanyTable" }>["search"][] = [];
  const newsWanted = new Map<string, number>();
  const graphs: Extract<ViewComponent, { type: "LassoOwnershipDiagram" }>[] = [];

  for (const c of spec.components) {
    switch (c.type) {
      case "LassoCompanyHead":
        want(c.company, "company");
        break;
      case "LassoKeyFigureCards":
      case "LassoBarChart":
      case "LassoGroupedBarChart":
      case "LassoStackedBarChart":
      case "LassoWaterfallChart":
      case "LassoShareBars":
        want(c.company, "financials");
        break;
      case "LassoLineChart":
        want(c.company, "financials");
        if (c.benchmark) want(c.benchmark, "company", "financials");
        break;
      case "LassoRanking":
        c.companies.forEach((id) => want(id, "company", "financials"));
        break;
      case "LassoPersonList":
        want(c.company, "people");
        break;
      case "LassoOwnerList":
        want(c.company, "ownership");
        break;
      case "LassoRelations":
        want(c.company, "people", "ownership");
        break;
      case "LassoBeneficialOwners":
        want(c.company, "beneficialOwnership");
        break;
      case "LassoTextSections":
        want(c.company, "textSections");
        break;
      case "LassoTimeline":
        want(c.company, "timeline");
        break;
      case "LassoNews":
        newsWanted.set(c.company, Math.max(newsWanted.get(c.company) ?? 0, c.limit));
        break;
      case "LassoSummary":
        break;
      case "LassoRiskObservations":
        want(c.company, "observations");
        break;
      case "LassoAuditorIndependence":
        want(c.company, "auditorIndependence");
        break;
      case "LassoProductionUnits":
        want(c.company, "productionUnits");
        break;
      case "LassoProperties":
        want(c.company, "properties");
        break;
      case "LassoLivestock":
        want(c.company, "livestock");
        break;
      case "LassoCompareTable":
        c.companies.forEach((id) => want(id, "company", "financials"));
        break;
      case "LassoCompanyTable":
        searches.push(c.search);
        break;
      case "LassoKeyValueList":
        if (c.variant === "financials") want(c.company, "financials");
        else want(c.company, "company", "ownership", "financials");
        break;
      case "LassoContact":
        want(c.company, "contact");
        break;
      case "LassoContactPersons":
        want(c.company, "contactPersons");
        break;
      case "LassoMultiYearTable":
        want(c.company, "financials");
        break;
      case "LassoIncomeStatement":
      case "LassoBalanceSheet":
      case "LassoCashFlow":
        want(c.company, "financialStatements");
        break;
      case "LassoScoreGauge":
        want(c.company, "score");
        break;
      case "LassoOwnershipDiagram":
        graphs.push(c);
        break;
      case "LassoFollowUps":
        break;
    }
  }

  const jobs: Promise<void>[] = [];
  const run = (key: string, fn: () => Promise<void>) =>
    jobs.push(
      fn().catch((err: unknown) => {
        ds.errors[key] = errorMessage(err);
      }),
    );

  for (const [id, set] of needs) {
    for (const need of set) {
      const fetch = FETCHERS[need];
      if (fetch) run(`${need}:${id}`, async () => fetch(ds, provider, id));
    }
  }
  for (const [id, limit] of newsWanted) {
    run(`news:${id}`, async () => void (ds.news[id] = await provider.news(id, limit)));
  }
  for (const s of searches) {
    const key = searchKey(s);
    run(`search:${key}`, async () => void (ds.searches[key] = await provider.search(s)));
  }

  const graphKeys = new Set<string>();
  for (const g of graphs) {
    const key = ownershipGraphKey(g);
    if (graphKeys.has(key)) continue;
    graphKeys.add(key);
    run(`graph:${key}`, async () => {
      ds.ownershipGraphs[key] = await provider.ownershipGraph(g.company, { ingoingDepth: g.ingoingDepth, outgoingDepth: g.outgoingDepth, onDate: g.onDate });
    });
  }

  await Promise.all(jobs);
  ds.generatedAt = new Date().toISOString();
  return ds;
}
