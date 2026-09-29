import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup as html } from "react-dom/server";
import type { CompanyVM, FinancialsVM, NewsVM } from "@lasso/spec";
import { KeyFigureCards } from "./components/KeyFigureCards.js";
import { LassoSummary, paragraphs } from "./components/LassoSummary.js";
import { Ranking } from "./components/Ranking.js";
import { LassoNews } from "./components/LassoNews.js";
import { LineChart } from "./components/LineChart.js";
import { Sparkline } from "./primitives.js";

const fin = (id: string, gross: number, extra: Partial<FinancialsVM["years"][number]> = {}): FinancialsVM => ({
  lassoId: id,
  currency: "DKK",
  years: [2023, 2024, 2025].map((year, i) => ({ year, grossProfit: gross + i * 1_000_000, profit: 1_000_000, equity: 5_000_000, employees: 17, ...extra })),
});

test("09.1/09.4: 'Henter' er kortformede skeletter, ét pr. kort", () => {
  const out = html(h(KeyFigureCards, {}));
  assert.match(out, /lasso-kpis lasso-kpis--loading/);
  assert.equal(out.match(/class="lasso-kpi"/g)?.length, 4);
  assert.equal(out.match(/lasso-kpi__skel /g)?.length, 12);
});

test("09.4: valgte nøgletal uden tal vises som 'Ikke oplyst' med årsag, aldrig som første kort", () => {
  const out = html(h(KeyFigureCards, { financials: fin("CVR-1-1", 20_000_000), metrics: ["omsaetning", "bruttofortjeneste", "resultat"] }));
  assert.match(out, /Ikke oplyst/);
  assert.match(out, /Klasse B kræver ikke omsætning/);
  assert.ok(out.indexOf("Bruttofortjeneste") < out.indexOf("Ikke oplyst"));
});

test("12.2: afsnit bevares, og foldet tekst har 'Vis mere'", () => {
  assert.deepEqual(paragraphs("Et.\n\nTo\nlinjer."), ["Et.", "To linjer."]);
  const long = `${"Første afsnit er langt. ".repeat(12)}\n\n${"Andet afsnit. ".repeat(10)}`;
  const out = html(h(LassoSummary, { text: long }));
  assert.equal(out.match(/<p class="lasso-summary__body">/g)?.length, 2);
  assert.match(out, />Vis mere</);
  assert.doesNotMatch(out, /Læs mere/);
});

test("13.3: tallet står lige efter bjælken (i samme spor), ingen medianrække", () => {
  const co = (id: string, name: string) => ({ lassoId: id, name }) as CompanyVM;
  const out = html(
    h(Ranking, {
      metric: "bruttofortjeneste",
      rows: [
        { lassoId: "CVR-1-1", company: co("CVR-1-1", "A"), financials: fin("CVR-1-1", 20_000_000) },
        { lassoId: "CVR-1-2", company: co("CVR-1-2", "B"), financials: fin("CVR-1-2", 30_000_000) },
      ],
    }),
  );
  assert.match(out, /lasso-ranking__track"[^>]*><span class="lasso-ranking__fill[^"]*"><\/span><span class="lasso-ranking__value">/);
  assert.doesNotMatch(out, /Median/);
});

test("12.4: Lasso News har Lasso-ikonet, andre kilder favicon", () => {
  const news = {
    lassoId: "CVR-1-1",
    items: [
      { id: "1", headline: "Nyt regnskab", source: "Lasso News", time: "2025-04-15" },
      { id: "2", headline: "Artikel", source: "Prøve Medier", url: "https://example.dk/a", time: "2025-02-02" },
    ],
  } as unknown as NewsVM;
  const out = html(h(LassoNews, { news }));
  assert.equal(out.match(/lasso-news__lasso/g)?.length, 1);
  assert.match(out, /favicons\?sz=32&amp;domain=example\.dk/);
});

test("13.6: legenden bruger virksomhedens navn og en linjemarkør", () => {
  const out = html(h(LineChart, { financials: fin("CVR-1-1", 20_000_000), benchmarkFinancials: fin("CVR-1-2", 30_000_000), benchmarkName: "Konkurrent A/S", companyName: "Eksempel Byg A/S", metric: "bruttofortjeneste", years: 3 }));
  assert.match(out, /lasso-chart__legend-item--line"><span class="lasso-chart__swatch lasso-chart__swatch--s1" aria-hidden="true"><\/span>Eksempel Byg A\/S/);
});

test("13.9: en næsten flad serie tegnes flad (lille udsving), ikke fra top til bund", () => {
  const out = html(h(Sparkline, { values: [12, 12.2, 11.9, 12.1], bare: true }));
  const ys = [...out.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(Math.max(...ys) - Math.min(...ys) < 4, `udsving ${ys.join(", ")}`);
});
