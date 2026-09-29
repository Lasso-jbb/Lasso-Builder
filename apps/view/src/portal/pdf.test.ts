import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDataset, parseViewSpec, type ViewSpec } from "@lasso/spec";
import { createPortalApi, LOGGED_OUT } from "./api.js";
import { savePortalPdf } from "./pdf.js";

type Call = { url: string; init: RequestInit };

function stub(status: number, body: BodyInit | null, headers: Record<string, string>) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body, { status, headers });
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const pdfStub = () => stub(200, "%PDF-1.4", { "content-type": "application/pdf", "content-disposition": "attachment; filename*=UTF-8''Bo%20Eksempel%202026-09-28.pdf" });
const headers = (c: Call) => c.init.headers as Record<string, string>;

const companySpec: ViewSpec = parseViewSpec({ kind: "company", title: "Eksempel Byg A/S", components: [{ type: "LassoCompanyHead", company: "CVR-1-99000001" }] });
const personSpec: ViewSpec = parseViewSpec({ kind: "person", title: "Bo Eksempel", components: [{ type: "LassoPersonHead", person: "CVR-3-4000000002" }] });
const listSpec: ViewSpec = parseViewSpec({ kind: "list", title: "Gemte sider", components: [{ type: "LassoSavedPages" }] });

test("portalen: virksomhed = rapporten med fanens fokus, person = siden, ellers den viste spec", async () => {
  const { calls, fetcher } = pdfStub();
  const api = createPortalApi(() => assert.fail("ingen 401"), fetcher);
  const saved: string[] = [];
  const save = (_blob: Blob, filename: string) => void saved.push(filename);
  const ds = emptyDataset("demo");

  // Fanen er åbnet med et CVR-nummer; PDF'en bruger sidens kanoniske Lasso-ID.
  assert.deepEqual(await savePortalPdf(api, { kind: "company", id: "99000001", focus: "risiko" }, { spec: companySpec, dataset: ds }, save), { ok: true, message: "PDF'en er hentet" });
  await savePortalPdf(api, { kind: "person", id: "CVR-3-4000000002", focus: "overblik" }, { spec: personSpec, dataset: ds }, save);
  await savePortalPdf(api, { kind: "saved" }, { spec: listSpec, dataset: ds }, save);

  assert.equal(calls[0]!.url, "/api/portal/pdf/company/CVR-1-99000001?focus=risiko");
  assert.equal(calls[1]!.url, "/api/portal/pdf/person/CVR-3-4000000002");
  assert.equal(calls[2]!.url, "/api/portal/pdf/spec");
  // GET kræver ingen CSRF-header; POST gør. Sessionen sendes med.
  assert.equal(headers(calls[0]!)["x-lasso-portal"], undefined);
  assert.equal(calls[0]!.init.method, "GET");
  assert.equal(calls[0]!.init.credentials, "same-origin");
  assert.equal(calls[2]!.init.method, "POST");
  assert.equal(headers(calls[2]!)["x-lasso-portal"], "1");
  assert.deepEqual(JSON.parse(String(calls[2]!.init.body)).spec.title, "Gemte sider");
  assert.deepEqual(saved, ["Bo Eksempel 2026-09-28.pdf", "Bo Eksempel 2026-09-28.pdf", "Bo Eksempel 2026-09-28.pdf"]);
});

test("portalen: fejl som tekst (til fejlbeskeden med 'Prøv igen'); 401 logger ud", async () => {
  const off = createPortalApi(() => undefined, stub(503, JSON.stringify({ error: "PDF er ikke slået til på denne server." }), { "content-type": "application/json" }).fetcher);
  const res = await savePortalPdf(off, { kind: "search", q: "x" }, { spec: listSpec, dataset: emptyDataset("demo") }, () => assert.fail("intet gemt"));
  assert.deepEqual(res, { ok: false, error: "PDF er ikke slået til på denne server." });

  let loggedOut = 0;
  const expired = createPortalApi(() => loggedOut++, stub(401, JSON.stringify({ error: "Ikke logget ind" }), { "content-type": "application/json" }).fetcher);
  assert.deepEqual(await savePortalPdf(expired, { kind: "search", q: "x" }, { spec: listSpec, dataset: emptyDataset("demo") }, () => undefined), { ok: false, error: LOGGED_OUT });
  assert.equal(loggedOut, 1);

  assert.deepEqual(await savePortalPdf(off, { kind: "search", q: "x" }, undefined), { ok: false, error: "Siden er ikke hentet endnu." });
});
