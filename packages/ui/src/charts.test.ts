import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FinancialsVM, IndustryBenchmarkVM, MapPointVM, ScoreVM } from "@lasso/spec";
import { BarChart, pickableMetrics } from "./components/BarChart.js";
import { ScoreGauge } from "./components/ScoreGauge.js";
import { KeyFigureGauge, assessAgainstMedian } from "./components/KeyFigureGauge.js";
import { Heatmap, heatStep } from "./components/Heatmap.js";
import { layoutMap } from "./components/CompanyMap.js";
import { ScoreHistory } from "./components/ScoreHistory.js";
import { ScoreCompare } from "./components/ScoreCompare.js";
import { CreditConfirmDialog } from "./components/CreditConfirmDialog.js";
import { ShareBars, parseShareRange } from "./components/ShareBars.js";
import { waterfallSteps } from "./components/WaterfallChart.js";
import { balanceYears } from "./components/StackedBarChart.js";
import { changeText } from "./chartPick.js";
import { DataState } from "./primitives.js";

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const ID = "CVR-1-99000001";
const FIN: FinancialsVM = {
  lassoId: ID,
  currency: "DKK",
  years: [2021, 2022, 2023].map((year, i) => ({ year, grossProfit: 10_000_000 + i * 1_000_000, profit: 900_000 + i * 100_000, equity: 4_000_000 + i * 500_000, liabilities: 3_000_000, soliditetsgrad: 50 + i, overskudsgrad: 6 - i })),
};

test("10.1: scoremålerens hente-tilstande: stiplet med pris i knappen, henter med 4 px bjælke, grå med årsag; tallet først efter hentning", () => {
  const base: ScoreVM = { lassoId: ID, score: null };
  const idle = html(createElement(ScoreGauge, { score: { ...base, state: "notfetched", cost: "1 kredit" }, onFetch: () => {} }));
  assert.match(idle, /lasso-gauge-state--idle/);
  assert.match(idle, />Hent vurdering, 1 kredit<\/button>/);
  assert.doesNotMatch(idle, /af 100|lasso-gauge__track/);
  const busy = html(createElement(ScoreGauge, { score: { ...base, state: "fetching", progress: 0.4 } }));
  assert.match(busy, /lasso-gauge-state--busy[^]*lasso-spinner[^]*role="progressbar"[^]*aria-valuenow="40"/);
  const off = html(createElement(ScoreGauge, { score: { ...base, state: "unavailable", reason: "Holdingselskab uden drift." } }));
  assert.match(off, /lasso-gauge-state--off[^]*Holdingselskab uden drift\./);
  const ok = text(html(createElement(ScoreGauge, { score: { lassoId: ID, score: 72, facts: [{ label: "Kreditmaksimum", value: "4,5 mio. kr." }] } })));
  assert.match(ok, /72 af 100 Moderat risiko/);
  assert.match(ok, /Kreditmaksimum 4,5 mio\. kr\./);
});

test("10.3: DataState 'ondemand' har årsag, pris og handling i stiplet ramme", () => {
  const h = html(createElement(DataState, { state: "ondemand", reason: "Beregnes ud fra seneste regnskab.", cost: "Tager op til 10 sekunder", actionLabel: "Beregn nu", onAction: () => {} }));
  assert.match(h, /lasso-state lasso-state--ondemand/);
  assert.match(text(h), /Beregnes på forespørgsel Beregnes ud fra seneste regnskab\. Tager op til 10 sekunder Beregn nu/);
});

test("13.2: søjlegrafen har nøgletalsvælger øverst til højre og en fokuserbar ramme til tastatur", () => {
  const h = html(createElement(BarChart, { financials: FIN, metric: "bruttofortjeneste", years: 5 }));
  assert.match(h, /lasso-section__action[^]*<select class="lasso-select lasso-chart__select"/);
  assert.match(h, /<option value="resultat">Årets resultat<\/option>/);
  assert.match(h, /class="lasso-chart__plot" tabindex="0"/);
  assert.deepEqual(pickableMetrics(FIN, 5), ["bruttofortjeneste", "resultat", "egenkapital", "gaeld", "soliditetsgrad", "overskudsgrad"]);
  assert.deepEqual(changeText(100, 112.1), { text: "▲ 12,1 %", dir: "up" });
  assert.deepEqual(changeText(100, -5), { text: "▼ 105,0 %", dir: "down" });
  assert.equal(changeText(0, 5), null);
});

