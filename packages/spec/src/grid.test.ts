import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GRID_RULES, gridRuleOf } from "./catalog.js";
import { allowsWidth, BAND_COMBOS, BAND_MAX_DEVIATION, compactOf, GRID_GAP, measuredHeight, MEASURED_HEIGHTS, packBands, packWithinBudget, pageHeight, PAGE_HEIGHT_BUDGET, type PackedBand } from "./grid.js";
import { DEFAULT_WIDTH, WIDTH_COLUMNS, WIDTHS, type ComponentType, type ViewComponent, type Width } from "./spec.js";

const COMPONENT_TYPES = Object.keys(DEFAULT_WIDTH) as ComponentType[];

const X = "CVR-1-1";
const c = (type: string, extra: Record<string, unknown> = {}) => ({ type, company: X, ...extra }) as ViewComponent;

/** Højderne i gridmodel.md afsnit 5: målt højde, tidslinje 88 og nyheder 48 px pr. række under 5. */
function docHeight(x: ViewComponent, w: Width): number {
  const lim = (x as { limit?: number }).limit;
  const row = x.type === "LassoTimeline" ? 88 : x.type === "LassoNews" ? 48 : 0;
  return measuredHeight(x, w) - (lim ? row * (5 - lim) : 0);
}

const shape = (bands: readonly PackedBand[]) => bands.map((b) => b.stacks.map((s) => `${WIDTH_COLUMNS[s.width]}:${s.items.map((i) => i.type.replace("Lasso", "")).join("+")}`).join(" | "));

function assertLegal(bands: readonly PackedBand[]) {
  const legal = BAND_COMBOS.map((x) => x.join("+"));
  for (const b of bands) {
    const cols = b.stacks.map((s) => WIDTH_COLUMNS[s.width]);
    assert.ok(legal.includes(cols.join("+")), `ulovligt bånd ${cols.join("+")}`);
    for (const s of b.stacks) for (const i of s.items) if (b.stacks.length > 1) assert.ok(allowsWidth(gridRuleOf(i), s.width), `${i.type} i ${s.width}`);
  }
}

test("23.2: de målte højder i grid.ts er measure/heights.json", () => {
  const json = JSON.parse(readFileSync(new URL("../../../tools/gallery/measure/heights.json", import.meta.url), "utf8")) as { heights: Record<string, Record<string, { h: number }>> };
  const keys = ["1/4", "1/3", "1/2", "2/3", "3/4", "1/1"];
  assert.deepEqual(Object.keys(MEASURED_HEIGHTS).sort(), Object.keys(json.heights).sort());
  for (const [name, row] of Object.entries(json.heights)) assert.deepEqual(MEASURED_HEIGHTS[name], keys.map((k) => row[k]!.h), name);
});

test("23.2: hver komponenttype har en gitterregel med std inden for min–max", () => {
  for (const t of COMPONENT_TYPES) {
    const r = GRID_RULES[t];
    assert.ok(r, t);
    assert.ok(WIDTHS.indexOf(r.min) <= WIDTHS.indexOf(r.std) && WIDTHS.indexOf(r.std) <= WIDTHS.indexOf(r.max), t);
    assert.equal(DEFAULT_WIDTH[t], r.std, `DEFAULT_WIDTH og elementtabellen er ens for ${t}`);
  }
});

test("23.1: en eksplicit width låser bredden i pakningen (mønster 7: analyse ¾ + nøgletal ¼)", () => {
  const items: ViewComponent[] = [
    { type: "LassoSummary", text: "x", width: "three-quarters" } as ViewComponent,
    { type: "LassoKeyFigureCards", company: "C", width: "quarter" } as ViewComponent,
    { type: "LassoBarChart", company: "C", width: "full" } as ViewComponent,
  ];
  const bands = packBands(items, (c, w) => measuredHeight(c, w));
  assert.deepEqual(bands.map((b) => b.stacks.map((s) => [s.width, s.items.map((c) => c.type)])), [
    [["three-quarters", ["LassoSummary"]], ["quarter", ["LassoKeyFigureCards"]]],
    [["full", ["LassoBarChart"]]],
  ]);
});

