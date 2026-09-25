import { formatCriterion, searchKey, type CompanyRowVM, type Criterion, type FinancialsVM, type SearchQuery, type SearchResultVM } from "@lasso/spec";
import type { Config } from "../config.js";
import { adaptCompany, adaptFinancials, adaptOwnership, adaptPeople, adaptSearch } from "../lasso/adapters.js";
import type { LassoClient } from "../lasso/client.js";
import { criteriaToFilters, filtersToCriteria, SERVER_SORT, type LassoFilter } from "../lasso/searchFilters.js";
import { applyCriteria, needsFinancials, sortRows } from "./criteria-eval.js";
import { mapLimit, type DataProvider } from "./provider.js";

/** Så mange virksomheder hentes, når noget skal filtreres eller sorteres her (omsætning, bruttofortjeneste). */
const LOCAL_POOL = 60;

/**
 * Går direkte på Lassos rigtige API. Med søgenøgle (LASSO_SEARCH_API_TOKEN) filtrerer
 * Lasso selv i hele CVR; uden bruges navnesøgningen, og kriterierne anvendes her.
 */
export class LiveProvider implements DataProvider {
  readonly kind = "live" as const;

  constructor(
    private readonly client: LassoClient,
    private readonly config: Config,
  ) {}

  async search(q: SearchQuery): Promise<SearchResultVM> {
    // Med søgenøgle filtrerer Lasso selv i hele CVR; kun det, Lasso ikke kan, klares her.
    if (this.client.hasSearchCredentials) {
      const { filters, rest } = criteriaToFilters(q.criteria);
      if (filters.length > 0) return this.searchWithFilters(q, filters, rest);
    }
    return this.searchByName(q);
  }

  /** Lassos filtersøgning (POST /apps/search/lassoid) over alle virksomheder. */
  private async searchWithFilters(q: SearchQuery, filters: LassoFilter[], rest: Criterion[]): Promise<SearchResultVM> {
    const serverSort = q.sort ? SERVER_SORT[q.sort.field] : undefined;
    const raw = (await this.client.searchByFilters(filters, serverSort)) as { results?: unknown[]; resultsFound?: number; totalPages?: number };
    let ids = (raw.results ?? []).filter((id): id is string => typeof id === "string");
    const total = typeof raw.resultsFound === "number" ? raw.resultsFound : ids.length;
    // Lasso sorterer altid stigende. Faldende kan vendes, når hele resultatet er på én side.
    const descending = serverSort !== undefined && q.sort?.direction !== "asc";
    const reversible = ids.length >= total;
    if (descending && reversible) ids = [...ids].reverse();

    const localSort = q.sort && q.sort.field !== "relevans" && (!serverSort || (descending && !reversible)) ? q.sort : undefined;
    const localWork = rest.length > 0 || localSort !== undefined;
    const pool = ids.slice(0, localWork ? Math.max(q.limit, LOCAL_POOL) : q.limit);
    const rows = await mapLimit(pool, 6, (id) => this.row(id));
    const filtered = applyCriteria(rows, rest);
    const shown = sortRows(filtered.rows, localSort).slice(0, q.limit);
    const partial = localWork && pool.length < ids.length;
    return {
      key: searchKey(q),
      total: rest.length > 0 ? filtered.rows.length : total,
      rows: shown,
      unsupportedCriteria: filtered.unsupported.length ? filtered.unsupported : undefined,
      source: "lasso-search",
      note: partial
        ? `Lasso fandt ${total} virksomheder. ${[...rest.map(formatCriterion), localSort ? "sorteringen" : ""].filter(Boolean).join(", ")} er anvendt på de første ${pool.length}.`
        : undefined,
    };
  }

