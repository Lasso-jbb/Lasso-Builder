import {
  formatCriterion,
  searchKey,
  type AuditorIndependenceVM,
  type AuditorRelationVM,
  type CompanyRowVM,
  type Criterion,
  type FinancialsVM,
  type LivestockVM,
  type ProductionUnitsVM,
  type PropertiesVM,
  type ScoreVM,
  type SearchQuery,
  type SearchResultVM,
} from "@lasso/spec";
import type { Config } from "../config.js";
import {
  adaptBeneficialOwnership,
  adaptCompany,
  adaptFinancials,
  adaptNews,
  adaptObservations,
  adaptOwnership,
  adaptPeople,
  adaptProductionUnits,
  adaptProperties,
  adaptSearch,
  adaptTextSections,
  adaptTimeline,
  ejfBbrRefs,
  mergeBbr,
  adaptOwnershipGraph,
  graphFromOwnership,
} from "../lasso/adapters.js";
import { LassoApiError, type LassoClient } from "../lasso/client.js";
import { criteriaToFilters, filtersToCriteria, SERVER_SORT, type LassoFilter } from "../lasso/searchFilters.js";
import { applyCriteria, needsFinancials, sortRows } from "./criteria-eval.js";
import { mapLimit, type DataProvider, type OwnershipGraphOptions } from "./provider.js";

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

  /** Katalog 10: der er endnu ingen bekræftet Lasso-kilde til en 0–100 score. "Ikke oplyst", ikke en fejl. */
  async score(lassoId: string): Promise<ScoreVM> {
    return { lassoId, score: null };
  }

  async beneficialOwnership(lassoId: string) {
    return adaptBeneficialOwnership(lassoId, await this.client.ownersBeneficial(lassoId));
  }

  async textSections(lassoId: string) {
    return adaptTextSections(lassoId, await this.client.company(lassoId));
  }

  async timeline(lassoId: string) {
    const [co, financials] = await Promise.all([this.client.company(lassoId), this.financials(lassoId)]);
    return adaptTimeline(lassoId, co, adaptPeople(co), financials.years);
  }

  async news(lassoId: string, limit: number) {
    return adaptNews(lassoId, await this.client.news(lassoId), limit);
  }

  /** Formen for /modules/observations er ubekræftet; se docs/lasso-endpoints.md. */
  async observations(lassoId: string) {
    return adaptObservations(lassoId, await this.client.observations(lassoId));
  }

  /**
   * Revisoruafhængighed har ingen bekræftet, dedikeret kilde endnu. Vi bygger, hvad
   * de bekræftede data tillader: revisor fra CVR (accounting.accountant), kundens
   * egen ledelse/bestyrelse og ejerkreds, og – hvis revisors eget Lasso-ID kendes –
   * revisionshusets egne ansatte/ledelse. En relation vises kun ved et navnesammenfald
   * mellem de to. Det dækker IKKE relationer via andre selskaber, historiske
   * tilknytninger eller partnerskabsniveau; det kræver Lassos ejer-/relationsgraf
   * (POST /modules/relations/graph), som denne komponent endnu ikke kalder.
   */
  async auditorIndependence(lassoId: string): Promise<AuditorIndependenceVM> {
    const [ownership, people] = await Promise.all([this.ownership(lassoId), this.people(lassoId)]);
    const auditor = ownership.auditor;
    const checkedAt = new Date().toISOString().slice(0, 10);
    if (!auditor) {
      return { lassoId, checkedAt, relations: [], unavailableReason: "Virksomheden har ikke en registreret revisor i CVR." };
    }
    let auditorPeople: Awaited<ReturnType<LiveProvider["people"]>> = [];
    if (auditor.lassoId) {
      try {
        auditorPeople = await this.people(auditor.lassoId);
      } catch {
        // Revisors Lasso-ID er ikke nødvendigvis en virksomhed, vi har adgang til; fortsæt uden.
      }
    }
    const clientNames = new Set([...people.map((p) => p.name), ...ownership.owners.map((o) => o.name)].map((n) => n.toLowerCase()));
    const relations: AuditorRelationVM[] = auditorPeople
      .filter((p) => clientNames.has(p.name.toLowerCase()))
      .map((p, i) => ({
        id: `${lassoId}-${i}`,
        assessment: 50,
        name: p.name,
        role: `${p.role}, ${auditor.name}`,
        relation: "Personen indgår i kundens ledelse eller ejerkreds og er samtidig tilknyttet revisionshuset",
        via: undefined,
        from: p.from,
        to: p.to,
      }));
    return {
      lassoId,
      auditorName: auditor.name,
      checkedAt,
      relations,
      unavailableReason:
        "Kun direkte navnesammenfald mellem kundens ledelse/ejere og revisionshusets egne ansatte er tjekket. Relationer via andre selskaber eller på partnerskabsniveau kræver Lassos relationsgraf, som endnu ikke er koblet til.",
    };
  }

  /** Katalog 20. Genbruger CVR-svaret; UBEKRÆFTET om det indeholder produktionsenheder (docs/lasso-endpoints.md). */
  async productionUnits(lassoId: string): Promise<ProductionUnitsVM> {
    return adaptProductionUnits(lassoId, await this.client.company(lassoId));
  }

  /**
   * Katalog 20. Ejerfortegnelsen (`ejf`) giver ejendommene; BBR beriger med
   * bygninger og arealer, når vi kan udlede et property-/kommunenummer.
   * Begge svarformer er UBEKRÆFTEDE (docs/lasso-endpoints.md).
   */
  async properties(lassoId: string): Promise<PropertiesVM> {
    const raw = await this.client.ejf(lassoId);
    const base = adaptProperties(lassoId, raw);
    const refs = ejfBbrRefs(raw);
    const pairs = base.properties.map((property, i) => [property, refs[i]] as const);
    const properties = await mapLimit(pairs, 3, async ([property, ref]) => {
      if (!ref?.bfeNumber) return property;
      try {
        const bbr = await this.client.bbrSummary(ref.bfeNumber);
        return mergeBbr(property, bbr);
      } catch {
        return property;
      }
    });
    return { lassoId, properties };
  }

  /**
   * Katalog 20. CHR-endpointet er UBEKRÆFTET og ikke fundet i docs.lassox.com
   * under dette arbejde (se docs/lasso-endpoints.md). Der kaldes derfor intet
   * endpoint her; komponenten viser sin tom-tilstand med en forklarende årsag.
   */
  async livestock(lassoId: string): Promise<LivestockVM> {
    return { lassoId, herds: [], events: [] };
  }

  async ownershipGraph(lassoId: string, opts: OwnershipGraphOptions) {
    try {
      const raw = await this.client.relationsGraph({ ids: [lassoId], ingoingDepth: opts.ingoingDepth, outgoingDepth: opts.outgoingDepth, onDate: opts.onDate });
      return adaptOwnershipGraph(lassoId, raw, opts);
    } catch (err) {
      // Findes endpointet ikke (eller afviser det formen), vises i det mindste de direkte ejere.
      if (!(err instanceof LassoApiError) || ![400, 404, 405, 501].includes(err.status)) throw err;
      const raw = await this.client.company(lassoId);
      return graphFromOwnership(lassoId, adaptCompany(lassoId, raw).name, adaptOwnership(lassoId, raw), opts);
    }
  }
}
