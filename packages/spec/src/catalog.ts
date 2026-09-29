import { OPERATORS, type Criterion } from "./criteria.js";
import { FIELDS, FIELD_BY_KEY, OPERATORS_BY_TYPE } from "./fields.js";
import { CHANGE_TYPES } from "./models.js";
import { METRICS, TABLE_COLUMNS, type ComponentType, type ViewComponent, type Width } from "./spec.js";

/**
 * Komponentkataloget, som modellen læser. ChatGPT læser ikke resources, så
 * kataloget skal stå i tool-beskrivelser og serverinstruktioner. Beskrivelserne
 * er vigtigere end koden: det er dem, modellen vælger ud fra.
 */
export interface CatalogEntry {
  type: ComponentType;
  title: string;
  description: string;
  props: string;
}

/**
 * Kompositionsregler fra designguidens trin 23. Står over kataloget i tool-
 * beskrivelserne, så modellen vælger værktøj, antal og rækkefølge før den vælger komponent.
 */
export const COMPOSITION_RULES = `Komposition (guide 23):
- Én virksomhed: brug show_company med focus. Serveren henter data og bygger selv siden efter virksomhedens data. Byg IKKE selv en virksomhedsside med render_view. Routing efter spørgsmål: bredt ("fortæl om X") → overblik; økonomi, omsætning, resultat, nøgletal, soliditetsgrad, "hvordan går det" → oekonomi; fuldt regnskab, resultatopgørelse, balance, pengestrøm, "alle posterne" → regnskab; ejere, reelle ejere, koncern → ejerskab; direktion, bestyrelse, udskiftning → ledelse; røde flag, "kan vi handle med dem", kreditvurdering, Creditsafe → risiko; "hvad er der sket", nyheder → historik; kontaktoplysninger, telefon, e-mail, web, kontaktpersoner → kontakt. Snævre stamdataspørgsmål ("hvem er revisor", "hvornår stiftet", "hvor mange ansatte") → overblik.
- Én person → show_person med focus: "hvem er X" → overblik; "hvor sidder X i bestyrelser", roller over tid → roller; "hvem sidder X sammen med" → netvaerk; "hvilke selskaber ejer X" → ejerskab; "har X været i konkurser" → risiko; "hvad er der sket", nyheder om X → historik. Byg ikke personsider med render_view.
- Flere virksomheder → render_view: LassoCompareTable (2–6 navngivne, flere nøgletal), LassoRanking (2–10 navngivne, ét nøgletal) eller LassoLineChart (2 virksomheder, ét nøgletal over tid); mange fundet med kriterier → search_companies eller LassoCompanyTable. Aldrig én enkeltvisning pr. virksomhed.
- render_view til én virksomhed kun, når brugeren beder om elementer, ingen focus dækker (fx LassoStackedBarChart, LassoProductionUnits, LassoProperties, en egen vurdering i LassoSummary), eller om en kombination på tværs af focus (fx ejere + revisor, resultatopgørelse + ejere). Læg da ALT i én spec: LassoCompanyHead først, dernæst det bestilte, og LassoSummary som sidste sektion.
- ÉN visning pr. svar: kald højst ét af show_company, show_person, search_companies og render_view pr. brugerbesked, og kun én gang. Aldrig show_company og render_view efter hinanden.
- render_view er ét dashboard (layout 'dashboard', standard): 12-kolonne-gitter, hver komponent i sin bredde (width: quarter ¼, third ⅓, half ½, two-thirds ⅔, three-quarters ¾, full). Udelad width for standardbredden. Rækkens bredder summerer til 12 (fx ½+½, ⅔+⅓, ¾+¼, ⅓+⅓+⅓, ¼+¼+½). Hoved, nøgletal, tabeller og fulde regnskaber står i fuld bredde; to halve (fx graf + LassoKeyValueList, LassoPersonList + LassoOwnerList) står side om side, så læg dem efter hinanden. Efterlad aldrig en halv alene i en række: giv den width 'full' eller en makker. En ¼ (fx LassoRelations) står ved siden af en ¾.
- Højst én graf pr. visning. Flere grafer stables aldrig; vælg den ene, spørgsmålet peger på (1 nøgletal → LassoBarChart, 2–3 → LassoGroupedBarChart, 4+ eller "tabel" → LassoMultiYearTable).`;

/**
 * Layoutmodeller fra Paper 30 "Fra spørgsmål til skærm" (node J48-0). Vælg først svarniveau, så
 * mønster, så elementer. Bredden (chat, mobil, portal) ændrer kun foldningen, aldrig elementerne
 * eller deres rækkefølge. Står efter COMPOSITION_RULES i tool-beskrivelserne.
 */
export const LAYOUT_RULES = `Layout (Paper 30): vælg først svarniveau, så mønster, så elementer.
Svarniveauer: A Element = ét spørgsmål, ét element (fx "hvad er omsætningen" → LassoKeyFigureCards med ét metric; "hvem er revisor" → LassoKeyValueList), aldrig to A-svar under hinanden. B Sektion = ét emne, 2–4 elementer i ét mønster; standardsvaret i chatten ("hvordan går det" → mønster 1; "hvem ejer" → mønster 2; "kan vi handle med" → mønster 7; "hvad er der sket" → mønster 6). C Side = det hele ("fortæl om X", "hvem er Y", "sammenlign", målgrupper) → show_company/show_person/search_companies, som bygger hele siden med moduler. Vælg det laveste niveau, der svarer fuldt; svaret vokser via links, aldrig omvendt. Hvert svar starter med identiteten (LassoCompanyHead/LassoPersonHead, kun navnet). Ingen kildelinje nogen steder (Jakob 29.09): answer.source vises ikke. Brug til: answer { next { label, prompt } } på spec'en giver svarets bundlinje (30.1–30.2): ét koral link videre til næste niveau, fx niveau A 'Hvad er omsætningen?' → answer { next: { label: 'Se hele økonomien', prompt: 'Hvordan går det med X?' } }; niveau B → next 'Åbn X i Lasso'. Brug ikke når: visningen er en hel side i portalen (niveau C har logo: true og ingen next). Kræver: intet; alle felter er valgfri.
Mønstre på 12-kolonne-gitteret: 1 Overblik = nøgletalskort fuld, graf ½ + nøgle-værdi-liste ½, lister to og to. 2 Fokus = ét stort element ¾ + fakta ¼ (ejerdiagram + ejerliste, scoremåler + forklaring; LassoRelations er ¼-elementet). 3 Ligeværdige = ½ + ½ med samme vægt (LassoPersonList + LassoOwnerList, LassoIncomeStatement + LassoBalanceSheet i hver sin fane). 4 Liste først = tabel i fuld bredde (LassoCompanyTable) med detaljer ved klik. 5 Sammenligning = én kolonne pr. virksomhed (LassoCompareTable, LassoRanking). 6 Tidslinje = filtre ¼ + kronologisk strøm ¾ (LassoTimeline med filterColumn: true; LassoNews); på tablet og mobil bliver filtrene chips over strømmen. 7 Fortælling = analyse ¾ (LassoSummary) + 3 tal ¼ (LassoKeyFigureCards). 8 Kortgitter = artikler i to kolonner (LassoNews). 9 Harmonika = mange lange sektioner i ét modul. Et modul må kombinere to mønstre over hinanden (graf fuld + tabel fuld), aldrig blande dem i én række.
Regnskab (19): i fuld bredde bruges LassoFinancialStatements (værktøjslinje, 5 år); står opgørelsen i ½ eller ¾ bredde, bruges de kompakte LassoIncomeStatement, LassoBalanceSheet og LassoCashFlow (2 år + ændring). Kun årsregnskaber; poster uden tal udelades.
Mønster 8 og 9 i render_view: giv sammenhængende komponenter samme group { id, pattern, title? }. pattern 'cards' = kortgitter (fx flere korte elementer eller nyheder side om side, to kolonner, én på mobil); pattern 'accordion' = harmonika, når ét svar samler 3+ lange sektioner (fx LassoIncomeStatement, LassoBalanceSheet, LassoCashFlow, LassoTextSections variant 'analyse'), én række pr. komponent med komponentens title som rækkenavn, første række åben. title er gruppens overskrift. toolbar? { primary?: { label, prompt }, actions?: [{ label, prompt }] } giver modulværktøjslinjen (56 px under overskriften, 30.11): primær handling yderst til venstre og op til 3 tekstknapper, hver et opfølgende spørgsmål (fx { label: 'Eksportér', prompt: 'Eksportér nøgletallene for X som CSV' }); udelad den, når modulet ingen handlinger har. Brug ikke group til 1 komponent eller til at blande mønstre i én række.
Gitter (23.1, gridmodel): siden består af bånd, der altid spænder 12 kolonner; et bånd har 1–4 stakke, og en stak stabler 1–n elementer i samme bredde. Tilladte bånd: 12 | 6+6 | 8+4 | 4+8 | 9+3 | 3+9 | 4+4+4 | 3+3+6 | 3+6+3 | 6+3+3 | 3+3+3+3 (⅔+¼ og ¾+⅓ er ulovlige). Hvert element har standardbredde, min/max-bredde, højdeklasse (lav ≤176 px, mellem 177–320, høj 321–640, meget høj >640) og højdeadfærd (fast, voksende; flex = kan fylde restplads med flere rækker, linjer eller et højere plot); se 'Gitter:' i kataloget. Regler: hoved, nøgletalskort/persontal og elementer med min 1/1 står i eget fuldbånd; et højt element er anker, og lave/mellem elementer stables i en smal stak ved siden af (fx ejerdiagram ⅔ | ejerliste + reelle ejere + ledelse ⅓), til stakken er mindst 85 % af ankerets højde; to høje elementer står ½+½; stakkene i et bånd må højst afvige 15 % i højde, og den korteste stak strækkes, så der aldrig er huller; aldrig en ½ alene i et bånd (giv den en makker eller fuld bredde); et element står aldrig smallere end sit minimum. show_company og show_person pakker selv båndene; i render_view vælger du bredderne efter samme regler.
Foldning: ¾+¼ og ⅔+⅓ bliver fuld+fuld under 1200; ⅓+⅓+⅓ bliver ½+½+fuld under 1200; ½+½ holder til 768 og stabler under; nøgletalskort bliver 2×2 under 768; tabeller bliver kortlister under 768; grafer viser maks 5 punkter. Chatten bruger tablet-reglerne (640–900 px); kun Claude på mobil bruger mobilreglerne. Variationen ligger i valget af mønster og elementer, ikke i nye former: samme spørgsmål giver samme mønster hver gang.`;

