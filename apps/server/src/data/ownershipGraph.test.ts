import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../config.js";
import { LassoApiError, type LassoClient } from "../lasso/client.js";
import { DemoProvider } from "./demo.js";
import { LiveProvider } from "./live.js";

test("LiveProvider sender ejergrafens body og normaliserer svaret", async () => {
  const bodies: unknown[] = [];
  const client = {
    async relationsGraph(p: unknown) {
      bodies.push(p);
      return { nodes: [{ id: "CVR-1-1", name: "Fokus A/S" }, { id: "CVR-3-2", name: "Anne", type: "person" }], edges: [{ from: "CVR-3-2", to: "CVR-1-1", ownership: { from: 1, to: 1 } }] };
    },
  } as unknown as LassoClient;
  const g = await new LiveProvider(client, loadConfig({})).ownershipGraph("CVR-1-1", { ingoingDepth: 2, outgoingDepth: 1, onDate: "2025-01-01" });
  assert.deepEqual(bodies, [{ ids: ["CVR-1-1"], ingoingDepth: 2, outgoingDepth: 1, onDate: "2025-01-01" }]);
  assert.equal(g.nodes.length, 2);
  assert.deepEqual(g.edges[0]!.share, [100, 100]);
});

test("LiveProvider falder tilbage til direkte ejere, når ejergrafen ikke findes", async () => {
  const client = {
    async relationsGraph() {
      throw new LassoApiError(404, { errorMessage: "Not found" }, "x");
    },
    async company(id: string) {
      return { lassoId: id, name: "Fokus A/S", ownership: { owners: [{ name: "Holding ApS", lassoId: "CVR-1-2", type: "company", ownership: { from: 0.5, to: 0.6666 } }] } };
    },
  } as unknown as LassoClient;
  const g = await new LiveProvider(client, loadConfig({})).ownershipGraph("CVR-1-1", { ingoingDepth: 2, outgoingDepth: 1 });
  assert.equal(g.nodes.find((n) => n.root)?.name, "Fokus A/S");
  assert.deepEqual(g.edges.map((e) => [e.from, e.to, e.share]), [["CVR-1-2", "CVR-1-1", [50, 66.66]]]);
  assert.ok(g.note);
});

test("LiveProvider kaster videre ved adgangsfejl", async () => {
  const client = {
    async relationsGraph() {
      throw new LassoApiError(401, null, "x");
    },
  } as unknown as LassoClient;
  await assert.rejects(new LiveProvider(client, loadConfig({})).ownershipGraph("CVR-1-1", { ingoingDepth: 2, outgoingDepth: 1 }));
});

test("demokoncernen har holding, lag, kæde, cirkulært ejerskab og en person med andel", async () => {
  const demo = new DemoProvider();
  const holding = await demo.ownershipGraph("CVR-1-99000010", { ingoingDepth: 2, outgoingDepth: 8 });
  assert.ok(holding.nodes.every((n) => /Eksempel|Prøve/.test(n.name)), "alle navne er eksempeldata");
  assert.ok(holding.edges.filter((e) => e.from === "CVR-1-99000010").length > 5, "over 5 datterselskaber i ét lag");
  assert.ok(holding.nodes.some((n) => n.name === "Eksempel Ejendom Grund ApS"), "den lange kæde er med");
  const byg = await demo.ownershipGraph("CVR-1-99000001", { ingoingDepth: 2, outgoingDepth: 1 });
  assert.ok(byg.edges.some((e) => e.from === "CVR-1-99000101" && e.to === "CVR-1-99000001"), "cirkulært ejerskab");
  assert.ok(byg.edges.some((e) => e.from === "CVR-3-99100002" && e.share?.[0] === 10), "person med andel");
  // Dybden begrænser udsnittet.
  const shallow = await demo.ownershipGraph("CVR-1-99000010", { ingoingDepth: 0, outgoingDepth: 1 });
  assert.ok(!shallow.nodes.some((n) => n.kind === "person"));
  await assert.rejects(demo.ownershipGraph("CVR-1-12345678", { ingoingDepth: 1, outgoingDepth: 1 }));
});
