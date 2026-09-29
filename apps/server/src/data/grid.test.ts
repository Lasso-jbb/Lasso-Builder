import assert from "node:assert/strict";
import { test } from "node:test";
import { BAND_COMBOS, BAND_MAX_DEVIATION, composeCompany, composePerson, composePersonProbe, composeProbe, gridHeight, packPage, WIDTH_COLUMNS, type Dataset, type ViewComponent, type ViewSpec } from "@lasso/spec";
import { DemoProvider } from "./demo.js";
import { resolveSpec } from "./resolve.js";

/**
 * Gridmodellen (23.1) på rigtige sider: demodata (Eksempel Byg A/S og Bo Eksempel), højder fra
 * measure/heights.json rettet efter data (gridHeight) og tegnet som i layout 'columns' (48 px luft
 * pr. element). Kontrollen af selve tegningen (ingen huller) sker i galleriet med Playwright; her
 * kontrolleres, at båndene er lovlige og stakkene højst afviger 15 %.
 */
const BYG = "CVR-1-99000001";
const BO = "CVR-3-4000000002";
const PAD = 48;

/** Sidens delte bånd som stakke ud fra kolonne og width (som LassoView.columnBands). */
function bandsOf(spec: ViewSpec): ViewComponent[][][] {
  const bands: ViewComponent[][][] = [];
  let last = 0;
  for (const c of spec.components) {
    if (!c.column) {
      last = 0;
      continue;
    }
    if (last === 0 || c.column < last) bands.push([]);
    const band = bands.at(-1)!;
    while (band.length < c.column) band.push([]);
    band[c.column - 1]!.push(c);
    last = c.column;
  }
  return bands;
}

function check(spec: ViewSpec, ds: Dataset, label: string) {
  const legal = BAND_COMBOS.map((x) => x.join("+"));
  const bands = bandsOf(spec);
  assert.ok(bands.length > 0, `${label}: ingen delte bånd`);
  for (const band of bands) {
    const cols = band.map((st) => WIDTH_COLUMNS[st[0]!.width!]);
    assert.ok(legal.includes(cols.join("+")), `${label}: ulovligt bånd ${cols.join("+")}`);
    const hs = band.map((st) => st.reduce((sum, c) => sum + gridHeight(c, st[0]!.width!, ds, spec.components) + PAD, 0));
    const dev = (Math.max(...hs) - Math.min(...hs)) / Math.max(...hs);
    assert.ok(dev <= BAND_MAX_DEVIATION, `${label}: ${band.map((st) => st.map((c) => c.type).join("+")).join(" | ")} = ${hs.join(" | ")} (${Math.round(dev * 100)} %)`);
  }
}

test("gridmodel: virksomhedens overblik, økonomi og ejerskab er lovlige bånd med højst 15 % højdeforskel", async () => {
  const p = new DemoProvider();
  for (const focus of ["overblik", "oekonomi", "ejerskab"] as const) {
    const ds = await resolveSpec(composeProbe(BYG, focus), p);
    check(composeCompany(BYG, ds, { focus, name: ds.companies[BYG]?.name }), ds, focus);
  }
});

test("gridmodel 23.3: default-siden (overblik uden spørgsmål) har den faste rækkefølge og fylder hvert bånd", async () => {
  const ds = await resolveSpec(composeProbe(BYG, "overblik"), new DemoProvider());
  const spec = composeCompany(BYG, ds, { focus: "overblik", followUps: false });
  const order = spec.components.map((c) => c.type);
  const expected = ["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections", "LassoKeyValueList", "LassoContact", "LassoRelations", "LassoBarChart", "LassoTimeline", "LassoNews", "LassoShortcuts"];
  assert.deepEqual([...order].sort(), [...expected].sort());
  assert.deepEqual(order.slice(0, 3), expected.slice(0, 3));
  for (const band of bandsOf(spec)) assert.equal(band.reduce((s, st) => s + WIDTH_COLUMNS[st[0]!.width!], 0), 12);
});

test("gridmodel: personsidens elementer pakket med samme model holder 15 % (composePerson bruger den endnu ikke)", async () => {
  const ds = await resolveSpec(composePersonProbe(BO, "overblik"), new DemoProvider());
  const spec = composePerson(BO, ds, { focus: "overblik" });
  const items = spec.components.map(({ column: _c, width: _w, ...c }) => c as ViewComponent);
  const packed = packPage(items, ds);
  check({ ...spec, components: packed.components }, ds, "person overblik");
});
