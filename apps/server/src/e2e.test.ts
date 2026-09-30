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
const { createSavedPageStore } = await import("./pages/store.js");

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
  const pages = createSavedPageStore(config.DATABASE_URL);
  await pages.migrate();
  const app = createApp({ config, client: new LassoClient(config), provider: new DemoProvider(), store, pages });
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
  assert.deepEqual(names, ["compare_companies", "describe_components", "list_saved_pages", "remove_saved_page", "render_view", "resolve_view", "save_page", "save_view", "search_companies", "search_persons", "show_company", "show_person"]);
  const show = tools.find((t) => t.name === "show_company")!;
  const uri = (show._meta as { ui?: { resourceUri?: string } }).ui?.resourceUri ?? "";
  // Adressen bærer app-versionen, så værten ikke genbruger en gemt, forældet render-app.
  assert.match(uri, /^ui:\/\/lasso\/view-[0-9a-f]{10}\.html$/);
  const resolveTool = tools.find((t) => t.name === "resolve_view")!;
  assert.deepEqual((resolveTool._meta as { ui?: { visibility?: string[] } }).ui?.visibility, ["app"]);
  const res = await client.readResource({ uri });
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

test("show_company komponerer ét skærmbillede ud fra data og hensigt", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "99000001" } });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const spec = (res.structuredContent as { spec: ViewSpec }).spec;
  assert.equal(spec.title, "Eksempel Byg A/S");
  assert.equal(spec.layout, "columns");
  assert.equal(spec.components[0]!.type, "LassoCompanyHead");
  assert.ok(spec.components.some((c) => c.type === "LassoKeyFigureCards"));
  assert.ok(spec.components.some((c) => c.column), "overblikket har kolonner");
  const ds = (res._meta as Record<string, Dataset>)[DATASET_META_KEY]!;
  assert.equal(ds.companies["CVR-1-99000001"]?.name, "Eksempel Byg A/S");
  assert.ok(ds.financials["CVR-1-99000001"]!.years.length >= 5);

  const eco = await client.callTool({ name: "show_company", arguments: { company: "99000001", focus: "oekonomi" } });
  const ecoSpec = (eco.structuredContent as { spec: ViewSpec }).spec;
  assert.ok(ecoSpec.components.some((c) => c.type === "LassoGroupedBarChart" || c.type === "LassoBarChart"), "mange år giver en graf");
  // Ø13/B8 (A13): flerårstabellen med 10 år findes kun i ⅔ (vandret rulning i ½) og står ikke længere inden for
  // højdebudgettet ved siden af regnskabslisten; "vis alt" (show_all) viser den.
  const mt = ecoSpec.components.find((c) => c.type === "LassoMultiYearTable");
  assert.ok(!mt?.width || mt.width === "two-thirds" || mt.width === "full", `flerårstabellen står aldrig under ⅔: ${mt?.width}`);
  const ecoAll = await client.callTool({ name: "show_company", arguments: { company: "99000001", focus: "oekonomi", show_all: true } });
  assert.ok((ecoAll.structuredContent as { spec: ViewSpec }).spec.components.some((c) => c.type === "LassoMultiYearTable"), "4+ år giver flerårstabel (vis alt)");
});

