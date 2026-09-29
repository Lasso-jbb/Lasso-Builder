import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ABSORB_MAX_DEVIATION, BAND_COMBOS, BAND_MAX_DEVIATION, FOCUSES, PAGE_HEIGHT_BUDGET, PERSON_FOCUSES, askFocus, askPersonFocus, parseAsk, shortCompanyName, composeCompany, composePerson, composePersonProbe, composeProbe, gridHeight, packPage, WIDTH_COLUMNS, type Dataset, type ViewComponent, type ViewSpec } from "@lasso/spec";
import { DemoProvider } from "./demo.js";
import { resolveSpec } from "./resolve.js";
import { bandsOf, describeViolation, layoutViolations } from "./layoutRules.js";

/**
 * Gridmodellen (23.1) på rigtige sider: demodata (Eksempel Byg A/S og Bo Eksempel), højder fra
 * measure/heights.json rettet efter data (gridHeight) og tegnet som i layout 'columns' (48 px luft
 * pr. element). Kontrollen af selve tegningen (ingen huller) sker i galleriet med Playwright; her
 * kontrolleres, at båndene er lovlige og stakkene højst afviger 15 %.
 */
const BYG = "CVR-1-99000001";
const BO = "CVR-3-4000000002";
/** B4-elementer, overblikket viser, når der er plads (og altid på "vis alt"). */
const B4_OVERBLIK = ["LassoRegistration", "LassoMap"];
/** Default-sidens elementer i komponistens prioriterede rækkefølge (23.3). */
const PAPER_ORDER = ["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections", "LassoKeyValueList", "LassoRelations", "LassoBarChart", "LassoContact", "LassoTimeline", "LassoNews", "LassoShortcuts"];
const PAD = 48;

function check(spec: ViewSpec, ds: Dataset, label: string, maxDev = BAND_MAX_DEVIATION) {
  const legal = BAND_COMBOS.map((x) => x.join("+"));
  const bands = bandsOf(spec);
  assert.ok(bands.length > 0, `${label}: ingen delte bånd`);
  for (const band of bands) {
    const cols = band.map((st) => WIDTH_COLUMNS[st[0]!.width!]);
    assert.ok(legal.includes(cols.join("+")), `${label}: ulovligt bånd ${cols.join("+")}`);
    const hs = band.map((st) => st.reduce((sum, c) => sum + gridHeight(c, st[0]!.width!, ds, spec.components) + PAD, 0));
    const dev = (Math.max(...hs) - Math.min(...hs)) / Math.max(...hs);
    assert.ok(dev <= maxDev + 1e-9, `${label}: ${band.map((st) => st.map((c) => c.type).join("+")).join(" | ")} = ${hs.join(" | ")} (${Math.round(dev * 100)} %)`);
  }
}

test("gridmodel: virksomhedens overblik, økonomi og ejerskab er lovlige bånd med højst 15 % højdeforskel", async () => {
  const p = new DemoProvider();
  for (const focus of ["overblik", "oekonomi", "ejerskab"] as const) {
    const ds = await resolveSpec(composeProbe(BYG, focus), p);
    // Overblikket står inden for højdebudgettet med kontakt som ekstra stak (3+6+3, skønnet op til ABSORB_MAX_DEVIATION).
    check(composeCompany(BYG, ds, { focus, name: ds.companies[BYG]?.name }), ds, focus, focus === "overblik" ? ABSORB_MAX_DEVIATION : BAND_MAX_DEVIATION);
  }
});

test("gridmodel 23.3: default-siden (overblik uden spørgsmål) har den faste rækkefølge og fylder hvert bånd", async () => {
  const ds = await resolveSpec(composeProbe(BYG, "overblik"), new DemoProvider());
  // showAll: alle elementer ("vis alt om X"); standardsiden holder højdebudgettet (testen nedenfor).
  const spec = composeCompany(BYG, ds, { focus: "overblik", followUps: false, showAll: true });
  const order = spec.components.map((c) => c.type);
  const expected = ["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections", "LassoKeyValueList", "LassoContact", "LassoRelations", "LassoBarChart", "LassoTimeline", "LassoNews", "LassoShortcuts"];
  // B4: "vis alt" viser også registreringen og kortet (demodata har koordinater), højst 12 komponenter.
  assert.deepEqual([...order].sort(), [...expected, ...B4_OVERBLIK].sort());
  assert.deepEqual(order.slice(0, 3), expected.slice(0, 3));
  for (const band of bandsOf(spec)) assert.equal(band.reduce((s, st) => s + WIDTH_COLUMNS[st[0]!.width!], 0), 12);
});