/** Højdeklasse i elementets standardbredde (23.1): lav ≤ 176 px, mellem 177–320, høj 321–640, meget høj > 640. */
export type HeightClass = "low" | "medium" | "high" | "very-high";
/** Højdeadfærd (23.1): fast = højden bestemmes af elementet; voksende = højden følger data (med loft og "Se alle"). */
export type HeightBehavior = "fixed" | "growing";
/** Flex (23.1): elementet kan fylde restplads i sin stak med flere rækker, flere linjer eller et højere plot. */
export type FlexKind = "rows" | "lines" | "plot";

/** Et elements plads i 12-kolonne-gitteret (gridmodellen, Paper 23.1/23.2). */
export interface GridRule {
  /** Standardbredde (den bredde, elementet lægges i, når intet andet tvinger). */
  std: Width;
  /** Hård minimumsbredde: smallere gør tekst-, nøgle-værdi- og tabelelementer 30–100 % højere. */
  min: Width;
  max: Width;
  height: HeightClass;
  behavior: HeightBehavior;
  flex?: FlexKind;
}

const g = (std: Width, min: Width, max: Width, height: HeightClass, behavior: HeightBehavior, flex?: FlexKind): GridRule => ({ std, min, max, height, behavior, ...(flex ? { flex } : {}) });

/**
 * Elementtabellen (Paper 23.2, scratchpad/gridmodel.md afsnit 6): standard-, min- og maksbredde,
 * højdeklasse og højdeadfærd pr. komponenttype, målt med demodata på 1200-gitteret.
 * LassoKeyValueList variant 'financials' har sin egen række (gridRuleOf).
 * Udgåede typer (ScoreHistory, AuditorIndependence, CreditRating) har en regel, så gamle visninger pakkes.
 */
export const GRID_RULES: Record<ComponentType, GridRule> = {
  LassoCompanyHead: g("full", "full", "full", "low", "fixed"),
  LassoKeyFigureCards: g("full", "half", "full", "low", "fixed"),
  LassoKeyValueList: g("half", "half", "full", "very-high", "growing", "rows"),
  LassoContact: g("third", "quarter", "half", "medium", "fixed"),
  LassoContactPersons: g("third", "quarter", "half", "medium", "growing", "rows"),
  LassoShortcuts: g("half", "quarter", "full", "low", "fixed"),
  LassoTextSections: g("half", "half", "full", "high", "growing", "lines"),
  LassoSummary: g("full", "half", "full", "high", "growing", "lines"),
  LassoTimeline: g("half", "third", "full", "high", "growing", "rows"),
  LassoNews: g("half", "third", "full", "medium", "growing", "rows"),
  LassoBarChart: g("half", "third", "full", "medium", "fixed", "plot"),
  LassoGroupedBarChart: g("half", "third", "full", "medium", "fixed", "plot"),
  LassoLineChart: g("half", "third", "full", "medium", "fixed", "plot"),
  LassoStackedBarChart: g("half", "third", "full", "medium", "fixed", "plot"),
  LassoWaterfallChart: g("half", "third", "full", "medium", "fixed", "plot"),
  LassoShareBars: g("half", "quarter", "half", "medium", "fixed"),
  LassoKeyFigureGauge: g("third", "quarter", "half", "medium", "fixed"),
  LassoMultiYearTable: g("half", "half", "full", "medium", "growing"),
  LassoIncomeStatement: g("half", "half", "three-quarters", "high", "growing"),
  LassoBalanceSheet: g("half", "half", "three-quarters", "very-high", "growing"),
  LassoCashFlow: g("half", "half", "three-quarters", "high", "growing"),
  LassoFinancialStatements: g("full", "full", "full", "very-high", "growing"),
  LassoPersonList: g("third", "quarter", "half", "medium", "growing", "rows"),
  LassoOwnerList: g("third", "quarter", "half", "low", "growing", "rows"),
  LassoBeneficialOwners: g("third", "quarter", "half", "low", "growing", "rows"),
  LassoOwnershipDiagram: g("two-thirds", "half", "full", "high", "growing", "plot"),
  LassoRelations: g("quarter", "quarter", "half", "medium", "growing"),
  LassoRiskObservations: g("half", "third", "full", "high", "growing", "rows"),
  LassoScoreGauge: g("quarter", "quarter", "half", "medium", "fixed"),
  LassoScoreHistory: g("half", "third", "full", "medium", "fixed", "plot"),
  LassoCreditRating: g("half", "third", "full", "high", "fixed"),
  LassoAuditorIndependence: g("full", "half", "full", "high", "growing"),
  LassoProductionUnits: g("full", "two-thirds", "full", "high", "growing"),
  LassoProperties: g("half", "third", "full", "low", "growing"),
  LassoMap: g("half", "third", "full", "high", "fixed", "plot"),
  LassoRegistration: g("full", "two-thirds", "full", "high", "growing"),
  LassoMergers: g("half", "half", "full", "high", "growing"),
  LassoAnnouncements: g("full", "half", "full", "low", "growing", "rows"),
  LassoPublications: g("half", "half", "full", "high", "growing", "rows"),
  LassoLivestock: g("half", "half", "full", "high", "growing"),
  LassoCompareTable: g("full", "two-thirds", "full", "high", "growing"),
  LassoRanking: g("half", "third", "full", "medium", "growing", "rows"),
  LassoCompanyTable: g("full", "full", "full", "high", "growing", "rows"),
  LassoPersonTable: g("full", "full", "full", "high", "growing", "rows"),
  LassoPersonHead: g("full", "full", "full", "low", "fixed"),
  LassoPersonStats: g("full", "half", "full", "low", "fixed"),
  LassoPersonRoles: g("two-thirds", "half", "full", "medium", "growing", "plot"),
  LassoPersonNetwork: g("half", "third", "full", "medium", "growing", "plot"),
  LassoPersonRisk: g("half", "third", "full", "high", "growing", "rows"),
  LassoPersonFacts: g("third", "quarter", "half", "high", "growing", "rows"),
  LassoChangeFeed: g("full", "half", "full", "very-high", "growing", "rows"),
  LassoHeatmap: g("half", "third", "full", "medium", "fixed"),
  LassoFollowUps: g("full", "full", "full", "low", "fixed"),
  LassoSavedPages: g("full", "full", "full", "high", "growing"),
};

/** Regnskabslisten (09, variant 'financials') har 12 faste rækker: høj og fast, ikke meget høj og voksende. */
const FINANCIALS_LIST_RULE: GridRule = g("half", "half", "full", "high", "fixed", "rows");

/** Gitterreglen for en konkret komponent (varianter kan have deres egen række i elementtabellen). */
export function gridRuleOf(c: Pick<ViewComponent, "type"> & { variant?: unknown }): GridRule {
  if (c.type === "LassoKeyValueList" && c.variant === "financials") return FINANCIALS_LIST_RULE;
  return GRID_RULES[c.type];
}

const WIDTH_LABEL: Record<Width, string> = { quarter: "¼", third: "⅓", half: "½", "two-thirds": "⅔", "three-quarters": "¾", full: "1/1" };
const HEIGHT_LABEL: Record<HeightClass, string> = { low: "lav", medium: "mellem", high: "høj", "very-high": "meget høj" };
const BEHAVIOR_LABEL: Record<HeightBehavior, string> = { fixed: "fast", growing: "voksende" };
const FLEX_LABEL: Record<FlexKind, string> = { rows: "rækker", lines: "linjer", plot: "plot" };

