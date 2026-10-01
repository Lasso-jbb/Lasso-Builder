import type { ContentWidthDrivers, Register, WidthProfile } from "./register.js";
import { OPERATORS, type Criterion } from "./criteria.js";
import { FIELDS, FIELD_BY_KEY, OPERATORS_BY_TYPE } from "./fields.js";
import { COMPANY_FACT_KEYS } from "./companyFacts.js";
import { CHANGE_TYPES } from "./models.js";
import { METRICS, TABLE_COLUMNS, TIMELINE_KINDS, type ComponentType, type ViewComponent, type Width } from "./spec.js";

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
  /** Komponentregisteret (plan A5/A7): struktureret formål, veje, data og bredde-profil. Kræves for alle typer (A8). */
  register?: Register;
}

/**
 * Kompositionsregler fra designguidens trin 23. Står over kataloget i tool-
 * beskrivelserne, så modellen vælger værktøj, antal og rækkefølge før den vælger komponent.
 */
export const COMPOSITION_RULES = `Komposition (guide 23):
- Én virksomhed: brug show_company med brugerens spørgsmål ordret i question. Serveren henter data og bygger selv siden omkring svaret (svar-elementet først, data afgrænset til spørgsmålet, kontekst rundt om). Byg IKKE selv en virksomhedsside med render_view. Sæt kun focus ved et generelt spørgsmål; routing: bredt ("fortæl om X") → overblik; økonomi, omsætning, resultat, nøgletal, soliditetsgrad, "hvordan går det" → oekonomi; fuldt regnskab, resultatopgørelse, balance, pengestrøm, "alle posterne" → regnskab; ejere, reelle ejere, koncern → ejerskab; direktion, bestyrelse, udskiftning → ledelse; røde flag, "kan vi handle med dem", kreditvurdering, Creditsafe, revisors uafhængighed → risiko; "hvad er der sket", nyheder → historik; kontaktoplysninger, telefon, e-mail, web, kontaktpersoner → kontakt. Snævre stamdataspørgsmål ("hvem er revisor", "hvornår stiftet", "hvor mange ansatte") → overblik.
- Én person → show_person med spørgsmålet i question (og focus kun ved et generelt spørgsmål): "hvem er X" → overblik; "hvor sidder X i bestyrelser", roller over tid → roller; "hvem sidder X sammen med" → netvaerk; "hvilke selskaber ejer X" → ejerskab; "har X været i konkurser" → risiko; "hvad er der sket", nyheder om X → historik. Byg ikke personsider med render_view.
- Flere navngivne virksomheder → compare_companies (tabel 2–3 på flere nøgletal, rangering 2–10 på ét nøgletal, udvikling for de to første); mange fundet med kriterier → search_companies; personer på navn → search_persons. Aldrig én enkeltvisning pr. virksomhed, og byg ikke sammenligninger selv med render_view.
- Emnet i et spørgsmål, der ikke står med sit eget ord, sendes som topic (fx roede-flag, fusion, meddelelser, dokumenter, branchesammenligning, placering, heleregnskab, registrering, opsummering, aendringer, score, persontal); "vis alt" → show_all: true.
- render_view til én virksomhed kun, når brugeren beder om elementer, ingen focus dækker (fx LassoStackedBarChart, LassoProductionUnits, LassoProperties, en egen vurdering i LassoSummary), eller om en kombination på tværs af focus (fx ejere + revisor, resultatopgørelse + ejere). Læg da ALT i én spec: LassoCompanyHead først, dernæst det bestilte, og LassoSummary som sidste sektion.
- ÉN visning pr. svar: kald højst ét af show_company, show_person, search_companies og render_view pr. brugerbesked, og kun én gang. Aldrig show_company og render_view efter hinanden.
- render_view er ét dashboard: læg komponenterne i læserækkefølge og udelad width. Lasso pakker dem selv i 12-kolonne-gitteret efter indhold og data (hoved, nøgletal og tabeller i fuld bredde, to halve side om side, en smal stak ved et højt element). Sæt kun width (quarter, third, half, two-thirds, three-quarters, full), når brugeren beder om en bestemt placering.
- Højst én graf pr. visning. Flere grafer stables aldrig; vælg den ene, spørgsmålet peger på (1 nøgletal → LassoBarChart, 2–3 → LassoGroupedBarChart, 4+ eller "tabel" → LassoMultiYearTable).`;

/**
 * Layoutmodeller fra Paper 30 "Fra spørgsmål til skærm" (node J48-0). Vælg først svarniveau, så
 * mønster, så elementer. Bredden (chat, mobil, portal) ændrer kun foldningen, aldrig elementerne
 * eller deres rækkefølge. Står efter COMPOSITION_RULES i tool-beskrivelserne.
 */
export const LAYOUT_RULES = `Layout (Paper 30): vælg først svarniveau, så mønster, så elementer.
show_company og show_person med question bygger altid en hel side i spørgsmålets kontekst; niveau A og B nedenfor gælder dine egne render_view-svar.
Svarniveauer: A Element = ét spørgsmål, ét element (fx "hvad er omsætningen" → LassoKeyFigureCards med ét metric; "hvem er revisor" → LassoKeyValueList), aldrig to A-svar under hinanden. B Sektion = ét emne, 2–4 elementer i ét mønster ("hvordan går det" → mønster 1; "hvem ejer" → mønster 2; "kan vi handle med" → mønster 7; "hvad er der sket" → mønster 6). C Side = det hele ("fortæl om X", "hvem er Y", "sammenlign", målgrupper) → show_company/show_person/compare_companies/search_companies. Vælg det laveste niveau, der svarer fuldt. Hvert svar starter med identiteten (LassoCompanyHead/LassoPersonHead). Ingen kildevisning nogen steder. answer { next { label, prompt } } på spec'en giver ét link videre til næste niveau, fx niveau A 'Hvad er omsætningen?' → next { label: 'Se hele økonomien', prompt: 'Hvordan går det med X?' }.
Mønstre (vælg elementerne; Lasso lægger bredderne): 1 Overblik = nøgletalskort, graf + nøgle-værdi-liste, lister to og to. 2 Fokus = ét stort element + fakta (ejerdiagram + ejerliste, scoremåler + forklaring, LassoRelations). 3 Ligeværdige = to med samme vægt (LassoPersonList + LassoOwnerList). 4 Liste først = tabel (LassoCompanyTable). 5 Sammenligning = compare_companies. 6 Tidslinje = LassoTimeline med filterColumn: true eller LassoNews. 7 Fortælling = LassoSummary + LassoKeyFigureCards. 8 Kortgitter og 9 Harmonika: se group. Bland aldrig to mønstre i én række.
Regnskab: hele regnskabet → LassoFinancialStatements; ét udsnit ved siden af andet → de kompakte LassoIncomeStatement, LassoBalanceSheet, LassoCashFlow. Kun årsregnskaber.
group { id, pattern, title? } samler sammenhængende komponenter: pattern 'cards' = kortgitter (korte elementer eller nyheder side om side); 'accordion' = harmonika, når ét svar samler 3+ lange sektioner (fx LassoIncomeStatement, LassoBalanceSheet, LassoCashFlow, LassoTextSections variant 'analyse'), første række åben. toolbar? { primary?: { label, prompt }, actions?: [{ label, prompt }] } giver modulets værktøjslinje med op til 3 opfølgende spørgsmål; udelad den uden handlinger. Brug ikke group til 1 komponent.
Højdebudget: en side må højst være ca. 1300 px ved 1200 px bredde. Vælg højst så mange elementer, at den holder (fx hoved, nøgletalskort, profil (limit 3), oplysninger (rows 6), relationer, graf, kontakt; ikke også genveje, historik og nyheder), og brug kompakte lister (LassoKeyValueList rows 6, LassoTextSections variant 'profil' limit 3, LassoTimeline/LassoNews limit 3). Udelad hellere de mindst relevante elementer (først genveje, så nyheder, så historik) end at gøre siden længere. Beder brugeren udtrykkeligt om alt ('vis alt om X', 'det hele'), kald show_company/show_person med show_all: true.
Lasso-side: layout 'page' + column 1-3 giver portalens side (smal 1: kort, genveje, score; midt 2: relationer, profil; bred 3: oplysninger, regnskab, resume) i forholdet 2:3:4; uden column fuld bredde. Kun til sider, der skal ligne Lassos portal.
Samme spørgsmål giver samme mønster hver gang.`;

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
  LassoKeyFigureCards: g("full", "third", "full", "low", "fixed"),
  LassoKeyValueList: g("half", "half", "half", "very-high", "growing", "rows"),
  LassoContact: g("third", "quarter", "half", "medium", "fixed"),
  LassoContactPersons: g("third", "quarter", "half", "medium", "growing", "rows"),
  LassoShortcuts: g("half", "quarter", "half", "low", "fixed"),
  LassoTextSections: g("half", "half", "full", "high", "growing", "lines"),
  LassoSummary: g("half", "quarter", "half", "high", "growing", "lines"), // Jakob 01.10 (modul 7): ¾ bliver for bred; højst ½
  LassoTimeline: g("third", "quarter", "half", "high", "growing", "rows"),
  LassoNews: g("half", "half", "half", "medium", "growing", "rows"), // Jakob 01.10: ½ som standard; ¾ og fuld er for brede
  LassoBarChart: g("half", "third", "full", "medium", "fixed", "plot"),
  LassoGroupedBarChart: g("half", "quarter", "half", "medium", "fixed", "plot"), // Jakob 01.10: ⅔ og bredere er for bredt
  LassoLineChart: g("half", "half", "full", "medium", "fixed", "plot"), // Jakob 01.10: ¼ og ⅓ er for små
  LassoStackedBarChart: g("half", "quarter", "three-quarters", "medium", "fixed", "plot"), // Jakob 01.10: fuld er for bred
  LassoWaterfallChart: g("half", "third", "full", "medium", "fixed", "plot"), // Jakob 01.10: ¼ er for lille
  LassoShareBars: g("half", "half", "half", "medium", "fixed"),
  LassoKeyFigureGauge: g("third", "third", "half", "medium", "fixed"), // Jakob 01.10: ¼ er for lille
  LassoMultiYearTable: g("two-thirds", "two-thirds", "full", "medium", "growing"), // Jakob 01.10: også en stor (fuld) med flere nøgletal
  LassoIncomeStatement: g("half", "half", "half", "high", "growing"),
  LassoBalanceSheet: g("third", "third", "half", "very-high", "growing"),
  LassoCashFlow: g("half", "half", "half", "high", "growing"), // Jakob 01.10: ⅓ er for lille
  LassoFinancialStatements: g("three-quarters", "two-thirds", "three-quarters", "very-high", "growing"), // Jakob 01.10: fuld er for bred
  LassoPersonList: g("third", "quarter", "half", "medium", "growing", "rows"),
  LassoOwnerList: g("third", "quarter", "half", "low", "growing", "rows"),
  LassoBeneficialOwners: g("third", "quarter", "half", "low", "growing", "rows"),
  LassoOwnershipDiagram: g("two-thirds", "two-thirds", "full", "high", "growing", "plot"),
  LassoRelations: g("quarter", "quarter", "third", "medium", "growing"), // Jakob 01.10: ½ er for bred
  LassoRiskObservations: g("third", "third", "half", "high", "growing", "rows"),
  LassoScoreGauge: g("quarter", "quarter", "half", "medium", "fixed"),
  LassoCreditRating: g("third", "quarter", "third", "high", "fixed"), // Jakob 01.10: ½ er for bred
  LassoProductionUnits: g("full", "three-quarters", "full", "high", "growing"),
  LassoProperties: g("half", "half", "full", "low", "growing"),
  LassoMap: g("half", "third", "full", "high", "fixed", "plot"),
  LassoRegistration: g("half", "half", "half", "high", "growing"), // Jakob 01.10: ⅔, ¾ og fuld bruges ikke
  LassoMergers: g("half", "half", "half", "high", "growing"),
  LassoAnnouncements: g("half", "half", "half", "low", "growing", "rows"), // Jakob 01.10: som en nyhed i ½
  LassoRelationsTable: g("two-thirds", "two-thirds", "two-thirds", "very-high", "growing", "rows"), // Jakob 01.10: fuld er for bred
  LassoCompanyHistory: g("full", "two-thirds", "full", "very-high", "growing", "rows"),
  LassoPublications: g("half", "half", "half", "high", "growing", "rows"), // Jakob 01.10: fuld er for bred
  LassoLivestock: g("half", "third", "half", "high", "growing"),
  LassoCompareTable: g("full", "two-thirds", "full", "high", "growing"),
  LassoRanking: g("half", "quarter", "two-thirds", "medium", "growing", "rows"), // Jakob 01.10: ¾ og fuld er for brede
  LassoCompanyTable: g("full", "full", "full", "high", "growing", "rows"),
  LassoPersonTable: g("full", "full", "full", "high", "growing", "rows"),
  LassoPersonHead: g("full", "full", "full", "low", "fixed"),
  LassoPersonStats: g("half", "third", "half", "low", "fixed"), // Jakob 01.10: ⅔ og bredere er for brede
  LassoPersonRoles: g("two-thirds", "half", "full", "medium", "growing", "plot"),
  LassoPersonNetwork: g("full", "full", "full", "medium", "growing", "plot"),
  LassoPersonRisk: g("third", "third", "half", "high", "growing", "rows"),
  LassoPersonFacts: g("third", "third", "third", "high", "growing", "rows"), // Jakob 01.10: ¼ for smal, ½ for bred
  LassoChangeFeed: g("half", "half", "half", "very-high", "growing", "rows"),
  LassoHeatmap: g("half", "third", "three-quarters", "medium", "fixed"), // Jakob 01.10: i ¼ er der ikke plads til månederne
  LassoFollowUps: g("full", "full", "full", "low", "fixed"),
  LassoSavedPages: g("full", "full", "full", "high", "growing"),
};

