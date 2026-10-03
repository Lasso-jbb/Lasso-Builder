import assert from "node:assert/strict";
import { test } from "node:test";
import { createPortalApi, LOGGED_OUT, PortalApiError } from "./api.js";

type Call = { url: string; init: RequestInit };

function stub(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const headers = (c: Call) => c.init.headers as Record<string, string>;

test("API: GET uden CSRF-header, cookien med (same-origin), forespørgsel kodet", async () => {
  const { calls, fetcher } = stub(200, { spec: {}, dataset: {} });
  const api = createPortalApi(() => assert.fail("ingen 401"), fetcher);
  await api.search("revisorer i Aarhus");
  await api.company("CVR-1-34580820", "oekonomi");
  await api.person("CVR-3-4000000002", "risiko");
  await api.person("Bo Eksempel", "overblik");
  assert.equal(calls[0]!.url, "/api/portal/search?query=revisorer+i+Aarhus");
  assert.equal(calls[1]!.url, "/api/portal/company/CVR-1-34580820?focus=oekonomi");
  // Personfokus som query; standardfokus (overblik) udelades.
  assert.equal(calls[2]!.url, "/api/portal/person/CVR-3-4000000002?focus=risiko");
  assert.equal(calls[3]!.url, "/api/portal/person/Bo%20Eksempel");
  for (const c of calls) {
    assert.equal(c.init.method, "GET");
    assert.equal(c.init.credentials, "same-origin");
    assert.equal(headers(c)["x-lasso-portal"], undefined);
  }
});

test("API: POST og DELETE sender x-lasso-portal: 1 og JSON", async () => {
  const { calls, fetcher } = stub(200, { ok: true });
  const api = createPortalApi(() => {}, fetcher);
  await api.savePage({ page: "CVR-1-1", kind: "company", focus: "oekonomi" });
  await api.removePage("CVR-3-4000123");
  assert.equal(calls[0]!.init.method, "POST");
  assert.equal(headers(calls[0]!)["x-lasso-portal"], "1");
  assert.equal(headers(calls[0]!)["content-type"], "application/json");
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { page: "CVR-1-1", kind: "company", focus: "oekonomi" });
  assert.equal(calls[1]!.url, "/api/portal/pages/CVR-3-4000123");
  assert.equal(calls[1]!.init.method, "DELETE");
  assert.equal(headers(calls[1]!)["x-lasso-portal"], "1");
});

test("API: 401 midt i sessionen logger ud; 401 ved login er forkert nøgle", async () => {
  let loggedOut = 0;
  const { fetcher } = stub(401, { error: "Ikke logget ind" });
  const api = createPortalApi(() => loggedOut++, fetcher);
  await assert.rejects(api.pages(), (e: unknown) => e instanceof PortalApiError && e.status === 401 && e.message === LOGGED_OUT);
  assert.equal(loggedOut, 1);
  const wrong = createPortalApi(() => loggedOut++, stub(401, { error: "Forkert bruger eller adgangsnøgle." }).fetcher);
  await assert.rejects(wrong.login("jbb", "forkert"), /Forkert bruger eller adgangsnøgle\./);
  assert.equal(loggedOut, 1);
});

test("API: fejl kommer som serverens tekst", async () => {
  const api = createPortalApi(() => {}, stub(404, { error: "Virksomheden findes ikke." }).fetcher);
  await assert.rejects(api.person("CVR-3-1"), (e: unknown) => e instanceof PortalApiError && e.status === 404 && e.message === "Virksomheden findes ikke.");
  const bare = createPortalApi(() => {}, stub(500, undefined).fetcher);
  await assert.rejects(bare.pages(), /fejl 500/);
});

test("API: egne sider (templates) bruger de rigtige stier, metoder og CSRF", async () => {
  const { calls, fetcher } = stub(200, { templates: [{ id: "t1", kind: "company", title: "KYC" }] });
  const api = createPortalApi(() => {}, fetcher);
  assert.deepEqual(await api.templates.list("company"), [{ id: "t1", kind: "company", title: "KYC" }]);
  await api.templates.save({ kind: "company", title: "KYC", spec: {} as never, entity: { kind: "company", id: "CVR-1-99000001" } });
  await api.templates.render("t1", "CVR-1-99000002");
  await api.templates.remove("t1");
  assert.equal(calls[0]!.url, "/api/portal/templates?kind=company");
  assert.equal(headers(calls[0]!)["x-lasso-portal"], undefined);
  assert.equal(calls[1]!.url, "/api/portal/templates");
  assert.equal(calls[1]!.init.method, "POST");
  assert.equal(headers(calls[1]!)["x-lasso-portal"], "1");
  assert.equal(calls[2]!.url, "/api/portal/templates/t1/render?entity=CVR-1-99000002");
  assert.equal(calls[2]!.init.method, "GET");
  assert.equal(calls[3]!.url, "/api/portal/templates/t1");
  assert.equal(calls[3]!.init.method, "DELETE");
  assert.equal(headers(calls[3]!)["x-lasso-portal"], "1");
});