/** Sidens højde som pakningen regner den (layout 'columns': 48 px luft pr. element, ingen gap). */
function pageHeightOf(spec: ViewSpec, ds: Dataset): number {
  let total = 0;
  let band: number[] = [];
  let last = 0;
  const flush = () => {
    if (band.length) total += Math.max(...band);
    band = [];
  };
  for (const c of spec.components) {
    if (!c.column) {
      flush();
      total += gridHeight(c, "full", ds, spec.components) + PAD;
      last = 0;
      continue;
    }
    if (last === 0 || c.column < last) flush();
    while (band.length < c.column) band.push(0);
    band[c.column - 1]! += gridHeight(c, c.width!, ds, spec.components) + PAD;
    last = c.column;
  }
  flush();
  return total;
}

test("højdebudget 23.3: default-siden er ca. 1/2–2/3 af den fulde side og holder PAGE_HEIGHT_BUDGET", async () => {
  const ds = await resolveSpec(composeProbe(BYG, "overblik"), new DemoProvider());
  const all = composeCompany(BYG, ds, { focus: "overblik", followUps: false, showAll: true });
  const page = composeCompany(BYG, ds, { focus: "overblik", followUps: false });
  // Forholdet (Paper 23.3) gælder Papers elementer: den fulde side uden B4-elementerne (registrering, kort),
  // som packPage pakker dem i prioriteret rækkefølge.
  const paper = packPage(PAPER_ORDER.flatMap((t) => all.components.filter((c) => c.type === t).map((c) => ({ ...c, column: undefined, width: undefined }) as ViewComponent)), ds);
  const hAll = pageHeightOf({ ...all, components: paper.components }, ds);
  const h = pageHeightOf(page, ds);
  assert.ok(h <= PAGE_HEIGHT_BUDGET, `${h} > ${PAGE_HEIGHT_BUDGET}`);
  assert.ok(h >= hAll / 2 && h <= (hAll * 2) / 3 + 1, `${h} af ${hAll}`);
  // Hoved, nøgletal, profil og oplysninger er altid med; bånd på 12 og 15 %.
  const types = page.components.map((c) => c.type);
  for (const t of ["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections", "LassoKeyValueList"] as const) assert.ok(types.includes(t), t);
  assert.ok(page.components.length < all.components.length);
  check(page, ds, "overblik med budget", ABSORB_MAX_DEVIATION);
  // Paper 23.3 (Fable r5, L29-0/MMN-0): B1 hoved, B2 nøgletalskort, B3 6+6 profil kompakt | oplysninger 6
  // rækker, B4 3+6+3 relationer | søjlegraf | kontakt. Genveje, nyheder og historik er udeladt (laveste
  // relevans først), kontakt er med.
  const shape = page.components.map((c) => `${c.type}${c.column ? `@${c.column}/${c.width}` : ""}${(c as { maxRows?: number }).maxRows ? `:${(c as { maxRows?: number }).maxRows}` : ""}${(c as { limit?: number }).limit ? `:${(c as { limit?: number }).limit}` : ""}`);
  assert.deepEqual(shape, ["LassoCompanyHead", "LassoKeyFigureCards", "LassoTextSections@1/half:3", "LassoKeyValueList@2/half:6", "LassoRelations@1/quarter", "LassoBarChart@2/half", "LassoContact@3/quarter"]);
  for (const band of bandsOf(page)) assert.equal(band.reduce((s, st) => s + WIDTH_COLUMNS[st[0]!.width!], 0), 12);
  // Et større budget giver plads til mere.
  assert.ok(composeCompany(BYG, ds, { focus: "overblik", followUps: false, heightBudget: 5000 }).components.length === all.components.length);
});

test("gridmodel: personsidens elementer pakket med packPage (virksomhedssidens højder) holder 15 %", async () => {
  const ds = await resolveSpec(composePersonProbe(BO, "overblik"), new DemoProvider());
  const spec = composePerson(BO, ds, { focus: "overblik" });
  const items = spec.components.map(({ column: _c, width: _w, ...c }) => c as ViewComponent);
  const packed = packPage(items, ds);
  check({ ...spec, components: packed.components }, ds, "person overblik");
});

/**
 * Ø13/B8 på rigtige sider: i et delt bånd står intet element under sin indholdsstyrede mindstebredde
 * (contentWidthOf, driverne fra Dataset), og en smal komponent står højst i ½. Alene i et bånd (uden
 * kolonne) må en smal komponent fylde bredden. Alle demovirksomheder, alle fokus, med og uden budget.
 */
function assertWidthRules(spec: ViewSpec, ds: Dataset, label: string) {
  const v = layoutViolations(spec, ds);
  assert.deepEqual(v.map((x) => `${label}: ${describeViolation(x)}`), []);
}

