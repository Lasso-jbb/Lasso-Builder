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

/**
 * Kontaktoplysninger (katalog 08, "Kontaktblok"). Samme felter som CompanyVM's
 * telefon/e-mail/web/adresse, men med en kildelinje, fordi værdierne her kan
 * stamme fra virksomhedens hjemmeside (websites()/contacts()) og ikke kun CVR.
 */
export interface ContactVM {
  lassoId: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: Address;
  /** Fx "CVR" eller "Virksomhedens hjemmeside". */
  source?: string;
  updated?: string;
}

/** Katalog 08, én kontaktperson (rolle/afdeling, telefon og/eller e-mail). */
export interface ContactPersonVM {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface ContactPersonsVM {
  lassoId: string;
  people: ContactPersonVM[];
  source?: string;
  updated?: string;
}

export interface FinancialYear {
  year: number;
  periodStart?: string;
  periodEnd?: string;
  /** Dato regnskabet blev offentliggjort (Lassos "publicationTime"). */
  published?: string;
  /** Hvornår regnskabet blev offentliggjort (bruges i tidslinjen). Ikke altid oplyst. */
  publicationTime?: string;
  revenue?: number | null;
  grossProfit?: number | null;
  profit?: number | null;
  equity?: number | null;
  employees?: number | null;
  /**
   * Samlet gæld (passiver minus egenkapital). Ubekræftet mod Lassos API
   * (se docs/lasso-endpoints.md, "Ubekræftet"); bruges til stablede søjler
   * og fordelingen egenkapital/gæld i katalog 13.
   */
  liabilities?: number | null;
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

/** Alvorsskala (katalog 17, guide 23 regel 10): 0 neutral, 25 info, 50 mulig vigtig, 100 vigtig. */
export type Severity = 0 | 25 | 50 | 100;

export interface ObservationRowVM {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  /** Fx "CVR", "Regnskab 2025" eller "Ledelse". */
  source?: string;
  date?: string;
}

export interface ObservationsVM {
  lassoId: string;
  observations: ObservationRowVM[];
  /** Hvornår Lasso sidst gennemgik virksomheden (også når listen er tom, katalog 17). */
  checkedAt?: string;
  /** Datakilder til kildelinjen, fx ["CVR", "regnskab", "ledelse"]. */
  sources?: string[];
}

/** Samme alvorsskala som observationer, men kun tre trin bruges her (katalog 22): 0, 50, 100. */
export type RelationAssessment = 0 | 50 | 100;

export interface AuditorRelationVM {
  id: string;
  assessment: RelationAssessment;
  /** Personens eller selskabets navn. Står alene, ingen initial-cirkel (regel 5). */
  name: string;
  /** Rolle/tilknytning under navnet, fx "Partner, AAEN & CO.". */
  role?: string;
  relation: string;
  /** Selskabet relationen går igennem. */
  via?: string;
  from?: string;
  to?: string;
}

export interface AuditorIndependenceVM {
  lassoId: string;
  auditorName?: string;
  checkedAt?: string;
  relations: AuditorRelationVM[];
  /** Sat når data mangler eller er ufuldstændige (ny datamodel, ingen bekræftet kilde endnu). */
  unavailableReason?: string;
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

/**
 * Score 0 (lav risiko) til 100 (høj risiko), katalog 10. Der er endnu ingen
 * live datakilde; `score: null` betyder "ikke oplyst" (se LiveProvider.score).
 */
export interface ScoreVM {
  lassoId: string;
  score: number | null;
  source?: string;
  updated?: string;
}

/** Alt det data, én visning skal bruge, slået op på nøgle. */
export interface Dataset {
  source: DataSourceKind;
  generatedAt: string;
  companies: Record<string, CompanyVM>;
  financials: Record<string, FinancialsVM>;
  /** Katalog 08: kontaktblok og kontaktpersoner. */
  contact: Record<string, ContactVM>;
  contactPersons: Record<string, ContactPersonsVM>;
  people: Record<string, PersonRowVM[]>;
  ownership: Record<string, OwnershipVM>;
  beneficialOwnership: Record<string, BeneficialOwnershipVM>;
  textSections: Record<string, TextSectionsVM>;
  timeline: Record<string, TimelineVM>;
  news: Record<string, NewsVM>;
  searches: Record<string, SearchResultVM>;
  scores: Record<string, ScoreVM>;
  observations: Record<string, ObservationsVM>;
  auditorIndependence: Record<string, AuditorIndependenceVM>;
  /** Katalog 20: produktionsenheder, ejendomme/BBR og CHR, slået op pr. Lasso-ID. */
  productionUnits: Record<string, ProductionUnitsVM>;
  properties: Record<string, PropertiesVM>;
  livestock: Record<string, LivestockVM>;
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
    contact: {},
    contactPersons: {},
    people: {},
    ownership: {},
    beneficialOwnership: {},
    textSections: {},
    timeline: {},
    news: {},
    searches: {},
    scores: {},
    observations: {},
    auditorIndependence: {},
    productionUnits: {},
    properties: {},
    livestock: {},
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
