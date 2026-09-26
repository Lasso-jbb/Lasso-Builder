import assert from "node:assert/strict";
import { test } from "node:test";
import type { OwnershipEdgeVM, OwnershipGraphVM, OwnershipNodeVM } from "@lasso/spec";
import {
  assignLayers,
  countCrossings,
  findCycles,
  indirectShare,
  layoutOwnership,
  normalizeGraph,
  NODE_GAP,
  ownershipTree,
  roundedPath,
  type OwnershipLayout,
} from "./ownershipLayout.js";

const co = (id: string, extra: Partial<OwnershipNodeVM> = {}): OwnershipNodeVM => ({ id, name: `Eksempel ${id}`, kind: "company", ...extra });
const person = (id: string): OwnershipNodeVM => ({ id, name: `Prøve ${id}`, kind: "person" });
const own = (from: string, to: string, lo = 100, hi = lo): OwnershipEdgeVM => ({ from, to, share: [lo, hi] });

function graph(rootId: string, nodes: OwnershipNodeVM[], edges: OwnershipEdgeVM[], up = 5, down = 5): OwnershipGraphVM {
  return { rootId, nodes: nodes.map((n) => (n.id === rootId ? { ...n, root: true } : n)), edges, ingoingDepth: up, outgoingDepth: down };
}

const layerOf = (l: OwnershipLayout, id: string) => l.nodes.find((n) => n.id === id)?.layer;

function assertNoOverlap(l: OwnershipLayout) {
  for (const a of l.nodes) {
    for (const b of l.nodes) {
      if (a === b || a.layer !== b.layer) continue;
      const apart = a.x + a.w + NODE_GAP - 0.5 <= b.x || b.x + b.w + NODE_GAP - 0.5 <= a.x;
      assert.ok(apart, `${a.id} og ${b.id} overlapper`);
    }
  }
}

test("lag: ejere over (negative), datterselskaber under (positive), roden i 0", () => {
  const g = graph(
    "R",
    [co("R"), co("H"), person("P"), co("D1"), co("D2"), co("DD")],
    [own("H", "R", 50, 66.66), own("P", "H"), own("R", "D1"), own("R", "D2", 50), own("D1", "DD")],
  );
  const l = layoutOwnership(g);
  assert.equal(layerOf(l, "R"), 0);
  assert.equal(layerOf(l, "H"), -1);
  assert.equal(layerOf(l, "P"), -2);
  assert.equal(layerOf(l, "D1"), 1);
  assert.equal(layerOf(l, "DD"), 2);
  // Ejere står lodret over den ejede.
  const y = (id: string) => l.nodes.find((n) => n.id === id)!.y;
  assert.ok(y("P") < y("H") && y("H") < y("R") && y("R") < y("D1") && y("D1") < y("DD"));
  // Roden er fremhævet og bredere.
  const root = l.nodes.find((n) => n.root)!;
  assert.equal(root.id, "R");
  assert.equal(root.w, 220);
  assertNoOverlap(l);
});

test("dybde og retning begrænser lagene", () => {
  const g = graph("R", [co("R"), co("A"), co("B"), co("C")], [own("A", "R"), own("B", "A"), own("R", "C")]);
  assert.deepEqual(layoutOwnership(g, { depthUp: 1, depthDown: 0 }).nodes.map((n) => n.id).sort(), ["A", "R"]);
  assert.deepEqual(layoutOwnership(g, { direction: "down" }).nodes.map((n) => n.id).sort(), ["C", "R"]);
  const l = layoutOwnership(g, { direction: "up" });
  assert.equal(l.availableUp, 2);
  assert.equal(l.availableDown, 1);
});

test("cykler: ingen uendelig løkke, tilbage-kanten føres udenom i koral", () => {
  // Alfa ejer Beta, Beta ejer Fokus, Fokus ejer Alfa (14b: cirkulært over flere led).
  const g = graph("F", [co("F"), co("A"), co("B")], [own("A", "B", 60), own("B", "F", 51), own("F", "A", 10, 14.99)]);
  const l = layoutOwnership(g, { depthUp: 10, depthDown: 10 });
  assert.equal(layerOf(l, "B"), -1);
  assert.equal(layerOf(l, "A"), -2);
  assert.deepEqual(l.cycles, [["A", "B", "F"]]);
  const back = l.edges.find((e) => e.from === "F" && e.to === "A")!;
  assert.equal(back.route, "side");
  assert.equal(back.style, "cycle");
  assert.equal(back.label?.lines[0]?.text, "3 led, cirkulært");
  // De to andre kanter tegnes normalt ned ad bussen.
  assert.ok(l.edges.filter((e) => e.route === "tree" && e.edge).every((e) => e.style === "solid"));
  // Banen ligger til højre for alle noder.
  const right = Math.max(...l.nodes.map((n) => n.x + n.w));
  assert.ok(back.points[1]![0] > right);
});