test("23.1 F: pakningen gengiver gridmodellens tre verificerede sider (overblik, økonomi, ejerskab)", () => {
  const overblik = packBands(
    [c("LassoCompanyHead"), c("LassoKeyFigureCards"), c("LassoTextSections", { variant: "profil" }), c("LassoKeyValueList"), c("LassoRelations"), c("LassoBarChart", { metric: "omsaetning" }), c("LassoContact"), c("LassoTimeline", { limit: 3 }), c("LassoNews", { limit: 3 }), c("LassoShortcuts")],
    docHeight,
  );
  assert.deepEqual(shape(overblik), ["12:CompanyHead", "12:KeyFigureCards", "6:TextSections | 6:KeyValueList", "3:Relations | 6:BarChart | 3:Contact", "6:Timeline | 6:News+Shortcuts"]);
  assert.deepEqual(overblik.map((b) => b.height), [87, 138, 662, 300, 338]);

  const oekonomi = packBands(
    [c("LassoCompanyHead"), c("LassoKeyFigureCards"), c("LassoGroupedBarChart"), c("LassoWaterfallChart"), c("LassoKeyValueList", { variant: "financials" }), c("LassoShareBars"), c("LassoMultiYearTable"), c("LassoTextSections", { variant: "analyse", width: "full" })],
    docHeight,
  );
  assert.deepEqual(shape(oekonomi), ["12:CompanyHead", "12:KeyFigureCards", "6:GroupedBarChart | 6:WaterfallChart", "6:KeyValueList | 6:ShareBars+MultiYearTable", "12:TextSections"]);
  assert.equal(oekonomi[3]!.height, 535);

  const ejerskab = packBands(
    [c("LassoCompanyHead"), c("LassoOwnershipDiagram"), c("LassoOwnerList"), c("LassoBeneficialOwners"), c("LassoPersonList"), c("LassoTimeline", { limit: 3 }), c("LassoContact"), c("LassoShortcuts")],
    docHeight,
  );
  assert.deepEqual(shape(ejerskab), ["12:CompanyHead", "8:OwnershipDiagram | 4:OwnerList+BeneficialOwners+PersonList", "6:Timeline | 6:Contact+Shortcuts"]);
  assert.equal(ejerskab[1]!.height, 631);

  for (const bands of [overblik, oekonomi, ejerskab]) {
    assertLegal(bands);
    for (const b of bands) assert.ok(b.deviation <= BAND_MAX_DEVIATION, `afvigelse ${b.deviation}`);
  }
});

test("pakningen er deterministisk, bånd er altid lovlige, og en ½ står aldrig alene", () => {
  const types = COMPONENT_TYPES.filter((t) => !["LassoFollowUps", "LassoSavedPages", "LassoCompanyTable", "LassoPersonTable", "LassoCompareTable", "LassoRanking"].includes(t));
  // Deterministisk "tilfældig" rækkefølge (lineær kongruens), 200 sider à 3–9 elementer.
  let seed = 7;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  for (let n = 0; n < 200; n++) {
    const items = Array.from({ length: 3 + (next() % 7) }, () => c(types[next() % types.length]!));
    const a = packBands(items, measuredHeight);
    assert.deepEqual(shape(a), shape(packBands(items, measuredHeight)));
    assertLegal(a);
    // Alle elementer placeres præcis én gang, og ingen stak er tom.
    assert.equal(a.flatMap((b) => b.stacks.flatMap((s) => s.items)).length, items.length);
    for (const b of a) for (const s of b.stacks) assert.ok(s.items.length > 0);
  }
});

test("minimumsbredder er hårde: registrering, virksomhedstabel og fuldt regnskab står i fuld bredde", () => {
  const bands = packBands([c("LassoRegistration"), c("LassoFinancialStatements"), c("LassoKeyValueList"), c("LassoContact")], measuredHeight);
  assert.equal(bands[1]!.stacks.length, 1);
  assert.equal(bands[1]!.stacks[0]!.items[0]!.type, "LassoFinancialStatements");
  assert.notEqual(bands[0]!.stacks.find((s) => s.items.some((i) => i.type === "LassoRegistration"))?.width, "half");
});

test("højdebudget (23.3): de mindst relevante udelades bagfra, hoved og nøgletal bliver, og uden budget ændres intet", () => {
  const items = [
    c("LassoCompanyHead"),
    c("LassoKeyFigureCards"),
    c("LassoTextSections", { variant: "profil" }),
    c("LassoKeyValueList", { variant: "company" }),
    c("LassoRelations"),
    c("LassoBarChart", { metric: "omsaetning", years: 5 }),
    c("LassoContact"),
    c("LassoTimeline", { limit: 3 }),
    c("LassoNews", { limit: 3 }),
    c("LassoShortcuts"),
  ];
  const full = packBands(items, docHeight);
  // Uden budget (og med et budget, siden holder) er resultatet det samme som packBands.
  assert.deepEqual(shape(packWithinBudget(items, docHeight).bands), shape(full));
  assert.deepEqual(shape(packWithinBudget(items, docHeight, { budget: 10_000 }).bands), shape(full));
  const budget = Math.round(pageHeight(full) * 0.6);
  const r = packWithinBudget(items, docHeight, { budget });
  assert.ok(r.height <= budget, `${r.height} > ${budget}`);
  assert.equal(r.height, pageHeight(r.bands));
  assertLegal(r.bands);
  const shown = r.bands.flatMap((b) => b.stacks.flatMap((s) => s.items.map((i) => i.type)));
  // Hoved, nøgletal og svaret (første element) er altid med; det sidste i prioritet forsvinder før det første.
  for (const t of ["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections"]) assert.ok(shown.includes(t as ViewComponent["type"]), t);
  assert.ok(r.dropped.length > 0);
  assert.ok(r.dropped.every((d) => !["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections"].includes(d.type)));
  for (const b of r.bands) assert.equal(b.stacks.reduce((n, s) => n + WIDTH_COLUMNS[s.width], 0), 12);
  // Deterministisk.
  assert.deepEqual(shape(packWithinBudget(items, docHeight, { budget }).bands), shape(r.bands));
  // keep: et element i keep er altid med i fuld form, selv over budgettet.
  const tight = packWithinBudget(items, docHeight, { budget: 100, keep: new Set([items[0]!, items[3]!]) });
  const kept = tight.bands.flatMap((b) => b.stacks.flatMap((s) => s.items));
  assert.ok(kept.includes(items[0]!) && kept.includes(items[3]!));
  assert.equal(kept.length, 2);
});

