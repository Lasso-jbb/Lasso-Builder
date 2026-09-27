/**
 * Ende-til-ende for gem-laget (docs/gem-lag.md): save_page, list_saved_pages og remove_saved_page
 * over MCP med en nøglebundet bruger, /e/-siderne og "send til Lasso". Samme opsætning som
 * e2e.test.ts (demodata, hukommelses-store eller Postgres via TEST_DATABASE_URL). Brugerne får et
 * tilfældigt id pr. kørsel, så testene også kan køre mod en delt Postgres.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { DATASET_META_KEY, type Dataset, type SavedPageVM, type ViewSpec } from "@lasso/spec";
import type { Config } from "./config.js";

process.env.LASSO_NO_MAIN = "1";
const { createApp, sendToLassoKey } = await import("./index.js");
const { loadConfig } = await import("./config.js");
const { LassoClient } = await import("./lasso/client.js");
const { DemoProvider } = await import("./data/demo.js");
const { createViewStore } = await import("./views/store.js");
const { createSavedPageStore } = await import("./pages/store.js");
const { entityLink, sendToLassoLink, verifySendToLassoLink } = await import("./web/links.js");

const run = Math.random().toString(36).slice(2, 8);
const KEY = "test-mcp-key";
const ADMIN = "test-admin-key";
const SEND = "test-send-key";
const USER_A = { key: `noegle-a-${run}-xyz`, id: `anna-${run}`, org: "lasso" };
const USER_B = { key: `noegle-b-${run}-xyz`, id: `bo-${run}`, org: "lasso" };

let http: Server;
let base = "";
let config: Config;
let a: Client;
let b: Client;

type Text = { type: string; text: string }[];
const text = (res: { content: unknown }) => (res.content as Text).map((c) => c.text).join("\n");
const query = (url: string) => Object.fromEntries(new URL(url).searchParams);
const boot = (html: string) => /window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(html)![1]!;

async function connect(key: string): Promise<Client> {
  const client = new Client({ name: "e2e-gem", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/${encodeURIComponent(key)}`)));
  return client;
}

before(async () => {
  config = loadConfig({
    ...process.env,
    MCP_ACCESS_KEY: KEY,
    ADMIN_API_KEY: ADMIN,
    SEND_TO_LASSO_KEY: SEND,
    MCP_USER_KEYS: `${USER_A.key}:${USER_A.id}:Anna:${USER_A.org};${USER_B.key}:${USER_B.id}:Bo:${USER_B.org}`,
    LASSO_DATA_SOURCE: "demo",
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    PUBLIC_BASE_URL: "http://placeholder",
    ENTITY_PAGES_PUBLIC: "false",
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
  a = await connect(USER_A.key);
  b = await connect(USER_B.key);
});

after(async () => {
  await a?.close();
  await b?.close();
  await new Promise((r) => http.close(r));
});

test("gem-tools er registreret med rigtige hints og UI-metadata", async () => {
  const { tools } = await a.listTools();
  const byName = new Map(tools.map((t) => [t.name, t]));
  const save = byName.get("save_page")!;
  const remove = byName.get("remove_saved_page")!;
  const list = byName.get("list_saved_pages")!;
  assert.equal(save.title, "Gem side");
  assert.deepEqual((save._meta as { ui?: { visibility?: string[] } }).ui, { visibility: ["model", "app"] });
  assert.equal(save.annotations?.readOnlyHint, false);
  assert.equal(save.annotations?.destructiveHint, false);
  assert.equal(save.annotations?.idempotentHint, true);
  assert.equal(remove.title, "Fjern gemt side");
  assert.equal(remove.annotations?.destructiveHint, true);
  assert.equal(list.title, "Mine gemte sider");
  assert.match((list._meta as { ui?: { resourceUri?: string } }).ui?.resourceUri ?? "", /^ui:\/\/lasso\/view-/);
  assert.equal(list.annotations?.readOnlyHint, true);
  assert.deepEqual(Object.keys((save.inputSchema as { properties: object }).properties).sort(), ["focus", "kind", "note", "page"]);
  assert.deepEqual(Object.keys((remove.inputSchema as { properties: object }).properties), ["page"]);
  assert.deepEqual(Object.keys((list.inputSchema as { properties: object }).properties).sort(), ["kind", "limit"]);
  // Routing: "gem virksomheden" er save_page; save_view er kun delbare links.
  const instr = a.getInstructions() ?? "";
  assert.match(instr, /save_page/);
  assert.match(instr, /list_saved_pages/);
  assert.match(instr, /remove_saved_page/);
  assert.doesNotMatch(instr, /"gem": save_view/);
});

test("save_page gemmer med CVR, og igen flytter den øverst", async () => {
  const res = await a.callTool({ name: "save_page", arguments: { page: "99000001" } });
  assert.ok(!res.isError, text(res));
  const sc = res.structuredContent as { lassoId: string; kind: string; name: string; cvr?: string; savedAt: string; created: boolean; total: number; url: string };
  assert.equal(sc.lassoId, "CVR-1-99000001");
  assert.equal(sc.kind, "company");
  assert.equal(sc.name, "Eksempel Byg A/S");
  assert.equal(sc.cvr, "99000001");
  assert.equal(sc.created, true);
  assert.equal(sc.total, 1);
  assert.ok(!Number.isNaN(Date.parse(sc.savedAt)));
  assert.match(sc.url, /\/e\/CVR-1-99000001\?e=\w+&s=[\w-]{22}$/);
  assert.equal(text(res), "Gemt: Eksempel Byg A/S (CVR 99000001). Du har nu 1 gemt side.");
  assert.equal(res._meta?.[DATASET_META_KEY], undefined, "save_page viser ingen visning");

  const again = await a.callTool({ name: "save_page", arguments: { page: "CVR-1-99000001" } });
  assert.equal((again.structuredContent as { created: boolean }).created, false);
  assert.match(text(again), /^Allerede gemt, flyttet øverst: Eksempel Byg A\/S \(CVR 99000001\)\. Du har nu 1 gemt side\./);
});

test("save_page slår navne op: virksomhed som standard, person med kind", async () => {
  const co = await a.callTool({ name: "save_page", arguments: { page: "Eksempel Transport", focus: "oekonomi", note: "Ring i oktober" } });
  assert.ok(!co.isError, text(co));
  const c = co.structuredContent as { lassoId: string; name: string; url: string; total: number };
  assert.equal(c.lassoId, "CVR-1-99000004");
  assert.equal(c.name, "Eksempel Transport A/S");
  assert.equal(c.total, 2);
  assert.match(c.url, /&f=oekonomi&/);
  assert.match(text(co), /Fundet ud fra navnet "Eksempel Transport"/);

  const p = await a.callTool({ name: "save_page", arguments: { page: "Bo Eksempel", kind: "person" } });
  assert.ok(!p.isError, text(p));
  const ps = p.structuredContent as { lassoId: string; kind: string; name: string; cvr?: string; total: number; url: string };
  assert.match(ps.lassoId, /^CVR-3-\d+$/);
  assert.equal(ps.kind, "person");
  assert.equal(ps.name, "Bo Eksempel");
  assert.equal(ps.cvr, undefined);
  assert.equal(ps.total, 3);
  assert.match(text(p), new RegExp(`^Gemt: Bo Eksempel \\(${ps.lassoId}\\)\\. Du har nu 3 gemte sider\\.`));
  assert.match(ps.url, /\/e\/CVR-3-\d+\?e=/);
});

test("save_page giver brugbare fejl for ukendte navne og ugyldige ID'er", async () => {
  const none = await a.callTool({ name: "save_page", arguments: { page: "Findes Ikke Nogen Steder" } });
  assert.equal(none.isError, true);
  assert.match(text(none), /Fandt ingen virksomhed/);
  const nobody = await a.callTool({ name: "save_page", arguments: { page: "Findes Ikke Nogen", kind: "person" } });
  assert.equal(nobody.isError, true);
  assert.match(text(nobody), /Fandt ingen person/);
  const punit = await a.callTool({ name: "save_page", arguments: { page: "CVR-2-1000000000" } });
  assert.equal(punit.isError, true);
  assert.match(text(punit), /ikke et CVR-nummer eller Lasso-ID/);
  const unknown = await a.callTool({ name: "save_page", arguments: { page: "12345678" } });
  assert.equal(unknown.isError, true);
  assert.match(text(unknown), /Kunne ikke hente 12345678/);
});

test("list_saved_pages viser listen som LassoSavedPages med link pr. side", async () => {
  const res = await a.callTool({ name: "list_saved_pages", arguments: {} });
  assert.ok(!res.isError, text(res));
  const spec = (res.structuredContent as { spec: ViewSpec }).spec;
  assert.equal(spec.title, "Mine gemte sider");
  assert.equal(spec.layout, "stack");
  assert.deepEqual(spec.components, [{ type: "LassoSavedPages", kind: "all", limit: 20 }]);
  const ds = (res._meta as Record<string, Dataset>)[DATASET_META_KEY]!;
  const list = ds.savedPages["all|20"]!;
  assert.equal(list.total, 3);
  assert.equal(list.kind, "all");
  assert.equal(list.limit, 20);
  // Nyeste først: personen, så Transport, så Byg.
  assert.deepEqual(list.pages.map((p) => p.lassoId).slice(1), ["CVR-1-99000004", "CVR-1-99000001"]);
  assert.equal(list.pages[0]!.kind, "person");
  for (const p of list.pages) assert.match(p.url ?? "", new RegExp(`/e/${p.lassoId}\\?e=\\w+`));
  const transport = list.pages.find((p) => p.lassoId === "CVR-1-99000004")!;
  assert.equal(transport.note, "Ring i oktober");
  assert.equal(transport.focus, "oekonomi");
  assert.equal(transport.origin, "manual");
  assert.match(transport.url!, /&f=oekonomi&/);

  const summary = (res.structuredContent as { summary: string }).summary;
  assert.match(summary, /Gemte sider \(3 i alt, viser 3\): Bo Eksempel \(Person, CVR-3-\d+, gemt \d\d\.\d\d\.\d{4}\), Eksempel Transport A\/S \(Virksomhed, CVR 99000004, gemt/);
  const card = (res.structuredContent as { card: string }).card;
  assert.match(card, /MINE GEMTE SIDER \(3\)/);
  assert.match(card, /│ 1\. +Bo Eksempel +│/);
  assert.match(card, /Virksomhed, gemt \d\d\.\d\d\.\d{4}/);
  assert.match(card, /\n1\. Åbn: http:\/\/127\.0\.0\.1:\d+\/e\/CVR-3-/);
  assert.match(card, /\n3\. Åbn: http:\/\/127\.0\.0\.1:\d+\/e\/CVR-1-99000001\?/);
  // Selve kortet (boksen) holder kortets bredde; linkene står under det.
  const box = card.split("\n").filter((l) => /^[│┌└├]/.test(l));
  assert.ok(box.every((l) => [...l].length === 38), box.join("\n"));

  const persons = await a.callTool({ name: "list_saved_pages", arguments: { kind: "person", limit: 5 } });
  const pspec = (persons.structuredContent as { spec: ViewSpec }).spec;
  assert.equal(pspec.title, "Mine gemte personer");
  const pds = (persons._meta as Record<string, Dataset>)[DATASET_META_KEY]!;
  assert.equal(pds.savedPages["person|5"]!.pages.length, 1);
  assert.equal(pds.savedPages["person|5"]!.total, 1);
  const companies = await a.callTool({ name: "list_saved_pages", arguments: { kind: "company" } });
  assert.equal((companies.structuredContent as { spec: ViewSpec }).spec.title, "Mine gemte virksomheder");
});

test("gemte sider er personlige: en anden brugernøgle ser sin egen (tomme) liste", async () => {
  const res = await b.callTool({ name: "list_saved_pages", arguments: {} });
  const ds = (res._meta as Record<string, Dataset>)[DATASET_META_KEY]!;
  assert.equal(ds.savedPages["all|20"]!.total, 0);
  assert.match((res.structuredContent as { card: string }).card, /Ingen gemte sider endnu\./);
  assert.match((res.structuredContent as { summary: string }).summary, /Gemte sider: ingen endnu\./);
});

test("show_company, show_person og render_view sender savedIds med til Gem/Gemt-knappen", async () => {
  const saved = await a.callTool({ name: "show_company", arguments: { company: "99000001" } });
  assert.deepEqual((saved._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedIds, ["CVR-1-99000001"]);
  const notSaved = await a.callTool({ name: "show_company", arguments: { company: "99000002" } });
  assert.deepEqual((notSaved._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedIds, []);
  const other = await b.callTool({ name: "show_company", arguments: { company: "99000001" } });
  assert.deepEqual((other._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedIds, []);

  const person = await a.callTool({ name: "show_person", arguments: { person: "Bo Eksempel" } });
  const pds = (person._meta as Record<string, Dataset>)[DATASET_META_KEY]!;
  assert.equal(pds.savedIds?.length, 1);
  assert.match(pds.savedIds![0]!, /^CVR-3-/);

  const compare = await a.callTool({
    name: "render_view",
    arguments: { title: "Byg vs. Transport vs. Revision", components: [{ type: "LassoCompareTable", companies: ["99000001", "99000004", "99000002"] }] },
  });
  assert.deepEqual([...(compare._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedIds!].sort(), ["CVR-1-99000001", "CVR-1-99000004"]);
});

test("resolve_view (appen efter gem/fjern) henter listen og savedIds igen", async () => {
  const res = await a.callTool({ name: "resolve_view", arguments: { spec: { version: 2, kind: "custom", title: "Mine gemte sider", layout: "stack", components: [{ type: "LassoSavedPages" }] } } });
  const ds = (res.structuredContent as { dataset: Dataset }).dataset;
  assert.equal(ds.savedPages["all|20"]!.total, 3);
  assert.ok(ds.savedPages["all|20"]!.pages.every((p: SavedPageVM) => p.url?.includes("/e/")));
});

test("/e/<lassoId> viser virksomheds- og personsider fra gyldige links, ellers 403/410", async () => {
  const company = await fetch(entityLink(config, "CVR-1-99000001"));
  assert.equal(company.status, 200);
  assert.equal(company.headers.get("x-robots-tag"), "noindex");
  assert.equal(company.headers.get("cache-control"), "no-store");
  const html = await company.text();
  assert.match(html, /<title>Eksempel Byg A\/S, Lasso<\/title>/);
  assert.match(boot(html), /"LassoCompanyHead"/);
  assert.doesNotMatch(boot(html), /"LassoFollowUps"/);

  const eco = await fetch(entityLink(config, "CVR-1-99000001", { focus: "oekonomi" }));
  assert.equal(eco.status, 200);
  assert.match(boot(await eco.text()), /"subtitle":"Økonomi"/);

  const listed = await a.callTool({ name: "list_saved_pages", arguments: { kind: "person" } });
  const personUrl = (listed._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedPages["person|20"]!.pages[0]!.url!;
  const person = await fetch(personUrl);
  assert.equal(person.status, 200);
  assert.match(boot(await person.text()), /"LassoPersonRoles"/);

  const forged = await fetch(entityLink(config, "CVR-1-99000001").replace("CVR-1-99000001", "CVR-1-99000002"));
  assert.equal(forged.status, 403);
  const unsigned = await fetch(`${base}/e/CVR-1-99000001`);
  assert.equal(unsigned.status, 403);
  const expired = await fetch(entityLink(config, "CVR-1-99000001", {}, Date.now() - 31 * 86_400_000));
  assert.equal(expired.status, 410);
  assert.match(await expired.text(), /Linket er udløbet/);
  const missing = await fetch(entityLink(config, "CVR-1-12345678"));
  assert.equal(missing.status, 404);
});

test("remove_saved_page fjerner med ID og navn, og siger til ved ukendte", async () => {
  const byId = await a.callTool({ name: "remove_saved_page", arguments: { page: "99000001" } });
  assert.ok(!byId.isError, text(byId));
  assert.deepEqual(byId.structuredContent, { lassoId: "CVR-1-99000001", removed: true, total: 2 });
  assert.equal(text(byId), "Fjernet: Eksempel Byg A/S. Du har nu 2 gemte sider.");

  const again = await a.callTool({ name: "remove_saved_page", arguments: { page: "CVR-1-99000001" } });
  assert.ok(!again.isError);
  assert.deepEqual(again.structuredContent, { lassoId: "CVR-1-99000001", removed: false, total: 2 });
  assert.equal(text(again), "CVR-1-99000001 var ikke på listen.");

  const byName = await a.callTool({ name: "remove_saved_page", arguments: { page: "eksempel transport a/s" } });
  assert.ok(!byName.isError, text(byName));
  assert.deepEqual(byName.structuredContent, { lassoId: "CVR-1-99000004", removed: true, total: 1 });
  assert.match(text(byName), /^Fjernet: Eksempel Transport A\/S\. Du har nu 1 gemt side\./);

  // Navne matches kun mod brugerens egne gemte sider (ikke mod Lasso).
  const unknown = await a.callTool({ name: "remove_saved_page", arguments: { page: "Eksempel Revision Midt" } });
  assert.equal(unknown.isError, true);
  assert.match(text(unknown), /ingen gemt side, der hedder "Eksempel Revision Midt"/);
  const invalid = await a.callTool({ name: "remove_saved_page", arguments: { page: "CVR-2-1000000000" } });
  assert.equal(invalid.isError, true);
});

test("remove_saved_page beder om ID, når flere gemte sider passer på navnet", async () => {
  await b.callTool({ name: "save_page", arguments: { page: "99000002" } });
  await b.callTool({ name: "save_page", arguments: { page: "99000003" } });
  const res = await b.callTool({ name: "remove_saved_page", arguments: { page: "Eksempel Revision" } });
  assert.equal(res.isError, true);
  assert.match(text(res), /^Flere gemte sider passer på "Eksempel Revision": /);
  assert.match(text(res), /Eksempel Revision Midt ApS \(CVR 99000002\)/);
  assert.match(text(res), /Eksempel Revision Nord ApS \(CVR 99000003\)/);
  const nord = await b.callTool({ name: "remove_saved_page", arguments: { page: "Eksempel Revision Nord" } });
  assert.deepEqual(nord.structuredContent, { lassoId: "CVR-1-99000003", removed: true, total: 1 });
});

test("send-til-Lasso-nøglen er SEND_TO_LASSO_KEY med ADMIN_API_KEY som fallback", () => {
  assert.equal(sendToLassoKey(config), SEND);
  assert.equal(sendToLassoKey(loadConfig({ ADMIN_API_KEY: "admin" })), "admin");
  assert.equal(sendToLassoKey(loadConfig({ ADMIN_API_KEY: "admin", SEND_TO_LASSO_KEY: "send" })), "send");
});

test("POST /api/send-to-lasso kræver nøglen, validerer og gemmer på brugerens liste", async () => {
  const post = (body: unknown, key?: string) =>
    fetch(`${base}/api/send-to-lasso`, { method: "POST", headers: { "content-type": "application/json", ...(key ? { "x-api-key": key } : {}) }, body: JSON.stringify(body) });
  const body = { cvr: "99000005", userId: USER_A.id, org: USER_A.org, focus: "risiko", note: "Fra CRM" };
  assert.equal((await post(body)).status, 401);
  assert.equal((await post(body, ADMIN)).status, 401, "admin-nøglen gælder kun, når SEND_TO_LASSO_KEY ikke er sat");

  const res = await post(body, SEND);
  assert.equal(res.status, 201);
  const json = (await res.json()) as { saved: SavedPageVM; created: boolean; url: string };
  assert.equal(json.created, true);
  assert.equal(json.saved.lassoId, "CVR-1-99000005");
  assert.equal(json.saved.name, "Eksempel Software ApS");
  assert.equal(json.saved.origin, "send");
  assert.equal(json.saved.note, "Fra CRM");
  assert.match(json.url, /\/e\/CVR-1-99000005\?e=\w+&f=risiko&s=/);
  assert.equal((await fetch(json.url)).status, 200);

  const again = await post({ lassoId: "CVR-1-99000005", userId: USER_A.id, org: USER_A.org }, SEND);
  assert.equal(again.status, 200);
  assert.equal(((await again.json()) as { created: boolean }).created, false);

  const listed = await a.callTool({ name: "list_saved_pages", arguments: {} });
  const top = (listed._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedPages["all|20"]!.pages[0]!;
  assert.equal(top.lassoId, "CVR-1-99000005");
  assert.equal(top.origin, "send");

  // Person-ID, og org udeladt = DEMO_ORG.
  const person = await post({ lassoId: (await personId()), userId: USER_B.id }, SEND);
  assert.equal(person.status, 201);

  assert.equal((await post({ userId: USER_A.id }, SEND)).status, 400);
  assert.equal((await post({ cvr: "99000005" }, SEND)).status, 400);
  assert.equal((await post({ cvr: "99000005", userId: "ikke gyldig;" }, SEND)).status, 400);
  assert.equal((await post({ cvr: "99000005", userId: USER_A.id, focus: "alt" }, SEND)).status, 400);
  assert.equal((await post({ lassoId: "CVR-2-1000000000", userId: USER_A.id }, SEND)).status, 400);
  const missing = await post({ cvr: "12345678", userId: USER_A.id }, SEND);
  assert.equal(missing.status, 404);
  assert.match(((await missing.json()) as { error: string }).error, /Kunne ikke hente CVR-1-12345678/);
});

async function personId(): Promise<string> {
  const res = await a.callTool({ name: "list_saved_pages", arguments: { kind: "person" } });
  return (res._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedPages["person|20"]!.pages[0]!.lassoId;
}

test("POST /api/send-to-lasso/link giver et signeret link, der gemmer og sender videre til /e/", async () => {
  const post = (body: unknown, key?: string) =>
    fetch(`${base}/api/send-to-lasso/link`, { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify(body) });
  assert.equal((await post({ cvr: "99000006", userId: USER_A.id })).status, 401);
  const res = await post({ cvr: "99000006", userId: USER_A.id, org: USER_A.org, focus: "kontakt" }, SEND);
  assert.equal(res.status, 200);
  const { url } = (await res.json()) as { url: string };
  assert.match(url, /\/send-to-lasso\?id=CVR-1-99000006&u=/);
  assert.deepEqual(verifySendToLassoLink(config, query(url)), { ok: true, link: { lassoId: "CVR-1-99000006", userId: USER_A.id, org: USER_A.org, focus: "kontakt" } });

  // Linket alene gemmer intet.
  const before = await a.callTool({ name: "list_saved_pages", arguments: {} });
  assert.ok(!(before._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedPages["all|20"]!.pages.some((p) => p.lassoId === "CVR-1-99000006"));

  const click = await fetch(url, { redirect: "manual" });
  assert.equal(click.status, 302);
  const location = click.headers.get("location")!;
  assert.match(location, /\/e\/CVR-1-99000006\?e=\w+&f=kontakt&s=/);
  assert.equal((await fetch(location)).status, 200);

  const listed = await a.callTool({ name: "list_saved_pages", arguments: {} });
  const top = (listed._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedPages["all|20"]!.pages[0]!;
  assert.equal(top.lassoId, "CVR-1-99000006");
  assert.equal(top.origin, "link");
  assert.equal(top.focus, "kontakt");
});

test("GET /send-to-lasso afviser forfalskede (403) og udløbne (410) links og ukendte virksomheder (404)", async () => {
  const url = sendToLassoLink(config, { lassoId: "CVR-1-99000007", userId: USER_A.id, org: USER_A.org });
  const forged = await fetch(url.replace(`u=${USER_A.id}`, `u=${USER_B.id}`), { redirect: "manual" });
  assert.equal(forged.status, 403);
  const expired = await fetch(sendToLassoLink(config, { lassoId: "CVR-1-99000007", userId: USER_A.id, org: USER_A.org }, Date.now() - 31 * 86_400_000), { redirect: "manual" });
  assert.equal(expired.status, 410);
  const unknown = await fetch(sendToLassoLink(config, { lassoId: "CVR-1-12345678", userId: USER_A.id, org: USER_A.org }), { redirect: "manual" });
  assert.equal(unknown.status, 404);
  assert.match(await unknown.text(), /Kunne ikke hente virksomheden/);
  // Intet af det er gemt.
  const other = await b.callTool({ name: "list_saved_pages", arguments: {} });
  assert.ok(!(other._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedPages["all|20"]!.pages.some((p) => p.lassoId === "CVR-1-99000007"));
});

test("send-til-Lasso er lukket (503) uden nøgle uden for lokal udvikling", async () => {
  const { createApp: mk } = await import("./index.js");
  const cfg = loadConfig({ ...process.env, APP_ENV: "staging", MCP_ACCESS_KEY: "k", ADMIN_API_KEY: "", SEND_TO_LASSO_KEY: "", LASSO_DATA_SOURCE: "demo", DATABASE_URL: "", PUBLIC_BASE_URL: "http://x" });
  const server = mk({ config: cfg, client: new LassoClient(cfg), provider: new DemoProvider(), store: createViewStore(""), pages: createSavedPageStore("") }).listen(0);
  await new Promise((r) => server.once("listening", r));
  try {
    const port = (server.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/send-to-lasso`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cvr: "99000001", userId: "x" }) });
    assert.equal(res.status, 503);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
