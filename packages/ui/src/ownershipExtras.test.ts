import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OwnershipGraphVM } from "@lasso/spec";
import { beneficialGraph, fitOwnership, graphOnDate, layoutOwnership, minimapFrame, OWNERSHIP_CANVAS, ownershipCanvas, refocusGraph } from "./ownershipLayout.js";

test("C5 ownershipCanvas: uden værtens ramme (standard, /mcp) som før: 100 %, kun bredden, lærredet vokser op til 1200 px", () => {
  // Dyb graf: tegnes i 100 %, lærredet vokser med (ikke begrænset af vinduet), højst 1200.
  const deep = ownershipCanvas({ graph: { width: 800, height: 900 }, canvasW: 1000, foot: 88, tablet: false });
  assert.equal(deep.zoom, 1);
  assert.equal(deep.canvasH, 988);
  const deeper = ownershipCanvas({ graph: { width: 800, height: 1600 }, canvasW: 1000, foot: 88, tablet: false });
  assert.equal(deeper.zoom, 1, "skaleres ikke for højden");
  assert.equal(deeper.canvasH, OWNERSHIP_CANVAS.tall);
  // Bred graf: kun bredden skalerer.
  const wide = ownershipCanvas({ graph: { width: 1600, height: 300 }, canvasW: 800, foot: 88, tablet: false });
  assert.equal(wide.zoom, (800 - 32) / 1600);
  assert.equal(wide.canvasH, OWNERSHIP_CANVAS.min);
  // Tablet: som før (340-560, aldrig under 150 px-noder).
  const tab = ownershipCanvas({ graph: { width: 800, height: 900 }, canvasW: 700, foot: 44, tablet: true });
  assert.equal(tab.zoom, OWNERSHIP_CANVAS.tabletMinZoom);
  assert.equal(tab.canvasH, OWNERSHIP_CANVAS.tabletMax);
});

test("C5 ownershipCanvas: med værtens ramme (portalen) tilpasses vinduet: hele grafen, lærredet højst den synlige højde", () => {
  // Vindue 900 - ramme 400 = 500 px: den dybe graf skaleres ned, så den kan ses i ét.
  const deep = ownershipCanvas({ graph: { width: 800, height: 900 }, canvasW: 1000, foot: 88, tablet: false, viewportH: 500 });
  assert.ok(deep.zoom < 1);
  assert.equal(deep.canvasH, 500);
  assert.ok(900 * deep.zoom + deep.pan.y <= deep.canvasH - 88);
  // Et lavt vindue giver aldrig under minimum (360).
  assert.equal(ownershipCanvas({ graph: { width: 800, height: 900 }, canvasW: 1000, foot: 88, tablet: false, viewportH: 100 }).canvasH, OWNERSHIP_CANVAS.min);
  // Et højt vindue giver aldrig over 1200.
  assert.ok(ownershipCanvas({ graph: { width: 800, height: 3000 }, canvasW: 1000, foot: 88, tablet: false, viewportH: 2000 }).canvasH <= OWNERSHIP_CANVAS.tall);
  // Samme som fitOwnership med portalens grænser.
  assert.deepEqual(deep, fitOwnership({ graph: { width: 800, height: 900 }, canvasW: 1000, minCanvasH: 360, maxCanvasH: 500, foot: 88 }));
});
import { OwnershipDiagram } from "./components/OwnershipDiagram.js";

// Prøve Anna ejer 80 % af Eksempel Holding, som ejer 50 % af roden; Prøve Bo ejer 20 % direkte.
const g: OwnershipGraphVM = {
  rootId: "CVR-1-1",
  ingoingDepth: 3,
  outgoingDepth: 1,
  nodes: [
    { id: "CVR-1-1", name: "Eksempel Rod A/S", kind: "company", root: true },
    { id: "CVR-1-2", name: "Eksempel Holding ApS", kind: "company" },
    { id: "CVR-1-3", name: "Eksempel Datter ApS", kind: "company" },
    { id: "CVR-3-1", name: "Prøve Anna", kind: "person" },
    { id: "CVR-3-2", name: "Prøve Bo", kind: "person" },
  ],
  edges: [
    { from: "CVR-1-2", to: "CVR-1-1", share: [50, 50], since: "2010-01-01" },
    { from: "CVR-3-1", to: "CVR-1-2", share: [80, 80], since: "2010-01-01" },
    { from: "CVR-3-2", to: "CVR-1-1", share: [20, 20], since: "2020-06-01" },
    { from: "CVR-1-1", to: "CVR-1-3", share: [100, 100] },
  ],
};

