import { gridRuleOf, widthProfileOf, type GridRule } from "./catalog.js";
import { contentMinWidth, sharedMaxWidth } from "./register.js";
import { WIDTH_COLUMNS, WIDTHS, type ViewComponent, type Width } from "./spec.js";

/**
 * Gridmodellen (Paper 23.1–23.3, scratchpad/gridmodel.md): siden består af bånd, der altid spænder
 * 12 kolonner. Et bånd har 1–4 stakke; en stak stabler 1–n elementer i samme bredde. Pakningen er
 * deterministisk: samme elementer i samme rækkefølge med samme højder giver altid samme side.
 */

/** Lodret afstand mellem elementer i en stak og mellem bånd (px). */
export const GRID_GAP = 24;
/** En stak skal nå mindst 85 % af ankerets højde, og båndets stakke må højst afvige 15 %. */
export const BAND_FILL = 0.85;
export const BAND_MAX_DEVIATION = 0.15;

/**
 * Tilladte bredde-kombinationer i et bånd (kolonner, venstre mod højre). Summen er altid 12.
 * ⅔ + ¼ (11) og ¾ + ⅓ (13) findes ikke.
 */
export const BAND_COMBOS: readonly (readonly number[])[] = [
  [12],
  [6, 6],
  [8, 4],
  [4, 8],
  [9, 3],
  [3, 9],
  [4, 4, 4],
  [3, 3, 6],
  [3, 6, 3],
  [6, 3, 3],
  [3, 3, 3, 3],
];

const WIDTH_OF_COLUMNS: Record<number, Width> = { 3: "quarter", 4: "third", 6: "half", 8: "two-thirds", 9: "three-quarters", 12: "full" };
export function widthOfColumns(cols: number): Width {
  const w = WIDTH_OF_COLUMNS[cols];
  if (!w) throw new Error(`Ingen bredde på ${cols} kolonner`);
  return w;
}

/** Tillader reglen bredden (min ≤ bredde ≤ max)? */
export function allowsWidth(rule: GridRule, width: Width): boolean {
  const i = WIDTHS.indexOf(width);
  return i >= WIDTHS.indexOf(rule.min) && i <= WIDTHS.indexOf(rule.max);
}

/**
 * Målte højder (px) med demodata på 1200-gitteret (scratchpad/measure/heights.json) i bredderne
 * ¼, ⅓, ½, ⅔, ¾, 1/1. Nøglen er typen, for regnskabslisten "LassoKeyValueList (financials)".
 */
export const MEASURED_HEIGHTS: Readonly<Record<string, readonly [number, number, number, number, number, number]>> = {
  LassoCompanyHead: [34, 34, 34, 34, 34, 34], // Fable runde 6 (I4Y-0): hovedet er én række på 34 px (navnets linjehøjde)
  LassoKeyFigureCards: [481, 230, 166, 148, 133, 138],
  LassoKeyValueList: [964, 924, 662, 662, 644, 626],
  "LassoKeyValueList (financials)": [814, 814, 535, 535, 535, 535],
  LassoContact: [261, 261, 206, 206, 206, 206],
  LassoContactPersons: [234, 234, 236, 236, 236, 236],
  LassoShortcuts: [66, 66, 88, 88, 88, 40],
  LassoTextSections: [879, 735, 590, 569, 506, 485],
  LassoTimeline: [476, 440, 514, 514, 514, 514],
  LassoNews: [266, 226, 310, 292, 292, 292],
  LassoBarChart: [336, 336, 300, 300, 300, 300],
  LassoGroupedBarChart: [327, 327, 300, 300, 300, 300],
  LassoLineChart: [354, 354, 300, 300, 300, 300],
  LassoStackedBarChart: [232, 212, 300, 300, 300, 300],
  LassoWaterfallChart: [322, 322, 300, 300, 300, 300],
  LassoShareBars: [154, 154, 200, 200, 200, 200],
  LassoKeyFigureGauge: [183, 183, 185, 185, 185, 185],
  LassoMultiYearTable: [338, 338, 296, 296, 296, 296],
  LassoIncomeStatement: [442, 442, 444, 444, 444, 444],
  LassoBalanceSheet: [750, 739, 741, 741, 741, 741],
  LassoCashFlow: [562, 562, 564, 564, 564, 564],
  LassoFinancialStatements: [574, 574, 434, 434, 434, 1239],
  LassoPersonList: [255, 255, 229, 229, 229, 229],
  LassoOwnerList: [168, 168, 161, 161, 161, 161],
  LassoBeneficialOwners: [178, 160, 161, 161, 161, 161],
  LassoOwnershipDiagram: [357, 357, 541, 541, 541, 770],
  LassoRelations: [267, 267, 269, 269, 269, 269],
  LassoRiskObservations: [468, 430, 493, 475, 475, 475],
  LassoScoreGauge: [292, 292, 224, 224, 224, 224], // 18.1 (runde 5): ¼-kort med Beregnet/Grundlag/link; ½ med faktorer
  LassoProductionUnits: [395, 355, 604, 604, 567, 370],
  LassoProperties: [139, 122, 124, 107, 107, 107],
  LassoMap: [220, 220, 400, 400, 400, 400],
  LassoRegistration: [1153, 1031, 797, 530, 476, 420],
  LassoMergers: [356, 314, 473, 341, 341, 341],
  LassoAnnouncements: [44, 44, 64, 64, 64, 64],
  LassoPublications: [612, 594, 443, 405, 405, 405],
  LassoLivestock: [605, 554, 477, 337, 286, 286],
  LassoCompareTable: [489, 489, 427, 407, 407, 327],
  LassoRanking: [269, 269, 220, 220, 220, 220],
  LassoCompanyTable: [1317, 1229, 545, 545, 545, 604],
  LassoPersonHead: [34, 34, 34, 34, 34, 34], // som LassoCompanyHead (runde 6)
  LassoPersonRoles: [362, 362, 295, 295, 295, 295],
  LassoPersonNetwork: [468, 351, 317, 317, 317, 317],
  LassoPersonRisk: [622, 474, 404, 386, 368, 368],
  LassoPersonFacts: [433, 433, 337, 337, 337, 337],
  LassoPersonStats: [90, 90, 90, 90, 90, 90],
  LassoChangeFeed: [1181, 1057, 979, 943, 943, 943],
  LassoHeatmap: [226, 226, 270, 270, 270, 270],
};

