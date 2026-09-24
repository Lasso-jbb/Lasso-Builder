import { searchKey, type FinancialsVM, type SearchQuery, type SearchResultVM } from "@lasso/spec";
import type { Config } from "../config.js";
import { adaptCompany, adaptFinancials, adaptOwnership, adaptPeople, adaptSearch } from "../lasso/adapters.js";
import type { LassoClient } from "../lasso/client.js";
import { applyCriteria, needsFinancials, sortRows } from "./criteria-eval.js";
import { mapLimit, type DataProvider } from "./provider.js";

/**
 * Går direkte på Lassos rigtige API. Søgning med kriterier er "klodset
 * bagved" i MVP'en: fritekstsøgning hos Lasso, derefter filtrering og
 * sortering her. Kan API'et filtrere serverside, flyttes det dertil.
 */
export class LiveProvider implements DataProvider {
  readonly kind = "live" as const;

  constructor(
    private readonly client: LassoClient,
    private readonly config: Config,
  ) {}

  async search(q: SearchQuery): Promise<SearchResultVM> {
    const statusCriterion = q.criteria.find((c) => c.field === "status" && c.operator === "eq");
    const companyStatus = statusCriterion && String(statusCriterion.value).toLowerCase() !== "aktiv" ? "all" : "active";
    const wantsFinancials = needsFinancials(q);
    const pageSize = wantsFinancials || q.criteria.length > 0 ? Math.max(50, q.limit) : q.limit;

    const raw = await this.client.search({ query: q.query, type: "company", pageSize, companyStatus });
    const { total, rows } = adaptSearch(raw, this.config.LASSO_COMPANY_ID_PREFIX);

    // Berig med regnskabstal, så kriterier, sortering og sparklines virker.
    const enrich = async (list: typeof rows) =>
      mapLimit(list, 6, async (row) => {
        try {
          const f = await this.financials(row.lassoId);
          const last = f.years.at(-1);
          return {
            ...row,
            revenue: row.revenue ?? last?.revenue ?? null,
            grossProfit: row.grossProfit ?? last?.grossProfit ?? null,
            profit: row.profit ?? last?.profit ?? null,
            employees: row.employees ?? last?.employees ?? null,
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
    };
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
