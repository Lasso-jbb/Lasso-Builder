import { formatShare, type OwnershipEdgeVM, type OwnershipGraphVM, type OwnershipNodeVM } from "@lasso/spec";

/**
 * Layout af ejerdiagrammet (katalog 14 og 14b). Ren TypeScript uden React, så
 * algoritmen kan testes for sig.
 *
 * Trin:
 *  1. Normalisering: sortering efter id (samme input i anden rækkefølge giver samme tegning),
 *     dubletter og selvløkker fjernes, ophørte ejerskaber skjules, medmindre historik er slået til.
 *  2. Cykler: stærkt sammenhængende komponenter (Tarjan, iterativ). En kant inden for en
 *     komponent, der ikke peger nedad i lagene, er en tilbage-kant og tegnes i koral stiplet udenom.
 *  3. Lag: bredde-først fra roden, ejere i negative lag (op), datterselskaber i positive (ned).
 *     Hver node besøges én gang, så cirkulært ejerskab aldrig giver en uendelig løkke.
 *  4. Foldning af kæder: over 5 led i én retning med én ejer pr. led foldes mellemleddene
 *     til én "+N mellemled"-node. Nærmeste led og de to yderste vises altid.
 *  5. Loft pr. lag: over 5 noder i et lag samles de mindste andele i "+N flere". Fokusvirksomhedens
 *     direkte ejere foldes aldrig.
 *  6. Loft over hele strukturen (maxNodes): de nærmeste lag vises først, resten tælles som skjult.
 *  7. Rækkefølge i lagene: barycenter-heuristik med et par gennemløb op og ned, stabil sortering.
 *  8. Koordinater: lag med 90 px luft, noder med 14 px mellemrum, hver række centreres under
 *     de noder, den hænger på; roden står i x = 0.
 *  9. Kanter: ortogonale med en vandret "bus" 52 px under ejerlaget. Kanter, der ikke går ét lag
 *     ned (cykler, spring over lag), føres udenom på højre side i hver sin bane.
 */

export const NODE_W = 196;
export const NODE_H = 64;
export const PERSON_H = 48;
export const ROOT_W = 220;
export const ROOT_H = 72;
export const LAYER_GAP = 90;
export const NODE_GAP = 14;
export const BUS_OFFSET = 52;
export const LABEL_OFFSET = 22;
export const LANE_GAP = 20;
export const PADDING = 24;
export const LAYER_CAP = 5;
export const CHAIN_FOLD_OVER = 5;
export const DEFAULT_MAX_NODES = 40;

export type Direction = "both" | "up" | "down";

export interface LayoutOptions {
  direction?: Direction;
  /** Lag op/ned, der vises (højst det hentede). */
  depthUp?: number;
  depthDown?: number;
  /** Loft over antal noder. Infinity = hele strukturen. */
  maxNodes?: number;
  layerCap?: number;
  /** "Udvid alle": ingen foldning af kæder eller lag. */
  expandAll?: boolean;
  /** Id'er på foldede noder ("chain:…", "group:…"), der er foldet ud. */
  expanded?: ReadonlySet<string>;
  showHistoric?: boolean;
  /** Dato for øjebliksbilledet (ÅÅÅÅ-MM-DD); bruges til at afgøre, om et ejerskab er ophørt. */
  onDate?: string;
}

export type LayoutNodeKind = "person" | "company" | "chain" | "group" | "unknown";

export interface LayoutNode {
  id: string;
  kind: LayoutNodeKind;
  layer: number;
  x: number;
  y: number;
  w: number;
  h: number;
  root: boolean;
  ceased: boolean;
  /** Enheden bag en person- eller selskabsnode. */
  entity?: OwnershipNodeVM;
  /** Foldede noder: antal og de skjulte id'er. */
  count?: number;
  members?: string[];
  title: string;
  subtitle?: string;
}

export interface LabelLine {
  text: string;
  tone: "share" | "votes" | "cycle" | "muted";
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  /** tree = ét lag ned ad bussen; side = udenom på højre side. */
  route: "tree" | "side";
  style: "solid" | "dashed" | "cycle";
  points: [number, number][];
  label?: { x: number; y: number; lines: LabelLine[] };
  edge?: OwnershipEdgeVM;
}

export interface OwnershipLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  minLayer: number;
  maxLayer: number;
  /** Enheder i grafen efter normalisering (uden syntetiske noder). */
  totalCount: number;
  /** Enheder, der ikke er tegnet på grund af maxNodes. */
  hiddenCount: number;
  /** Cykler som lister af id'er (hver med mindst to led). */
  cycles: string[][];
  hasOwners: boolean;
  hasSubsidiaries: boolean;
  /** Alle ejere over roden er personer, og der er ingen datterselskaber. */
  onlyPersons: boolean;
  /** Dybden, grafen faktisk rækker (efter lagdeling uden loft). */
  availableUp: number;
  availableDown: number;
}

/* ------------------------------------------------------------------ */
/* Hjælpere                                                            */
/* ------------------------------------------------------------------ */

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const hiShare = (e: OwnershipEdgeVM | undefined) => e?.share?.[1] ?? -1;
const loShare = (e: OwnershipEdgeVM | undefined) => e?.share?.[0] ?? -1;

function isHistoric(e: OwnershipEdgeVM, onDate: string | undefined): boolean {
  if (!e.until) return false;
  const ref = onDate ?? new Date().toISOString().slice(0, 10);
  return e.until.slice(0, 10) <= ref;
}

function sameShare(a?: [number, number], b?: [number, number]): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a[0] - b[0]) < 0.005 && Math.abs(a[1] - b[1]) < 0.005;
}

export function isCeased(n: OwnershipNodeVM | undefined): boolean {
  return n?.statusKind === "inactive";
}

