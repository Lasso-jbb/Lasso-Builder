/**
 * Designguidens opbygning. Indholdet kommer fra koden (katalog, galleri, tokens); her står kun,
 * hvordan det ordnes og navngives. Nye moduler og galleritavler, der ikke står her, dukker op
 * under "Øvrige", så guiden aldrig mister noget, koden har.
 */
import { COMPONENT_CATALOG, GRID_RULES, WIDTHS, type ComponentType, type Width } from "@lasso/spec";

/* ---------- Bredder ---------- */

export const WIDTH_LABEL: Record<Width, string> = { quarter: "¼", third: "⅓", half: "½", "two-thirds": "⅔", "three-quarters": "¾", full: "Fuld" };
export const WIDTH_NAME: Record<Width, string> = { quarter: "En fjerdedel", third: "En tredjedel", half: "Halv", "two-thirds": "To tredjedele", "three-quarters": "Tre fjerdedele", full: "Fuld bredde" };
/** Cellens indholdsbredde på 1200-gitteret (12 kolonner, gutter 24, 24 px sideluft), som galleriet måler. */
export const WIDTH_PX: Record<Width, number> = { quarter: 270, third: 368, half: 564, "two-thirds": 760, "three-quarters": 858, full: 1152 };

/** Skærmene, et modul prøves på. Desktop prøver hver tilladt bredde; de andre folder standardbredden. */
export interface Viewport {
  id: "desktop" | "portal" | "chat" | "tablet" | "mobil";
  label: string;
  vw: number;
  note: string;
}
export const VIEWPORTS: Viewport[] = [
  { id: "portal", label: "Portal", vw: 1440, note: "Lasso-portalen på en bred skærm" },
  { id: "desktop", label: "Desktop", vw: 1200, note: "Referencegitteret (12 kolonner à 74 px, gutter 24)" },
  { id: "chat", label: "Chat", vw: 760, note: "MCP-visningen i Claude og ChatGPT (640–900 px)" },
  { id: "tablet", label: "Tablet", vw: 834, note: "Under 1200: ¼, ⅓ og ½ bliver ½, ⅔ og ¾ bliver fuld" },
  { id: "mobil", label: "Mobil", vw: 390, note: "Én kolonne, 16 px sideluft" },
];

/**
 * Skærmene i "Fra største til mindste": enhederne med deres skærmbredde og den bredde, et modul i fuld
 * bredde får i portalen dér (portalModuleWidth). Formen følger modulets bredde, ikke skærmen.
 */
export interface Device {
  id: string;
  label: string;
  vw: number;
}
export const DEVICES: Device[] = [
  { id: "stor", label: "Stor skærm", vw: 1440 },
  { id: "laptop", label: "Laptop", vw: 1280 },
  { id: "tablet-h", label: "Tablet, vandret", vw: 1024 },
  { id: "tablet-v", label: "Tablet, lodret", vw: 768 },
  { id: "mobil-stor", label: "Mobil, stor", vw: 430 },
  { id: "mobil", label: "Mobil", vw: 390 },
  { id: "mobil-lille", label: "Mobil, lille", vw: 360 },
  { id: "mobil-mindst", label: "Mindste mobil", vw: 320 },
];

/**
 * Bredden af et modul i fuld bredde i portalen ved skærmbredden `vw` (målt 03.10, portal2.css og LassoView):
 * over 760 px står skinnen og sidemargenen (108 px) ved siden af midten, der højst er 1152 px; derunder er
 * midten hele skærmen. Modulet har 24 px sideluft i midten over 560 px og 16 px derunder.
 */
export function portalModuleWidth(vw: number): number {
  const content = vw > 760 ? Math.min(1152, vw - 108) : vw;
  return content - (content > 560 ? 48 : 32);
}

/** Skærmbredden, en designguide-ramme skal have, for at et modul i fuld bredde bliver `width` px (sideluft 24/16). */
export function frameWidthFor(width: number): number {
  return width + 48 > 560 ? width + 48 : width + 32;
}

/** Bredderne mellem typens min og maks (GRID_RULES), dvs. de bredder, modulet må stå i. */
export function allowedWidths(type: ComponentType): Width[] {
  const r = GRID_RULES[type];
  if (!r) return ["full"];
  const lo = WIDTHS.indexOf(r.min);
  const hi = WIDTHS.indexOf(r.max);
  return WIDTHS.filter((_, i) => i >= lo && i <= hi);
}

/* ---------- Moduler ---------- */

