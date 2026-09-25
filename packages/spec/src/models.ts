/**
 * Normaliserede datamodeller. Serveren oversætter Lassos rå API-svar til disse
 * former, og UI-pakken kender kun dem. Derfor kan UI'en bygges og testes uden
 * at kende Lassos API, og serverlaget kan skiftes (fx ved flytning til Azure).
 */

export interface Address {
  street?: string;
  zip?: string;
  city?: string;
  municipality?: string;
  region?: string;
}

export interface CompanyVM {
  lassoId: string;
  cvr?: string;
  name: string;
  status?: string;
  /** Normaliseret status til badges. */
  statusKind?: "active" | "inactive" | "warning";
  form?: string;
  industryCode?: string;
  industryText?: string;
  address?: Address;
  founded?: string;
  employees?: number;
  website?: string;
  email?: string;
  phone?: string;
}

export interface FinancialYear {
  year: number;
  periodEnd?: string;
  /** Hvornår regnskabet blev offentliggjort (bruges i tidslinjen). Ikke altid oplyst. */
  publicationTime?: string;
  revenue?: number | null;
  grossProfit?: number | null;
  profit?: number | null;
  equity?: number | null;
  employees?: number | null;
}

export interface FinancialsVM {
  lassoId: string;
  currency: string;
  /** Sorteret stigende efter år. */
  years: FinancialYear[];
}

export interface PersonRowVM {
  name: string;
  lassoId?: string;
  role: string;
  from?: string;
  to?: string;
}

export interface OwnerVM {
  name: string;
  lassoId?: string;
  /** Kapitalandel, fx "50–66,66 %" eller "100 %". */
  share?: string;
  /** Stemmeandel, når den afviger fra kapitalandelen. */
  votes?: string;
  kind?: "person" | "company";
}

export interface OwnershipVM {
  lassoId: string;
  owners: OwnerVM[];
  auditor?: { name: string; lassoId?: string; from?: string };
}

/** Reelle ejere (katalog 11, "Reelle ejere"). Endpoint ubekræftet, se docs/lasso-endpoints.md. */
export interface BeneficialOwnerVM {
  name: string;
  lassoId?: string;
  /** Kæden fra virksomheden til personen, fx "via JEBEMA Holding ApS, 100 %" eller "via 2 led, Eggert Holding ApS". Ingen kæde, hvis ejerskabet er direkte. */
  chain?: string;
  /** Den beregnede indirekte andel, fx "20–24,99 %". */
  share?: string;
}

/** Et led i ejerkæden, som CVR ikke kan følge til en reel person (fx et fondsejet led). */
export interface BeneficialOwnerGapVM {
  /** Den udækkede andel, fx "25–33 %". */
  share?: string;
  reason?: string;
}

export interface BeneficialOwnershipVM {
  lassoId: string;
  owners: BeneficialOwnerVM[];
  gaps?: BeneficialOwnerGapVM[];
}

/** Tekstsektioner fra CVR-stamdata (katalog 12, "Tekstsektioner"). Felter ud over branche er ubekræftede. */
export interface TextSectionItem {
  heading: string;
  body: string;
  /** Ekstra linje under brødteksten i muted, fx "NACE 631000". */
  note?: string;
}

export interface TextSectionsVM {
  lassoId: string;
  title?: string;
  sections: TextSectionItem[];
}

/** Begivenhed i virksomhedens historik (katalog 12, "Tidslinje"). */
export interface TimelineEventVM {
  date: string;
  title: string;
  detail?: string;
  /** Sat sammen med "to" ved en ændring, der vises som "fra → til". */
  from?: string;
  to?: string;
  category: string;
}

export interface TimelineVM {
  lassoId: string;
  events: TimelineEventVM[];
}

/** Én nyhed (katalog 12, "Nyheder"). Kilde: docs.lassox.com/data-apis/paqle/. */
export interface NewsItemVM {
  source: string;
  url?: string;
  /** ISO-tidsstempel; komponenten viser relativ tid under 7 dage, ellers dato. */
  time?: string;
  headline: string;
  excerpt?: string;
  /** Sprogkode eller -navn, når artiklen ikke er dansk, fx "engelsk". */
  language?: string;
}

export interface NewsVM {
  lassoId: string;
  items: NewsItemVM[];
}

export interface CompanyRowVM {
  lassoId: string;
  cvr?: string;
  name: string;
  city?: string;
  region?: string;
  industryText?: string;
  status?: string;
  statusKind?: CompanyVM["statusKind"];
  employees?: number | null;
  revenue?: number | null;
  grossProfit?: number | null;
  profit?: number | null;
  /** Bruttofortjeneste over tid, ældste først, til sparklines. */
  trend?: number[];
}

export interface SearchResultVM {
  key: string;
  total?: number;
  rows: CompanyRowVM[];
  /** Kriterier, der ikke kunne anvendes på datakilden endnu. Vises som advarsel. */
  unsupportedCriteria?: string[];
  /** Lassos filtersøgning i hele CVR eller navnesøgning med filtrering bagefter. */
  source?: "lasso-search" | "name-search";
  /** Forbehold til modellen, fx at en sortering kun er anvendt på de første rækker. */
  note?: string;
}

export type DataSourceKind = "live" | "demo";

/** Alt det data, én visning skal bruge, slået op på nøgle. */
export interface Dataset {
  source: DataSourceKind;
  generatedAt: string;
  companies: Record<string, CompanyVM>;
  financials: Record<string, FinancialsVM>;
  people: Record<string, PersonRowVM[]>;
  ownership: Record<string, OwnershipVM>;
  beneficialOwnership: Record<string, BeneficialOwnershipVM>;
  textSections: Record<string, TextSectionsVM>;
  timeline: Record<string, TimelineVM>;
  news: Record<string, NewsVM>;
  searches: Record<string, SearchResultVM>;
  /** Fejl pr. nøgle, fx "company:CVR-1-12345678" -> "Ingen adgang". */
  errors: Record<string, string>;
}

export function emptyDataset(source: DataSourceKind): Dataset {
  return {
    source,
    generatedAt: new Date().toISOString(),
    companies: {},
    financials: {},
    people: {},
    ownership: {},
    beneficialOwnership: {},
    textSections: {},
    timeline: {},
    news: {},
    searches: {},
    errors: {},
  };
}

/** Stabil nøgle for en søgning, så UI og server finder samme resultat. */
export function searchKey(search: {
  query?: string;
  criteria?: unknown[];
  sort?: unknown;
  limit?: number;
}): string {
  return JSON.stringify({
    q: (search.query ?? "").trim().toLowerCase(),
    c: search.criteria ?? [],
    s: search.sort ?? null,
    l: search.limit ?? 20,
  });
}

/** Nøgle i tool-resultatets _meta, hvor datasættet ligger (til UI'en, ikke modellen). */
export const DATASET_META_KEY = "lassox.com/dataset";

/** Det, UI'en skal bruge for at tegne en visning. */
export interface ViewPayload {
  spec: import("./spec.js").ViewSpec;
  dataset: Dataset;
  /** Adresse, hvis visningen er gemt. */
  url?: string;
}