/** Regnskabslisten (09, variant 'financials') har 12 faste rækker: høj og fast, ikke meget høj og voksende. */
const FINANCIALS_LIST_RULE: GridRule = g("half", "half", "half", "high", "fixed", "rows");

/**
 * PersonRoles som liste (show current | ended | owner, "Aktive roller"): smal, højst ½ (A13: 64–66 % tom
 * plads i fuld bredde, 26–31 % i ½). Tidsbåndet (show 'all') følger GRID_RULES.LassoPersonRoles.
 */
const PERSON_ROLES_LIST_RULES: Record<"current" | "ended" | "owner", GridRule> = {
  current: g("half", "half", "half", "medium", "growing"),
  ended: g("half", "third", "half", "medium", "growing"),
  owner: g("half", "third", "half", "medium", "growing"),
};

/** Variant-nøglen, en komponent har sin egen række i elementtabellen og registeret under (bredde.varianter), ellers undefined. */
export function gridVariantOf(c: Pick<ViewComponent, "type"> & { variant?: unknown; show?: unknown }): string | undefined {
  if (c.type === "LassoKeyValueList" && c.variant === "financials") return "variant:financials";
  if (c.type === "LassoPersonRoles" && (c.show === "current" || c.show === "ended" || c.show === "owner")) return `show:${c.show}`;
  return undefined;
}

/** Gitterreglen for en konkret komponent (varianter kan have deres egen række i elementtabellen). */
export function gridRuleOf(c: Pick<ViewComponent, "type"> & { variant?: unknown; show?: unknown }): GridRule {
  if (c.type === "LassoKeyValueList" && c.variant === "financials") return FINANCIALS_LIST_RULE;
  if (c.type === "LassoPersonRoles" && (c.show === "current" || c.show === "ended" || c.show === "owner")) return PERSON_ROLES_LIST_RULES[c.show];
  return GRID_RULES[c.type];
}

/** Gitterreglerne for varianterne (nøgle som gridVariantOf), til dokumentationen. */
export const GRID_VARIANT_RULES: Readonly<Record<string, GridRule>> = {
  "LassoKeyValueList variant:financials": FINANCIALS_LIST_RULE,
  "LassoPersonRoles show:current": PERSON_ROLES_LIST_RULES.current,
  "LassoPersonRoles show:ended": PERSON_ROLES_LIST_RULES.ended,
  "LassoPersonRoles show:owner": PERSON_ROLES_LIST_RULES.owner,
};

/**
 * Bredde-profilen (Ø13) for en konkret komponent: registerets profil, eller variantens (bredde.varianter),
 * når komponenten har sin egen række (fx PersonRoles som liste = smal, tidsbåndet = fleksibel).
 */
