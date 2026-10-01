/**
 * Normaliserede datamodeller. Serveren oversætter Lassos rå API-svar til disse
 * former, og UI-pakken kender kun dem. Derfor kan UI'en bygges og testes uden
 * at kende Lassos API, og serverlaget kan skiftes (fx ved flytning til Azure).
 */
import type { PersonNetworkVM, PersonSearchResultVM, PersonVM } from "./person.js";
import type { Metric } from "./spec.js";

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
  /** Katalog 08.1: binavne fra CVR; det første vises i muted efter status ("Binavn: …"). */
  secondaryNames?: string[];
  /** Katalog 08.1: dato for den nuværende status, fx konkursdekret ("Under konkurs, siden 03.06.2026") eller ophør. */
  statusDate?: string;
  /** Katalog 08.1: kurator ved konkurs/likvidation (likvidator), vist i faktalinjen. */
  curator?: string;
  /** Katalog 28.7/26h.9: bibrancher (op til tre), kode først. `[]` = ingen registreret; udeladt = ukendt. Ubekræftet. */
  altIndustries?: { code?: string; text: string }[];
  /** Katalog 28.7: revision fravalgt (ÅRL § 135). Den eneste værdi, der farves (warning-tekst). Ubekræftet. */
  auditExempt?: boolean;
  /** Katalog 28.7: registreret kapital med valutakode og kapitalklasser. Ubekræftet. */
  registeredCapital?: { amount: number; currency?: string; classes?: string[] };
  /** Katalog 28.7: revision fravalgt siden dette regnskabsår. Ubekræftet. */
  auditExemptSince?: number;
  /** Katalog 28.7: regnskabsklasse (A, B, C, D). Ubekræftet. */
  accountingClass?: string;
  /** Katalog 28.7: første regnskabsperiode (ÅÅÅÅ-MM-DD). Ubekræftet. */
  firstPeriod?: { start?: string; end?: string };
  /** Katalog 28.7: vedtægter senest ændret (ÅÅÅÅ-MM-DD). Ubekræftet. */
  statutesChanged?: string;
  /** Katalog 28.7: reklamebeskyttet i CVR. Ubekræftet. */
  advertisingProtected?: boolean;
  /** Katalog 28.7: børsnoteret. Ubekræftet. */
  listed?: boolean;
  /** Formål fra vedtægterne (CVR). Ubekræftet feltnavn; samme kilde som tekstsektionen "Formål". */
  purpose?: string;
  /** Tegningsregel (CVR). Ubekræftet feltnavn. */
  signingRule?: string;
  /** Underskrivende revisor på seneste regnskab, fx "Niels Borum Madsen (mne32274)". Ubekræftet. */
  signingAuditor?: string;
}

/**
 * Ét verificeret telefonnummer fra Lassos "live number" (katalog 08). Kræver egen
 * livenumber-tilføjelse til Lasso-abonnementet; se docs/endpoints-enheder-kontakt-analyse.md.
 */
export interface VerifiedPhoneNumberVM {
  phoneNumber: string;
  /** Højere = bedre. */
  score?: number;
  explanation?: string;
  callable: boolean;
  /** Fx "CVR", "Website". */
  sources: string[];
  /**
   * Katalog 08.5: nummeret er udgået (ikke længere i brug) siden denne dato. Værdien beholdes
   * gennemstreget med "Udgået, DD.MM.ÅÅÅÅ"; den slettes aldrig fra blokken.
   */
  expired?: string;
}

/**
 * Kontaktoplysninger (katalog 08, "Kontaktblok"). Samme felter som CompanyVM's
 * telefon/e-mail/web/adresse, men med en kildevisning, fordi værdierne her kan
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
  /** Lassos "live number": højst 3 verificerede numre, sorteret efter score. */
  verifiedNumbers?: VerifiedPhoneNumberVM[];
  /** Tilmeldt Robinsonlisten (må ikke kontaktes med markedsføring). */
  isRobinson?: boolean;
  /**
   * Hvornår live number-opslaget er opdateret. Dato (ÅÅÅÅ-MM-DD) eller ISO-tidspunkt; et tidspunkt
   * inden for 60 sek. giver "Verificeret nu" (katalog 08.5), ellers "Verificeret for N dage siden".
   */
  verifiedAt?: string;
  /** Katalog 08.7: flere e-mailadresser end `email` (fx kontakt@ og contact@), vist under "Emailadresser". */
  emails?: string[];
  /**
   * "Se flere"-panelet (08.3/08.7): alle telefonnumre og e-mailadresser med deres kilde, så panelet kan
   * gruppere dem ("Fra CVR", "Fra hjemmeside") og vise kilden i detaljen. Samme værdi kan stå under
   * begge kilder. Uden: panelet bygges af `phone`, `email`, `emails` og `verifiedNumbers`.
   */
  channels?: ContactChannelVM[];
}

/** Én telefon eller e-mail med kilden, den kommer fra (08.3/08.7). */
export interface ContactChannelVM {
  kind: "phone" | "email";
  value: string;
  /** cvr = registreret i CVR; hjemmeside = fundet på virksomhedens hjemmeside. */
  source: "cvr" | "hjemmeside";
  /** Siden, værdien blev fundet på (hjemmeside), når den kendes. */
  url?: string;
}

/** Katalog 08, én kontaktperson (rolle/afdeling, telefon og/eller e-mail). */
export interface ContactPersonVM {
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  /**
   * Katalog 08.7: afdeling/gruppe i "Se alle"-panelet (Direktion, Ledelse, Salg, IT-udvikling,
   * Konsulenter, Øvrige). Mangler den, afledes den af rollen (contactPersonGroup).
   */
  group?: string;
  /** Profil-URL på LinkedIn (panelets detalje: "LinkedIn-profil, Åbn"). */
  linkedin?: string;
  /** Muted tekst under telefonnummeret, fx "Direkte" eller "Omstilling". */
  phoneNote?: string;
  /** Muted tekst under e-mailen, fx "Personlig" eller "Fælles". */
  emailNote?: string;
  /** Kilder til personen. Vises ikke (Jakob runde 6: ingen kildevisning, heller ikke i 08.7-panelet). */
  sources?: { label: string; url?: string; text?: string; date?: string }[];
}

