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

/* ---------- Katalog 16: personsidens ejerdiagram (personen er roden) ---------- */

// Personsvar i den dokumenterede form (docs/lasso-endpoints.md), opdigtede værdier.
const PERSON = {
  lassoId: "CVR-3-4000000001",
  name: "Mette Eksempel",
  owner: [{ lassoId: "CVR-1-22222222", cvr: 22222222, name: "HOLM HOLDING ApS", status: "NORMAL", role: { mainType: "REGISTER", type: "EJER" }, ownership: { from: 0.5, to: 0.6666 } }],
  trueOwner: [{ lassoId: "CVR-1-33333333", name: "REEL A/S", role: { type: "Reel ejer" } }],
};

test("LiveProvider: personens ejergraf har personen som rod med navn fra personopslaget og ingoingDepth 0", async () => {
  const bodies: unknown[] = [];
  const client = {
    async relationsGraph(p: unknown) {
      bodies.push(p);
      return {
        entities: [{ id: "CVR-1-22222222", type: "company", data: { lassoId: "CVR-1-22222222", name: "HOLM HOLDING ApS", companyType: "ApS" } }],
        relations: [{ id: "r1", type: "ownership", from: "CVR-3-4000000001", to: "CVR-1-22222222", data: { ownershipPercentage: { label: "50-66,66%", from: 0.5, to: 0.6666 } } }],
      };
    },
    async person() {
      return PERSON;
    },
    async personHistory() {
      throw new LassoApiError(404, null, "x");
    },
  } as unknown as LassoClient;
  const g = await new LiveProvider(client, loadConfig({})).ownershipGraph("CVR-3-4000000001", { ingoingDepth: 2, outgoingDepth: 2 });
  assert.deepEqual(bodies, [{ ids: ["CVR-3-4000000001"], ingoingDepth: 0, outgoingDepth: 2 }]);
  const root = g.nodes.find((n) => n.root);
  assert.deepEqual([root?.id, root?.name, root?.kind], ["CVR-3-4000000001", "Mette Eksempel", "person"]);
  assert.deepEqual(g.edges.map((e) => [e.from, e.to, e.share]), [["CVR-3-4000000001", "CVR-1-22222222", [50, 66.66]]]);
});

test("LiveProvider: afviser ejergrafen et person-ID, vises de direkte ejerskaber fra ejerrollerne (uden reelt ejerskab)", async () => {
  const client = {
    async relationsGraph() {
      throw new LassoApiError(400, { errorMessage: "Invalid id" }, "x");
    },
    async person() {
      return PERSON;
    },
    async personHistory() {
      throw new LassoApiError(404, null, "x");
    },
  } as unknown as LassoClient;
  const g = await new LiveProvider(client, loadConfig({})).ownershipGraph("CVR-3-4000000001", { ingoingDepth: 0, outgoingDepth: 2 });
  assert.equal(g.nodes.find((n) => n.root)?.kind, "person");
  assert.deepEqual(g.edges.map((e) => [e.from, e.to, e.share]), [["CVR-3-4000000001", "CVR-1-22222222", [50, 66.66]]]);
  assert.equal(g.outgoingDepth, 1);
  assert.match(g.note ?? "", /direkte ejerskaber/);
});

test("LiveProvider: nyheder om en person kommer fra Lasso News med person-ID'et; Paqle spørges ikke", async () => {
  const calls: string[] = [];
  const client = {
    async lassoNews(ids: string[], opts: { limit?: number }) {
      calls.push(`lassoNews:${ids.join(",")}:${opts.limit}`);
      return [{ headline: "{Mette Eksempel|CVR-3-4000000001} indtræder i bestyrelsen for {HOLM HOLDING ApS|CVR-1-22222222}", time: "2026-09-20T07:15:00Z", type: "Board", provider: "VIRK" }];
    },
    async news(id: string) {
      calls.push(`paqle:${id}`);
      return { news: [] };
    },
  } as unknown as LassoClient;
  const provider = new LiveProvider(client, loadConfig({}));
  const n = await provider.news("CVR-3-4000000001", 5);
  assert.deepEqual(calls, ["lassoNews:CVR-3-4000000001:5"]);
  assert.equal(n.items[0]!.headline, "Mette Eksempel indtræder i bestyrelsen for HOLM HOLDING ApS");
  // En virksomhed spørger stadig begge kilder.
  await provider.news("CVR-1-22222222", 5);
  assert.ok(calls.includes("paqle:CVR-1-22222222"));
});

test("demo: personens ejergraf har personen som rod og de ejede selskabers datterselskaber i lag 2", async () => {
  const demo = new DemoProvider();
  const [bo] = await demo.findPersons("Bo Eksempel", 1);
  const g = await demo.ownershipGraph(bo!.lassoId, { ingoingDepth: 0, outgoingDepth: 2 });
  assert.equal(g.rootId, bo!.lassoId);
  assert.deepEqual(g.nodes.filter((n) => n.root).map((n) => [n.name, n.kind]), [["Bo Eksempel", "person"]]);
  assert.deepEqual(g.edges.filter((e) => e.from === bo!.lassoId).map((e) => [e.to, e.share]), [["CVR-1-99000010", [100, 100]]]);
  assert.ok(g.edges.filter((e) => e.from === "CVR-1-99000010").length > 5, "holdingens datterselskaber i lag 2");
  assert.ok(g.nodes.every((n) => /Eksempel|Prøve/.test(n.name)));
  // Kun ét lag: ingen datterselskaber.
  const one = await demo.ownershipGraph(bo!.lassoId, { ingoingDepth: 0, outgoingDepth: 1 });
  assert.equal(one.edges.length, 1);
  // En person uden ejerskaber har en graf med kun roden.
  const [ida] = await demo.findPersons("Ida Prøve", 1);
  assert.equal((await demo.ownershipGraph(ida!.lassoId, { ingoingDepth: 0, outgoingDepth: 2 })).edges.length, 0);
});
