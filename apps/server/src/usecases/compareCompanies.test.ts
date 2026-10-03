import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { COMPARE_TABLE_NOTE } from "@lasso/spec";
import { DemoProvider } from "../data/demo.js";
import { createMcpServer, type McpContext } from "../mcp/server.js";
import { compareCompanies, type UseCaseCtx, type ViewData } from "./index.js";

const ctx = { provider: new DemoProvider(), config: { LASSO_COMPANY_ID_PREFIX: "CVR-1-" } } as unknown as UseCaseCtx;
const ok = (r: ViewData | { error: string }): ViewData => {
  assert.ok(!("error" in r), "error" in r ? r.error : "");
  return r;
};
const types = (v: ViewData) => v.spec.components.map((c) => c.type);

test("compare_companies: to navne slås op og giver tabel, linjegraf og opfølgninger", async () => {
  const v = ok(await compareCompanies(ctx, { companies: ["Eksempel Byg", "Eksempel Transport"] }));
  assert.deepEqual(types(v), ["LassoCompareTable", "LassoLineChart", "LassoFollowUps"]);
  const table = v.spec.components[0] as { companies: string[] };
  assert.deepEqual(table.companies, ["CVR-1-99000001", "CVR-1-99000004"]);
  assert.match(v.note!, /"Eksempel Byg" = Eksempel Byg A\/S \(99000001\)/);
  assert.equal(v.dataset.companies["CVR-1-99000004"]?.name, "Eksempel Transport A/S");
});

test("compare_companies: tvetydigt navn giver note med alternativer, ikke fejl", async () => {
  const v = ok(await compareCompanies(ctx, { companies: ["Eksempel Revision", "99000001"] }));
  assert.match(v.note!, /Andre match: Eksempel Revision/);
  assert.match(v.note!, /compare_companies igen med CVR-numrene/);
});

test("compare_companies: 'hvem er størst' giver rangering og tabel", async () => {
  const v = ok(await compareCompanies(ctx, { companies: ["99000001", "99000004", "99000008"], question: "Hvem er størst?" }));
  assert.deepEqual(types(v), ["LassoRanking", "LassoCompareTable"]);
});

test("compare_companies: over 3 virksomheder giver rangering og note om de 3 største (Jakob 01.10)", async () => {
  const cvrs = ["99000001", "99000002", "99000003", "99000004", "99000005", "99000006", "99000007", "99000008"];
  const v = ok(await compareCompanies(ctx, { companies: cvrs }));
  assert.deepEqual(types(v), ["LassoRanking", "LassoCompareTable"]);
  assert.equal((v.spec.components[1] as { companies: string[] }).companies.length, 3);
  assert.ok(v.note!.includes(COMPARE_TABLE_NOTE));
});

test("compare_companies: navn uden match udelades; under 2 tilbage er en fejl", async () => {
  const v = ok(await compareCompanies(ctx, { companies: ["Findes Slet Ikke Zzz", "99000001", "99000002"] }));
  assert.match(v.note!, /Fandt ingen virksomhed, der hedder "Findes Slet Ikke Zzz"/);
  assert.equal((v.spec.components[0] as { companies: string[] }).companies.length, 2);
  const r = await compareCompanies(ctx, { companies: ["Findes Slet Ikke Zzz", "99000001"] });
  assert.ok("error" in r);
});

test("compare_companies-tool: skemaet afviser under 2 og over 10 virksomheder", async () => {
  const server = createMcpServer({ provider: new DemoProvider(), config: { LASSO_COMPANY_ID_PREFIX: "CVR-1-", publicBaseUrl: "http://localhost" } } as unknown as McpContext);
  const client = new Client({ name: "t", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const rejected = (companies: string[]) =>
    client.callTool({ name: "compare_companies", arguments: { companies } }).then(
      (r) => Boolean(r.isError),
      () => true,
    );
  try {
    assert.ok(await rejected(["99000001"]));
    assert.ok(await rejected(Array.from({ length: 11 }, (_, i) => String(99000001 + i))));
  } finally {
    await client.close();
    await server.close();
  }
});
