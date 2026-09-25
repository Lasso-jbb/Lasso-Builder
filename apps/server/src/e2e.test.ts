/**
 * Ende-til-ende: starter serveren i processen (demodata, hukommelses-store,
 * eller Postgres hvis TEST_DATABASE_URL er sat) og taler MCP over HTTP som
 * Claude/ChatGPT ville gøre.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { DATASET_META_KEY, type Dataset, type ViewSpec } from "@lasso/spec";

process.env.LASSO_NO_MAIN = "1";
const { createApp } = await import("./index.js");
const { loadConfig } = await import("./config.js");
const { LassoClient } = await import("./lasso/client.js");
const { DemoProvider } = await import("./data/demo.js");
const { createViewStore } = await import("./views/store.js");

const KEY = "test-mcp-key";
const ADMIN = "test-admin-key";
let http: Server;
let base = "";
let client: Client;

before(async () => {
  const config = loadConfig({
    ...process.env,
    MCP_ACCESS_KEY: KEY,
    ADMIN_API_KEY: ADMIN,
    LASSO_DATA_SOURCE: "demo",
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    PUBLIC_BASE_URL: "http://placeholder",
  });
  const store = createViewStore(config.DATABASE_URL);
  await store.migrate();
  const app = createApp({ config, client: new LassoClient(config), provider: new DemoProvider(), store });
  http = app.listen(0);
  await new Promise((r) => http.once("listening", r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  config.publicBaseUrl = base;
  client = new Client({ name: "e2e", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp?key=${KEY}`)));
});

after(async () => {
  await client?.close();
  await new Promise((r) => http.close(r));
});

test("/mcp kræver nøgle", async () => {
  const res = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(res.status, 401);
});

test("health svarer", async () => {
  const res = await fetch(`${base}/health`);
  const body = (await res.json()) as { status: string; dataSource: string };
  assert.equal(res.status, 200);
  assert.equal(body.dataSource, "demo");
});

test("tools og UI-ressource er registreret", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["render_view", "resolve_view", "save_view", "search_companies", "show_company"]);
  const show = tools.find((t) => t.name === "show_company")!;
  assert.equal((show._meta as { ui?: { resourceUri?: string } }).ui?.resourceUri, "ui://lasso/view.html");
  const resolveTool = tools.find((t) => t.name === "resolve_view")!;
  assert.deepEqual((resolveTool._meta as { ui?: { visibility?: string[] } }).ui?.visibility, ["app"]);
  const res = await client.readResource({ uri: "ui://lasso/view.html" });
  const content = res.contents[0] as { mimeType?: string; text?: string };
  assert.equal(content.mimeType, "text/html;profile=mcp-app");
  assert.ok(content.text && content.text.length > 1000, "view.html skal være bygget");
});

test("search_companies filtrerer, sorterer og lægger data i _meta", async () => {
  const res = await client.callTool({
    name: "search_companies",
    arguments: {
      query: "",
      criteria: [
        { field: "region", operator: "eq", value: "Midtjylland" },
        { field: "ansatte", operator: "gte", value: 10 },
      ],
      sort: { field: "bruttofortjeneste", direction: "desc" },
      limit: 5,
    },
  });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const spec = (res.structuredContent as { spec: ViewSpec }).spec;
  assert.equal(spec.kind, "list");
  assert.equal(spec.criteria.length, 2);
  const ds = (res._meta as Record<string, Dataset>)[DATASET_META_KEY]!;
  const search = Object.values(ds.searches)[0]!;
  assert.ok(search.rows.length > 0 && search.rows.length <= 5);
  assert.ok(search.rows.every((r) => r.region === "Midtjylland" && (r.employees ?? 0) >= 10));
  const gp = search.rows.map((r) => r.grossProfit ?? 0);
  assert.deepEqual(gp, [...gp].sort((a, b) => b - a));
  const text = (res.content as { type: string; text: string }[])[0]!.text;
  assert.match(text, /Demodata/);
});

test("search_companies afviser ugyldige kriterier med forklaring", async () => {
  const res = await client.callTool({ name: "search_companies", arguments: { criteria: [{ field: "region", operator: "gt", value: "Midt" }] } });
  assert.equal(res.isError, true);
  assert.match((res.content as { text: string }[])[0]!.text, /Operator 'gt' passer ikke/);
});

test("show_company tager et rent CVR-nummer og giver låst skabelon", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "99000001" } });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const spec = (res.structuredContent as { spec: ViewSpec }).spec;
  assert.equal(spec.title, "Eksempel Byg A/S");
  assert.deepEqual(
    spec.components.map((c) => c.type),
    ["LassoCompanyHead", "LassoKeyFigureCards", "LassoBarChart", "LassoPersonList", "LassoOwnerList", "LassoFollowUps"],
  );
  const ds = (res._meta as Record<string, Dataset>)[DATASET_META_KEY]!;
  assert.equal(ds.companies["CVR-1-99000001"]?.name, "Eksempel Byg A/S");
  assert.ok(ds.financials["CVR-1-99000001"]!.years.length >= 5);
});

test("show_company tager et navn og siger, hvad den valgte", async () => {
  const res = await client.callTool({
    name: "show_company",
    arguments: { company: "Eksempel Byg", sections: ["header", "noegletal", "graf"], chart_metric: "omsaetning", years: 10 },
  });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const spec = (res.structuredContent as { spec: ViewSpec }).spec;
  assert.equal(spec.title, "Eksempel Byg A/S");
  assert.deepEqual(spec.components.map((c) => c.type), ["LassoCompanyHead", "LassoKeyFigureCards", "LassoBarChart"]);
  const text = (res.content as { type: string; text: string }[]).map((c) => c.text).join("\n");
  assert.match(text, /Fundet ud fra navnet "Eksempel Byg": Eksempel Byg A\/S \(99000001\)/);
  // Værter, der kun giver modellen structuredContent, skal også se resuméet.
  const summary = (res.structuredContent as { summary: string }).summary;
  assert.match(summary, /Fundet ud fra navnet/);
  assert.match(summary, /Regnskab \d{4}:/);
  assert.match(summary, /Stamoplysninger: form A\/S; adresse Prøvevej 1, 8600 Silkeborg; kommune Silkeborg/);
  assert.match(summary, /Omsætning \d{4}–\d{4} \(mio\. kr\.\): \d{4} [\d,]+/);
  assert.match((res.structuredContent as { card: string }).card, /STAMOPLYSNINGER/);
});

test("show_company giver et signeret link til en interaktiv side med friske data", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "99000001", chart_metric: "omsaetning", years: 10 } });
  const link = (res.structuredContent as { link: string }).link;
  assert.match(link, /\/k\/99000001\?m=omsaetning&y=10&e=\w+&s=[\w-]{22}$/);
  assert.match((res.content as { text: string }[])[0]!.text, /Interaktiv Lasso-visning \(link til brugeren\): http/);
  const page = await fetch(link);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<title>Eksempel Byg A\/S, Lasso<\/title>/);
  const boot = /window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(html)![1]!;
  assert.match(boot, /"LassoBarChart"/);
  assert.doesNotMatch(boot, /"LassoFollowUps"/);
  const forged = await fetch(link.replace("/k/99000001", "/k/99000002"));
  assert.equal(forged.status, 403);
});

test("show_company giver en brugbar fejl for ukendt navn", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "Findes Ikke Nogen Steder" } });
  assert.equal(res.isError, true);
});

test("show_company giver en brugbar fejl for ukendt virksomhed", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "12345678" } });
  assert.equal(res.isError, true);
});

test("render_view tegner fri komposition", async () => {
  const res = await client.callTool({
    name: "render_view",
    arguments: {
      title: "Byg vs. Transport",
      layout: "grid-2",
      components: [
        { type: "LassoCompareTable", companies: ["99000001", "99000004"] },
        { type: "LassoBarChart", company: "99000001", metric: "omsaetning", years: 5 },
      ],
    },
  });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const ds = (res._meta as Record<string, Dataset>)[DATASET_META_KEY]!;
  assert.ok(ds.companies["CVR-1-99000004"]);
});

test("save_view gemmer, opdaterer samme adresse og viser siden med friske data", async () => {
  const shown = await client.callTool({ name: "show_company", arguments: { company: "99000002", sections: ["noegletal"] } });
  const spec = (shown.structuredContent as { spec: ViewSpec }).spec;
  const first = await client.callTool({ name: "save_view", arguments: { spec, name: "Revisor Midt", slug: "Revisor Midt" } });
  assert.ok(!first.isError, JSON.stringify(first.content));
  const saved = first.structuredContent as { url: string; slug: string; version: number };
  assert.equal(saved.slug, "revisor-midt");
  const again = await client.callTool({ name: "save_view", arguments: { spec, slug: "revisor-midt" } });
  assert.equal((again.structuredContent as { version: number }).version, saved.version + 1);

  const page = await fetch(saved.url);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /window\.__LASSO_BOOT__=/);
  assert.match(html, /Eksempel Revision Midt ApS/);
  assert.doesNotMatch(html, /<\/script><script>alert/);

  const api = await fetch(`${base}/api/views/lasso-demo/revisor-midt`);
  assert.equal(((await api.json()) as { name: string }).name, "Revisor Midt");
});

test("resolve_view (kun app) henter data til drill-down", async () => {
  const shown = await client.callTool({ name: "show_company", arguments: { company: "99000008" } });
  const spec = (shown.structuredContent as { spec: ViewSpec }).spec;
  const res = await client.callTool({ name: "resolve_view", arguments: { spec } });
  const sc = res.structuredContent as { dataset: Dataset };
  assert.ok(sc.dataset.people["CVR-1-99000008"]!.length > 0);
});

test("/api/views POST kræver admin-nøgle", async () => {
  const res = await fetch(`${base}/api/views`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(res.status, 401);
  const ok = await fetch(`${base}/api/views`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": ADMIN },
    body: JSON.stringify({ spec: { title: "API-test", components: [{ type: "LassoCompanyHead", company: "99000003" }] } }),
  });
  assert.equal(ok.status, 201);
});

test("ukendt delt side giver 404 med pæn side", async () => {
  const res = await fetch(`${base}/v/lasso-demo/findes-ikke`);
  assert.equal(res.status, 404);
  assert.match(await res.text(), /Visningen findes ikke/);
});
