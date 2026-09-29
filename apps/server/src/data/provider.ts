import type {
  ActivityHeatmapVM,
  BeneficialOwnershipVM,
  ChangeFeedVM,
  ChangeType,
  AuditorIndependenceVM,
  CompanyRowVM,
  CompanyVM,
  ContactPersonsVM,
  ContactVM,
  CreditRatingVM,
  Criterion,
  DataSourceKind,
  FinancialsVM,
  FinancialStatementsVM,
  IndustryBenchmarkVM,
  MapVM,
  NewsVM,
  ObservationsVM,
  OwnershipGraphVM,
  OwnershipVM,
  PersonRowVM,
  PersonNetworkVM,
  PersonSearchResultVM,
  PersonSearchRowVM,
  PersonVM,
  ScoreVM,
  ScoreHistoryVM,
  LivestockVM,
  PropertiesVM,
  ProductionUnitsVM,
  SearchQuery,
  SearchResultVM,
  TextSectionsVM,
  TimelineVM,
} from "@lasso/spec";
import { personSearchKey, personTableRow } from "@lasso/spec";

/**
 * Datalaget. Både MCP-tools og (senere) Lassos interne chat kalder de samme
 * funktioner. Ved flytning til Azure er det kun implementeringerne her, der
 * skiftes; spec og UI genbruges uændret.
 */
export interface DataProvider {
  readonly kind: DataSourceKind;
  search(query: SearchQuery): Promise<SearchResultVM>;
  /** Lassos fortolkning af fritekst som kriterier (prompt-søgningen). null, hvis den ikke kan fortolkes. */
  interpret?(text: string): Promise<{ criteria: Criterion[]; unknown: string[] } | null>;
  /** Hurtigt navneopslag uden regnskabsberigelse (til show_company med et navn). */
  findCompanies(name: string, limit: number): Promise<CompanyRowVM[]>;
  company(lassoId: string): Promise<CompanyVM>;
  /** Katalog 08: kontaktblok (telefon/e-mail/web/adresse, med kildelinje). */
  contact(lassoId: string): Promise<ContactVM>;
  /** Katalog 08: kontaktpersoner. */
  contactPersons(lassoId: string): Promise<ContactPersonsVM>;
  financials(lassoId: string): Promise<FinancialsVM>;
  /** Katalog 19: fuldt regnskab (resultatopgørelse, balance, pengestrøm). Samme kilde som `financials`. */
  financialStatements(lassoId: string): Promise<FinancialStatementsVM>;
  people(lassoId: string): Promise<PersonRowVM[]>;
  ownership(lassoId: string): Promise<OwnershipVM>;
  /** Katalog 10: 0–100 risikoscore. Ingen live datakilde endnu (se LiveProvider); score: null = "ikke oplyst". */
  score(lassoId: string): Promise<ScoreVM>;
  beneficialOwnership(lassoId: string): Promise<BeneficialOwnershipVM>;
  textSections(lassoId: string): Promise<TextSectionsVM>;
  timeline(lassoId: string): Promise<TimelineVM>;
  news(lassoId: string, limit: number): Promise<NewsVM>;
  observations(lassoId: string): Promise<ObservationsVM>;
  /** Katalog 17: kreditvurdering fra Creditsafe. Låst, ikke beregnet og fejl er tilstande i svaret, ikke undtagelser. */
  creditRating(lassoId: string): Promise<CreditRatingVM>;
  auditorIndependence(lassoId: string): Promise<AuditorIndependenceVM>;
  /** Katalog 20: produktionsenheder (P-numre). */
  productionUnits(lassoId: string): Promise<ProductionUnitsVM>;
  /** Katalog 20: ejendomme og BBR. */
  properties(lassoId: string): Promise<PropertiesVM>;
  /** Katalog 20: CHR (kun landbrug). */
  livestock(lassoId: string): Promise<LivestockVM>;
  /** Ejergrafen i flere lag omkring én virksomhed (katalog 14). */
  ownershipGraph(lassoId: string, opts: OwnershipGraphOptions): Promise<OwnershipGraphVM>;
  /** Katalog 16: én person (Lasso-ID "CVR-3-…") med roller i alle selskaber. */
  person(lassoId: string): Promise<PersonVM>;
  /** Katalog 16: personer med fælles selskaber. */
  personNetwork(lassoId: string): Promise<PersonNetworkVM>;
  /** Navneopslag på personer (til show_person med et navn). */
  findPersons(name: string, limit: number): Promise<PersonSearchRowVM[]>;
  /** Katalog 15.3: personsøgning som tabel (roller, konkurser, fødselsår, by). */
  personSearch(query: string, limit: number): Promise<PersonSearchResultVM>;
  /** Katalog 21: ændringer i de overvågede virksomheder de seneste `days` dage. Live-endpoint ubekræftet. */
  changeFeed(opts: ChangeFeedOptions): Promise<ChangeFeedVM>;
  /** Katalog 18.2: scorehistorik (én hentning = ét punkt). Ingen live datakilde endnu; tom med årsag. */
  scoreHistory(lassoId: string): Promise<ScoreHistoryVM>;
  /** Katalog 13.6/13.10: branchens median pr. år. Live-endpoint ubekræftet; "unavailable" med årsag. */
  industryBenchmark(lassoId: string): Promise<IndustryBenchmarkVM>;
  /** Katalog 13.11: ændringer pr. måned og type i en overvågningsliste. Samme ubekræftede kilde som changeFeed. */
  activityHeatmap(opts: ActivityHeatmapOptions): Promise<ActivityHeatmapVM>;
  /** Katalog 13.12: hovedadresse og P-enheder med koordinater. Koordinater ubekræftede i live. */
  mapPoints(lassoId: string): Promise<MapVM>;
}

export interface ActivityHeatmapOptions {
  list?: string;
  months: number;
  types?: readonly ChangeType[];
}

export interface ChangeFeedOptions {
  /** Overvågningslistens navn; udeladt = alle overvågede. */
  list?: string;
  days: number;
  types?: readonly ChangeType[];
}

export interface OwnershipGraphOptions {
  ingoingDepth: number;
  outgoingDepth: number;
  onDate?: string;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} blev ikke fundet`);
    this.name = "NotFoundError";
  }
}

/** Kører async-opgaver med et loft over samtidige kald. */
export async function mapLimit<T, R>(list: readonly T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Katalog 15.3: navnesøgningen beriget med hver persons roller (samme opslag som personsiden),
 * højst 5 ad gangen. Kan en person ikke hentes, står rækken med navn og by alene, så én fejl
 * aldrig vælter tabellen.
 */
export async function searchPersonsTable(provider: Pick<DataProvider, "findPersons" | "person">, query: string, limit: number): Promise<PersonSearchResultVM> {
  const hits = await provider.findPersons(query, limit);
  const rows = await mapLimit(hits, 5, async (h) => {
    try {
      const row = personTableRow(await provider.person(h.lassoId));
      return { ...row, name: row.name || h.name, city: row.city ?? h.city };
    } catch {
      return { lassoId: h.lassoId, name: h.name, roles: [], bankruptcies: 0, city: h.city };
    }
  });
  return { key: personSearchKey({ query, limit }), query, total: rows.length, rows };
}