export interface ContactPersonsVM {
  lassoId: string;
  people: ContactPersonVM[];
  /** Forklaring til tom-tilstanden, fx når virksomheden ingen brugbar hjemmeside har. */
  emptyReason?: string;
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
  /** Årsrapporten som PDF (kun http/https), så tidslinjen kan hente den (12.3). Ikke altid oplyst. */
  pdfUrl?: string;
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
  /** Aktiver/passiver i alt (balancesum). Ubekræftet; afledt af egenkapital + gæld, når begge er kendt (se docs/lasso-endpoints.md). */
  assetsTotal?: number | null;
  /** Resultat af primær drift før af- og nedskrivninger. Ubekræftet XBRL-begreb (se docs/lasso-endpoints.md). */
  ebitda?: number | null;
  /** Egenkapital i procent af balancesum (nøgletal "soliditetsgrad"). Beregnet, ikke et XBRL-begreb. */
  soliditetsgrad?: number | null;
  /**
   * Overskudsgrad: resultat af primær drift (EBIT) i procent af nettoomsætningen (ÅRL-nøgletal).
   * Beregnet; null ("-"), når omsætning eller EBIT ikke er oplyst (typisk klasse B).
   */
  overskudsgrad?: number | null;
  /** Hvilket regnskab tallene er fra: "Koncern" (når koncernregnskab findes) eller "Selskab". Aldrig blandet. */
  scope?: "Koncern" | "Selskab";
  /** ISO 4217-valuta for årets beløb (fx "EUR"), når regnskabet oplyser den. */
  currency?: string;
  /** Omsætningsaktiver i procent af kortfristet gæld (nøgletal "likviditetsgrad"). Beregnet. */
  likviditetsgrad?: number | null;
}

export interface FinancialsVM {
  lassoId: string;
  currency: string;
  /** Sorteret stigende efter år. */
  years: FinancialYear[];
  /**
   * Katalog 09.1: branchens udvikling pr. nøgletal i seneste år (procent, fx 3.1 = +3,1 %), vist som
   * tekst efter ændringen ("branche ▲ 3,1 %"), aldrig som et ekstra tal. `label` er fx "branche 6201".
   */
  benchmark?: { label?: string; change: Partial<Record<Metric, number>> };
  /**
   * Katalog 09.1: kvalitetsflag pr. nøgletal i seneste år: forklaringen vises i tooltip ved det gule
   * udråbstegn, fx "Ansatte i regnskabet afviger fra CVR (17)".
   */
  quality?: Partial<Record<Metric, string>>;
}

/**
 * Fuldt regnskab for ét år (katalog 19, "Regnskabsdetaljer"): resultatopgørelse,
 * balance og pengestrøm med alle underposter. Hovedtallene (bruttofortjeneste/
 * omsætning, resultat, egenkapital, balancesum) er de samme bekræftede/afledte
 * tal som i `FinancialYear`; underposterne (personaleomkostninger, andre
 * driftsomkostninger, af- og nedskrivninger, finansielle poster, skat, og hele
 * balancens linjer ud over egenkapital/balancesum) er UBEKRÆFTEDE XBRL-begreber
 * (se docs/lasso-endpoints.md) og kan mangle ("-") for rigtige virksomheder.
 */
export interface IncomeStatementYear {
  year: number;
  periodStart?: string;
  periodEnd?: string;
  revenue?: number | null;
  /** 19.1: vareforbrug og eksterne omkostninger (negativ), mellem omsætning og bruttofortjeneste. */
  externalCosts?: number | null;
  grossProfit?: number | null;
  staffCosts?: number | null;
  otherOperatingCosts?: number | null;
  ebitda?: number | null;
  depreciation?: number | null;
  /** 19.1: resultat af primær drift (EBIT). */
  ebit?: number | null;
  /** 19.1: finansielle indtægter (positiv). */
  financialIncome?: number | null;
  /** 19.1: finansielle omkostninger (negativ). */
  financialExpenses?: number | null;
  financialItemsNet?: number | null;
  profitBeforeTax?: number | null;
  tax?: number | null;
  profit?: number | null;
}

export interface BalanceSheetYear {
  year: number;
  periodEnd?: string;
  intangibleAssets?: number | null;
  tangibleAssets?: number | null;
  /** 19.1: finansielle anlægsaktiver (kapitalandele, langfristede tilgodehavender). */
  financialFixedAssets?: number | null;
  fixedAssetsTotal?: number | null;
  /** 19.1: varebeholdninger. */
  inventories?: number | null;
  tradeReceivables?: number | null;
  otherReceivables?: number | null;
  cash?: number | null;
  currentAssetsTotal?: number | null;
  assetsTotal?: number | null;
  shareCapital?: number | null;
  retainedEarnings?: number | null;
  equityTotal?: number | null;
  /** 19.1: hensatte forpligtelser (står mellem egenkapital og gæld). */
  provisions?: number | null;
  longTermLiabilities?: number | null;
  shortTermLiabilities?: number | null;
  liabilitiesTotal?: number | null;
  /** Passiver i alt; identisk med `assetsTotal`, når begge er kendt (balancen går op). */
  liabilitiesAndEquityTotal?: number | null;
}

/** Kun til stede for regnskabsklasse C/D; klasse B skal ikke aflægge pengestrømsopgørelse. */
export interface CashFlowYear {
  year: number;
  periodEnd?: string;
  profit?: number | null;
  depreciation?: number | null;
  workingCapitalChange?: number | null;
  operatingCashFlow?: number | null;
  intangibleInvestments?: number | null;
  investingCashFlow?: number | null;
  capitalIncrease?: number | null;
  loanChange?: number | null;
  financingCashFlow?: number | null;
  netCashFlow?: number | null;
  cashBeginning?: number | null;
  cashEnding?: number | null;
}

/** Revisionsoplysninger for ét regnskabsår (portalens "Regnskabsoplysninger"). Ubekræftede feltnavne i live. */
export interface FinancialAuditVM {
  year: number;
  /** Erklæring fra revisor, fx "Revision", "Review", "Udvidet gennemgang", "Assistance" eller "Ingen". */
  type?: string;
  /** Revisor har fremhævet forhold i påtegningen. */
  emphasis?: boolean;
  /** Revisor har oplyst væsentlig usikkerhed om going concern. */
  goingConcern?: boolean;
  /** Årsrapporten som PDF (kun http/https). */
  pdfUrl?: string;
}