/** Ikke målt (gridmodel.md afsnit 6): skøn ud fra et beslægtet element. */
const UNMEASURED: Record<string, string> = {
  LassoSummary: "LassoTextSections",
  LassoPersonTable: "LassoCompanyTable",
  LassoScoreHistory: "LassoLineChart",
  LassoCreditRating: "LassoRiskObservations",
  LassoAuditorIndependence: "LassoRegistration",
  LassoSavedPages: "LassoCompanyTable",
};
const FOLLOW_UPS_HEIGHT = 64;

/** Målt højde af en komponent i en bredde med demodata (px), uden hensyn til dens egne data. */
export function measuredHeight(c: Pick<ViewComponent, "type"> & { variant?: unknown }, width: Width): number {
  if (c.type === "LassoFollowUps") return FOLLOW_UPS_HEIGHT;
  const key = c.type === "LassoKeyValueList" && c.variant === "financials" ? "LassoKeyValueList (financials)" : c.type;
  const row = MEASURED_HEIGHTS[key] ?? MEASURED_HEIGHTS[UNMEASURED[key] ?? ""] ?? MEASURED_HEIGHTS.LassoTextSections!;
  return row[WIDTHS.indexOf(width)]!;
}

/** Elementtypens højdeklasse ud fra højden (px) i standardbredden (23.1). */
export function heightClassOf(px: number): GridRule["height"] {
  if (px <= 176) return "low";
  if (px <= 320) return "medium";
  if (px <= 640) return "high";
  return "very-high";
}

export interface PackedStack {
  width: Width;
  items: ViewComponent[];
  /** Stakkens højde før flex (px), med GRID_GAP mellem elementerne. */
  height: number;
}
export interface PackedBand {
  stacks: PackedStack[];
  /** Båndets højde = højeste stak. */
  height: number;
  /** (højeste − laveste stak) / højeste, før den korteste stak strækkes. 0 for et fuldbånd. */
  deviation: number;
}

export type HeightFn = (c: ViewComponent, width: Width) => number;

/** Typer, der altid står i eget fuldbånd (ud over dem med min = 1/1): hoved, nøgletalskort, persontal, opfølgning. */
const FULL_BAND_TYPES = new Set<ViewComponent["type"]>(["LassoCompanyHead", "LassoPersonHead", "LassoKeyFigureCards", "LassoPersonStats", "LassoFollowUps"]);

/* ---------- Bredde pr. element (Ø13, B8) ---------- */

/**
 * Mindstebredden for et konkret element (Ø13): typens min hævet efter profil og indhold
 * (contentMinWidth). Komponisten (packPage) regner den med driverne fra Dataset (driversOf);
 * uden data bruges profilen alene (defaultMinWidth).
 */
export type MinWidthFn = (c: ViewComponent) => Width;

const widthIndex = (w: Width) => WIDTHS.indexOf(w);
const clampWidth = (w: Width, lo: Width, hi: Width): Width => (widthIndex(w) < widthIndex(lo) ? lo : widthIndex(w) > widthIndex(hi) ? hi : w);

/**
 * Mindstebredden med indholdsdriverne `drivers` (fx fra driversOf), altid inden for typens min–max:
 * hæver contentMinWidth over typens max (fx flerårstabellen, der kun findes i ⅔), er max grænsen.
 */
export function elementMinWidth(c: ViewComponent, drivers: Parameters<typeof contentMinWidth>[2] = {}): Width {
  const r = gridRuleOf(c);
  return clampWidth(contentMinWidth(widthProfileOf(c).profil, r.min, drivers), r.min, r.max);
}

/** Mindstebredden uden kendskab til indholdet: profilen og typens min (bred aldrig under ⅔). */
export const defaultMinWidth: MinWidthFn = (c) => elementMinWidth(c);

/**
 * Elementets tilladte bredder i pakningen: [mindstebredde; max], hvor max for et element, der deler bånd
 * med andre (alle stakke i et delt bånd), er sharedMaxWidth: smal højst ½. En eksplicit width låser bredden.
 */
interface Widths {
  min: MinWidthFn;
}

function minOf(ws: Widths, c: ViewComponent): Width {
  const r = gridRuleOf(c);
  return clampWidth(ws.min(c), r.min, r.max);
}

function sharedMaxOf(ws: Widths, c: ViewComponent): Width {
  const r = gridRuleOf(c);
  const max = sharedMaxWidth(widthProfileOf(c).profil, r.max, false);
  const min = minOf(ws, c);
  return widthIndex(max) < widthIndex(min) ? min : max;
}

function isFullBand(c: ViewComponent, ws: Widths): boolean {
  // En eksplicit bredde vinder (render_view, fx mønster 7: analyse ¾ + nøgletal ¼).
  if (c.width) return c.width === "full";
  if (FULL_BAND_TYPES.has(c.type)) return true;
  // Min 1/1 efter indholdet (fx netværket med lange navne, tre rækker pr. person og tidsakse): eget bånd.
  return minOf(ws, c) === "full";
}

/** Standardbredden inden for elementets tilladte bredder i et delt bånd (til widthPenalty). */
function sharedStdOf(ws: Widths, c: ViewComponent): Width {
  return clampWidth(gridRuleOf(c).std, minOf(ws, c), sharedMaxOf(ws, c));
}

/**
 * Må elementet stå i bredden i et delt bånd? En eksplicit width låser bredden; ellers gælder elementets
 * mindstebredde (min, som standard defaultMinWidth) og max ved deling (smal højst ½).
 */