test("cykel med to led: datterselskabet står under roden, og tilbage-kanten har andelen", () => {
  const g = graph("R", [co("R"), co("S")], [own("R", "S"), own("S", "R", 0, 4.99)]);
  const l = layoutOwnership(g);
  assert.equal(layerOf(l, "S"), 1);
  const back = l.edges.find((e) => e.style === "cycle")!;
  assert.equal(back.from, "S");
  assert.equal(back.label?.lines[0]?.text, "0–4,99 %, cirkulært");
});

test("findCycles og assignLayers stopper på store ringe", () => {
  const n = 500;
  const ids = Array.from({ length: n }, (_, i) => `N${String(i).padStart(3, "0")}`);
  const edges = ids.map((id, i) => own(id, ids[(i + 1) % n]!));
  const { out, inn } = normalizeGraph(graph(ids[0]!, ids.map((id) => co(id)), edges));
  const { cycles } = findCycles(ids, out);
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0]!.length, n);
  const layers = assignLayers(ids[0]!, out, inn, 1000, 1000);
  assert.equal(layers.size, n);
});

test("foldning: 7 led i én retning foldes til nærmeste, +4 og de to yderste (14b)", () => {
  const chain = ["Holm", "L5", "L4", "L3", "L2", "Top"];
  const nodes = [co("F"), ...chain.map((id) => co(id)), person("Anne")];
  const edges = [own("Holm", "F"), ...chain.slice(1).map((id, i) => own(id, chain[i]!)), own("Anne", "Top")];
  const l = layoutOwnership(graph("F", nodes, edges, 10, 0));
  const fold = l.nodes.find((n) => n.kind === "chain")!;
  assert.ok(fold, "der er en foldet node");
  assert.equal(fold.count, 4);
  assert.deepEqual([...fold.members!].sort(), ["L2", "L3", "L4", "L5"]);
  assert.equal(fold.title, "4 mellemled foldet");
  assert.equal(fold.subtitle, "Lag 2–5, 100 % hele vejen");
  // 7 lag bliver til 4 over fokus: Holm, +4, Top, Anne.
  assert.equal(layerOf(l, "Holm"), -1);
  assert.equal(layerOf(l, fold.id), -2);
  assert.equal(layerOf(l, "Top"), -3);
  assert.equal(layerOf(l, "Anne"), -4);
  // Foldes ud, når id'et er udvidet eller "Udvid alle" er valgt.
  assert.equal(layoutOwnership(graph("F", nodes, edges, 10, 0), { expanded: new Set([fold.id]) }).nodes.length, 8);
  assert.equal(layoutOwnership(graph("F", nodes, edges, 10, 0), { expandAll: true }).nodes.length, 8);
});

test("foldning: korte kæder og forgreninger foldes ikke", () => {
  const nodes = [co("F"), co("A"), co("B"), co("C"), co("D"), co("E")];
  const edges = [own("A", "F"), own("B", "A"), own("C", "B"), own("D", "C"), own("E", "D")];
  assert.ok(!layoutOwnership(graph("F", nodes, edges, 10, 0)).nodes.some((n) => n.kind === "chain"), "5 led foldes ikke");
  // En ekstra ejer midt i kæden bryder den.
  const chain = ["A", "B", "C", "D", "E", "G", "H"];
  const n2 = [co("F"), ...chain.map((id) => co(id)), co("X")];
  const e2 = [own("A", "F"), ...chain.slice(1).map((id, i) => own(id, chain[i]!)), own("X", "D", 20)];
  const l = layoutOwnership(graph("F", n2, e2, 10, 0));
  assert.ok(!l.nodes.some((n) => n.kind === "chain" && n.members!.includes("D")));
});

