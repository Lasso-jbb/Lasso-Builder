import {
  emptyDataset,
  searchKey,
  toLassoId,
  type Dataset,
  type ViewComponent,
  type ViewSpec,
} from "@lasso/spec";
import { LassoApiError } from "../lasso/client.js";
import { NotFoundError, type DataProvider } from "./provider.js";

type Need = "company" | "financials" | "people" | "ownership" | "score";

/** Normaliserer alle virksomhedsreferencer i specen til Lasso-ID'er. */
export function normalizeSpec(spec: ViewSpec, companyPrefix: string): ViewSpec {
  const fix = (ref: string) => toLassoId(ref, companyPrefix);
  const components = spec.components.map((c): ViewComponent => {
    if ("company" in c) return { ...c, company: fix(c.company) };
    if (c.type === "LassoCompareTable") return { ...c, companies: c.companies.map(fix) };
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

  for (const c of spec.components) {
    switch (c.type) {
      case "LassoCompanyHead":
        want(c.company, "company");
        break;
      case "LassoKeyFigureCards":
      case "LassoBarChart":
        want(c.company, "financials");
        break;
      case "LassoPersonList":
        want(c.company, "people");
        break;
      case "LassoOwnerList":
        want(c.company, "ownership");
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
      case "LassoMultiYearTable":
        want(c.company, "financials");
        break;
      case "LassoScoreGauge":
        want(c.company, "score");
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
    if (set.has("company")) run(`company:${id}`, async () => void (ds.companies[id] = await provider.company(id)));
    if (set.has("financials")) run(`financials:${id}`, async () => void (ds.financials[id] = await provider.financials(id)));
    if (set.has("people")) run(`people:${id}`, async () => void (ds.people[id] = await provider.people(id)));
    if (set.has("ownership")) run(`ownership:${id}`, async () => void (ds.ownership[id] = await provider.ownership(id)));
    if (set.has("score")) run(`score:${id}`, async () => void (ds.scores[id] = await provider.score(id)));
  }
  for (const s of searches) {
    const key = searchKey(s);
    run(`search:${key}`, async () => void (ds.searches[key] = await provider.search(s)));
  }

  await Promise.all(jobs);
  ds.generatedAt = new Date().toISOString();
  return ds;
}
