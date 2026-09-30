import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDataset, listTemplate, parseViewSpec, searchKey, searchQuerySchema, type Dataset, type ViewSpec } from "@lasso/spec";
import { LassoView } from "./LassoView.js";
import { PDF_BUSY_LABEL, PDF_LABEL, runPdf } from "./PdfButton.js";
import { pageScale, pageTemplates, printStamp } from "./print.js";
import type { ToastOptions } from "./components/Toast.js";
import type { ActionResult, HostCapabilities, ViewAction } from "./types.js";

/*
 * "Gem som PDF" (docs/design/README.md, "A4-eksport (27)"): knappen står øverst i hovedet ved
 * Gem/Gemt på alle sider, når værten kan hente PDF'en (host.pdf), og beder værten om { kind: "pdf" }.
 * Den gamle "Eksportér PDF" med Print/Luk-overlay er væk. Print-tilstand (serverens PDF af sider,
 * der ikke er virksomhedsrapporten) har ingen knapper og folder "Se alle" ud.
 */

const CO = "CVR-1-99000001";

function dataset(): Dataset {
  const ds = emptyDataset("demo");
  ds.generatedAt = "2026-09-28T10:02:00.000Z";
  ds.companies[CO] = { lassoId: CO, cvr: "99000001", name: "Eksempel Byg A/S", status: "Normal", form: "A/S" };
  ds.financials[CO] = { lassoId: CO, currency: "DKK", years: [{ year: 2025, grossProfit: 30_000_000, profit: 1_000_000, equity: 10_000_000 }] };
  ds.people[CO] = [
    { name: "Anne Eksempel", role: "Direktør", from: "2015-01-01" },
    { name: "Bo Eksempel", role: "Bestyrelsesformand", from: "2012-05-01" },
    { name: "Carla Prøve", role: "Bestyrelsesmedlem", from: "2016-06-01" },
    { name: "Dan Prøve", role: "Bestyrelsesmedlem", from: "2017-06-01" },
    { name: "Eva Prøve", role: "Bestyrelsesmedlem", from: "2018-06-01" },
    { name: "Finn Prøve", role: "Bestyrelsesmedlem", from: "2019-06-01" },
    { name: "Gert Prøve", role: "Bestyrelsesmedlem", from: "2010-06-01", to: "2014-03-15" },
  ];
  ds.timeline[CO] = { lassoId: CO, events: Array.from({ length: 8 }, (_, i) => ({ date: `${2025 - i}-04-15`, title: `Årsrapport ${2025 - i} offentliggjort`, category: "Regnskab" })) };
  ds.news[CO] = { lassoId: CO, sources: ["Lasso News"], items: [1, 2, 3, 4, 5, 6].map((n) => ({ source: "Avis", url: `https://avis.dk/${n}`, headline: `Nyhed ${n} om byggeriet`, time: "2025-04-15" })) };
  return ds;
}

const companySpec = (): ViewSpec =>
  parseViewSpec({
    kind: "company",
    title: "Eksempel Byg A/S",
    components: [
      { type: "LassoCompanyHead", company: CO },
      { type: "LassoTimeline", company: CO, limit: 3 },
      { type: "LassoNews", company: CO, limit: 3 },
      { type: "LassoPersonList", company: CO, show: "all" },
    ],
  });

const SEARCH = searchQuerySchema.parse({ query: "revisorer", limit: 5 });
const listSpec = (): ViewSpec => listTemplate(SEARCH, { title: "Revisorer i Aarhus" });

const html = (spec: ViewSpec, host: HostCapabilities, extra: { print?: boolean; onAction?: (a: ViewAction) => Promise<ActionResult | void> | void } = {}) =>
  renderToStaticMarkup(createElement(LassoView, { spec, dataset: dataset(), host, onAction: extra.onAction ?? (() => undefined), print: extra.print }));

/**
 * Finder knappen med aria-label i ét render-pas (komponenterne kaldes som funktioner, så deres hooks
 * hører til indpakningen) og giver dens onClick tilbage til kald efter tegningen.
 */
function buttonHandler(element: ReactElement, label: string): () => void {
  let found: (() => void) | undefined;
  const walk = (node: unknown): void => {
    if (found) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isValidElement(node)) return;
    const { type, props } = node as ReactElement<{ children?: ReactNode; onClick?: () => void; "aria-label"?: string }>;
    if (typeof type === "function") return walk((type as (p: unknown) => unknown)(props));
    if (type === "button" && props["aria-label"] === label) {
      found = props.onClick;
      return;
    }
    walk(props.children);
  };
  function Probe() {
    walk(element);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  assert.ok(found, `ingen knap med aria-label ${label}`);
  return found!;
}