test("13.5/13.7: balance som aktiver og passiver, vandfald fra bruttofortjeneste med underposter", () => {
  const rows = balanceYears(FIN, { lassoId: ID, currency: "DKK", incomeStatement: [], balanceSheet: [{ year: 2023, fixedAssetsTotal: 3_000_000, currentAssetsTotal: 5_000_000, equityTotal: 5_000_000, longTermLiabilities: 1_000_000, shortTermLiabilities: 2_000_000 }], cashFlow: [] }, 5);
  const last = rows.at(-1)!;
  assert.deepEqual(last.assets.map((s) => s.tone), ["s4", "s4b"], "aktiver i koral-familien");
  assert.deepEqual(last.liabilities.map((s) => s.tone), ["s1", "s2", "s3"], "egenkapital koral, gæld blå");
  assert.equal(last.total, 8_000_000);
  const wf = waterfallSteps(FIN, { lassoId: ID, currency: "DKK", balanceSheet: [], cashFlow: [], incomeStatement: [{ year: 2023, grossProfit: 12_000_000, staffCosts: -8_000_000, depreciation: -1_000_000, tax: -300_000, profit: 1_100_000 }] })!;
  assert.deepEqual(wf.steps.map((s) => s.label), ["Bruttofortjeneste", "Personaleomkostninger", "Af- og nedskrivninger", "Finans og skat", "Øvrige poster", "Årets resultat"]);
});

test("13.8: donut + andelsbjælker; ejerkreds med CVR-intervaller som tekst, bjælken tegner maks", () => {
  assert.deepEqual(parseShareRange("50-66,66 %"), [50, 66.66]);
  assert.deepEqual(parseShareRange("100 %"), [100, 100]);
  const h = html(createElement(ShareBars, { variant: "ejerkreds", ownership: { lassoId: ID, owners: [{ name: "Erik Prøve", share: "50-66,66 %" }, { name: "Fie Eksempel", share: "33,34-49,99 %" }] } }));
  assert.match(h, /lasso-donut/);
  assert.match(h, /width:66\.66%/);
  assert.match(text(h), /Erik Prøve 50–66,66 %/);
  assert.doesNotMatch(h, /·/);
});

