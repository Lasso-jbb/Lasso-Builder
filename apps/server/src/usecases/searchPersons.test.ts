import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { personSearchKey } from "@lasso/spec";
import { DemoProvider } from "../data/demo.js";
import { textCard } from "../data/card.js";
import { createMcpServer, type McpContext } from "../mcp/server.js";
import { searchPersons, type UseCaseCtx, type ViewData } from "./index.js";

const ctx = { provider: new DemoProvider() } as UseCaseCtx;
const ok = (r: ViewData | { error: string }): ViewData => {
  assert.ok(!("error" in r), "error" in r ? r.error : "");
  return r;
};
const rowsOf = (v: ViewData, limit = 25) => v.dataset.personSearches![personSearchKey({ query: (v.spec.components[0] as { query: string }).query, limit })]!.rows;

test("search_persons: flere træf giver en LassoPersonTable og en valgnote", async () => {
  const v = ok(await searchPersons(ctx, { query: "Eksempel" }));
  assert.equal(v.spec.components[0]!.type, "LassoPersonTable");
  const rows = rowsOf(v);
  assert.ok(rows.length > 1);
  assert.match(v.note!, /show_person/);
  assert.ok(textCard(v.spec, v.dataset)!.includes(rows[0]!.name));
});

test("search_persons: role-filter beholder kun personer med den type aktiv rolle", async () => {
  const all = rowsOf(ok(await searchPersons(ctx, { query: "Eksempel" })));
  const owners = rowsOf(ok(await searchPersons(ctx, { query: "Eksempel", role: "ejer" })));
  assert.ok(owners.length > 0 && owners.length < all.length);
  for (const r of owners) assert.ok(r.roles.some((x) => /ejer/.test(x.role)), r.name);
  const board = rowsOf(ok(await searchPersons(ctx, { query: "Eksempel", role: "bestyrelse" })));
  for (const r of board) assert.ok(r.roles.some((x) => /bestyrelse/.test(x.role)), r.name);
});

test("search_persons: city-filter og alle = ingen filtrering", async () => {
  const all = rowsOf(ok(await searchPersons(ctx, { query: "Eksempel" })));
  const same = rowsOf(ok(await searchPersons(ctx, { query: "Eksempel", role: "alle" })));
  assert.equal(same.length, all.length);
  const city = all.find((r) => r.city)?.city;
  if (city) for (const r of rowsOf(ok(await searchPersons(ctx, { query: "Eksempel", city: city.toUpperCase() })))) assert.equal(r.city, city);
  assert.equal(rowsOf(ok(await searchPersons(ctx, { query: "Eksempel", city: "Findes ikke by" }))).length, 0);
});

test("search_persons: 0 træf giver en note og ingen fejl", async () => {
  const v = ok(await searchPersons(ctx, { query: "Zzzzqx" }));
  assert.equal(rowsOf(v).length, 0);
  assert.match(v.note!, /Ingen personer fundet på "Zzzzqx"\. Prøv et kortere navn\./);
  assert.match(textCard(v.spec, v.dataset)!, /Ingen personer matcher/);
});

test("search_persons: ét præcist træf nævner show_person med Lasso-ID", async () => {
  const v = ok(await searchPersons(ctx, { query: "Anne Eksempel" }));
  const rows = rowsOf(v);
  assert.equal(rows.length, 1);
  assert.match(v.note!, /show_person/);
  assert.ok(v.note!.includes(rows[0]!.lassoId));
});

test("search_persons: limit begrænser rækkerne, og for kort navn afvises", async () => {
  assert.equal(rowsOf(ok(await searchPersons(ctx, { query: "Eksempel", limit: 2 })), 2).length, 2);
  assert.ok("error" in (await searchPersons(ctx, { query: "A" })));
});

test("search_persons-tool: skemaet afviser query under 2 tegn", async () => {
  const server = createMcpServer({ provider: new DemoProvider() } as unknown as McpContext);
  const client = new Client({ name: "t", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    const bad = await client.callTool({ name: "search_persons", arguments: { query: "A" } }).then(
      (r) => Boolean(r.isError),
      () => true,
    );
    assert.ok(bad);
  } finally {
    await client.close();
    await server.close();
  }
});