test("loft pr. lag: over 5 datterselskaber samles de mindste i +N; direkte ejere foldes aldrig", () => {
  const subs = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];
  const owners = ["O1", "O2", "O3", "O4", "O5", "O6", "O7"];
  const nodes = [co("R"), ...subs.map((id, i) => co(id, i === 7 ? { statusKind: "inactive", status: "Ophørt" } : {})), ...owners.map((id) => co(id))];
  const edges = [...subs.map((id, i) => own("R", id, 100 - i * 10)), ...owners.map((id) => own(id, "R", 10, 14.99))];
  const l = layoutOwnership(graph("R", nodes, edges, 1, 1));
  const group = l.nodes.find((n) => n.kind === "group")!;
  assert.equal(group.layer, 1);
  assert.equal(group.count, 4);
  assert.deepEqual([...group.members!].sort(), ["S5", "S6", "S7", "S8"]);
  assert.equal(group.title, "4 flere datterselskaber");
  assert.equal(group.subtitle, "3 aktive, 1 ophørte");
  // Gruppen står sidst i laget.
  const row = l.nodes.filter((n) => n.layer === 1).sort((a, b) => a.x - b.x);
  assert.equal(row.at(-1)!.id, group.id);
  // Alle 7 direkte ejere står der stadig; summen kan nå 100 %, så ingen ukendt ejer.
  assert.equal(l.nodes.filter((n) => n.layer === -1 && n.kind === "company").length, 7);
  assert.ok(!l.nodes.some((n) => n.kind === "unknown"));
  // Udvid alle viser alt.
  assert.equal(layoutOwnership(graph("R", nodes, edges, 1, 1), { expandAll: true }).nodes.filter((n) => n.layer === 1).length, 8);
});

test("loft pr. lag i anden række: '3 × 5–9,99 %' og 'hver' når andelene er ens", () => {
  const owners = ["A", "B", "C", "D", "E", "G", "H"];
  const nodes = [co("R"), co("M"), ...owners.map((id) => co(id))];
  const edges = [own("M", "R"), ...owners.map((id, i) => (i < 3 ? own(id, "M", 20, 24.99) : own(id, "M", 5, 9.99)))];
  const l = layoutOwnership(graph("R", nodes, edges, 2, 0));
  const group = l.nodes.find((n) => n.kind === "group")!;
  assert.equal(group.count, 3);
  assert.equal(group.subtitle, "5–9,99 % hver, fold ud");
  const e = l.edges.find((x) => x.from === group.id)!;
  assert.equal(e.label?.lines[0]?.text, "3 × 5–9,99 %");
});

test("ukendt ejer: summen af registrerede andele under 100 % giver én stiplet node", () => {
  const g = graph("R", [co("R"), co("A"), co("B")], [own("A", "R", 40), own("B", "R", 35)]);
  const l = layoutOwnership(g);
  const u = l.nodes.find((n) => n.kind === "unknown")!;
  assert.equal(u.layer, -1);
  const e = l.edges.find((x) => x.from === u.id)!;
  assert.equal(e.style, "dashed");
  assert.equal(e.label?.lines[0]?.text, "≤ 25 %");
  // 100 % ejet: ingen ukendt.
  assert.ok(!layoutOwnership(graph("R", [co("R"), co("A")], [own("A", "R")])).nodes.some((n) => n.kind === "unknown"));
});

test("loft over hele strukturen: nærmeste lag først og antal skjulte", () => {
  const nodes = [co("R")];
  const edges: OwnershipEdgeVM[] = [];
  for (let i = 0; i < 4; i++) {
    nodes.push(co(`A${i}`));
    edges.push(own("R", `A${i}`));
    for (let j = 0; j < 4; j++) {
      nodes.push(co(`A${i}B${j}`));
      edges.push(own(`A${i}`, `A${i}B${j}`));
    }
  }
  const g = graph("R", nodes, edges, 0, 2);
  const l = layoutOwnership(g, { maxNodes: 10, layerCap: 100 });
  assert.equal(l.nodes.length, 10);
  assert.equal(l.hiddenCount, 11);
  assert.equal(l.totalCount, 21);
  assert.ok(l.nodes.filter((n) => n.layer === 1).length === 4, "alle direkte datterselskaber vises");
  assert.equal(layoutOwnership(g, { maxNodes: Infinity, layerCap: 100 }).hiddenCount, 0);
});

test("determinisme: samme graf i en anden rækkefølge giver samme layout", () => {
  const nodes = [co("R"), co("A"), co("B"), person("P"), co("C"), co("D"), co("E"), co("F"), co("G")];
  const edges = [own("A", "R", 50, 66.66), own("B", "R", 20, 24.99), own("P", "A"), own("P", "B", 10), own("C", "B"), own("R", "D"), own("R", "E", 60), own("E", "F"), own("D", "G"), own("G", "R", 5, 9.99)];
  const a = layoutOwnership(graph("R", nodes, edges));
  const shuffled = graph("R", [...nodes].reverse(), [...edges].reverse().map((e) => ({ ...e })));
  const b = layoutOwnership(shuffled);
  assert.deepEqual(JSON.stringify(b), JSON.stringify(a));
  assert.deepEqual(JSON.stringify(layoutOwnership(graph("R", nodes, edges))), JSON.stringify(a));
});