test("Reelle ejere (14.1): personerne bag kæderne med beregnet indirekte andel", () => {
  const b = beneficialGraph(g);
  assert.deepEqual(b.edges.map((e) => [e.from, e.share]).sort(), [["CVR-3-1", [40, 40]], ["CVR-3-2", [20, 20]]]);
  assert.ok(!b.nodes.some((n) => n.id === "CVR-1-2" || n.id === "CVR-1-3"));
});

test("Dobbeltklik giver nyt fokus: roden flyttes, og layoutet centrerer den nye rod", () => {
  const r = refocusGraph(g, "CVR-1-2");
  assert.equal(r.rootId, "CVR-1-2");
  assert.equal(r.nodes.filter((n) => n.root).length, 1);
  const l = layoutOwnership(r);
  assert.equal(l.nodes.find((n) => n.root)?.entity?.id, "CVR-1-2");
  assert.equal(refocusGraph(g, "ukendt"), g);
});

test("Pr. dato: ejerskaber registreret efter datoen udelades", () => {
  assert.equal(graphOnDate(g, "2015-01-01").edges.length, 3);
  assert.equal(graphOnDate(g, undefined), g);
});

test("Mini-kort: hele grafen i boksen og viewport-rammen klippet til kortet", () => {
  const m = minimapFrame({ width: 1000, height: 500 }, { x: 0, y: 0, zoom: 1, width: 500, height: 250 }, { width: 200, height: 100 });
  assert.equal(m.scale, 0.2);
  assert.deepEqual(m.frame, { x: 0, y: 0, w: 100, h: 50 });
  const out = minimapFrame({ width: 1000, height: 500 }, { x: -2000, y: 0, zoom: 1, width: 500, height: 250 }, { width: 200, height: 100 });
  assert.ok(out.frame.x <= out.width);
});

test("Værktøjslinjen har Legale/Reelle, datovælger og eksport", () => {
  const html = renderToStaticMarkup(createElement(OwnershipDiagram, { graph: g }));
  assert.match(html, /Legale ejere/);
  assert.match(html, /Reelle ejere/);
  assert.match(html, /type="date"/);
  assert.match(html, /Eksportér/);
  assert.match(html, /PNG-billede/);
  assert.match(html, /lasso-odiagram__minimap/);
});

test("fitOwnership: hele grafen i vinduet (bredde og højde), højst 100 %, lærredet så højt som den tilpassede graf", () => {
  // Lav, bred graf: 100 % er loftet, og lærredet er mindst minCanvasH.
  const small = fitOwnership({ graph: { width: 600, height: 200 }, canvasW: 1000, minCanvasH: 360, maxCanvasH: 700, foot: 88 });
  assert.equal(small.zoom, 1);
  assert.equal(small.canvasH, 360);
  assert.equal(small.pan.x, 200);
  // Dyb graf: højden bestemmer, så den skaleres ned i stedet for at blive klippet; lærredet bliver ikke højere end vinduet.
  const deep = fitOwnership({ graph: { width: 800, height: 1400 }, canvasW: 1000, minCanvasH: 360, maxCanvasH: 700, foot: 88 });
  assert.ok(deep.zoom < 1);
  assert.equal(deep.canvasH, 700);
  assert.ok(1400 * deep.zoom + deep.pan.y <= deep.canvasH - 88, "nederste række står over foden");
  assert.ok(800 * deep.zoom + deep.pan.x <= 1000);
  // Smal beholder (kort i samtalen): bredden bestemmer.
  const narrow = fitOwnership({ graph: { width: 1600, height: 300 }, canvasW: 800, minCanvasH: 360, maxCanvasH: 700, foot: 88 });
  assert.equal(narrow.zoom, (800 - 32) / 1600);
  assert.ok(narrow.pan.x >= 0);
  // Min-zoom respekteres (derunder panoreres).
  assert.equal(fitOwnership({ graph: { width: 9000, height: 9000 }, canvasW: 800, minCanvasH: 360, maxCanvasH: 700, foot: 88, minZoom: 0.25 }).zoom, 0.25);
});
