import {
  buildActivityHeatmap,
  formatCriterion,
  searchKey,
  type ActivityHeatmapVM,
  type IndustryBenchmarkVM,
  type MapVM,
  type ScoreHistoryVM,
  type AuditorIndependenceVM,
  type ChangeFeedVM,
  type AuditorRelationVM,
  type CompanyRowVM,
  type ContactPersonsVM,
  type ContactVM,
  type Criterion,
  type FinancialsVM,
  type FinancialStatementsVM,
  type LivestockVM,
  type ObservationsVM,
  type OwnershipGraphVM,
  type OwnershipVM,
  type ProductionUnitsVM,
  type PropertiesVM,
  type ScoreVM,
  type SearchQuery,
  type SearchResultVM,
  cvrFromLassoId,
  CREDIT_PENDING_REASON,
  CREDIT_SOURCE,
  isPersonId,
} from "@lasso/spec";
import type { Config } from "../config.js";
import {
  adaptBeneficialOwnership,
  adaptChangeFeed,
  adaptMonitoringItems,
  adaptMonitoringJobs,
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
import { describeShape, LassoApiError, type LassoClient } from "../lasso/client.js";
import { adaptOwnershipLegal, withFallbackPeople } from "../lasso/ownershipAdapters.js";
import { adaptLassoNews, mergeNews } from "../lasso/riskNewsAdapters.js";
import { adaptCompanyEvents } from "../lasso/eventAdapters.js";
import { adaptPerson, adaptPersonNetwork, adaptPersonSearch, graphFromPersonRoles } from "../lasso/personAdapters.js";
import { adaptIndustryBenchmark, adaptMapPoints } from "../lasso/chartAdapters.js";
import { adaptChrLivestock, adaptLiveNumber, adaptReportAnalysisSections, buildProductionUnits } from "../lasso/unitAdapters.js";
import { loadCreditRating } from "../lasso/creditAdapters.js";
import { criteriaToFilters, DEFAULT_ACTIVE_STATUS_FILTER, filtersToCriteria, SERVER_SORT, type LassoFilter } from "../lasso/searchFilters.js";
import { applyCriteria, needsFinancials, sortRows } from "./criteria-eval.js";
import { searchPersonsTable, mapLimit, type ActivityHeatmapOptions, type ChangeFeedOptions, type DataProvider, type OwnershipGraphOptions } from "./provider.js";

/** Så længe venter kontaktblokken på hjemmesidens telefon/e-mail, før den vises uden. */
export const CONTACT_BUDGET_MS = 2_500;

/** Så længe venter tekstsektionerne på regnskabsanalysen, før den udelades (svaret kan tage 5–10 s). */
export const TEXT_SECTIONS_BUDGET_MS = 8_000;

/** Så længe venter kreditvurderingen på Creditsafe (5–45 s ved live beregning), før "beregner stadig" vises. */
export const CREDIT_BUDGET_MS = 12_000;

/**
 * Så længe venter en visning på risikoobservationer, før resten hellere må vises uden. Målt
 * svartid for det største selskab (Novo Nordisk, 27.09.2026): 11,8 s, så budgettet ligger over
 * det. Over budgettet giver en fejl (med "Prøv igen"), i stedet for at hele siden venter; kaldet
 * kører videre i baggrunden og ligger klar i klientens cache til næste forsøg (som CONTACT_BUDGET_MS).
 */
export const OBSERVATIONS_BUDGET_MS = 14_000;

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

  /** Sikrer at CHR-svarets form kun logges én gang pr. kørende server, ikke pr. opslag. */
  private chrShapeLogged = false;

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
    // Ophørte/opløste selskaber kommer ellers med, uden at brugeren bad om dem (P1-5): udelad dem som
    // standard, medmindre brugeren selv har nævnt et statuskriterie (uanset om Lasso kunne oversætte det).
    const hasStatus = q.criteria.some((c) => c.field === "status") || rest.some((c) => c.field === "status");
    const effectiveFilters = hasStatus ? filters : [...filters, DEFAULT_ACTIVE_STATUS_FILTER];
    const serverSort = q.sort ? SERVER_SORT[q.sort.field] : undefined;
    const raw = (await this.client.searchByFilters(effectiveFilters, serverSort)) as { results?: unknown[]; resultsFound?: number; totalPages?: number };
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
    const notes = [
      !hasStatus ? "Kun aktive virksomheder er vist (ophørte, opløste og under konkurs/likvidation er udeladt); nævn status som kriterie for at få dem med." : undefined,
      partial ? `Lasso fandt ${total} virksomheder. ${[...rest.map(formatCriterion), localSort ? "sorteringen" : ""].filter(Boolean).join(", ")} er anvendt på de første ${pool.length}.` : undefined,
    ].filter((n): n is string => Boolean(n));
    return {
      key: searchKey(q),
      total: rest.length > 0 ? filtered.rows.length : total,
      rows: shown,
      unsupportedCriteria: filtered.unsupported.length ? filtered.unsupported : undefined,
      source: "lasso-search",
      note: notes.length ? notes.join(" ") : undefined,
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
   * Live number (kræver egen tilføjelse) hentes parallelt og tilføjer verificerede numre/Robinson,
   * når abonnementet har adgang; 401/403/404 og andre fejl udelades stille (`safe`).
   */
  async contact(lassoId: string): Promise<ContactVM> {
    const companyRaw = await this.client.company(lassoId);
    const co = adaptCompany(lassoId, companyRaw);
    const needsScrape = !(co.phone && co.email && co.website);
    const [websites, contacts, liveNumberRaw] = await Promise.all([
      needsScrape ? safe(() => this.client.websites(lassoId)) : Promise.resolve(undefined),
      needsScrape
        ? withinBudget(safe(() => this.client.contacts(lassoId, { emails: true, phonenumbers: true, links: true })), CONTACT_BUDGET_MS)
        : Promise.resolve(undefined),
      safe(() => this.client.liveNumber(lassoId)),
    ]);
    const base = adaptContact(lassoId, companyRaw, websites, contacts);
    const live = adaptLiveNumber(liveNumberRaw);
    return live ? { ...base, ...live } : base;
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

  /**
   * Legale ejere (katalog 11/09): foretrækker det dokumenterede endpoint GET /{lassoId}/owners/legal
   * (docs/endpoints-ejerskab.md), som også giver `hasOwnersUnderFivePercent`. Svarer det med en
   * 4xx-fejl (eller en anden form, som `adaptOwnershipLegal` ikke kan læse), falder vi tilbage til
   * ejerne i company-full (som i dag). Revisoren er ikke en del af /owners/legal, så den hentes
   * altid fra company-full, som klientens cache deler med resten af virksomhedsopslaget.
   */
  async ownership(lassoId: string): Promise<OwnershipVM> {
    const companyRaw = this.client.company(lassoId);
    try {
      const legal = adaptOwnershipLegal(lassoId, await this.client.ownersLegal(lassoId));
      if (legal) return { ...legal, auditor: adaptOwnership(lassoId, await companyRaw).auditor };
    } catch (err) {
      // Ejerne i company-full er den sikre reserve, uanset om /owners/legal svarer 4xx, 5xx eller slet ikke.
      if (!(err instanceof LassoApiError) || err.status >= 500) console.warn(`[lasso] owners/legal fejlede for ${lassoId}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return adaptOwnership(lassoId, await companyRaw);
  }

  /** Katalog 10: der er endnu ingen bekræftet Lasso-kilde til en 0–100 score. "Ikke oplyst", ikke en fejl. */
  async score(lassoId: string): Promise<ScoreVM> {
    return { lassoId, score: null };
  }

  async beneficialOwnership(lassoId: string) {
    const bo = adaptBeneficialOwnership(lassoId, await this.client.ownersBeneficial(lassoId));
    // 28.9: ledelsen som reelle ejere -> de indsatte personer hentes fra virksomhedens roller.
    if (bo.special?.kind !== "management" || bo.owners.length > 0) return bo;
    try {
      return withFallbackPeople(bo, adaptPeople(await this.client.company(lassoId)));
    } catch {
      return bo;
    }
  }

  /**
   * Katalog 12/19: branche/formål/tegningsregler (CVR) plus regnskabsanalysens sektioner
   * (konklusion, resultat, likviditet m.fl., én pr. felt i `sections`), når svaret kommer inden
   * for TEXT_SECTIONS_BUDGET_MS. Langsomt, tomt eller fejlende svar (401/403/404 m.fl.) udelader
   * blot sektionerne (`safe`/`withinBudget`), aldrig en fejl.
   */
  async textSections(lassoId: string) {
    const [base, analysisRaw] = await Promise.all([
      this.client.company(lassoId).then((raw) => adaptTextSections(lassoId, raw)),
      withinBudget(safe(() => this.client.reportAnalysis(lassoId)), TEXT_SECTIONS_BUDGET_MS),
    ]);
    const analysisSections = analysisRaw === undefined ? [] : adaptReportAnalysisSections(analysisRaw);
    // Analysen genereres ved opslaget (POST), så genereringsdatoen er tidspunktet for svaret.
    return analysisSections.length ? { ...base, sections: [...base.sections, ...analysisSections], analysisGenerated: new Date().toISOString() } : base;
  }

  /** Katalog 28.2/28.6/28.8: fra virksomhedens fulde svar og regnskabsårene. Feltnavne ubekræftede (eventAdapters.ts). */
  async companyEvents(lassoId: string) {
    const [raw, financials] = await Promise.all([this.client.company(lassoId), this.financials(lassoId)]);
    return adaptCompanyEvents(lassoId, raw, financials.years);
  }

  async timeline(lassoId: string) {
    const [co, financials] = await Promise.all([this.client.company(lassoId), this.financials(lassoId)]);
    return adaptTimeline(lassoId, co, adaptPeople(co), financials.years);
  }

  /**
   * Katalog 12: nyheder. Lasso News (POST /modules/news) hentes altid; Paqle (GET
   * /data/paqle/{lassoId}/news) kun når kontoen har adgang til Paqle-tilføjelsen. Fejler den ene
   * kilde (manglende adgang, 4xx/5xx, timeout), vises blot det, den anden kilde leverede - se
   * docs/endpoints-risiko-nyheder.md. Flettet efter tid (nyeste først) og skåret til `limit`.
   */
  async news(lassoId: string, limit: number) {
    // Katalog 16: Lasso News tager alle Lasso-ID'er, også personers. Paqle er mediemonitorering af
    // virksomheder (fremhæver virksomhedens navn) og spørges ikke for en person.
    const person = isPersonId(lassoId);
    const [lassoItems, paqleItems] = await Promise.all([
      safe(() => this.client.lassoNews([lassoId], { limit })).then((raw) => (raw === undefined ? [] : adaptLassoNews(raw))),
      person ? Promise.resolve([]) : safe(() => this.client.news(lassoId)).then((raw) => (raw === undefined ? [] : adaptNews(lassoId, raw, Number.MAX_SAFE_INTEGER).items)),
    ]);
    return mergeNews(
      lassoId,
      [
        { items: lassoItems, label: "Lasso News" },
        { items: paqleItems, label: "Paqle" },
      ],
      limit,
    );
  }

  /**
   * Katalog 17: risikoobservationer (Firmaindsigt). Svarformen er bekræftet mod api.lassox.com
   * 27.09.2026 (docs/endpoints-risiko-nyheder.md). Kaldet kan tage flere sekunder for store
   * selskaber (11,8 s målt for Novo Nordisk); et budget forhindrer, at hele visningen venter så
   * længe - kaldet kører videre i baggrunden og ligger klar i klientens cache til næste forsøg,
   * og RiskObservations.tsx viser sin fejltilstand med "Prøv igen" i stedet. Indirekte
   * observationer under `relatedObservations` (personer OG selskaber) navngives bedst muligt
   * ud fra entitetens eget CVR-opslag.
   */
  async observations(lassoId: string, budgetMs = OBSERVATIONS_BUDGET_MS) {
    const raw = await withinBudget(this.client.observations(lassoId), budgetMs);
    if (raw === undefined) {
      const err = new Error(`Observationer svarede ikke inden for ${Math.round(budgetMs / 1000)} s`);
      err.name = "TimeoutError";
      throw err;
    }
    const vm = adaptObservations(lassoId, raw);
    return this.withRelatedNames(vm);
  }

  /** Bedste forsøg på at navngive de personer og selskaber, `related` (relatedObservations) peger på. */
  private async withRelatedNames(vm: ObservationsVM): Promise<ObservationsVM> {
    if (!vm.related?.length) return vm;
    const toName = vm.related.slice(0, 12);
    const named = await mapLimit(toName, 4, async (entity) => {
      const raw = await safe(() => this.client.company(entity.lassoId));
      const name = raw === undefined ? undefined : str(raw, "name", "fullName", "names.0");
      return name ? { ...entity, name } : entity;
    });
    const byId = new Map(named.map((p) => [p.lassoId, p] as const));
    return { ...vm, related: vm.related.map((p) => byId.get(p.lassoId) ?? p) };
  }

  /**
   * Katalog 17: Creditsafe via Lasso (docs/endpoints-creditsafe.md). Aldrig skipCache: Lassos 24-timers cache og
   * klientens egen cache bruges altid. 401/403 = låst, 404/tomt = ikke beregnet, timeout = beregner stadig.
   */
  async creditRating(lassoId: string) {
    // Creditsafe kan tage 5–45 s, når vurderingen beregnes live. Visningen venter højst CREDIT_BUDGET_MS;
    // derefter vises "beregner stadig" med "Hent igen", mens kaldet kører færdigt og lander i klientens cache.
    const rating = await withinBudget(loadCreditRating(lassoId, (cvr) => this.client.creditsafeRating(cvr)), CREDIT_BUDGET_MS);
    return rating ?? { lassoId, cvr: cvrFromLassoId(lassoId) ?? undefined, state: "unavailable" as const, reason: CREDIT_PENDING_REASON, source: CREDIT_SOURCE };
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

  /**
   * Katalog 20. Company-fulds bekræftede `productionUnits: [{ lassoId, pNumber }]` giver
   * referencerne; op til 25 enheder hentes med fulde detaljer parallelt (`buildProductionUnits`,
   * mapLimit 5). De gamle feltnavne-gæt (`adaptProductionUnits`) bruges som reserve, hvis feltet
   * mangler, eller for enheder detaljeopslaget ikke selv fandt et P-nummer for.
   */
  async productionUnits(lassoId: string): Promise<ProductionUnitsVM> {
    const companyRaw = await this.client.company(lassoId);
    const legacy = adaptProductionUnits(lassoId, companyRaw).units;
    return buildProductionUnits(lassoId, companyRaw, legacy, (unitLassoId) => this.client.productionUnit(unitLassoId));
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
   * Katalog 20. CHR-opslaget kræver virksomhedens CVR-nummer (ikke Lasso-ID'et) og "Ejendomme"-
   * modulet i abonnementet; 401/403/404 giver en tom, forklaret tilstand i stedet for en fejl.
   * Svarformen er IKKE dokumenteret (se docs/endpoints-enheder-kontakt-analyse.md); formen logges
   * med describeShape på debug-niveau (LOG_LEVEL=debug), én gang, så adapteren kan rettes til.
   */
  async livestock(lassoId: string): Promise<LivestockVM> {
    const co = await this.company(lassoId);
    if (!co.cvr) return { lassoId, herds: [], events: [] };
    let raw: unknown;
    try {
      raw = await this.client.chrLivestock(co.cvr);
    } catch (err) {
      if (err instanceof LassoApiError && [401, 403, 404].includes(err.status)) {
        return { lassoId, herds: [], events: [], unavailableReason: "Kræver Ejendomme-modulet i Lasso-abonnementet" };
      }
      throw err;
    }
    if (!this.chrShapeLogged && this.config.LOG_LEVEL === "debug") {
      this.chrShapeLogged = true;
      console.debug("[lasso-chr] svarform for GET /data/CHR/livestock:", JSON.stringify(describeShape(raw, 4)));
    }
    return adaptChrLivestock(lassoId, raw);
  }

  async ownershipGraph(lassoId: string, opts: OwnershipGraphOptions) {
    if (isPersonId(lassoId)) return this.personOwnershipGraph(lassoId, opts);
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
   * Katalog 16: personens ejerskaber som ejergraf med personen som rod (POST /modules/relations/graph
   * med personens ID og ingoingDepth 0). Grafen navngiver ikke roden, så navnet kommer fra
   * personopslaget (samme cachede kald som personhovedet). Afviser endpointet et person-ID
   * (400/404/405/501), vises de direkte ejerskaber fra personens ejerroller (ét lag, med en note).
   * UBEKRÆFTET mod API'et for person-ID'er (kun virksomheds-ID'er er afprøvet).
   */
  private async personOwnershipGraph(lassoId: string, opts: OwnershipGraphOptions): Promise<OwnershipGraphVM> {
    const depth = { ingoingDepth: 0, outgoingDepth: opts.outgoingDepth, ...(opts.onDate ? { onDate: opts.onDate } : {}) };
    const personP = this.person(lassoId).catch(() => undefined);
    let graph: OwnershipGraphVM;
    try {
      const raw = await this.client.relationsGraph({ ids: [lassoId], ...depth });
      graph = await this.nameGraphNodes(adaptOwnershipGraph(lassoId, raw, depth));
    } catch (err) {
      if (!(err instanceof LassoApiError) || ![400, 404, 405, 501].includes(err.status)) throw err;
      const person = await personP;
      if (!person) throw err;
      return graphFromPersonRoles(person, depth);
    }
    const person = await personP;
    return {
      ...graph,
      // En person har ingen ejere i dette diagram; roden er altid en person (pille) med personens navn.
      edges: graph.edges.filter((e) => e.to !== lassoId),
      nodes: graph.nodes.map((n) => (n.id === lassoId ? { ...n, kind: "person" as const, name: person?.name ?? n.name, root: true } : n)),
    };
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

  async personSearch(query: string, limit: number) {
    return searchPersonsTable(this, query, limit);
  }

  async findPersons(name: string, limit: number) {
    const raw = await this.client.search({ query: name, type: "person", pageSize: limit, personStatus: "all", companyStatus: "all" });
    return adaptPersonSearch(raw).slice(0, limit);
  }

  /**
   * Katalog 21. UBEKRÆFTET (docs/lasso-endpoints.md, "Ubekræftet: overvågningsfeed"): overvågningsjobbet
   * (listen) findes med GET /apps/monitoring/jobs, dets virksomheder med /jobs/{id}/items, og ændringerne
   * hentes fra delta-listen GET /data/cvr/companies/delta/history for perioden og filtreres til de
   * overvågede. Findes ingen overvågningsliste, er det en tom tilstand med forklaring, ikke en fejl.
   */
  async changeFeed(opts: ChangeFeedOptions): Promise<ChangeFeedVM> {
    return this.monitoredChanges(opts, 90);
  }

  /** Fælles for ændringsfeedet (maks 90 dage) og heatmappet (13.11, op til 24 måneder). */
  private async monitoredChanges(opts: ChangeFeedOptions, maxDays: number): Promise<ChangeFeedVM> {
    const days = Math.max(1, Math.min(maxDays, opts.days));
    const jobs = adaptMonitoringJobs(await this.client.monitoringJobs().catch((err: unknown) => {
      if (err instanceof LassoApiError && [400, 404, 405, 501].includes(err.status)) return [];
      throw err;
    }));
    const wanted = opts.list?.trim().toLowerCase();
    const job = wanted ? jobs.find((j) => (j.name ?? "").trim().toLowerCase() === wanted) : jobs[0];
    if (!job) {
      const reason = wanted ? `Der er ingen overvågningsliste med navnet "${opts.list}".` : "Der overvåges ingen virksomheder endnu.";
      return { listName: opts.list, days, entries: [], total: 0, emptyReason: reason };
    }
    const monitored = new Set<string>();
    let token: string | undefined;
    for (let page = 0; page < 20; page++) {
      const items = adaptMonitoringItems(await this.client.monitoringItems(job.id, 500, token));
      items.ids.forEach((id) => monitored.add(id));
      token = items.continuationToken;
      if (!token || items.ids.length === 0) break;
    }
    const now = new Date();
    const since = new Date(now.getTime() - days * 86_400_000).toISOString();
    const results: unknown[] = [];
    let cToken: string | undefined;
    for (let page = 0; page < 20; page++) {
      const raw = (await this.client.companyUpdates({ since, pageSize: 100, cToken })) as { results?: unknown[]; continuationToken?: string; hasNextPage?: boolean };
      results.push(...(raw.results ?? []));
      cToken = raw.continuationToken;
      if (!raw.hasNextPage || !cToken) break;
    }
    const feed = adaptChangeFeed(results, { listName: job.name ?? opts.list, days, types: opts.types, monitored, now });
    return feed.entries.length ? feed : { ...feed, emptyReason: `Ingen ændringer i "${feed.listName ?? "overvågningen"}" de seneste ${days} dage.` };
  }
  /** Katalog 18.2: ingen bekræftet Lasso-kilde til en 0–100 score, derfor heller ingen historik. Tom med årsag, ikke en fejl. */
  async scoreHistory(lassoId: string): Promise<ScoreHistoryVM> {
    return { lassoId, points: [], reason: "Lasso har endnu ingen score for virksomheden, så der er ingen historik at vise." };
  }

  /**
   * Katalog 13.6/13.10. UBEKRÆFTET (docs/lasso-endpoints.md, "Ubekræftet: branchetal"): branchens
   * nøgletal hentes med GET /data/cvr/industries/{DB07-kode}/keyfigures. Svarer Lasso 4xx, eller
   * kender vi ikke branchekoden, er det "unavailable" med årsag (tom tilstand), ikke en fejl.
   */
  async industryBenchmark(lassoId: string): Promise<IndustryBenchmarkVM> {
    const co = adaptCompany(lassoId, await this.client.company(lassoId));
    const industryCode = co.industryCode;
    if (!industryCode) return { lassoId, state: "unavailable", reason: "Virksomheden har ingen registreret branchekode.", years: [] };
    try {
      const raw = await this.client.get(`/data/cvr/industries/${encodeURIComponent(industryCode)}/keyfigures`);
      return adaptIndustryBenchmark(lassoId, raw, { industryCode, industryText: co.industryText });
    } catch (err) {
      if (err instanceof LassoApiError && err.status < 500) {
        return { lassoId, state: "unavailable", reason: "Lasso har ingen branchetal for virksomhedens branche endnu.", industryCode, industryText: co.industryText, years: [] };
      }
      throw err;
    }
  }

  /** Katalog 13.11: samme ubekræftede kilde som ændringsfeedet, lagt i måneder (op til 24 måneder tilbage). */
  async activityHeatmap(opts: ActivityHeatmapOptions): Promise<ActivityHeatmapVM> {
    const months = Math.max(3, Math.min(24, opts.months));
    const feed = await this.monitoredChanges({ list: opts.list, days: months * 31, types: opts.types }, 24 * 31);
    return buildActivityHeatmap(feed.entries, {
      months,
      types: opts.types,
      listName: feed.listName,
      source: "CVR via Lasso",
      updated: new Date().toISOString().slice(0, 10),
      emptyReason: feed.entries.length ? undefined : feed.emptyReason,
    });
  }

  /**
   * Katalog 13.12. UBEKRÆFTET (docs/lasso-endpoints.md, "Ubekræftet: koordinater"): WGS84-koordinater
   * læses defensivt fra virksomhedens og produktionsenhedernes adresseobjekter i CVR-svaret. Mangler
   * de, er kortet tomt med årsag.
   */
  async mapPoints(lassoId: string): Promise<MapVM> {
    const raw = await this.client.company(lassoId);
    const units = arr(raw, "productionUnits", "produktionsenheder", "units", "secondaryUnits", "establishments");
    return adaptMapPoints(lassoId, raw, units);
  }
}