export const MODULE_GROUPS: { id: string; label: string; intro: string; types: ComponentType[] }[] = [
  {
    id: "identitet",
    label: "Identitet og overblik",
    intro: "Hvem er det, hvad laver de, og hvordan kommer man i kontakt. Hovedet står øverst på hver side, opfølgningsknapperne nederst.",
    types: ["LassoCompanyHead", "LassoPersonHead", "LassoKeyValueList", "LassoContact", "LassoContactPersons", "LassoShortcuts", "LassoTextSections", "LassoSummary", "LassoFollowUps"],
  },
  {
    id: "oekonomi",
    label: "Økonomi og regnskab",
    intro: "Nøgletal, grafer og det fulde regnskab. Én graf pr. visning.",
    types: ["LassoKeyFigureCards", "LassoBarChart", "LassoGroupedBarChart", "LassoLineChart", "LassoStackedBarChart", "LassoShareBars", "LassoWaterfallChart", "LassoKeyFigureGauge", "LassoMultiYearTable", "LassoIncomeStatement", "LassoBalanceSheet", "LassoCashFlow", "LassoFinancialStatements"],
  },
  {
    id: "personer",
    label: "Personer og ejerskab",
    intro: "Ledelse, ejere, relationer og personers roller og netværk.",
    types: ["LassoPersonList", "LassoOwnerList", "LassoBeneficialOwners", "LassoOwnershipDiagram", "LassoRelations", "LassoRelationsTable", "LassoPersonRoles", "LassoPersonNetwork", "LassoPersonStats", "LassoPersonFacts", "LassoPersonRisk"],
  },
  {
    id: "risiko",
    label: "Risiko og kredit",
    intro: "Score, kreditvurdering og risikoobservationer. Farve bærer aldrig betydningen alene.",
    // Jakob 01.10: scorehistorik og revisoruafhængighed er slettet.
    types: ["LassoScoreGauge", "LassoCreditRating", "LassoRiskObservations"],
  },
  {
    id: "historik",
    label: "Historik og nyheder",
    intro: "Hvad er der sket og registreret: CVR-ændringer, stamdata over tid, registrering, nyheder, Statstidende og fusioner.",
    types: ["LassoTimeline", "LassoNews", "LassoCompanyHistory", "LassoRegistration", "LassoAnnouncements", "LassoPublications", "LassoMergers", "LassoChangeFeed"],
  },
  {
    id: "enheder",
    label: "Enheder og ejendomme",
    intro: "Produktionsenheder, ejendomme, kort og husdyr.",
    types: ["LassoProductionUnits", "LassoProperties", "LassoMap", "LassoLivestock"],
  },
  {
    id: "lister",
    label: "Lister og sammenligning",
    intro: "Flere virksomheder eller personer: tabeller, rangering og sammenligning.",
    types: ["LassoCompanyTable", "LassoPersonTable", "LassoCompareTable", "LassoRanking", "LassoHeatmap", "LassoSavedPages"],
  },
];

export const CATALOG_NUMBER: ReadonlyMap<ComponentType, number> = new Map(COMPONENT_CATALOG.map((c, i) => [c.type, i + 1]));

/** Grupperne med alle katalogets typer; typer uden gruppe står under "Øvrige". */
export function moduleGroups() {
  const known = new Set(MODULE_GROUPS.flatMap((g) => g.types));
  const catalogTypes = new Set(COMPONENT_CATALOG.map((c) => c.type));
  const groups = MODULE_GROUPS.map((g) => ({ ...g, types: g.types.filter((t) => catalogTypes.has(t)) }));
  const rest = COMPONENT_CATALOG.map((c) => c.type).filter((t) => !known.has(t));
  if (rest.length) groups.push({ id: "oevrige", label: "Øvrige", intro: "Moduler, der ikke er placeret i en gruppe endnu.", types: rest });
  return groups;
}