test("show_all (vis alt om X, brugervalg): show_company og show_person går ud over højdebudgettet", async () => {
  const { tools } = await client.listTools();
  for (const name of ["show_company", "show_person"]) {
    const t = tools.find((x) => x.name === name)!;
    const prop = (t.inputSchema.properties as Record<string, { type?: string; description?: string }>).show_all;
    assert.equal(prop?.type, "boolean", name);
    assert.match(prop!.description ?? "", /alt\/det hele/);
    assert.ok(!(t.inputSchema.required ?? []).includes("show_all"), "valgfri");
  }
  const types = (r: Awaited<ReturnType<typeof client.callTool>>) => (r.structuredContent as { spec: ViewSpec }).spec.components.map((c) => c.type);
  const std = types(await client.callTool({ name: "show_company", arguments: { company: "99000001" } }));
  const all = types(await client.callTool({ name: "show_company", arguments: { company: "99000001", show_all: true } }));
  assert.ok(all.length > std.length, `vis alt viser flere elementer: ${std.join(",")} -> ${all.join(",")}`);
  for (const t of std) assert.ok(all.includes(t), `${t} står også med vis alt`);
  const person = await client.callTool({ name: "show_person", arguments: { person: "CVR-3-4000000002", show_all: true } });
  assert.ok(!person.isError, JSON.stringify(person.content));
  assert.ok(client.getInstructions()?.includes("show_all: true"));
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

test("show_person (katalog 16) finder en person på navn og komponerer personsiden", async () => {
  const res = await client.callTool({ name: "show_person", arguments: { person: "Bo Eksempel" } });
  assert.equal(res.isError, undefined);
  const sc = res.structuredContent as { spec: ViewSpec; card: string; link: string; summary: string };
  assert.equal(sc.spec.kind, "person");
  assert.deepEqual(
    sc.spec.components.map((c) => `${c.type}${c.column ? `@${c.column}` : ""}${c.width ? `/${c.width}` : ""}`),
    // Overblik (standard, Ø13/B10): Papers elementer, pakket efter bredderne: aktive roller alene i fuld bredde,
    // netværket i eget fuldbånd og historik ⅓ | ejerskab ⅔; stamoplysninger og risiko er udgået (Jakob 30.09).
    [
      "LassoPersonHead",
      "LassoPersonRoles",
      "LassoPersonNetwork",
      "LassoTimeline@1/third",
      "LassoOwnershipDiagram@2/two-thirds",
      "LassoFollowUps",
    ],
  );
  const roles = sc.spec.components.find((c) => c.type === "LassoPersonRoles");
  assert.equal(roles?.type === "LassoPersonRoles" && roles.show, "current");
  assert.match(sc.summary, /Fundet ud fra navnet "Bo Eksempel"/);
  assert.match(sc.summary, /Aktive roller: Eksempel Holding ApS \[CVR-1-99000010\]: Direktør, ejer 100 %, siden 2005/);
  assert.doesNotMatch(sc.summary, /Stamoplysninger:/, "stamoplysningerne er udgået");
  assert.match(sc.summary, /Historik \(seneste 3 af \d+\): 02\.02\.2026 Eksempel Energi A\/S kom under konkurs/);
  assert.doesNotMatch(sc.summary, /Nyheder om personen/, "nyhederne står på fokus historik");
  assert.match(sc.summary, /Ejerskab: ejer direkte Eksempel Holding ApS 100 %/);
  // "År sammen" er den længste sammenhængende periode, ikke summen over selskaber.
  assert.match(sc.summary, /Vera Eksempel \(13 år, 1 fælles selskaber\)/);
  assert.match(sc.card, /SIDDER SAMMEN MED/);
  for (const section of ["AKTIVE ROLLER", "HISTORIK", "EJERSKAB"]) assert.match(sc.card, new RegExp(section));
  assert.doesNotMatch(sc.card, /NYHEDER/);
  // Stamoplysningerne og risikosektionen er udgået (som på siden).
  assert.doesNotMatch(sc.card, /STAMOPLYSNINGER|RISIKO|Første reg\./);
  // Op til seks forskellige spørgsmål (followUps.ts), ét pr. emne, med personens eget selskab.
  const labels = sc.spec.components.flatMap((c) => (c.type === "LassoFollowUps" ? c.prompts.map((p) => p.label) : []));
  assert.ok(labels.length >= 4 && labels.length <= 6, labels.join(" | "));
  assert.equal(new Set(labels).size, labels.length);
  assert.doesNotMatch(sc.card, /Prøvevej/, "aldrig gade og husnummer for en person");
  assert.match(sc.link, /\/p\/CVR-3-\d+\?e=\w+&s=[\w-]{22}$/);
  const page = await fetch(sc.link);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /"LassoPersonRoles"/);
  const forged = await fetch(sc.link.replace(/CVR-3-(\d+)/, (_, n: string) => `CVR-3-${Number(n) + 1}`));
  assert.equal(forged.status, 403);
});

test("show_person med focus: risiko henter og viser kun forløbet i selskaberne (ingen risikosektion); linket åbner samme fokus", async () => {
  const res = await client.callTool({ name: "show_person", arguments: { person: "CVR-3-4000000002", focus: "risiko" } });
  assert.equal(res.isError, undefined);
  const sc = res.structuredContent as { spec: ViewSpec; card: string; link: string; summary: string };
  assert.equal(sc.spec.subtitle, "Risiko");
  assert.deepEqual(
    sc.spec.components.map((c) => c.type),
    ["LassoPersonHead", "LassoTimeline", "LassoFollowUps"],
  );
  const dataset = (res._meta as Record<string, { news: object; ownershipGraphs: object; personNetworks: object }>)[DATASET_META_KEY]!;
  assert.deepEqual(Object.keys(dataset.news), [], "ingen nyheder hentet på risiko");
  assert.deepEqual(Object.keys(dataset.ownershipGraphs), [], "intet ejerdiagram hentet på risiko");
  assert.deepEqual(Object.keys(dataset.personNetworks), [], "intet netværk hentet på risiko");
  assert.match(sc.summary, /Forløb i selskaberne med konkurs eller tvangsopløsning \(seneste 3 af 3\)/);
  assert.match(sc.card, /FORLØB I SELSKABERNE/);
  for (const section of ["STAMOPLYSNINGER", "RISIKO", "NYHEDER", "SIDDER SAMMEN MED", "EJERSTRUKTUR"]) assert.doesNotMatch(sc.card, new RegExp(section));
  assert.match(sc.link, /\/p\/CVR-3-4000000002\?e=\w+&f=risiko&s=[\w-]{22}$/);
  const page = await fetch(sc.link);
  assert.equal(page.status, 200);
  // Sidens boot-data (ikke render-appens kode, som nævner alle komponenter).
  const boot = /window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(await page.text())![1]!;
  assert.match(boot, /"filter":"risiko"/);
  assert.doesNotMatch(boot, /"LassoNews"/);
  assert.doesNotMatch(boot, /"LassoPersonRisk"|"LassoPersonFacts"/);
  // Et andet fokus med samme signatur afvises.
  assert.equal((await fetch(sc.link.replace("f=risiko", "f=historik"))).status, 403);

  const hist = await client.callTool({ name: "show_person", arguments: { person: "Bo Eksempel", focus: "historik" } });
  const h = hist.structuredContent as { spec: ViewSpec; card: string; summary: string };
  assert.deepEqual(h.spec.components.map((c) => `${c.type}${c.column ? `@${c.column}` : ""}`), ["LassoPersonHead", "LassoTimeline@1", "LassoNews@2", "LassoFollowUps"]);
  assert.match(h.summary, /Nyheder om personen/);
  assert.match(h.card, /NYHEDER/);

  const net = await client.callTool({ name: "show_person", arguments: { person: "Bo Eksempel", focus: "netvaerk" } });
  const n = net.structuredContent as { spec: ViewSpec; card: string };
  assert.deepEqual(n.spec.components.map((c) => c.type), ["LassoPersonHead", "LassoPersonNetwork", "LassoFollowUps"]);
  assert.match(n.card, /SIDDER SAMMEN MED/);

  const bad = await client.callTool({ name: "show_person", arguments: { person: "Bo Eksempel", focus: "oekonomi" } });
  assert.equal(bad.isError, true);
});

test("show_person afviser CVR-numre og ukendte navne med en brugbar fejl", async () => {
  const cvr = await client.callTool({ name: "show_person", arguments: { person: "99000001" } });
  assert.equal(cvr.isError, true);
  assert.match((cvr.content as { text: string }[])[0]!.text, /show_company/);
  const none = await client.callTool({ name: "show_person", arguments: { person: "Findes Ikke Nogen" } });
  assert.equal(none.isError, true);
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

test("render_view slår virksomhedsnavne op som show_company (review P1-7)", async () => {
  const res = await client.callTool({
    name: "render_view",
    arguments: { title: "Byg vs. Revision", components: [{ type: "LassoCompareTable", companies: ["Eksempel Byg", "99000002"] }] },
  });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const sc = res.structuredContent as { spec: ViewSpec };
  const table = sc.spec.components[0] as { companies: string[] };
  assert.deepEqual(table.companies, ["CVR-1-99000001", "CVR-1-99000002"]);
  assert.match((res.content as { text: string }[])[0]!.text, /"Eksempel Byg" = Eksempel Byg A\/S \(99000001\)/);
});

test("delelinket fra en økonomi-visning åbner økonomi-visningen (review P2-7)", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "99000001", focus: "oekonomi" } });
  const link = (res.structuredContent as { link: string }).link;
  assert.match(link, /&f=oekonomi/);
  const html = await (await fetch(link)).text();
  const boot = /window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(html)![1]!;
  assert.match(boot, /"subtitle":"Økonomi"/);
});

