import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { OwnershipGraphVM } from "@lasso/spec";
import { beneficialGraph, graphOnDate, layoutOwnership, minimapFrame, refocusGraph } from "./ownershipLayout.js";
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