export function widthProfileOf(c: Pick<ViewComponent, "type"> & { variant?: unknown; show?: unknown }): { profil: WidthProfile; drivere?: ContentWidthDrivers } {
  const reg = REGISTER_BY_TYPE.get(c.type);
  if (!reg) return { profil: "fleksibel" };
  const v = gridVariantOf(c);
  return (v && reg.bredde.varianter?.[v]) || reg.bredde;
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
    description: `Brug til: identitet for én virksomhed øverst i enhver visning om én virksomhed: KUN navnet og handlingerne; status står kun ved afvigelse (Aktiv/Normal = navnet alene; alle andre statusser, fx 'Under konkurs', 'Ophørt', 'Under frivillig likvidation', efter navnet i deres farvegruppe, Jakob runde 6); ingen faktalinje (CVR, form, stiftet, adresse, ansatte, branche) under navnet og ingen skillestreg (Jakob 29.09). CVR, stiftet, form, branche og ansatte står i LassoKeyValueList variant 'company', adressen i LassoContact. Brug ikke når: kun ét stamdatafelt skal vises (LassoKeyValueList variant 'company') eller det gælder flere virksomheder (LassoCompareTable/LassoCompanyTable). Kræver: company, variant?, risk?; findes for alle CVR-virksomheder. variant 'full' (standard) er sidens hoved med handlinger (Overvåg, Gem, Eksportér, Flere); 'compact' (56 px) og 'line' (40 px) står over et enkelt element på svarniveau A/B. risk true henter observationer (10–14 s) og viser 'Se risiko'-linjen ved 50+; kun når spørgsmålet handler om risiko. Status står som ren tekst med CVR's danske navn (NORMAL → Normal, OPLØSTEFTERKONKURS → Opløst efter konkurs) og farve efter gruppe: aktiv (Aktiv, Normal), midlertidig i gul (Fremtid, Uden retsvirkning, Under frivillig likvidation, Under reassumering), problem i rød (Under konkurs, Under tvangsopløsning, Under rekonstruktion, Tvangsopløst, Opløst efter konkurs), inaktiv i muted (Ophørt, Opløst, Opløst efter …, Slettet); ordet bærer altid betydningen. ${F("overblik (og alle andre focus)")} Eksempel: øverst i en render_view-spec om én virksomhed; 'hvad er omsætningen i X' → variant 'line' + LassoKeyFigureCards med ét metric.`,
    props: "company, variant?, risk?",
    register: {
      formaal: "Virksomhedens navn og handlinger øverst i en visning; status kun ved afvigelse.",
      bedstTil: ["identitet", "overskrift på enhver virksomhedsvisning"],
      undgaaNaar: ["kun ét stamdatafelt skal vises (LassoKeyValueList variant 'company')", "flere virksomheder (LassoCompareTable/LassoCompanyTable)"],
      kraeverData: ["companies", "observations"],
      live: "altid",
      veje: ["render_view"],
      bredde: { profil: "fleksibel", drivere: { longestLabel: 44 } },
    },
  },
  {
    type: "LassoKeyValueList",
    title: "Nøgle-værdi-liste",
    description: `Brug til: variant 'company' (standard): revisor, seneste revisorskift, regnskabsperiode, branchekode, kommune og region, telefon, e-mail, web som én liste – stamdataspørgsmål ('hvem er revisor', 'hvilken kommune'). Listen viser også identiteten (CVR-nummer, stiftet, virksomhedsform, branche, ansatte), da LassoCompanyHead kun viser navnet; det, LassoContact viser på samme side (adresse, telefon, e-mail, web), gentages ikke. variant 'financials': de 11 nøgletal (omsætning/bruttofortjeneste, resultat, egenkapital, ansatte, EBITDA, soliditetsgrad, overskudsgrad, likviditetsgrad, balancesum, gæld) plus regnskabsperiode og udgivelsesdato for ÉT år, med årsvælger for de seneste 5 år; exclude udelader nøgletal, der allerede står i LassoKeyFigureCards på siden; only viser kun de nævnte nøgletal; year åbner på det nævnte regnskabsår ('omsætningen i 2023'). variant 'company' med rows viser kun de rækker, spørgsmålet gælder (fx revisor, revisorskift, regnskabsperiode). Brug ikke når: tallet skal have ændring mod året før (LassoKeyFigureCards), flere år side om side (LassoMultiYearTable), alle regnskabslinjer (LassoIncomeStatement/LassoBalanceSheet), eller det gælder formål/tegningsregler (LassoTextSections). Kræver: company, variant?, exclude?, only?, year?, rows?; manglende felter udelades (revisor og regnskabstal står som '-'). Virksomhedsreferencer (revisor, moderselskab) står kun med navnet – ingen CVR, rolle eller andel under; personreferencer må have 'Siden <dato>'. ${F("overblik, risiko og kontakt (company) samt oekonomi (financials)")} I et svar på niveau B (30.13) står listen kort: years 2 giver årsvælgeren '2025 | 2024', og maxRows 4 viser fire rækker med 'Se N oplysninger' under; brug ikke maxRows, når listen er selve svaret. Eksempel: 'Hvem er revisor for Lasso X?' → variant 'company' (eller show_company focus overblik); 'Hvordan går det med X?' i chatten → variant 'financials', title 'Virksomhedsoplysninger', years 2, maxRows 4.`,
    props: `company, variant? (company | financials), title?, exclude? (kun financials), only? (kun financials: nøgletal), year? (kun financials: regnskabsår), rows? (kun company: ${COMPANY_FACT_KEYS.join(" | ")}), years? (2–5, kun financials), maxRows? (1–20)`,
    register: {
      formaal: "Stamdata eller nøgletal for ét år som nøgle/værdi-liste.",
      bedstTil: ["revisor", "stiftet", "status", "branche", "kommune", "telefon", "email", "web", "hvem er revisor", "hvilken kommune ligger X i"],
      undgaaNaar: ["tallet skal have ændring mod året før (LassoKeyFigureCards)", "flere år side om side (LassoMultiYearTable)", "alle regnskabslinjer (LassoIncomeStatement/LassoBalanceSheet)", "formål/tegningsregler (LassoTextSections)"],
      kraeverData: ["companies", "ownership", "financials"],
      live: "altid",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { longestLabel: 45 }, varianter: { "variant:financials": { profil: "smal" } } },
    },
  },
  {
    type: "LassoContact",
    title: "Kontaktblok",
    description: `Brug til: telefon, e-mail, web og adresse som klikbare kontaktoplysninger – 'telefonnummer på X', 'hvordan kontakter jeg X'. Brug ikke når: det gælder stamdata som stiftet/form/revisor (LassoKeyValueList variant 'company', som også har kontaktfelterne), eller navngivne personer (LassoContactPersons). Kræver: company; kilden er CVR eller virksomhedens hjemmeside, og komponenten viser tom tilstand, når intet er oplyst. ${F("kontakt (og overblik)")} Eksempel: 'Hvad er telefonnummer og e-mail på Lasso X?' → show_company focus kontakt.`,
    props: "company, title?",
    register: {
      formaal: "Telefon, e-mail, web og adresse som klikbare kontaktoplysninger.",
      bedstTil: ["telefon", "email", "web", "adresse", "telefonnummer på X", "hvordan kontakter jeg X"],
      undgaaNaar: ["stamdata som stiftet/form/revisor (LassoKeyValueList variant 'company')", "navngivne personer (LassoContactPersons)"],
      kraeverData: ["contact"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal" },
    },
  },
  {
    type: "LassoContactPersons",
    title: "Kontaktpersoner",
    description: `Brug til: navngivne kontaktpersoner fra virksomhedens hjemmeside med rolle/afdeling, telefon og e-mail – 'hvem kan jeg kontakte hos X', 'kontaktpersoner'. Brug ikke når: det gælder direktion/bestyrelse i CVR (LassoPersonList) eller virksomhedens hovednumre (LassoContact). Kræver: company; listen er tom, når hjemmesiden er ukendt eller ingen personer er fundet. Blokken viser 3 personer; 'Se N kontaktpersoner' åbner 'Se alle'-panelet (08.7): på desktop tre kolonner (virksomheden med adresse, CVR, Live Nummer, telefonnumre og e-mailadresser | stillinger pr. afdeling | valgt person med 'Kopiér telefonnummer'/'Kopiér e-mailadresse'; ingen kildevisning), på tablet og mobil liste + detalje; intet kan rettes eller gemmes i panelet. ${F("kontakt")} Eksempel: 'Hvem er kontaktpersonerne hos Lasso X?' → show_company focus kontakt.`,
    props: "company, title?",
    register: {
      formaal: "Navngivne kontaktpersoner fra virksomhedens hjemmeside med rolle, telefon og e-mail.",
      bedstTil: ["kontaktpersoner", "hvem kan jeg kontakte hos X"],
      undgaaNaar: ["direktion/bestyrelse i CVR (LassoPersonList)", "virksomhedens hovednumre (LassoContact)"],
      kraeverData: ["contactPersons", "companies", "contact"],
      live: "naar-data",
      liveNote: "Virksomheden har ingen hjemmeside, Lasso kan hente kontaktpersoner fra.",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 3, longestLabel: 44 } },
    },
  },
  {
    type: "LassoShortcuts",
    title: "Genveje",
    description: `Brug til: en række knapper, der åbner et Lasso-værktøj på virksomheden (ejerdiagram, regnskabsanalyse, nøgletal, ejendomme, tinglysning, firmaindsigt) – 'hvad kan jeg ellers se om X', som indgang ved siden af kontaktblokken. Brug ikke når: svaret er selve dataene (vis elementet direkte, fx LassoOwnershipDiagram), eller værten ikke kan åbne sektioner (så vises intet). Kræver: company, tools? (maks 6 synlige, resten under 'Flere'). Nås via fokus-siderne i show_company / render_view. Eksempel: render_view med LassoCompanyHead, LassoContact og LassoShortcuts.`,
    props: "company, tools?, title?",
    register: {
      formaal: "Knapper, der åbner et Lasso-værktøj på virksomheden.",
      bedstTil: ["hvad kan jeg ellers se om X", "genveje til ejerdiagram, regnskabsanalyse og ejendomme"],
      undgaaNaar: ["svaret er selve dataene (vis elementet direkte, fx LassoOwnershipDiagram)", "værten ikke kan åbne sektioner"],
      kraeverData: ["companies"],
      live: "altid",
      veje: ["focus", "render_view"],
      bredde: { profil: "smal", drivere: { longestLabel: 44 } },
    },
  },
  {
    type: "LassoTextSections",
    title: "Tekstsektioner",
    description: `Brug til: variant 'profil' (standard): formål og tegningsregler fra CVR plus regnskabsanalysens konklusion, resultat og likviditet som korte afsnit – 'hvad laver X', 'formål', 'hvem kan tegne selskabet'. variant 'analyse': hele Lassos regnskabsanalyse (konklusion, resultat, likviditet, balance og kapitalforhold, branchestatistik, revisoroplysninger, spørgsmål til overvejelse), som foldbare afsnit med det første åbent og 'Hent som PDF' i hovedet (19.3: en A4 af hele analysen med alle afsnit foldet ud, 19.6; kun når værten kan eksportere). Branchen står i LassoCompanyHead og vises ikke her. Brug ikke når: feltet er en kort værdi som stiftet/form/revisor (LassoKeyValueList variant 'company'), eller du selv skriver en vurdering (LassoSummary). Kræver: company, variant?; manglende tekster udelades. ${F("overblik (profil) og oekonomi (analyse)")} limit N (kun profil) viser de første N afsnit med 'Vis mere' under: den kompakte profil, når siden ellers går over højdebudgettet (23.3); udelad den, når profilen er selve svaret. folded true (kun analyse) folder analysen til 3 linjer med 'Vis mere' på alle bredder, fx i et svar på niveau B i chatten (30.13); brug det ikke, når analysen er hele svaret. Eksempel: 'Hvad er formålet med selskabet X, og hvem kan tegne det?'`,
    props: "company, variant? (profil | analyse), title?, folded? (kun analyse), limit? (kun profil)",
    register: {
      formaal: "Formål, tegningsregler og regnskabsanalysens afsnit som korte tekstsektioner.",
      bedstTil: ["formaal", "hvad laver X", "hvem kan tegne selskabet", "regnskabsanalyse"],
      undgaaNaar: ["feltet er en kort værdi som stiftet/form/revisor (LassoKeyValueList variant 'company')", "du selv skriver en vurdering (LassoSummary)"],
      kraeverData: ["textSections"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "fleksibel" },
    },
  },
  {
    type: "LassoSummary",
    title: "Resumé",
    description:
      "Brug til: din egen analyse eller vurdering i prosa (uden kildelinje) – 'vurdér', 'opsummér', 'hvad synes du'. Indgår altid som sidste komponent i en render_view-spec sammen med de datakomponenter, vurderingen bygger på (fx LassoCompanyHead + LassoKeyFigureCards + LassoSummary); aldrig som eneste komponent og aldrig som et ekstra kald efter show_company. Du skriver hele 'text' ud fra tal, du allerede kender; komponenten henter intet. Brug ikke når: teksten findes i CVR (LassoTextSections), eller tal alene svarer (LassoKeyFigureCards). Kræver: text (1–4000 tegn), title?, source?, updated?. Nås via render_view. Rent ét-emne-vurderinger ('hvordan går det økonomisk for X') er show_company plus 2–3 sætninger i chatten. Eksempel: 'Vurdér X samlet på økonomi og ejerforhold' → render_view med LassoCompanyHead, LassoKeyFigureCards, LassoOwnerList, LassoSummary.",
    props: "text, title?, source?, updated?",
    register: {
      formaal: "Kort skrevet vurdering eller opsummering, som modellen selv formulerer.",
      bedstTil: ["egen vurdering", "opsummering som sidste sektion", "fortælling ved siden af nøgletal"],
      undgaaNaar: ["tallene selv skal vises (LassoKeyFigureCards, LassoMultiYearTable)", "der findes en færdig komponent til emnet"],
      kraeverData: [],
      live: "altid",
      veje: ["render_view"],
      bredde: { profil: "fleksibel" },
    },
  },
  {
    type: "LassoTimeline",
    title: "Tidslinje",
    description: `Brug til: begivenheder over tid – stiftelse, ledelsesskift og offentliggjorte regnskaber, nyeste øverst – 'historik', 'hvad er der sket', 'hvornår skiftede de direktør'. Med person i stedet for company: personens historik (indtrådt/udtrådt som X i et selskab, blev/ophørt som ejer, og selskabernes konkurser og tvangsopløsninger). Brug ikke når: det gælder tal over år (LassoBarChart), de nuværende personer (LassoPersonList) eller medieomtale (LassoNews). Kræver: company ELLER person (præcis én), kinds? (kun company: kun ledelses-, regnskabs-, status-, stamdata- eller ejerskabsbegivenheder, fx 'hvornår skiftede de direktør' → ['ledelse']); bygges af CVR- og regnskabsdata og er sjældent tom. filterColumn true (mønster 6) stiller typefiltrene i en kolonne ¼ ved siden af strømmen ¾ i fuld bredde. ${F("historik (og som smagsprøve på overblik)")} Personens historik dækkes af show_person. Eksempel: 'Hvad er der sket hos X gennem årene?' → show_company focus historik.`,
    props: `company | person, title?, limit?, filter? ('risiko', kun person), kinds? (kun company: ${TIMELINE_KINDS.join(" | ")}), filterColumn? (true = mønster 6: filtre ¼ + strøm ¾, fuld bredde)`,
    register: {
      formaal: "Begivenheder over tid, nyeste øverst, for virksomhed eller person.",
      bedstTil: ["historik", "hvad er der sket", "hvornår skiftede de direktør", "hvornår blev X stiftet"],
      undgaaNaar: ["tal over år (LassoBarChart)", "nuværende personer (LassoPersonList)", "medieomtale (LassoNews)"],
      kraeverData: ["timeline"],
      live: "naar-data",
      veje: ["focus", "person", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 2 } },
    },
  },
  {
    type: "LassoNews",
    title: "Nyheder",
    description: `Brug til: medieomtale – nyhedsartikler om virksomheden (eller med person: om personen, fra Lasso News) med kilde, tidspunkt og uddrag – 'nyheder', 'omtale', 'seneste nyt'. Brug ikke når: det gælder registrerede ændringer i CVR (LassoTimeline). Kræver: company ELLER person (præcis én), limit? (standard 5); ingen artikler giver tom tilstand. ${F("historik (og som smagsprøve på overblik)")} Personens nyheder dækkes af show_person. layout 'grid' (mønster 8) stiller artiklerne som kortgitter i to kolonner i fuld bredde, fx i et nyhedsmodul under faner; brug det ikke i en ½-kolonne. Eksempel: 'Har X været i nyhederne?' → show_company focus historik.`,
    props: "company | person, limit? (1–10, standard 5), layout? ('grid')",
    register: {
      formaal: "Medieomtale om virksomhed eller person med kilde, tidspunkt og uddrag.",
      bedstTil: ["nyheder", "omtale", "seneste nyt om X"],
      undgaaNaar: ["registrerede ændringer i CVR (LassoTimeline)"],
      kraeverData: ["news"],
      live: "naar-data",
      veje: ["focus", "person", "ask", "render_view"],
      bredde: { profil: "bred", drivere: { rowsPerItem: 3 } },
    },
  },

  // (a) Tal og grafer ------------------------------------------------------------
  {
    type: "LassoKeyFigureCards",
    title: "Nøgletalskort",
    description: `Brug til: 1–6 nøgletal fra seneste regnskab, hvert med ændring mod året før – det hurtige økonomiske snapshot, eller ét enkelt tal ('hvor mange ansatte', 'hvad er soliditetsgraden') med ét metric. Brug ikke når: udvikling over flere år (LassoBarChart som graf, LassoMultiYearTable som tal), alle nøgletal for ét år med årsvælger (LassoKeyValueList variant 'financials'), eller stamdata uden tal (LassoKeyValueList variant 'company'). Kræver: company, metrics? (standard 4 kort); uden regnskab står kortene som 'Ikke oplyst'. ${F("oekonomi (og overblik)")} Ændringen mod året før står kun som pil + procent i grøn (stigning) eller rød (fald), fx '▲ 12,4 %' eller '▼ 15,1 %', også ved skift mellem overskud og underskud; ingen ord, intet 'fra ÅÅÅÅ' og ingen anden procent (branche) efter. Kan ændringen ikke beregnes (intet forrige år, eller forrige = 0), vises ingen ændring. variant 'plain' giver sidens rolige form (felter adskilt af lodrette linjer uden ydre ramme, ingen sparkline, én udviklingslinje); brug den, når kortene står i et svar på niveau B sammen med graf og liste (30.13). Brug ikke 'plain' når: tallene står alene som svar (standardformen med sparkline). Eksempel: 'Hvor mange ansatte har Danfoss?' → show_company focus overblik, eller metrics ['ansatte'] i en render_view-spec; 'Hvordan går det med X?' i chatten → variant 'plain'.`,
    props: `company, metrics? (1–6 af ${METRICS.join(" | ")}), variant? ('plain')`,
    register: {
      formaal: "1–6 nøgletal fra seneste regnskab hver med ændring mod året før.",
      bedstTil: ["nøgletal", "omsætning", "resultat", "soliditetsgrad", "hvor mange ansatte", "hvad er omsætningen"],
      undgaaNaar: ["udvikling over flere år (LassoBarChart/LassoMultiYearTable)", "alle nøgletal for ét år (LassoKeyValueList variant 'financials')", "stamdata uden tal (LassoKeyValueList variant 'company')"],
      kraeverData: ["financials"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "fleksibel" },
    },
  },
  {
    type: "LassoBarChart",
    title: "Søjlegraf, ét nøgletal",
    description: `Brug til: udviklingen i ÉT nøgletal over 2–10 år som søjler. Brug ikke når: 2–3 nøgletal i samme graf (LassoGroupedBarChart), en anden virksomhed som benchmark (LassoLineChart), tabel eller 4+ nøgletal (LassoMultiYearTable), kun seneste år (LassoKeyFigureCards), eller egenkapital mod gæld (LassoStackedBarChart). Kræver: company, metric, years (standard 5); år uden regnskab udelades. ${F("oekonomi (og overblik)")} Eksempel: 'Hvordan har omsætningen udviklet sig hos Carlsberg de sidste 10 år?' → show_company focus oekonomi (chart_metric 'omsaetning', years 10).`,
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5)`,
    register: {
      formaal: "Udviklingen i ét nøgletal over 2–10 år som søjler.",
      bedstTil: ["udvikling i omsætning", "hvordan går det med resultatet over tid"],
      undgaaNaar: ["2–3 nøgletal (LassoGroupedBarChart)", "4+ nøgletal eller tabel (LassoMultiYearTable)", "kun seneste år (LassoKeyFigureCards)", "egenkapital mod gæld (LassoStackedBarChart)"],
      kraeverData: ["financials"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "fleksibel", drivere: { timeAxis: true } },
    },
  },
  {
    type: "LassoGroupedBarChart",
    title: "Grupperede søjler, 2–3 nøgletal",
    description: `Brug til: 2–3 nøgletal side om side pr. år for én virksomhed ('omsætning og resultat over tid'). Brug ikke når: ét nøgletal (LassoBarChart), 4+ nøgletal eller præcise tal (LassoMultiYearTable), to virksomheder (LassoLineChart), eller egenkapital + gæld som helhed (LassoStackedBarChart). Kræver: company, metrics (2–3), years. ${F("oekonomi")} Eksempel: 'Vis omsætning og resultat for Vestas de seneste 5 år.' → show_company focus oekonomi.`,
    props: `company, metrics (2–3 af ${METRICS.join(" | ")}), years (2–10, standard 5)`,
    register: {
      formaal: "2–3 nøgletal side om side pr. år for én virksomhed.",
      bedstTil: ["omsætning og resultat over tid", "hvordan går det økonomisk"],
      undgaaNaar: ["ét nøgletal (LassoBarChart)", "4+ nøgletal eller præcise tal (LassoMultiYearTable)", "to virksomheder (LassoLineChart)"],
      kraeverData: ["financials"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "fleksibel", drivere: { timeAxis: true, series: 3 } },
    },
  },
  {
    type: "LassoLineChart",
    title: "Linjegraf med benchmark",
    description:
      "Brug til: ét nøgletal som linje over år for én virksomhed med ÉN benchmark-virksomhed som stiplet linje – præcis to virksomheder, ét nøgletal, over tid – eller med industry true: virksomheden mod branchens median, begge som indeks (første år = 100) – 'udvikler de sig bedre end branchen'. Brug ikke når: én virksomhed uden benchmark (LassoBarChart), 3+ virksomheder (LassoCompareTable for flere nøgletal, LassoRanking for ét), flere nøgletal for én virksomhed (LassoGroupedBarChart), eller seneste års nøgletal mod branchen (LassoKeyFigureGauge). Kræver: company, metric, years, benchmark ELLER industry; branchetal kan mangle, og grafen siger da hvorfor. Nås via spørgsmål i show_company/show_person / render_view. Eksempel: 'Sammenlign omsætningsudviklingen for Netto og Rema 1000 over 5 år.' / 'Vokser X hurtigere end branchen?' → industry true.",
    props: `company, metric (${METRICS.join(" | ")}), years (2–10, standard 5), benchmark? (virksomhed), industry? (true = branchen som indeks)`,
    register: {
      formaal: "Ét nøgletal over tid som linje, evt. mod en anden virksomhed eller branchen.",
      bedstTil: ["sammenlign to virksomheder over tid", "udvikling mod branchen"],
      undgaaNaar: ["ét nøgletal for én virksomhed uden sammenligning (LassoBarChart)", "tabel (LassoMultiYearTable)"],
      kraeverData: ["financials", "companies", "industryBenchmarks"],
      live: "naar-data",
      veje: ["ask", "render_view"],
      bredde: { profil: "fleksibel", drivere: { timeAxis: true, series: 2 } },
    },
  },
  {
    type: "LassoStackedBarChart",
    title: "Stablede søjler, balance",
    description:
      "Brug til: balancen på seneste balancedag som to stablede søjler, aktiver (anlæg, omsætning) mod passiver (egenkapital, langfristet og kortfristet gæld), med værdierne i segmenterne – 'hvordan ser balancen ud', 'hvad er aktiverne finansieret med'. years afgør, hvor langt tilbage der ledes efter seneste balance. Brug ikke når: egenkapitalens andel som procent (LassoShareBars), udvikling i ét nøgletal (LassoBarChart med metric 'egenkapital', 'gaeld' eller 'soliditetsgrad'), flere år side om side (LassoMultiYearTable), eller frit valgte nøgletal (LassoGroupedBarChart). Kræver: company, years; mangler gæld i regnskaberne, vises tom tilstand. Nås via spørgsmål i show_company/show_person / render_view. Eksempel: 'Hvordan er balancen skruet sammen hos X?'",
    props: "company, years (2–10, standard 5)",
    register: {
      formaal: "Egenkapital og gæld (aktiver mod passiver) som stablede søjler.",
      bedstTil: ["balancens sammensætning", "egenkapital mod gæld"],
      undgaaNaar: ["ét nøgletal (LassoBarChart)", "andele i procent (LassoShareBars)", "alle balanceposter (LassoBalanceSheet)"],
      kraeverData: ["financials", "financialStatements"],
      live: "naar-data",
      veje: ["ask", "render_view"],
      bredde: { profil: "fleksibel", drivere: { timeAxis: true, series: 4 } },
    },
  },
  {
    type: "LassoShareBars",
    title: "Andelsbjælker, balance seneste år",
    description: `Brug til: dele af en helhed som donut med total i midten + andelsbjælker. variant 'balance' (standard): egenkapital og gæld som andele i procent af balancen for seneste regnskabsår. variant 'ejerkreds': ejerkredsen som andele med CVR's intervaller som tekst ('hvordan er ejerskabet fordelt'). Brug ikke når: flere år (LassoMultiYearTable), aktiver mod passiver (LassoStackedBarChart), soliditetsgraden som tal med ændring (LassoKeyFigureCards metrics ['soliditetsgrad']), eller ejernes navne og roller (LassoOwnerList). Kræver: company, variant?; mangler gæld i regnskabet eller ejerandele i CVR, vises tom tilstand. ${F("oekonomi (balance)")} Eksempel: 'Hvor stor en del af balancen er egenkapital hos X?' → show_company focus oekonomi.`,
    props: "company, variant? (balance | ejerkreds)",
    register: {
      formaal: "Dele af en helhed som donut og andelsbjælker (balance eller ejerkreds).",
      bedstTil: ["balance", "egenkapital og gæld i procent", "hvordan er ejerskabet fordelt"],
      undgaaNaar: ["flere år (LassoMultiYearTable)", "soliditetsgrad som tal (LassoKeyFigureCards)", "ejernes navne og roller (LassoOwnerList)"],
      kraeverData: ["financials", "ownership"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { series: 4 } },
    },
  },
  {
    type: "LassoWaterfallChart",
    title: "Vandfald, omsætning til resultat",
    description: `Brug til: hvordan omsætning/bruttofortjeneste bliver til årets resultat i seneste regnskabsår. Brug ikke når: udvikling over år (LassoBarChart), enkelte tal med ændring (LassoKeyFigureCards), eller alle linjer i resultatopgørelsen (LassoIncomeStatement). Kræver: company; mangler resultat i seneste regnskab, vises tom tilstand. ${F("oekonomi")} Eksempel: 'Hvor bliver pengene af mellem omsætning og resultat hos X?' → show_company focus oekonomi.`,
    props: "company",
    register: {
      formaal: "Hvordan omsætning bliver til årets resultat i seneste regnskabsår.",
      bedstTil: ["fra omsætning til resultat", "hvor forsvinder pengene hen"],
      undgaaNaar: ["udvikling over år (LassoBarChart)", "enkelte tal (LassoKeyFigureCards)", "alle linjer (LassoIncomeStatement)"],
      kraeverData: ["financials", "financialStatements"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "fleksibel", drivere: { series: 8 } },
    },
  },
  {
    type: "LassoKeyFigureGauge",
    title: "Nøgletalsmåler, mod branchen",
    description: `Brug til: seneste års soliditetsgrad, overskudsgrad og likviditetsgrad mod branchens median som målere (grøn/gul/rød + ord) – 'hvordan ligger X i forhold til branchen', 'er soliditeten god for branchen'. Brug ikke når: udviklingen over år mod branchen (LassoLineChart med industry true), nøgletallene uden sammenligning (LassoKeyFigureCards), eller andre navngivne virksomheder (LassoRanking/LassoCompareTable). Kræver: company, metrics? (delmængde af soliditetsgrad | overskudsgrad | likviditetsgrad); branchetal kan mangle for rigtige virksomheder, og måleren viser da tom tilstand med årsag. Nås via render_view. Eksempel: 'Er soliditeten hos X god i forhold til branchen?'`,
    props: "company, metrics? (soliditetsgrad | overskudsgrad | likviditetsgrad), title?",
    register: {
      formaal: "Soliditets-, overskuds- og likviditetsgrad som målere mod branchens median.",
      bedstTil: ["hvordan ligger X i forhold til branchen", "er soliditeten god for branchen"],
      undgaaNaar: ["udvikling mod branchen (LassoLineChart med industry)", "nøgletal uden sammenligning (LassoKeyFigureCards)", "andre navngivne virksomheder (LassoRanking/LassoCompareTable)"],
      kraeverData: ["financials", "industryBenchmarks"],
      live: "ikke-endnu",
      liveNote: "Lasso har ingen branchetal for virksomhedens branche endnu.",
      veje: ["render_view"],
      bredde: { profil: "smal", drivere: { series: 3 } },
    },
  },
  {
    type: "LassoMultiYearTable",
    title: "Flerårstabel",
    description: `Brug til: nøgletal × år som TAL med ændring og tendens pr. række – præcise tal for 1–6 nøgletal over 2–10 år, eller 4+ nøgletal over tid. Brug ikke når: ét nøgletal som graf (LassoBarChart), 2–3 nøgletal som graf (LassoGroupedBarChart), kun ét år (LassoKeyValueList variant 'financials'), eller alle regnskabslinjer (LassoIncomeStatement). Kræver: company, metrics?, years, variant? (kun mobil: 'A' = nøgletal i rækker med fast navnekolonne og vandret rul til ældre år, når brugeren skal sammenligne på tværs af nøgletal; 'B' = ét kort pr. nøgletal med årene som kolonner, når der er få nøgletal og mange år; standard B ved 1–2 nøgletal). ${F("oekonomi")} Eksempel: 'Giv mig omsætning, bruttofortjeneste, resultat og egenkapital for X for hvert af de sidste 5 år i en tabel.'; 'udviklingen i ansatte over 5 år på mobil' → metrics ['ansatte'], variant 'B'.`,
    props: `company, metrics? (1–6 af ${METRICS.join(" | ")}), years (2–10, standard 5), title?, variant? (A | B)`,
    register: {
      formaal: "Nøgletal × år som præcise tal med ændring og tendens.",
      bedstTil: ["tabel over nøgletal", "præcise tal over år", "4+ nøgletal over tid"],
      undgaaNaar: ["ét nøgletal som graf (LassoBarChart)", "2–3 nøgletal som graf (LassoGroupedBarChart)", "kun ét år (LassoKeyValueList variant 'financials')", "alle regnskabslinjer (LassoIncomeStatement)"],
      kraeverData: ["financials"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "bred", drivere: { timeAxis: true, series: 10 } },
    },
  },
  {
    type: "LassoIncomeStatement",
    title: "Resultatopgørelse, fuld",
    description: `Brug til: HELE resultatopgørelsen, fuldstændig (omsætning, vareforbrug og eksterne omkostninger, bruttofortjeneste, personaleomkostninger, andre driftsomkostninger, EBITDA, af- og nedskrivninger, resultat af primær drift (EBIT), finansielle indtægter og omkostninger, resultat før skat, skat, årets resultat), kompakt med 2 år + ændring – 'resultatopgørelsen', 'alle posterne'. Bruges, når elementet IKKE står i fuld bredde (½ eller ¾ ved siden af andet). Brug ikke når: elementet skal stå i fuld bredde (brug LassoFinancialStatements med værktøjslinje og 5 år), kun nøgletal (LassoKeyFigureCards, LassoMultiYearTable) eller balancen (LassoBalanceSheet). Kræver: company, years? (2–3, standard 2); poster, regnskabet ikke indeholder, udelades (ingen tomme rækker). ${F("regnskab")} Eksempel: 'Vis hele resultatopgørelsen for X.' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
    register: {
      formaal: "Hele resultatopgørelsen, kompakt med 2 år og ændring.",
      bedstTil: ["resultatopgørelse", "hele resultatopgørelsen", "hvad er årets resultat før skat"],
      undgaaNaar: ["fuld bredde med værktøjslinje (LassoFinancialStatements)", "kun nøgletal (LassoKeyFigureCards/LassoMultiYearTable)", "balancen (LassoBalanceSheet)"],
      kraeverData: ["financials", "financialStatements"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { timeAxis: true, series: 5 } },
    },
  },
  {
    type: "LassoBalanceSheet",
    title: "Balance, fuld",
    description: `Brug til: HELE balancen (aktiver og passiver), fuldstændig (immaterielle, materielle og finansielle anlægsaktiver, anlægsaktiver i alt, varebeholdninger, tilgodehavender, likvide beholdninger, omsætningsaktiver i alt, aktiver i alt; egenkapital, hensatte forpligtelser, lang- og kortfristet gæld, passiver i alt), 2–3 år side om side – 'balancen', 'aktiver og passiver'. Bruges, når elementet IKKE står i fuld bredde; i fuld bredde bruges LassoFinancialStatements. Brug ikke når: kun egenkapital/gæld som andele (LassoShareBars/LassoStackedBarChart) eller ét nøgletal (LassoKeyFigureCards). Kræver: company, years? (2–3, standard 2); poster, regnskabet ikke indeholder, udelades. ${F("regnskab")} Eksempel: 'Vis balancen for X for de sidste to år.' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
    register: {
      formaal: "Hele balancen (aktiver og passiver), kompakt med 2–3 år.",
      bedstTil: ["balance", "aktiver og passiver", "hvor stor er egenkapitalen"],
      undgaaNaar: ["kun egenkapital/gæld som andele (LassoShareBars/LassoStackedBarChart)", "ét nøgletal (LassoKeyFigureCards)"],
      kraeverData: ["financials", "financialStatements"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { timeAxis: true, series: 5 } },
    },
  },
  {
    type: "LassoCashFlow",
    title: "Pengestrømsopgørelse",
    description: `Brug til: pengestrøm fra drift, investering og finansiering, årets ændring i likvider og likvider ultimo, 2–3 år side om side – 'pengestrøm', 'cash flow'. Bruges, når elementet IKKE står i fuld bredde; i fuld bredde bruges LassoFinancialStatements. Brug ikke når: det gælder resultat (LassoIncomeStatement) eller balance (LassoBalanceSheet). Kræver: company, years? (2–3, standard 2); selskaber i regnskabsklasse B aflægger den ikke, og komponenten viser da 'Pengestrømsopgørelse er ikke indberettet'. ${F("regnskab")} Eksempel: 'Hvordan er pengestrømmen hos X?' → show_company focus regnskab.`,
    props: "company, years? (2–3, standard 2), title?",
    register: {
      formaal: "Pengestrømsopgørelsen (drift, investering, finansiering), kompakt med 2–3 år.",
      bedstTil: ["pengestrøm", "cash flow"],
      undgaaNaar: ["resultat (LassoIncomeStatement)", "balance (LassoBalanceSheet)", "fuld bredde (LassoFinancialStatements)"],
      kraeverData: ["financials", "financialStatements"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { timeAxis: true, series: 5 } },
    },
  },

  {
    type: "LassoFinancialStatements",
    title: "Regnskabsdetaljer med værktøjslinje",
    description: `Brug til: det fulde regnskab som ÉT element i FULD bredde: værktøjslinje (selskab/koncern, regnskabsår, enhed, revisorpåtegning og 'Hent PDF'; kun årsregnskaber), på desktop den fuldstændige resultatopgørelse med balance og pengestrøm under, på mobil én opgørelse ad gangen – 'vis hele regnskabet', 'regnskabet med koncerntal', 'hent årsrapporten'. Brug ikke når: elementet står i ½ eller ¾ bredde (brug LassoIncomeStatement/LassoBalanceSheet/LassoCashFlow, kompakt med 2 år + ændring), kun én opgørelse er bestilt eller nøgletal over år (LassoMultiYearTable). Kræver: company, statement? (income | balance | cashflow, den der vises først på mobil), years? (2–5; brug 5 i fuld bredde); poster uden tal udelades. Nås fra show_company som svar-element på spørgsmål om hele regnskabet ('alle poster', 'vælg regnskabsår'); focus regnskab viser de tre kompakte opgørelser. Eksempel: 'Vis hele regnskabet for Lasso X med koncerntal' → show_company med spørgsmålet.`,
    props: "company, statement? (income | balance | cashflow), years? (2–5, standard 2), title?",
    register: {
      formaal: "Det fulde regnskab som ét element i fuld bredde med værktøjslinje.",
      bedstTil: ["vis hele regnskabet", "regnskabet med koncerntal", "hent årsrapport"],
      undgaaNaar: ["½ eller ¾ bredde (LassoIncomeStatement/LassoBalanceSheet/LassoCashFlow)", "kun én opgørelse eller nøgletal over år (LassoMultiYearTable)"],
      kraeverData: ["financials", "financialStatements"],
      live: "naar-data",
      veje: ["ask", "render_view"],
      bredde: { profil: "bred", drivere: { timeAxis: true, series: 5 } },
    },
  },

  {
    type: "LassoMergers",
    title: "Fusioner og spaltninger",
    description: `Brug til: virksomhedens fusioner og spaltninger som 'fra → til' med dato og type – 'har X fusioneret', 'hvilke selskaber er fusioneret ind i X', 'spaltning'. Brug ikke når: det gælder ejerskifte (LassoOwnerList/LassoOwnershipDiagram) eller hele historikken (LassoTimeline). Kræver: company; ingen hændelser giver en tom tilstand, der siger det. Nås fra show_company: focus historik (når der er data og plads) og svar-element på spørgsmål om fusioner og spaltninger. Eksempel: 'Er Lasso X fusioneret med andre selskaber?' → show_company med spørgsmålet.`,
    props: "company, title?",
    register: {
      formaal: "Fusioner og spaltninger som 'fra → til' med dato og type.",
      bedstTil: ["har X fusioneret", "hvilke selskaber er fusioneret ind i X", "spaltning"],
      undgaaNaar: ["ejerskifte (LassoOwnerList/LassoOwnershipDiagram)", "hele historikken (LassoTimeline)"],
      kraeverData: ["companies", "companyEvents"],
      live: "naar-data",
      veje: ["ask", "focus", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 3, longestLabel: 44 } },
    },
  },
  {
    type: "LassoRegistration",
    title: "Regnskabsoplysninger og kapital",
    description: `Brug til: registreringsdetaljer fra CVR – revision (revideret eller fravalgt), regnskabsår, nuværende og første regnskabsperiode, regnskabsklasse, bibrancher, registreret kapital og kapitalklasser, vedtægter, tegningsregel, formål, reklamebeskyttelse og børsnotering – 'er revisionen fravalgt', 'hvilken regnskabsklasse', 'hvad er kapitalen', 'hvad er formålet', 'bibrancher'. Brug ikke når: kun revisor, stiftelse, form eller branche (LassoKeyValueList variant 'company'), eller hele virksomhedsprofilen med regnskabsanalyse (LassoTextSections). Kræver: company, variant? ('full' standard = to kort; 'profile' = bibrancher og formål, en smal blok); felter uden værdi udelades, og alt ud over formål og tegningsregel er ubekræftet i live-data. Nås fra show_company: overblik (efter oplysningerne, når der er plads) og svar-element på spørgsmål om kapital, vedtægter, tegningsregel og regnskabsklasse. Eksempel: 'Har Lasso X fravalgt revision, og hvad er kapitalen?' → show_company med spørgsmålet.`,
    props: "company, variant? (full | profile), title?",
    register: {
      formaal: "Registreringsdetaljer fra CVR: revision, regnskabsår, kapital, vedtægter og tegningsregel.",
      bedstTil: ["er revisionen fravalgt", "hvilken regnskabsklasse", "hvad er kapitalen", "tegningsregel"],
      undgaaNaar: ["kun revisor, stiftelse, form eller branche (LassoKeyValueList variant 'company')", "hele profilen med regnskabsanalyse (LassoTextSections)"],
      kraeverData: ["companies", "ownership", "financials", "textSections"],
      live: "naar-data",
      veje: ["ask", "focus", "render_view"],
      bredde: { profil: "bred", drivere: { longestLabel: 45, series: 4 } },
    },
  },

  {
    type: "LassoAnnouncements",
    title: "Statstidende",
    description: `Brug til: seneste bekendtgørelser i Statstidende (konkursdekret, rekonstruktion, likvidation, indkaldelse af kreditorer) – 'står X i Statstidende', 'er der bekendtgjort konkurs'. Brug ikke når: det gælder CVR-status alene (LassoCompanyHead) eller Creditsafe (LassoCreditRating). Kræver: company; komponenten udelades helt, når der ingen bekendtgørelser er. Nås fra show_company: focus historik (når der er data og plads) og svar-element på spørgsmål om Statstidende og bekendtgørelser. Eksempel: 'Har X bekendtgørelser i Statstidende?' → show_company med spørgsmålet.`,
    props: "company, title?",
    register: {
      formaal: "Seneste bekendtgørelser i Statstidende (konkurs, rekonstruktion, likvidation).",
      bedstTil: ["står X i Statstidende", "er der bekendtgjort konkurs"],
      undgaaNaar: ["CVR-status alene (LassoCompanyHead)", "Creditsafe (LassoCreditRating)"],
      kraeverData: ["companies", "companyEvents"],
      live: "naar-data",
      veje: ["ask", "focus", "render_view"],
      bredde: { profil: "bred", drivere: { rowsPerItem: 3, longestLabel: 44 } },
    },
  },
  {
    type: "LassoRelationsTable",
    title: "Relationer over tid",
    description: `Brug til: portalens nuværende eller historiske relationer: adm. direktører, direktion, bestyrelse (formand, suppleanter), stiftere, legale ejere med ejerandel og stemmeret, og reelle ejere, hver med fra–til-dato – 'hvem har siddet i ledelsen', 'tidligere ejere', 'hvornår trådte X ind'. Brug ikke når: kun den nuværende ledelse som liste (LassoPersonList) eller kun ejerne (LassoOwnerList). Kræver: company, show? ('current' | 'former' | 'all'), groups?. Eksempel: {"type":"LassoRelationsTable","company":"12345678","show":"former"}.`,
    props: "company, show? (current | former | all), groups?, title?",
    register: {
      formaal: "Relationer grupperet efter rolle (ledelse, bestyrelse, stiftere, ejere) med fra–til-datoer.",
      bedstTil: ["tidligere direktører", "tidligere ejere", "hvem har siddet i bestyrelsen", "hvornår trådte X ind"],
      undgaaNaar: ["kun nuværende ledelse (LassoPersonList)", "kun ejerne (LassoOwnerList)"],
      kraeverData: ["companyHistories", "beneficialOwnership"],
      live: "naar-data",
      liveNote: "Historikken (GET /{lassoId}/history) er ubekræftet for virksomheder; uden den vises de nuværende roller og ejere.",
      veje: ["render_view"],
      bredde: { profil: "bred", drivere: { rowsPerItem: 2, longestLabel: 40 } },
    },
  },
  {
    type: "LassoCompanyHistory",
    title: "Stamdata historik",
    description: `Brug til: virksomhedens stamdata over tid – tidligere navne, adresser, ansatte pr. måned, branche, selskabskapital, telefon og e-mail med fra–til – 'hvad hed X før', 'hvor har X ligget', 'hvordan har antallet af ansatte udviklet sig i CVR'. Brug ikke når: kun de nuværende stamdata (LassoKeyValueList) eller regnskabets ansatte (LassoMultiYearTable). Kræver: company, fields?, limit? (standard 3). Eksempel: {"type":"LassoCompanyHistory","company":"12345678"}.`,
    props: "company, fields?, limit?, title?",
    register: {
      formaal: "Stamdata over tid: navne, adresser, ansatte, branche, kapital og kontakt med fra–til.",
      bedstTil: ["tidligere navne", "tidligere adresser", "ansatte over tid", "hvad hed X før"],
      undgaaNaar: ["kun nuværende stamdata (LassoKeyValueList)", "regnskabets tal (LassoMultiYearTable)"],
      kraeverData: ["companyHistories"],
      live: "naar-data",
      liveNote: "Historikken (GET /{lassoId}/history) er ubekræftet for virksomheder.",
      veje: ["render_view"],
      bredde: { profil: "bred", drivere: { rowsPerItem: 3, longestLabel: 60 } },
    },
  },
  {
    type: "LassoPublications",
    title: "Regnskabspublicering",
    description: `Brug til: listen over offentliggjorte regnskaber med dato, type (årsrapport, halvår, kvartal; ny eller korrigeret) og hovedtal – 'hvornår kom regnskabet', 'er regnskabet korrigeret'. Brug ikke når: tallene selv skal ses (LassoFinancialStatements/LassoMultiYearTable). Kræver: company, limit? (standard 5). Nås fra show_company: focus historik (når der er data og plads) og svar-element på spørgsmål om offentliggjorte regnskaber og dokumenter. Eksempel: 'Hvornår har X offentliggjort sine regnskaber?' → show_company med spørgsmålet.`,
    props: "company, limit?, title?",
    register: {
      formaal: "Liste over offentliggjorte regnskaber med dato, type og hovedtal.",
      bedstTil: ["hvornår kom regnskabet", "er regnskabet korrigeret"],
      undgaaNaar: ["tallene selv skal ses (LassoFinancialStatements/LassoMultiYearTable)"],
      kraeverData: ["companyEvents"],
      live: "naar-data",
      veje: ["ask", "focus", "render_view"],
      bredde: { profil: "fleksibel", drivere: { timeAxis: true, series: 4 } },
    },
  },

  // (b) Personer og ejere ------------------------------------------------------
  {
    type: "LassoPersonList",
    title: "Ledelse og bestyrelse",
    description: `Brug til: direktion og bestyrelse med rolle og tiltrådt/fratrådt; show 'all' ved 'udskiftning', 'tidligere direktør'; roles 'direktion' eller 'bestyrelse' viser kun den ene ('hvem er direktør'). Brug ikke når: det gælder ejere (LassoOwnerList/LassoBeneficialOwners), en smal kolonne med både personer og ejere (LassoRelations), eller én bestemt person (show_person). Kræver: company, show? (standard 'current'). ${F("ledelse")} Eksempel: 'Hvem sidder i bestyrelsen hos Novo Nordisk?' → show_company focus ledelse.`,
    props: "company, show? (current | all), roles? (direktion | bestyrelse), title?",
    register: {
      formaal: "Direktion og bestyrelse med rolle og tiltrådt/fratrådt.",
      bedstTil: ["direktion", "bestyrelse", "ledelse", "hvem er direktør", "hvem sidder i bestyrelsen", "tidligere direktør"],
      undgaaNaar: ["ejere (LassoOwnerList/LassoBeneficialOwners)", "smal kolonne med både personer og ejere (LassoRelations)", "én bestemt person (show_person)"],
      kraeverData: ["people"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 34 } },
    },
  },
  {
    type: "LassoOwnerList",
    title: "Legale ejere",
    description: `Brug til: 'hvem ejer X' – de legale (direkte) ejere med ejerandel som interval; standardvalget for ejerspørgsmål. Brug ikke når: 'reelle ejere', 'i sidste ende', 'personerne bag' (LassoBeneficialOwners), 'koncern', 'moderselskab', 'datterselskaber', 'ejerstruktur' (LassoOwnershipDiagram), eller 'hvem er revisor' (LassoKeyValueList variant 'company'). Kræver: company; ejerandele fra CVR vises som intervaller. ${F("ejerskab")} Eksempel: 'Hvem ejer Lasso X?' → show_company focus ejerskab.`,
    props: "company",
    register: {
      formaal: "De legale (direkte) ejere med ejerandel som interval.",
      bedstTil: ["ejere", "hvem ejer X"],
      undgaaNaar: ["reelle ejere, 'i sidste ende' (LassoBeneficialOwners)", "koncern, moderselskab, datterselskaber (LassoOwnershipDiagram)", "hvem er revisor (LassoKeyValueList variant 'company')"],
      kraeverData: ["ownership"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 45 } },
    },
  },
  {
    type: "LassoBeneficialOwners",
    title: "Reelle ejere",
    description: `Brug til: de fysiske personer, der i sidste ende ejer virksomheden, med samlet indirekte andel og ejerkæden gennem mellemliggende selskaber – kun ved 'reelle ejere', 'i sidste ende', 'personerne bag', 'gennem holdingselskaber'. Brug ikke når: direkte ejere (LassoOwnerList) eller koncernstruktur som diagram (LassoOwnershipDiagram). Kræver: company; ingen registrerede reelle ejere giver tom tilstand. ${F("ejerskab")} Eksempel: 'Hvem er de reelle ejere bag Lasso X?' → show_company focus ejerskab.`,
    props: "company",
    register: {
      formaal: "De fysiske personer, der i sidste ende ejer virksomheden, med ejerkæden.",
      bedstTil: ["reelle-ejere", "hvem er de reelle ejere", "personerne bag", "gennem holdingselskaber"],
      undgaaNaar: ["direkte ejere (LassoOwnerList)", "koncernstruktur som diagram (LassoOwnershipDiagram)"],
      kraeverData: ["beneficialOwnership"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 30 } },
    },
  },
  {
    type: "LassoOwnershipDiagram",
    title: "Ejerdiagram, koncern",
    description: `Brug til: koncernstruktur i flere lag som diagram: ejere over, datterselskaber under – 'koncernen bag', 'moderselskab', 'datterselskaber', 'ejerstruktur', 'hvordan hænger selskaberne sammen'. Brug ikke når: én liste af direkte ejere (LassoOwnerList) eller personerne i sidste ende (LassoBeneficialOwners). Kræver: company ELLER person (præcis én), ingoingDepth? (lag op, standard 2; 0 for en person), outgoingDepth? (lag ned, standard 1), onDate?. Med person er personen roden (pille), og pilene går til de selskaber, personen ejer, med ejerandel. ${F("ejerskab (vises, når der er selskabsejere)")} Personens ejerskaber dækkes af show_person (vises, når personen ejer selskaber). Eksempel: 'Hvilke datterselskaber har X, og hvem er moderselskabet?' → show_company focus ejerskab.`,
    props: "company | person, ingoingDepth? (lag op, standard 2), outgoingDepth? (lag ned, standard 1), onDate? (ÅÅÅÅ-MM-DD), title?",
    register: {
      formaal: "Koncernstruktur i flere lag som diagram: ejere over, datterselskaber under.",
      bedstTil: ["koncern", "ejerstruktur", "moderselskab", "datterselskaber", "hvordan hænger selskaberne sammen"],
      undgaaNaar: ["én liste af direkte ejere (LassoOwnerList)", "personerne i sidste ende (LassoBeneficialOwners)"],
      kraeverData: ["ownershipGraphs"],
      live: "naar-data",
      veje: ["focus", "person", "ask", "render_view"],
      bredde: { profil: "bred", drivere: { longestLabel: 45 } },
    },
  },
  {
    type: "LassoRelations",
    title: "Rolleliste, kompakt",
    description: `Brug til: direktion, bestyrelse (formand i parentes) og de tre største legale ejere i ÉT kompakt element til en smal kolonne (¼ ved siden af en ¾) i et bredt overblik. Erstatter LassoPersonList OG LassoOwnerList sammen. Brug ikke når: spørgsmålet gælder ledelsen (LassoPersonList) eller ejerne (LassoOwnerList), eller listen står i fuld bredde. Kræver: company. ${F("overblik")} Eksempel: smal kolonne i en render_view-spec, der i øvrigt handler om andet.`,
    props: "company, title?",
    register: {
      formaal: "Direktion, bestyrelse og de tre største ejere i ét kompakt element.",
      bedstTil: ["overblik i smal kolonne ved siden af en bred graf"],
      undgaaNaar: ["spørgsmålet gælder ledelsen (LassoPersonList) eller ejerne (LassoOwnerList)", "listen står i fuld bredde"],
      kraeverData: ["people", "ownership"],
      live: "naar-data",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 45 } },
    },
  },

  // (d) Flere virksomheder -----------------------------------------------------
  {
    type: "LassoCompareTable",
    title: "Sammenligning, navngivne virksomheder",
    description:
      "Brug til: 2–3 NAVNGIVNE virksomheder side om side på 1–5 nøgletal fra seneste år – 'sammenlign A og B', 'A vs. B på omsætning og ansatte'. Brug ikke når: ét nøgletal og rækkefølgen er pointen (LassoRanking), udvikling over år for to virksomheder (LassoLineChart), eller virksomhederne først skal findes med kriterier (search_companies/LassoCompanyTable). Kræver: companies[] (2–3), metrics? (standard 4). Nås via compare_companies / render_view. Eksempel: 'Sammenlign Lasso X, Risika og Bisnode på omsætning, resultat og ansatte.'",
    props: `companies[] (2–3), metrics? (1–5 af ${METRICS.join(" | ")}), title?`,
    register: {
      formaal: "2–3 navngivne virksomheder side om side på 1–5 nøgletal.",
      bedstTil: ["sammenlign A og B", "A vs. B på omsætning og ansatte"],
      undgaaNaar: ["ét nøgletal og rækkefølge (LassoRanking)", "mange fundet med kriterier (LassoCompanyTable)"],
      kraeverData: ["companies", "financials"],
      live: "naar-data",
      veje: ["compare_companies", "render_view"],
      bredde: { profil: "bred", drivere: { longestLabel: 45, series: 6 } },
    },
  },
  {
    type: "LassoRanking",
    title: "Rangliste, ét nøgletal",
    description:
      "Brug til: 2–10 navngivne virksomheder på ÉT nøgletal (seneste år) som vandrette søjler, den første fremhævet – 'hvor ligger X i forhold til …'; order 'asc' viser de laveste først ('hvem har lavest soliditet'). Brug ikke når: flere nøgletal pr. virksomhed (LassoCompareTable), udvikling over tid (LassoLineChart), eller listen skal findes med kriterier ('de største i branchen' → search_companies/LassoCompanyTable med sort). Kræver: companies[] (2–10, kendte på forhånd), metric. Nås via compare_companies / render_view. Eksempel: 'Hvor ligger Lasso X på ansatte i forhold til Bisnode, Experian og Risika?'",
    props: `companies[] (2–10, første fremhæves), metric (${METRICS.join(" | ")}), order? (desc | asc; asc når spørgsmålet er lavest/mindst), top? (3–10, standard 5), title?`,
    register: {
      formaal: "2–10 navngivne virksomheder rangeret på ét nøgletal.",
      bedstTil: ["hvem er størst", "rangér A, B og C på omsætning"],
      undgaaNaar: ["flere nøgletal (LassoCompareTable)", "mange fundet med kriterier (LassoCompanyTable)", "to virksomheder over tid (LassoLineChart)"],
      kraeverData: ["companies", "financials"],
      live: "naar-data",
      veje: ["compare_companies", "render_view"],
      bredde: { profil: "fleksibel", drivere: { longestLabel: 45, series: 6 } },
    },
  },
  {
    type: "LassoCompanyTable",
    title: "Virksomhedstabel, søgning",
    description:
      "Brug til: mange virksomheder fundet med kriterier – målgrupper, 'alle X i Y', 'top N efter Z' (sort) – som del af en render_view-spec med andet; står søgningen alene, så brug search_companies. Brugeren kan sortere, fjerne kriterier og klikke ind på en virksomhed. Brug ikke når: du kender 2–3 navngivne virksomheder til sammenligning (LassoCompareTable) eller 2–10 navngivne på ét nøgletal (LassoRanking). Kræver: source 'search', search { query, criteria[], sort?, limit? }, columns? ('score' er Lassos 0–100-score og findes kun i demodata; live står den som -, så vælg den ikke til kunder); ingen match giver tom tilstand med kriterierne synlige. Eksempel: 'Vis de 20 største revisionsfirmaer i Aarhus efter ansatte.' → search_companies.",
    props: `source='search', search { query, criteria[], sort?, limit? }, columns? (${TABLE_COLUMNS.join(" | ")}), title?`,
    register: {
      formaal: "Tabel over virksomheder fundet med kriterier, med detaljer ved klik.",
      bedstTil: ["målgrupper", "revisorer i Region Midt med mindst 10 ansatte", "find virksomheder der ..."],
      undgaaNaar: ["2–3 navngivne virksomheder (LassoCompareTable)", "én virksomhed (show_company)"],
      kraeverData: ["searches"],
      live: "naar-data",
      veje: ["search_companies", "render_view"],
      bredde: { profil: "bred", drivere: { longestLabel: 45, series: 8 } },
    },
  },
  {
    type: "LassoPersonTable",
    title: "Persontabel, navnesøgning",
    description:
      "Brug til: flere personer med samme eller lignende navn som tabel – 'find personer der hedder X', 'hvilke Mette Holm findes der', 'personer med navnet …' – med navnet alene i personcellen (ingen fødselsår eller by under, 15.3), aktive roller som tekst og antal konkurser, så brugeren kan vælge den rigtige og klikke ind. Brug ikke når: det er klart, hvilken person der menes (show_person), det gælder én virksomheds ledelse (LassoPersonList), eller der søges virksomheder (LassoCompanyTable/search_companies). Kræver: query (navn, mindst 2 tegn), limit? (standard 25); ingen match giver tom tilstand, og CPR eller fuld adresse vises aldrig. Dækkes ikke af show_person. Eksempel: 'Hvilke personer hedder Mette Holm?' → render_view med LassoPersonTable { query: 'Mette Holm' }.",
    props: "query (navn), limit? (1–50, standard 25), title?",
    register: {
      formaal: "Tabel over personer fundet ved navnesøgning.",
      bedstTil: ["find personer med navnet X", "hvem er personen X"],
      undgaaNaar: ["én kendt person (show_person)", "virksomheder (LassoCompanyTable)"],
      kraeverData: ["personSearches"],
      live: "naar-data",
      veje: ["search_persons", "render_view"],
      bredde: { profil: "bred", drivere: { series: 6 } },
    },
  },

  // (e) Risiko og revision -----------------------------------------------------
  {
    type: "LassoCreditRating",
    title: "Kreditvurdering, Creditsafe",
    description: `Brug til: kreditvurdering fra Creditsafe (kreditmaksimum, international score A–E, lokal score, PDF-rapport; kun den aktuelle vurdering, ingen historik) – 'kan vi give dem kredit', 'kreditvurdering', 'Creditsafe'. Brug ikke når: det gælder Lassos 0–100-score (LassoScoreGauge); skalaerne må ikke blandes. Kræver: company; uden Creditsafe-tilkøb viser den låst tilstand. Et opslag kan tage op til 45 sekunder, når Creditsafe beregner; Lasso gemmer vurderingen i 24 timer, så vis den højst én gang pr. svar og bed aldrig om en ny beregning (koster en kredit). ${F("risiko")} Eksempel: 'Hvad er kreditvurderingen for Lasso X?' → show_company focus risiko.`,
    props: "company, title?",
    register: {
      formaal: "Kreditvurdering fra Creditsafe: kreditmaksimum, international og lokal score, PDF-rapport.",
      bedstTil: ["kredit", "kreditvurdering", "kan vi give dem kredit", "Creditsafe"],
      undgaaNaar: ["Lassos 0–100-score (LassoScoreGauge); skalaerne må ikke blandes"],
      kraeverData: ["creditRatings"],
      live: "abonnement",
      liveNote: "Kræver Creditsafe-abonnement",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal" },
    },
  },
  {
    type: "LassoRiskObservations",
    title: "Risikoobservationer",
    description: `Brug til: Lassos risikoobservationer for én virksomhed som liste – sammenfatning øverst som filtre (høj, middel, info) og observationerne sorteret efter alvor – når brugeren beder om 'risikoobservationer', 'røde flag i detaljer' eller 'alle observationer'. Brug ikke når: spørgsmålet er bredt om risiko eller kredit (show_company focus risiko), eller det gælder Creditsafe (LassoCreditRating). Kræver: company; opslaget tager 10–14 sekunder. Tom liste er positiv information ('intet at bemærke, tjekket DATO'). Nås fra show_company: focus risiko (efter kreditvurderingen, når der er plads) og som svar-element nr. 1 på spørgsmål om røde flag og observationer. Eksempel: 'Er der røde flag hos Lasso X?' → show_company med spørgsmålet.`,
    props: "company, title?, compact?",
    register: {
      formaal: "Lassos risikoobservationer som liste sorteret efter alvor, med filtre.",
      bedstTil: ["risikoobservationer", "røde flag i detaljer", "alle observationer"],
      undgaaNaar: ["bredt risikospørgsmål (show_company focus risiko)", "Creditsafe (LassoCreditRating)"],
      kraeverData: ["observations"],
      live: "naar-data",
      veje: ["ask", "focus", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 2 } },
    },
  },
  {
    type: "LassoScoreGauge",
    title: "Scoremåler (kun demo)",
    description:
      "Brug til: KUN demovisninger. Der er ingen live datakilde for Lassos 0-100 risikoscore endnu; for rigtige virksomheder viser måleren 'Ikke oplyst'. Vælg den aldrig til en kunde, der spørger om risiko, score eller kreditvurdering (show_company focus risiko). Skalaen er Lassos risikoscore 0-100, hvor 100 = HØJ risiko (0-60 lav/grøn, 60-80 moderat/gul, 80-100 høj/rød); kun den aktuelle score, ingen historik, ikke Creditsafe (brug LassoCreditRating til Creditsafe). Kræver: company, title? (standard 'Risikoscore'), detail? (true giver den fulde form med 60/80-mærker), width? ('quarter' standard = kort med tal, måler, 'Beregnet' og 'Se observationer' (18.1); 'half' tilføjer 'Hvad trækker scoren' med op til 4 faktorer, men kun når scoremodellen leverer dem - ellers vises ¼-formen). Eksempel: intet kundespørgsmål fører hertil.",
    props: "company, title?, detail?",
    register: {
      formaal: "Lassos risikoscore 0–100 som måler (kun demo indtil videre).",
      bedstTil: ["score", "risikoscore"],
      undgaaNaar: ["kundespørgsmål om risiko eller kredit (show_company focus risiko)", "Creditsafe (LassoCreditRating)"],
      kraeverData: ["scores"],
      live: "abonnement",
      liveNote: "Kræver Creditsafe-abonnement. Score og kreditvurdering vises, når Creditsafe er tilføjet Lasso-abonnementet.",
      veje: ["ask", "render_view"],
      bredde: { profil: "smal" },
    },
  },

  // (f) Fysiske enheder --------------------------------------------------------
  {
    type: "LassoProductionUnits",
    title: "Produktionsenheder, P-numre",
    description:
      "Brug til: P-numre – filialer, afdelinger, butikker og adresser ud over hovedadressen, med ansatte og status pr. enhed – 'afdelinger', 'filialer', 'P-nummer'. Brug ikke når: kun hovedadressen (LassoCompanyHead), ejendomme/bygninger (LassoProperties), eller datterselskaber med egne CVR-numre (LassoOwnershipDiagram). Kræver: company; kilden er CVR-svaret, og listen kan være tom for virksomheder med kun hovedenheden. Viser telefon og e-mail pr. P-enhed, når CVR har dem (ellers udeladt), så den også svarer på 'telefonnummer til afdelingen i Aarhus'. Nås via spørgsmål i show_company/show_person / render_view. Eksempel: 'Hvor mange afdelinger har X, og hvor ligger de?'",
    props: "company",
    register: {
      formaal: "Produktionsenheder (P-numre) med adresse og branche.",
      bedstTil: ["enheder", "hvor har X afdelinger", "produktionsenheder"],
      undgaaNaar: ["kun hovedadressen (LassoContact)", "placering på kort (LassoMap)"],
      kraeverData: ["productionUnits"],
      live: "naar-data",
      veje: ["ask", "render_view"],
      bredde: { profil: "bred", drivere: { longestLabel: 54, series: 5 } },
    },
  },
  {
    type: "LassoProperties",
    title: "Ejendomme, BBR",
    description:
      "Brug til: ejendomme, virksomheden ejer (ejerfortegnelsen), med BBR-bygninger (anvendelse, opført, etager, areal) og arealfordeling – 'ejendomme', 'bygninger', 'BBR', 'matrikel'. Brug ikke når: adresser for afdelinger (LassoProductionUnits) eller virksomhedens egen adresse (LassoCompanyHead). Kræver: company; ejer virksomheden ingen ejendomme, vises tom tilstand. Nås via spørgsmål i show_company/show_person / render_view. Eksempel: 'Hvilke ejendomme ejer X, og hvor store er bygningerne?'",
    props: "company, title?",
    register: {
      formaal: "Ejendomme (BBR) knyttet til virksomheden.",
      bedstTil: ["ejendomme", "hvilke ejendomme ejer X"],
      undgaaNaar: ["produktionsenheder (LassoProductionUnits)", "adresse (LassoContact)"],
      kraeverData: ["properties"],
      live: "naar-data",
      veje: ["ask", "render_view"],
      bredde: { profil: "fleksibel", drivere: { rowsPerItem: 2 } },
    },
  },
  {
    type: "LassoMap",
    title: "Kort, adresser og P-enheder",
    description:
      "Brug til: virksomhedens hovedadresse og P-enheder på et kort, med klynger hvor mange ligger tæt – 'hvor ligger afdelingerne', 'vis på kort'. Brug ikke når: adresserne som liste med ansatte og status (LassoProductionUnits), ejendomme og bygninger (LassoProperties) eller kun hovedadressen som tekst (LassoCompanyHead). Kræver: company; koordinater er ikke bekræftet i Lassos data, så kortet kan være tomt med en forklaring. Nås fra show_company: focus kontakt og overblik (når kortet har punkter og der er plads) og svar-element på spørgsmål om placering ('hvor ligger afdelingerne', 'på et kort'). Eksempel: 'Vis X's afdelinger på et kort.' → show_company med spørgsmålet.",
    props: "company, title?",
    register: {
      formaal: "Kort med virksomhedens adresse og enheder.",
      bedstTil: ["hvor ligger X", "placering af enheder"],
      undgaaNaar: ["kun adressen som tekst (LassoContact)", "liste over enheder (LassoProductionUnits)"],
      kraeverData: ["maps"],
      live: "naar-data",
      veje: ["ask", "focus", "render_view"],
      bredde: { profil: "fleksibel" },
    },
  },
  {
    type: "LassoLivestock",
    title: "CHR, husdyr (ingen live data)",
    description:
      "Brug til: CHR-besætninger pr. dyretype og veterinære hændelser – kun landbrug. Ingen live datakilde endnu: for rigtige virksomheder er komponenten altid tom. Vælg den kun, når kunden udtrykkeligt spørger til CHR/husdyr, og sig, at data ikke er tilsluttet. Brug ikke når: det gælder ansatte eller økonomi i et landbrug (LassoKeyFigureCards). Kræver: company. Eksempel: 'Hvor mange svin har landbruget X?' (tom tilstand live).",
    props: "company",
    register: {
      formaal: "Dyrehold (CHR) med besætninger og hændelser.",
      bedstTil: ["besaetning", "hvor mange dyr har X"],
      undgaaNaar: ["ejendomme (LassoProperties)"],
      kraeverData: ["livestock"],
      live: "modul",
      liveNote: "Kræver Ejendomme-modulet i Lasso-abonnementet",
      veje: ["ask", "render_view"],
      bredde: { profil: "smal", drivere: { series: 3 } },
    },
  },

  // (16) Personside ----------------------------------------------------------------
  {
    type: "LassoPersonHead",
    title: "Personhoved",
    description:
      "Brug til: identitet for én person øverst på en personside: KUN navnet og handlingerne (ingen 'Person', by, fødselsår, rolletælling eller observationslinje under navnet). Brug ikke når: det gælder en virksomheds ledelse (LassoPersonList). Kræver: person (Lasso-ID 'CVR-3-…'). Dækkes af show_person, som bygger hele personsiden; brug den. Eksempel: 'Hvem er Mette Holm?' → show_person.",
    props: "person, variant?",
    register: {
      formaal: "Personens navn og handlinger øverst på en personvisning.",
      bedstTil: ["identitet", "overskrift på enhver personvisning"],
      undgaaNaar: ["en virksomhed (LassoCompanyHead)"],
      kraeverData: ["persons"],
      live: "altid",
      veje: ["person", "render_view"],
      bredde: { profil: "fleksibel", drivere: { longestLabel: 45 } },
    },
  },
  {
    type: "LassoPersonRoles",
    title: "Roller over tid",
    description:
      "Brug til: en persons roller i selskaber som tidsbånd fra–til, aktive først (show 'all'), eller som kort liste pr. selskab: de aktive roller (show 'current'), de ophørte, senest ophørte først (show 'ended'), eller de selskaber, personen ejer nu, med andel og siden-dato (show 'owner') – 'hvor sidder X i bestyrelsen', 'hvilke selskaber er X direktør i', 'hvad ejer X'. role 'bestyrelse', 'direktion' eller 'ejer' viser kun de poster. Brug ikke når: det gælder ét selskabs ledelse (LassoPersonList) eller personens medspillere (LassoPersonNetwork). Kræver: person. Dækkes af show_person (focus roller og ejerskab). Eksempel: 'Hvilke bestyrelser sidder X i?' → show_person focus roller.",
    props: "person, show? ('all' | 'current' | 'ended' | 'owner'), role? ('bestyrelse' | 'direktion' | 'ejer'), limit?, title?",
    register: {
      formaal: "Personens roller i virksomheder over tid.",
      bedstTil: ["roller", "hvor sidder X i bestyrelser"],
      undgaaNaar: ["hvem X sidder sammen med (LassoPersonNetwork)", "konkurser (LassoPersonRisk)"],
      kraeverData: ["persons"],
      live: "naar-data",
      veje: ["person", "ask", "render_view"],
      bredde: {
        profil: "fleksibel",
        drivere: { rowsPerItem: 2, longestLabel: 45, timeAxis: true },
        varianter: {
          "show:current": { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 45 } },
          "show:ended": { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 45 } },
          "show:owner": { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 45 } },
        },
      },
    },
  },
  {
    type: "LassoPersonNetwork",
    title: "Personnetværk",
    description:
      "Brug til: hvem personen sidder sammen med i selskaber, sorteret efter år sammen (den længste sammenhængende periode i fælles selskaber, ikke summen) –'hvem arbejder X sammen med', 'X's netværk'. Tegnes som tidsbånd i samme sprog som LassoPersonRoles (16.3): ét bånd pr. fælles selskab for perioden, de sad sammen, med 'Selskab, rolle, periode' over båndet; afsluttede stiplede og dæmpede; er det fælles selskab under konkurs (eller anden problemstatus), er båndet rødt (fyldt ved løbende rolle, stiplet ved afsluttet) og etiketten slutter med ', under konkurs' i rødt (ingen markør); legende Sidder sammen nu / Afsluttet / Under konkurs; på mobil ét kort pr. person. Standardbredde ⅔ (width 'two-thirds'); 'full', når netværket er svaret; ½ kun med den korte etiket 'Selskab, rolle' (vælges automatisk under ⅔). Brug ikke når: det gælder personens egne roller (LassoPersonRoles) eller konkurser (LassoPersonRisk). Kræver: person. Dækkes af show_person (focus netvaerk). Eksempel: 'Hvem er X i bestyrelse med?' → show_person focus netvaerk.",
    props: "person, limit? (standard 3), title?",
    register: {
      formaal: "Personens netværk: de personer X sidder sammen med, og selskaberne.",
      bedstTil: ["netvaerk", "hvem sidder X sammen med"],
      undgaaNaar: ["personens egne roller (LassoPersonRoles)"],
      kraeverData: ["personNetworks"],
      live: "naar-data",
      veje: ["person", "ask", "render_view"],
      bredde: { profil: "bred", drivere: { rowsPerItem: 3, longestLabel: 45, timeAxis: true } },
    },
  },
  {
    type: "LassoPersonRisk",
    title: "Personrisiko",
    description:
      "UDGÅET (Jakob 30.09): vælg den aldrig; show_person viser den ikke længere. Konkurser står i LassoPersonStats og forløbet i LassoTimeline (filter 'risiko'). Tidligere: konkurser og tvangsopløsninger blandt selskaber, personen har eller har haft roller i. Brug ikke når: det gælder en virksomheds risiko (show_company focus risiko). Kræver: person; ingen roller giver tom tilstand. Dækkes af show_person (focus risiko). Eksempel: 'Har X været med i konkurser?' → show_person focus risiko.",
    props: "person, title?",
    register: {
      formaal: "Personens tilknytning til konkurser og tvangsopløsninger.",
      bedstTil: ["konkurs", "har X været i konkurser"],
      undgaaNaar: ["virksomhedens egen risiko (LassoRiskObservations)"],
      kraeverData: ["persons"],
      live: "naar-data",
      veje: ["person", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 45 } },
    },
  },
  {
    type: "LassoPersonStats",
    title: "Netværkstal, person",
    description:
      "Brug til: tre små tal-kort om en person – personer i 1. led (netværk), konkurser og tvangsopløsninger blandt personens selskaber – som hurtigt overblik under rollerne. Brug ikke når: brugeren vil se hvem (LassoPersonNetwork) eller hvilke selskaber (LassoPersonRisk). Kræver: person. Eksempel: 'Hvor stort er X's netværk, og har X været i konkurser?' → show_person, eller render_view med LassoPersonHead og LassoPersonStats.",
    props: "person",
    register: {
      formaal: "Personens nøgletal (antal roller, selskaber, netværk) som kort.",
      bedstTil: ["overblik over person", "hvor mange roller har X"],
      undgaaNaar: ["enkelte fakta (LassoPersonFacts)"],
      kraeverData: ["persons", "personNetworks"],
      live: "naar-data",
      veje: ["render_view"],
      bredde: { profil: "fleksibel", drivere: { longestLabel: 45 } },
    },
  },
  {
    type: "LassoPersonFacts",
    title: "Stamoplysninger, person",
    description:
      "UDGÅET (Jakob 30.09): vælg den aldrig; show_person viser den ikke længere (byen står i personhovedet). Tidligere: en persons stamoplysninger som nøgle-værdi i en smal kolonne (¼): bopæl (postnummer og by; aldrig gade), kommune, 'Adressebeskyttet', enhedsnummer, aktive og ophørte roller, antal selskaber personen ejer, første registrering og seneste ændring – 'hvor bor X', 'hvornår kom X ind i CVR'. Brug ikke når: det gælder en virksomheds stamdata (LassoKeyValueList) eller personens roller over tid (LassoPersonRoles). Kræver: person. Dækkes af show_person. Eksempel: 'Hvor bor X, og hvor længe har X været registreret?' → show_person.",
    props: "person, title?",
    register: {
      formaal: "Personens fakta som nøgle/værdi (fødselsår, bopæl, roller).",
      bedstTil: ["bopael", "hvor bor X", "hvem er X"],
      undgaaNaar: ["roller over tid (LassoPersonRoles)"],
      kraeverData: ["persons"],
      live: "naar-data",
      veje: ["person", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { longestLabel: 45 } },
    },
  },

  // (21) Overvågning ---------------------------------------------------------------
  {
    type: "LassoChangeFeed",
    title: "Ændringsfeed, overvågede virksomheder",
    description:
      "Brug til: hvad der er sket i de virksomheder, brugeren overvåger – ændringer på tværs af en overvågningsliste grupperet pr. dag med filter på type (regnskab, ledelse, ejerskab, status, stamdata; Kredit-typen udgår) – 'hvad er der sket i mine kunder', 'ændringer i min overvågning', 'nyt i listen Kunder'. Med company: de seneste ændringer i ÉN virksomhed (standard 30 dage) – 'hvad er ændret i X de sidste 30 dage', 'seneste ændringer i X'; show_company focus historik viser den selv, når der er ændringer og plads. Brug ikke når: det gælder én virksomheds hele historik over år (LassoTimeline) eller nyheder i medierne (LassoNews). Kræver: list? (listens navn, fx 'Kunder') ELLER company?, days? (1–90; standard 7 for en liste, 30 for én virksomhed), types? (delmængde af ændringstyper); ingen ændringer i perioden giver tom tilstand, og uden overvågningsliste forklarer komponenten hvorfor. Eksempel: 'Hvad er der sket i mine overvågede kunder den seneste uge?' → render_view med LassoChangeFeed { list: 'Kunder', days: 7 }. / 'Hvad er ændret i X de sidste 30 dage?' → show_company med spørgsmålet.",
    props: `list? ELLER company?, days? (1–90, standard 7 for en liste og 30 for én virksomhed), types? (delmængde af ${CHANGE_TYPES.join(" | ")}), title?`,
    register: {
      formaal: "Ændringer i overvågede virksomheder de seneste dage.",
      bedstTil: ["hvad er ændret i mine kunder", "ændringer i overvågningslisten"],
      undgaaNaar: ["ændringer for én virksomhed (LassoTimeline)", "overblik pr. måned (LassoHeatmap)"],
      kraeverData: ["changeFeeds"],
      live: "naar-data",
      liveNote: "Der overvåges ingen virksomheder endnu.",
      veje: ["focus", "ask", "render_view"],
      bredde: { profil: "smal", drivere: { rowsPerItem: 2, longestLabel: 45 } },
    },
  },

  {
    type: "LassoHeatmap",
    title: "Heatmap, aktivitet pr. måned",
    description:
      "Brug til: hvor meget der er sket i de overvågede virksomheder måned for måned, pr. ændringstype (regnskab, ledelse, ejerskab, status, stamdata; Kredit-typen udgår) – 'hvornår sker der mest i mine kunder', 'aktivitet det seneste år'. Brug ikke når: de enkelte ændringer (LassoChangeFeed) eller én virksomheds historik (LassoTimeline). Kræver: list? (listens navn), months? (3–24, standard 12), types?; ingen ændringer giver tom tilstand, og uden overvågningsliste forklarer komponenten hvorfor. Samme ubekræftede live-kilde som LassoChangeFeed. Nås via render_view. Eksempel: 'Hvornår har der været mest aktivitet i listen Kunder det seneste år?' → render_view med LassoHeatmap { list: 'Kunder', months: 12 }.",
    props: `list?, months? (3–24, standard 12), types? (delmængde af ${CHANGE_TYPES.join(" | ")}), title?`,
    register: {
      formaal: "Ændringer pr. måned og type i en overvågningsliste som heatmap.",
      bedstTil: ["hvornår sker der mest", "aktivitet over tid i overvågningen"],
      undgaaNaar: ["enkelte ændringer (LassoChangeFeed)"],
      kraeverData: ["activityHeatmaps"],
      live: "naar-data",
      liveNote: "Der overvåges ingen virksomheder endnu.",
      veje: ["render_view"],
      bredde: { profil: "fleksibel", drivere: { timeAxis: true, series: 12 } },
    },
  },

  // Gem-laget (docs/gem-lag.md) ------------------------------------------------
  {
    type: "LassoSavedPages",
    title: "Gemte sider",
    description:
      "Brug til: brugerens egne gemte virksomheds- og personsider – 'mine gemte', 'hvad har jeg gemt', 'min liste'. Vises normalt af list_saved_pages; i render_view kun sammen med andre elementer. Brug ikke når: brugeren vil gemme eller fjerne en side (save_page / remove_saved_page) eller have et delbart link til en visning (save_view). Kræver: kind? (company | person | all, standard all), limit? (1–100, standard 20); ingen gemte sider giver tom tilstand med forklaring. Eksempel: 'Vis mine gemte virksomheder' → list_saved_pages { kind: 'company' }.",
    props: "kind? (company | person | all), limit? (1–100, standard 20), title?",
    register: {
      formaal: "Brugerens gemte virksomheds- og personsider.",
      bedstTil: ["mine gemte", "hvad har jeg gemt"],
      undgaaNaar: ["en enkelt virksomhed (show_company)"],
      kraeverData: ["savedPages"],
      live: "naar-data",
      liveNote: "Der er ingen gemte sider endnu.",
      veje: ["saved", "render_view"],
      bredde: { profil: "fleksibel", drivere: { longestLabel: 45, series: 5 } },
    },
  },

  // Interaktion ----------------------------------------------------------------
  {
    type: "LassoFollowUps",
    title: "Opfølgningsknapper",
    description:
      "Brug til: 1–4 knapper nederst i en render_view-visning, som sender et opfølgende spørgsmål til dig som brugerens næste besked, når der er oplagte næste analyser. Brug ikke når: spørgsmålet var snævert og besvaret med ét element, eller visningen kommer fra show_company (kan ikke tilføjes der). Kræver: prompts[] { label, prompt }; henter ingen data. Eksempel: efter en sammenligning: 'Vis udviklingen over 10 år', 'Tilføj Experian'.",
    props: "prompts[] { label, prompt }",
    register: {
      formaal: "Opfølgende spørgsmål som klikbare forslag under et svar.",
      bedstTil: ["næste skridt efter et svar"],
      undgaaNaar: ["selve svaret skal vises (brug elementet med dataene)"],
      kraeverData: [],
      live: "altid",
      veje: ["person", "render_view"],
      bredde: { profil: "fleksibel" },
    },
  },
];

const REGISTER_BY_TYPE: ReadonlyMap<ComponentType, Register> = new Map(COMPONENT_CATALOG.flatMap((e) => (e.register ? [[e.type, e.register] as const] : [])));

/**
 * Katalogposter med props (Brug til / Brug ikke når / Kræver / Eksempel) til describe_components og
 * render_view's fejlsvar. Gitterreglerne står ikke her: uden width pakker Lasso selv bredderne efter
 * GRID_RULES og indholdet (Ø13), så modellen behøver dem ikke (token-reduktion, plan Ø8).
 */
export function catalogAsText(types?: readonly ComponentType[]): string {
  const want = types ? new Set(types) : undefined;
  return COMPONENT_CATALOG.filter((c) => !want || want.has(c.type))
    .map((c) => `- ${c.type} (${c.title}): ${c.description} Props: ${c.props}.`)
    .join("\n");
}

/** Kort indeks til render_view's beskrivelse: type, titel og formål; props hentes med describe_components. */
export function catalogIndexText(): string {
  return COMPONENT_CATALOG.map((c) => `- ${c.type} (${c.title})${c.register?.formaal ? `: ${c.register.formaal}` : ""}`).join("\n");
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