export function fitsWidth(c: ViewComponent, width: Width, min: MinWidthFn = defaultMinWidth): boolean {
  return fits(c, width, { min });
}
function fits(c: ViewComponent, width: Width, ws: Widths): boolean {
  if (c.width) return c.width === width;
  const i = widthIndex(width);
  return i >= widthIndex(minOf(ws, c)) && i <= widthIndex(sharedMaxOf(ws, c));
}

interface Candidate {
  comboIndex: number;
  stacks: PackedStack[];
  /** Index i restlisten for de elementer, båndet bruger (inkl. ankeret). */
  used: Set<number>;
  deviation: number;
  /** Σ |kolonner − standardkolonner|: elementer uden for standardbredden koster. */
  widthPenalty: number;
  /** Elementer, der har fået færre rækker for at passe (flex rækker bruges kun, når det er nødvendigt). */
  shrunk: number;
  /** Stakke i omvendt prioritet fra venstre mod højre (efter stakkens vigtigste element). */
  stackInversions: number;
  /** Par af elementer i omvendt prioritet, læst stak for stak fra venstre, oppefra og ned. */
  inversions: number;
}

/** Et element, som det lægges i en stak: evt. en kopi med færre rækker, og dens højde. */
interface Fitted {
  c: ViewComponent;
  h: number;
}

/** Kopier med færre rækker peger tilbage på det oprindelige element (originOf). */
const origins = new WeakMap<ViewComponent, ViewComponent>();
/** Det element, som pakningen fik ind, for et element i et bånd (samme objekt, eller originalen til en kopi med færre rækker). */
export function originOf(c: ViewComponent): ViewComponent {
  let o = c;
  for (let next = origins.get(o); next && next !== o; next = origins.get(o)) o = next;
  return o;
}

/** Færreste rækker, et flex-element (rækker) skæres ned til, før det hellere står i et andet bånd. */
const MIN_ROWS = 3;

/**
 * Flex rækker (23.1): nøgle-værdi-listen (rows), tidslinjen og nyhederne (limit) kan vise færre rækker
 * med "Se alle" under, så de passer i en stak. Returnerer en kopi med n rækker, eller null for typer
 * uden et rækkeloft.
 */
export function withRows(c: ViewComponent, n: number): ViewComponent | null {
  if (c.type === "LassoKeyValueList") return { ...c, maxRows: n };
  if (c.type === "LassoTimeline" && !c.filterColumn) return { ...c, limit: n };
  if (c.type === "LassoNews") return { ...c, limit: n };
  return null;
}
function currentRows(c: ViewComponent): number {
  if (c.type === "LassoKeyValueList") return c.maxRows ?? 12;
  if (c.type === "LassoTimeline") return c.limit ?? 5;
  if (c.type === "LassoNews") return c.limit ?? 5;
  return 0;
}

/** Elementet i bredden, hvis det højst fylder `room` px, ellers med færre rækker (højst ned til MIN_ROWS), ellers null. */
function fitRows(c: ViewComponent, width: Width, room: number, h: HeightFn): Fitted | null {
  const full = h(c, width);
  if (full <= room) return { c, h: full };
  if (gridRuleOf(c).flex !== "rows") return null;
  for (let n = currentRows(c) - 1; n >= MIN_ROWS; n--) {
    const v = withRows(c, n);
    if (!v) return null;
    const hv = h(v, width);
    if (hv <= room && hv < full) return { c: v, h: hv };
  }
  return null;
}

/** Højst så mange kandidater og så mange ekstra elementer pr. stak i søgningen (holder pakningen hurtig). */
const MAX_ELIGIBLE = 10;
const MAX_STACK_ADD = 4;

function inversionsOf(seq: readonly number[]): number {
  let n = 0;
  for (let a = 0; a < seq.length; a++) for (let b = a + 1; b < seq.length; b++) if (seq[a]! > seq[b]!) n++;
  return n;
}

/**
 * Fylder et bånd ud fra en kombination med ankeret (rest[anchorIndex]) i slot `slot`. Index i `rest`
 * er prioriteten. Hver ledig stak fyldes med den første delmængde af restlisten i prioritetsorden
 * (leksikografisk), der tillader stakkens bredde og lander i vinduet [0,85·H; H/0,85], dvs. mindst
 * 85 % af ankerets højde og aldrig så høj, at ankeret bliver mere end 15 % lavere. Findes ingen,
 * fyldes stakken grådigt så langt, den kan. Er en stak blevet højere end ankeret, fyldes de korte
 * stakke (også ankerets) op mod den i en anden runde.
 */
