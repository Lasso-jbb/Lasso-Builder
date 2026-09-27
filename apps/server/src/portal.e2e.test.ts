/**
 * Ende-til-ende for portalen (docs/portal.md): login og session, portal-API'et under /api/portal/*
 * (samme use-cases som MCP-tools), /portal-siden og roden. Samme opsætning som pages.e2e.test.ts
 * (demodata, hukommelses-store eller Postgres via TEST_DATABASE_URL); brugerne får et tilfældigt id
 * pr. kørsel. PUBLIC_BASE_URL er https, så cookien får Secure; links hentes derfor mod testserveren.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { DATASET_META_KEY, type Dataset, type ViewSpec } from "@lasso/spec";
import type { Config } from "./config.js";
import type { SavedPageStore } from "./pages/store.js";

process.env.LASSO_NO_MAIN = "1";
const { createApp } = await import("./index.js");
const { loadConfig } = await import("./config.js");
const { LassoClient } = await import("./lasso/client.js");
const { DemoProvider } = await import("./data/demo.js");
const { createViewStore } = await import("./views/store.js");
const { createSavedPageStore } = await import("./pages/store.js");
const { verifyEntityLink } = await import("./web/links.js");

const run = Math.random().toString(36).slice(2, 8);
const KEY = "test-mcp-key";
const PUBLIC = "https://lasso.test";
const PIA = { key: `portal-pia-${run}-xyz`, id: `pia-${run}`, name: "Pia", org: "lasso" };
const OLE = { key: `portal-ole-${run}-xyz`, id: `ole-${run}`, name: "Ole", org: "lasso" };

let http: Server;
let base = "";
let config: Config;
/** "lasso_session=…" som en browser ville sende den; tom = ingen cookie. */
let cookie = "";

type Json = Record<string, unknown>;
type ViewBody = { spec: ViewSpec; dataset: Dataset; note?: string; link?: string };

const boot = (html: string) => JSON.parse(/window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(html)![1]!) as Json;
const query = (url: string) => Object.fromEntries(new URL(url).searchParams);
/** Et link med PUBLIC_BASE_URL hentet mod testserveren. */
const local = (url: string) => `${base}${new URL(url).pathname}${new URL(url).search}`;

interface CallOpts {
  method?: string;
  body?: unknown;
  /** CSRF-headeren; standard: med. */
  csrf?: boolean;
  /** Cookie-header; standard: den aktuelle session. */
  cookie?: string;
}

function api(path: string, opts: CallOpts = {}): Promise<Response> {
  const c = opts.cookie ?? cookie;
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.csrf !== false) headers["x-lasso-portal"] = "1";
  if (c) headers.cookie = c;
  return fetch(`${base}/api/portal${path}`, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
}

async function json<T = Json>(res: Response, status = 200): Promise<T> {
  const body = (await res.json()) as T;
  assert.equal(res.status, status, JSON.stringify(body));
  return body;
}