/** Gitterlinjen i kataloget: "Gitter: ½ (⅓–1/1), mellem, voksende, flex rækker." */
export function gridRuleText(r: GridRule): string {
  const range = r.min === r.max ? "kun" : `${WIDTH_LABEL[r.min]}–${WIDTH_LABEL[r.max]}`;
  return `Gitter: ${WIDTH_LABEL[r.std]} (${range === "kun" ? `kun ${WIDTH_LABEL[r.std]}` : range}), ${HEIGHT_LABEL[r.height]}, ${BEHAVIOR_LABEL[r.behavior]}${r.flex ? `, flex ${FLEX_LABEL[r.flex]}` : ""}.`;
}
export { WIDTH_LABEL as GRID_WIDTH_LABEL, HEIGHT_LABEL as GRID_HEIGHT_LABEL, BEHAVIOR_LABEL as GRID_BEHAVIOR_LABEL, FLEX_LABEL as GRID_FLEX_LABEL };

/** Kort note pr. komponent: hvilken show_company-focus viser den allerede. */
const F = (focus: string) => `Dækkes af show_company focus ${focus}; byg kun selv i render_view sammen med andet.`;

export const COMPONENT_CATALOG: readonly CatalogEntry[] = [
  // (c) Virksomhedsfakta -------------------------------------------------------
  {
    type: "LassoCompanyHead",
    title: "Virksomhedshoved",
    description: `Brug til: identitet for én virksomhed øverst i enhver visning om én virksomhed: KUN navnet med status (og binavn) og handlingerne; ingen faktalinje (CVR, form, stiftet, adresse, ansatte, branche) under navnet og ingen skillestreg (Jakob 29.09). CVR, stiftet, form, branche og ansatte står i LassoKeyValueList variant 'company', adressen i LassoContact. Brug ikke når: kun ét stamdatafelt skal vises (LassoKeyValueList variant 'company') eller det gælder flere virksomheder (LassoCompareTable/LassoCompanyTable). Kræver: company, variant?, risk?; findes for alle CVR-virksomheder. variant 'full' (standard) er sidens hoved med handlinger (Overvåg, Gem, Eksportér, Flere); 'compact' (56 px) og 'line' (40 px) står over et enkelt element på svarniveau A/B. risk true henter observationer (10–14 s) og viser 'Se risiko'-linjen ved 50+; kun når spørgsmålet handler om risiko. Status står som ren tekst med CVR's danske navn (NORMAL → Normal, OPLØSTEFTERKONKURS → Opløst efter konkurs) og farve efter gruppe: aktiv (Aktiv, Normal), midlertidig i gul (Fremtid, Uden retsvirkning, Under frivillig likvidation, Under reassumering), problem i rød (Under konkurs, Under tvangsopløsning, Under rekonstruktion, Tvangsopløst, Opløst efter konkurs), inaktiv i muted (Ophørt, Opløst, Opløst efter …, Slettet); ordet bærer altid betydningen. ${F("overblik (og alle andre focus)")} Eksempel: øverst i en render_view-spec om én virksomhed; 'hvad er omsætningen i X' → variant 'line' + LassoKeyFigureCards med ét metric.`,
    props: "company, variant?, risk?",
  },
  {
    type: "LassoKeyValueList",
    title: "Nøgle-værdi-liste",
    description: `Brug til: variant 'company' (standard): revisor, seneste revisorskift, regnskabsperiode, branchekode, kommune og region, telefon, e-mail, web som én liste – stamdataspørgsmål ('hvem er revisor', 'hvilken kommune'). Listen viser også identiteten (CVR-nummer, stiftet, virksomhedsform, branche, ansatte), da LassoCompanyHead kun viser navnet; det, LassoContact viser på samme side (adresse, telefon, e-mail, web), gentages ikke. variant 'financials': de 11 nøgletal (omsætning/bruttofortjeneste, resultat, egenkapital, ansatte, EBITDA, soliditetsgrad, overskudsgrad, likviditetsgrad, balancesum, gæld) plus regnskabsperiode og udgivelsesdato for ÉT år, med årsvælger for de seneste 5 år; exclude udelader nøgletal, der allerede står i LassoKeyFigureCards på siden. Brug ikke når: tallet skal have ændring mod året før (LassoKeyFigureCards), flere år side om side (LassoMultiYearTable), alle regnskabslinjer (LassoIncomeStatement/LassoBalanceSheet), eller det gælder formål/tegningsregler (LassoTextSections). Kræver: company, variant?, exclude?; manglende felter udelades (revisor og regnskabstal står som '-'). Virksomhedsreferencer (revisor, moderselskab) står kun med navnet – ingen CVR, rolle eller andel under; personreferencer må have 'Siden <dato>'. Lister afkortes med 'og 1 mere' ved én ekstra og 'og N flere' ved to eller flere. ${F("overblik, risiko og kontakt (company) samt oekonomi (financials)")} I et svar på niveau B (30.13) står listen kort: years 2 giver årsvælgeren '2025 | 2024', og rows 4 viser fire rækker med 'Se N oplysninger' under; brug ikke rows, når listen er selve svaret. Eksempel: 'Hvem er revisor for Lasso X?' → variant 'company' (eller show_company focus overblik); 'Hvordan går det med X?' i chatten → variant 'financials', title 'Virksomhedsoplysninger', years 2, rows 4.`,
    props: "company, variant? (company | financials), title?, exclude? (kun financials), years? (2–5, kun financials), rows? (1–20)",
  },
  {
    type: "LassoContact",
    title: "Kontaktblok",
    description: `Brug til: telefon, e-mail, web og adresse som klikbare kontaktoplysninger – 'telefonnummer på X', 'hvordan kontakter jeg X'. Brug ikke når: det gælder stamdata som stiftet/form/revisor (LassoKeyValueList variant 'company', som også har kontaktfelterne), eller navngivne personer (LassoContactPersons). Kræver: company; kilden er CVR eller virksomhedens hjemmeside, og komponenten viser tom tilstand, når intet er oplyst. ${F("kontakt (og overblik)")} Eksempel: 'Hvad er telefonnummer og e-mail på Lasso X?' → show_company focus kontakt.`,
    props: "company, title?",
  },
  {
    type: "LassoContactPersons",
    title: "Kontaktpersoner",
    description: `Brug til: navngivne kontaktpersoner fra virksomhedens hjemmeside med rolle/afdeling, telefon og e-mail – 'hvem kan jeg kontakte hos X', 'kontaktpersoner'. Brug ikke når: det gælder direktion/bestyrelse i CVR (LassoPersonList) eller virksomhedens hovednumre (LassoContact). Kræver: company; listen er tom, når hjemmesiden er ukendt eller ingen personer er fundet. Blokken viser 3 personer; 'Se N kontaktpersoner' åbner 'Se alle'-panelet (08.7): på desktop tre kolonner (virksomheden med adresse, CVR, Live Nummer, telefonnumre og e-mailadresser | stillinger pr. afdeling | valgt person med 'Kopiér telefonnummer'/'Kopiér e-mailadresse' og 'Kilder'), på tablet og mobil liste + detalje; intet kan rettes eller gemmes i panelet. ${F("kontakt")} Eksempel: 'Hvem er kontaktpersonerne hos Lasso X?' → show_company focus kontakt.`,
    props: "company, title?",
  },
  {
    type: "LassoShortcuts",
    title: "Genveje",
    description: `Brug til: en række knapper, der åbner et Lasso-værktøj på virksomheden (ejerdiagram, regnskabsanalyse, nøgletal, ejendomme, tinglysning, firmaindsigt) – 'hvad kan jeg ellers se om X', som indgang ved siden af kontaktblokken. Brug ikke når: svaret er selve dataene (vis elementet direkte, fx LassoOwnershipDiagram), eller værten ikke kan åbne sektioner (så vises intet). Kræver: company, tools? (maks 6 synlige, resten under 'Flere'). Dækkes ikke af show_company. Eksempel: render_view med LassoCompanyHead, LassoContact og LassoShortcuts.`,
    props: "company, tools?, title?",
  },
  {
    type: "LassoTextSections",
    title: "Tekstsektioner",
    description: `Brug til: variant 'profil' (standard): formål og tegningsregler fra CVR plus regnskabsanalysens konklusion, resultat og likviditet som korte afsnit – 'hvad laver X', 'formål', 'hvem kan tegne selskabet'. variant 'analyse': hele Lassos regnskabsanalyse (konklusion, resultat, likviditet, balance og kapitalforhold, branchestatistik, revisoroplysninger, spørgsmål til overvejelse), som foldbare afsnit med det første åbent og 'Hent som PDF' i hovedet (19.3: en A4 af hele analysen med alle afsnit foldet ud, 19.6; kun når værten kan eksportere). Branchen står i LassoCompanyHead og vises ikke her. Brug ikke når: feltet er en kort værdi som stiftet/form/revisor (LassoKeyValueList variant 'company'), eller du selv skriver en vurdering (LassoSummary). Kræver: company, variant?; manglende tekster udelades. ${F("overblik (profil) og oekonomi (analyse)")} folded true (kun analyse) folder analysen til 3 linjer med 'Vis mere' på alle bredder, fx i et svar på niveau B i chatten (30.13); brug det ikke, når analysen er hele svaret. Eksempel: 'Hvad er formålet med selskabet X, og hvem kan tegne det?'`,
    props: "company, variant? (profil | analyse), title?, folded? (kun analyse)",
  },
  {
    type: "LassoSummary",
    title: "Resumé",
    description:
      "Brug til: din egen analyse eller vurdering i prosa (uden kildelinje) – 'vurdér', 'opsummér', 'hvad synes du'. Indgår altid som sidste komponent i en render_view-spec sammen med de datakomponenter, vurderingen bygger på (fx LassoCompanyHead + LassoKeyFigureCards + LassoSummary); aldrig som eneste komponent og aldrig som et ekstra kald efter show_company. Du skriver hele 'text' ud fra tal, du allerede kender; komponenten henter intet. Brug ikke når: teksten findes i CVR (LassoTextSections), eller tal alene svarer (LassoKeyFigureCards). Kræver: text (1–4000 tegn), title?, source?, updated?. Dækkes ikke af show_company, men en vurdering af ét emne, som en focus dækker ('hvordan går det økonomisk for X'), er show_company plus 2–3 sætninger i chatten, ikke LassoSummary. Eksempel: 'Vurdér X samlet på økonomi og ejerforhold' → render_view med LassoCompanyHead, LassoKeyFigureCards, LassoOwnerList, LassoSummary.",
    props: "text, title?, source?, updated?",
  },
  {
    type: "LassoTimeline",
    title: "Tidslinje",
    description: `Brug til: begivenheder over tid – stiftelse, ledelsesskift og offentliggjorte regnskaber, nyeste øverst – 'historik', 'hvad er der sket', 'hvornår skiftede de direktør'. Med person i stedet for company: personens historik (indtrådt/udtrådt som X i et selskab, blev/ophørt som ejer, og selskabernes konkurser og tvangsopløsninger). Brug ikke når: det gælder tal over år (LassoBarChart), de nuværende personer (LassoPersonList) eller medieomtale (LassoNews). Kræver: company ELLER person (præcis én); bygges af CVR- og regnskabsdata og er sjældent tom. ${F("historik (og overblik, ledelse, risiko)")} Personens historik dækkes af show_person. Eksempel: 'Hvad er der sket hos X gennem årene?' → show_company focus historik.`,
    props: "company | person, title?, limit?, filter? ('risiko', kun person), filterColumn? (true = mønster 6: filtre ¼ + strøm ¾, fuld bredde)",
  },
  {
    type: "LassoNews",
    title: "Nyheder",
    description: `Brug til: medieomtale – nyhedsartikler om virksomheden (eller med person: om personen, fra Lasso News) med kilde, tidspunkt og uddrag – 'nyheder', 'omtale', 'seneste nyt'. Brug ikke når: det gælder registrerede ændringer i CVR (LassoTimeline). Kræver: company ELLER person (præcis én), limit? (standard 5); ingen artikler giver tom tilstand. ${F("historik (og overblik)")} Personens nyheder dækkes af show_person. layout 'grid' (mønster 8) stiller artiklerne som kortgitter i to kolonner i fuld bredde, fx i et nyhedsmodul under faner; brug det ikke i en ½-kolonne. Eksempel: 'Har X været i nyhederne?' → show_company focus historik.`,
    props: "company | person, limit? (1–10, standard 5), layout? ('grid')",
  },

  // (a) Tal og grafer ------------------------------------------------------------
  {
    type: "LassoKeyFigureCards",
    title: "Nøgletalskort",
    description: `Brug til: 1–6 nøgletal fra seneste regnskab, hvert med ændring mod året før – det hurtige økonomiske snapshot, eller ét enkelt tal ('hvor mange ansatte', 'hvad er soliditetsgraden') med ét metric. Brug ikke når: udvikling over flere år (LassoBarChart som graf, LassoMultiYearTable som tal), alle nøgletal for ét år med årsvælger (LassoKeyValueList variant 'financials'), eller stamdata uden tal (LassoKeyValueList variant 'company'). Kræver: company, metrics? (standard 4 kort); uden regnskab står kortene som 'Ikke oplyst'. ${F("oekonomi (og overblik)")} Ændringen mod året før står kun som pil + procent i grøn (stigning) eller rød (fald), fx '▲ 12,4 %' eller '▼ 15,1 %', også ved skift mellem overskud og underskud; ingen ord, intet 'fra ÅÅÅÅ' og ingen anden procent (branche) efter. Kan ændringen ikke beregnes (intet forrige år, eller forrige = 0), vises ingen ændring. variant 'plain' giver sidens rolige form (felter adskilt af lodrette linjer uden ydre ramme, ingen sparkline, én udviklingslinje); brug den, når kortene står i et svar på niveau B sammen med graf og liste (30.13). Brug ikke 'plain' når: tallene står alene som svar (standardformen med sparkline). Eksempel: 'Hvor mange ansatte har Danfoss?' → show_company focus overblik, eller metrics ['ansatte'] i en render_view-spec; 'Hvordan går det med X?' i chatten → variant 'plain'.`,
    props: `company, metrics? (1–6 af ${METRICS.join(" | ")}), variant? ('plain')`,
  },
  {
    type: "LassoBarChart",
    title: "Søjlegraf, ét nøgletal",
    description: `Brug til: udviklingen i ÉT nøgletal over 2–10 år som søjler. Brug ikke når: 2–3 nøgletal i samme graf (LassoGroupedBarChart), en anden virksomhed som benchmark (LassoLineChart), tabel eller 4+ nøgletal (LassoMultiYearTable), kun seneste år (LassoKeyFigureCards), eller egenkapital mod gæld (LassoStackedBarChart). Kræver: company, metric, years (standard 5); år uden regnskab udelades. ${F("oekonomi (og overblik)")} Eksempel: 'Hvordan har omsætningen udviklet sig hos Carlsberg de sidste 10 år?' → show_company focus oekonomi (chart_metric 'omsaetning', years 10).`,
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5)`,
  },
  {
    type: "LassoGroupedBarChart",
    title: "Grupperede søjler, 2–3 nøgletal",
    description: `Brug til: 2–3 nøgletal side om side pr. år for én virksomhed ('omsætning og resultat over tid'). Brug ikke når: ét nøgletal (LassoBarChart), 4+ nøgletal eller præcise tal (LassoMultiYearTable), to virksomheder (LassoLineChart), eller egenkapital + gæld som helhed (LassoStackedBarChart). Kræver: company, metrics (2–3), years. ${F("oekonomi")} Eksempel: 'Vis omsætning og resultat for Vestas de seneste 5 år.' → show_company focus oekonomi.`,
    props: `company, metrics (2–3 af ${METRICS.join(" | ")}), years (2–10, standard 5)`,
  },
  {
    type: "LassoLineChart",
    title: "Linjegraf med benchmark",
    description:
      "Brug til: ét nøgletal som linje over år for én virksomhed med ÉN benchmark-virksomhed som stiplet linje – præcis to virksomheder, ét nøgletal, over tid – eller med industry true: virksomheden mod branchens median, begge som indeks (første år = 100) – 'udvikler de sig bedre end branchen'. Brug ikke når: én virksomhed uden benchmark (LassoBarChart), 3+ virksomheder (LassoCompareTable for flere nøgletal, LassoRanking for ét), flere nøgletal for én virksomhed (LassoGroupedBarChart), eller seneste års nøgletal mod branchen (LassoKeyFigureGauge). Kræver: company, metric, years, benchmark ELLER industry; branchetal kan mangle, og grafen siger da hvorfor. Dækkes ikke af show_company. Eksempel: 'Sammenlign omsætningsudviklingen for Netto og Rema 1000 over 5 år.' / 'Vokser X hurtigere end branchen?' → industry true.",
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5), benchmark? (virksomhed), industry? (true = branchen som indeks)`,
  },
  {
    type: "LassoStackedBarChart",
    title: "Stablede søjler, balance",
    description:
      "Brug til: balancen på seneste balancedag som to stablede søjler, aktiver (anlæg, omsætning) mod passiver (egenkapital, langfristet og kortfristet gæld), med værdierne i segmenterne – 'hvordan ser balancen ud', 'hvad er aktiverne finansieret med'. years afgør, hvor langt tilbage der ledes efter seneste balance. Brug ikke når: egenkapitalens andel som procent (LassoShareBars), udvikling i ét nøgletal (LassoBarChart med metric 'egenkapital', 'gaeld' eller 'soliditetsgrad'), flere år side om side (LassoMultiYearTable), eller frit valgte nøgletal (LassoGroupedBarChart). Kræver: company, years; mangler gæld i regnskaberne, vises tom tilstand. Dækkes ikke af show_company. Eksempel: 'Hvordan er balancen skruet sammen hos X?'",
    props: "company, years (2–10, standard 5)",
  },
  {
    type: "LassoShareBars",
    title: "Andelsbjælker, balance seneste år",
    description: `Brug til: dele af en helhed som donut med total i midten + andelsbjælker. variant 'balance' (standard): egenkapital og gæld som andele i procent af balancen for seneste regnskabsår. variant 'ejerkreds': ejerkredsen som andele med CVR's intervaller som tekst ('hvordan er ejerskabet fordelt'). Brug ikke når: flere år (LassoMultiYearTable), aktiver mod passiver (LassoStackedBarChart), soliditetsgraden som tal med ændring (LassoKeyFigureCards metrics ['soliditetsgrad']), eller ejernes navne og roller (LassoOwnerList). Kræver: company, variant?; mangler gæld i regnskabet eller ejerandele i CVR, vises tom tilstand. ${F("oekonomi (balance)")} Eksempel: 'Hvor stor en del af balancen er egenkapital hos X?' → show_company focus oekonomi.`,
    props: "company, variant? (balance | ejerkreds)",
  },
  {
    type: "LassoWaterfallChart",
    title: "Vandfald, omsætning til resultat",
    description: `Brug til: hvordan omsætning/bruttofortjeneste bliver til årets resultat i seneste regnskabsår. Brug ikke når: udvikling over år (LassoBarChart), enkelte tal med ændring (LassoKeyFigureCards), eller alle linjer i resultatopgørelsen (LassoIncomeStatement). Kræver: company; mangler resultat i seneste regnskab, vises tom tilstand. ${F("oekonomi")} Eksempel: 'Hvor bliver pengene af mellem omsætning og resultat hos X?' → show_company focus oekonomi.`,
    props: "company",
  },
  {
    type: "LassoKeyFigureGauge",
    title: "Nøgletalsmåler, mod branchen",
    description: `Brug til: seneste års soliditetsgrad, overskudsgrad og likviditetsgrad mod branchens median som målere (grøn/gul/rød + ord) – 'hvordan ligger X i forhold til branchen', 'er soliditeten god for branchen'. Brug ikke når: udviklingen over år mod branchen (LassoLineChart med industry true), nøgletallene uden sammenligning (LassoKeyFigureCards), eller andre navngivne virksomheder (LassoRanking/LassoCompareTable). Kræver: company, metrics? (delmængde af soliditetsgrad | overskudsgrad | likviditetsgrad); branchetal kan mangle for rigtige virksomheder, og måleren viser da tom tilstand med årsag. Dækkes ikke af show_company. Eksempel: 'Er soliditeten hos X god i forhold til branchen?'`,
    props: "company, metrics? (soliditetsgrad | overskudsgrad | likviditetsgrad), title?",
  },
  {
    type: "LassoMultiYearTable",
    title: "Flerårstabel",
    description: `Brug til: nøgletal × år som TAL med ændring og tendens pr. række – præcise tal for 1–6 nøgletal over 2–10 år, eller 4+ nøgletal over tid. Brug ikke når: ét nøgletal som graf (LassoBarChart), 2–3 nøgletal som graf (LassoGroupedBarChart), kun ét år (LassoKeyValueList variant 'financials'), eller alle regnskabslinjer (LassoIncomeStatement). Kræver: company, metrics?, years, variant? (kun mobil: 'A' = nøgletal i rækker med fast navnekolonne og vandret rul til ældre år, når brugeren skal sammenligne på tværs af nøgletal; 'B' = ét kort pr. nøgletal med årene som kolonner, når der er få nøgletal og mange år; standard B ved 1–2 nøgletal). ${F("oekonomi")} Eksempel: 'Giv mig omsætning, bruttofortjeneste, resultat og egenkapital for X for hvert af de sidste 5 år i en tabel.'; 'udviklingen i ansatte over 5 år på mobil' → metrics ['ansatte'], variant 'B'.`,
    props: `company, metrics? (1–6 af ${METRICS.join(" | ")}), years (2–10, standard 5), title?, variant? (A | B)`,
  },
  {
    type: "LassoIncomeStatement",
    title: "Resultatopgørelse, fuld",
    description: `Brug til: HELE resultatopgørelsen, fuldstændig (omsætning, vareforbrug og eksterne omkostninger, bruttofortjeneste, personaleomkostninger, andre driftsomkostninger, EBITDA, af- og nedskrivninger, resultat af primær drift (EBIT), finansielle indtægter og omkostninger, resultat før skat, skat, årets resultat), kompakt med 2 år + ændring – 'resultatopgørelsen', 'alle posterne'. Bruges, når elementet IKKE står i fuld bredde (½ eller ¾ ved siden af andet). Brug ikke når: elementet skal stå i fuld bredde (brug LassoFinancialStatements med værktøjslinje og 5 år), kun nøgletal (LassoKeyFigureCards, LassoMultiYearTable) eller balancen (LassoBalanceSheet). Kræver: company, years? (2–3, standard 2); poster, regnskabet ikke indeholder, udelades (ingen tomme rækker). ${F("regnskab")} Eksempel: 'Vis hele resultatopgørelsen for X.' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
  },
  {
    type: "LassoBalanceSheet",
    title: "Balance, fuld",
    description: `Brug til: HELE balancen (aktiver og passiver), fuldstændig (immaterielle, materielle og finansielle anlægsaktiver, anlægsaktiver i alt, varebeholdninger, tilgodehavender, likvide beholdninger, omsætningsaktiver i alt, aktiver i alt; egenkapital, hensatte forpligtelser, lang- og kortfristet gæld, passiver i alt), 2–3 år side om side – 'balancen', 'aktiver og passiver'. Bruges, når elementet IKKE står i fuld bredde; i fuld bredde bruges LassoFinancialStatements. Brug ikke når: kun egenkapital/gæld som andele (LassoShareBars/LassoStackedBarChart) eller ét nøgletal (LassoKeyFigureCards). Kræver: company, years? (2–3, standard 2); poster, regnskabet ikke indeholder, udelades. ${F("regnskab")} Eksempel: 'Vis balancen for X for de sidste to år.' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
  },
  {
    type: "LassoCashFlow",
    title: "Pengestrømsopgørelse",
    description: `Brug til: pengestrøm fra drift, investering og finansiering, årets ændring i likvider og likvider ultimo, 2–3 år side om side – 'pengestrøm', 'cash flow'. Bruges, når elementet IKKE står i fuld bredde; i fuld bredde bruges LassoFinancialStatements. Brug ikke når: det gælder resultat (LassoIncomeStatement) eller balance (LassoBalanceSheet). Kræver: company, years? (2–3, standard 2); selskaber i regnskabsklasse B aflægger den ikke, og komponenten viser da 'Pengestrømsopgørelse er ikke indberettet'. ${F("regnskab")} Eksempel: 'Hvordan er pengestrømmen hos X?' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
  },

  {
    type: "LassoFinancialStatements",
    title: "Regnskabsdetaljer med værktøjslinje",
    description: `Brug til: det fulde regnskab som ÉT element i FULD bredde: værktøjslinje (selskab/koncern, regnskabsår, enhed, revisorpåtegning og 'Hent PDF'; kun årsregnskaber), på desktop den fuldstændige resultatopgørelse med balance og pengestrøm under, på mobil én opgørelse ad gangen – 'vis hele regnskabet', 'regnskabet med koncerntal', 'hent årsrapporten'. Brug ikke når: elementet står i ½ eller ¾ bredde (brug LassoIncomeStatement/LassoBalanceSheet/LassoCashFlow, kompakt med 2 år + ændring), kun én opgørelse er bestilt eller nøgletal over år (LassoMultiYearTable). Kræver: company, statement? (income | balance | cashflow, den der vises først på mobil), years? (2–5; brug 5 i fuld bredde); poster uden tal udelades. Dækkes ikke af show_company endnu. Eksempel: 'Vis hele regnskabet for Lasso X med koncerntal' → render_view med LassoCompanyHead og LassoFinancialStatements.`,
    props: "company, statement? (income | balance | cashflow), years? (2–5, standard 2), title?",
  },

  {
    type: "LassoMergers",
    title: "Fusioner og spaltninger",
    description: `Brug til: virksomhedens fusioner og spaltninger som 'fra → til' med dato og type – 'har X fusioneret', 'hvilke selskaber er fusioneret ind i X', 'spaltning'. Brug ikke når: det gælder ejerskifte (LassoOwnerList/LassoOwnershipDiagram) eller hele historikken (LassoTimeline). Kræver: company; ingen hændelser giver en tom tilstand, der siger det. Dækkes ikke af show_company. Eksempel: 'Er Lasso X fusioneret med andre selskaber?' → render_view med LassoCompanyHead og LassoMergers.`,
    props: "company, title?",
  },  {
    type: "LassoRegistration",
    title: "Regnskabsoplysninger og kapital",
    description: `Brug til: registreringsdetaljer fra CVR – revision (revideret eller fravalgt), regnskabsår, nuværende og første regnskabsperiode, regnskabsklasse, bibrancher, registreret kapital og kapitalklasser, vedtægter, tegningsregel, formål, reklamebeskyttelse og børsnotering – 'er revisionen fravalgt', 'hvilken regnskabsklasse', 'hvad er kapitalen', 'hvad er formålet', 'bibrancher'. Brug ikke når: kun revisor, stiftelse, form eller branche (LassoKeyValueList variant 'company'), eller hele virksomhedsprofilen med regnskabsanalyse (LassoTextSections). Kræver: company, variant? ('full' standard = to kort; 'profile' = bibrancher og formål, en smal blok); felter uden værdi udelades, og alt ud over formål og tegningsregel er ubekræftet i live-data. Dækkes ikke af show_company. Eksempel: 'Har Lasso X fravalgt revision, og hvad er kapitalen?' → render_view med LassoCompanyHead og LassoRegistration.`,
    props: "company, variant? (full | profile), title?",
  },

  {
    type: "LassoAnnouncements",
    title: "Statstidende",
    description: `Brug til: seneste bekendtgørelser i Statstidende (konkursdekret, rekonstruktion, likvidation, indkaldelse af kreditorer) – 'står X i Statstidende', 'er der bekendtgjort konkurs'. Brug ikke når: det gælder CVR-status alene (LassoCompanyHead) eller Creditsafe (LassoCreditRating). Kræver: company; komponenten udelades helt, når der ingen bekendtgørelser er. Dækkes ikke af show_company. Eksempel: 'Har X bekendtgørelser i Statstidende?' → render_view med LassoCompanyHead og LassoAnnouncements.`,
    props: "company, title?",
  },
  {
    type: "LassoPublications",
    title: "Regnskabspublicering",
    description: `Brug til: listen over offentliggjorte regnskaber med dato, type (årsrapport, halvår, kvartal; ny eller korrigeret) og hovedtal – 'hvornår kom regnskabet', 'er regnskabet korrigeret'. Brug ikke når: tallene selv skal ses (LassoFinancialStatements/LassoMultiYearTable). Kræver: company, limit? (standard 5). Dækkes ikke af show_company. Eksempel: 'Hvornår har X offentliggjort sine regnskaber?' → render_view med LassoCompanyHead og LassoPublications.`,
    props: "company, limit?, title?",
  },

  // (b) Personer og ejere ------------------------------------------------------
  {
    type: "LassoPersonList",
    title: "Ledelse og bestyrelse",
    description: `Brug til: direktion og bestyrelse med rolle og tiltrådt/fratrådt; show 'all' ved 'udskiftning', 'tidligere direktør'. Brug ikke når: det gælder ejere (LassoOwnerList/LassoBeneficialOwners), en smal kolonne med både personer og ejere (LassoRelations), eller én bestemt person (show_person). Kræver: company, show? (standard 'current'). ${F("ledelse (og risiko)")} Eksempel: 'Hvem sidder i bestyrelsen hos Novo Nordisk?' → show_company focus ledelse.`,
    props: "company, show? (current | all), title?",
  },
  {
    type: "LassoOwnerList",
    title: "Legale ejere",
    description: `Brug til: 'hvem ejer X' – de legale (direkte) ejere med ejerandel som interval; standardvalget for ejerspørgsmål. Brug ikke når: 'reelle ejere', 'i sidste ende', 'personerne bag' (LassoBeneficialOwners), 'koncern', 'moderselskab', 'datterselskaber', 'ejerstruktur' (LassoOwnershipDiagram), eller 'hvem er revisor' (LassoKeyValueList variant 'company'). Kræver: company; ejerandele fra CVR vises som intervaller. ${F("ejerskab (og ledelse)")} Eksempel: 'Hvem ejer Lasso X?' → show_company focus ejerskab.`,
    props: "company",
  },
  {
    type: "LassoBeneficialOwners",
    title: "Reelle ejere",
    description: `Brug til: de fysiske personer, der i sidste ende ejer virksomheden, med samlet indirekte andel og ejerkæden gennem mellemliggende selskaber – kun ved 'reelle ejere', 'i sidste ende', 'personerne bag', 'gennem holdingselskaber'. Brug ikke når: direkte ejere (LassoOwnerList) eller koncernstruktur som diagram (LassoOwnershipDiagram). Kræver: company; ingen registrerede reelle ejere giver tom tilstand. ${F("ejerskab")} Eksempel: 'Hvem er de reelle ejere bag Lasso X?' → show_company focus ejerskab.`,
    props: "company",
  },
  {
    type: "LassoOwnershipDiagram",
    title: "Ejerdiagram, koncern",
    description: `Brug til: koncernstruktur i flere lag som diagram: ejere over, datterselskaber under – 'koncernen bag', 'moderselskab', 'datterselskaber', 'ejerstruktur', 'hvordan hænger selskaberne sammen'. Brug ikke når: én liste af direkte ejere (LassoOwnerList) eller personerne i sidste ende (LassoBeneficialOwners). Kræver: company ELLER person (præcis én), ingoingDepth? (lag op, standard 2; 0 for en person), outgoingDepth? (lag ned, standard 1), onDate?. Med person er personen roden (pille), og pilene går til de selskaber, personen ejer, med ejerandel. ${F("ejerskab (vises, når der er selskabsejere)")} Personens ejerskaber dækkes af show_person (vises, når personen ejer selskaber). Eksempel: 'Hvilke datterselskaber har X, og hvem er moderselskabet?' → show_company focus ejerskab.`,
    props: "company | person, ingoingDepth? (lag op, standard 2), outgoingDepth? (lag ned, standard 1), onDate? (ÅÅÅÅ-MM-DD), title?",
  },
  {
    type: "LassoRelations",
    title: "Rolleliste, kompakt",
    description: `Brug til: direktion, bestyrelse (formand i parentes) og de tre største legale ejere i ÉT kompakt element til en smal kolonne (¼ ved siden af en ¾) i et bredt overblik. Erstatter LassoPersonList OG LassoOwnerList sammen. Brug ikke når: spørgsmålet gælder ledelsen (LassoPersonList) eller ejerne (LassoOwnerList), eller listen står i fuld bredde. Kræver: company. ${F("overblik")} Eksempel: smal kolonne i en render_view-spec, der i øvrigt handler om andet.`,
    props: "company, title?",
  },

  // (d) Flere virksomheder -----------------------------------------------------
  {
    type: "LassoCompareTable",
    title: "Sammenligning, navngivne virksomheder",
    description:
      "Brug til: 2–6 NAVNGIVNE virksomheder side om side på 1–5 nøgletal fra seneste år – 'sammenlign A og B', 'A vs. B på omsætning og ansatte'. Brug ikke når: ét nøgletal og rækkefølgen er pointen (LassoRanking), udvikling over år for to virksomheder (LassoLineChart), eller virksomhederne først skal findes med kriterier (search_companies/LassoCompanyTable). Kræver: companies[] (2–6), metrics? (standard 4). Dækkes ikke af show_company. Eksempel: 'Sammenlign Lasso X, Risika og Bisnode på omsætning, resultat og ansatte.'",
    props: `companies[] (2–6), metrics? (1–5 af ${METRICS.join(" | ")}), title?`,
  },
  {
    type: "LassoRanking",
    title: "Rangliste, ét nøgletal",
    description:
      "Brug til: 2–10 navngivne virksomheder på ÉT nøgletal (seneste år) som vandrette søjler, den første fremhævet – 'hvor ligger X i forhold til …'. Brug ikke når: flere nøgletal pr. virksomhed (LassoCompareTable), udvikling over tid (LassoLineChart), eller listen skal findes med kriterier ('de største i branchen' → search_companies/LassoCompanyTable med sort). Kræver: companies[] (2–10, kendte på forhånd), metric. Dækkes ikke af show_company. Eksempel: 'Hvor ligger Lasso X på ansatte i forhold til Bisnode, Experian og Risika?'",
    props: `companies[] (2–10, første fremhæves), metric (${METRICS.join(" | ")}), title?`,
  },
  {
    type: "LassoCompanyTable",
    title: "Virksomhedstabel, søgning",
    description:
      "Brug til: mange virksomheder fundet med kriterier – målgrupper, 'alle X i Y', 'top N efter Z' (sort) – som del af en render_view-spec med andet; står søgningen alene, så brug search_companies. Brugeren kan sortere, fjerne kriterier og klikke ind på en virksomhed. Brug ikke når: du kender 2–6 navngivne virksomheder til sammenligning (LassoCompareTable) eller 2–10 navngivne på ét nøgletal (LassoRanking). Kræver: source 'search', search { query, criteria[], sort?, limit? }, columns? ('score' er Lassos 0–100-score og findes kun i demodata; live står den som -, så vælg den ikke til kunder); ingen match giver tom tilstand med kriterierne synlige. Eksempel: 'Vis de 20 største revisionsfirmaer i Aarhus efter ansatte.' → search_companies.",
    props: `source='search', search { query, criteria[], sort?, limit? }, columns? (${TABLE_COLUMNS.join(" | ")}), title?`,
  },
  {
    type: "LassoPersonTable",
    title: "Persontabel, navnesøgning",
    description:
      "Brug til: flere personer med samme eller lignende navn som tabel – 'find personer der hedder X', 'hvilke Mette Holm findes der', 'personer med navnet …' – med navnet alene i personcellen (ingen fødselsår eller by under, 15.3), aktive roller som tekst og antal konkurser, så brugeren kan vælge den rigtige og klikke ind. Brug ikke når: det er klart, hvilken person der menes (show_person), det gælder én virksomheds ledelse (LassoPersonList), eller der søges virksomheder (LassoCompanyTable/search_companies). Kræver: query (navn, mindst 2 tegn), limit? (standard 25); ingen match giver tom tilstand, og CPR eller fuld adresse vises aldrig. Dækkes ikke af show_person. Eksempel: 'Hvilke personer hedder Mette Holm?' → render_view med LassoPersonTable { query: 'Mette Holm' }.",
    props: "query (navn), limit? (1–50, standard 25), title?",
  },

  // (e) Risiko og revision -----------------------------------------------------
  {
    type: "LassoCreditRating",
    title: "Kreditvurdering, Creditsafe",
    description: `Brug til: kreditvurdering fra Creditsafe (kreditmaksimum, international score A–E, lokal score, PDF-rapport; kun den aktuelle vurdering, ingen historik) – 'kan vi give dem kredit', 'kreditvurdering', 'Creditsafe'. Brug ikke når: det gælder Lassos 0–100-score (LassoScoreGauge); skalaerne må ikke blandes. Kræver: company; uden Creditsafe-tilkøb viser den låst tilstand. Et opslag kan tage op til 45 sekunder, når Creditsafe beregner; Lasso gemmer vurderingen i 24 timer, så vis den højst én gang pr. svar og bed aldrig om en ny beregning (koster en kredit). ${F("risiko")} Eksempel: 'Hvad er kreditvurderingen for Lasso X?' → show_company focus risiko.`,
    props: "company, title?",
  },
  {
    type: "LassoRiskObservations",
    title: "Risikoobservationer",
    description: `Brug til: Lassos risikoobservationer for én virksomhed som liste – sammenfatning øverst som filtre (høj, middel, info) og observationerne sorteret efter alvor – når brugeren beder om 'risikoobservationer', 'røde flag i detaljer' eller 'alle observationer'. Brug ikke når: spørgsmålet er bredt om risiko eller kredit (show_company focus risiko), eller det gælder Creditsafe (LassoCreditRating). Kræver: company; opslaget tager 10–14 sekunder, så brug den kun, når brugeren beder om listen. Tom liste er positiv information ('intet at bemærke, tjekket DATO'). Dækkes ikke af show_company. Eksempel: 'Vis alle risikoobservationer for Lasso X' → render_view med LassoCompanyHead og LassoRiskObservations.`,
    props: "company, title?, compact?",
  },
  {
    type: "LassoScoreGauge",
    title: "Scoremåler (kun demo)",
    description:
      "Brug til: KUN demovisninger. Der er ingen live datakilde for Lassos 0-100 risikoscore endnu; for rigtige virksomheder viser måleren 'Ikke oplyst'. Vælg den aldrig til en kunde, der spørger om risiko, score eller kreditvurdering (show_company focus risiko). Skalaen er Lassos risikoscore 0-100, hvor 100 = HØJ risiko (0-60 lav/grøn, 60-80 moderat/gul, 80-100 høj/rød); kun den aktuelle score, ingen historik, ikke Creditsafe (brug LassoCreditRating til Creditsafe). Kræver: company, title? (standard 'Risikoscore'), detail? (true giver den fulde form med 60/80-mærker), width? ('quarter' standard = kort med tal, måler, 'Beregnet', 'Grundlag' og 'Se observationer' (18.1); 'half' tilføjer 'Hvad trækker scoren' med op til 4 faktorer, men kun når scoremodellen leverer dem - ellers vises ¼-formen). Eksempel: intet kundespørgsmål fører hertil.",
    props: "company, title?, detail?",
  },

  // (f) Fysiske enheder --------------------------------------------------------
  {
    type: "LassoProductionUnits",
    title: "Produktionsenheder, P-numre",
    description:
      "Brug til: P-numre – filialer, afdelinger, butikker og adresser ud over hovedadressen, med ansatte og status pr. enhed – 'afdelinger', 'filialer', 'P-nummer'. Brug ikke når: kun hovedadressen (LassoCompanyHead), ejendomme/bygninger (LassoProperties), eller datterselskaber med egne CVR-numre (LassoOwnershipDiagram). Kræver: company; kilden er CVR-svaret, og listen kan være tom for virksomheder med kun hovedenheden. Viser telefon og e-mail pr. P-enhed, når CVR har dem (ellers udeladt), så den også svarer på 'telefonnummer til afdelingen i Aarhus'. Dækkes ikke af show_company. Eksempel: 'Hvor mange afdelinger har X, og hvor ligger de?'",
    props: "company",
  },
  {
    type: "LassoProperties",
    title: "Ejendomme, BBR",
    description:
      "Brug til: ejendomme, virksomheden ejer (ejerfortegnelsen), med BBR-bygninger (anvendelse, opført, etager, areal) og arealfordeling – 'ejendomme', 'bygninger', 'BBR', 'matrikel'. Brug ikke når: adresser for afdelinger (LassoProductionUnits) eller virksomhedens egen adresse (LassoCompanyHead). Kræver: company; ejer virksomheden ingen ejendomme, vises tom tilstand. Dækkes ikke af show_company. Eksempel: 'Hvilke ejendomme ejer X, og hvor store er bygningerne?'",
    props: "company, title?",
  },
  {
    type: "LassoMap",
    title: "Kort, adresser og P-enheder",
    description:
      "Brug til: virksomhedens hovedadresse og P-enheder på et kort, med klynger hvor mange ligger tæt – 'hvor ligger afdelingerne', 'vis på kort'. Brug ikke når: adresserne som liste med ansatte og status (LassoProductionUnits), ejendomme og bygninger (LassoProperties) eller kun hovedadressen som tekst (LassoCompanyHead). Kræver: company; koordinater er ikke bekræftet i Lassos data, så kortet kan være tomt med en forklaring. Dækkes ikke af show_company. Eksempel: 'Vis X's afdelinger på et kort.'",
    props: "company, title?",
  },
  {
    type: "LassoLivestock",
    title: "CHR, husdyr (ingen live data)",
    description:
      "Brug til: CHR-besætninger pr. dyretype og veterinære hændelser – kun landbrug. Ingen live datakilde endnu: for rigtige virksomheder er komponenten altid tom. Vælg den kun, når kunden udtrykkeligt spørger til CHR/husdyr, og sig, at data ikke er tilsluttet. Brug ikke når: det gælder ansatte eller økonomi i et landbrug (LassoKeyFigureCards). Kræver: company. Eksempel: 'Hvor mange svin har landbruget X?' (tom tilstand live).",
    props: "company",
  },

  // (16) Personside ----------------------------------------------------------------
  {
    type: "LassoPersonHead",
    title: "Personhoved",
    description:
      "Brug til: identitet for én person øverst på en personside: KUN navnet og handlingerne (ingen 'Person', by, fødselsår, rolletælling eller observationslinje under navnet). Brug ikke når: det gælder en virksomheds ledelse (LassoPersonList). Kræver: person (Lasso-ID 'CVR-3-…'). Dækkes af show_person, som bygger hele personsiden; brug den. Eksempel: 'Hvem er Mette Holm?' → show_person.",
    props: "person, variant?",
  },
  {
    type: "LassoPersonRoles",
    title: "Roller over tid",
    description:
      "Brug til: en persons roller i selskaber som tidsbånd fra–til, aktive først (show 'all'), eller som kort liste pr. selskab: de aktive roller (show 'current'), de ophørte, senest ophørte først (show 'ended'), eller de selskaber, personen ejer nu, med andel og siden-dato (show 'owner') – 'hvor sidder X i bestyrelsen', 'hvilke selskaber er X direktør i', 'hvad ejer X'. Brug ikke når: det gælder ét selskabs ledelse (LassoPersonList) eller personens medspillere (LassoPersonNetwork). Kræver: person. Dækkes af show_person (focus roller og ejerskab). Eksempel: 'Hvilke bestyrelser sidder X i?' → show_person focus roller.",
    props: "person, show? ('all' | 'current' | 'ended' | 'owner'), limit?, title?",
  },
  {
    type: "LassoPersonNetwork",
    title: "Personnetværk",
    description:
      "Brug til: hvem personen sidder sammen med i selskaber, sorteret efter år sammen (den længste sammenhængende periode i fælles selskaber, ikke summen) –'hvem arbejder X sammen med', 'X's netværk'. Tegnes som tidsbånd i samme sprog som LassoPersonRoles (16.3): ét bånd pr. fælles selskab for perioden, de sad sammen, med 'Selskab, rolle, periode' over båndet; afsluttede stiplede og dæmpede, konkurs med rød markør og ordet; på mobil ét kort pr. person. Giv den gerne width 'two-thirds' eller 'full' på en side, hvor netværket er svaret. Brug ikke når: det gælder personens egne roller (LassoPersonRoles) eller konkurser (LassoPersonRisk). Kræver: person. Dækkes af show_person (focus netvaerk). Eksempel: 'Hvem er X i bestyrelse med?' → show_person focus netvaerk.",
    props: "person, limit? (standard 3), title?",
  },
  {
    type: "LassoPersonRisk",
    title: "Personrisiko",
    description:
      "Brug til: konkurser og tvangsopløsninger blandt selskaber, personen har eller har haft roller i – 'har X været involveret i konkurser'. Brug ikke når: det gælder en virksomheds risiko (show_company focus risiko). Kræver: person; ingen roller giver tom tilstand. Dækkes af show_person (focus risiko). Eksempel: 'Har X været med i konkurser?' → show_person focus risiko.",
    props: "person, title?",
  },
  {
    type: "LassoPersonStats",
    title: "Netværkstal, person",
    description:
      "Brug til: tre små tal-kort om en person – personer i 1. led (netværk), konkurser og tvangsopløsninger blandt personens selskaber – som hurtigt overblik under rollerne. Brug ikke når: brugeren vil se hvem (LassoPersonNetwork) eller hvilke selskaber (LassoPersonRisk). Kræver: person. Eksempel: 'Hvor stort er X's netværk, og har X været i konkurser?' → show_person, eller render_view med LassoPersonHead og LassoPersonStats.",
    props: "person",
  },
  {
    type: "LassoPersonFacts",
    title: "Stamoplysninger, person",
    description:
      "Brug til: en persons stamoplysninger som nøgle-værdi i en smal kolonne (¼): bopæl (postnummer og by; aldrig gade), kommune, 'Adressebeskyttet', enhedsnummer, aktive og ophørte roller, antal selskaber personen ejer, første registrering og seneste ændring – 'hvor bor X', 'hvornår kom X ind i CVR'. Brug ikke når: det gælder en virksomheds stamdata (LassoKeyValueList) eller personens roller over tid (LassoPersonRoles). Kræver: person. Dækkes af show_person. Eksempel: 'Hvor bor X, og hvor længe har X været registreret?' → show_person.",
    props: "person, title?",
  },

  // (21) Overvågning ---------------------------------------------------------------
  {
    type: "LassoChangeFeed",
    title: "Ændringsfeed, overvågede virksomheder",
    description:
      "Brug til: hvad der er sket i de virksomheder, brugeren overvåger – ændringer på tværs af en overvågningsliste grupperet pr. dag med filter på type (regnskab, ledelse, ejerskab, status, stamdata; Kredit-typen udgår) – 'hvad er der sket i mine kunder', 'ændringer i min overvågning', 'nyt i listen Kunder'. Brug ikke når: det gælder én virksomheds egen historik (LassoTimeline) eller nyheder i medierne (LassoNews). Kræver: list? (listens navn, fx 'Kunder'), days? (standard 7, 1–90), types? (delmængde af ændringstyper); ingen ændringer i perioden giver tom tilstand, og uden overvågningsliste forklarer komponenten hvorfor. Dækkes ikke af show_company. Eksempel: 'Hvad er der sket i mine overvågede kunder den seneste uge?' → render_view med LassoChangeFeed { list: 'Kunder', days: 7 }.",
    props: `list?, days? (1–90, standard 7), types? (delmængde af ${CHANGE_TYPES.join(" | ")}), title?`,
  },

  {
    type: "LassoHeatmap",
    title: "Heatmap, aktivitet pr. måned",
    description:
      "Brug til: hvor meget der er sket i de overvågede virksomheder måned for måned, pr. ændringstype (regnskab, ledelse, ejerskab, status, stamdata; Kredit-typen udgår) – 'hvornår sker der mest i mine kunder', 'aktivitet det seneste år'. Brug ikke når: de enkelte ændringer (LassoChangeFeed) eller én virksomheds historik (LassoTimeline). Kræver: list? (listens navn), months? (3–24, standard 12), types?; ingen ændringer giver tom tilstand, og uden overvågningsliste forklarer komponenten hvorfor. Samme ubekræftede live-kilde som LassoChangeFeed. Dækkes ikke af show_company. Eksempel: 'Hvornår har der været mest aktivitet i listen Kunder det seneste år?' → render_view med LassoHeatmap { list: 'Kunder', months: 12 }.",
    props: `list?, months? (3–24, standard 12), types? (delmængde af ${CHANGE_TYPES.join(" | ")}), title?`,
  },

  // Gem-laget (docs/gem-lag.md) ------------------------------------------------
  {
    type: "LassoSavedPages",
    title: "Gemte sider",
    description:
      "Brug til: brugerens egne gemte virksomheds- og personsider – 'mine gemte', 'hvad har jeg gemt', 'min liste'. Vises normalt af list_saved_pages; i render_view kun sammen med andre elementer. Brug ikke når: brugeren vil gemme eller fjerne en side (save_page / remove_saved_page) eller have et delbart link til en visning (save_view). Kræver: kind? (company | person | all, standard all), limit? (1–100, standard 20); ingen gemte sider giver tom tilstand med forklaring. Eksempel: 'Vis mine gemte virksomheder' → list_saved_pages { kind: 'company' }.",
    props: "kind? (company | person | all), limit? (1–100, standard 20), title?",
  },

  // Interaktion ----------------------------------------------------------------
  {
    type: "LassoFollowUps",
    title: "Opfølgningsknapper",
    description:
      "Brug til: 1–4 knapper nederst i en render_view-visning, som sender et opfølgende spørgsmål til dig som brugerens næste besked, når der er oplagte næste analyser. Brug ikke når: spørgsmålet var snævert og besvaret med ét element, eller visningen kommer fra show_company (kan ikke tilføjes der). Kræver: prompts[] { label, prompt }; henter ingen data. Eksempel: efter en sammenligning: 'Vis udviklingen over 10 år', 'Tilføj Experian'.",
    props: "prompts[] { label, prompt }",
  },
];

export function catalogAsText(): string {
  return COMPONENT_CATALOG.map((c) => `- ${c.type} (${c.title}): ${c.description} Props: ${c.props}. ${gridRuleText(GRID_RULES[c.type])}`).join("\n");
}

export function fieldsAsText(): string {
  return FIELDS.map((f) => {
    const ops = OPERATORS_BY_TYPE[f.type].join(", ");
    const opts = f.options ? ` Værdier: ${f.options.join(", ")}.` : "";
    const unit = f.type === "amount" ? " Hele kroner." : "";
    return `- ${f.key} (${f.label}, ${f.type}): ${f.description}${unit}${opts} Operatorer: ${ops}.`;
  }).join("\n");
}

export const OPERATORS_TEXT = `Operatorer: ${OPERATORS.join(", ")}. gt betyder > og gte betyder ≥.`;

/** 02a.6/02b.10: fejlteksten, når en til-dato ligger før fra-datoen i "mellem". */
export const DATE_RANGE_ERROR = "Til-datoen kan ikke være før fra-datoen.";

export interface CriterionIssue {
  index: number;
  message: string;
}

/** Tjekker kriterier mod feltkataloget. Returnerer forståelige fejl til modellen. */
export function validateCriteria(criteria: readonly Criterion[]): CriterionIssue[] {
  const issues: CriterionIssue[] = [];
  criteria.forEach((c, index) => {
    const field = FIELD_BY_KEY.get(c.field);
    if (!field) {
      issues.push({ index, message: `Ukendt felt '${c.field}'. Brug et af: ${FIELDS.map((f) => f.key).join(", ")}.` });
      return;
    }
    const allowed = OPERATORS_BY_TYPE[field.type];
    if (!allowed.includes(c.operator)) {
      issues.push({ index, message: `Operator '${c.operator}' passer ikke til '${c.field}'. Tilladte: ${allowed.join(", ")}.` });
      return;
    }
    if (c.operator === "between" && !(Array.isArray(c.value) && c.value.length === 2)) {
      issues.push({ index, message: `'between' på '${c.field}' kræver value: [fra, til].` });
    }
    // 02a.6/02b.10: "mellem" på datoer: til-datoen kan ikke ligge før fra-datoen.
    if (field.type === "date" && c.operator === "between" && Array.isArray(c.value) && c.value.length === 2 && typeof c.value[0] === "string" && typeof c.value[1] === "string" && c.value[1] < c.value[0]) {
      issues.push({ index, message: DATE_RANGE_ERROR });
    }
    if ((c.operator === "in" || c.operator === "not_in") && !Array.isArray(c.value)) {
      issues.push({ index, message: `'${c.operator}' på '${c.field}' kræver en liste som value.` });
    }
    if (field.options && c.operator !== "between") {
      const values = Array.isArray(c.value) ? c.value : [c.value];
      const bad = values.filter((v) => !field.options!.some((o) => o.toLowerCase() === String(v).toLowerCase()));
      if (bad.length > 0) {
        issues.push({ index, message: `Ukendt værdi for '${c.field}': ${bad.join(", ")}. Brug: ${field.options.join(", ")}.` });
      }
    }
  });
  return issues;
}