test("instruktionerne er korte og uden dubletter af katalog og søgefelter (review P1-6)", async () => {
  const instr = client.getInstructions() ?? "";
  assert.ok(instr.length < 5000, `instruktioner: ${instr.length} tegn`);
  assert.doesNotMatch(instr, /grid-2/);
  assert.match(instr, /show_person/);
  for (const f of ["overblik", "oekonomi", "regnskab", "ejerskab", "ledelse", "risiko", "historik", "kontakt"]) assert.match(instr, new RegExp(`'${f}'`));
  // Personfokus til show_person.
  for (const f of ["roller", "netvaerk"]) assert.match(instr, new RegExp(`'${f}'`));
  assert.match(instr, /show_person med navn eller person-ID \(CVR-3-…\)\. Vælg focus/);
  const person = (await client.listTools()).tools.find((t) => t.name === "show_person")!;
  assert.deepEqual((person.inputSchema.properties as Record<string, { enum?: string[] }>).focus?.enum, ["overblik", "roller", "netvaerk", "ejerskab", "risiko", "historik"]);
  assert.doesNotMatch(instr, /Komponentindeks/);
  const { tools } = await client.listTools();
  const summary = (await client.callTool({ name: "show_company", arguments: { company: "99000001" } })).content as { text: string }[];
  assert.doesNotMatch(summary[0]!.text, /ved en virksomhed altid/);
  assert.ok(tools.find((t) => t.name === "render_view")!.description!.includes("Komponentindeks"));
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

/* ---------- Spørgsmålet styrer formen (question på show_company og show_person) ---------- */

const texts = (res: Awaited<ReturnType<Client["callTool"]>>) => (res.content as { text: string }[]).map((c) => c.text);
const bootOf = async (link: string) => JSON.parse(/window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(await (await fetch(link)).text())![1]!) as { spec: ViewSpec };

test("show_company og show_person tager question (og metrics); instruktionerne beder om spørgsmålet ordret", async () => {
  const { tools } = await client.listTools();
  const props = (name: string) => (tools.find((t) => t.name === name)!.inputSchema.properties ?? {}) as Record<string, { type?: string; maxLength?: number; description?: string }>;
  assert.equal(props("show_company").question?.maxLength, 300);
  assert.match(props("show_company").question?.description ?? "", /Brugerens spørgsmål ordret/);
  assert.ok(props("show_company").metrics);
  assert.match(props("show_company").focus?.description ?? "", /Sæt kun focus, når spørgsmålet er generelt/);
  assert.equal(props("show_person").question?.maxLength, 300);
  assert.match(client.getInstructions() ?? "", /Send altid brugerens spørgsmål ordret i question\./);
});

test("show_company 'hvad er soliditetsgraden': kort med soliditetsgraden først, linjegraf, en hel side; resuméet svarer først", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "Eksempel Byg", question: "Hvad er soliditetsgraden i Eksempel Byg?" } });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const sc = res.structuredContent as { spec: ViewSpec; link: string; summary: string; card?: string };
  const cards = sc.spec.components.find((c) => c.type === "LassoKeyFigureCards");
  assert.ok(cards?.type === "LassoKeyFigureCards" && cards.metrics![0] === "soliditetsgrad");
  const chart = sc.spec.components.find((c) => c.type === "LassoLineChart");
  assert.ok(chart?.type === "LassoLineChart" && chart.metric === "soliditetsgrad" && chart.column === 1);
  assert.equal(sc.spec.subtitle, "Soliditetsgrad");
  assert.ok(sc.spec.components.length >= 8, sc.spec.components.map((c) => c.type).join(", "));
  // Resuméet: "Svar:" lige efter hovedlinjen; tekstkortet svarer også først.
  const lines = texts(res)[0]!.split("\n");
  const head = lines.findIndex((l) => l.startsWith("Eksempel Byg A/S (CVR 99000001"));
  assert.match(lines[head + 1]!, /^Svar: Soliditetsgrad 2025: [\d,]+ % \(2024: [\d,]+ %\)\.$/);
  assert.match(sc.card ?? "", /SVAR[\s\S]*Soliditetsgrad 2025/);
  // Det delte link bærer spørgsmålet og åbner samme svar.
  assert.match(sc.link, /[?&]q=/);
  const boot = await bootOf(sc.link);
  assert.deepEqual(boot.spec.components.map((c) => c.type), sc.spec.components.filter((c) => c.type !== "LassoFollowUps").map((c) => c.type));
});