test("'Gem som PDF' står helt til højre i hovedet med host.pdf og mangler uden", () => {
  // Liste: rammens hoved (navnet øverst, PDF til højre); virksomhedsside: virksomhedshovedet efter ikonerne.
  const list = html(listSpec(), { pdf: true });
  const header = /<header class="lasso-frame__header lasso-frame__header--bar">([^]*?)<\/header>/.exec(list)![1]!;
  assert.match(header, /<div class="lasso-frame__actions"><button type="button" class="lasso-iconbtn lasso-frame__pdf" aria-label="Gem som PDF"/);
  assert.match(header, /<span class="lasso-frame__pdf-label">Gem som PDF<\/span><\/button><\/div>$/);
  const company = html(companySpec(), { pdf: true });
  assert.doesNotMatch(company, /lasso-frame__header/, "virksomhedssiden: navnet i virksomhedshovedet er øverst");
  assert.match(company, /<div class="lasso-headactions lasso-company__actions"[^>]*>[^]*<button type="button" class="lasso-iconbtn lasso-frame__pdf" aria-label="Gem som PDF"[^]*?<\/button><\/div><\/header>/);
  for (const spec of [companySpec(), listSpec()]) assert.doesNotMatch(html(spec, { export: true }), /Gem som PDF/);
});

test("'Gem som PDF' står efter Gem/Gemt, helt til højre", () => {
  const on = html(companySpec(), { pdf: true, savePage: true });
  assert.match(on, /lasso-headbtn--save[^]*lasso-frame__pdf/);
});

test("den gamle 'Eksportér PDF' med Print/Luk er væk; 'Eksportér CSV' bliver", () => {
  const page = html(companySpec(), { export: true, pdf: true });
  assert.doesNotMatch(page, /Eksportér<span class="lasso-btn__label--optional"> PDF/);
  assert.doesNotMatch(page, /lasso-a4|>Print<|>Luk</);
  const ds = dataset();
  ds.searches[searchKey(SEARCH)] = { key: searchKey(SEARCH), rows: [{ lassoId: CO, name: "Eksempel Byg A/S", city: "Silkeborg" }], total: 1 };
  const list = renderToStaticMarkup(createElement(LassoView, { spec: listSpec(), dataset: ds, host: { export: true, pdf: true }, onAction: () => undefined }));
  assert.match(list, /Eksportér<span class="lasso-btn__label--optional"> CSV/);
  assert.match(list, /Gem som PDF/);
});

test("klik på 'Gem som PDF' beder værten om { kind: 'pdf' }", async () => {
  const actions: ViewAction[] = [];
  const click = buttonHandler(
    createElement(LassoView, { spec: listSpec(), dataset: dataset(), host: { pdf: true }, onAction: (a: ViewAction) => void actions.push(a) }),
    PDF_LABEL,
  );
  click();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(actions, [{ kind: "pdf" }]);
  assert.equal(PDF_BUSY_LABEL, "Laver PDF …");
});

test("runPdf: fejl med 'Prøv igen', værtens besked som bekræftelse", async () => {
  const toasts: ToastOptions[] = [];
  let retried = 0;
  await runPdf(async () => ({ ok: false, error: "Linket er udløbet." }), (o) => void toasts.push(o), () => retried++);
  assert.equal(toasts[0]!.tone, "error");
  assert.equal(toasts[0]!.text, "Linket er udløbet.");
  toasts[0]!.action!.onClick();
  assert.equal(retried, 1);
  await runPdf(async () => ({ ok: true, message: "PDF'en er hentet" }), (o) => void toasts.push(o), () => undefined);
  assert.deepEqual(toasts[1], { text: "PDF'en er hentet", tone: "ok" });
  await runPdf(async () => ({ ok: true }), (o) => void toasts.push(o), () => undefined);
  await runPdf(() => undefined, (o) => void toasts.push(o), () => undefined);
  assert.equal(toasts.length, 2, "ingen besked, når værten ikke har en");
  await runPdf(async () => Promise.reject(new Error("Netværksfejl")), (o) => void toasts.push(o), () => undefined);
  assert.equal(toasts[2]!.text, "Netværksfejl");
});

