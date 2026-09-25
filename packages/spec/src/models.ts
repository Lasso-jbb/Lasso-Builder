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

/** En enhed i ejergrafen (katalog 14). Personer tegnes som piller, selskaber som kasser. */
export interface OwnershipNodeVM {
  /** Lasso-ID, fx "CVR-1-12345678". */
  id: string;
  name: string;
  kind: "person" | "company";
  cvr?: string;
  /** Kort virksomhedsform, fx "ApS". */
  form?: string;
  status?: string;
  statusKind?: CompanyVM["statusKind"];
  /** ISO-landekode for udenlandske enheder, fx "NO". Mangler for danske. */
  country?: string;
  /** Udenlandsk registreringsnummer (org.nr., HRB …), vises i stedet for CVR. */
  registrationNo?: string;
  /** Egenkapital i seneste regnskab, hvis grafen er beriget med den. */
  equity?: number | null;
  /** Den virksomhed, diagrammet er åbnet fra. Kun én. */
  root?: boolean;
}

/** Ejerskab fra `from` (ejer) til `to` (den ejede). Andele i procent 0–100 som CVR-interval. */
export interface OwnershipEdgeVM {
  from: string;
  to: string;
  share?: [number, number];
  /** Stemmeandel, kun når den afviger fra kapitalandelen. */
  votes?: [number, number];
  /** Aktieklasser, fx "A, B", præcis som CVR leverer dem. */
  classes?: string;
  since?: string;
  /** Slutdato for et ophørt ejerskab. */
  until?: string;
}

export interface OwnershipGraphVM {
  rootId: string;
  nodes: OwnershipNodeVM[];
  edges: OwnershipEdgeVM[];
  /** Dybden, der er hentet (lag op og ned). */
  ingoingDepth: number;
  outgoingDepth: number;
  /** Øjebliksbilledets dato (ÅÅÅÅ-MM-DD). Mangler = i dag. */
  onDate?: string;
  /** Tidspunkt for opslaget, til "Sidst tjekket". */
  fetchedAt?: string;
  /** Forbehold, fx at kun direkte ejere kunne hentes. */
  note?: string;
}

/** Stabil nøgle for et ejerdiagram, så UI og server finder samme graf. */
export function ownershipGraphKey(g: { company: string; ingoingDepth: number; outgoingDepth: number; onDate?: string }): string {
  return `${g.company}|${g.ingoingDepth}|${g.outgoingDepth}|${g.onDate ?? ""}`;
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
  searches: Record<string, SearchResultVM>;
  /** Ejerdiagrammer pr. ownershipGraphKey. */
  ownershipGraphs: Record<string, OwnershipGraphVM>;
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
    searches: {},
    ownershipGraphs: {},
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
