import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDataset, type Dataset, type FinancialYear } from "@lasso/spec";
import { ReportA4 } from "./components/ReportA4.js";

const ID = "CVR-1-99000001";

/** Lille datasæt til rapporten, uden serverens DemoProvider (UI-pakken må ikke importere serveren). */
function dataset(opts: { score?: number | null; financials?: boolean } = {}): Dataset {
  const ds = emptyDataset("demo");
  ds.generatedAt = "2026-09-25T14:02:00";
  ds.companies[ID] = {
    lassoId: ID,
    cvr: "99000001",
    name: "Eksempel Byg A/S",
    status: "Aktiv",
    statusKind: "active",
    form: "A/S",
    industryCode: "412000",
    industryText: "Opførelse af bygninger",
    address: { street: "Prøvevej 1", zip: "8600", city: "Silkeborg" },
    employees: 64,
  };
  if (opts.financials !== false) {
    const years: FinancialYear[] = [2021, 2022, 2023, 2024, 2025].map((year, i) => {
      const gross = 30_000_000 + i * 2_000_000;
      const equity = 10_000_000 + i * 500_000;
      return {
        year,
        periodStart: `${year}-01-01`,
        periodEnd: `${year}-12-31`,
        revenue: gross * 2,
        grossProfit: gross,
        profit: i === 4 ? -201_000 : 1_000_000 + i * 100_000,
        equity,
        employees: 60 + i,
        liabilities: 15_000_000,
        assetsTotal: equity + 15_000_000,
        ebitda: 3_000_000,
        soliditetsgrad: 40 + i,
        overskudsgrad: 5,
        likviditetsgrad: null,
      };
    });
    ds.financials[ID] = { lassoId: ID, currency: "DKK", years };
    ds.financialStatements[ID] = {
      lassoId: ID,
      currency: "DKK",
      incomeStatement: years.map((y) => ({ year: y.year, revenue: y.revenue, grossProfit: y.grossProfit, staffCosts: -20_000_000, otherOperatingCosts: -1_500_000, ebitda: 3_000_000, depreciation: -800_000, financialItemsNet: -200_000, profitBeforeTax: 2_000_000, tax: -440_000, profit: y.profit })),
      balanceSheet: years.map((y) => ({ year: y.year, fixedAssetsTotal: 9_000_000, currentAssetsTotal: 16_000_000, assetsTotal: y.assetsTotal, equityTotal: y.equity, longTermLiabilities: 6_000_000, shortTermLiabilities: 9_000_000, liabilitiesAndEquityTotal: y.assetsTotal })),
      cashFlow: [],
    };
  }
  ds.people[ID] = [
    { name: "Anne Eksempel", role: "Direktør", from: "2015-01-01" },
    { name: "Bo Eksempel", role: "Bestyrelsesformand", from: "2012-05-01" },
    { name: "Dan Prøve", role: "Bestyrelsesmedlem", from: "2016-06-01", to: "2024-03-15" },
  ];
  ds.ownership[ID] = {
    lassoId: ID,
    owners: [
      { name: "Eksempel Holding ApS", share: "66,67–89,99 %", kind: "company" },
      { name: "Anne Eksempel", share: "10–14,99 %", kind: "person" },
    ],
    auditor: { name: "Eksempel Revision Midt ApS", from: "2019-01-01" },
  };
  ds.beneficialOwnership[ID] = { lassoId: ID, owners: [{ name: "Bo Eksempel", chain: "via Eksempel Holding ApS, 66,67–89,99 %", share: "66,67–89,99 %" }] };
  ds.observations[ID] = { lassoId: ID, observations: [{ id: "o1", severity: 50, title: "Revisor skiftet", detail: "Ny revisor ved seneste regnskab.", source: "CVR", date: "2025-04-10" }], checkedAt: "2026-09-25", sources: ["CVR"] };
  ds.auditorIndependence[ID] = { lassoId: ID, auditorName: "Eksempel Revision Midt ApS", checkedAt: "2026-09-25", relations: [] };
  if (opts.score !== undefined) ds.scores[ID] = { lassoId: ID, score: opts.score, source: "Eksempeldata", updated: "2026-09-12" };
  return ds;
}

