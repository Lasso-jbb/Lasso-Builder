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
  { id: "tablet", label: "Tablet", vw: 834, note: "Under 1200: ⅓ og ½ bliver ½, ¼ ⅔ ¾ bliver fuld" },
  { id: "mobil", label: "Mobil", vw: 390, note: "Én kolonne, 16 px sideluft" },
];

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
    intro: "Hvem er det, og hvordan kommer man i kontakt. Står øverst på hver side.",
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
    intro: "Score, kreditvurdering og revisors uafhængighed. Farve bærer aldrig betydningen alene.",
    types: ["LassoScoreGauge", "LassoScoreHistory", "LassoCreditRating", "LassoRiskObservations", "LassoAuditorIndependence"],
  },
  {
    id: "historik",
    label: "Historik og nyheder",
    intro: "Hvad er der sket: CVR-ændringer, nyheder, meddelelser og fusioner.",
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
  "06": "Navigation og sideskabelon",
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
  "26a": "Mobil: ramme og navigation",
  "26b": "Mobil: grafer og målere",
  "26c": "Mobil: tabeller og diagrammer",
  "26d": "Mobil: personer",
  "26e": "Mobil: rapporter og beskeder",
  "26f": "Tablet",
  "26g": "Mobil: felter",
  "26h": "Mobil: historik",
  "27": "Rapporter og PDF",
  "28": "Datatyper",
  "29": "Faner",
  "30": "Fra spørgsmål til skærm",
};

/** Tavlerne i navigationens tre galleriafsnit. */
export const GALLERY_SECTIONS: { id: string; label: string; boards: RegExp }[] = [
  { id: "elementer", label: "Elementer", boards: /^(02a|02b|02c|03|04|05|06|07|29)$/ },
  { id: "datavisning", label: "Datavisning", boards: /^(08|09|10|11|12|13|14|14b|15|16|17|18|19|20|21|22|28)$/ },
  { id: "moenstre", label: "Mønstre og sider", boards: /^(23|24|25|26|26[a-h]|27|30)$/ },
];

export const boardOf = (nr: string) => nr.split(".")[0]!;

/* ---------- Fundament ---------- */

/** Fundamentets sider: galleriets tavle 01/01b og de tokens, der hører til (valgt efter navn i styles.css). */
export const FOUNDATION: { id: string; label: string; entries: RegExp; tokens: RegExp; intro: string }[] = [
  { id: "farver", label: "Farver", entries: /^01\.1$/, tokens: /(accent|bg|surface|chrome|overlay|scrim|tag|border|divider|text|muted|faint|placeholder|disabled|positive|negative|warning|danger|info|success|chart|gauge|map|icon|focus|status|sev|hover|selected)/, intro: "Koral er den eneste accentfarve. Hvid flade overalt; semantiske farver bruges kun til status og risiko, altid med ikon eller ord." },
  { id: "typografi", label: "Typografi", entries: /^01\.2$/, tokens: /(font|fs|lh|fw|ls)/, intro: "Poppins i fire vægte. Overskrifter 600, værdier og status 500, brødtekst 400." },
  { id: "afstand", label: "Afstand og gitter", entries: /^01\.3$|^23\.1$/, tokens: /(space|gap|page|pad|gutter|col|touch|h$|-h-|height|width|size)/, intro: "Afstande i trin af 4 px. Gitteret har 12 kolonner; modulerne står i ¼, ⅓, ½, ⅔, ¾ eller fuld bredde." },
  { id: "hjoerner", label: "Hjørner", entries: /^01\.4$/, tokens: /radius/, intro: "Felter og knapper 8, menupunkter 9, faner og kort 10, dialoger 14." },
  { id: "skygger", label: "Skygger og fokus", entries: /^01\.5$/, tokens: /(shadow|focus|ring)/, intro: "Kun det, der svæver, har skygge. Fokus er 1 px koral kant, aldrig en ring." },
  { id: "ikoner", label: "Ikoner", entries: /^01\.6$/, tokens: /icon/, intro: "Omridsikoner med streg 1,8. Ikon + ord ved enhver farvekodning." },
  { id: "logo", label: "Logo", entries: /^01b\./, tokens: /^$/, intro: "Ikon og navnelogo med frizone og faste størrelser." },
];