test("show_company 'hvordan har gælden udviklet sig': stablede søjler over 5 år; regnskabslisten deler ikke nøgletal med kortene", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "99000001", question: "Hvordan har gælden udviklet sig de sidste 5 år?" } });
  const spec = (res.structuredContent as { spec: ViewSpec }).spec;
  const chart = spec.components.find((c) => c.type === "LassoStackedBarChart");
  assert.ok(chart?.type === "LassoStackedBarChart" && chart.years === 5 && chart.column === 1);
  const cards = spec.components.find((c) => c.type === "LassoKeyFigureCards");
  assert.ok(cards?.type === "LassoKeyFigureCards" && cards.metrics![0] === "gaeld");
  for (const c of spec.components) {
    if (c.type === "LassoKeyValueList" && c.variant === "financials" && c.only) assert.ok(!c.only.some((m) => cards.metrics!.includes(m)));
  }
  assert.match(texts(res)[0]!, /Svar: Gæld i alt 2025: [^\n]+\(2024: [^;]+; 2021: /);
});

test("show_company 'hvem er direktør': personlisten med kun direktionen; resuméet svarer med navnet", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "Eksempel Byg", question: "Hvem er direktør i Eksempel Byg?" } });
  const spec = (res.structuredContent as { spec: ViewSpec }).spec;
  const list = spec.components.find((c) => c.type === "LassoPersonList");
  assert.ok(list?.type === "LassoPersonList" && list.roles === "direktion" && list.column === 1);
  assert.equal(spec.subtitle, "Direktion");
  assert.match(texts(res)[0]!, /Svar: Direktion: Anne Eksempel \(direktør\)\./);
  // Et generelt spørgsmål giver fokus-siden som før (her økonomien).
  const how = await client.callTool({ name: "show_company", arguments: { company: "99000001", question: "Hvordan går det med Eksempel Byg?" } });
  const howSpec = (how.structuredContent as { spec: ViewSpec }).spec;
  assert.equal(howSpec.subtitle, "Økonomi");
  assert.doesNotMatch(texts(how)[0]!, /Svar:/);
});