test("Ø13/B8: virksomhedssiderne (alle demovirksomheder og fokus) klemmer aldrig et bredt element og strækker aldrig et smalt", async () => {
  const p = new DemoProvider();
  for (let i = 1; i <= 14; i++) {
    const id = `CVR-1-990000${String(i).padStart(2, "0")}`;
    for (const focus of FOCUSES) {
      const ds = await resolveSpec(composeProbe(id, focus), p);
      assertWidthRules(composeCompany(id, ds, { focus }), ds, `${id} ${focus}`);
      assertWidthRules(composeCompany(id, ds, { focus, showAll: true }), ds, `${id} ${focus} vis alt`);
    }
  }
});

test("Ø13/B8: personsidens elementer pakket med packPage: netværket står i fuld bredde, roller som liste højst ½", async () => {
  const p = new DemoProvider();
  for (const person of [BO, "CVR-3-4000000001"]) {
    const ds = await resolveSpec(composePersonProbe(person, "overblik"), p);
    const spec = composePerson(person, ds, { focus: "overblik" });
    const items = spec.components.map(({ column: _c, width: _w, ...c }) => c as ViewComponent);
    const packed = packPage(items, ds, { budget: Number.POSITIVE_INFINITY });
    assertWidthRules({ ...spec, components: packed.components }, ds, `${person} overblik`);
    const net = packed.components.find((c) => c.type === "LassoPersonNetwork");
    if (net) assert.equal(net.column, undefined, "netværket står i eget fuldbånd");
  }
});

/**
 * Ø13/B10: personsiderne, som composePerson KOMPONERER dem (ikke kun pakket med packPage): alle demopersoner,
 * alle fokus, med og uden budget. Intet element under sin indholdsstyrede mindstebredde, ingen smal over ½
 * ved siden af andre, og netværket med reelle data står altid i eget fuldbånd.
 */
test("Ø13/B10: personsiderne (komponeret, alle demopersoner og fokus) klemmer aldrig et bredt element og strækker aldrig et smalt", async () => {
  const p = new DemoProvider();
  let people = 0;
  for (let i = 1; i <= 99; i++) {
    const id = `CVR-3-${4000000000 + i}`;
    if (!(await p.person(id).catch(() => undefined))) break;
    people++;
    for (const focus of PERSON_FOCUSES) {
      const ds = await resolveSpec(composePersonProbe(id, focus), p);
      for (const showAll of [false, true]) {
        const spec = composePerson(id, ds, { focus, showAll });
        assertWidthRules(spec, ds, `${id} ${focus}${showAll ? " vis alt" : ""}`);
        const net = spec.components.find((c) => c.type === "LassoPersonNetwork");
        if (net && (ds.personNetworks[id]?.people.length ?? 0) > 0) assert.equal(net.column, undefined, `${id} ${focus}: netværket i eget fuldbånd`);
      }
    }
  }
  assert.ok(people >= 2, `${people} demopersoner`);
});

/** Ø13/B10: spørgsmålssiderne (composeAskCompany og composeAskPerson) for de 60 eval-spørgsmål, komponeret som eval-løberen gør. */
test("Ø13/B10: spørgsmålssiderne for eval-sættets 60 spørgsmål overholder bredde-reglerne", async () => {
  const file = JSON.parse(readFileSync(new URL("../../../../packages/spec/src/eval/questions.json", import.meta.url), "utf8")) as {
    cases: { id: string; kind: "company" | "person"; entity: string; question: string; hints?: { metrics?: never; topic?: string; focus?: string; show_all?: boolean } }[];
  };
  assert.equal(file.cases.length, 60);
  const p = new DemoProvider();
  for (const c of file.cases) {
    const id = c.entity;
    if (c.kind === "company") {
      const official = await p.company(id).then((x) => x.name).catch(() => undefined);
      const a = parseAsk(c.question, "company", { metrics: c.hints?.metrics, topic: c.hints?.topic, name: official ? [official, shortCompanyName(official)] : undefined });
      const focus = (c.hints?.focus ?? (a.generic ? askFocus(a) : undefined)) as never;
      const ds = await resolveSpec(composeProbe(id, focus, a), p);
      assertWidthRules(composeCompany(id, ds, { focus, name: ds.companies[id]?.name, ask: a, showAll: c.hints?.show_all }), ds, c.id);
    } else {
      const official = await p.person(id).then((x) => x.name).catch(() => undefined);
      const a = parseAsk(c.question, "person", { name: official, topic: c.hints?.topic });
      const focus = ((c.hints?.focus as never) ?? (a.generic ? askPersonFocus(a) : undefined) ?? "overblik") as never;
      const ds = await resolveSpec(composePersonProbe(id, focus, a), p);
      assertWidthRules(composePerson(id, ds, { focus, name: ds.persons[id]?.name, ask: a, showAll: c.hints?.show_all }), ds, c.id);
    }
  }
});