  /** Én søgerække ud fra virksomhed og regnskab. */
  private async row(lassoId: string): Promise<CompanyRowVM> {
    const [co, f] = await Promise.all([
      this.company(lassoId).catch(() => null),
      this.financials(lassoId).catch(() => ({ lassoId, currency: "DKK", years: [] }) as FinancialsVM),
    ]);
    const last = f.years.at(-1);
    return {
      lassoId,
      cvr: co?.cvr,
      name: co?.name ?? lassoId,
      city: co?.address?.city,
      region: co?.address?.region,
      industryText: co?.industryText,
      status: co?.status,
      statusKind: co?.statusKind,
      employees: co?.employees ?? last?.employees ?? null,
      revenue: last?.revenue ?? null,
      grossProfit: last?.grossProfit ?? null,
      profit: last?.profit ?? null,
      trend: f.years.slice(-5).map((y) => y.grossProfit ?? y.revenue ?? 0),
    };
  }

  /** Lassos prompt-søgning: fritekst -> kriterier til filterpanelet. null, når teksten ikke kan fortolkes (fx et navn). */
  async interpret(text: string) {
    if (!this.client.hasSearchCredentials || !text.trim()) return null;
    try {
      const raw = await this.client.searchPrompt(text);
      const result = filtersToCriteria(Array.isArray(raw) ? (raw as LassoFilter[]) : []);
      return result.criteria.length ? result : null;
    } catch {
      return null;
    }
  }

  /** Den oprindelige søgning: Lassos navnesøgning, derefter filtrering og sortering her. */
  private async searchByName(q: SearchQuery): Promise<SearchResultVM> {
    const statusCriterion = q.criteria.find((c) => c.field === "status" && c.operator === "eq");
    const companyStatus = statusCriterion && String(statusCriterion.value).toLowerCase() !== "aktiv" ? "all" : "active";
    const wantsFinancials = needsFinancials(q);
    const pageSize = wantsFinancials || q.criteria.length > 0 ? Math.max(50, q.limit) : q.limit;

    const raw = await this.client.search({ query: q.query, type: "all", pageSize, companyStatus });
    const { total, rows } = adaptSearch(raw, this.config.LASSO_COMPANY_ID_PREFIX);

    // Berig med regnskabstal, så kriterier, sortering og sparklines virker.
    const enrich = async (list: typeof rows) =>
      mapLimit(list, 6, async (row) => {
        try {
          const [f, co] = await Promise.all([
            this.financials(row.lassoId).catch(() => ({ lassoId: row.lassoId, currency: "DKK", years: [] })),
            this.company(row.lassoId).catch(() => null),
          ]);
          const last = f.years.at(-1);
          return {
            ...row,
            cvr: row.cvr ?? co?.cvr,
            industryText: row.industryText ?? co?.industryText,
            region: row.region ?? co?.address?.region,
            revenue: row.revenue ?? last?.revenue ?? null,
            grossProfit: row.grossProfit ?? last?.grossProfit ?? null,
            profit: row.profit ?? last?.profit ?? null,
            employees: row.employees ?? co?.employees ?? last?.employees ?? null,
            trend: f.years.slice(-5).map((y) => y.grossProfit ?? y.revenue ?? 0),
          };
        } catch {
          return row;
        }
      });

    let candidates = wantsFinancials ? await enrich(rows) : rows;
    const filtered = applyCriteria(candidates, q.criteria);
    candidates = sortRows(filtered.rows, q.sort).slice(0, q.limit);
    if (!wantsFinancials) candidates = await enrich(candidates);

    return {
      key: searchKey(q),
      total: q.criteria.length > 0 ? filtered.rows.length : total,
      rows: candidates,
      unsupportedCriteria: filtered.unsupported.length ? filtered.unsupported : undefined,
      source: "name-search",
    };
  }

  async findCompanies(name: string, limit: number) {
    const raw = await this.client.search({ query: name, type: "all", pageSize: limit, companyStatus: "all" });
    return adaptSearch(raw, this.config.LASSO_COMPANY_ID_PREFIX).rows;
  }

  async company(lassoId: string) {
    return adaptCompany(lassoId, await this.client.company(lassoId));
  }

  async financials(lassoId: string): Promise<FinancialsVM> {
    return adaptFinancials(lassoId, await this.client.reports(lassoId));
  }

  async people(lassoId: string) {
    return adaptPeople(await this.client.company(lassoId));
  }

  async ownership(lassoId: string) {
    return adaptOwnership(lassoId, await this.client.company(lassoId));
  }
}