export interface FinancialStatementsVM {
  lassoId: string;
  /** Revisionsoplysninger pr. år (erklæring, fremhævelser, going concern, PDF). */
  audits?: FinancialAuditVM[];
  currency: string;
  /** Sorteret stigende efter år, samme år som `FinancialsVM.years`. */
  incomeStatement: IncomeStatementYear[];
  balanceSheet: BalanceSheetYear[];
  /** Tom, når selskabet ikke aflægger pengestrømsopgørelse (klasse B) eller regnskabet ikke oplyser den. */
  cashFlow: CashFlowYear[];
  /** Katalog 19.1: hvilket regnskab tallene er fra (samme valg som FinancialYear.scope). */
  scope?: "Koncern" | "Selskab";
  /** Katalog 19.1: det andet scope (koncern/selskab), når begge er aflagt. Værktøjslinjen skifter imellem dem. */
  alternate?: Omit<FinancialStatementsVM, "lassoId" | "alternate">;
  /** Katalog 19.1: periodetyper, selskabet indberetter. Standard kun "year"; halvår/kvartal er ellers dæmpet. */
  periods?: ("year" | "half" | "quarter")[];
  /** Katalog 19.1: revisorpåtegningen som tekst, fx "Revisionspåtegning uden forbehold". Ubekræftet i live. */
  auditorOpinion?: string;
  /** Katalog 19.1: link til årsrapporten som PDF (kun http/https). Ubekræftet i live. */
  pdfUrl?: string;
  /** Katalog 26d.9/26f.3: fodnote under opgørelserne, fx hvilke tal der er eksempeldata. */
  note?: string;
}

export interface PersonRowVM {
  name: string;
  lassoId?: string;
  role: string;
  from?: string;
  to?: string;
  /**
   * Katalog 11.2: antal andre selskaber, personen har en aktiv rolle i ("også i 3 andre selskaber").
   * Udeladt, når kilden ikke leverer tallet (feltet er ikke dokumenteret i Lasso-API'et; læses defensivt).
   */
  otherCompanies?: number;
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
  /**
   * GET /{lassoId}/owners/legal: der findes ejere under 5 %, som CVR ikke registrerer enkeltvis
   * (kun ejere over 5 % listes ved navn). Kun sat, når det dokumenterede endpoint er brugt.
   */
  hasOwnersUnderFivePercent?: boolean;
}

/** Reelle ejere (katalog 11, "Reelle ejere"). Endpoint ubekræftet, se docs/lasso-endpoints.md. */
export interface BeneficialOwnerVM {
  name: string;
  lassoId?: string;
  /** Kæden fra virksomheden til personen, fx "via JEBEMA Holding ApS, 100 %" eller "via 2 led, Eggert Holding ApS". Ingen kæde, hvis ejerskabet er direkte. */
  chain?: string;
  /** Den beregnede indirekte andel, fx "20–24,99 %". */
  share?: string;
  /** Ejerskabet skyldes en rolle i virksomheden (API: throughRole). Vises som "via rolle" i muted efter navnet (28.9). */
  throughRole?: boolean;
  /** Ledelsen som reelle ejere (28.9): personens rolle, fx "Direktør". Står til højre i stedet for andelen. */
  role?: string;
}

/** Et led i ejerkæden, som CVR ikke kan følge til en reel person (fx et fondsejet led). */
export interface BeneficialOwnerGapVM {
  /** Den udækkede andel, fx "25–33 %". */
  share?: string;
  reason?: string;
}

/**
 * De tre særlige tilstande for reelle ejere (katalog 28.9). Teksten forklarer altid, hvorfor listen
 * ser ud, som den gør; aldrig farvet boks, aldrig tom sektion.
 * - "management": ingen registrerede reelle ejere, så ledelsen/bestyrelsen/den daglige ledelse er
 *   indsat (API: fallbackType/effectiveFallbackType). De indsatte personer står som rækker i `owners` med `role`.
 * - "exempt": virksomheden er undtaget registreringskravet (API: exemptionStatus "EXEMPT"); forbehold i muted.
 * - "unidentified": virksomheden har registreret, at den ikke kan identificere sine reelle ejere
 *   (API: couldNotIdentify). Vises med udråbstegn-ikon, fordi det er en observation.
 */
export interface BeneficialOwnershipSpecialVM {
  kind: "management" | "exempt" | "unidentified";
  /** Årsagen i én sætning, fx Lassos fallbackDescription. */
  reason: string;
  /** Fritaget: forbeholdet i muted. */
  caveat?: string;
  /** Ledelsen som reelle ejere: hvilken gruppe der er indsat. */
  fallback?: "management" | "daily-management" | "board";
}

export interface BeneficialOwnershipVM {
  lassoId: string;
  owners: BeneficialOwnerVM[];
  gaps?: BeneficialOwnerGapVM[];
  /** Særlig tilstand (28.9): fallback til ledelsen, fritaget eller kunne ikke identificeres. */
  special?: BeneficialOwnershipSpecialVM;
}

/** Tekstsektioner fra CVR-stamdata (katalog 12, "Tekstsektioner"). Felter ud over branche er ubekræftede. */
/**
 * Et stykke tekst, evt. med en navngiven entitet (Lassos "{Navn|LassoId}"-markup): `lassoId`
 * sat = navnet kan åbnes som virksomhed (CVR-1-) eller person (CVR-3-) i værter med drill-down.
 * `highlight` = virksomhedens eget navn i fed (Paqle). Bruges i nyheder og tekstsektioner.
 */
export interface TextSegment {
  text: string;
  lassoId?: string;
  highlight?: boolean;
}

export interface TextSectionItem {
  heading: string;
  /** Ren tekst uden markup (navnene beholdes). */
  body: string;
  /** Samme tekst opdelt i segmenter med entiteter, når kilden har markup (regnskabsanalysen). */
  segments?: TextSegment[];
  /** Ekstra linje under brødteksten i muted, fx "NACE 631000". */
  note?: string;
}