function render(ds: Dataset): string {
  return renderToStaticMarkup(createElement(ReportA4, { company: ID, dataset: ds }));
}

test("rapporten har fire sider med sidehoved, sidefod og sidetal 'x af 4'", () => {
  const html = render(dataset({ score: 52 }));
  const pages = html.match(/<section class="lasso-a4-page/g) ?? [];
  assert.equal(pages.length, 4);
  assert.equal((html.match(/lasso-a4__head/g) ?? []).length >= 4, true);
  for (let i = 1; i <= 4; i++) assert.match(html, new RegExp(`side ${i} af 4`));
  assert.match(html, /1 af 4/);
  // Sidehoved på hver side bærer virksomheden (side 2–4) eller navnelogoet (forsiden).
  assert.equal((html.match(/Eksempel Byg A\/S,/g) ?? []).length, 3);
  assert.equal((html.match(/aria-label="Lasso"/g) ?? []).length >= 4, true);
});

test("ingen knapper eller interaktion i rapporten", () => {
  const html = render(dataset({ score: 52 }));
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /<title>/);
});

test("negative tal vises med ægte minus og tusindtalspunktum", () => {
  const html = render(dataset({ score: 52 }));
  assert.match(html, /−201/);
  assert.match(html, /−20\.000/);
  assert.doesNotMatch(html, />-\d/);
});

test("kreditscore og 'Ikke oplyst', når scoren mangler", () => {
  assert.match(render(dataset({ score: 52 })), /52, lav risiko/);
  assert.match(render(dataset({ score: 52 })), /0, lav risiko/);
  const without = render(dataset({ score: null }));
  assert.match(without, /Ikke oplyst/);
  assert.doesNotMatch(without, /af 100/);
  const none = render(dataset());
  assert.match(none, /Kreditscore<\/span><span class="lasso-a4-cover__value lasso-a4__faint">Ikke oplyst/);
});

test("sider uden data udelades og sidetal beregnes derefter", () => {
  const html = render(dataset({ financials: false }));
  const pages = html.match(/<section class="lasso-a4-page/g) ?? [];
  assert.equal(pages.length, 3);
  assert.match(html, /side 3 af 3/);
  assert.doesNotMatch(html, /Regnskab 20/);
  assert.doesNotMatch(html, /af 4/);
});

test("indholdsfortegnelsen peger på de rigtige sider", () => {
  const html = render(dataset({ score: 52 }));
  assert.match(html, /Nøgletal og udvikling<\/span><span class="lasso-a4-toc__page">2/);
  assert.match(html, /Regnskab 2021–2025<\/span><span class="lasso-a4-toc__page">3/);
  assert.match(html, /Kreditvurdering og risiko<\/span><span class="lasso-a4-toc__page">4/);
});

test("27.4: side 4 viser risikoobservationerne med farvet prik og titel uden alvorsord (Paper), ordet kun for skærmlæsere", () => {
  const html = render(dataset({ score: 52 }));
  assert.match(html, /<h2 class="lasso-a4__h2">Risikoobservationer<\/h2>/);
  assert.match(html, /lasso-a4-obs__dot--middel" role="img" aria-label="alvor middel"[^]*>Revisor skiftet</);
  assert.doesNotMatch(html, /Middel, Revisor skiftet/);
});

test("27.2: grafens søjler er ca. 40 px brede som i Paper (Fable-review R3)", () => {
  const html = render(dataset({ score: 52 }));
  const bars = [...html.matchAll(/<rect class="lasso-a4-chart__bar[^"]*"[^>]*width="(\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]));
  assert.ok(bars.length > 0);
  for (const w of bars) assert.equal(w, 40, `søjle ${w} px`);
});