test("højdebudget: kompakte former (færre rækker/afsnit) og standardbudgettet", () => {
  assert.equal(PAGE_HEIGHT_BUDGET, 1300);
  assert.deepEqual(compactOf(c("LassoKeyValueList", { variant: "company" })), c("LassoKeyValueList", { variant: "company", maxRows: 6 }));
  assert.deepEqual(compactOf(c("LassoTextSections", { variant: "profil" })), c("LassoTextSections", { variant: "profil", limit: 3 }));
  assert.equal(compactOf(c("LassoTextSections", { variant: "analyse" })), null);
  assert.equal((compactOf(c("LassoTimeline")) as { limit?: number }).limit, 3);
  assert.equal(compactOf(c("LassoTimeline", { limit: 3 })), null);
  assert.equal(compactOf(c("LassoBarChart")), null);
});

test("højdebudget (Paper 23.3): genveje, nyheder og historik udelades før kontakt, og kontakt står som ekstra stak (3+6+3)", () => {
  const items = [
    c("LassoCompanyHead"),
    c("LassoKeyFigureCards"),
    c("LassoTextSections", { variant: "profil" }),
    c("LassoKeyValueList", { variant: "company" }),
    c("LassoRelations"),
    c("LassoBarChart", { metric: "omsaetning", years: 5 }),
    c("LassoContact"),
    c("LassoTimeline", { limit: 3 }),
    c("LassoNews", { limit: 3 }),
    c("LassoShortcuts"),
  ];
  // Paper-højderne (gridmodel.md afsnit 5, Overblik): profil kompakt 320 → 360, oplysninger rows 6 360, relationer 267, graf 300, kontakt 261.
  const H: Partial<Record<ViewComponent["type"], number>> = { LassoCompanyHead: 87, LassoKeyFigureCards: 138, LassoRelations: 267, LassoBarChart: 300, LassoContact: 261, LassoTimeline: 514, LassoNews: 292, LassoShortcuts: 40 };
  const h = (x: ViewComponent) => {
    if (x.type === "LassoTextSections") return (x as { limit?: number }).limit ? 360 : 506;
    if (x.type === "LassoKeyValueList") return (x as { maxRows?: number }).maxRows ? 360 : 626;
    return H[x.type] ?? 300;
  };
  const r = packWithinBudget(items, h, { budget: 1000, keep: new Set([items[0]!, items[1]!]) });
  const shapeOf = (bands: PackedBand[]) => bands.map((b) => b.stacks.map((s) => `${WIDTH_COLUMNS[s.width]}:${s.items.map((i) => i.type.replace("Lasso", "")).join("/")}`).join(" | "));
  assert.deepEqual(shapeOf(r.bands), ["12:CompanyHead", "12:KeyFigureCards", "6:TextSections | 6:KeyValueList", "3:Relations | 6:BarChart | 3:Contact"]);
  assert.deepEqual(r.dropped.map((d) => d.type), ["LassoTimeline", "LassoNews", "LassoShortcuts"]);
  assert.equal(r.height, 87 + 138 + 360 + 300 + 3 * GRID_GAP);
  // Kompakt: oplysninger 6 rækker og profil 3 afsnit (fuld form kommer ikke tilbage, når noget er udeladt).
  const shown = r.bands.flatMap((b) => b.stacks.flatMap((s) => s.items));
  assert.equal((shown.find((x) => x.type === "LassoKeyValueList") as { maxRows?: number }).maxRows, 6);
  assert.equal((shown.find((x) => x.type === "LassoTextSections") as { limit?: number }).limit, 3);
});