export interface TextSectionsVM {
  lassoId: string;
  title?: string;
  sections: TextSectionItem[];
  /** 19.3: hvornår regnskabsanalysen blev genereret (ISO); står i analysens kildevisning. */
  analysisGenerated?: string;
  /** 19.3: regnskabsårene, analysen bygger på, fx "2021–2025" ("Genereret af Lasso ud fra regnskab 2021–2025"). */
  analysisBasis?: string;
  /** 19.3: analysens overskrift 17/600, fx "Vækst i toplinjen, men omkostningerne løber hurtigere". */
  analysisHeadline?: string;
  /** Kilderne bag analysen, fx "Årsrapport 2025". Vises ikke (Jakob runde 6: ingen kildevisning); beholdt for bagudkompatibilitet. */
  analysisSources?: string[];
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
  /**
   * Samme titel opdelt i segmenter, når den nævner en entitet (personens historik: selskabsnavnet
   * med Lasso-ID, så det kan åbnes i værter med drill-down). `title` er altid den rene tekst.
   */
  titleSegments?: TextSegment[];
  /** Dokumentet bag begivenheden (årsrapportens PDF, kun http/https): titlen bliver et link, der henter det (12.3). */
  url?: string;
}

export interface TimelineVM {
  lassoId: string;
  events: TimelineEventVM[];
}

/**
 * Én nyhed (katalog 12, "Nyheder"). To kilder: Lasso News (POST /modules/news) og Paqle
 * (GET /data/paqle/{lassoId}/news), se docs/endpoints-risiko-nyheder.md.
 */
export interface NewsItemVM {
  source: string;
  url?: string;
  /** ISO-tidsstempel; komponenten viser relativ tid under 7 dage, ellers dato. */
  time?: string;
  headline: string;
  excerpt?: string;
  /** Sprogkode eller -navn, når artiklen ikke er dansk, fx "engelsk". */
  language?: string;
  /** Dansk etiket for Lasso News' nyhedstype, fx "Nyt regnskab" eller "Bestyrelsesændring". */
  typeLabel?: string;
  /**
   * Paqles tekstsegmenter for overskrift/uddrag, med `highlight:true` på det stykke, der er
   * virksomhedens navn (regel 17: navn i fed, ikke koral). Bruges i stedet for en gættet
   * tekstsøgning, når de findes.
   */
  headlineSegments?: TextSegment[];
  extractSegments?: TextSegment[];
  /** 26h.6: nyhedstjenesten bag artiklen ("Paqle" eller "Lasso News"), til kortets bundlinje "kilde Paqle". */
  provider?: string;
  /** 26h.6: kort note forrest i bundlinjen, fx "Eksempeldata". */
  note?: string;
}

export interface NewsVM {
  lassoId: string;
  items: NewsItemVM[];
  /** Hvilke af de to kilder (Lasso News, Paqle) der faktisk bidrog, til sektionens kildevisning. */
  sources?: string[];
  /** Nyeste posts tidsstempel på tværs af kilder, til kildevisningns "opdateret …". */
  updatedAt?: string;
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
  /** Katalog 20.1: P-enhedens telefonnummer fra CVR (nuværende). Udeladt, når CVR ikke har et. */
  phone?: string;
  /** Katalog 20.1: P-enhedens e-mail fra CVR (nuværende). Udeladt, når CVR ikke har en. */
  email?: string;
}

export interface ProductionUnitsVM {
  lassoId: string;
  units: ProductionUnitVM[];
  /** Sat, når virksomheden har flere end de viste enheder (højst 25 hentes med detaljer). */
  total?: number;
}