/** Normaliseret graf: sorteret, uden dubletter, selvløkker og kanter til ukendte noder. */
export function normalizeGraph(graph: OwnershipGraphVM, opts: Pick<LayoutOptions, "showHistoric" | "onDate"> = {}) {
  const nodes = new Map<string, OwnershipNodeVM>();
  for (const n of [...graph.nodes].sort((a, b) => byString(a.id, b.id))) if (!nodes.has(n.id)) nodes.set(n.id, n);
  const seen = new Set<string>();
  const edges: OwnershipEdgeVM[] = [];
  const sorted = [...graph.edges].sort((a, b) => byString(a.from, b.from) || byString(a.to, b.to) || byString(a.until ?? "", b.until ?? ""));
  for (const e of sorted) {
    if (e.from === e.to || !nodes.has(e.from) || !nodes.has(e.to)) continue;
    if (!opts.showHistoric && isHistoric(e, opts.onDate ?? graph.onDate)) continue;
    const key = `${e.from}>${e.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(e);
  }
  const out = new Map<string, OwnershipEdgeVM[]>();
  const inn = new Map<string, OwnershipEdgeVM[]>();
  for (const e of edges) {
    (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(e);
    (inn.get(e.to) ?? inn.set(e.to, []).get(e.to)!).push(e);
  }
  return { nodes, edges, out, inn };
}

/**
 * Stærkt sammenhængende komponenter (Tarjan), iterativt så dybe grafer ikke
 * sprænger stakken. Returnerer komponent-nummer pr. node og cyklerne (≥ 2 led).
 */
export function findCycles(ids: readonly string[], out: ReadonlyMap<string, readonly OwnershipEdgeVM[]>): { component: Map<string, number>; cycles: string[][] } {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const component = new Map<string, number>();
  const cycles: string[][] = [];
  let counter = 0;
  let compNo = 0;

  for (const start of ids) {
    if (index.has(start)) continue;
    const work: { id: string; next: number }[] = [{ id: start, next: 0 }];
    index.set(start, counter);
    low.set(start, counter++);
    stack.push(start);
    onStack.add(start);
    while (work.length) {
      const frame = work[work.length - 1]!;
      const succ = out.get(frame.id) ?? [];
      if (frame.next < succ.length) {
        const w = succ[frame.next++]!.to;
        if (!index.has(w)) {
          index.set(w, counter);
          low.set(w, counter++);
          stack.push(w);
          onStack.add(w);
          work.push({ id: w, next: 0 });
        } else if (onStack.has(w)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, index.get(w)!));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1]!.id;
        low.set(parent, Math.min(low.get(parent)!, low.get(frame.id)!));
      }
      if (low.get(frame.id) === index.get(frame.id)) {
        const members: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.set(w, compNo);
          members.push(w);
        } while (w !== frame.id);
        if (members.length > 1) cycles.push(members.sort(byString));
        compNo++;
      }
    }
  }
  cycles.sort((a, b) => byString(a[0]!, b[0]!));
  return { component, cycles };
}

/**
 * Bredde-først i én retning. Gemmer afstand og styrke (produktet af andelene langs
 * den stærkeste korteste sti; ukendt andel tæller som 1 %).
 */
function bfs(
  rootId: string,
  next: ReadonlyMap<string, readonly OwnershipEdgeVM[]>,
  upward: boolean,
  depth: number,
  skip: (id: string) => boolean,
): Map<string, { d: number; strength: number }> {
  const seen = new Map<string, { d: number; strength: number }>([[rootId, { d: 0, strength: 1 }]]);
  let frontier = [rootId];
  for (let d = 1; d <= depth && frontier.length; d++) {
    const nextFrontier: string[] = [];
    for (const id of frontier) {
      const base = seen.get(id)!.strength;
      for (const e of next.get(id) ?? []) {
        const other = upward ? e.from : e.to;
        if (skip(other)) continue;
        const strength = (base * (e.share?.[1] ?? 1)) / 100;
        const hit = seen.get(other);
        if (hit) {
          if (hit.d === d && strength > hit.strength) hit.strength = strength;
          continue;
        }
        seen.set(other, { d, strength });
        nextFrontier.push(other);
      }
    }
    frontier = nextFrontier;
  }
  return seen;
}

/**
 * Lag efter afstand fra roden: ejere i negative lag, datterselskaber i positive.
 * Hver node får ét lag, så cykler stopper af sig selv. En node, der både er ejer og
 * datter (cirkulært), lægges på den side, hvor forbindelsen er stærkest (produktet af
 * andelene): et 100 % ejet datterselskab, der ejer 5 % af roden, står under roden (14),
 * og Alfa, der ejer 60 % af Beta, der ejer 51 % af Fokus, står over Fokus (14b).
 * Derefter gennemløbes hver side igen uden at gå gennem noder, der hører til den anden.
 */
export function assignLayers(
  rootId: string,
  out: ReadonlyMap<string, readonly OwnershipEdgeVM[]>,
  inn: ReadonlyMap<string, readonly OwnershipEdgeVM[]>,
  depthUp: number,
  depthDown: number,
  allowed?: ReadonlySet<string>,
): Map<string, number> {
  const ok = (id: string) => (allowed ? allowed.has(id) : true);
  const up1 = bfs(rootId, inn, true, depthUp, (id) => !ok(id));
  const down1 = bfs(rootId, out, false, depthDown, (id) => !ok(id));
  const side = new Map<string, "up" | "down">();
  for (const [id, u] of up1) {
    const d = down1.get(id);
    if (id === rootId || !d) continue;
    const upWins = u.strength > d.strength + 1e-12 || (Math.abs(u.strength - d.strength) <= 1e-12 && u.d <= d.d);
    side.set(id, upWins ? "up" : "down");
  }
  const up = bfs(rootId, inn, true, depthUp, (id) => !ok(id) || side.get(id) === "down");
  const down = bfs(rootId, out, false, depthDown, (id) => !ok(id) || side.get(id) === "up" || up.has(id));
  const layer = new Map<string, number>([[rootId, 0]]);
  for (const [id, v] of up) if (id !== rootId) layer.set(id, -v.d);
  for (const [id, v] of down) if (id !== rootId && !layer.has(id)) layer.set(id, v.d);
  return layer;
}

/* ------------------------------------------------------------------ */
/* Arbejdsgraf med syntetiske noder                                    */
/* ------------------------------------------------------------------ */

interface WNode {
  id: string;
  kind: LayoutNodeKind;
  entity?: OwnershipNodeVM;
  count?: number;
  members?: string[];
  title: string;
  subtitle?: string;
  /** Sorteringsvægt til første rækkefølge (største andel først). */
  weight: number;
}

interface WEdge {
  id: string;
  from: string;
  to: string;
  edge?: OwnershipEdgeVM;
  /** Stiplet: ophørt ejerskab eller ukendt ejer. */
  dashed: boolean;
  lines?: LabelLine[];
  /** Antal led i den cykel, kanten indgår i (0 = ingen cykel). */
  cycleSize: number;
}

function shareLines(e: OwnershipEdgeVM | undefined, historic: boolean): LabelLine[] | undefined {
  if (!e?.share && !e?.votes) return undefined;
  const share = e.share ? formatShare(e.share) : undefined;
  const prefix = e.classes ? `${e.classes}: ` : "";
  const suffix = historic && e.until ? `, til ${e.until.slice(0, 4)}` : "";
  if (e.votes && share && !sameShare(e.share, e.votes)) {
    return [
      { text: `Ejer ${prefix}${share}${suffix}`, tone: "share" },
      { text: `Stemmer ${formatShare(e.votes)}`, tone: "votes" },
    ];
  }
  return [{ text: `${prefix}${share ?? formatShare(e.votes)}${suffix}`, tone: "share" }];
}

function entityNode(n: OwnershipNodeVM, weight: number): WNode {
  return { id: n.id, kind: n.kind, entity: n, title: n.name, subtitle: entitySubtitle(n), weight };
}

/** Undertekst under navnet: "CVR 32343554, ApS", "Person", "Udenlandsk, Norge", "Ophørt". */
export function entitySubtitle(n: OwnershipNodeVM): string {
  if (n.kind === "person") return "Person";
  if (n.country && n.country.toUpperCase() !== "DK") return [n.registrationNo ? `Reg.nr. ${n.registrationNo}` : "Udenlandsk", countryName(n.country)].join(", ");
  if (isCeased(n)) return n.status ?? "Ophørt";
  return [n.cvr ? `CVR ${n.cvr}` : undefined, n.form].filter(Boolean).join(", ") || (n.status ?? "Virksomhed");
}

const COUNTRIES: Record<string, string> = { NO: "Norge", SE: "Sverige", DE: "Tyskland", FI: "Finland", GB: "Storbritannien", UK: "Storbritannien", NL: "Holland", US: "USA", FR: "Frankrig", CH: "Schweiz", LU: "Luxembourg", IS: "Island", PL: "Polen", BE: "Belgien", ES: "Spanien", IE: "Irland" };
export function countryName(code: string): string {
  return COUNTRIES[code.toUpperCase()] ?? code.toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Hovedfunktionen                                                     */
/* ------------------------------------------------------------------ */

export function layoutOwnership(graph: OwnershipGraphVM, options: LayoutOptions = {}): OwnershipLayout {
  const direction = options.direction ?? "both";
  const cap = options.layerCap ?? LAYER_CAP;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const expanded = options.expanded ?? new Set<string>();
  const expandAll = options.expandAll ?? false;
  const onDate = options.onDate ?? graph.onDate;
  const { nodes, edges, out, inn } = normalizeGraph(graph, { showHistoric: options.showHistoric, onDate });
  const rootId = graph.rootId;
  const rootEntity: OwnershipNodeVM = nodes.get(rootId) ?? { id: rootId, name: rootId, kind: "company", root: true };
  if (!nodes.has(rootId)) nodes.set(rootId, rootEntity);

  const { component, cycles } = findCycles([...nodes.keys()], out);
  const cycleSize = (e: OwnershipEdgeVM) =>
    component.get(e.from) === component.get(e.to) ? (cycles.find((c) => c.includes(e.from))?.length ?? 0) : 0;

  // 3. Lag. Først uden loft for at kende den tilgængelige dybde, derefter med det valgte loft.
  const upDepth = direction === "down" ? 0 : Math.max(0, options.depthUp ?? graph.ingoingDepth ?? 2);
  const downDepth = direction === "up" ? 0 : Math.max(0, options.depthDown ?? graph.outgoingDepth ?? 1);
  const full = assignLayers(rootId, out, inn, 50, 50);
  const availableUp = -Math.min(0, ...full.values());
  const availableDown = Math.max(0, ...full.values());
  let layer = assignLayers(rootId, out, inn, upDepth, downDepth);
  const totalCount = layer.size;

  const work = new Map<string, WNode>();
  for (const id of layer.keys()) {
    const n = nodes.get(id)!;
    work.set(id, entityNode(n, 0));
  }
  let wedges: WEdge[] = edges
    .filter((e) => layer.has(e.from) && layer.has(e.to))
    .map((e) => {
      const historic = isHistoric(e, onDate);
      return { id: `${e.from}>${e.to}`, from: e.from, to: e.to, edge: e, dashed: historic, lines: shareLines(e, historic), cycleSize: cycleSize(e) };
    });

  const isTree = (e: WEdge, L: Map<string, number>) => {
    const a = L.get(e.from)!;
    const b = L.get(e.to)!;
    if (b !== a + 1) return false;
    return b <= 0 || a >= 0;
  };

  // 4. Foldning af lange kæder med én ejer pr. led.
  if (!expandAll) {
    const folded = foldChains(work, wedges, layer, rootId, expanded, isTree);
    if (folded) {
      wedges = folded.edges;
      layer = relayer(rootId, work, wedges);
    }
  }

  // 5. Loft pr. lag.
  if (!expandAll) {
    const grouped = capLayers(work, wedges, layer, rootId, cap, expanded, isTree);
    if (grouped) {
      wedges = grouped.edges;
      layer = relayer(rootId, work, wedges);
    }
  }

  // Ukendt ejerskab: summen af andele under 5 % som én stiplet node blandt de direkte ejere.
  if (direction !== "down" && upDepth > 0) {
    const direct = wedges.filter((e) => e.to === rootId && e.edge?.share && layer.get(e.from) === -1);
    if (direct.length > 0) {
      const sumMax = direct.reduce((s, e) => s + (e.edge!.share![1] ?? 0), 0);
      const sumMin = direct.reduce((s, e) => s + (e.edge!.share![0] ?? 0), 0);
      if (sumMax < 99.99 && sumMin < 100) {
        const rest = Math.max(0, 100 - sumMin);
        const id = "unknown:owners";
        work.set(id, { id, kind: "unknown", title: "Ukendt ejer", subtitle: "Ikke registreret", weight: -1 });
        layer.set(id, -1);
        wedges.push({ id: `${id}>${rootId}`, from: id, to: rootId, dashed: true, lines: [{ text: `≤ ${formatShare([rest, rest])}`, tone: "muted" }], cycleSize: 0 });
      }
    }
  }

  // 6. Loft over hele strukturen: nærmeste lag først.
  let hiddenCount = 0;
  if (layer.size > maxNodes) {
    const order = [...layer.entries()].sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]) || (a[1] < 0 ? -1 : 1) - (b[1] < 0 ? -1 : 1) || byString(a[0], b[0]));
    const keep = new Set(order.slice(0, Math.max(1, maxNodes)).map(([id]) => id));
    // Sørg for at hver beholdt node stadig hænger sammen med roden.
    const reach = assignLayersW(rootId, wedges.filter((e) => keep.has(e.from) && keep.has(e.to)));
    for (const id of [...keep]) if (!reach.has(id)) keep.delete(id);
    const dropped = [...layer.keys()].filter((id) => !keep.has(id));
    hiddenCount += dropped.reduce((s, id) => s + (work.get(id)?.count ?? (work.get(id)?.entity ? 1 : 0)), 0);
    for (const id of dropped) {
      layer.delete(id);
      work.delete(id);
    }
    wedges = wedges.filter((e) => keep.has(e.from) && keep.has(e.to));
  }

  // 7. Rækkefølge i lagene.
  const weightOf = new Map<string, number>();
  for (const e of wedges) {
    const a = layer.get(e.from)!;
    const b = layer.get(e.to)!;
    // Vægt = andelen ind mod roden.
    if (b <= 0 && b === a + 1) weightOf.set(e.from, Math.max(weightOf.get(e.from) ?? -1, hiShare(e.edge)));
    if (a >= 0 && b === a + 1) weightOf.set(e.to, Math.max(weightOf.get(e.to) ?? -1, hiShare(e.edge)));
  }
  for (const [id, n] of work) if (n.entity) n.weight = weightOf.get(id) ?? -1;
  const rows = orderLayers(work, wedges, layer, isTree);

  // 8. Koordinater.
  const positioned = placeNodes(rows, work, wedges, layer, isTree);

  // 9. Kanter.
  const { edges: routed, right } = routeEdges(positioned, wedges, layer, isTree);

  // Normalisér, så alt ligger inden for (PADDING, PADDING).
  const all = [...positioned.values()];
  const minX = Math.min(...all.map((n) => n.x), ...routed.flatMap((e) => (e.label ? [e.label.x - labelWidth(e.label.lines) / 2] : [])));
  const minY = Math.min(...all.map((n) => n.y));
  const dx = PADDING - minX;
  const dy = PADDING - minY;
  for (const n of all) {
    n.x += dx;
    n.y += dy;
  }
  let maxX = Math.max(...all.map((n) => n.x + n.w), right + dx);
  for (const e of routed) {
    e.points = e.points.map(([x, y]) => [x + dx, y + dy]);
    if (e.label) {
      e.label.x += dx;
      e.label.y += dy;
      maxX = Math.max(maxX, e.label.x + labelWidth(e.label.lines) / 2);
    }
  }
  const maxY = Math.max(...all.map((n) => n.y + n.h));
  const layers = [...layer.values()];

  const ownersOfRoot = edges.filter((e) => e.to === rootId);
  const subsOfRoot = edges.filter((e) => e.from === rootId);
  return {
    nodes: all.sort((a, b) => a.layer - b.layer || a.x - b.x),
    edges: routed,
    width: Math.ceil(maxX + PADDING),
    height: Math.ceil(maxY + PADDING),
    minLayer: Math.min(0, ...layers),
    maxLayer: Math.max(0, ...layers),
    totalCount,
    hiddenCount,
    cycles,
    hasOwners: ownersOfRoot.length > 0,
    hasSubsidiaries: subsOfRoot.length > 0,
    onlyPersons: ownersOfRoot.length > 0 && subsOfRoot.length === 0 && ownersOfRoot.every((e) => nodes.get(e.from)?.kind === "person"),
    availableUp,
    availableDown,
  };
}

/** Lag for arbejdsgrafen (efter foldning), uden dybdeloft. */
function assignLayersW(rootId: string, wedges: readonly WEdge[]): Map<string, number> {
  const out = new Map<string, OwnershipEdgeVM[]>();
  const inn = new Map<string, OwnershipEdgeVM[]>();
  for (const e of wedges) {
    // Andelen følger med, så en cirkulær node havner på samme side som før foldningen.
    const x: OwnershipEdgeVM = { from: e.from, to: e.to, share: e.edge?.share ?? [100, 100] };
    (out.get(e.from) ?? out.set(e.from, []).get(e.from)!).push(x);
    (inn.get(e.to) ?? inn.set(e.to, []).get(e.to)!).push(x);
  }
  return assignLayers(rootId, out, inn, 1000, 1000);
}

function relayer(rootId: string, work: Map<string, WNode>, wedges: WEdge[]): Map<string, number> {
  const layer = assignLayersW(rootId, wedges);
  for (const id of [...work.keys()]) if (!layer.has(id)) work.delete(id);
  return layer;
}

/* ------------------------------------------------------------------ */
/* 4. Kæder                                                            */
/* ------------------------------------------------------------------ */

function foldChains(
  work: Map<string, WNode>,
  wedges: WEdge[],
  layer: Map<string, number>,
  rootId: string,
  expanded: ReadonlySet<string>,
  isTree: (e: WEdge, L: Map<string, number>) => boolean,
): { edges: WEdge[] } | null {
  const tree = wedges.filter((e) => e.cycleSize === 0 && isTree(e, layer));
  const ownersOf = new Map<string, WEdge[]>();
  const ownedBy = new Map<string, WEdge[]>();
  // Grader tælles over ALLE synlige kanter, så en node med en ekstra (fx cirkulær) kant ikke foldes.
  for (const e of wedges) {
    (ownersOf.get(e.to) ?? ownersOf.set(e.to, []).get(e.to)!).push(e);
    (ownedBy.get(e.from) ?? ownedBy.set(e.from, []).get(e.from)!).push(e);
  }
  const treeSet = new Set(tree);
  /** Næste led i kæden fra id, i retningen væk fra roden, eller null. */
  const step = (id: string, up: boolean): WEdge | null => {
    const toward = up ? ownersOf.get(id) ?? [] : ownedBy.get(id) ?? [];
    if (toward.length !== 1) return null;
    const e = toward[0]!;
    if (!treeSet.has(e)) return null;
    const next = up ? e.from : e.to;
    const back = up ? ownedBy.get(next) ?? [] : ownersOf.get(next) ?? [];
    return back.length === 1 ? e : null;
  };

  const inChain = new Set<string>();
  const remove = new Set<string>();
  const added: WEdge[] = [];
  const ids = [...layer.keys()].sort((a, b) => Math.abs(layer.get(a)!) - Math.abs(layer.get(b)!) || byString(a, b));
  for (const start of ids) {
    for (const up of [true, false]) {
      const L = layer.get(start)!;
      if (up ? L > 0 : L < 0) continue;
      if (inChain.has(start) && start !== rootId) continue;
      const links: WEdge[] = [];
      let cur = start;
      for (let guard = 0; guard < 1000; guard++) {
        const e = step(cur, up);
        if (!e) break;
        const next = up ? e.from : e.to;
        if (inChain.has(next)) break;
        links.push(e);
        cur = next;
      }
      // Led = noderne over/under start. Over 5 led foldes; nærmeste og de to yderste vises.
      const chain = links.map((e) => (up ? e.from : e.to));
      if (chain.length <= CHAIN_FOLD_OVER) continue;
      const hide = chain.slice(1, chain.length - 2);
      const id = `chain:${hide[0]}`;
      chain.forEach((c) => inChain.add(c));
      if (expanded.has(id)) continue;
      const hiddenEdges = links.slice(1, links.length - 2 + 1); // kanterne rundt om de skjulte led
      const inner = links[1]!; // fra første skjulte led ind mod nærmeste led
      const outer = links[links.length - 2]!; // fra yderste viste led ud til sidste skjulte
      const allSame = hiddenEdges.every((e) => sameShare(e.edge?.share, inner.edge?.share));
      const layersHidden = hide.map((h) => Math.abs(layer.get(h)!));
      const share = inner.edge?.share ? formatShare(inner.edge.share) : undefined;
      work.set(id, {
        id,
        kind: "chain",
        count: hide.length,
        members: hide,
        title: `${hide.length} mellemled foldet`,
        subtitle: `Lag ${Math.min(...layersHidden)}–${Math.max(...layersHidden)}${allSame && share ? `, ${share} hele vejen` : ""}`,
        weight: hiShare(inner.edge),
      });
      hide.forEach((h) => remove.add(h));
      const near = chain[0]!;
      const far = chain[chain.length - 2]!;
      // Opad: fold ejer det nærmeste led, det yderste viste led ejer fold. Nedad omvendt.
      added.push(
        up
          ? { id: `${id}>${near}`, from: id, to: near, edge: inner.edge, dashed: inner.dashed, lines: inner.lines, cycleSize: 0 }
          : { id: `${near}>${id}`, from: near, to: id, edge: inner.edge, dashed: inner.dashed, lines: inner.lines, cycleSize: 0 },
        up
          ? { id: `${far}>${id}`, from: far, to: id, edge: outer.edge, dashed: outer.dashed, lines: outer.lines, cycleSize: 0 }
          : { id: `${id}>${far}`, from: id, to: far, edge: outer.edge, dashed: outer.dashed, lines: outer.lines, cycleSize: 0 },
      );
    }
  }
  if (remove.size === 0) return null;
  for (const id of remove) work.delete(id);
  return { edges: [...wedges.filter((e) => !remove.has(e.from) && !remove.has(e.to)), ...added] };
}

/* ------------------------------------------------------------------ */
/* 5. Loft pr. lag                                                     */
/* ------------------------------------------------------------------ */

function capLayers(
  work: Map<string, WNode>,
  wedges: WEdge[],
  layer: Map<string, number>,
  rootId: string,
  cap: number,
  expanded: ReadonlySet<string>,
  isTree: (e: WEdge, L: Map<string, number>) => boolean,
): { edges: WEdge[] } | null {
  let changed = false;
  let edges = wedges;
  let L = layer;
  const maxAbs = Math.max(0, ...[...L.values()].map(Math.abs));
  for (let d = 1; d <= maxAbs; d++) {
    for (const sign of [-1, 1]) {
      const l = sign * d;
      const id = `group:${l}`;
      if (expanded.has(id)) continue;
      const members = [...L.entries()].filter(([n, v]) => v === l && work.get(n)?.entity).map(([n]) => n);
      // Fokusvirksomhedens direkte ejere foldes aldrig.
      const candidates = members.filter((n) => !(l === -1 && edges.some((e) => e.from === n && e.to === rootId)));
      const room = cap - (members.length - candidates.length);
      if (members.length <= cap || candidates.length < 2 || room >= candidates.length) continue;
      // Kanten ind mod roden afgør, hvor stor andelen er.
      const inward = (n: string) => edges.filter((e) => isTree(e, L) && (sign < 0 ? e.from === n : e.to === n));
      const weight = (n: string) => Math.max(-1, ...inward(n).map((e) => hiShare(e.edge)));
      const ranked = [...candidates].sort((a, b) => weight(b) - weight(a) || byString(work.get(a)!.title, work.get(b)!.title) || byString(a, b));
      const keepCount = Math.max(0, room - 1);
      const fold = ranked.slice(keepCount).sort(byString);
      if (fold.length < 2) continue;
      const foldSet = new Set(fold);
      const inEdges = fold.flatMap(inward);
      // Gruppen hænger på den nabo, flest af de foldede hænger på.
      const tally = new Map<string, number>();
      for (const e of inEdges) {
        const nb = sign < 0 ? e.to : e.from;
        tally.set(nb, (tally.get(nb) ?? 0) + 1);
      }
      const anchor = [...tally.entries()].sort((a, b) => b[1] - a[1] || byString(a[0], b[0]))[0]?.[0];
      if (!anchor) continue;
      const shares = inEdges.map((e) => e.edge?.share).filter((s): s is [number, number] => Boolean(s));
      const same = shares.length === inEdges.length && shares.every((s) => sameShare(s, shares[0]));
      const shareText = shares.length
        ? same
          ? `${formatShare(shares[0])} hver`
          : formatShare([Math.min(...shares.map((s) => s[0])), Math.max(...shares.map((s) => s[1]))])
        : undefined;
      let subtitle = shareText;
      if (sign > 0) {
        const ceased = fold.filter((n) => isCeased(work.get(n)?.entity)).length;
        subtitle = ceased ? `${fold.length - ceased} aktive, ${ceased} ophørte` : shareText ?? `${fold.length} aktive`;
      }
      work.set(id, {
        id,
        kind: "group",
        count: fold.length,
        members: fold,
        title: sign < 0 ? `${fold.length} flere ejere` : `${fold.length} flere datterselskaber`,
        subtitle: sign < 0 ? `${subtitle ?? "Andele ikke oplyst"}, fold ud` : subtitle,
        weight: -2,
      });
      const lines: LabelLine[] | undefined = shares.length
        ? [{ text: same ? `${fold.length} × ${formatShare(shares[0])}` : sign < 0 ? `${fold.length} ejere` : `${fold.length} selskaber`, tone: "share" }]
        : undefined;
      for (const n of fold) work.delete(n);
      edges = edges.filter((e) => !foldSet.has(e.from) && !foldSet.has(e.to));
      edges.push(sign < 0 ? { id: `${id}>${anchor}`, from: id, to: anchor, dashed: false, lines, cycleSize: 0 } : { id: `${anchor}>${id}`, from: anchor, to: id, dashed: false, lines, cycleSize: 0 });
      L = relayer(rootId, work, edges);
      changed = true;
    }
  }
  return changed ? { edges } : null;
}

/* ------------------------------------------------------------------ */
/* 7. Rækkefølge (barycenter)                                          */
/* ------------------------------------------------------------------ */

function orderLayers(work: Map<string, WNode>, wedges: WEdge[], layer: Map<string, number>, isTree: (e: WEdge, L: Map<string, number>) => boolean): Map<number, string[]> {
  const rows = new Map<number, string[]>();
  for (const [id, l] of [...layer.entries()].sort((a, b) => byString(a[0], b[0]))) (rows.get(l) ?? rows.set(l, []).get(l)!).push(id);
  const tree = wedges.filter((e) => isTree(e, layer));
  const nb = new Map<string, string[]>();
  for (const e of tree) {
    (nb.get(e.from) ?? nb.set(e.from, []).get(e.from)!).push(e.to);
    (nb.get(e.to) ?? nb.set(e.to, []).get(e.to)!).push(e.from);
  }
  const special = (id: string) => (work.get(id)?.kind === "unknown" ? 2 : work.get(id)?.kind === "group" ? 1 : 0);
  const pos = new Map<string, number>();
  const index = (l: number) => rows.get(l)?.forEach((id, i) => pos.set(id, i));
  const keys = [...rows.keys()];
  const minL = Math.min(...keys);
  const maxL = Math.max(...keys);
  index(0);

  const sortRow = (l: number, ref: number, initial: boolean) => {
    const row = rows.get(l);
    if (!row) return;
    const prev = new Map(row.map((id, i) => [id, i]));
    const bary = (id: string) => {
      const ns = (nb.get(id) ?? []).filter((n) => layer.get(n) === ref && pos.has(n));
      if (!ns.length) return initial ? Number.POSITIVE_INFINITY : prev.get(id)!;
      return ns.reduce((s, n) => s + pos.get(n)!, 0) / ns.length;
    };
    const key = new Map(row.map((id) => [id, bary(id)]));
    row.sort(
      (a, b) =>
        special(a) - special(b) ||
        key.get(a)! - key.get(b)! ||
        (initial ? (work.get(b)?.weight ?? -1) - (work.get(a)?.weight ?? -1) || byString(work.get(a)?.title ?? "", work.get(b)?.title ?? "") : 0) ||
        prev.get(a)! - prev.get(b)! ||
        byString(a, b),
    );
    index(l);
  };

  // Første rækkefølge: udad fra roden, efter barycenter og derefter største andel.
  for (let l = -1; l >= minL; l--) sortRow(l, l + 1, true);
  for (let l = 1; l <= maxL; l++) sortRow(l, l - 1, true);
  // Et par gennemløb begge veje for færre krydsninger.
  for (let pass = 0; pass < 4; pass++) {
    for (let l = minL + 1; l <= -1; l++) sortRow(l, l - 1, false);
    for (let l = maxL - 1; l >= 1; l--) sortRow(l, l + 1, false);
    for (let l = -1; l >= minL; l--) sortRow(l, l + 1, false);
    for (let l = 1; l <= maxL; l++) sortRow(l, l - 1, false);
  }
  return rows;
}

/** Antal krydsende kanter mellem nabolag, til tests og til at måle heuristikken. */
export function countCrossings(layout: Pick<OwnershipLayout, "nodes" | "edges">): number {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const segs = layout.edges
    .filter((e) => e.route === "tree")
    .map((e) => ({ a: byId.get(e.from)!, b: byId.get(e.to)! }))
    .filter((s) => s.a && s.b);
  let count = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i]!;
      const t = segs[j]!;
      if (s.a.layer !== t.a.layer || s.b.layer !== t.b.layer) continue;
      if (s.a === t.a || s.b === t.b) continue;
      const x1 = s.a.x - t.a.x;
      const x2 = s.b.x - t.b.x;
      if (x1 * x2 < 0) count++;
    }
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* 8. Koordinater                                                      */
/* ------------------------------------------------------------------ */

function sizeOf(n: WNode, root: boolean): [number, number] {
  if (root) return [ROOT_W, ROOT_H];
  if (n.kind === "person") return [NODE_W, PERSON_H];
  return [NODE_W, NODE_H];
}

function placeNodes(rows: Map<number, string[]>, work: Map<string, WNode>, wedges: WEdge[], layer: Map<string, number>, isTree: (e: WEdge, L: Map<string, number>) => boolean): Map<string, LayoutNode> {
  const out = new Map<string, LayoutNode>();
  const keys = [...rows.keys()].sort((a, b) => a - b);
  // Lodret: lagenes højde er den højeste node; mindre noder centreres i laget.
  let y = 0;
  const top = new Map<number, number>();
  const height = new Map<number, number>();
  for (const l of keys) {
    const h = Math.max(...rows.get(l)!.map((id) => sizeOf(work.get(id)!, l === 0)[1]));
    top.set(l, y);
    height.set(l, h);
    y += h + LAYER_GAP;
  }
  const tree = wedges.filter((e) => isTree(e, layer));
  const inner = (id: string, l: number) =>
    tree.filter((e) => (l < 0 ? e.from === id : e.to === id)).map((e) => (l < 0 ? e.to : e.from));

  const place = (l: number) => {
    const row = rows.get(l)!;
    const desired = row.map((id) => {
      const ns = l === 0 ? [] : inner(id, l).filter((n) => out.has(n));
      if (!ns.length) return 0;
      return ns.reduce((s, n) => s + out.get(n)!.x + out.get(n)!.w / 2, 0) / ns.length;
    });
    const sizes = row.map((id) => sizeOf(work.get(id)!, l === 0));
    // Rækker uden ønsket placering (fx grupper) lægges i forlængelse af de andre.
    const xs: number[] = [];
    row.forEach((_, i) => {
      let left = desired[i]! - sizes[i]![0] / 2;
      if (i > 0) left = Math.max(left, xs[i - 1]! + sizes[i - 1]![0] + NODE_GAP);
      xs.push(left);
    });
    const shift = row.reduce((s, _, i) => s + (desired[i]! - sizes[i]![0] / 2 - xs[i]!), 0) / row.length;
    row.forEach((id, i) => {
      const n = work.get(id)!;
      const [w, h] = sizes[i]!;
      out.set(id, {
        id,
        kind: n.kind,
        layer: l,
        x: Math.round(xs[i]! + shift),
        y: top.get(l)! + (height.get(l)! - h) / 2,
        w,
        h,
        root: l === 0,
        ceased: isCeased(n.entity),
        entity: n.entity,
        count: n.count,
        members: n.members,
        title: n.title,
        subtitle: n.subtitle,
      });
    });
  };
  place(0);
  for (let l = -1; rows.has(l); l--) place(l);
  for (let l = 1; rows.has(l); l++) place(l);
  return out;
}

/* ------------------------------------------------------------------ */
/* 9. Kanter                                                           */
/* ------------------------------------------------------------------ */

/** Anslået bredde af en kantlabel (11 px Poppins 600, 8 px luft i siderne). */
export function labelWidth(lines: readonly LabelLine[]): number {
  return Math.max(...lines.map((l) => l.text.length * 6.4)) + 18;
}

export function labelHeight(lines: readonly LabelLine[]): number {
  return lines.length * 14 + 6;
}

function spread(n: LayoutNode, i: number, count: number): number {
  if (count <= 1) return n.x + n.w / 2;
  const inset = Math.min(40, n.w / 4);
  return n.x + inset + ((n.w - 2 * inset) * i) / (count - 1);
}

function routeEdges(nodes: Map<string, LayoutNode>, wedges: WEdge[], layer: Map<string, number>, isTree: (e: WEdge, L: Map<string, number>) => boolean): { edges: LayoutEdge[]; right: number } {
  const out: LayoutEdge[] = [];
  const bottomOfLayer = (l: number) => Math.max(...[...nodes.values()].filter((n) => n.layer === l).map((n) => n.y + n.h));
  const topOfLayer = (l: number) => Math.min(...[...nodes.values()].filter((n) => n.layer === l).map((n) => n.y));
  const tree = wedges.filter((e) => isTree(e, layer) && nodes.has(e.from) && nodes.has(e.to));
  const side = wedges.filter((e) => !isTree(e, layer) && nodes.has(e.from) && nodes.has(e.to));

  // Ankerpunkter: flere kanter fra samme ejer (opad) eller til samme datter (nedad) fordeles på kanten.
  const cx = (id: string) => nodes.get(id)!.x + nodes.get(id)!.w / 2;
  const anchorOut = new Map<string, number>();
  const anchorIn = new Map<string, number>();
  const bySource = new Map<string, WEdge[]>();
  const byTarget = new Map<string, WEdge[]>();
  for (const e of tree) {
    (bySource.get(e.from) ?? bySource.set(e.from, []).get(e.from)!).push(e);
    (byTarget.get(e.to) ?? byTarget.set(e.to, []).get(e.to)!).push(e);
  }
  for (const [s, list] of bySource) {
    const sorted = [...list].sort((a, b) => cx(a.to) - cx(b.to));
    const up = layer.get(s)! < 0;
    sorted.forEach((e, i) => anchorOut.set(e.id, up ? spread(nodes.get(s)!, i, sorted.length) : cx(s)));
  }
  for (const [t, list] of byTarget) {
    const sorted = [...list].sort((a, b) => cx(a.from) - cx(b.from));
    const down = layer.get(t)! > 0;
    sorted.forEach((e, i) => anchorIn.set(e.id, down ? spread(nodes.get(t)!, i, sorted.length) : cx(t)));
  }

  // Busser: opad én bus pr. ejet node, nedad én pr. ejer. Overlappende busser får hver sin højde.
  interface Bus { key: string; edges: WEdge[]; l: number; min: number; max: number; lane: number }
  const buses = new Map<string, Bus>();
  for (const e of tree) {
    const l = layer.get(e.from)!;
    const key = layer.get(e.to)! <= 0 ? `t:${e.to}` : `s:${e.from}`;
    const b = buses.get(key) ?? { key, edges: [], l, min: Infinity, max: -Infinity, lane: 0 };
    b.edges.push(e);
    for (const x of [anchorOut.get(e.id)!, anchorIn.get(e.id)!]) {
      b.min = Math.min(b.min, x);
      b.max = Math.max(b.max, x);
    }
    buses.set(key, b);
  }
  const byLayer = new Map<number, Bus[]>();
  for (const b of buses.values()) (byLayer.get(b.l) ?? byLayer.set(b.l, []).get(b.l)!).push(b);
  for (const list of byLayer.values()) {
    list.sort((a, b) => a.min - b.min || byString(a.key, b.key));
    const laneEnd: number[] = [];
    for (const b of list) {
      let lane = laneEnd.findIndex((end) => end + 12 < b.min);
      if (lane === -1) lane = laneEnd.length;
      laneEnd[lane] = b.max;
      b.lane = Math.min(lane, 3);
    }
  }

  for (const b of buses.values()) {
    const upper = b.l < 0 || b.key.startsWith("t:");
    const base = bottomOfLayer(b.l);
    const nextTop = topOfLayer(b.l + 1);
    const busY = upper ? base + BUS_OFFSET + b.lane * 8 : nextTop - BUS_OFFSET - b.lane * 8;
    for (const e of b.edges) {
      const s = nodes.get(e.from)!;
      const t = nodes.get(e.to)!;
      const sx = anchorOut.get(e.id)!;
      const tx = anchorIn.get(e.id)!;
      const points: [number, number][] = Math.abs(sx - tx) < 0.5 ? [[sx, s.y + s.h], [tx, t.y]] : [[sx, s.y + s.h], [sx, busY], [tx, busY], [tx, t.y]];
      const label = e.lines
        ? upper
          ? { x: sx, y: base + LABEL_OFFSET, lines: e.lines }
          : { x: tx, y: nextTop - LABEL_OFFSET, lines: e.lines }
        : undefined;
      out.push({ id: e.id, from: e.from, to: e.to, route: "tree", style: e.dashed ? "dashed" : "solid", points, label, edge: e.edge });
    }
  }

  // Udenom-kanter i baner til højre for alt andet.
  const right = Math.max(...[...nodes.values()].map((n) => n.x + n.w));
  const sideUse = new Map<string, number>();
  const sideCount = new Map<string, number>();
  for (const e of side) for (const id of [e.from, e.to]) sideCount.set(id, (sideCount.get(id) ?? 0) + 1);
  const portY = (id: string) => {
    const n = nodes.get(id)!;
    const i = sideUse.get(id) ?? 0;
    sideUse.set(id, i + 1);
    const count = sideCount.get(id)!;
    return n.y + n.h / 2 + (i - (count - 1) / 2) * 12;
  };
  const sortedSide = [...side].sort((a, b) => Math.abs(layer.get(a.from)! - layer.get(a.to)!) - Math.abs(layer.get(b.from)! - layer.get(b.to)!) || byString(a.id, b.id));
  // Kun den yderste node i et lag kan tages fra siden uden at krydse naboerne; de andre
  // forlades og nås lige over eller under kassen.
  const all = [...nodes.values()];
  const rightmost = (n: LayoutNode) => !all.some((m) => m !== n && m.layer === n.layer && m.x > n.x);
  const layerKeys = [...new Set(all.map((n) => n.layer))].sort((a, b) => a - b);
  const gaps = layerKeys.slice(0, -1).map((l, i) => (bottomOfLayer(l) + topOfLayer(layerKeys[i + 1]!)) / 2);
  let laneRight = right;
  sortedSide.forEach((e, j) => {
    const s = nodes.get(e.from)!;
    const t = nodes.get(e.to)!;
    const laneX = right + 36 + j * LANE_GAP;
    laneRight = laneX;
    const up = t.y < s.y;
    const points: [number, number][] = [];
    let y1: number;
    if (rightmost(s)) {
      y1 = portY(e.from);
      points.push([s.x + s.w, y1]);
    } else {
      const ex = s.x + s.w - 24;
      y1 = up ? s.y - 10 : s.y + s.h + 10;
      points.push([ex, up ? s.y : s.y + s.h], [ex, y1]);
    }
    points.push([laneX, y1]);
    let y2: number;
    if (rightmost(t)) {
      y2 = portY(e.to);
      points.push([laneX, y2], [t.x + t.w, y2]);
    } else {
      const ex = t.x + t.w - 24;
      y2 = up ? t.y + t.h + 10 : t.y - 10;
      points.push([laneX, y2], [ex, y2], [ex, up ? t.y + t.h : t.y]);
    }
    let lines = e.lines;
    const style = e.cycleSize > 0 ? "cycle" : e.dashed ? "dashed" : "solid";
    if (e.cycleSize > 0) {
      // Katalog 14: "0–4,99 %, cirkulært"; 14b: "3 led, cirkulært" når ringen har flere led.
      const share = e.edge?.share ? formatShare(e.edge.share) : undefined;
      lines = [{ text: e.cycleSize >= 3 ? `${e.cycleSize} led, cirkulært` : share ? `${share}, cirkulært` : "Cirkulært", tone: "cycle" }];
    }
    // Labelen lægges i et mellemrum mellem lagene, så den ikke dækker en node.
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    const mid = (lo + hi) / 2;
    const gapY = gaps.filter((g) => g > lo + 8 && g < hi - 8).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
    out.push({ id: e.id, from: e.from, to: e.to, route: "side", style, points, label: lines ? { x: laneX, y: gapY ?? mid, lines } : undefined, edge: e.edge });
  });
  out.sort((a, b) => byString(a.id, b.id));
  return { edges: out, right: laneRight };
}

/** SVG-sti gennem ortogonale punkter med afrundede hjørner (radius 8). */
export function roundedPath(points: readonly (readonly [number, number])[], radius = 8): string {
  if (points.length === 0) return "";
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${f(points[0]![0])},${f(points[0]![1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]!;
    const [x, y] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    const r = Math.min(radius, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
    const ax = x - Math.sign(x - px) * r;
    const ay = y - Math.sign(y - py) * r;
    const bx = x + Math.sign(nx - x) * r;
    const by = y + Math.sign(ny - y) * r;
    d += ` L${f(ax)},${f(ay)} Q${f(x)},${f(y)} ${f(bx)},${f(by)}`;
  }
  const last = points[points.length - 1]!;
  return `${d} L${f(last[0])},${f(last[1])}`;
}

/* ------------------------------------------------------------------ */
/* Indirekte andele og liste til mobil                                 */
/* ------------------------------------------------------------------ */

/**
 * Samlet indirekte andel fra `ownerId` i `targetId` som interval: summen over alle
 * simple stier af produktet af andelene. Cykler brydes (en node besøges højst én gang pr. sti),
 * og resultatet loftes ved 100 %.
 */
export function indirectShare(graph: OwnershipGraphVM, ownerId: string, targetId: string, maxDepth = 12): [number, number] | null {
  const { out } = normalizeGraph(graph);
  let lo = 0;
  let hi = 0;
  let found = false;
  const visit = (id: string, acc: [number, number], seen: Set<string>, depth: number) => {
    if (id === targetId) {
      found = true;
      lo += acc[0];
      hi += acc[1];
      return;
    }
    if (depth >= maxDepth) return;
    for (const e of out.get(id) ?? []) {
      if (seen.has(e.to) || !e.share) continue;
      seen.add(e.to);
      visit(e.to, [(acc[0] * e.share[0]) / 100, (acc[1] * e.share[1]) / 100], seen, depth + 1);
      seen.delete(e.to);
    }
  };
  visit(ownerId, [100, 100], new Set([ownerId]), 0);
  return found ? [Math.min(100, lo), Math.min(100, hi)] : null;
}

export interface TreeItem {
  id: string;
  name: string;
  kind: "person" | "company";
  share?: [number, number];
  ceased: boolean;
  /** Ejere (for ejersiden) eller datterselskaber (for datterside) i næste niveau. */
  children: TreeItem[];
  /** Noden står allerede højere oppe i listen (cirkulært eller fælles ejer). */
  repeat?: "cycle" | "shared";
}

/**
 * Indrykket liste til smalle skærme (26c): ejerne som et træ opad og datterselskaberne
 * som et træ nedad. Hver node foldes kun ud én gang; gentagelser markeres.
 */
export function ownershipTree(graph: OwnershipGraphVM, opts: { depthUp?: number; depthDown?: number; showHistoric?: boolean } = {}): { owners: TreeItem[]; subsidiaries: TreeItem[] } {
  const { nodes, out, inn } = normalizeGraph(graph, { showHistoric: opts.showHistoric });
  const { component, cycles } = findCycles([...nodes.keys()], out);
  const inCycleWith = (a: string, b: string) => component.get(a) === component.get(b) && cycles.some((c) => c.includes(a));
  const up = opts.depthUp ?? graph.ingoingDepth;
  const down = opts.depthDown ?? graph.outgoingDepth;
  // Samme sidevalg som diagrammet: hver node står enten som ejer eller som datter.
  const layer = assignLayers(graph.rootId, out, inn, up, down);
  const seen = new Set([graph.rootId]);
  const build = (id: string, upward: boolean): TreeItem[] => {
    const here = layer.get(id)!;
    const list = [...(upward ? inn.get(id) ?? [] : out.get(id) ?? [])]
      .filter((e) => layer.has(upward ? e.from : e.to))
      .sort((a, b) => hiShare(b) - hiShare(a) || loShare(b) - loShare(a) || byString(nodes.get(upward ? a.from : a.to)!.name, nodes.get(upward ? b.from : b.to)!.name));
    const items: TreeItem[] = [];
    for (const e of list) {
      const other = upward ? e.from : e.to;
      const n = nodes.get(other)!;
      const item: TreeItem = { id: other, name: n.name, kind: n.kind, share: e.share, ceased: isCeased(n), children: [] };
      const next = layer.get(other)!;
      const treeStep = upward ? next === here - 1 : next === here + 1;
      if (!treeStep || seen.has(other)) {
        // Kanten peger ud af sin side eller til en node, der allerede står i listen.
        // Fra roden vises den ikke to gange: ringen står under den side, noden hører til.
        if (id === graph.rootId && !treeStep) continue;
        if (inCycleWith(id, other)) item.repeat = "cycle";
        else if (seen.has(other)) item.repeat = "shared";
        else continue;
        items.push(item);
        continue;
      }
      seen.add(other);
      items.push(item);
    }
    for (const it of items) if (!it.repeat) it.children = build(it.id, upward);
    return items;
  };
  const owners = build(graph.rootId, true);
  return { owners, subsidiaries: build(graph.rootId, false) };
}