function fillBand(combo: readonly number[], comboIndex: number, slot: number, rest: readonly ViewComponent[], anchorIndex: number, h: HeightFn, GAP: number, ws: Widths): Candidate | null {
  const anchor = rest[anchorIndex]!;
  const stacks: PackedStack[] = combo.map((cols) => ({ width: widthOfColumns(cols), items: [], height: 0 }));
  const H = h(anchor, stacks[slot]!.width);
  stacks[slot]!.items.push(anchor);
  stacks[slot]!.height = H;
  const used = new Set<number>([anchorIndex]);
  const add = (s: PackedStack, limit: number, floor: number) => {
    if (s.height >= floor) return;
    const eligible: number[] = [];
    for (let k = 0; k < rest.length && eligible.length < MAX_ELIGIBLE; k++) {
      const c = rest[k]!;
      if (!used.has(k) && !isFullBand(c, ws) && fits(c, s.width, ws)) eligible.push(k);
    }
    const gap = (n: number) => (s.items.length + n > 0 ? GAP : 0);
    // Elementet i stakkens bredde, evt. med færre rækker (flex rækker), så det højst fylder `room`.
    const fit = (k: number, room: number): Fitted | null => fitRows(rest[k]!, s.width, room, h);
    let found: { k: number; f: Fitted }[] | null = null;
    const walk = (from: number, picked: { k: number; f: Fitted }[], sum: number): void => {
      if (found || picked.length >= MAX_STACK_ADD) return;
      for (let e = from; e < eligible.length && !found; e++) {
        const k = eligible[e]!;
        const f = fit(k, limit - sum - gap(picked.length));
        if (!f) continue;
        const next = sum + gap(picked.length) + f.h;
        const chosen = [...picked, { k, f }];
        if (next >= floor) {
          found = chosen;
          return;
        }
        walk(e + 1, chosen, next);
      }
    };
    walk(0, [], s.height);
    const pick: { k: number; f: Fitted }[] = found ?? [];
    if (!found) {
      let sum = s.height;
      for (const k of eligible) {
        if (sum >= floor) break;
        const f = fit(k, limit - sum - gap(pick.length));
        if (!f) continue;
        pick.push({ k, f });
        sum += gap(pick.length - 1) + f.h;
      }
    }
    for (const { k, f } of pick) {
      s.height += (s.items.length > 0 ? GAP : 0) + f.h;
      s.items.push(f.c);
      origins.set(f.c, rest[k]!);
      used.add(k);
    }
  };
  combo.forEach((_, i) => {
    if (i !== slot) add(stacks[i]!, H / BAND_FILL, H * BAND_FILL);
  });
  if (stacks.some((s) => s.items.length === 0)) return null;
  const top = Math.max(...stacks.map((s) => s.height));
  for (const s of stacks) add(s, top, top * BAND_FILL);
  const heights = stacks.map((s) => s.height);
  const max = Math.max(...heights);
  const deviation = max > 0 ? (max - Math.min(...heights)) / max : 0;
  const widthPenalty = stacks.reduce((sum, s) => sum + s.items.reduce((a, c) => a + Math.abs(WIDTH_COLUMNS[s.width] - WIDTH_COLUMNS[c.width ?? sharedStdOf(ws, originOf(c))]), 0), 0);
  const rank = (c: ViewComponent) => rest.indexOf(originOf(c));
  const stackInversions = inversionsOf(stacks.map((s) => Math.min(...s.items.map(rank))));
  const inversions = inversionsOf(stacks.flatMap((s) => s.items.map(rank)));
  const shrunk = stacks.reduce((n, s) => n + s.items.filter((c) => originOf(c) !== c).length, 0);
  return { comboIndex, stacks, used, deviation, widthPenalty, shrunk, stackInversions, inversions };
}

function better(a: Candidate, b: Candidate): boolean {
  const okA = a.deviation <= BAND_MAX_DEVIATION;
  const okB = b.deviation <= BAND_MAX_DEVIATION;
  if (okA !== okB) return okA;
  // Hellere alle rækker end færre (flex rækker er en nødløsning), derefter standardbredderne.
  if (a.shrunk !== b.shrunk) return a.shrunk < b.shrunk;
  if (a.widthPenalty !== b.widthPenalty) return a.widthPenalty < b.widthPenalty;
  if (Math.abs(a.deviation - b.deviation) > 1e-9) return a.deviation < b.deviation;
  if (a.stacks.length !== b.stacks.length) return a.stacks.length < b.stacks.length;
  if (a.used.size !== b.used.size) return a.used.size > b.used.size;
  if (a.stackInversions !== b.stackInversions) return a.stackInversions < b.stackInversions;
  if (a.inversions !== b.inversions) return a.inversions < b.inversions;
  return a.comboIndex < b.comboIndex;
}

/** Bedste delte bånd med rest[anchorIndex] som anker i sin bredde, eller null, hvis ingen kombination kan fyldes. */
function bestBand(rest: readonly ViewComponent[], anchorIndex: number, h: HeightFn, gap: number, ws: Widths): Candidate | null {
  const anchor = rest[anchorIndex]!;
  // Ankeret prøves i sin standardbredde (eller sin eksplicitte width) og i de øvrige tilladte bredder;
  // widthPenalty gør, at standardbredden vinder, når den giver et bånd inden for 15 %.
  const widths = sharedWidthsOf(anchor, ws);
  let best: Candidate | null = null;
  BAND_COMBOS.forEach((combo, comboIndex) => {
    if (combo.length < 2) return;
    combo.forEach((c, slot) => {
      if (!widths.has(c)) return;
      const cand = fillBand(combo, comboIndex, slot, rest, anchorIndex, h, gap, ws);
      if (cand && (!best || better(cand, best))) best = cand;
    });
  });
  return best;
}

/** Kolonnetallene, et element må stå i som stak i et delt bånd (eksplicit width, ellers min–max ved deling). */
function sharedWidthsOf(c: ViewComponent, ws: Widths): Set<number> {
  const explicit = c.width && c.width !== "full" ? c.width : undefined;
  return new Set((explicit ? [explicit] : WIDTHS.filter((w) => w !== "full" && fits(c, w, ws))).map((w) => WIDTH_COLUMNS[w]));
}

/** Så mange elementer frem ledes der efter et højt anker, når det første element ikke kan bære et bånd. */
const ANCHOR_LOOKAHEAD = 3;

function fullBand(c: ViewComponent, h: HeightFn): PackedBand {
  const height = h(c, "full");
  return { stacks: [{ width: "full", items: [c], height }], height, deviation: 0 };
}

const TALL = new Set<GridRule["height"]>(["high", "very-high"]);