test("show_company 'er de gået konkurs': status og historik som svar; resuméet svarer med status fra hovedet", async () => {
  const res = await client.callTool({ name: "show_company", arguments: { company: "99000011", question: "Er Eksempel Energi gået konkurs?" } });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const spec = (res.structuredContent as { spec: ViewSpec }).spec;
  const lead = spec.components.find((c) => c.column === 1);
  assert.ok(lead?.type === "LassoTimeline" && lead.title === "Status og historik" && lead.kinds === undefined, JSON.stringify(lead));
  assert.match(texts(res)[0]!, /\nSvar: Status: Under konkurs\.\n/);
});

test("show_person 'sidder X i bestyrelser': kun bestyrelsesposterne; linket /p/ bærer spørgsmålet", async () => {
  const res = await client.callTool({ name: "show_person", arguments: { person: "Bo Eksempel", question: "Sidder Bo Eksempel i bestyrelser?" } });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const sc = res.structuredContent as { spec: ViewSpec; link: string };
  const roles = sc.spec.components[1];
  // Stamoplysningerne er udgået: bestyrelsesposterne står alene i eget fuldbånd.
  assert.ok(roles?.type === "LassoPersonRoles" && roles.role === "bestyrelse" && !roles.column && !roles.width);
  assert.ok(!sc.spec.components.some((c) => c.type === "LassoPersonFacts" || c.type === "LassoPersonRisk"));
  assert.equal(sc.spec.subtitle, "Bestyrelsesposter");
  assert.match(texts(res)[0]!, /Svar: Bestyrelsesposter: .*Eksempel/);
  assert.match(sc.link, /\/p\/CVR-3-\d+\?.*q=/);
  const boot = await bootOf(sc.link);
  assert.equal(boot.spec.subtitle, "Bestyrelsesposter");
});
