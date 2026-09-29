import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { emptyDataset, parseViewSpec } from "@lasso/spec";
import { Accordion, CardGrid } from "./components/Layout.js";
import { groupItemLabel, groupRuns, LassoView, mergeFullGroups, columnBands } from "./LassoView.js";

test("Harmonika (30, mønster 9): aria-expanded, skjult panel og meta som ren tekst", () => {
  const html = renderToStaticMarkup(
    createElement(Accordion, {
      defaultOpen: ["n"],
      items: [
        { id: "o", title: "Observationer", meta: "Se detaljer", children: "obs" },
        { id: "n", title: "Nøgletal", meta: "3 kommentarer", children: "tal" },
      ],
    }),
  );
  assert.match(html, /aria-expanded="false"[^>]*aria-controls="acc-o"/);
  assert.match(html, /aria-expanded="true"[^>]*aria-controls="acc-n"/);
  assert.match(html, /id="acc-o"[^>]*hidden=""/);
  assert.doesNotMatch(html, /id="acc-n"[^>]*hidden/);
  assert.match(html, /lasso-accordion__meta">3 kommentarer</);
});

test("Kortgitter (30, mønster 8)", () => {
  const html = renderToStaticMarkup(createElement(CardGrid, null, createElement("article", null, "a"), createElement("article", null, "b")));
  assert.match(html, /class="lasso-cardgrid "/);
  assert.equal((html.match(/<article>/g) ?? []).length, 2);
});

const C = "CVR-1-99000001";

test("groupRuns samler kun sammenhængende komponenter med samme group.id; én alene er ingen gruppe", () => {
  const spec = parseViewSpec({
    title: "x",
    components: [
      { type: "LassoCompanyHead", company: C },
      { type: "LassoIncomeStatement", company: C, group: { id: "r", pattern: "accordion" } },
      { type: "LassoBalanceSheet", company: C, group: { id: "r", pattern: "accordion", title: "Regnskab" } },
      { type: "LassoCashFlow", company: C, group: { id: "r", pattern: "accordion" } },
      { type: "LassoNews", company: C, group: { id: "solo", pattern: "cards" } },
      { type: "LassoTimeline", company: C, group: { id: "r", pattern: "accordion" } },
    ],
  });
  const runs = groupRuns(spec.components.map((c, i) => ({ c, i })));
  assert.deepEqual(
    runs.map((r) => (r.kind === "one" ? r.item.i : r.items.map((x) => x.i))),
    [0, [1, 2, 3], 4, 5],
  );
  const g = runs[1]!;
  assert.ok(g.kind === "group" && g.group.title === "Regnskab", "første title i gruppen bliver overskrift");
});

test("LassoView tegner group 'accordion' som harmonika med rækkenavne og første række åben", () => {
  const spec = parseViewSpec({
    kind: "company",
    title: "Eksempel Byg A/S",
    components: [
      { type: "LassoIncomeStatement", company: C, group: { id: "regnskab", pattern: "accordion", title: "Regnskab" } },
      { type: "LassoBalanceSheet", company: C, group: { id: "regnskab", pattern: "accordion" } },
      { type: "LassoCashFlow", company: C, group: { id: "regnskab", pattern: "accordion" } },
    ],
  });
  const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: emptyDataset("demo"), host: {}, onAction: () => {} }));
  assert.equal((html.match(/class="lasso-cell /g) ?? []).length, 1, "én celle for hele gruppen");
  assert.match(html, /lasso-cell--full"><section class="lasso-section lasso-group lasso-group--accordion" data-group="regnskab">/);
  assert.match(html, /lasso-section__title">Regnskab</);
  const titles = [...html.matchAll(/lasso-accordion__title">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(titles, ["Resultatopgørelse", "Balance", "Pengestrøm"]);
  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 1);
});

test("LassoView tegner group 'cards' som kortgitter i gruppens bredde", () => {
  const spec = parseViewSpec({
    title: "Kort",
    components: [
      { type: "LassoContact", company: C, width: "half", group: { id: "k", pattern: "cards" } },
      { type: "LassoContactPersons", company: C, group: { id: "k", pattern: "cards" } },
    ],
  });
  const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: emptyDataset("demo"), host: {}, onAction: () => {} }));
  assert.match(html, /lasso-cell lasso-cell--half"><section class="lasso-section lasso-group lasso-group--cards"[^>]*><div class="lasso-cardgrid ">/);
  assert.equal((html.match(/class="lasso-cardgrid__item"/g) ?? []).length, 2);
});

test("Layout 'columns': grupper virker både i fuld bredde og inde i en kolonne", () => {
  const spec = parseViewSpec({
    kind: "company",
    title: "x",
    layout: "columns",
    components: [
      { type: "LassoCompanyHead", company: C },
      { type: "LassoPersonList", company: C, column: 1, group: { id: "p", pattern: "accordion" } },
      { type: "LassoOwnerList", company: C, column: 1, group: { id: "p", pattern: "accordion" } },
      { type: "LassoTimeline", company: C, column: 2 },
      { type: "LassoIncomeStatement", company: C, group: { id: "r", pattern: "accordion" } },
      { type: "LassoBalanceSheet", company: C, group: { id: "r", pattern: "accordion" } },
    ],
  });
  const bands = mergeFullGroups(columnBands(spec.components));
  assert.deepEqual(bands.map((b) => b.kind), ["full", "columns", "group"]);
  const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: emptyDataset("demo"), host: {}, onAction: () => {} }));
  assert.match(html, /lasso-column__item"[^>]*><section class="lasso-section lasso-group lasso-group--accordion" data-group="p">/);
  assert.match(html, /data-group="r"/);
  assert.equal(groupItemLabel(spec.components[1]!), "Ledelse");
});

