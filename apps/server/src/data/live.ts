import {
  formatCriterion,
  searchKey,
  type AuditorIndependenceVM,
  type AuditorRelationVM,
  type CompanyRowVM,
  type ContactPersonsVM,
  type ContactVM,
  type Criterion,
  type FinancialsVM,
  type FinancialStatementsVM,
  type LivestockVM,
  type OwnershipGraphVM,
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
  adaptContact,
  adaptContactPersons,
  adaptFinancials,
  adaptFinancialStatements,
  adaptNews,
  adaptObservations,
  adaptOwnership,
  adaptPeople,
  adaptProductionUnits,
  adaptProperties,
  adaptSearch,
  adaptTextSections,
  adaptTimeline,
  arr,
  ejfBbrRefs,
  str,
  mergeBbr,
  adaptOwnershipGraph,
  applyGraphNames,
  graphFromOwnership,
  participantNames,
} from "../lasso/adapters.js";
import { LassoApiError, type LassoClient } from "../lasso/client.js";
import { adaptPerson, adaptPersonNetwork, adaptPersonSearch } from "../lasso/personAdapters.js";
import { criteriaToFilters, filtersToCriteria, SERVER_SORT, type LassoFilter } from "../lasso/searchFilters.js";
import { applyCriteria, needsFinancials, sortRows } from "./criteria-eval.js";
import { mapLimit, type DataProvider, type OwnershipGraphOptions } from "./provider.js";

/** Så længe venter kontaktblokken på hjemmesidens telefon/e-mail, før den vises uden. */
export const CONTACT_BUDGET_MS = 2_500;

/** Venter højst `ms` på et løfte; derefter undefined (løftet kører videre og fylder klientens cache). */
async function withinBudget<T>(p: Promise<T | undefined>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  try {
    return await Promise.race([p, budget]);
  } finally {
    clearTimeout(timer);
  }
}

/** Markør for "virksomheden har ingen brugbar hjemmeside" fra kontaktendpointet. */
const NO_WEBSITE = Symbol("no-website");
const NO_WEBSITE_REASON = "Virksomheden har ingen hjemmeside, Lasso kan hente kontaktpersoner fra.";

/** Så mange virksomheder hentes, når noget skal filtreres eller sorteres her (omsætning, bruttofortjeneste). */
const LOCAL_POOL = 60;