test("barycenter giver ingen krydsninger i et træ, hvor første rækkefølge ville krydse", () => {
  // To ejere af roden; hver har to ejere. Navne vælges, så alfabetisk rækkefølge krydser.
  const nodes = [co("R"), co("A"), co("B"), co("Z1"), co("Z2"), co("Y1"), co("Y2")];
  const edges = [own("A", "R", 50), own("B", "R", 50), own("Z1", "B"), own("Z2", "B"), own("Y1", "A", 50), own("Y2", "A", 50)];
  const l = layoutOwnership(graph("R", nodes, edges));
  assert.equal(countCrossings(l), 0);
  assertNoOverlap(l);
});

test("stemmeandel vises som anden linje, kun når den afviger", () => {
  const g = graph("R", [co("R"), co("A"), co("B")], [{ from: "A", to: "R", share: [25, 33.32], votes: [33.33, 49.99] }, { from: "B", to: "R", share: [50, 66.66], votes: [50, 66.66] }]);
  const l = layoutOwnership(g);
  const a = l.edges.find((e) => e.from === "A")!;
  assert.deepEqual(a.label?.lines.map((x) => x.text), ["Ejer 25–33,32 %", "Stemmer 33,33–49,99 %"]);
  const b = l.edges.find((e) => e.from === "B")!;
  assert.deepEqual(b.label?.lines.map((x) => x.text), ["50–66,66 %"]);
});

test("ophørte ejerskaber skjules, medmindre historik er slået til", () => {
  const g = graph("R", [co("R"), co("A"), co("B")], [own("A", "R"), { from: "B", to: "R", share: [100, 100], until: "2023-05-01" }]);
  assert.ok(!layoutOwnership(g).nodes.some((n) => n.id === "B"));
  const l = layoutOwnership(g, { showHistoric: true });
  const e = l.edges.find((x) => x.from === "B")!;
  assert.equal(e.style, "dashed");
  assert.equal(e.label?.lines[0]?.text, "100 %, til 2023");
});

test("indirekte andel ganges langs stierne og tåler cykler", () => {
  const g = graph("R", [co("R"), co("H"), person("P")], [own("P", "H"), own("H", "R", 20, 24.99)]);
  assert.deepEqual(indirectShare(g, "P", "R"), [20, 24.99]);
  const c = graph("F", [co("F"), co("A"), co("B")], [own("A", "B", 60), own("B", "F", 50), own("F", "A", 10)]);
  const s = indirectShare(c, "A", "F")!;
  assert.ok(Math.abs(s[0] - 30) < 1e-9);
  assert.equal(indirectShare(g, "R", "P"), null);
});

test("liste til mobil: indrykket træ, gentagelser markeres", () => {
  const g = graph("F", [co("F"), co("A"), co("B"), person("P")], [own("A", "F", 60), own("B", "F", 40), own("P", "A"), own("F", "B", 5, 9.99)], 3, 1);
  const t = ownershipTree(g);
  assert.deepEqual(t.owners.map((o) => o.id), ["A", "B"]);
  assert.deepEqual(t.owners[0]!.children.map((o) => o.id), ["P"]);
  // B ejer 40 % af F og ejes 5–9,99 % af F: B står som ejer, og ringen vises under B.
  assert.equal(t.subsidiaries.length, 0);
  assert.equal(t.owners[1]!.children[0]!.id, "F");
  assert.equal(t.owners[1]!.children[0]!.repeat, "cycle");
});

test("roundedPath runder hjørner af", () => {
  assert.equal(roundedPath([[0, 0], [0, 10]]), "M0,0 L0,10");
  assert.equal(roundedPath([[0, 0], [0, 50], [40, 50], [40, 90]]), "M0,0 L0,42 Q0,50 8,50 L32,50 Q40,50 40,58 L40,90");
});

test("udenom-kanter krydser ingen andre noder", () => {
  // A ejes 100 % af roden og ejer 5–9,99 % tilbage; A står yderst til venstre i sit lag.
  const g = graph("R", [co("R"), co("A"), co("B"), co("C")], [own("R", "A"), own("R", "B"), own("R", "C"), own("A", "R", 5, 9.99)]);
  const l = layoutOwnership(g);
  const back = l.edges.find((e) => e.route === "side")!;
  assert.equal(back.from, "A");
  const others = l.nodes.filter((n) => n.id !== "A" && n.id !== "R");
  for (let i = 1; i < back.points.length; i++) {
    const [x1, y1] = back.points[i - 1]!;
    const [x2, y2] = back.points[i]!;
    for (const n of others) {
      const hitX = Math.max(x1, x2) > n.x && Math.min(x1, x2) < n.x + n.w;
      const hitY = Math.max(y1, y2) > n.y && Math.min(y1, y2) < n.y + n.h;
      assert.ok(!(hitX && hitY), `segment ${i} krydser ${n.id}`);
    }
  }
});