/** Logger ind og returnerer cookien, som en browser ville gemme den. */
async function login(user: string, key: string): Promise<{ res: Response; cookie: string }> {
  const res = await fetch(`${base}/api/portal/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user, key }) });
  return { res, cookie: (res.headers.get("set-cookie") ?? "").split(";")[0]! };
}

before(async () => {
  config = loadConfig({
    ...process.env,
    MCP_ACCESS_KEY: KEY,
    MCP_USER_KEYS: `${PIA.key}:${PIA.id}:${PIA.name}:${PIA.org};${OLE.key}:${OLE.id}:${OLE.name}:${OLE.org}`,
    LINK_SECRET: "portal-test-hemmelighed",
    LASSO_DATA_SOURCE: "demo",
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    PUBLIC_BASE_URL: PUBLIC,
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
});

after(async () => {
  await new Promise((r) => http.close(r));
});

test("roden sender videre til /portal", async () => {
  const res = await fetch(`${base}/`, { redirect: "manual" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/portal");
});

test("/portal uden cookie: render-appen i portal-tilstand uden bruger", async () => {
  const res = await fetch(`${base}/portal`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const b = boot(await res.text());
  assert.deepEqual(b, { mode: "portal", user: null, loginRequired: true, baseUrl: PUBLIC });
});

test("login: rigtig nøgle giver Set-Cookie og { user }, forkert nøgle eller bruger 401", async () => {
  const wrongKey = await login(PIA.id, `${PIA.key}-forkert`);
  assert.match((await json<{ error: string }>(wrongKey.res, 401)).error, /Forkert bruger eller adgangsnøgle/);
  assert.equal(wrongKey.res.headers.get("set-cookie"), null);
  // Nøglen hører til Pia, ikke Ole.
  assert.equal((await login(OLE.id, PIA.key)).res.status, 401);

  const ok = await login(PIA.id.toUpperCase(), PIA.key);
  assert.deepEqual(await json(ok.res), { user: { id: PIA.id, name: PIA.name, org: PIA.org, isDemo: false } });
  assert.match(ok.res.headers.get("set-cookie") ?? "", /^lasso_session=[\w.%-]+; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
  cookie = ok.cookie;

  // Den fælles nøgle logger demobrugeren ind.
  const demo = await login("demo", KEY);
  assert.equal((await json<{ user: { isDemo: boolean } }>(demo.res)).user.isDemo, true);
});

test("/api/portal/me: 401 uden cookie, brugeren med cookie", async () => {
  assert.equal((await api("/me", { cookie: "" })).status, 401);
  assert.equal((await api("/me", { cookie: "lasso_session=forfalsket.signatur" })).status, 401);
  assert.deepEqual(await json(await api("/me")), { user: { id: PIA.id, name: PIA.name, org: PIA.org, isDemo: false } });
});

test("/portal med cookie: brugeren står i boot", async () => {
  const res = await fetch(`${base}/portal`, { headers: { cookie } });
  const b = boot(await res.text());
  assert.equal(b.mode, "portal");
  assert.deepEqual(b.user, { id: PIA.id, name: PIA.name, org: PIA.org, isDemo: false });
});

const ROUTES: [string, string, unknown?][] = [
  ["GET", "/search?query=Eksempel"],
  ["GET", "/company/99000001"],
  ["GET", "/person/Bo%20Eksempel"],
  ["POST", "/resolve", { spec: {} }],
  ["GET", "/pages"],
  ["POST", "/pages", { page: "99000001" }],
  ["DELETE", "/pages/CVR-1-99000001"],
  ["POST", "/views", { spec: {} }],
];

test("alle portal-ruter kræver session (401 uden eller med forfalsket cookie)", async () => {
  for (const [method, path, body] of ROUTES) {
    for (const c of ["", "lasso_session=forfalsket.signatur"]) {
      const res = await api(path, { method, body, cookie: c });
      assert.equal(res.status, 401, `${method} ${path}`);
      assert.deepEqual(await res.json(), { error: "Ikke logget ind" });
    }
  }
});

test("ændrende kald uden CSRF-headeren giver 403 og ændrer intet", async () => {
  for (const [method, path, body] of ROUTES.filter(([m]) => m !== "GET")) {
    const res = await api(path, { method, body, csrf: false });
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.match(((await res.json()) as { error: string }).error, /x-lasso-portal/);
  }
  const listed = await json<ViewBody>(await api("/pages"));
  assert.equal(listed.dataset.savedPages["all|20"]!.total, 0);
});

test("search: som search_companies, Lasso-tabel med datasæt, no-store", async () => {
  const res = await api("/search?query=Eksempel&limit=3&title=Eksempler");
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await json<ViewBody>(res);
  assert.equal(body.spec.kind, "list");
  assert.equal(body.spec.title, "Eksempler");
  const table = body.spec.components[0]!;
  assert.equal(table.type, "LassoCompanyTable");
  assert.equal((table as { search: { limit: number } }).search.limit, 3);
  const search = Object.values(body.dataset.searches)[0]!;
  assert.ok(search.rows.length > 0 && search.rows.length <= 3, JSON.stringify(search.rows.length));
  assert.equal(body.dataset.source, "demo");

  const defaults = await json<ViewBody>(await api("/search?query=Eksempel"));
  assert.equal(defaults.spec.title, "Søgning: Eksempel");
  assert.equal((defaults.spec.components[0] as { search: { limit: number } }).search.limit, 20);

  for (const bad of ["limit=0", "limit=101", "limit=abc", "limit=2.5"]) {
    assert.match((await json<{ error: string }>(await api(`/search?query=x&${bad}`), 400)).error, /limit skal være et helt tal fra 1 til 100/, bad);
  }
  assert.match((await json<{ error: string }>(await api(`/search?query=${"x".repeat(201)}`), 400)).error, /query må højst være 200 tegn/);
});

test("company: med CVR, Lasso-ID og navn; link er den signerede /e/-side", async () => {
  const res = await api("/company/99000001");
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await json<ViewBody>(res);
  assert.deepEqual(Object.keys(body).sort(), ["dataset", "link", "spec"]);
  assert.equal(body.spec.title, "Eksempel Byg A/S");
  assert.equal(body.spec.components[0]!.type, "LassoCompanyHead");
  assert.equal(body.dataset.companies["CVR-1-99000001"]?.name, "Eksempel Byg A/S");
  assert.ok(body.link!.startsWith(`${PUBLIC}/e/CVR-1-99000001?`), body.link);
  assert.deepEqual(verifyEntityLink(config, "CVR-1-99000001", query(body.link!)), { ok: true, lassoId: "CVR-1-99000001" });
  assert.equal((await fetch(local(body.link!))).status, 200);

  const byName = await json<ViewBody>(await api(`/company/${encodeURIComponent("Eksempel Byg")}`));
  assert.equal(byName.spec.title, "Eksempel Byg A/S");
  assert.match(byName.note ?? "", /Fundet ud fra navnet "Eksempel Byg": Eksempel Byg A\/S \(99000001\)/);
  // Et navn med skråstreg (A/S) virker, når det er URL-kodet.
  const withSlash = await json<ViewBody>(await api(`/company/${encodeURIComponent("Eksempel Byg A/S")}`));
  assert.equal(withSlash.spec.title, "Eksempel Byg A/S");
});

test("company: focus oekonomi giver økonomivisningen, og linket åbner samme focus", async () => {
  const body = await json<ViewBody>(await api("/company/CVR-1-99000001?focus=oekonomi&years=10&metric=omsaetning"));
  assert.equal(body.spec.subtitle, "Økonomi");
  assert.ok(body.spec.components.some((c) => c.type === "LassoGroupedBarChart" || c.type === "LassoBarChart"), "mange år giver en graf");
  assert.ok(body.spec.components.some((c) => c.type === "LassoMultiYearTable"));
  assert.deepEqual(verifyEntityLink(config, "CVR-1-99000001", query(body.link!)), { ok: true, lassoId: "CVR-1-99000001", focus: "oekonomi" });
  const page = await fetch(local(body.link!));
  assert.equal(page.status, 200);
  assert.match(JSON.stringify(boot(await page.text())), /"subtitle":"Økonomi"/);
});

test("company: 404 for ukendt virksomhed eller navn, 400 for ugyldige parametre", async () => {
  assert.match((await json<{ error: string }>(await api("/company/12345678"), 404)).error, /Kunne ikke hente 12345678/);
  assert.match((await json<{ error: string }>(await api(`/company/${encodeURIComponent("Findes Ikke Nogen Steder")}`), 404)).error, /Fandt ingen virksomhed/);
  assert.match((await json<{ error: string }>(await api("/company/99000001?focus=alt"), 400)).error, /focus skal være en af: overblik, oekonomi/);
  assert.match((await json<{ error: string }>(await api("/company/99000001?years=11"), 400)).error, /years skal være et helt tal fra 2 til 10/);
  assert.match((await json<{ error: string }>(await api("/company/99000001?metric=alt"), 400)).error, /metric skal være en af/);
});

test("person: som show_person, med signeret link til personsiden; 404/400 ved fejl", async () => {
  const body = await json<ViewBody>(await api(`/person/${encodeURIComponent("Bo Eksempel")}`));
  assert.equal(body.spec.kind, "person");
  assert.equal(body.spec.components[0]!.type, "LassoPersonHead");
  assert.match(body.note ?? "", /Fundet ud fra navnet "Bo Eksempel"/);
  const lassoId = /\/e\/(CVR-3-\d+)\?/.exec(body.link ?? "")?.[1];
  assert.ok(lassoId, body.link);
  assert.ok(body.dataset.persons[lassoId!]);
  // Overblikket: stamoplysninger og historik nøglet på person-ID'et, og ejerdiagrammet med personen
  // som rod (pille) og en kant til det ejede selskab. Nyhederne hentes kun på fokus historik.
  const types = body.spec.components.map((c) => c.type);
  for (const t of ["LassoPersonFacts", "LassoTimeline", "LassoOwnershipDiagram"]) assert.ok(types.includes(t as never), t);
  assert.ok(!types.includes("LassoNews"));
  assert.deepEqual(body.dataset.news, {});
  assert.match(body.dataset.timeline[lassoId!]!.events[0]!.title, /kom under konkurs/);
  const graph = body.dataset.ownershipGraphs[`${lassoId}|0|2|`]!;
  assert.equal(graph.nodes.find((n) => n.root)?.kind, "person");
  assert.ok(graph.edges.some((e) => e.from === lassoId && e.to === "CVR-1-99000010"));
  assert.deepEqual(body.dataset.errors, {});
  assert.deepEqual(verifyEntityLink(config, lassoId!, query(body.link!)), { ok: true, lassoId });
  assert.equal((await fetch(local(body.link!))).status, 200);

  const byId = await json<ViewBody>(await api(`/person/${lassoId}`));
  assert.equal(byId.note, undefined);
  assert.equal(byId.spec.title, body.spec.title);

  assert.match((await json<{ error: string }>(await api(`/person/${encodeURIComponent("Findes Ikke Nogen")}`), 404)).error, /Fandt ingen person/);
  assert.match((await json<{ error: string }>(await api("/person/99000001"), 400)).error, /er et CVR-nummer/);
});

test("person ?focus=: hvert personfokus som show_person, link med samme fokus; 400 ved ukendt fokus", async () => {
  const risk = await json<ViewBody>(await api("/person/CVR-3-4000000002?focus=risiko"));
  assert.equal(risk.spec.subtitle, "Risiko");
  assert.deepEqual(risk.spec.components.map((c) => c.type), ["LassoPersonHead", "LassoPersonRisk", "LassoTimeline", "LassoFollowUps"]);
  const tl = risk.spec.components.find((c) => c.type === "LassoTimeline");
  assert.equal(tl?.type === "LassoTimeline" && tl.filter, "risiko");
  // Kun det, fokus viser, er hentet.
  assert.deepEqual(risk.dataset.news, {});
  assert.deepEqual(risk.dataset.ownershipGraphs, {});
  assert.deepEqual(risk.dataset.personNetworks, {});
  assert.match(risk.link ?? "", /\/e\/CVR-3-4000000002\?e=\w+&f=risiko&s=/);
  assert.deepEqual(verifyEntityLink(config, "CVR-3-4000000002", query(risk.link!)), { ok: true, lassoId: "CVR-3-4000000002", focus: "risiko" });
  const page = await fetch(local(risk.link!));
  assert.equal(page.status, 200);
  assert.match(await page.text(), /"filter":"risiko"/);

  const owner = await json<ViewBody>(await api("/person/CVR-3-4000000002?focus=ejerskab"));
  assert.deepEqual(owner.spec.components.map((c) => c.type), ["LassoPersonHead", "LassoPersonRoles", "LassoOwnershipDiagram", "LassoFollowUps"]);
  const roles = await json<ViewBody>(await api("/person/CVR-3-4000000002?focus=roller"));
  assert.deepEqual(Object.keys(roles.dataset.personNetworks), []);
  assert.equal(roles.spec.subtitle, "Roller");
  // Overblik står ikke i linket (samme link som før personfokus).
  assert.equal(query((await json<ViewBody>(await api("/person/CVR-3-4000000002?focus=overblik"))).link!).f, undefined);

  assert.match((await json<{ error: string }>(await api("/person/CVR-3-4000000002?focus=oekonomi"), 400)).error, /focus skal være en af: overblik, roller, netvaerk, ejerskab, risiko, historik/);
});

test("resolve: som resolve_view (drill-down), 400 ved ugyldig spec", async () => {
  const shown = await json<ViewBody>(await api("/company/99000008"));
  const body = await json<ViewBody>(await api("/resolve", { method: "POST", body: { spec: shown.spec } }));
  assert.deepEqual(Object.keys(body).sort(), ["dataset", "spec"]);
  assert.deepEqual(body.spec, shown.spec);
  assert.ok(body.dataset.people["CVR-1-99000008"]!.length > 0);

  // CVR-numre i en rettet spec normaliseres til Lasso-ID'er, som i resolve_view.
  const compare = await json<ViewBody>(
    await api("/resolve", { method: "POST", body: { spec: { version: 2, title: "Sammenligning", components: [{ type: "LassoCompareTable", companies: ["99000001", "99000004"] }] } } }),
  );
  assert.deepEqual((compare.spec.components[0] as { companies: string[] }).companies, ["CVR-1-99000001", "CVR-1-99000004"]);
  assert.ok(compare.dataset.companies["CVR-1-99000004"]);

  assert.deepEqual(await json(await api("/resolve", { method: "POST", body: { spec: { title: "Tom" } } }), 400), { error: "Ugyldig spec." });
  assert.deepEqual(await json(await api("/resolve", { method: "POST", body: {} }), 400), { error: "Ugyldig spec." });
});

test("pages: gem, list, savedIds i company-svaret og fjern, delt med MCP-tools", async () => {
  const saved = await json<Json>(await api("/pages", { method: "POST", body: { page: "99000001", focus: "oekonomi", note: "Fra portalen" } }));
  assert.deepEqual(Object.keys(saved).sort(), ["created", "cvr", "kind", "lassoId", "name", "savedAt", "total", "url"]);
  assert.equal(saved.lassoId, "CVR-1-99000001");
  assert.equal(saved.kind, "company");
  assert.equal(saved.name, "Eksempel Byg A/S");
  assert.equal(saved.cvr, "99000001");
  assert.equal(saved.created, true);
  assert.equal(saved.total, 1);
  assert.deepEqual(verifyEntityLink(config, "CVR-1-99000001", query(saved.url as string)), { ok: true, lassoId: "CVR-1-99000001", focus: "oekonomi" });

  const again = await json<Json>(await api("/pages", { method: "POST", body: { page: "CVR-1-99000001" } }));
  assert.equal(again.created, false);
  const person = await json<Json>(await api("/pages", { method: "POST", body: { page: "Bo Eksempel", kind: "person", focus: "netvaerk" } }));
  assert.equal(person.kind, "person");
  assert.equal(person.cvr, undefined);
  assert.equal(person.total, 2);
  // Personfokus gemmes og står i linket; et virksomhedsfokus på en person gemmes ikke.
  assert.deepEqual(verifyEntityLink(config, person.lassoId as string, query(person.url as string)), { ok: true, lassoId: person.lassoId, focus: "netvaerk" });
  const personPage = await fetch(local(person.url as string));
  assert.equal(personPage.status, 200);
  assert.match(await personPage.text(), /"subtitle":"Netværk"/);
  const wrongFocus = await json<Json>(await api("/pages", { method: "POST", body: { page: "Anne Eksempel", kind: "person", focus: "oekonomi" } }));
  assert.equal(query(wrongFocus.url as string).f, undefined);
  await api(`/pages/${wrongFocus.lassoId as string}`, { method: "DELETE" });

  const list = await json<ViewBody>(await api("/pages"));
  assert.deepEqual(list.spec.components, [{ type: "LassoSavedPages", kind: "all", limit: 20 }]);
  assert.equal(list.spec.title, "Mine gemte sider");
  const all = list.dataset.savedPages["all|20"]!;
  assert.equal(all.total, 2);
  assert.deepEqual(all.pages.map((p) => p.lassoId), [person.lassoId, "CVR-1-99000001"]);
  assert.equal(all.pages[1]!.focus, "oekonomi", "focus og note bevares, når siden gemmes igen");
  assert.equal(all.pages[1]!.note, "Fra portalen");
  const persons = await json<ViewBody>(await api("/pages?kind=person&limit=5"));
  assert.equal(persons.spec.title, "Mine gemte personer");
  assert.equal(persons.dataset.savedPages["person|5"]!.total, 1);
  assert.match((await json<{ error: string }>(await api("/pages?kind=alle"), 400)).error, /kind skal være en af: company, person, all/);

  // Gem/Gemt-knappen: savedIds i virksomheds- og personsvaret.
  assert.deepEqual((await json<ViewBody>(await api("/company/99000001"))).dataset.savedIds, ["CVR-1-99000001"]);
  assert.deepEqual((await json<ViewBody>(await api("/company/99000002"))).dataset.savedIds, []);
  assert.deepEqual((await json<ViewBody>(await api(`/person/${person.lassoId}`))).dataset.savedIds, [person.lassoId]);

  // Samme liste som MCP-connectoren med Pias nøgle.
  const mcp = new Client({ name: "e2e-portal", version: "1.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/${encodeURIComponent(PIA.key)}`)));
  try {
    const res = await mcp.callTool({ name: "list_saved_pages", arguments: {} });
    assert.equal((res._meta as Record<string, Dataset>)[DATASET_META_KEY]!.savedPages["all|20"]!.total, 2);
  } finally {
    await mcp.close();
  }

  // Fejl: ugyldigt input 400, ukendt 404.
  assert.match((await json<{ error: string }>(await api("/pages", { method: "POST", body: {} }), 400)).error, /Angiv page/);
  assert.match((await json<{ error: string }>(await api("/pages", { method: "POST", body: { page: "99000001", focus: "alt" } }), 400)).error, /focus skal være en af/);
  assert.match((await json<{ error: string }>(await api("/pages", { method: "POST", body: { page: "99000001", note: "x".repeat(501) } }), 400)).error, /note må højst være 500 tegn/);
  assert.match((await json<{ error: string }>(await api("/pages", { method: "POST", body: { page: "CVR-2-1000000000" } }), 400)).error, /ikke et CVR-nummer eller Lasso-ID/);
  assert.match((await json<{ error: string }>(await api("/pages", { method: "POST", body: { page: "Findes Ikke Nogen Steder" } }), 404)).error, /Fandt ingen virksomhed/);
  assert.match((await json<{ error: string }>(await api("/pages", { method: "POST", body: { page: "12345678" } }), 404)).error, /Kunne ikke hente 12345678/);

  // Fjern.
  assert.deepEqual(await json(await api("/pages/CVR-1-99000001", { method: "DELETE" })), { lassoId: "CVR-1-99000001", removed: true, total: 1 });
  assert.deepEqual(await json(await api("/pages/CVR-1-99000001", { method: "DELETE" })), { lassoId: "CVR-1-99000001", removed: false, total: 1 });
  assert.match((await json<{ error: string }>(await api("/pages/CVR-2-1000000000", { method: "DELETE" }), 400)).error, /ikke et CVR-nummer/);
  assert.match((await json<{ error: string }>(await api(`/pages/${encodeURIComponent("Eksempel Revision Midt")}`, { method: "DELETE" }), 404)).error, /ingen gemt side/);
  assert.deepEqual((await json<ViewBody>(await api("/company/99000001"))).dataset.savedIds, []);
});