/**
 * Båndpakningen (gridmodel.md afsnit 4). Input i prioriteret rækkefølge (svar-elementet først).
 * 1. Hoved, nøgletalskort/persontal, opfølgning og elementer med min 1/1 (eller width 'full') står i eget fuldbånd.
 * 2. Ellers er det første element anker i sin standardbredde; hver tilladt kombination med ankerets
 *    bredde (og i de øvrige tilladte bredder) fyldes (fillBand), og den bedste vælges: afvigelse ≤ 15 %
 *    først, så færrest kolonner uden for standardbredderne, lavest afvigelse, færrest stakke, flest elementer brugt og til sidst den
 *    rækkefølge fra venstre, der ligger tættest på prioriteten.
 * 3. Kan det første element ikke bære et bånd inden for 15 % (fx en smal liste over for en lang
 *    historik), bliver det næste høje element (højst 3 frem) anker, og det første stables ved siden af
 *    (udligning b: lave og mellem elementer i en smal stak ved siden af et højt anker).
 * 4. Aldrig et halvt element alene: kan ingen kombination fyldes, står
 *    ankeret i fuld bredde, hvis reglen tillader det; ellers lægges det i den korteste stak i forrige
 *    bånd, hvis bredden passer, ellers alligevel i fuld bredde, så der aldrig er et hul.
 */
export interface PackOptions {
  /** Lodret afstand mellem elementer i en stak (standard GRID_GAP = 24). Layout 'columns' bruger 0 og lægger luften i elementhøjden. */
  gap?: number;
  /**
   * Elementets mindstebredde (Ø13). Komponisten giver den indholdsstyrede (packPage: driversOf fra Dataset);
   * standard er defaultMinWidth (profil og typens min). Et element lægges aldrig smallere: hellere eget
   * bånd (min 1/1) eller udeladt af højdebudgettet.
   */
  minWidth?: MinWidthFn;
}

export function packBands(items: readonly ViewComponent[], h: HeightFn, options: PackOptions = {}): PackedBand[] {
  const gap = options.gap ?? GRID_GAP;
  const ws: Widths = { min: options.minWidth ?? defaultMinWidth };
  const bands: PackedBand[] = [];
  let rest = [...items];
  while (rest.length > 0) {
    const first = rest[0]!;
    if (isFullBand(first, ws)) {
      bands.push(fullBand(first, h));
      rest = rest.slice(1);
      continue;
    }
    let chosen = bestBand(rest, 0, h, gap, ws);
    // Også når båndet kun holder 15 % ved at skære rækker væk: et højt anker længere fremme kan give et bånd uden.
    if (!chosen || chosen.deviation > BAND_MAX_DEVIATION || chosen.shrunk > 0) {
      for (let k = 1; k < rest.length && k <= ANCHOR_LOOKAHEAD; k++) {
        const c = rest[k]!;
        if (isFullBand(c, ws) || !TALL.has(gridRuleOf(c).height)) continue;
        const alt = bestBand(rest, k, h, gap, ws);
        if (alt && alt.used.has(0) && alt.deviation <= BAND_MAX_DEVIATION && (!chosen || better(alt, chosen))) chosen = alt;
        break;
      }
    }
    const rule = gridRuleOf(first);
    // Er alle kombinationer over 15 %, tages den laveste (gridmodel 4e); siden tegnes stadig uden huller.
    if (chosen) {
      const heights = chosen.stacks.map((s) => s.height);
      bands.push({ stacks: chosen.stacks, height: Math.max(...heights), deviation: chosen.deviation });
      const used = chosen.used;
      rest = rest.filter((_, k) => !used.has(k));
      continue;
    }
    rest = rest.slice(1);
    // Smalle elementer og lave elementer (fx genveje, der "fylder rest i en stak") lægges i forrige
    // bånds korteste stak, når det holder båndet inden for 15 %; ellers står de i fuld bredde.
    if (rule.max !== "full" || rule.height === "low") {
      const prev = bands.at(-1);
      if (prev && prev.stacks.length > 1 && stakfyld(prev, first, h, gap, ws)) continue;
    }
    bands.push(fullBand(first, h));
  }
  return bands;
}

/**
 * Stakfyld (gridmodel 4d): et element, der ikke kan bære et bånd, lægges i forrige bånd. Prøver hver
 * stak, hvis bredde elementet tillader, og desuden at flytte ét andet element (ikke stakkens første)
 * fra den stak til en anden stak, hvis bredde det tillader; den placering med lavest afvigelse vinder.
 * Returnerer false, hvis ingen stak tillader elementets bredde, eller hvis båndet ville afvige mere end
 * 15 % (og mere end før).
 */
function stakfyld(band: PackedBand, c: ViewComponent, h: HeightFn, gap: number, ws: Widths): boolean {
  const heightOf = (items: readonly ViewComponent[], w: Width) => items.reduce((sum, x, i) => sum + (i > 0 ? gap : 0) + h(x, w), 0);
  let best: { stacks: ViewComponent[][]; deviation: number } | null = null;
  const consider = (stacks: ViewComponent[][]) => {
    const hs = stacks.map((items, i) => heightOf(items, band.stacks[i]!.width));
    const max = Math.max(...hs);
    const deviation = (max - Math.min(...hs)) / max;
    if (!best || deviation < best.deviation - 1e-9) best = { stacks, deviation };
  };
  band.stacks.forEach((s, i) => {
    if (!fits(c, s.width, ws)) return;
    consider(band.stacks.map((x, k) => (k === i ? [...x.items, c] : [...x.items])));
    s.items.forEach((y, yi) => {
      if (yi === 0) return;
      band.stacks.forEach((t, j) => {
        if (j === i || !fits(originOf(y), t.width, ws)) return;
        consider(band.stacks.map((x, k) => (k === i ? [...x.items.filter((z) => z !== y), c] : k === j ? [...x.items, y] : [...x.items])));
      });
    });
  });
  const chosen = best as { stacks: ViewComponent[][]; deviation: number } | null;
  // Stakfyld må ikke gøre båndet skævt: ender det over 15 % (og over båndets egen afvigelse), står
  // elementet hellere alene i fuld bredde.
  if (!chosen || chosen.deviation > Math.max(BAND_MAX_DEVIATION, band.deviation) + 1e-9) return false;
  band.stacks.forEach((s, i) => {
    s.items = chosen.stacks[i]!;
    s.height = heightOf(s.items, s.width);
  });
  band.height = Math.max(...band.stacks.map((s) => s.height));
  band.deviation = chosen.deviation;
  return true;
}