export const slugOf = (type: string) => type.replace(/^Lasso/, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

/* ---------- Galleriets tavler (katalognumre) ---------- */

export const BOARD_TITLES: Record<string, string> = {
  "01": "Fundament",
  "01b": "Logo",
  "02a": "Felter: kriterier",
  "02b": "Felter: sammensatte",
  "02c": "Felter med data",
  "03": "Filterfelter",
  "04": "Sidehoved",
  "05": "Knapper og kontroller",
  "06": "Navigation og sideskabelon (klassisk portal og Lasso-siden)",
  "07": "Dialoger, menuer og beskeder",
  "08": "Virksomhedshoved og kontakt",
  "09": "Nøgletal og nøgle-værdi",
  "10": "Score, tabeller og tilstande",
  "11": "Personer og ejere",
  "12": "Tekst og tid",
  "13": "Datavisualisering",
  "14": "Ejerdiagram",
  "14b": "Ejerdiagram, særlige tilstande",
  "15": "Tabeller",
  "16": "Personside",
  "17": "Risikoobservationer",
  "18": "Risikoscore",
  "19": "Regnskab",
  "20": "Enheder og ejendomme",
  "21": "Overvågning og notifikationer",
  "22": "Sammenligning",
  "23": "Fra data til layout",
  "24": "Eksempel: virksomhedsoverblik",
  "25": "Eksempel: personside",
  "26": "Responsivt design",
  "26f": "Tablet",
  "27": "Rapporter og PDF",
  "28": "Datatyper",
  "29": "Faner",
  "30": "Fra spørgsmål til skærm",
};

/** Tavlerne i navigationens tre galleriafsnit. */
export const GALLERY_SECTIONS: { id: string; label: string; boards: RegExp }[] = [
  { id: "elementer", label: "Elementer", boards: /^(02a|02b|02c|03|04|05|06|07|29)$/ },
  { id: "datavisning", label: "Datavisning", boards: /^(08|09|10|11|12|13|14|14b|15|16|17|18|19|20|21|22|28)$/ },
  { id: "moenstre", label: "Mønstre og sider", boards: /^(23|24|25|26|26f|27|30)$/ },
];

export const boardOf = (nr: string) => nr.split(".")[0]!;

/* ---------- Fundament ---------- */

/** Fundamentets sider: galleriets tavle 01/01b og de tokens, der hører til (valgt efter navn i styles.css). */
export const FOUNDATION: { id: string; label: string; entries: RegExp; tokens: RegExp; intro: string }[] = [
  { id: "farver", label: "Farver", entries: /^01\.(1|7)$/, tokens: /^(accent|on-accent|bg$|surface|chrome|overlay|scrim|tag$|tag-hover|border|divider|text|muted|faint|placeholder|icon$|disabled|skeleton|tooltip|danger|bankrupt|status-|info-|positive|negative|warning|gauge-|chart-|map-)/, intro: "Koral er den eneste accentfarve. Hvid flade overalt; semantiske farver bruges kun til status og risiko, altid med ikon eller ord. Datavisningens faste regler (01.7) står her, fordi de fleste handler om farvebrug: status i tekstfarve, én grå til hjælpetekst, ingen ink- eller farvede flader." },
  { id: "typografi", label: "Typografi", entries: /^01\.2$/, tokens: /^(font|fs|lh|fw|ls|tracking)(-|$)/, intro: "Poppins i fire vægte. Display 700, overskrifter og feltnavne 600, værdier, status og knaptekst 500, brødtekst 400." },
  { id: "afstand", label: "Afstand og gitter", entries: /^01\.3$|^23\.1$/, tokens: /(^space-|-h$|-h-|^touch|-w$)/, intro: "Afstande i trin af 4 px, faste højder på felter, knapper og rækker, og sideskabelonens bredder. Gitteret har 12 kolonner; modulerne står i ¼, ⅓, ½, ⅔, ¾ eller fuld bredde." },
  { id: "hjoerner", label: "Hjørner", entries: /^01\.4$/, tokens: /^radius/, intro: "Skalaen er 4, 6, 8, 9, 10, 12 og 14 plus pille. Felter og knapper 8, menupunkter 9, faner og almindelige kort (.lasso-card) 10, kortrammer om sektioner og beskeder 12, dialoger 14. Tags og etiketter 6, bogstav-ikoner 4." },
  { id: "skygger", label: "Skygger og fokus", entries: /^01\.5$/, tokens: /^(shadow|focus)/, intro: "Kun det, der svæver (menuer, dialoger, beskeder), har skygge. Undtagelser: det valgte segment i en grå pille (shadow-seg) og sideskinnens grupper (svag fast skygge). Fokus er 1 px koral kant, aldrig en ring; heatmap-celler (1 px ink-kant som ved hover) og accent-segmenter (1 px fuld koral, fordi valgt allerede har koral kant) er bevidste undtagelser." },
  { id: "ikoner", label: "Ikoner", entries: /^01\.6$/, tokens: /^icon(-|btn)/, intro: "Omridsikoner med streg 1,8; enkelte ikoner kan tegnes udfyldt (fx Gemt og aktiv klokke). Ikon + ord ved enhver farvekodning." },
  { id: "logo", label: "Logo", entries: /^01b\./, tokens: /^$/, intro: "Ikon og navnelogo med frizone og faste størrelser." },
];