test("gemte sider er personlige: Ole ser ikke Pias liste", async () => {
  const ole = await login(OLE.id, OLE.key);
  assert.equal(ole.res.status, 200);
  const list = await json<ViewBody>(await api("/pages", { cookie: ole.cookie }));
  assert.equal(list.dataset.savedPages["all|20"]!.total, 0);
});

test("views: som save_view, url åbner /v/…; samme adresse giver ny version, en andens adresse 409", async () => {
  const shown = await json<ViewBody>(await api("/company/99000002"));
  const slug = `portal-${run}`;
  const first = await json<Json>(await api("/views", { method: "POST", body: { spec: shown.spec, name: "Portal-test", slug, visibility: "org" } }));
  assert.deepEqual(first, { url: `${PUBLIC}/v/${PIA.org}/${slug}`, org: PIA.org, slug, version: 1, name: "Portal-test", visibility: "org" });
  const page = await fetch(local(first.url as string));
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Eksempel Revision Midt ApS/);

  const again = await json<Json>(await api("/views", { method: "POST", body: { spec: shown.spec, slug } }));
  assert.equal(again.version, 2);

  const ole = await login(OLE.id, OLE.key);
  const taken = await api("/views", { method: "POST", body: { spec: shown.spec, slug }, cookie: ole.cookie });
  assert.match((await json<{ error: string }>(taken, 409)).error, /er allerede taget af en anden bruger\. Vælg en anden adresse\./);

  assert.match((await json<{ error: string }>(await api("/views", { method: "POST", body: { spec: { title: "Tom" } } }), 400)).error, /^Specen er ugyldig/);
  assert.match((await json<{ error: string }>(await api("/views", { method: "POST", body: {} }), 400)).error, /^Specen er ugyldig/);
  assert.deepEqual(await json(await api("/views", { method: "POST", body: [] }), 400), { error: "Body skal være et JSON-objekt." });
  assert.match((await json<{ error: string }>(await api("/views", { method: "POST", body: { spec: shown.spec, slug: "!!" } }), 400)).error, /Adressen må kun indeholde/);
  assert.match((await json<{ error: string }>(await api("/views", { method: "POST", body: { spec: shown.spec, visibility: "alle" } }), 400)).error, /visibility skal være en af: private, org, link/);
});

