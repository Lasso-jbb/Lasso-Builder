import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GRID_RULES, gridRuleOf } from "./catalog.js";
import { allowsWidth, BAND_COMBOS, BAND_MAX_DEVIATION, measuredHeight, MEASURED_HEIGHTS, packBands, type PackedBand } from "./grid.js";
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
  }
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