/**
 * Svar-elementet først (Ø13/B10, spørgsmåls- og personsiderne): står `lead` i et delt bånd, flyttes dens
 * stak til venstre og elementet øverst i stakken, så det er det første, der læses (bandsToComponents).
 * Bredde-kombinationen bliver lovlig (alle ombytninger af en kombination i BAND_COMBOS findes), og
 * højderne ændres ikke. Ændrer båndene på stedet.
 */
export function leadFirst(bands: PackedBand[], lead: ViewComponent): PackedBand[] {
  for (const b of bands) {
    const k = b.stacks.findIndex((s) => s.items.some((c) => originOf(c) === lead || c === lead));
    if (k < 0) continue;
    const stack = b.stacks[k]!;
    const i = stack.items.findIndex((c) => originOf(c) === lead || c === lead);
    if (i > 0) stack.items = [stack.items[i]!, ...stack.items.filter((_, j) => j !== i)];
    if (k > 0) b.stacks = [stack, ...b.stacks.filter((_, j) => j !== k)];
    break;
  }
  return bands;
}

/**
 * packBands for sider, hvor elementerne før stod "to og to" (person- og spørgsmålssiderne, Ø13/B10): et
 * element, som pakkeren lægger alene i et fuldbånd, fordi intet andet kan stå ved siden af det inden for
 * 15 % (fx et kort svar over for høje kontekstmoduler), sættes side om side med det første af de næste
 * (højst ANCHOR_LOOKAHEAD) elementer, det kan dele bånd med; det står til venstre (leadFirst), og resten
 * pakkes derefter igen. Så står en smal liste ikke strakt alene i fuld bredde med tom plads, når den kunne
 * dele bånd. Bredderne følger de samme regler (mindstebredde, smal højst ½ ved deling); et element med
 * mindstebredde 1/1 står stadig alene. Deterministisk.
 */
export function packBandsPaired(items: readonly ViewComponent[], h: HeightFn, options: PackOptions = {}): PackedBand[] {
  const bands = packBands(items, h, options);
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!;
    if (b.stacks.length !== 1 || b.stacks[0]!.items.length !== 1) continue;
    const a = originOf(b.stacks[0]!.items[0]!);
    const rest = bands.slice(i + 1).flatMap((x) => x.stacks.flatMap((st) => st.items.map(originOf)));
    const ordered = items.filter((c) => rest.includes(c));
    for (const partner of ordered.slice(0, ANCHOR_LOOKAHEAD)) {
      const shared = (p: PackedBand[]) => p.length === 1 && p[0]!.stacks.length > 1;
      let joined = packBands([a, partner], h, options);
      if (!shared(joined)) joined = packBands([partner, a], h, options);
      if (!shared(joined)) continue;
      return [...bands.slice(0, i), leadFirst(joined, a)[0]!, ...packBandsPaired(ordered.filter((c) => c !== partner), h, options)];
    }
  }
  return bands;
}

/**
 * Båndene som komponenter til layout 'columns': et fuldbånd er en komponent uden kolonne; et delt
 * bånd giver hver stak sit kolonnenummer (1–4) og sin bredde, så LassoView kan tegne båndet
 * (columnBands starter et nyt bånd, når kolonnenummeret falder).
 */
export function bandsToComponents(bands: readonly PackedBand[]): ViewComponent[] {
  return bands.flatMap((b) => {
    if (b.stacks.length === 1) {
      return b.stacks[0]!.items.map((c) => {
        const { column: _column, ...rest } = c as ViewComponent & { column?: number };
        return rest as ViewComponent;
      });
    }
    return b.stacks.flatMap((s, i) => s.items.map((c) => ({ ...c, column: i + 1, width: s.width }) as ViewComponent));
  });
}

/* ---------- Højdebudget (23.3, Jakob 29.09 "sidelængde") ---------- */

/**
 * Højdebudget for en side (px ved 1200-gitteret, i pakningens højder): ca. 1½ skærm. En typisk skærm
 * ved 1200 px bredde viser 800–900 px af siden; 1300 px er 1,5 skærm og ca. 60 % af den gamle
 * default-side (2100 px). Systemet kender alle kombinationer, men fylder ikke alle elementer ud: de
 * mest relevante vælges inden for budgettet. `Infinity` (vis alt) slår budgettet fra.
 */
export const PAGE_HEIGHT_BUDGET = 1300;

/**
 * Kompakt form af et element, når siden er over budgettet: oplysninger 6 rækker, regnskabsliste 6, profil
 * 3 afsnit, historik og nyheder 3 – lister med færre rækker og profilen med
 * færre afsnit ("Se alle"/"Vis mere" under). null = elementet har ingen kompakt form (eller er allerede kompakt).
 */
export function compactOf(c: ViewComponent): ViewComponent | null {
  // Oplysninger rows 6 (Paper 23.3 B3: revisor, revisorskift, regnskabsperiode, branchekode, kommune, region + "Se alle oplysninger").
  if (c.type === "LassoKeyValueList" && c.variant !== "financials" && (c.maxRows ?? 99) > 6) return { ...c, maxRows: 6 };
  if (c.type === "LassoKeyValueList" && c.variant === "financials" && (c.maxRows ?? 99) > 6) return { ...c, maxRows: 6 };
  if (c.type === "LassoTextSections" && c.variant !== "analyse" && (c.limit ?? 99) > 3) return { ...c, limit: 3 };
  if (c.type === "LassoTimeline" && !c.filterColumn && (c.limit ?? 5) > 3) return { ...c, limit: 3 };
  if (c.type === "LassoNews" && !c.layout && c.limit > 3) return { ...c, limit: 3 };
  return null;
}