test("en body, der ikke er gyldig JSON, giver 400 som JSON", async () => {
  const res = await fetch(`${base}/api/portal/pages`, { method: "POST", headers: { "content-type": "application/json", "x-lasso-portal": "1", cookie }, body: "{ikke json" });
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await json(res, 400), { error: "Body kunne ikke læses som JSON." });
});

test("logout sletter cookien, og derefter er man logget ud", async () => {
  const res = await fetch(`${base}/api/portal/logout`, { method: "POST", headers: { cookie } });
  assert.deepEqual(await json(res), { ok: true });
  const set = res.headers.get("set-cookie") ?? "";
  assert.match(set, /^lasso_session=; Path=\/; Max-Age=0; HttpOnly; SameSite=Lax; Secure$/);
  // Browseren sletter cookien (Max-Age=0) og sender den ikke længere.
  cookie = "";
  assert.equal((await api("/me")).status, 401);
  assert.equal((await api("/pages")).status, 401);
  const b = boot(await (await fetch(`${base}/portal`)).text());
  assert.equal(b.user, null);
});

/** En app med egen konfiguration og evt. eget lager til de sidste to tests. */
async function withApp(env: Record<string, string>, pages: SavedPageStore, fn: (url: string) => Promise<void>): Promise<void> {
  const cfg = loadConfig({ ...process.env, LASSO_DATA_SOURCE: "demo", DATABASE_URL: "", PUBLIC_BASE_URL: "http://localhost", MCP_ACCESS_KEY: "", MCP_USER_KEYS: "", LINK_SECRET: "", ...env });
  const server = createApp({ config: cfg, client: new LassoClient(cfg), provider: new DemoProvider(), store: createViewStore(""), pages }).listen(0);
  await new Promise((r) => server.once("listening", r));
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test("uden nøgler (lokal udvikling) er portalen åben som demobrugeren, men CSRF gælder stadig", async () => {
  await withApp({}, createSavedPageStore(""), async (url) => {
    const me = await json<{ user: { isDemo: boolean } }>(await fetch(`${url}/api/portal/me`));
    assert.equal(me.user.isDemo, true);
    const saved = await fetch(`${url}/api/portal/pages`, { method: "POST", headers: { "content-type": "application/json", "x-lasso-portal": "1" }, body: JSON.stringify({ page: "99000003" }) });
    assert.equal((await json<Json>(saved)).created, true);
    const noCsrf = await fetch(`${url}/api/portal/pages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ page: "99000003" }) });
    assert.equal(noCsrf.status, 403);
    const b = boot(await (await fetch(`${url}/portal`)).text());
    assert.equal(b.loginRequired, false);
    assert.equal((b.user as { isDemo: boolean }).isDemo, true);
  });
});

test("en uventet serverfejl giver 500 som JSON uden detaljer", async () => {
  const memory = createSavedPageStore("");
  const broken = new Proxy(memory, {
    get: (target, prop) => (prop === "get" ? async () => Promise.reject(new Error("databasen er nede")) : Reflect.get(target, prop)),
  });
  const log = console.error;
  console.error = () => {};
  try {
    await withApp({}, broken, async (url) => {
      const res = await fetch(`${url}/api/portal/pages/CVR-1-99000001`, { method: "DELETE", headers: { "x-lasso-portal": "1" } });
      assert.equal(res.headers.get("content-type")?.startsWith("application/json"), true);
      assert.equal(res.headers.get("cache-control"), "no-store");
      assert.deepEqual(await json(res, 500), { error: "Der skete en fejl på serveren. Prøv igen om lidt." });
    });
  } finally {
    console.error = log;
  }
});

test("PORTAL_PUBLIC=true: /portal og /api/portal/* er åbne uden login som demobrugeren", async () => {
  const openConfig = loadConfig({ ...process.env, MCP_ACCESS_KEY: KEY, LINK_SECRET: "portal-test-hemmelighed", LASSO_DATA_SOURCE: "demo", DATABASE_URL: "", PUBLIC_BASE_URL: PUBLIC, PORTAL_PUBLIC: "true" });
  const openStore = createViewStore("");
  const openPages = createSavedPageStore("");
  const openApp = createApp({ config: openConfig, client: new LassoClient(openConfig), provider: new DemoProvider(), store: openStore, pages: openPages });
  const srv = openApp.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const openBase = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  try {
    const page = await fetch(`${openBase}/portal`);
    const b = boot(await page.text()) as { loginRequired: boolean; user: { id: string; isDemo: boolean } | null };
    assert.equal(b.loginRequired, false);
    assert.equal(b.user?.isDemo, true);
    const me = await fetch(`${openBase}/api/portal/me`);
    assert.equal(me.status, 200);
    assert.equal(((await me.json()) as { user: { isDemo: boolean } }).user.isDemo, true);
    // Opslag uden cookie virker; ændrende kald kræver stadig CSRF-headeren.
    const search = await fetch(`${openBase}/api/portal/search?query=Eksempel&limit=2`);
    assert.equal(search.status, 200);
    const noCsrf = await fetch(`${openBase}/api/portal/pages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lassoId: "CVR-1-99000001" }) });
    assert.equal(noCsrf.status, 403);
  } finally {
    await new Promise((r) => srv.close(r));
  }
});
