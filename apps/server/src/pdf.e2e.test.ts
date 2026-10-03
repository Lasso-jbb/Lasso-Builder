/**
 * Ende-til-ende for "Gem som PDF" (docs/design/README.md, "A4-eksport (27)"): de signerede .pdf-ruter,
 * portalens /api/portal/pdf/*, pdfLink i MCP-svarene og print-siden. To servere i processen med
 * demodata: én uden Chromium (PDF slået fra: 503 og ingen knap) og, når Chromium findes
 * (PDF_CHROMIUM_PATH, standard /usr/bin/chromium) og render-appen er bygget, én, der laver rigtige PDF'er.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { Config } from "./config.js";
import type { PdfRenderer } from "./pdf/renderer.js";

process.env.LASSO_NO_MAIN = "1";
const { createApp } = await import("./index.js");
const { loadConfig } = await import("./config.js");
const { LassoClient } = await import("./lasso/client.js");
const { DemoProvider } = await import("./data/demo.js");
const { createViewStore } = await import("./views/store.js");
const { createSavedPageStore } = await import("./pages/store.js");
const { companyLink, entityLink, personLink } = await import("./web/links.js");
const { createPdfRenderer, PDF_UNAVAILABLE } = await import("./pdf/renderer.js");
const { pdfUrlOf } = await import("./pdf/routes.js");

const CHROMIUM = (process.env.PDF_CHROMIUM_PATH ?? "/usr/bin/chromium").trim();
const VIEW_BUILT = existsSync(fileURLToPath(new URL("../../view/dist/view.html", import.meta.url)));
const CAN_RENDER = existsSync(CHROMIUM) && VIEW_BUILT;

const boot = (html: string) => JSON.parse(/window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(html)![1]!) as Record<string, unknown>;
/** Sider i en PDF: "/Type /Page" uden s (ikke /Pages-træet). */
const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

interface Running {
  base: string;
  config: Config;
  http: Server;
  client: Client;
  pdf: PdfRenderer;
  logs: string[];
}