/** Kalder en (evt. defekt eller manglende) klientmetode og giver undefined ved enhver fejl, også en synkron. */
async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

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

  /** Én søgerække ud fra virksomhed og regnskab (kun CVR-stamdata; rækker skal ikke bruge kontaktoplysninger). */
  private async row(lassoId: string): Promise<CompanyRowVM> {
    const [co, f] = await Promise.all([
      this.company(lassoId).catch(() => null),
      this.financials(lassoId).catch(() => ({ lassoId, currency: "DKK", years: [] }) as FinancialsVM),
    ]);
    const currency = f.years.at(-1)?.currency ?? f.currency;
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
      ...(currency && currency !== "DKK" ? { currency } : {}),
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
          const currency = last?.currency ?? f.currency;
          return {
            ...row,
            ...(currency && currency !== "DKK" ? { currency } : {}),
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

  /**
   * Stamdata fra CVR (GET /{lassoId}) og intet andet, så virksomhedsopslaget er hurtigt (0,2–2 s).
   * Kontaktendpoints (websites/contacts) scraper hjemmesiden og tager 10+ s; de kaldes kun fra
   * contact()/contactPersons(), og resolveSpec fylder telefon/e-mail/web ind derfra, når
   * visningen alligevel henter kontaktblokken.
   */
  async company(lassoId: string) {
    return adaptCompany(lassoId, await this.client.company(lassoId));
  }

  /**
   * Katalog 08: kontaktblok. CVR først; hjemmesidens kontaktdata kun, når CVR mangler noget.
   * Den scrapende telefon/e-mail-opslag får højst CONTACT_BUDGET_MS: er den ikke færdig, vises
   * CVR og hjemmeside nu, og kaldet kører færdigt i baggrunden og ligger i cachen til næste gang.
   */
  async contact(lassoId: string): Promise<ContactVM> {
    const companyRaw = await this.client.company(lassoId);
    const co = adaptCompany(lassoId, companyRaw);
    if (co.phone && co.email && co.website) return adaptContact(lassoId, companyRaw, undefined, undefined);
    const [websites, contacts] = await Promise.all([
      safe(() => this.client.websites(lassoId)),
      withinBudget(safe(() => this.client.contacts(lassoId, { emails: true, phonenumbers: true, links: true })), CONTACT_BUDGET_MS),
    ]);
    return adaptContact(lassoId, companyRaw, websites, contacts);
  }

  /**
   * Katalog 08: kontaktpersoner fra virksomhedens hjemmeside. Svarformen er ubekræftet, se
   * docs/lasso-endpoints.md. Har virksomheden ingen brugbar hjemmeside (Lasso svarer 400
   * "None of company's webpages were valid" eller 404), er det en tom tilstand, ikke en fejl.
   */
  async contactPersons(lassoId: string): Promise<ContactPersonsVM> {
    const [raw, websites] = await Promise.all([
      this.client.contacts(lassoId, { contacts: true }).catch((err: unknown) => {
        if (err instanceof LassoApiError && (err.status === 400 || err.status === 404)) return NO_WEBSITE;
        throw err;
      }),
      safe(() => this.client.websites(lassoId)),
    ]);
    if (raw === NO_WEBSITE) return { lassoId, people: [], emptyReason: NO_WEBSITE_REASON };
    const vm = adaptContactPersons(lassoId, raw);
    if (vm.people.length === 0 && websites !== undefined && arr(websites, "urls").length === 0 && !str(websites, "url")) {
      return { ...vm, emptyReason: NO_WEBSITE_REASON };
    }
    return vm;
  }

  async financials(lassoId: string): Promise<FinancialsVM> {
    return adaptFinancials(lassoId, await this.client.reports(lassoId));
  }

  /** Katalog 19: samme endpoint som `financials` (klienten cacher svaret, så det ikke hentes to gange). */
  async financialStatements(lassoId: string): Promise<FinancialStatementsVM> {
    return adaptFinancialStatements(lassoId, await this.client.reports(lassoId));
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
      return await this.nameGraphNodes(adaptOwnershipGraph(lassoId, raw, opts));
    } catch (err) {
      // Findes endpointet ikke (eller afviser det formen), vises i det mindste de direkte ejere.
      if (!(err instanceof LassoApiError) || ![400, 404, 405, 501].includes(err.status)) throw err;
      const raw = await this.client.company(lassoId);
      return graphFromOwnership(lassoId, adaptCompany(lassoId, raw).name, adaptOwnership(lassoId, raw), opts);
    }
  }

  /**
   * Ejergrafens "companyinfo"-berigelse giver kun selskaber navn; personer og udenlandske
   * enheder kommer som "CVR-3-…". Navn og type slås op i CVR-opslaget for de selskaber, de
   * ejer (ejerlisten har navn og type; ofte allerede i cachen), og ellers på deltagerens
   * eget ID. Højst 12 opslag af hver slags, 4 ad gangen; et fejlet opslag efterlader ID'et.
   */
  private async nameGraphNodes(g: OwnershipGraphVM): Promise<OwnershipGraphVM> {
    const nameless = new Set(g.nodes.filter((n) => n.name === n.id && !n.root).map((n) => n.id));
    if (nameless.size === 0) return g;
    const names = new Map<string, { name: string; type?: string }>();
    const owned = [...new Set(g.edges.filter((e) => nameless.has(e.from)).map((e) => e.to))].slice(0, 12);
    await mapLimit(owned, 4, async (id) => {
      const raw = await safe(() => this.client.company(id));
      if (raw === undefined) return;
      for (const [pid, hit] of participantNames(raw)) if (nameless.has(pid) && !names.has(pid)) names.set(pid, hit);
    });
    const rest = [...nameless].filter((id) => !names.has(id)).slice(0, 12);
    await mapLimit(rest, 4, async (id) => {
      const raw = await safe(() => this.client.person(id));
      const name = raw === undefined ? undefined : str(raw, "name", "fullName", "names.0");
      if (name) names.set(id, { name, type: str(raw, "type", "entityType") });
    });
    return applyGraphNames(g, names);
  }

  /**
   * Katalog 16. Nuværende roller fra GET /{lassoId}, fra–til fra /{lassoId}/history.
   * Svarformerne er ubekræftede (docs/lasso-endpoints.md); fejler historikken, vises de nuværende roller.
   */
  async person(lassoId: string) {
    const [current, history] = await Promise.all([this.client.person(lassoId), this.client.personHistory(lassoId).catch(() => undefined)]);
    return adaptPerson(lassoId, current, history);
  }

  async personNetwork(lassoId: string) {
    return adaptPersonNetwork(lassoId, await this.client.personNetwork(lassoId));
  }

  async findPersons(name: string, limit: number) {
    const raw = await this.client.search({ query: name, type: "person", pageSize: limit, personStatus: "all", companyStatus: "all" });
    return adaptPersonSearch(raw).slice(0, limit);
  }
}