test("print-tilstand: ingen handlingsbjælke eller knapper, 'Se alle' foldet ud", () => {
  const host: HostCapabilities = { pdf: true, savePage: true, export: true, refresh: true, save: true, back: true };
  const screen = html(companySpec(), host);
  assert.match(screen, /class="lasso-actionbar"/);
  assert.match(screen, /Se alle 8 begivenheder/);

  const print = html(companySpec(), host, { print: true });
  assert.match(print, /^<div class="lasso-root lasso-root--print" data-theme="light">/);
  assert.doesNotMatch(print, /lasso-actionbar/);
  assert.doesNotMatch(print, /Gem som PDF|lasso-frame__save|Tilbage|Opdatér|Gem visning/);
  assert.doesNotMatch(print, /Se alle/);
  // Alle 8 begivenheder, alle 6 nyheder og alle 6 personer står.
  for (let i = 0; i < 8; i++) assert.match(print, new RegExp(`Årsrapport ${2025 - i} offentliggjort`));
  for (let n = 1; n <= 6; n++) assert.match(print, new RegExp(`Nyhed ${n} om byggeriet`));
  assert.match(print, /Finn Prøve/);
  // "Vis færre" står i markup'en, men print-CSS'en skjuler foldeknapperne (.lasso-more, .lasso-news__more m.fl.).
  assert.doesNotMatch(print.replace(/<button type="button" class="lasso-link[^"]*"[^>]*>Vis færre[^]*?<\/button>/g, ""), /<button/);
  // Ingen kildeikoner udefra: serverens Chromium henter intet fra nettet.
  assert.doesNotMatch(print, /<img/);
});

test("print-tilstand: faner står som overskrift (den viste fane), ikke som fanebjælke", () => {
  const print = html(companySpec(), {}, { print: true });
  assert.doesNotMatch(print, /role="tablist"/);
  assert.match(print, /<div class="lasso-tabs-print lasso-tabs-print--l3 [^"]*" role="heading" aria-level="5">Alle<\/div>/);
  assert.match(html(companySpec(), {}), /role="tablist"/);
});

test("sidehoved og sidefod: mærke, navn, datastempel i dansk tid (ingen kilder) og 'side x af n'", () => {
  const { headerTemplate, footerTemplate } = pageTemplates({ title: "Bo <Eksempel>", generatedAt: "2026-09-28T10:02:00.000Z" });
  assert.match(headerTemplate, /<svg viewBox="0 0 117 97"/);
  assert.match(headerTemplate, /Bo &lt;Eksempel&gt;/);
  assert.match(headerTemplate, /Data hentet 28\.09\.2026 kl\. 12\.02/);
  assert.doesNotMatch(footerTemplate, /Kilder/);
  assert.match(footerTemplate, /Data pr\. 28\.09\.2026/);
  assert.match(footerTemplate, /side <span class="pageNumber"><\/span> af <span class="totalPages"><\/span>/);
  assert.match(headerTemplate + footerTemplate, /padding:0 14mm/);
  assert.deepEqual(printStamp("2026-12-31T23:30:00Z"), { date: "01.01.2027", time: "00.30" });
  // 794 px bred visning mellem 14 mm margener.
  assert.ok(Math.abs(pageScale() - 0.8667) < 0.001, String(pageScale()));
});

test("MCP-hovedet (minimalHead, Jakob 30.09): kun 'Vis i fuld skærm' og 'Gem som PDF', ingen Gem- og Eksportér-ikoner", () => {
  const on = html(companySpec(), { pdf: true, savePage: true, export: true, fullscreen: true, minimalHead: true });
  assert.doesNotMatch(on, /lasso-headbtn--save|lasso-headbtn--export|lasso-frame__save/);
  assert.match(on, /lasso-fsbtn[^>]*>[^]*?Vis i fuld skærm<\/button>/);
  assert.match(on, /lasso-frame__pdf/);
  assert.doesNotMatch(html(companySpec(), { pdf: true, fullscreen: true, fullscreenActive: true, minimalHead: true }), /Vis i fuld skærm|>Fuld skærm</);
  // Uden minimalHead (delte sider) står ikonerne som før.
  assert.match(html(companySpec(), { pdf: true, savePage: true }), /lasso-headbtn--save/);
});