export interface BudgetOptions extends PackOptions {
  /** Sidens højdebudget i px (samme enhed som h). Udeladt eller Infinity: intet budget, alle elementer pakkes. */
  budget?: number;
  /**
   * Elementer, der altid er med i fuld form (hoved, nøgletalskort, svar-elementet, opfølgning).
   * Udeladt: fuldbåndstyperne (hoved, nøgletalskort, persontal, opfølgning) og det første øvrige element (svaret).
   */
  keep?: ReadonlySet<ViewComponent>;
}

export interface BudgetResult {
  bands: PackedBand[];
  /** Sidens højde (px): Σ båndhøjder + afstand mellem båndene. */
  height: number;
  /** Elementer, der er udeladt for at holde budgettet (i prioriteret rækkefølge). */
  dropped: ViewComponent[];
  /** Elementer, der står i kompakt form (originalerne). */
  compacted: ViewComponent[];
}

/** Sidens samlede højde for båndene (px). */
export function pageHeight(bands: readonly PackedBand[], gap = GRID_GAP): number {
  return bands.reduce((s, b) => s + b.height, 0) + Math.max(0, bands.length - 1) * gap;
}

/**
 * Båndpakning inden for et højdebudget (23.3, Paper L29-0 / gridmodel.md afsnit 4 trin 3). Input i
 * prioriteret rækkefølge = relevans (det sidste er mindst relevant). Deterministisk:
 * 1. Holder siden budgettet med alle elementer, pakkes den som før (packBands).
 * 2. Ellers vises alle elementer, der kan, i kompakt form (compactOf) – undtagen dem i `keep`.
 * 3. Er siden stadig over budgettet, udelades først genveje, så nyheder, så historik (LOW_RELEVANCE,
 *    også som stakfyld), derefter de mindst relevante elementer bagfra (blandt de 2 mindst relevante
 *    foretrækkes en udeladelse, der holder båndene inden for 15 %), til siden holder budgettet.
 * 4. Udeladte elementer prøves igen i prioritet, til det første, der ikke kan komme med: et mindre
 *    relevant element (genveje, nyheder, historik) kommer aldrig tilbage, mens et mere relevant (kontakt)
 *    er udeladt. Kompakte elementer får deres fulde form tilbage i prioritet, når siden holder budgettet
 *    og båndene står som før (samme elementer i de samme stakke).
 * Fra trin 2 pakkes siden med "ekstra stak" (absorbAlone): et element, der ellers står alene i et
 * fuldbånd (fx kontakt efter relationer | graf), lægges som ekstra stak i et tidligere delt bånd
 * (6+6 → 3+6+3), når det holder siden inden for budgettet. Stakkene strækkes, så der er 0 huller.
 * Hoved, nøgletalskort og svar-elementet er altid med i fuld form, også hvis de alene er over budgettet.
 */
export function packWithinBudget(items: readonly ViewComponent[], h: HeightFn, options: BudgetOptions = {}): BudgetResult {
  const gap = options.gap ?? GRID_GAP;
  const budget = options.budget ?? Number.POSITIVE_INFINITY;
  // Først uden ekstra stak (holder siden budgettet, pakkes den som før); derefter med (absorbAlone).
  let absorb = false;
  const pack = (list: readonly ViewComponent[]) => {
    let bands = packBands(list, h, options);
    if (absorb) bands = absorbAlone(bands, list, h, gap, { min: options.minWidth ?? defaultMinWidth });
    return { bands, height: pageHeight(bands, gap), deviation: Math.max(0, ...bands.map((b) => b.deviation)) };
  };
  // En ændring må ikke gøre båndene skæve: højst 15 % afvigelse, eller ikke værre end før.
  const even = (t: { deviation: number }, cur: { deviation: number }) => t.deviation <= Math.max(BAND_MAX_DEVIATION, cur.deviation) + 1e-9;
  let best = pack(items);
  if (!(best.height > budget)) return { bands: best.bands, height: best.height, dropped: [], compacted: [] };

  absorb = true;
  const keep = options.keep ?? defaultKeep(items);
  // Arbejdslisten: [original, vist element] i prioriteret rækkefølge; null = udeladt.
  const slots: { orig: ViewComponent; shown: ViewComponent | null }[] = items.map((c) => ({ orig: c, shown: keep.has(c) ? c : (compactOf(c) ?? c) }));
  const listOf = (s: typeof slots) => s.flatMap((x) => (x.shown ? [x.shown] : []));
  best = pack(listOf(slots));

  // 3a. Laveste relevans først (Paper 23.3): genveje, så nyheder, så historik udelades, før noget andet
  // element (fx kontakt) overvejes – også når genvejene kunne stå som stakfyld.
  for (const type of LOW_RELEVANCE) {
    if (!(best.height > budget)) break;
    slots.forEach((x, k) => {
      if (x.shown && x.orig.type === type && !keep.has(x.orig)) slots[k] = { ...x, shown: null };
    });
    best = pack(listOf(slots));
  }

  // 3b. Udelad bagfra, til siden holder budgettet. Først prøves de STRICT_WINDOW mindst relevante
  // elementer, og kun udeladelser, der holder båndene lige (højst 15 % afvigelse); findes ingen, den
  // mindst relevante, der gør siden lavere. Vinduet sikrer, at et vigtigt element aldrig ofres for et
  // mindre vigtigt bare for at få pænere bånd.
  while (best.height > budget) {
    let removed = false;
    for (const strict of [true, false]) {
      let seen = 0;
      for (let i = slots.length - 1; i >= 0 && !removed; i--) {
        const s = slots[i]!;
        if (!s.shown || keep.has(s.orig)) continue;
        if (strict && ++seen > STRICT_WINDOW) break;
        const trial = slots.map((x, k) => (k === i ? { ...x, shown: null } : x));
        const t = pack(listOf(trial));
        if (t.height < best.height && (!strict || even(t, best))) {
          slots[i] = trial[i]!;
          best = t;
          removed = true;
        }
      }
      if (removed) break;
    }
    if (!removed) break;
  }

  // 4a. Udeladte elementer tilbage i prioritet, til det første, der ikke kan komme med (så et mindre
  // relevant element aldrig står på siden, mens et mere relevant er udeladt).
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    if (s.shown || keep.has(s.orig)) continue;
    const shown = compactOf(s.orig) ?? s.orig;
    const trial = slots.map((x, k) => (k === i ? { ...x, shown } : x));
    const t = pack(listOf(trial));
    if (!(t.height <= budget && even(t, best))) break;
    slots[i] = trial[i]!;
    best = t;
  }
  // 4b. Fuld form tilbage i prioritet, når siden holder budgettet og båndene står som før (samme
  // elementer i de samme stakke): en længere liste må ikke flytte rundt på siden (Paper 23.3: profil
  // kompakt | oplysninger 6 rækker bliver stående, i stedet for at oplysningerne skubber relationerne op).
  const structure = (bands: readonly PackedBand[], list: readonly (typeof slots)[number][]) => {
    const slotOf = new Map<ViewComponent, number>();
    list.forEach((x, k) => x.shown && slotOf.set(x.shown, k));
    return bands.map((b) => b.stacks.map((st) => `${st.width}:${st.items.map((c) => slotOf.get(originOf(c)) ?? slotOf.get(c) ?? -1).join(",")}`).join("|")).join("/");
  };
  slots.forEach((s, i) => {
    if (!s.shown || s.shown === s.orig) return;
    const trial = slots.map((x, k) => (k === i ? { ...x, shown: x.orig } : x));
    const t = pack(listOf(trial));
    if (t.height <= budget && even(t, best) && structure(t.bands, trial) === structure(best.bands, slots)) {
      slots[i] = trial[i]!;
      best = t;
    }
  });
  return {
    bands: best.bands,
    height: best.height,
    dropped: slots.filter((s) => !s.shown).map((s) => s.orig),
    compacted: slots.filter((s) => s.shown && s.shown !== s.orig).map((s) => s.orig),
  };
}