test("Brudpunkter (26.1, 30): tablet (midte ≤ 960) holder ½ + ½ og folder ¼/¾, skinnen skjules ved 960, skallen er mobil under 768", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(css, /@container lasso \(max-width: 960px\) \{\n  \.lasso-content--dashboard, \.lasso-content--grid-2 \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); column-gap: var\(--lasso-space-4\); \}\n  \.lasso-cell--half \{ grid-column: span 1; \}/);
  assert.match(css, /@container lasso \(max-width: 960px\) \{\n  \.lasso-shell \{ grid-template-columns: minmax\(0, 1fr\);[^}]*\}\n  \.lasso-shell > \.lasso-rail \{ display: none; \}/);
  assert.match(css, /@container lasso \(max-width: 767px\) \{\n  \.lasso-shell \{ display: flex;/);
  assert.match(css, /\.lasso-page__panel \{[^}]*width: var\(--lasso-panel-w\)/);
});

test("30.9: tidslinjen med filterColumn har filtre ¼ i egen kolonne og ingen typevælger i hovedet", async () => {
  const { LassoTimeline } = await import("./components/LassoTimeline.js");
  const { renderToStaticMarkup: r } = await import("react-dom/server");
  const { createElement: h } = await import("react");
  const timeline = {
    lassoId: "CVR-1-1",
    events: [
      { date: "2025-04-15", title: "Årsrapport 2025", category: "Regnskab" },
      { date: "2024-03-15", title: "Anne indtrådt", category: "Ledelse" },
    ],
  };
  const col = r(h(LassoTimeline, { timeline, filterColumn: true }));
  assert.match(col, /lasso-tl-layout[^]*lasso-tl-filters[^]*Alle typer[^]*Regnskab[^]*Ledelse[^]*lasso-tl-layout__stream/);
  assert.doesNotMatch(col, /<select/);
  const plain = r(h(LassoTimeline, { timeline }));
  assert.match(plain, /<select/);
  assert.doesNotMatch(plain, /lasso-tl-layout/);
});

test("30.11: group.toolbar giver modulværktøjslinjen med primær handling og tekstknapper; uden toolbar ingen linje", () => {
  const spec = parseViewSpec({
    kind: "custom",
    title: "T",
    components: [
      { type: "LassoSummary", text: "a", title: "A", group: { id: "g", pattern: "accordion", title: "Modul", toolbar: { primary: { label: "Eksportér", prompt: "eksportér" }, actions: [{ label: "Del", prompt: "del" }] } } },
      { type: "LassoSummary", text: "b", title: "B", group: { id: "g", pattern: "accordion" } },
    ],
  });
  const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: emptyDataset("demo"), host: {}, onAction: () => {} }));
  assert.match(html, /lasso-toolbar lasso-toolbar--module[^]*lasso-toolbar__primary[^>]*>Eksportér<[^]*lasso-btn--ghost[^>]*>Del</);
  const plain = parseViewSpec({ kind: "custom", title: "T", components: [{ type: "LassoSummary", text: "a", title: "A", group: { id: "g", pattern: "accordion" } }, { type: "LassoSummary", text: "b", title: "B", group: { id: "g", pattern: "accordion" } }] });
  assert.doesNotMatch(renderToStaticMarkup(createElement(LassoView, { spec: plain, dataset: emptyDataset("demo"), host: {}, onAction: () => {} })), /lasso-toolbar/);
});
