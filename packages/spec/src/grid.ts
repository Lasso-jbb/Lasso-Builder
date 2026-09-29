import { gridRuleOf, type GridRule } from "./catalog.js";
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
  LassoCompanyHead: [113, 95, 107, 87, 87, 87],
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
  LassoScoreGauge: [140, 140, 302, 302, 302, 302],
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
  LassoPersonHead: [128, 110, 107, 107, 87, 87],
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

function isFullBand(c: ViewComponent): boolean {
  // En eksplicit bredde vinder (render_view, fx mønster 7: analyse ¾ + nøgletal ¼).
  if (c.width) return c.width === "full";
  if (FULL_BAND_TYPES.has(c.type)) return true;
  return gridRuleOf(c).min === "full";
}

/** Må elementet stå i bredden? En eksplicit width låser bredden; ellers gælder elementets min/max. */
export function fitsWidth(c: ViewComponent, width: Width): boolean {
  if (c.width) return c.width === width;
  return allowsWidth(gridRuleOf(c), width);
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
  if (c.type === "LassoKeyValueList") return { ...c, rows: n };
  if (c.type === "LassoTimeline" && !c.filterColumn) return { ...c, limit: n };
  if (c.type === "LassoNews") return { ...c, limit: n };
  return null;
}
function currentRows(c: ViewComponent): number {
  if (c.type === "LassoKeyValueList") return c.rows ?? 12;
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
function fillBand(combo: readonly number[], comboIndex: number, slot: number, rest: readonly ViewComponent[], anchorIndex: number, h: HeightFn, GAP: number): Candidate | null {
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
      if (!used.has(k) && !isFullBand(c) && fitsWidth(c, s.width)) eligible.push(k);
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
  const widthPenalty = stacks.reduce((sum, s) => sum + s.items.reduce((a, c) => a + Math.abs(WIDTH_COLUMNS[s.width] - WIDTH_COLUMNS[c.width ?? gridRuleOf(c).std]), 0), 0);
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
function bestBand(rest: readonly ViewComponent[], anchorIndex: number, h: HeightFn, gap: number): Candidate | null {
  const anchor = rest[anchorIndex]!;
  const rule = gridRuleOf(anchor);
  // Ankeret prøves i sin standardbredde (eller sin eksplicitte width) og i de øvrige tilladte bredder;
  // widthPenalty gør, at standardbredden vinder, når den giver et bånd inden for 15 %.
  const explicit = anchor.width && anchor.width !== "full" ? anchor.width : undefined;
  const widths = new Set((explicit ? [explicit] : WIDTHS.filter((w) => w !== "full" && allowsWidth(rule, w))).map((w) => WIDTH_COLUMNS[w]));
  let best: Candidate | null = null;
  BAND_COMBOS.forEach((combo, comboIndex) => {
    if (combo.length < 2) return;
    combo.forEach((c, slot) => {
      if (!widths.has(c)) return;
      const cand = fillBand(combo, comboIndex, slot, rest, anchorIndex, h, gap);
      if (cand && (!best || better(cand, best))) best = cand;
    });
  });
  return best;
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
}

export function packBands(items: readonly ViewComponent[], h: HeightFn, options: PackOptions = {}): PackedBand[] {
  const gap = options.gap ?? GRID_GAP;
  const bands: PackedBand[] = [];
  let rest = [...items];
  while (rest.length > 0) {
    const first = rest[0]!;
    if (isFullBand(first)) {
      bands.push(fullBand(first, h));
      rest = rest.slice(1);
      continue;
    }
    let chosen = bestBand(rest, 0, h, gap);
    // Også når båndet kun holder 15 % ved at skære rækker væk: et højt anker længere fremme kan give et bånd uden.
    if (!chosen || chosen.deviation > BAND_MAX_DEVIATION || chosen.shrunk > 0) {
      for (let k = 1; k < rest.length && k <= ANCHOR_LOOKAHEAD; k++) {
        const c = rest[k]!;
        if (isFullBand(c) || !TALL.has(gridRuleOf(c).height)) continue;
        const alt = bestBand(rest, k, h, gap);
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
      if (prev && prev.stacks.length > 1 && stakfyld(prev, first, h, gap)) continue;
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
function stakfyld(band: PackedBand, c: ViewComponent, h: HeightFn, gap: number): boolean {
  const heightOf = (items: readonly ViewComponent[], w: Width) => items.reduce((sum, x, i) => sum + (i > 0 ? gap : 0) + h(x, w), 0);
  let best: { stacks: ViewComponent[][]; deviation: number } | null = null;
  const consider = (stacks: ViewComponent[][]) => {
    const hs = stacks.map((items, i) => heightOf(items, band.stacks[i]!.width));
    const max = Math.max(...hs);
    const deviation = (max - Math.min(...hs)) / max;
    if (!best || deviation < best.deviation - 1e-9) best = { stacks, deviation };
  };
  band.stacks.forEach((s, i) => {
    if (!fitsWidth(c, s.width)) return;
    consider(band.stacks.map((x, k) => (k === i ? [...x.items, c] : [...x.items])));
    s.items.forEach((y, yi) => {
      if (yi === 0) return;
      band.stacks.forEach((t, j) => {
        if (j === i || !fitsWidth(y, t.width)) return;
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