/** Laveste relevans (Paper 23.3 "udeladt efter budget"): udelades i denne rækkefølge før alt andet. */
const LOW_RELEVANCE: readonly ViewComponent["type"][] = ["LassoShortcuts", "LassoNews", "LassoTimeline"];

/** Så mange af de mindst relevante elementer må springes over for at holde båndene lige (trin 3). */
const STRICT_WINDOW = 2;

/**
 * Største skønnede afvigelse for en ekstra stak (absorbAlone). Højere end de 15 %, fordi alternativet er
 * at udelade et mere relevant element (eller et fuldbånd med ét lille element); stakkene strækkes, så
 * siden stadig er uden huller (gridmodel 4e: er alle over 15 %, tages den laveste).
 */
export const ABSORB_MAX_DEVIATION = 0.25;

/**
 * Ekstra stak (højdebudget): et element, der står alene i et fuldbånd uden at være et fuldbåndselement
 * (hoved, nøgletal, tabeller), lægges i et delt nabobånd (først det foregående, så det næste), hvis båndets
 * elementer + elementet kan stå i én lovlig kombination (fx relationer ½ | graf ½ + kontakt → 3+6+3) og
 * båndet ikke bliver højere end før plus elementet alene. Prioriteten bestemmer stakkenes rækkefølge.
 */
function absorbAlone(bands: PackedBand[], list: readonly ViewComponent[], h: HeightFn, gap: number, ws: Widths): PackedBand[] {
  const out = [...bands];
  const rank = (c: ViewComponent) => list.indexOf(originOf(c));
  for (let i = 0; i < out.length; i++) {
    const b = out[i]!;
    if (b.stacks.length !== 1 || b.stacks[0]!.items.length !== 1) continue;
    const c = b.stacks[0]!.items[0]!;
    if (isFullBand(c, ws)) continue;
    // Nabobåndene: først det foregående delte bånd, så det næste.
    let pick: { j: number; cand: Candidate; height: number } | null = null;
    for (const j of [i - 1, i + 1]) {
      const nb = out[j];
      if (!nb || nb.stacks.length < 2 || pick) continue;
      const subset = [...nb.stacks.flatMap((s) => s.items.map(originOf)), c].sort((x, z) => rank(x) - rank(z));
      let cand: Candidate | null = null;
      // Alle kombinationer med alle elementerne (ikke kun bestBand's bedste, der foretrækker ≤ 15 % med færre elementer).
      subset.forEach((a, k) => {
        const widths = sharedWidthsOf(a, ws);
        BAND_COMBOS.forEach((combo, comboIndex) => {
          if (combo.length < nb.stacks.length) return;
          combo.forEach((cols, slot) => {
            if (!widths.has(cols)) return;
            const x = fillBand(combo, comboIndex, slot, subset, k, h, gap, ws);
            if (x && x.used.size === subset.length && (!cand || better(x, cand))) cand = x;
          });
        });
      });
      const chosen = cand as Candidate | null;
      if (!chosen || chosen.deviation > ABSORB_MAX_DEVIATION + 1e-9) continue;
      const height = Math.max(...chosen.stacks.map((s) => s.height));
      if (height < nb.height + b.height) pick = { j, cand: chosen, height };
    }
    if (!pick) continue;
    out[pick.j] = { stacks: pick.cand.stacks, height: pick.height, deviation: pick.cand.deviation };
    out.splice(i, 1);
    i--;
  }
  return out;
}

/** Standard for `keep`: fuldbåndstyperne (hoved, nøgletalskort, persontal, opfølgning) og det første øvrige element (svaret). */
function defaultKeep(items: readonly ViewComponent[]): Set<ViewComponent> {
  const keep = new Set(items.filter((c) => FULL_BAND_TYPES.has(c.type)));
  const answer = items.find((c) => !FULL_BAND_TYPES.has(c.type));
  if (answer) keep.add(answer);
  return keep;
}
