import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { GRID_RULES, gridRuleOf, widthProfileOf } from "./catalog.js";
import { contentWidthOf, driversOf, packPage } from "./compose.js";
import { emptyDataset } from "./models.js";
import { contentMinWidth } from "./register.js";
import { allowsWidth, BAND_COMBOS, defaultMinWidth, elementMinWidth, originOf, type MinWidthFn, BAND_MAX_DEVIATION, compactOf, GRID_GAP, measuredHeight, MEASURED_HEIGHTS, packBands, packWithinBudget, pageHeight, PAGE_HEIGHT_BUDGET, type PackedBand } from "./grid.js";
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
  // Ø13/B8 (A13): nyhederne er brede (min ¾) og står i eget bånd; historikken er smal (⅓) og står ved relationer og kontakt;
  // grafen får kun de smalle genveje (højst ½) som makker, og det skæve bånd tages efter gridmodel 4e (laveste afvigelse,
  // stakken strækkes). (Paper 23.1 havde 3+6+3 og 6 | 6 med nyheder + genveje.) Default-siden (23.3, med budget) er uændret.
  assert.deepEqual(shape(overblik), ["12:CompanyHead", "12:KeyFigureCards", "6:TextSections | 6:KeyValueList", "4:Relations | 4:Contact | 4:Timeline", "6:BarChart | 6:News+Shortcuts"]); // Jakob 01.10: nyheder i ½
  assert.deepEqual(overblik.map((b) => b.height), [34, 138, 662, 267, 326]); // hoved 34 (Fable runde 6, I4Y-0)

  const oekonomi = packBands(
    [c("LassoCompanyHead"), c("LassoKeyFigureCards"), c("LassoGroupedBarChart"), c("LassoWaterfallChart"), c("LassoKeyValueList", { variant: "financials" }), c("LassoShareBars"), c("LassoMultiYearTable"), c("LassoTextSections", { variant: "analyse", width: "full" })],
    docHeight,
  );
  // Ø13/B8 (A13): flerårstabellen findes kun i ⅔ (vandret rulning i ½ med 10 år) og står ikke længere under andelsbjælkerne;
  // regnskabslisten og andelsbjælkerne er begge ½ (smal/min ½), så båndet er skævt (strækkes) i denne syntetiske side.
  assert.deepEqual(shape(oekonomi), ["12:CompanyHead", "12:KeyFigureCards", "6:GroupedBarChart | 6:WaterfallChart", "6:KeyValueList | 6:ShareBars", "12:MultiYearTable", "12:TextSections"]);
  assert.equal(oekonomi[3]!.height, 535);

  const ejerskab = packBands(
    [c("LassoCompanyHead"), c("LassoOwnershipDiagram"), c("LassoOwnerList"), c("LassoBeneficialOwners"), c("LassoPersonList"), c("LassoTimeline", { limit: 3 }), c("LassoContact"), c("LassoShortcuts")],
    docHeight,
  );
  assert.deepEqual(shape(ejerskab), ["12:CompanyHead", "8:OwnershipDiagram | 4:OwnerList+BeneficialOwners+PersonList", "6:Timeline | 6:Contact+Shortcuts"]);
  assert.equal(ejerskab[1]!.height, 631);

  for (const bands of [overblik, oekonomi, ejerskab]) {
    assertLegal(bands);
    // Undtagelser (Ø13/B8, gridmodel 4e): graf | genveje og regnskabsliste | andelsbjælker har ingen lovlig makker inden for 15 %.
    for (const b of bands) if (!(bands === oekonomi && b === oekonomi[3]) && !(bands === overblik && b === overblik[4])) assert.ok(b.deviation <= BAND_MAX_DEVIATION, `afvigelse ${b.deviation}`);
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

test("minimumsbredder er hårde: virksomhedstabellen i fuld bredde, det fulde regnskab aldrig under ⅔", () => {
  const bands = packBands([c("LassoCompanyTable"), c("LassoFinancialStatements"), c("LassoKeyValueList"), c("LassoContact")], measuredHeight);
  assert.equal(bands[0]!.stacks.length, 1);
  assert.equal(bands[0]!.stacks[0]!.items[0]!.type, "LassoCompanyTable");
  const fs = bands.flatMap((b) => b.stacks).find((s) => s.items.some((i) => i.type === "LassoFinancialStatements"))!;
  assert.ok(["two-thirds", "three-quarters", "full"].includes(fs.width), fs.width);
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
  // Elementer ved siden af keep-elementet må blive stående, når ingen enkelt udeladelse gør siden lavere.
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

/* ---------- Ø13 / B8: bredde efter indhold ---------- */

const idx = (w: Width) => WIDTHS.indexOf(w);
/** Ø13-reglerne for et pakket bånd: ingen under mindstebredden, ingen smal over ½ ved siden af andre. */
function assertWidthRules(bands: readonly PackedBand[], min: MinWidthFn, label = "") {
  for (const b of bands) {
    if (b.stacks.length < 2) continue;
    for (const s of b.stacks)
      for (const i of s.items) {
        const o = originOf(i);
        if (o.width) continue; // en eksplicit width (render_view) låser bredden
        assert.ok(idx(s.width) >= idx(min(o)), `${label}${o.type} i ${s.width} under mindstebredden ${min(o)}`);
        if (widthProfileOf(o).profil === "smal") assert.ok(idx(s.width) <= idx("half"), `${label}smal ${o.type} strakt til ${s.width} ved siden af andre`);
      }
  }
}

function randomPages(n: number, extra: (k: number) => Record<string, unknown> = () => ({})): ViewComponent[][] {
  const types = COMPONENT_TYPES.filter((t) => !["LassoFollowUps", "LassoSavedPages", "LassoCompanyTable", "LassoPersonTable", "LassoCompareTable", "LassoRanking"].includes(t));
  let seed = 11;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  return Array.from({ length: n }, () => Array.from({ length: 3 + (next() % 7) }, (_, k) => c(types[next() % types.length]!, extra(k))));
}

test("Ø13: en smal komponent strækkes aldrig over ½ ved siden af andre; alene i båndet står den i fuld bredde", () => {
  for (const items of randomPages(200)) assertWidthRules(packBands(items, measuredHeight), defaultMinWidth);
  // Oplysninger (smal) ved siden af kontakt og genveje: højst ½, aldrig ⅔ eller ¾ som før.
  const bands = packBands([c("LassoKeyValueList"), c("LassoContact"), c("LassoRelations"), c("LassoShortcuts")], measuredHeight);
  const kvl = bands.flatMap((b) => b.stacks).find((s) => s.items.some((i) => i.type === "LassoKeyValueList"))!;
  assert.ok(idx(kvl.width) <= idx("half"), kvl.width);
  // Alene (ingen makker): eget bånd i fuld bredde, så der aldrig er et hul (23.1).
  assert.deepEqual(shape(packBands([c("LassoKeyValueList")], measuredHeight)), ["12:KeyValueList"]);
  // Budgetpakningen (ekstra stak, stakfyld) holder samme regler.
  for (const items of randomPages(60)) assertWidthRules(packWithinBudget(items, measuredHeight, { budget: 900 }).bands, defaultMinWidth, "budget: ");
});

test("Ø13: en bred komponent lægges aldrig under sin indholdsstyrede mindstebredde (contentMinWidth)", () => {
  // Tæt indhold overalt (3 rækker pr. post, lange navne, tidsakse): mindstebredden hæves efter profilen.
  const dense: MinWidthFn = (x) => elementMinWidth(x, { rowsPerItem: 3, longestLabel: 45, timeAxis: true, series: 6 });
  for (const items of randomPages(200)) {
    const bands = packBands(items, measuredHeight, { minWidth: dense });
    assertWidthRules(bands, dense);
    assert.equal(bands.flatMap((b) => b.stacks.flatMap((s) => s.items)).length, items.length);
    // Deterministisk.
    assert.deepEqual(shape(bands), shape(packBands(items, measuredHeight, { minWidth: dense })));
  }
  // Ejerdiagrammet med 45-tegns navne står i ⅔ (A13 målte det rent i ⅔); først tæt indhold OG tidsakse giver ¾.
  const d = [c("LassoOwnershipDiagram"), c("LassoOwnerList"), c("LassoBeneficialOwners"), c("LassoPersonList")];
  const withNames = packBands(d, measuredHeight, { minWidth: (x) => elementMinWidth(x, x.type === "LassoOwnershipDiagram" ? { longestLabel: 45 } : {}) });
  const diagramWidth = withNames.flatMap((b) => b.stacks).find((s) => s.items[0]!.type === "LassoOwnershipDiagram")!.width;
  assert.ok(diagramWidth === "two-thirds" || diagramWidth === "three-quarters" || diagramWidth === "full", diagramWidth);
  const withAxis = packBands(d, measuredHeight, { minWidth: (x) => elementMinWidth(x, x.type === "LassoOwnershipDiagram" ? { longestLabel: 45, timeAxis: true } : {}) });
  const axisWidth = withAxis.flatMap((b) => b.stacks).find((s) => s.items[0]!.type === "LassoOwnershipDiagram")!.width;
  assert.ok(axisWidth === "three-quarters" || axisWidth === "full", axisWidth);
  assert.equal(packBands(d, measuredHeight)[0]!.stacks[0]!.width, "two-thirds");
  // Hæver indholdet over typens max, er max grænsen (flerårstabellen findes kun i ⅔).
  assert.equal(elementMinWidth(c("LassoMultiYearTable"), { timeAxis: true, series: 10 }), "two-thirds");
  assert.equal(contentMinWidth("bred", "two-thirds", { timeAxis: true }), "two-thirds");
  assert.equal(contentMinWidth("bred", "two-thirds", { timeAxis: true, longestLabel: 45 }), "three-quarters");
  // Smal: indholdet hæver ikke mindstebredden.
  assert.equal(elementMinWidth(c("LassoOwnerList"), { rowsPerItem: 3, longestLabel: 45 }), "quarter");
});

/** Et netværk med 3 personer à 3 fælles selskaber med lange navne fra 2011 (A13's realistiske data). */
function networkDataset(person: string) {
  const ds = emptyDataset("demo");
  const long = ["Nordjysk Entreprenør- og Ejendomsselskab ApS", "Vestjysk Maskin- og Anlægsservice Holding ApS", "Midtjysk Tømrer- og Snedkerforretning A/S"];
  ds.personNetworks[person] = {
    lassoId: person,
    people: ["Anne-Marie Kristensen Østergaard", "Hans Christian Bach Møller", "Birgitte Louise Frandsen"].map((name) => ({
      name,
      companies: long.map((companyName, k) => ({ companyName, role: "bestyrelse", from: `${2011 + k}-01-01` })),
      overlapYears: 15,
      since: "2011-01-01",
      active: true,
    })),
  };
  return ds;
}

test("Ø13: PersonNetwork med 3 rækker pr. person, lange navne og tidsakse står i fuld bredde", () => {
  const P = "CVR-3-4000000009";
  const ds = networkDataset(P);
  const net = { type: "LassoPersonNetwork", person: P } as ViewComponent;
  const d = driversOf(net, ds);
  assert.equal(d.rowsPerItem, 3);
  assert.ok((d.longestLabel ?? 0) >= 45, `${d.longestLabel}`);
  assert.equal(d.timeAxis, true);
  // Selv med den gamle min (½) kræver indholdet mere end ⅔; A13's regel (min 1/1) giver fuld bredde.
  assert.equal(contentMinWidth("bred", "half", d), "three-quarters");
  assert.equal(contentWidthOf(net, ds), "full");
  const page = packPage([{ type: "LassoPersonHead", person: P } as ViewComponent, net, { type: "LassoPersonRisk", person: P } as ViewComponent, { type: "LassoPersonFacts", person: P } as ViewComponent], ds);
  const placed = page.components.find((x) => x.type === "LassoPersonNetwork")!;
  assert.equal(placed.column, undefined, "netværket står i eget fuldbånd");
});

test("Ø13: PersonRoles som liste (Aktive roller) er smal og står højst i ½ i et delt bånd; tidsbåndet er fleksibelt", () => {
  for (const show of ["current", "ended", "owner"] as const) {
    const roles = c("LassoPersonRoles", { person: "CVR-3-1", show });
    assert.equal(widthProfileOf(roles).profil, "smal", show);
    assert.equal(gridRuleOf(roles).max, "half", show);
    const bands = packBands([roles, c("LassoPersonFacts", { person: "CVR-3-1" }), c("LassoPersonRisk", { person: "CVR-3-1" }), c("LassoRelations")], measuredHeight);
    const st = bands.flatMap((b) => (b.stacks.length > 1 ? b.stacks : [])).find((s) => s.items.some((i) => i.type === "LassoPersonRoles"));
    if (st) assert.ok(idx(st.width) <= idx("half"), `${show} i ${st.width}`);
    assertWidthRules(bands, defaultMinWidth);
  }
  const all = c("LassoPersonRoles", { person: "CVR-3-1" });
  assert.equal(widthProfileOf(all).profil, "fleksibel");
  assert.equal(gridRuleOf(all).max, "full");
  assert.equal(gridRuleOf(all).std, "two-thirds");
});