async function start(chromium: string): Promise<Running> {
  const config = loadConfig({
    ...process.env,
    LASSO_DATA_SOURCE: "demo",
    DATABASE_URL: "",
    MCP_ACCESS_KEY: "",
    MCP_USER_KEYS: "",
    LINK_SECRET: "pdf-e2e-hemmelighed",
    PUBLIC_BASE_URL: "http://placeholder",
    PDF_CHROMIUM_PATH: chromium,
  });
  const logs: string[] = [];
  let port = 0;
  const pdf = createPdfRenderer({ port: () => port, executablePath: chromium, timeoutMs: config.PDF_TIMEOUT_MS, log: (l) => void logs.push(l) });
  const store = createViewStore("");
  const pages = createSavedPageStore("");
  const app = createApp({ config, client: new LassoClient(config), provider: new DemoProvider(), store, pages, pdf });
  const http = app.listen(0, "127.0.0.1");
  await new Promise((r) => http.once("listening", r));
  port = (http.address() as AddressInfo).port;
  config.PORT = port;
  const base = `http://127.0.0.1:${port}`;
  config.publicBaseUrl = base;
  const client = new Client({ name: "e2e-pdf", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  return { base, config, http, client, pdf, logs };
}

async function stop(r: Running | undefined): Promise<void> {
  if (!r) return;
  await r.client.close();
  await r.pdf.close();
  await new Promise((done) => r.http.close(done));
}

type Structured = { pdfLink?: string; links?: { open?: string; share: string }; spec?: unknown };
const structured = (res: { structuredContent?: unknown }) => (res.structuredContent ?? {}) as Structured;

describe("PDF slået fra (ingen Chromium)", () => {
  let off: Running;
  before(async () => {
    off = await start("/findes/ikke/chromium");
  });
  after(() => stop(off));

  test("/k/:cvr.pdf med ugyldig signatur giver samme fejl som /k/:cvr", async () => {
    const link = companyLink(off.config, { cvr: "99000001", metric: "omsaetning", years: 5 });
    const bad = link.replace(/s=[^&]+/, "s=forkert-signatur000000");
    const html = await fetch(bad);
    const pdf = await fetch(pdfUrlOf(bad));
    assert.equal(html.status, 403);
    assert.equal(pdf.status, html.status);
    assert.equal(boot(await pdf.text()).error, boot(await html.text()).error);
    // Udløbet link: 410 begge steder.
    const old = companyLink(off.config, { cvr: "99000001", metric: "omsaetning", years: 5 }, Date.now() - 400 * 86_400_000);
    assert.equal((await fetch(pdfUrlOf(old))).status, 410);
  });

  test("gyldige links uden Chromium: 503 med teksten, også i portalen", async () => {
    const urls = [
      pdfUrlOf(companyLink(off.config, { cvr: "99000001", metric: "omsaetning", years: 5 })),
      pdfUrlOf(personLink(off.config, "CVR-3-4000000002")),
      pdfUrlOf(entityLink(off.config, "CVR-1-99000001")),
      `${off.base}/x/findes-ikke.pdf`,
      `${off.base}/api/portal/pdf/company/CVR-1-99000001`,
      `${off.base}/api/portal/pdf/person/CVR-3-4000000002?focus=roller`,
    ];
    for (const url of urls) {
      const res = await fetch(url);
      assert.equal(res.status, 503, url);
      assert.deepEqual(await res.json(), { error: PDF_UNAVAILABLE }, url);
    }
    const spec = await fetch(`${off.base}/api/portal/pdf/spec`, { method: "POST", headers: { "content-type": "application/json", "x-lasso-portal": "1" }, body: JSON.stringify({ spec: {} }) });
    assert.equal(spec.status, 503);
  });

  test("knappen skjules: /health pdf false, ingen pdfLink i MCP-svaret, boot.pdf false på delte sider og i portalen", async () => {
    assert.equal(((await (await fetch(`${off.base}/health`)).json()) as { pdf: boolean }).pdf, false);
    const res = await off.client.callTool({ name: "show_company", arguments: { company: "99000001" } });
    assert.equal(structured(res).pdfLink, undefined);
    const page = boot(await (await fetch(companyLink(off.config, { cvr: "99000001", metric: "omsaetning", years: 5 }))).text());
    assert.equal(page.pdf, false);
    assert.equal(page.pdfUrl, undefined);
    assert.equal(boot(await (await fetch(`${off.base}/portal`)).text()).pdf, false);
  });
});

describe("PDF med Chromium", { skip: CAN_RENDER ? false : `kræver Chromium (${CHROMIUM}) og en bygget render-app` }, () => {
  let on: Running;
  before(async () => {
    on = await start(CHROMIUM);
  });
  after(() => stop(on));

  test("delte sider har pdf og pdfUrl (samme signerede query som siden)", async () => {
    const link = companyLink(on.config, { cvr: "99000001", metric: "omsaetning", years: 5, focus: "oekonomi" });
    const page = boot(await (await fetch(link)).text());
    assert.equal(page.pdf, true);
    assert.equal(page.pdfUrl, pdfUrlOf(link));
    assert.equal(boot(await (await fetch(`${on.base}/portal`)).text()).pdf, true);
    assert.equal(((await (await fetch(`${on.base}/health`)).json()) as { pdf: boolean }).pdf, true);
  });

  test("show_company: pdfLink er /k/<cvr>.pdf, og PDF'en er rapporten (mindst 2 sider), med varighed i loggen", async () => {
    const res = await on.client.callTool({ name: "show_company", arguments: { company: "99000001" } });
    const { pdfLink, links } = structured(res);
    assert.ok(links?.share && pdfLink);
    assert.match(links.share, /\/d\/[a-z0-9]{10}$/, "share er det korte link; pdfLink er stadig det signerede /k/-link med .pdf");
    assert.match(pdfLink, /\/k\/99000001\.pdf\?/);
    const pdf = await fetch(pdfLink);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get("content-type"), "application/pdf");
    assert.equal(pdf.headers.get("access-control-expose-headers"), "Content-Disposition");
    assert.match(pdf.headers.get("content-disposition") ?? "", /^attachment; filename=".*"; filename\*=UTF-8''Virksomhedsrapport%20Eksempel%20Byg%20A-S%20\d{4}-\d{2}-\d{2}\.pdf$/);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(pageCount(bytes) >= 2, `sider: ${pageCount(bytes)}`);
    assert.ok(
      on.logs.some((l) => /^\[pdf\] company CVR-1-99000001 \d+\.\d s$/.test(l)),
      on.logs.join("\n"),
    );
  });

  test("show_person: pdfLink er /p/<id>.pdf, og PDF'en er siden (mindst 1 side)", async () => {
    const res = await on.client.callTool({ name: "show_person", arguments: { person: "CVR-3-4000000002", focus: "netvaerk" } });
    const { pdfLink } = structured(res);
    assert.match(pdfLink ?? "", /\/p\/CVR-3-4000000002\.pdf\?.*f=netvaerk/);
    const pdf = await fetch(pdfLink!);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get("content-disposition") ?? "", /filename\*=UTF-8''Bo%20Eksempel%20\d{4}-\d{2}-\d{2}\.pdf$/);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(pageCount(bytes) >= 1);
    assert.ok(on.logs.some((l) => /^\[pdf\] person CVR-3-4000000002 \d+\.\d s$/.test(l)));
  });

  test("search_companies: pdfLink er et /x/-link til listen, som den blev vist, og kan hentes igen", async () => {
    const res = await on.client.callTool({ name: "search_companies", arguments: { query: "Eksempel", limit: 5 } });
    const { pdfLink } = structured(res);
    assert.match(pdfLink ?? "", /\/x\/[A-Za-z0-9_-]{43}\.pdf$/);
    for (let i = 0; i < 2; i++) {
      const pdf = await fetch(pdfLink!);
      assert.equal(pdf.status, 200);
      assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString("latin1"), "%PDF-");
    }
    assert.equal((await fetch(`${on.base}/x/findes-ikke.pdf`)).status, 404);
  });

  test("portalen: rapport for virksomheden og PDF af den viste spec", async () => {
    const company = await fetch(`${on.base}/api/portal/pdf/company/99000001?focus=oekonomi`);
    assert.equal(company.status, 200);
    assert.ok(pageCount(Buffer.from(await company.arrayBuffer())) >= 2);
    const search = (await (await fetch(`${on.base}/api/portal/search?query=Eksempel&limit=3`)).json()) as { spec: unknown };
    const noCsrf = await fetch(`${on.base}/api/portal/pdf/spec`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec: search.spec }) });
    assert.equal(noCsrf.status, 403);
    const pdf = await fetch(`${on.base}/api/portal/pdf/spec`, { method: "POST", headers: { "content-type": "application/json", "x-lasso-portal": "1" }, body: JSON.stringify({ spec: search.spec }) });
    assert.equal(pdf.status, 200);
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString("latin1"), "%PDF-");
  });

  test("print-siden: ukendt token giver 404, også på loopback", async () => {
    assert.equal((await fetch(`${on.base}/print/findes-ikke`)).status, 404);
  });
});