/** Katalog 20: én bygning i BBR-bygningstabellen. */
export interface BuildingVM {
  number?: number;
  usage?: string;
  builtYear?: number;
  floors?: number;
  areaM2?: number | null;
  /** Antal enheder i bygningen; "-" når ikke relevant (fx garage). */
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
  /**
   * Katalog 20.2: matrikelpolygon og bygningsomrids i et lokalt, metrisk koordinatsystem (x mod øst,
   * y mod nord), så kortet kan tegnes i målestok. `selected` er bygningsnummeret med koral kant.
   * Live-kilde (Datafordeleren/MAT og BBR) er ubekræftet; uden geometri vises tom tilstand.
   */
  geometry?: {
    parcel: [number, number][];
    buildings?: { number?: number; polygon: [number, number][] }[];
    selected?: number;
  };
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
  /**
   * CHR-nummer for den ejendom, denne besætning hører til. Kan afvige fra
   * `LivestockVM.chrNumber` (virksomhedens første ejendom), når virksomheden har flere.
   */
  chrNumber?: string;
  /** Ejendommens adresse og kommune, fx "Orevej 5, 3660 Stenløse (Egedal)". */
  propertyAddress?: string;
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
  /**
   * Forklaring til tom-tilstanden: enten at CHR-svarets struktur ikke er verificeret endnu,
   * eller at Ejendomme-modulet mangler i abonnementet (401/403/404).
   */
  unavailableReason?: string;
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
  /** Syntetisk knude for lovligt uregistreret ejerskab under 5 % ("{lassoId}_UNKNOWN" i ejergrafen). */
  unknown?: boolean;
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
  /** 14.3: beregnet indirekte andel i reelle-ejere-visningen; labelen skrives "Reelt 22 %". */
  beneficial?: boolean;
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

/**
 * Stabil nøgle for et ejerdiagram, så UI og server finder samme graf. Roden er en virksomhed
 * (`company`) eller en person (`person`, personsidens ejerskaber); nøglen har samme form.
 */
export function ownershipGraphKey(g: { company?: string; person?: string; ingoingDepth: number; outgoingDepth: number; onDate?: string }): string {
  return `${g.company ?? g.person ?? ""}|${g.ingoingDepth}|${g.outgoingDepth}|${g.onDate ?? ""}`;
}

/**
 * Den entitet, en tidslinje, nyhedsliste eller et ejerdiagram handler om: virksomheden eller
 * personen (præcis én af dem er sat, se spec.ts). Nøglen i Dataset (timeline, news) og fejlnøglen.
 */
export function entityRefOf(c: { company?: string; person?: string }): string {
  return c.company ?? c.person ?? "";
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
  /** ISO-valuta for omsætning/bruttofortjeneste/resultat, når den ikke er DKK (fx "EUR"). */
  currency?: string;
  /** Bruttofortjeneste over tid, ældste først, til sparklines. */
  trend?: number[];
  /** Lassos score 0 (lav risiko) til 100 (høj), når kilden har den (katalog 10). Mobilkortet viser den som fjerde tal. */
  score?: number | null;
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
  /** Observationstypen fra Lasso, fx "DirectBankruptcies" (docs/endpoints-risiko-nyheder.md). */
  type?: string;
  /** Lasso kunne ikke beregne observationen (fx manglende data); vises som ren tekst, ingen badge. */
  notAvailable?: boolean;
}

export interface ObservationsVM {
  lassoId: string;
  observations: ObservationRowVM[];
  /** Hvornår Lasso sidst gennemgik virksomheden (også når listen er tom, katalog 17). */
  checkedAt?: string;
  /** Datakilder til kildevisningn, fx ["CVR", "regnskab", "ledelse"]. */
  sources?: string[];
  /**
   * Indirekte observationer (fx konkursrelationer), der egentlig måler en tilknyttet person
   * eller et tilknyttet selskab, grupperet pr. entitet (relatedObservations i det bekræftede
   * svar - nøglerne kan være både personer og selskaber). Navnet slås op af LiveProvider, hvor
   * det kan findes; ellers vises entitetens Lasso-ID.
   */
  related?: { lassoId: string; name?: string; rows: ObservationRowVM[] }[];
  /** Svarets versionsstempel (bekræftet felt 27.09.2026, ubrugt indtil videre). */
  version?: string;
  /** En samlet score i det bekræftede svar (27.09.2026); skalaen er ikke dokumenteret endnu, vises ikke i UI'en. */
  score?: number;
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
  /** Katalog 22/26e.8: revisorhistorik, ældste først; perioder som ÅÅÅÅ-MM-DD. Kun demodata indtil videre. */
  history?: { name: string; from?: string; to?: string }[];
  /** 22.2: hvad tjekket bygger på, fx "Baseret på CVR-roller og ejerskab, 3 led". */
  basis?: string;
  /** 26e.8: revisors påtegning, fx "Revisionspåtegning, uden forbehold". */
  opinion?: string;
  /** 26e.8: regnskabet, revisor er hentet fra, fx "Årsrapport 2025". */
  report?: string;
  /** 26e.8: uafhængighed som tjeklinjer (ok = grønt flueben, ellers gult "!"). Uden dem bruges relationerne. */
  checks?: { label: string; sub?: string; ok: boolean }[];
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
  /**
   * Katalog 10.1, hente-tilstande: "notfetched" = kan hentes (handling koster, stiplet ramme),
   * "fetching" = henter (fuld ramme, spinner, 4 px fremdriftsbjælke), "unavailable" = kan ikke hentes
   * (grå flade, altid med årsag). Udeladt = "ok", når score er sat, ellers "ikke oplyst".
   */
  state?: "ok" | "notfetched" | "fetching" | "unavailable";
  /** Årsagen i "unavailable" (og forklaringen i "notfetched"). */
  reason?: string;
  /** Prisen for at hente, fx "1 kredit". Vises i "notfetched". */
  cost?: string;
  /** Fremdrift 0–1 i "fetching"; udeladt = ubestemt (bjælken glider). */
  progress?: number;
  /** Nøgle-værdi-linjer under måleren, fx Kreditmaksimum og International score. */
  facts?: { label: string; value: string }[];
  /** Hvad scoren bygger på, fx "Regnskab 2025, status". Vises ikke i scorekortet (Jakob 30.09); kun data. */
  basis?: string;
  /**
   * Katalog 18.1 (LXL-0): "Hvad trækker scoren", op til 4 forklarende faktorer med tone (ok = trækker ned mod lav
   * risiko, warning/danger = trækker op). Kun når scoremodellen leverer dem; ellers vises kun ¼-kortet.
   */
  factors?: { label: string; tone: "ok" | "warning" | "danger" }[];
  /** Katalog 26d.7: scoren over de seneste 24 måneder, ældste først (datoer ÅÅÅÅ-MM-DD). Kun demodata. */
  history?: { date: string; score: number }[];
  /** Katalog 26d.7: seneste ændringer i scoren med årsag, nyeste først. `delta` i point (+ = højere risiko). */
  changes?: { date: string; label: string; delta: number }[];
  /** Katalog 26d.7: kort note til højre for "Udvikling, 24 måneder", fx "eksempeldata før 09.2026". */
  historyNote?: string;
}

/* ---------- Katalog 18.2: scorehistorik (én hentning = ét punkt) ---------- */

/** Én hentning af scoren. `date` er ÅÅÅÅ-MM-DD; `label` er kildens egen vurderingstekst (lav/moderat/høj). */
export interface ScorePointVM {
  date: string;
  score: number;
  label?: string;
}

/**
 * Scorehistorik (18.2): hver hentning er et punkt, sorteret stigende efter dato. Skalaen er 0 = lav
 * risiko til 100 = høj risiko. Tom `points` med `reason` = ingen historik (fx ingen live datakilde).
 */
export interface ScoreHistoryVM {
  lassoId: string;
  points: ScorePointVM[];
  reason?: string;
  source?: string;
  updated?: string;
}

/* ---------- Katalog 13.6 og 13.10: branchetal (median pr. år) ---------- */

/**
 * Branchens median pr. år for virksomhedens hovedbranche (DB07). Bruges af linjegrafen som indeks
 * (13.6) og af nøgletalsmåleren som branchemærke (13.10). Live-kilden er UBEKRÆFTET
 * (docs/lasso-endpoints.md, "Ubekræftet: branchetal"); "unavailable" med årsag, når den mangler.
 */
export interface IndustryBenchmarkVM {
  lassoId: string;
  state: "ok" | "unavailable";
  reason?: string;
  industryCode?: string;
  industryText?: string;
  /** Antal virksomheder i medianen. */
  peers?: number;
  /** Stigende efter år; nøglerne er nøgletallene (Metric). */
  years: { year: number; median: Partial<Record<Metric, number | null>> }[];
  source?: string;
  updated?: string;
}

/* ---------- Katalog 13.11: heatmap, aktivitet pr. måned i en overvågningsliste ---------- */

export interface ActivityHeatmapVM {
  listName?: string;
  /** Månederne som "ÅÅÅÅ-MM", ældste først. */
  months: string[];
  /** Én række pr. ændringstype; `counts[i]` hører til `months[i]`. */
  rows: { type: ChangeType; counts: number[] }[];
  total: number;
  source?: string;
  updated?: string;
  emptyReason?: string;
}

/** Stabil nøgle for et heatmap (liste, antal måneder, typer). */
export function activityHeatmapKey(c: { list?: string; months?: number; types?: readonly ChangeType[] }): string {
  return `${c.list ?? ""}|${c.months ?? 12}|${(c.types ?? []).join(",")}`;
}

/**
 * Heatmap fra ændringer (13.11): tæller ændringer pr. måned og type for de seneste `months` måneder til
 * og med `now`s måned. Foldede rækker ("5 virksomheder") tæller med deres antal. Rækker uden ændringer
 * i hele perioden udelades, medmindre `types` er givet.
 */
export function buildActivityHeatmap(
  entries: readonly Pick<ChangeEntryVM, "type" | "at" | "count">[],
  opts: { months: number; now?: Date; types?: readonly ChangeType[]; listName?: string; source?: string; updated?: string; emptyReason?: string },
): ActivityHeatmapVM {
  const now = opts.now ?? new Date();
  const months: string[] = [];
  for (let i = opts.months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const index = new Map(months.map((m, i) => [m, i]));
  const types = opts.types ?? CHANGE_TYPES;
  const counts = new Map<ChangeType, number[]>(types.map((t) => [t, months.map(() => 0)]));
  let total = 0;
  for (const e of entries) {
    const row = counts.get(e.type);
    const i = index.get(e.at.slice(0, 7));
    if (!row || i === undefined) continue;
    const n = e.count ?? 1;
    row[i]! += n;
    total += n;
  }
  const rows = types.map((type) => ({ type, counts: counts.get(type)! })).filter((r) => opts.types || r.counts.some((n) => n > 0));
  return { listName: opts.listName, months, rows, total, source: opts.source, updated: opts.updated, ...(opts.emptyReason ? { emptyReason: opts.emptyReason } : {}) };
}

/* ---------- Katalog 13.12: kort med adresse, P-enheder og klynger ---------- */

/** Ét punkt på kortet. "focus" = virksomhedens adresse (ink-nål), "related" = P-enheder og relaterede adresser (blå ring). */
export interface MapPointVM {
  id: string;
  kind: "focus" | "related";
  name: string;
  address?: string;
  /** WGS84. */
  lat: number;
  lon: number;
  /** Fx "P-nr. 1000000021" eller "8 ansatte". */
  meta?: string;
  lassoId?: string;
}

export interface MapVM {
  lassoId: string;
  points: MapPointVM[];
  /** Adresser uden koordinater (vises som tekst under kortet). */
  missing?: number;
  emptyReason?: string;
  source?: string;
  updated?: string;
}

/* ---------- Katalog 17: kreditvurdering fra Creditsafe (egen skala A–E, blandes aldrig med 0–100) ---------- */

/** Creditsafes internationale score: A (meget lav risiko) til E (meget høj risiko). */
export const CREDIT_SCORES = ["A", "B", "C", "D", "E"] as const;
export type CreditScore = (typeof CREDIT_SCORES)[number];

/** Én vurdering fra Creditsafe (GET /data/creditsafe/rating/{cvr}, felterne `current` og `previous`). */
export interface CreditAssessment {
  creditMax?: number | null;
  /** ISO-valuta for kreditmaksimum, fx "DKK". */
  creditCurrency?: string;
  internationalScore?: CreditScore;
  /** Creditsafes egen tekst til bogstavet, fx "Low". */
  internationalDescription?: string;
  localScore?: number | null;
  /** Creditsafes tekst til den lokale score, fx "Low Risk". */
  localDescription?: string;
}

/**
 * Kreditvurdering fra Creditsafe via Lasso. Kræver Creditsafe-tilføjelsen til Lasso-abonnementet;
 * uden den er tilstanden "locked". Modellen beder aldrig om en ny beregning (skipCache), fordi det
 * koster en kredit; se docs/endpoints-creditsafe.md.
 */
export interface CreditRatingVM {
  lassoId: string;
  cvr?: string;
  /**
   * Ingen adgang (tilkøb), ikke beregnet endnu, eller fejl. "purchase": adgang, men vurderingen er ikke
   * købt for denne virksomhed endnu (betales pr. styk, `price` kreditter); kortet viser købstrinnet.
   */
  state: "ok" | "locked" | "unavailable" | "error" | "purchase";
  /** Pris i kreditter for ét opslag (state "purchase"). Standard 1. */
  price?: number;
  reason?: string;
  current?: CreditAssessment;
  previous?: CreditAssessment;
  /** Dato for seneste ændring af vurderingen (ÅÅÅÅ-MM-DD). */
  latestChange?: string;
  /** Link til Creditsafes kreditrapport som PDF (kun http/https). */
  pdfUrl?: string;
  source: string;
  updated?: string;
  /** Cache hos Lasso: 24 timer pr. organisation; ny beregning koster en kredit og tager 5–45 s. */
  cachedUntil?: string;
  /** Kreditter tilbage på kontoen (18.3, bekræft hentning). Ubekræftet i Lassos API; udeladt = ingen "Hent ny vurdering". */
  creditBalance?: number;
}

/* ---------- Katalog 21: overvågning og notifikationer ---------- */

/** Ændringstyper i overvågningsfeedet, i den rækkefølge typefilteret og indstillingerne viser dem. */
export const CHANGE_TYPES = ["regnskab", "ledelse", "ejerskab", "status", "stamdata", "kredit"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  regnskab: "Regnskab",
  ledelse: "Ledelse",
  ejerskab: "Ejerskab",
  status: "Status",
  stamdata: "Stamdata",
  kredit: "Kredit",
};

/** Én ændring i en overvåget virksomhed (katalog 21, "Ændringsfeed"). */
export interface ChangeEntryVM {
  lassoId?: string;
  companyName: string;
  type: ChangeType;
  /** Beskrivelsen, fx "Årsrapport 2025 offentliggjort, bruttofortjeneste 96,4 mio. kr. (+12,1 %)". */
  text: string;
  /** Sat sammen ved en statusændring, vist som "fra → til" (fra gennemstreget, til i mørk rød). */
  from?: string;
  to?: string;
  /** ISO-tidsstempel med klokkeslæt. */
  at: string;
  /** Fx "CVR" eller "Kredit". */
  source: string;
  read: boolean;
  /** Foldet række: antal virksomheder med samme lille ændring samme dag ("5 virksomheder"). */
  count?: number;
  /** Navnene bag en foldet række, til "Vis alle". */
  companies?: string[];
}

export interface ChangeFeedVM {
  /** Overvågningslistens navn, fx "Kunder". */
  listName?: string;
  /** Antal dage feedet dækker. */
  days: number;
  entries: ChangeEntryVM[];
  /** Samlet antal ændringer i perioden (kan være større end entries, når mange er foldet). */
  total: number;
  source?: string;
  updated?: string;
  /** Forklaring til tom-tilstanden, fx når ingen liste overvåges. */
  emptyReason?: string;
}

/** Dage i et ændringsfeed: det angivne antal, ellers 30 for én virksomhed og 7 for en overvågningsliste. */
export function changeFeedDays(c: { company?: string; days?: number }): number {
  return c.days ?? (c.company ? 30 : 7);
}

/** Stabil nøgle for et ændringsfeed, så UI og server finder samme data (én virksomhed: "company:<id>|…"). */
export function changeFeedKey(c: { list?: string; company?: string; days?: number; types?: readonly ChangeType[] }): string {
  return `${c.company ? `company:${c.company}` : (c.list ?? "")}|${changeFeedDays(c)}|${(c.types ?? []).join(",")}`;
}

/**
 * Folder mange små ændringer af samme type samme dag til én række ("5 virksomheder"), som kataloget
 * foreskriver. Kun stamdata og kredit foldes, og først fra `min` ændringer; status, regnskab, ledelse
 * og ejerskab står altid hver for sig. Rækkefølgen bliver nyeste først.
 */
export function foldChangeEntries(entries: readonly ChangeEntryVM[], min = 3): ChangeEntryVM[] {
  const sorted = [...entries].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const foldable = (e: ChangeEntryVM) => e.type === "stamdata" || e.type === "kredit";
  const keyOf = (e: ChangeEntryVM) => `${e.type}|${e.at.slice(0, 10)}|${e.text}`;
  const groups = new Map<string, ChangeEntryVM[]>();
  for (const e of sorted) if (foldable(e)) groups.set(keyOf(e), [...(groups.get(keyOf(e)) ?? []), e]);
  const emitted = new Set<string>();
  const out: ChangeEntryVM[] = [];
  for (const e of sorted) {
    if (!foldable(e)) {
      out.push(e);
      continue;
    }
    const key = keyOf(e);
    const g = groups.get(key) ?? [e];
    if (g.length < min) {
      out.push(e);
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    out.push({ ...e, count: g.length, companies: g.map((x) => x.companyName), read: g.every((x) => x.read) });
  }
  return out;
}

/* Gem-laget (docs/gem-lag.md): brugerens gemte virksomheds- og personsider. */
export type SavedPageKind = "company" | "person";
/** Hvordan siden kom på listen: manuelt (tool eller knap), via et signeret link, eller sendt fra et eksternt system. */
export type SavedPageOrigin = "manual" | "link" | "send";
export const SAVED_PAGE_ORIGINS: readonly SavedPageOrigin[] = ["manual", "link", "send"];

export interface SavedPageVM {
  lassoId: string;
  kind: SavedPageKind;
  /** Navnesnapshot fra gemmetidspunktet; selve siden viser altid friske data. */
  name: string;
  cvr?: string;
  /** Visningens focus (fx "oekonomi"), når siden blev gemt fra en fokusvisning. */
  focus?: string;
  note?: string;
  origin: SavedPageOrigin;
  savedAt: string;
  /** Signeret link til den hostede side (/e/<lassoId>), sat af serveren. */
  url?: string;
}

export interface SavedPagesVM {
  /** Nyeste først. */
  pages: SavedPageVM[];
  /** Antal gemte sider i alt for brugeren af den valgte slags (før limit). */
  total: number;
  kind: SavedPageKind | "all";
  limit: number;
}

/** Stabil nøgle for en gemt-liste i Dataset.savedPages. */
export function savedPagesKey(c: { kind?: SavedPageKind | "all"; limit?: number }): string {
  return `${c.kind ?? "all"}|${c.limit ?? 20}`;
}

/* ---------- Katalog 28: øvrige datatyper (fusioner, Statstidende, regnskabspublicering) ---------- */

/** Ét selskab i en fusion/spaltning (28.6). */
export interface MergerPartyVM {
  name: string;
  lassoId?: string;
  /** Ophørte ved fusionen/spaltningen (vises i muted med "ophørt ved fusionen"). */
  ceased?: boolean;
  /** 28.6: CVR-nummeret under navnet ("CVR …, ophørt ved fusionen"). */
  cvr?: string;
  /** 28.6: selskabets rolle i hændelsen, fx "fortsættende selskab", "afgivende selskab", "modtagende, nystiftet". */
  role?: string;
}

/** Katalog 28.6: én fusion eller spaltning, "fra → til". */
export interface MergerEventVM {
  date?: string;
  type: "Fusion" | "Spaltning";
  from: MergerPartyVM[];
  to: MergerPartyVM[];
}

/** Katalog 28.8: én bekendtgørelse i Statstidende. */
export interface AnnouncementVM {
  date?: string;
  /** Fx "Dekret om konkurs", "Rekonstruktion", "Likvidation", "Indkaldelse af kreditorer". */
  type: string;
  /** Alvor, der styrer farven (statusgrupperne, Jakob 29.09.2026): problem (konkurs, rekonstruktion, tvangsopløsning) "bankrupt" i mørk rød, midlertidig (frivillig likvidation) "warning", øvrige tekst. */
  severity: "bankrupt" | "warning" | "neutral";
  /** Statstidendes egen tekst (foldes til to linjer). */
  text?: string;
  /** Link til bekendtgørelsen (kun http/https). */
  url?: string;
  /** 28.8: kildevisning pr. bekendtgørelse, fx "Statstidende, sagsnr. 1234, kreditorinformation vedlagt". */
  source?: string;
}

/** Katalog 28.2: ét offentliggjort regnskab. */
export interface PublicationVM {
  /** Offentliggørelsesdato (ÅÅÅÅ-MM-DD). */
  published?: string;
  /** Periodens start (28.2: "01.01–31.12.2025"). */
  periodStart?: string;
  /** Periodens slut, så klik kan åbne 19 med perioden valgt. */
  periodEnd?: string;
  year?: number;
  kind: "Årsrapport" | "Halvår" | "Kvartal";
  /** 28.2: årets resultat i perioden (negativt i rødt) og den tidligere værdi ved korrektion. */
  profit?: { value: number | null; previous?: number | null };
  /** Korrigeret regnskab: udråbstegn-ikon og den tidligere værdi som "før …". */
  corrected?: boolean;
  /** Hovedtallet (bruttofortjeneste/omsætning) og dets tidligere værdi ved korrektion. */
  figure?: { label: string; value: number | null; previous?: number | null };
  /** Årsrapporten som PDF (kun http/https): "Årsrapport ÅÅÅÅ" er et download-link (Jakob 01.10). */
  url?: string;
}

/** Katalog 28.2/28.6/28.8: begivenheder for én virksomhed ud over CVR-tidslinjen. */
export interface CompanyEventsVM {
  lassoId: string;
  mergers: MergerEventVM[];
  announcements: AnnouncementVM[];
  publications: PublicationVM[];
  /** Hvornår Lasso hentede oplysningerne (kildevisningn). */
  updated?: string;
}

/** Alt det data, én visning skal bruge, slået op på nøgle. */
/** Portalens relationsgrupper (Stamoplysninger: nuværende og historiske relationer). */
export type RelationGroup = "adm" | "direktion" | "bestyrelse" | "stiftere" | "legale-ejere" | "reelle-ejere" | "oevrige";

/** Én relation (person eller selskab) i én gruppe med periode. */
export interface RelationEntryVM {
  group: RelationGroup;
  name: string;
  lassoId?: string;
  /** Underrolle i parentes efter navnet, fx "Formand", "Suppleant", "Adm. dir". */
  role?: string;
  /** Legale ejere: ejerandel og stemmeret som interval, fx "15–19,99 %". */
  share?: string;
  votes?: string;
  from?: string;
  to?: string;
  current: boolean;
}

/** Én stamdataoplysning over tid (portalens "Stamdata historik"), nyeste først. */
export interface HistoryFieldVM {
  key: string;
  label: string;
  entries: { value: string; from?: string; to?: string }[];
}

/**
 * Virksomhedens historik (GET /{lassoId}/history, samme form som personhistorikken: grupper med
 * { value, from, to, current }). UBEKRÆFTET for virksomheder; fejler kaldet, bygges relationerne af
 * de nuværende roller og ejere (source "current"), og stamdatahistorikken er tom med en note.
 */
export interface CompanyHistoryVM {
  lassoId: string;
  relations: RelationEntryVM[];
  fields: HistoryFieldVM[];
  source: "history" | "current";
  note?: string;
}

export interface Dataset {
  source: DataSourceKind;
  generatedAt: string;
  companies: Record<string, CompanyVM>;
  financials: Record<string, FinancialsVM>;
  /** Katalog 08: kontaktblok og kontaktpersoner. */
  contact: Record<string, ContactVM>;
  contactPersons: Record<string, ContactPersonsVM>;
  /** Katalog 19: fuldt regnskab (resultatopgørelse, balance, pengestrøm), slået op pr. Lasso-ID. */
  financialStatements: Record<string, FinancialStatementsVM>;
  people: Record<string, PersonRowVM[]>;
  ownership: Record<string, OwnershipVM>;
  beneficialOwnership: Record<string, BeneficialOwnershipVM>;
  textSections: Record<string, TextSectionsVM>;
  timeline: Record<string, TimelineVM>;
  news: Record<string, NewsVM>;
  searches: Record<string, SearchResultVM>;
  scores: Record<string, ScoreVM>;
  /** Katalog 18.2: scorehistorik pr. Lasso-ID. */
  scoreHistories: Record<string, ScoreHistoryVM>;
  /** Katalog 13.6/13.10: branchetal pr. Lasso-ID (virksomhedens hovedbranche). */
  industryBenchmarks: Record<string, IndustryBenchmarkVM>;
  /** Katalog 13.11: heatmap pr. activityHeatmapKey. */
  activityHeatmaps: Record<string, ActivityHeatmapVM>;
  /** Katalog 13.12: kortpunkter pr. Lasso-ID. */
  maps: Record<string, MapVM>;
  observations: Record<string, ObservationsVM>;
  /** Katalog 17: kreditvurdering fra Creditsafe pr. Lasso-ID. */
  creditRatings: Record<string, CreditRatingVM>;
  auditorIndependence: Record<string, AuditorIndependenceVM>;
  /** Katalog 20: produktionsenheder, ejendomme/BBR og CHR, slået op pr. Lasso-ID. */
  productionUnits: Record<string, ProductionUnitsVM>;
  properties: Record<string, PropertiesVM>;
  livestock: Record<string, LivestockVM>;
  /** Ejerdiagrammer pr. ownershipGraphKey. */
  ownershipGraphs: Record<string, OwnershipGraphVM>;
  /** Katalog 16: personer (Lasso-ID "CVR-3-…") og deres netværk. */
  persons: Record<string, PersonVM>;
  personNetworks: Record<string, PersonNetworkVM>;
  /** Katalog 15.3: personsøgninger (LassoPersonTable) pr. personSearchKey. Fejlnøgle "personSearch:<key>". */
  personSearches?: Record<string, PersonSearchResultVM>;
  /** Katalog 21: ændringsfeed pr. changeFeedKey. */
  changeFeeds: Record<string, ChangeFeedVM>;
  /** Katalog 28.2/28.6/28.8: fusioner, Statstidende og regnskabspublicering pr. Lasso-ID. */
  companyEvents: Record<string, CompanyEventsVM>;
  /** Relationer og stamdata over tid (LassoRelationsTable, LassoCompanyHistory). */
  companyHistories: Record<string, CompanyHistoryVM>;
  /** Gem-laget: gemte sider pr. savedPagesKey (LassoSavedPages). Fejlnøgle "savedPages:<key>". */
  savedPages: Record<string, SavedPagesVM>;
  /** Gem-laget: hvilke Lasso-ID'er i visningen brugeren allerede har gemt (til Gem/Gemt-knappen). */
  savedIds?: string[];
  /** Katalog 08/16: hvilke Lasso-ID'er i visningen brugeren allerede overvåger ("Overvåger"). Sættes af værten. */
  monitoredIds?: string[];
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
    financialStatements: {},
    people: {},
    ownership: {},
    beneficialOwnership: {},
    textSections: {},
    timeline: {},
    news: {},
    searches: {},
    scores: {},
    scoreHistories: {},
    industryBenchmarks: {},
    activityHeatmaps: {},
    maps: {},
    observations: {},
    creditRatings: {},
    auditorIndependence: {},
    productionUnits: {},
    properties: {},
    livestock: {},
    ownershipGraphs: {},
    persons: {},
    personNetworks: {},
    personSearches: {},
    companyEvents: {},
    companyHistories: {},
    changeFeeds: {},
    savedPages: {},
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