test("13.10: nøgletalsmåler med branchemærke: to linjer (etiket, værdi + branche), farvet bjælke med ordet i aria-label", () => {
  assert.equal(assessAgainstMedian(12, 10)!.index, 0);
  assert.equal(assessAgainstMedian(7, 10)!.index, 1);
  assert.equal(assessAgainstMedian(3, 10)!.index, 2);
  const industry: IndustryBenchmarkVM = { lassoId: ID, state: "ok", industryText: "Prøvebranche", years: [{ year: 2023, median: { soliditetsgrad: 40, overskudsgrad: 10 } }], source: "Eksempeldata" };
  const h = html(createElement(KeyFigureGauge, { financials: FIN, industry }));
  assert.match(h, /lasso-kfg__fill lasso-kfg__fill--0" style="width:65%"/, "52 % på skalaen 0–80 %");
  assert.match(h, /lasso-kfg__value">52,0 %, branche 40,0 %</);
  assert.match(h, /aria-label="Overskudsgrad [^"]*klart under branchen"/);
  assert.doesNotMatch(h, /lasso-kfg__word|lasso-kfg__legend/);
  assert.match(h, /lasso-kfg__mark/);
  const none = html(createElement(KeyFigureGauge, { financials: FIN, industry: { lassoId: ID, state: "unavailable", reason: "Ingen branchetal.", years: [] } }));
  assert.match(none, /Ingen branchetal\./);
});

test("13.11: heatmap i 5 sekventielle trin, tallet i cellen ved hover (data-n)", () => {
  assert.deepEqual([0, 1, 5, 10].map((n) => heatStep(n, 10)), [1, 2, 3, 5]);
  const h = html(createElement(Heatmap, { heatmap: { listName: "Kunder", months: ["2026-08", "2026-09"], rows: [{ type: "regnskab", counts: [0, 4] }], total: 4 } }));
  assert.match(h, /Aktivitet i &quot;Kunder&quot;/);
  assert.match(h, /lasso-heat__cell lasso-heat__cell--1"[^>]*data-n="0"/);
  assert.match(h, /lasso-heat__cell lasso-heat__cell--5"[^>]*data-n="4"/);
  assert.match(h, /Færre[^]*Flere/);
});

test("13.12: kortet klynger relaterede adresser tæt på hinanden, aldrig hovedadressen", () => {
  const P = (id: string, kind: MapPointVM["kind"], lat: number, lon: number): MapPointVM => ({ id, kind, name: `Prøve ${id}`, lat, lon });
  const m = layoutMap([P("f", "focus", 56.17, 9.55), P("a", "related", 56.1567, 10.2108), P("b", "related", 56.1568, 10.211), P("c", "related", 55.7, 9.5)], 400, 280);
  assert.equal(m.filter((x) => x.kind === "focus").length, 1);
  const cluster = m.find((x) => x.kind === "cluster");
  assert.equal(cluster?.points.length, 2);
  assert.ok(m.every((x) => x.x >= 0 && x.x <= 400 && x.y >= 0 && x.y <= 280));
});

test("18.1/18.2: forrige vs. nu og trinlinje; en stigning er mere risiko i warning-tekst", () => {
  const cmp = html(createElement(ScoreCompare, { previous: { value: "47" }, current: { value: "52" }, direction: "worse", amount: "5 point" }));
  assert.match(cmp, /lasso-scorecmp__change--worse[^]*▲ 5 point, mere risiko/);
  // 18.1 (Jakob 29.09): uden forrige kun den aktuelle score, ingen ændring.
  const single = html(createElement(ScoreCompare, { current: { value: "52", of: "af 100" } }));
  assert.match(single, /lasso-scorecmp--single[^]*Aktuel score[^]*52/);
  assert.doesNotMatch(single, /Forrige|lasso-scorecmp__change/);
  const h = html(createElement(ScoreHistory, { history: { lassoId: ID, points: [{ date: "2025-01-01", score: 40 }, { date: "2026-06-01", score: 65 }], source: "Eksempeldata" } }));
  assert.match(h, /lasso-scorehist__zone--low[^]*lasso-scorehist__zone--mid[^]*lasso-scorehist__zone--high/);
  assert.match(text(h), /Forrige, 01\.01\.2025 40 af 100[^]*\+25, mere risiko[^]*Nu, 01\.06\.2026 65 af 100/);
  const empty = html(createElement(ScoreHistory, { history: { lassoId: ID, points: [], reason: "Ingen historik endnu." } }));
  assert.match(empty, /Ingen historik endnu\./);
});

test("18.3: bekræft hentning viser pris og saldo efter (ingen ventetid); ved 0 kreditter 'Køb kreditter' og rød pris", () => {
  const ok = text(html(createElement(CreditConfirmDialog, { open: true, onClose: () => {}, onConfirm: () => {}, balance: 12 })));
  assert.match(ok, /Pris 1 kredit Saldo efter 11 kreditter/);
  assert.doesNotMatch(ok, /Ventetid/);
  assert.match(ok, /Hent, 1 kredit/, "prisen gentages i knappen");
  const zero = html(createElement(CreditConfirmDialog, { open: true, onClose: () => {}, onConfirm: () => {}, onBuy: () => {}, balance: 0 }));
  assert.match(zero, /lasso-creditconfirm__price--short">1 kredit/);
  assert.match(zero, />Køb kreditter<\/button>/);
  assert.doesNotMatch(zero, /Hent, /);
});
