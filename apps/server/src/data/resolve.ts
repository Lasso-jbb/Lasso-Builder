import {
  activityHeatmapKey,
  changeFeedDays,
  changeFeedKey,
  emptyDataset,
  entityRefOf,
  isPersonId,
  personTimeline,
  savedPagesKey,
  searchKey,
  personSearchKey,
  toLassoId,
  type Dataset,
  type SavedPageKind,
  type SavedPagesVM,
  type ViewComponent,
  type ViewSpec,
  ownershipGraphKey,
} from "@lasso/spec";
import { LassoApiError } from "../lasso/client.js";
import { isEntityId } from "../web/links.js";
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
  scoreHistory: async (ds, p, id) => void (ds.scoreHistories[id] = await p.scoreHistory(id)),
  industryBenchmark: async (ds, p, id) => void (ds.industryBenchmarks[id] = await p.industryBenchmark(id)),
  mapPoints: async (ds, p, id) => void (ds.maps[id] = await p.mapPoints(id)),
  beneficialOwnership: async (ds, p, id) => void (ds.beneficialOwnership[id] = await p.beneficialOwnership(id)),
  textSections: async (ds, p, id) => void (ds.textSections[id] = await p.textSections(id)),
  // Katalog 16: personens historik afledes af rollerne (samme cachede personopslag som hovedet).
  timeline: async (ds, p, id) => void (ds.timeline[id] = isPersonId(id) ? personTimeline(await p.person(id)) : await p.timeline(id)),
  observations: async (ds, p, id) => void (ds.observations[id] = await p.observations(id)),
  creditRating: async (ds, p, id) => void (ds.creditRatings[id] = await p.creditRating(id)),
  valuation: async (ds, p, id) => void (ds.valuations[id] = await p.valuation(id)),
  resume: async (ds, p, id) => void (ds.resumes[id] = await p.resume(id)),
  auditorIndependence: async (ds, p, id) => void (ds.auditorIndependence[id] = await p.auditorIndependence(id)),
  productionUnits: async (ds, p, id) => void (ds.productionUnits[id] = await p.productionUnits(id)),
  properties: async (ds, p, id) => void (ds.properties[id] = await p.properties(id)),
  livestock: async (ds, p, id) => void (ds.livestock[id] = await p.livestock(id)),
  person: async (ds, p, id) => void (ds.persons[id] = await p.person(id)),
  personNetwork: async (ds, p, id) => void (ds.personNetworks[id] = await p.personNetwork(id)),
  companyEvents: async (ds, p, id) => void (ds.companyEvents[id] = await p.companyEvents(id)),
  companyHistory: async (ds, p, id) => void (ds.companyHistories[id] = await p.companyHistory(id)),
};

/**
 * Data, der ikke kommer fra Lasso, men fra serverens egne lagre og kræver en bruger (gem-laget,
 * docs/gem-lag.md). Offentlige sider uden bruger (/k/, /p/, /e/, /v/) sender ingen extras.
 */
export interface ResolveExtras {
  /** Gem-laget: henter brugerens gemte sider til LassoSavedPages. */
  savedPages?: (opts: { kind: SavedPageKind | "all"; limit: number }) => Promise<SavedPagesVM>;
  /** Gem-laget: hvilke af visningens virksomheds-/person-ID'er der er gemt (til Gem/Gemt-knappen). */
  savedIds?: (lassoIds: readonly string[]) => Promise<string[]>;
}

/**
 * Fejlteksten for LassoSavedPages uden bruger (fx en delt side). Ordet "adgang" gør, at UI'en viser
 * den som tom tilstand og ikke som en rød fejl (stateForError i packages/ui).
 */
export const SAVED_PAGES_NO_USER = "Gemte sider kræver adgang som bruger og vises ikke på en delt side.";

/** Visningens virksomheds- og person-ID'er (company, companies[], benchmark, person), uden dubletter. */
export function entityIdsOf(spec: ViewSpec): string[] {
  const ids = new Set<string>();
  for (const c of spec.components) {
    const x = c as { company?: unknown; companies?: unknown; benchmark?: unknown; person?: unknown };
    for (const v of [x.company, x.benchmark, x.person, ...(Array.isArray(x.companies) ? x.companies : [])]) {
      if (typeof v === "string" && v) ids.add(v);
    }
  }
  return [...ids];
}

