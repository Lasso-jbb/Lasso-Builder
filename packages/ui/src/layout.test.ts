import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { emptyDataset, parseViewSpec } from "@lasso/spec";
import { Accordion, CardGrid } from "./components/Layout.js";
import { bandTemplate, columnBands, dashboardBands, gridBandColumns, groupItemLabel, groupRuns, LassoView, mergeFullGroups, tabletSpans } from "./LassoView.js";

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

test("Brudpunkter (26.1, 26f.1, 30): tablet (midte ≤ 960) holder ½ + ½ og folder ¼/¾, tablet 768–1023 har topbjælke + 64 px skinne, skallen er mobil under 768", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  // 12-kolonne-gitteret (gridmodellen 23.1): ½ = 6 kolonner holder på tablet, ⅓ bliver ½, ¼/⅔/¾ bliver fuld.
  assert.match(css, /\.lasso-content--dashboard, \.lasso-content--grid-2 \{ (--lasso-content-gap: [^;]+; )?grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/);
  assert.match(css, /@container lasso \(max-width: 960px\) \{\n  \.lasso-content--dashboard, \.lasso-content--grid-2 \{ column-gap: var\(--lasso-space-4\); \}\n  \.lasso-cell--half, \.lasso-cell--third \{ grid-column: span 6; \}\n  \.lasso-cell--quarter, \.lasso-cell--two-thirds, \.lasso-cell--three-quarters \{ grid-column: 1 \/ -1; \}/);
  assert.match(css, /@container lasso \(max-width: 1023px\) and \(min-width: 768px\) \{\n  \.lasso-shell \{ grid-template-columns: 64px minmax\(0, 1fr\);[^}]*\}\n  \.lasso-shell > \.lasso-rail, \.lasso-shell > \.lasso-strip \{ display: none; \}\n  \.lasso-shell > \.lasso-tabletbar \{ display: flex;/);
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

test("gridmodel 23.1: bånd på 12 kolonner tegnes med bredderne, strækkes uden huller og folder på tablet", () => {
  const spec = parseViewSpec({
    kind: "company",
    title: "x",
    layout: "columns",
    components: [
      { type: "LassoCompanyHead", company: "CVR-1-1" },
      { type: "LassoRelations", company: "CVR-1-1", column: 1, width: "quarter" },
      { type: "LassoBarChart", company: "CVR-1-1", column: 2, width: "half" },
      { type: "LassoContact", company: "CVR-1-1", column: 3, width: "quarter" },
      { type: "LassoContact", company: "CVR-1-1", column: 1, width: "third" },
      { type: "LassoOwnerList", company: "CVR-1-1", column: 2, width: "third" },
      { type: "LassoPersonList", company: "CVR-1-1", column: 3, width: "third" },
      { type: "LassoPersonList", company: "CVR-1-1", column: 4, width: "third" },
    ],
  });
  const bands = columnBands(spec.components).filter((b) => b.kind === "columns");
  assert.equal(bands.length, 2);
  const [a, b] = bands.map((x) => (x.kind === "columns" ? x.columns : []));
  assert.deepEqual(gridBandColumns(a!), [3, 6, 3]);
  assert.equal(bandTemplate(a!), "minmax(0, 3fr) minmax(0, 6fr) minmax(0, 3fr)");
  // ⅓+⅓+⅓+⅓ er ikke 12: ingen gridbånd (gamle visninger tegnes som før).
  assert.equal(gridBandColumns(b!), undefined);
  // Ens bredder, der udgør et helt bånd (½ + ½), får stadig forholdet, så spec.columns = 3 ikke giver et hul.
  const half = (i: number) => [{ c: { ...spec.components[1]!, width: "half" } as (typeof spec.components)[number], i }];
  assert.equal(bandTemplate([half(0), half(1)]), "minmax(0, 6fr) minmax(0, 6fr)");
  assert.deepEqual(tabletSpans([8, 4]), [12, 12]);
  assert.deepEqual(tabletSpans([6, 6]), [6, 6]);
  assert.deepEqual(tabletSpans([4, 4, 4]), [6, 6, 12]);
  assert.deepEqual(tabletSpans([3, 3, 3, 3]), [6, 6, 6, 6]);
  const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: emptyDataset("demo"), host: {}, onAction: () => undefined }));
  assert.match(html, /lasso-columns--ratio lasso-band" style="--lasso-columns-template:minmax\(0, 3fr\) minmax\(0, 6fr\) minmax\(0, 3fr\)"/);
  assert.match(html, /class="lasso-column lasso-stack lasso-stack--start-t" style="--lasso-span-t:6"/);
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(css, /\.lasso-columns \{ display: grid; gap: 0; align-items: stretch;/);
  assert.match(css, /\.lasso-columns > \.lasso-column > \.lasso-column__item:last-child \{ flex: 1 0 auto; \}/);
});

test("gridmodel 23.1 i layout 'dashboard': komponenterne pakkes i bånd på 12 kolonner, en eksplicit width låses, og ingen ½ står alene", () => {
  const C = "CVR-1-1";
  const spec = parseViewSpec({
    kind: "company",
    title: "Mønster 1",
    components: [
      { type: "LassoCompanyHead", company: C, variant: "compact" },
      { type: "LassoKeyFigureCards", company: C, width: "full" },
      { type: "LassoBarChart", company: C, width: "half" },
      { type: "LassoKeyValueList", company: C, variant: "company", width: "half" },
      { type: "LassoPersonList", company: C, width: "half" },
      { type: "LassoOwnerList", company: C, width: "half" },
      { type: "LassoNews", company: C, group: { id: "g", pattern: "cards" } },
      { type: "LassoContact", company: C, group: { id: "g", pattern: "cards" } },
    ],
  });
  const bands = dashboardBands(spec.components, null);
  const shape = bands.map((b) => (b.kind === "run" ? (b.run.kind === "one" ? b.run.item.c.type : "group") : b.stacks.map((s) => `${s.width}:${s.items.map((x) => x.c.type).join("+")}`)));
  assert.deepEqual(shape.slice(0, 2), ["LassoCompanyHead", "LassoKeyFigureCards"]);
  assert.equal(shape.at(-1), "group");
  const split = bands.filter((b) => b.kind === "band");
  assert.ok(split.length >= 1);
  for (const b of split) {
    if (b.kind !== "band") continue;
    const cols = { quarter: 3, third: 4, half: 6, "two-thirds": 8, "three-quarters": 9, full: 12 } as const;
    assert.equal(b.stacks.reduce((n, s) => n + cols[s.width], 0), 12);
    for (const s of b.stacks) for (const it of s.items) assert.equal(it.c.width, "half", "de eksplicitte ½ beholder bredden");
  }
  // Alle fire halve står i bånd (ingen alene): graf, oplysninger, ledelse og ejere.
  assert.equal(split.flatMap((b) => (b.kind === "band" ? b.stacks.flatMap((s) => s.items) : [])).length, 4);
  const html = renderToStaticMarkup(createElement(LassoView, { spec, dataset: emptyDataset("demo"), host: {}, onAction: () => undefined }));
  assert.match(html, /class="lasso-cell lasso-cell--full lasso-dband" style="--lasso-dband-template:minmax\(0, 6fr\) minmax\(0, 6fr\)"/);
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(css, /\.lasso-dband \{ display: grid; grid-template-columns: var\(--lasso-dband-template\);[^}]*align-items: stretch; \}/);
  assert.match(css, /\.lasso-dstack__item:last-child \{ flex: 1 0 auto;/);
});

test("26f: tablet går op til skærm 1199: foldningen gælder også, når midten er bredere end 960 (portalen 1024–1199)", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const container = css.match(/@container lasso [^{]*960px\)/g) ?? [];
  const media = css.match(/@media \(max-width: 1199px\)/g) ?? [];
  // Hver tabletregel ved midte ≤ 960 har en tvilling for skærm < 1200.
  assert.ok(container.length >= 10);
  assert.equal(media.length, container.length);
  assert.match(css, /@media \(max-width: 1199px\) \{\n  \.lasso-content--dashboard, \.lasso-content--grid-2 \{ column-gap: var\(--lasso-space-4\); \}\n  \.lasso-cell--half, \.lasso-cell--third \{ grid-column: span 6; \}/);
});

test("Ø13/B8: tablet-foldningen (26.1) giver aldrig et element færre kolonner end på desktop, og en stak over ½ står alene i sin række", () => {
  const legal = [[12], [6, 6], [8, 4], [4, 8], [9, 3], [3, 9], [4, 4, 4], [3, 3, 6], [3, 6, 3], [6, 3, 3], [3, 3, 3, 3]];
  for (const cols of legal) {
    const spans = tabletSpans(cols);
    cols.forEach((c, i) => assert.ok(spans[i]! >= c, `${cols.join("+")}: ${c} -> ${spans[i]}`));
    // Et smalt element (højst ½) bliver kun bredere end ½ på tablet, når det står alene i rækken (12).
    spans.forEach((s) => assert.ok(s === 6 || s === 12, `${cols.join("+")}: ${s}`));
  }
});
