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

/** Katalog 20: én produktionsenhed (P-nummer). */
export interface ProductionUnitVM {
  pNumber?: string;
  name?: string;
  address?: Address;
  /** Hovedenheden markeres med koral overline og står altid først. */
  isMain?: boolean;
  industryCode?: string;
  industryText?: string;
  /** Fra CVR's kvartalstal; "Ikke oplyst" når ukendt. */
  employees?: number | null;
  status?: string;
  statusKind?: CompanyVM["statusKind"];
  /** Ophørsår, når enheden er ophørt (vises i status: "Ophørt 2024"). */
  endedYear?: number;
  created?: string;
}

export interface ProductionUnitsVM {
  lassoId: string;
  units: ProductionUnitVM[];
}

/** Katalog 20: én bygning i BBR-bygningstabellen. */
export interface BuildingVM {
  number?: number;
  usage?: string;
  builtYear?: number;
  floors?: number;
  areaM2?: number | null;
  /** Antal enheder i bygningen; "—" når ikke relevant (fx garage). */
  units?: number | null;
}

/** Katalog 20: én ejendom (matrikel) med BBR-bygninger og arealfordeling. */
export interface PropertyVM {
  address?: Address;
  /** "Matr. 123a, Eksempel By". */
  matrikel?: string;
  bfeNumber?: string;
  propertyType?: string;
  /** "Ejer, tinglyst 2019" / "Lejer". */
  ownership?: string;
  landAreaM2?: number | null;
  builtAreaM2?: number | null;
  publicValuation?: { amount: number; year?: number };
  /** Antal hæftelser (tinglysning); undefined når ukendt. */
  encumbrances?: number;
  buildings: BuildingVM[];
  /** Sat, når vi har en reel matrikelgeometri at tegne; ellers vises kortet med tom-tilstand. */
  hasGeometry?: boolean;
}

export interface PropertiesVM {
  lassoId: string;
  properties: PropertyVM[];
}

/** Katalog 20: én besætning/dyretype (CHR). */
export interface LivestockHerdVM {
  species?: string;
  /** "slagtesvin", "søer", "malkekøer" osv. */
  category?: string;
  count?: number | null;
  unit?: string;
}

/** Katalog 20: én veterinær hændelse på tidslinjen. */
export interface VetEventVM {
  title?: string;
  detail?: string;
  date?: string;
  dateTo?: string;
  /** gul = aktiv/nylig restriktion, neutral = orientering. */
  severity?: "active" | "neutral";
}

export interface LivestockVM {
  lassoId: string;
  /** CHR-nummer. Sektionen vises kun, når dette er sat. */
  chrNumber?: string;
  ownerName?: string;
  updated?: string;
  herds: LivestockHerdVM[];
  /** "SPF" m.fl., vist som ren tekst. */
  healthStatus?: string;
  events: VetEventVM[];
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
  /** Katalog 20: produktionsenheder, ejendomme/BBR og CHR, slået op pr. Lasso-ID. */
  productionUnits: Record<string, ProductionUnitsVM>;
  properties: Record<string, PropertiesVM>;
  livestock: Record<string, LivestockVM>;
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
    productionUnits: {},
    properties: {},
    livestock: {},
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