/**
 * Alle virksomheds- og person-ID'er i et datasæt (CVR-1-<8 cifre>, CVR-3-/CVR-4-…), dvs. alle navne,
 * siden kan vise som links: personer i ledelsen, ejere, revisor, reelle ejere, ejergrafens noder,
 * personers roller og netværk, søgeresultater, ændringsfeeds og navnene i nyheder og tekstsektioner
 * (segmenter med lassoId). Læser hele datasættet generisk (strengværdier og nøgler), så nye felter
 * med ID'er kommer med af sig selv; fejlteksterne springes over. Bruges til de delte siders links.
 */
export function datasetEntityIds(ds: Dataset): string[] {
  const ids = new Set<string>();
  const visit = (v: unknown, depth: number): void => {
    if (depth > 12) return;
    if (typeof v === "string") {
      if (isEntityId(v)) ids.add(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (depth === 0 && (k === "errors" || k === "savedPages" || k === "savedIds")) continue;
        if (isEntityId(k)) ids.add(k);
        visit(x, depth + 1);
      }
    }
  };
  visit(ds, 0);
  return [...ids];
}

/** Normaliserer alle virksomhedsreferencer i specen til Lasso-ID'er. */
export function normalizeSpec(spec: ViewSpec, companyPrefix: string): ViewSpec {
  const fix = (ref: string) => toLassoId(ref, companyPrefix);
  const components = spec.components.map((c): ViewComponent => {
    if (c.type === "LassoLineChart") return { ...c, company: fix(c.company), benchmark: c.benchmark ? fix(c.benchmark) : undefined };
    // Tidslinje, nyheder og ejerdiagram kan gælde en person i stedet (ingen company).
    if ("company" in c && typeof c.company === "string") return { ...c, company: fix(c.company) };
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
 * `extras` giver brugerbundne data (gemte sider); uden dem får LassoSavedPages en tom tilstand.
 */
export async function resolveSpec(spec: ViewSpec, provider: DataProvider, extras: ResolveExtras = {}): Promise<Dataset> {
  const ds = emptyDataset(provider.kind);
  const needs = new Map<string, Set<Need>>();
  const want = (id: string, ...n: Need[]) => {
    const s = needs.get(id) ?? new Set<Need>();
    n.forEach((x) => s.add(x));
    needs.set(id, s);
  };
  const searches: Extract<ViewComponent, { type: "LassoCompanyTable" }>["search"][] = [];
  const personSearches: Extract<ViewComponent, { type: "LassoPersonTable" }>[] = [];
  const newsWanted = new Map<string, number>();
  const graphs: Extract<ViewComponent, { type: "LassoOwnershipDiagram" }>[] = [];
  const feeds: Extract<ViewComponent, { type: "LassoChangeFeed" }>[] = [];
  const savedLists: Extract<ViewComponent, { type: "LassoSavedPages" }>[] = [];
  const heatmaps: Extract<ViewComponent, { type: "LassoHeatmap" }>[] = [];

  for (const c of spec.components) {
    switch (c.type) {
      case "LassoCompanyHead":
        // Valuation (Jakob 02.10) hentes med siden, så rækken står i virksomhedsoplysningerne.
        want(c.company, "company", "valuation");
        // `risk` er udgået (G9): hovedet viser ingen observationslinje, så observationerne (10–14 s) hentes ikke.
        break;
      case "LassoShortcuts":
        // 08.4: genvejene har ingen egne data; navnet bruges i beskeden til værten.
        want(c.company, "company");
        break;
      case "LassoKeyFigureCards":
      case "LassoBarChart":
      case "LassoGroupedBarChart":
        want(c.company, "financials");
        break;
      case "LassoStackedBarChart":
      case "LassoWaterfallChart":
        // 13.5/13.7: balancens og resultatopgørelsens underposter fra det fulde regnskab, når de findes.
        want(c.company, "financials", "financialStatements");
        break;
      case "LassoShareBars":
        want(c.company, c.variant === "ejerkreds" ? "ownership" : "financials");
        break;
      case "LassoLineChart":
        want(c.company, "financials");
        // 13.6: med sammenligning står virksomhedens navn i legenden, så stamdata hentes også.
        if (c.industry || c.benchmark) want(c.company, "company");
        if (c.industry) want(c.company, "industryBenchmark");
        else if (c.benchmark) want(c.benchmark, "company", "financials");
        break;
      case "LassoKeyFigureGauge":
        want(c.company, "financials", "industryBenchmark");
        break;
      case "LassoMap":
        want(c.company, "mapPoints");
        break;
      case "LassoHeatmap":
        heatmaps.push(c);
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
        want(c.company, "people", "ownership", ...(c.full ? (["beneficialOwnership", "productionUnits"] as const) : []));
        break;
      case "LassoBeneficialOwners":
        want(c.company, "beneficialOwnership");
        break;
      case "LassoTextSections":
        // "resume" skrives ud fra stamdata, historik (første navn), ledelse og regnskab.
        if (c.variant === "resume") want(c.company, "company", "financials", "companyHistory", "people");
        else want(c.company, "textSections");
        break;
      case "LassoTimeline":
        // Virksomhed eller person; nøglen i ds.timeline og fejlnøglen er entitetens ID.
        want(entityRefOf(c), "timeline");
        break;
      case "LassoNews": {
        const id = entityRefOf(c);
        newsWanted.set(id, Math.max(newsWanted.get(id) ?? 0, c.limit));
        break;
      }
      case "LassoRiskObservations":
        // Katalog 17.2: hentes kun, når en spec eksplicit beder om listen (compose tilføjer den ikke).
        want(c.company, "observations");
        break;
      case "LassoCreditRating":
        want(c.company, "creditRating");
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
      case "LassoPersonTable":
        personSearches.push(c);
        break;
      case "LassoKeyValueList":
        if (c.variant === "financials") want(c.company, "financials", ...(c.fields ? (["financialStatements"] as const) : []));
        else
          want(
            c.company,
            "company",
            "ownership",
            "financials",
            ...(c.look === "card" ? (["contact"] as const) : []),
            // Valuation (Jakob 02.10): i standardrækkefølgen og når rows beder om den.
            ...(!c.rows || c.rows.includes("valuation") ? (["valuation"] as const) : []),
          );
        break;
      case "LassoSummary":
        // Lassos erhvervsresumé om virksomheden eller personen (Jakob 02.10).
        if (c.resume) want(c.resume, "resume");
        break;
      case "LassoRelationsTable":
        want(c.company, "companyHistory", "beneficialOwnership");
        break;
      case "LassoCompanyHistory":
        want(c.company, "companyHistory");
        break;
      case "LassoContact":
        want(c.company, "contact");
        break;
      case "LassoContactPersons":
        // 08.7: "Se alle"-panelets første kolonne viser virksomheden og dens kontaktoplysninger.
        want(c.company, "contactPersons", "company", "contact");
        break;
      case "LassoMultiYearTable":
        want(c.company, "financials");
        break;
      case "LassoIncomeStatement":
      case "LassoBalanceSheet":
      case "LassoCashFlow":
      case "LassoFinancialStatements":
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
      case "LassoPersonHead":
      case "LassoPersonRoles":
      case "LassoPersonRisk":
      case "LassoPersonFacts":
        want(c.person, "person");
        break;
      case "LassoPersonNetwork":
        want(c.person, "personNetwork");
        break;
      case "LassoMergers":
        want(c.company, "company");
        want(c.company, "companyEvents");
        break;
      case "LassoRegistration":
        want(c.company, "company", "ownership", "financials", "textSections");
        break;
      case "LassoAnnouncements":
        want(c.company, "company"); // 28.8: "<navn>, eksempeldata" under titlen
        want(c.company, "companyEvents");
        break;
      case "LassoPublications":
        want(c.company, "companyEvents");
        break;
      case "LassoPersonStats":
        want(c.person, "person");
        want(c.person, "personNetwork");
        break;
      case "LassoChangeFeed":
        feeds.push(c);
        break;
      case "LassoSavedPages":
        savedLists.push(c);
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

  // Katalog 15.3: én personsøgning pr. (navn, antal); nøglen er personSearchKey, fejlnøglen "personSearch:<key>".
  const personKeys = new Set<string>();
  for (const p of personSearches) {
    const key = personSearchKey(p);
    if (personKeys.has(key)) continue;
    personKeys.add(key);
    run(`personSearch:${key}`, async () => {
      (ds.personSearches ??= {})[key] = await provider.personSearch(p.query, p.limit);
    });
  }

  const graphKeys = new Set<string>();
  for (const g of graphs) {
    const key = ownershipGraphKey(g);
    if (graphKeys.has(key)) continue;
    graphKeys.add(key);
    run(`graph:${key}`, async () => {
      // Roden er virksomheden eller personen (personsidens ejerskaber).
      ds.ownershipGraphs[key] = await provider.ownershipGraph(entityRefOf(g), { ingoingDepth: g.ingoingDepth, outgoingDepth: g.outgoingDepth, onDate: g.onDate });
    });
  }

  // Katalog 21: ét feed pr. (liste eller virksomhed, dage, typer); nøglen er changeFeedKey, fejlnøglen
  // "changeFeed:<key>". Med company er det ændringerne i den ene virksomhed (fokus historik), uden liste.
  const feedKeys = new Set<string>();
  for (const f of feeds) {
    const key = changeFeedKey(f);
    if (feedKeys.has(key)) continue;
    feedKeys.add(key);
    const days = changeFeedDays(f);
    run(`changeFeed:${key}`, async () =>
      void (ds.changeFeeds[key] = await provider.changeFeed(f.company ? { companies: [f.company], days, types: f.types } : { list: f.list, days, types: f.types })),
    );
  }

  // Katalog 13.11: ét heatmap pr. (liste, måneder, typer); nøglen er activityHeatmapKey, fejlnøglen "activityHeatmap:<key>".
  const heatKeys = new Set<string>();
  for (const h of heatmaps) {
    const key = activityHeatmapKey(h);
    if (heatKeys.has(key)) continue;
    heatKeys.add(key);
    run(`activityHeatmap:${key}`, async () => void (ds.activityHeatmaps[key] = await provider.activityHeatmap({ list: h.list, months: h.months, types: h.types })));
  }

  // Gem-laget: én liste pr. (slags, antal); nøglen er savedPagesKey, fejlnøglen "savedPages:<key>".
  const savedKeys = new Set<string>();
  for (const l of savedLists) {
    const key = savedPagesKey(l);
    if (savedKeys.has(key)) continue;
    savedKeys.add(key);
    const load = extras.savedPages;
    if (!load) {
      ds.errors[`savedPages:${key}`] = SAVED_PAGES_NO_USER;
      continue;
    }
    run(`savedPages:${key}`, async () => void (ds.savedPages[key] = await load({ kind: l.kind, limit: l.limit })));
  }

  // Gem/Gemt-knappen: hvilke af visningens ID'er brugeren har gemt. Hentes sideløbende med data
  // (ID'erne står i specen); en fejl her vælter aldrig visningen, så feltet udelades bare.
  const loadSavedIds = extras.savedIds;
  const savedIds = loadSavedIds
    ? Promise.resolve(entityIdsOf(spec))
        .then((ids) => loadSavedIds(ids))
        .catch(() => undefined)
    : undefined;

  await Promise.all(jobs);
  const saved = await savedIds;
  if (saved) ds.savedIds = saved;
  // Virksomhedsopslaget bruger kun CVR (hurtigt). Har visningen også hentet kontaktblokken
  // (hjemmesidens telefon/e-mail/web), udfyldes de felter, CVR mangler, derfra.
  for (const [id, co] of Object.entries(ds.companies)) {
    const c = ds.contact[id];
    if (c && !(co.phone && co.email && co.website)) ds.companies[id] = { ...co, phone: co.phone ?? c.phone, email: co.email ?? c.email, website: co.website ?? c.website };
  }
  ds.generatedAt = new Date().toISOString();
  return ds;
}
