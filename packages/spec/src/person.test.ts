import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composePerson,
  composePersonProbe,
  emptyDataset,
  entityRefOf,
  isFocusFor,
  isPersonFocus,
  isPersonId,
  longestPeriod,
  longestPeriodYears,
  mergePeriods,
  ownershipGraphKey,
  parseViewSpec,
  PAGE_FOCUSES,
  pairByWeight,
  PERSON_PAGE_BUDGET,
  compactPersonItem,
  personPageHeight,
  PERSON_FOCUS_LABELS,
  PERSON_FOCUSES,
  PERSON_GRAPH_DEPTH,
  personCompanies,
  personCounts,
  personFactOptions,
  personFacts,
  personRisk,
  personRoleRows,
  personTimeline,
  riskTimeline,
  roleKind,
  widthOf,
  type PersonFocus,
  type PersonVM,
  type ViewComponent,
} from "./index.js";

const ID = "CVR-3-4000000001";
const person: PersonVM = {
  lassoId: ID,
  name: "Mette Holm Eksempel",
  city: "København",
  roles: [
    { companyId: "CVR-1-11111111", companyName: "Data Eksempel A/S", kind: "direction", role: "Adm. direktør", from: "2012-05-14", active: true },
    { companyId: "CVR-1-11111111", companyName: "Data Eksempel A/S", kind: "board", role: "Bestyrelsesmedlem", from: "2016-01-01", active: true },
    { companyId: "CVR-1-22222222", companyName: "Holm Holding ApS", kind: "owner", role: "Ejer", share: "100 %", from: "2009-01-01", active: true },
    { companyId: "CVR-1-33333333", companyName: "Cloud Eksempel A/S", kind: "board", role: "Bestyrelsesmedlem", from: "2014-01-01", to: "2018-06-01", active: false, companyStatus: "Under konkurs", companyStatusKind: "warning", companyEnded: "2026-02-01" },
  ],
};

test("person-komponenterne valideres og har deres standardbredder", () => {
  const spec = parseViewSpec({
    kind: "person",
    title: "Mette",
    components: [
      { type: "LassoPersonHead", person: ID },
      { type: "LassoPersonRoles", person: ID },
      { type: "LassoPersonNetwork", person: ID },
      { type: "LassoPersonRisk", person: ID },
    ],
  });
  assert.equal(spec.kind, "person");
  assert.deepEqual(spec.components.map((c) => widthOf(c, "dashboard")), ["full", "two-thirds", "two-thirds", "half"]);
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoPersonHead" }] }));
});

test("isPersonId og roleKind", () => {
  assert.ok(isPersonId("CVR-3-4000000001"));
  assert.ok(!isPersonId("CVR-1-12345678"));
  assert.equal(roleKind("Adm. direktør"), "direction");
  assert.equal(roleKind("Bestyrelsesformand"), "board");
  assert.equal(roleKind("Reel ejer"), "owner");
  assert.equal(roleKind("EJER", "owner REGISTER"), "owner");
  assert.equal(roleKind("Interessent", "stakeholder"), "other");
});

test("roller samles pr. selskab, aktive først, og tælles", () => {
  const companies = personCompanies(person);
  assert.deepEqual(companies.map((c) => c.companyName), ["Holm Holding ApS", "Data Eksempel A/S", "Cloud Eksempel A/S"]);
  assert.deepEqual(personCounts(person), { activeRoles: 3, endedRoles: 1, activeCompanies: 2, companies: 3, firstYear: 2009 });
});

test("personrisiko: konkurs efter fratræden er ikke 'involveret'", () => {
  const r = personRisk(person);
  assert.equal(r.bankruptcies.length, 1);
  assert.equal(r.dissolutions.length, 0);
  assert.equal(r.bankruptcies[0]!.involved, false);
  assert.equal(r.bankruptcies[0]!.yearsBefore, 7);
  const still = personRisk({ ...person, roles: [{ ...person.roles[3]!, to: undefined, active: true, companyStatus: "Tvangsopløst" }] });
  assert.equal(still.dissolutions[0]!.involved, true);
});

/** Komponent som "Type@kolonne/bredde" til sammenligning af placeringen. */
const placement = (c: { type: string; column?: number; width?: string }) => `${c.type}${c.column ? `@${c.column}` : ""}${c.width ? `/${c.width}` : ""}`;
const GRAPH_KEY = ownershipGraphKey({ person: ID, ...PERSON_GRAPH_DEPTH });

/** Et fuldt datasæt: netværk, historik, nyheder og et ejerdiagram med ét ejet selskab, der selv ejer et. */
function fullDataset() {
  const ds = emptyDataset("demo");
  ds.persons[ID] = person;
  ds.personNetworks[ID] = { lassoId: ID, people: [{ name: "Søren Eksempel", companies: [{ companyName: "Data Eksempel A/S" }], overlapYears: 14, active: true }] };
  ds.timeline[ID] = personTimeline(person, "2026-09-27");
  ds.news[ID] = { lassoId: ID, items: [{ source: "Lasso", headline: "Mette Holm Eksempel indtræder i bestyrelsen" }] };
  ds.ownershipGraphs[GRAPH_KEY] = {
    rootId: ID,
    nodes: [
      { id: ID, name: person.name, kind: "person", root: true },
      { id: "CVR-1-22222222", name: "Holm Holding ApS", kind: "company" },
      { id: "CVR-1-66666666", name: "Holm Datter ApS", kind: "company" },
    ],
    edges: [
      { from: ID, to: "CVR-1-22222222", share: [100, 100] },
      { from: "CVR-1-22222222", to: "CVR-1-66666666", share: [100, 100] },
    ],
    ingoingDepth: 0,
    outgoingDepth: 2,
  };
  return ds;
}

/** Personsidens komponenter med de egenskaber, der afgør formen (show, limit, filter, except). */
const shape = (c: ViewComponent) => {
  const x = c as { show?: string; limit?: number; filter?: string; except?: string };
  const props = [x.show, x.except && `-${x.except}`, x.filter && `~${x.filter}`, x.limit && `#${x.limit}`].filter(Boolean).join(",");
  return `${placement(c)}${props ? `[${props}]` : ""}`;
};

/** Ingen komponent står to gange med samme form på samme side (ingen 1:1-gentagelser). */
function assertNoDuplicates(components: readonly ViewComponent[]) {
  const keys = components.map((c) => {
    const x = c as { type: string; show?: string; filter?: string };
    return `${x.type}|${x.show ?? ""}|${x.filter ?? ""}`;
  });
  assert.equal(new Set(keys).size, keys.length, keys.join(" "));
}

test("composePerson overblik: aktive roller (liste) ¾ + stamoplysninger ¼; netværk, risiko, historik og ejerskab to og to efter vægt; ingen nyheder", () => {
  const ds = fullDataset();
  const spec = composePerson(ID, ds);
  assert.equal(spec.layout, "columns");
  assert.equal(spec.title, "Mette Holm Eksempel");
  assert.equal(spec.subtitle, "Roller i 3 selskaber");
  assert.deepEqual(spec.components.map(shape), [
    "LassoPersonHead",
    "LassoPersonRoles@1/three-quarters[current,#5]",
    "LassoPersonFacts@2/quarter",
    // Netværket (1 person) og det lille ejerskab står sammen, risiko og historik (3 + "Se alle") sammen,
    // fordi det giver de mest lige bånd (netværk | risiko ville stå over for historik | ejerskab).
    "LassoPersonNetwork@1[#3]",
    "LassoOwnershipDiagram@2",
    "LassoPersonRisk@1",
    "LassoTimeline@2[#3]",
    "LassoFollowUps",
  ]);
  assertNoDuplicates(spec.components);
  assert.ok(!spec.components.some((c) => c.type === "LassoNews"), "nyhederne står på historik");
  const diagram = spec.components.find((c) => c.type === "LassoOwnershipDiagram");
  assert.ok(diagram?.type === "LassoOwnershipDiagram" && ownershipGraphKey(diagram) === GRAPH_KEY && diagram.title === "Ejerskab");
  // Stamoplysningerne gentager ikke hovedets tal på samme side.
  assert.deepEqual(personFactOptions(spec.components, ID), { hideCounts: true });
  assert.deepEqual(personFactOptions([{ type: "LassoPersonFacts", person: ID }], ID), { hideCounts: false });
});

test("composePerson højdebudget (runde 6): kompakt før udeladelse, hoved og svar-element altid med; showAll viser alt", () => {
  const ds = fullDataset();
  const all = composePerson(ID, ds, { showAll: true });
  const std = composePerson(ID, ds);
  // Demodatasættet holder budgettet: standard = vis alt.
  assert.deepEqual(std.components.map(shape), all.components.map(shape));
  assert.ok(personPageHeight(all.components, ds) <= PERSON_PAGE_BUDGET); // inkl. opfølgningen
  // Et stramt budget: først kompakte former, så udelades de mindst relevante halve bagfra.
  const tight = composePerson(ID, ds, { heightBudget: 700, followUps: false });
  const types = tight.components.map((c) => c.type);
  assert.equal(types[0], "LassoPersonHead");
  assert.equal(shape(tight.components[1]!), "LassoPersonRoles@1/three-quarters[current,#5]", "svar-elementet i fuld form");
  assert.ok(tight.components.length < composePerson(ID, ds, { showAll: true, followUps: false }).components.length, "noget er udeladt");
  assert.ok(!types.includes("LassoTimeline") || types.includes("LassoPersonNetwork"), "historik udelades før netværk");
  // Kompakte former: roller 3, netværk 2, historik 3; ejerlisten (show owner) har ingen.
  assert.equal((compactPersonItem({ type: "LassoPersonRoles", person: ID, show: "current", limit: 5 }) as { limit?: number }).limit, 3);
  assert.equal((compactPersonItem({ type: "LassoPersonNetwork", person: ID, limit: 3 }) as { limit?: number }).limit, 2);
  assert.equal(compactPersonItem({ type: "LassoPersonRoles", person: ID, show: "owner" }), null);
  ds.personNetworks[ID] = { lassoId: ID, people: Array.from({ length: 6 }, (_, i) => ({ name: `Person ${i}`, companies: [{ companyName: "Data Eksempel A/S" }], overlapYears: 10 - i, active: true })) };
  assert.ok(composePerson(ID, ds, { showAll: true, heightBudget: 10 }).components.some((c) => c.type === "LassoPersonNetwork" && c.limit === 3), "showAll ignorerer budgettet");
});

test("composePerson overblik: tomme sektioner udelades; en halv til overs står i fuld bredde; kun ophørte roller giver ophørt-listen", () => {
  const ds = fullDataset();
  ds.ownershipGraphs[GRAPH_KEY] = { ...ds.ownershipGraphs[GRAPH_KEY]!, edges: [] };
  ds.personNetworks[ID] = { lassoId: ID, people: [] };
  assert.deepEqual(composePerson(ID, ds, { followUps: false }).components.map(shape), [
    "LassoPersonHead",
    "LassoPersonRoles@1/three-quarters[current,#5]",
    "LassoPersonFacts@2/quarter",
    "LassoPersonRisk@1",
    "LassoTimeline@2[#3]",
  ]);
  // Et ophørt ejerskab alene giver intet diagram, og et ejet selskab, der ikke selv ejer noget,
  // heller ikke: diagrammet ville kun gentage "ejer 100 %" fra rollelisten 1:1.
  const owns = ds.ownershipGraphs[GRAPH_KEY]!;
  ds.ownershipGraphs[GRAPH_KEY] = { ...owns, edges: [{ from: ID, to: "CVR-1-22222222", until: "2020-01-01" }] };
  assert.ok(!composePerson(ID, ds).components.some((c) => c.type === "LassoOwnershipDiagram"));
  ds.ownershipGraphs[GRAPH_KEY] = { ...owns, edges: [{ from: ID, to: "CVR-1-22222222", share: [100, 100] }] };
  assert.ok(!composePerson(ID, ds).components.some((c) => c.type === "LassoOwnershipDiagram"));
  // Kunne grafen ikke hentes, udelader overblikket diagrammet (som andre sektioner uden data).
  delete ds.ownershipGraphs[GRAPH_KEY];
  ds.errors[`graph:${GRAPH_KEY}`] = "Lasso API-fejl (500)";
  assert.ok(!composePerson(ID, ds).components.some((c) => c.type === "LassoOwnershipDiagram"));
  // Tre halve: netværk (3) og risiko vejer nogenlunde ens og står side om side; historikken
  // (3 + "Se alle") alene i fuld bredde.
  ds.personNetworks[ID] = { lassoId: ID, people: Array.from({ length: 3 }, (_, i) => ({ name: `P${i}`, companies: [], overlapYears: 1, active: true })) };
  const three = composePerson(ID, ds, { followUps: false }).components.map(shape);
  assert.deepEqual(three.slice(3), ["LassoPersonNetwork@1[#3]", "LassoPersonRisk@2", "LassoTimeline[#3]"]);
  // Kun ophørte roller: listen over de ophørte står i stedet for de aktive.
  ds.persons[ID] = { ...person, roles: [person.roles[3]!] };
  assert.equal(shape(composePerson(ID, ds).components[1]!), "LassoPersonRoles@1/three-quarters[ended,#5]");
  // Ingen roller (og intet netværk): stamoplysningerne alene i fuld bredde, ingen risiko.
  ds.persons[ID] = { ...person, roles: [] };
  ds.personNetworks[ID] = { lassoId: ID, people: [] };
  ds.timeline[ID] = { lassoId: ID, events: [] };
  assert.deepEqual(composePerson(ID, ds, { followUps: false }).components.map(shape), ["LassoPersonHead", "LassoPersonFacts"]);
});

test("composePerson overblik: alvorlig risiko (personen var med) rykker op under hovedet", () => {
  const ds = fullDataset();
  ds.persons[ID] = { ...person, roles: [...person.roles.slice(0, 3), { ...person.roles[3]!, to: undefined, active: true }] };
  ds.timeline[ID] = personTimeline(ds.persons[ID]!, "2026-09-27");
  const spec = composePerson(ID, ds, { followUps: false });
  assert.deepEqual(spec.components.map(shape).slice(0, 4), ["LassoPersonHead", "LassoPersonRisk", "LassoPersonRoles@1/three-quarters[current,#5]", "LassoPersonFacts@2/quarter"]);
  assert.equal(spec.components.filter((c) => c.type === "LassoPersonRisk").length, 1);
});

test("composePerson roller: alle roller som tidsbånd (8 + 'Se alle') ¾ + stamoplysninger ¼, ingen ophørt-liste ved siden af båndene", () => {
  const spec = composePerson(ID, fullDataset(), { focus: "roller" });
  assert.equal(spec.subtitle, "Roller");
  assert.deepEqual(spec.components.map(shape), ["LassoPersonHead", "LassoPersonRoles@1/three-quarters[#8]", "LassoPersonFacts@2/quarter", "LassoFollowUps"]);
  assertNoDuplicates(spec.components);
});

test("composePerson netvaerk: hele netværket i fuld bredde (8 + 'Se alle'), også når det er tomt", () => {
  const ds = fullDataset();
  assert.deepEqual(composePerson(ID, ds, { focus: "netvaerk", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoPersonNetwork[#8]"]);
  ds.personNetworks[ID] = { lassoId: ID, people: [] };
  assert.deepEqual(composePerson(ID, ds, { focus: "netvaerk", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoPersonNetwork[#8]"]);
});

test("composePerson ejerskab: de ejede selskaber som liste og ejerstrukturen i fuld bredde; uden ejerskab kun listens tomme tilstand", () => {
  const ds = fullDataset();
  const spec = composePerson(ID, ds, { focus: "ejerskab", followUps: false });
  assert.deepEqual(spec.components.map(shape), ["LassoPersonHead", "LassoPersonRoles[owner]", "LassoOwnershipDiagram"]);
  const diagram = spec.components.find((c) => c.type === "LassoOwnershipDiagram");
  assert.ok(diagram?.type === "LassoOwnershipDiagram" && ownershipGraphKey(diagram) === GRAPH_KEY && diagram.title === undefined);
  // Ejer de ejede selskaber ingenting, står kun listen (diagrammet ville gentage den).
  const graph = ds.ownershipGraphs[GRAPH_KEY]!;
  ds.ownershipGraphs[GRAPH_KEY] = { ...graph, edges: graph.edges.slice(0, 1) };
  assert.deepEqual(composePerson(ID, ds, { focus: "ejerskab", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoPersonRoles[owner]"]);
  // Kunne grafen ikke hentes, viser fokus ejerskab diagrammets fejltilstand.
  delete ds.ownershipGraphs[GRAPH_KEY];
  ds.errors[`graph:${GRAPH_KEY}`] = "Lasso API-fejl (500)";
  assert.deepEqual(composePerson(ID, ds, { focus: "ejerskab", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoPersonRoles[owner]", "LassoOwnershipDiagram"]);
  // Uden ejerskab: listens tomme tilstand alene.
  ds.persons[ID] = { ...person, roles: person.roles.filter((r) => r.kind !== "owner") };
  ds.ownershipGraphs[GRAPH_KEY] = { ...graph, edges: [] };
  assert.deepEqual(composePerson(ID, ds, { focus: "ejerskab", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoPersonRoles[owner]"]);
});

test("composePerson risiko: alle sager i fuld bredde, forløbet i selskaberne | øvrige ophørte roller; uden sager kun den positive tomme tilstand", () => {
  const ds = fullDataset();
  // Mette har kun én ophørt rolle, i konkursselskabet: forløbet alene i fuld bredde.
  assert.deepEqual(composePerson(ID, ds, { focus: "risiko", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoPersonRisk", "LassoTimeline[~risiko]"]);
  // En ophørt rolle i et andet selskab: den står ved siden af forløbet.
  const other = { companyId: "CVR-1-44444444", companyName: "Andet Eksempel ApS", kind: "direction" as const, role: "Direktør", from: "2010-01-01", to: "2013-01-01", active: false };
  ds.persons[ID] = { ...person, roles: [...person.roles, other] };
  const spec = composePerson(ID, ds, { focus: "risiko", followUps: false });
  assert.deepEqual(spec.components.map(shape), ["LassoPersonHead", "LassoPersonRisk", "LassoTimeline@1[~risiko]", "LassoPersonRoles@2[ended,-risiko]"]);
  assertNoDuplicates(spec.components);
  // Ingen konkurser eller tvangsopløsninger: kun "Ingen" med flueben, intet andet end hovedet.
  ds.persons[ID] = { ...person, roles: person.roles.slice(0, 3) };
  assert.deepEqual(composePerson(ID, ds, { focus: "risiko", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoPersonRisk"]);
});

test("composePerson historik: historik (5 + 'Se alle') | nyheder (5); uden nyheder historikken alene", () => {
  const ds = fullDataset();
  assert.deepEqual(composePerson(ID, ds, { focus: "historik", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoTimeline@1", "LassoNews@2[#5]"]);
  ds.news[ID] = { lassoId: ID, items: [] };
  assert.deepEqual(composePerson(ID, ds, { focus: "historik", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoTimeline"]);
  // Kunne nyhederne ikke hentes, står nyhedernes fejltilstand ved siden af.
  ds.errors[`news:${ID}`] = "Lasso API-fejl (500)";
  assert.deepEqual(composePerson(ID, ds, { focus: "historik", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoTimeline@1", "LassoNews@2[#5]"]);
  // Hverken rolleskift eller nyheder: historikkens tomme tilstand.
  ds.timeline[ID] = { lassoId: ID, events: [] };
  delete ds.errors[`news:${ID}`];
  assert.deepEqual(composePerson(ID, ds, { focus: "historik", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoTimeline"]);
});

test("composePerson: opfølgning pr. fokus peger på de andre personfokus med spørgsmål til show_person", () => {
  const ds = fullDataset();
  const followUps = (focus: PersonFocus) => {
    const f = composePerson(ID, ds, { focus }).components.find((c) => c.type === "LassoFollowUps");
    return f?.type === "LassoFollowUps" ? f.prompts : [];
  };
  assert.deepEqual(followUps("overblik").map((p) => p.label), ["Roller", "Netværk", "Risiko"]);
  assert.deepEqual(followUps("roller").map((p) => p.label), ["Netværk", "Ejerskab", "Risiko"]);
  assert.deepEqual(followUps("netvaerk").map((p) => p.label), ["Roller", "Risiko", "Historik"]);
  assert.deepEqual(followUps("ejerskab").map((p) => p.label), ["Roller", "Netværk", "Risiko"]);
  assert.deepEqual(followUps("risiko").map((p) => p.label), ["Roller", "Historik", "Netværk"]);
  assert.deepEqual(followUps("historik").map((p) => p.label), ["Roller", "Risiko", "Netværk"]);
  for (const focus of PERSON_FOCUSES) {
    const labels = followUps(focus).map((p) => p.label);
    assert.ok(!labels.includes(PERSON_FOCUS_LABELS[focus]), `${focus} peger ikke på sig selv`);
    for (const p of followUps(focus)) assert.match(p.prompt, /Mette Holm Eksempel/);
  }
  assert.equal(followUps("netvaerk")[0]!.prompt, "Hvilke roller har Mette Holm Eksempel i selskaber?");
  assert.equal(followUps("overblik")[1]!.prompt, "Hvem sidder Mette Holm Eksempel sammen med i selskaber?");
  // Uden netværk og ejerskab springes de over.
  ds.personNetworks[ID] = { lassoId: ID, people: [] };
  ds.persons[ID] = { ...person, roles: person.roles.filter((r) => r.kind !== "owner") };
  assert.deepEqual(followUps("roller").map((p) => p.label), ["Risiko"]);
  assert.equal(composePerson(ID, ds, { followUps: false }).components.some((c) => c.type === "LassoFollowUps"), false);
});

test("composePerson uden persondata viser kun hovedet (som viser fejlen), på alle fokus", () => {
  const ds = emptyDataset("live");
  ds.errors[`person:${ID}`] = "Ikke fundet hos Lasso";
  for (const focus of PERSON_FOCUSES) assert.deepEqual(composePerson(ID, ds, { focus }).components.map((c) => c.type), ["LassoPersonHead"], focus);
});

test("composePersonProbe: hvert fokus henter kun det, det viser", () => {
  const probe = (focus?: PersonFocus) =>
    composePersonProbe(ID, focus).components.map((c) => (c.type === "LassoOwnershipDiagram" ? `${c.type}${ownershipGraphKey(c).slice(ID.length)}` : c.type));
  assert.deepEqual(probe(), ["LassoPersonHead", "LassoPersonNetwork", "LassoTimeline", "LassoOwnershipDiagram|0|2|"]);
  assert.deepEqual(probe("overblik"), probe());
  assert.deepEqual(probe("roller"), ["LassoPersonHead"]);
  assert.deepEqual(probe("netvaerk"), ["LassoPersonHead", "LassoPersonNetwork"]);
  assert.deepEqual(probe("ejerskab"), ["LassoPersonHead", "LassoOwnershipDiagram|0|2|"]);
  assert.deepEqual(probe("risiko"), ["LassoPersonHead", "LassoTimeline"]);
  assert.deepEqual(probe("historik"), ["LassoPersonHead", "LassoTimeline", "LassoNews"]);
  // Nyheder kun på historik, grafen kun på overblik og ejerskab.
  for (const focus of PERSON_FOCUSES) {
    assert.equal(probe(focus).includes("LassoNews"), focus === "historik", focus);
    assert.equal(probe(focus).some((t) => t.startsWith("LassoOwnershipDiagram")), focus === "overblik" || focus === "ejerskab", focus);
  }
});

test("personfokus: navne, isPersonFocus, isFocusFor og PAGE_FOCUSES", () => {
  assert.deepEqual([...PERSON_FOCUSES], ["overblik", "roller", "netvaerk", "ejerskab", "risiko", "historik"]);
  assert.deepEqual(PERSON_FOCUSES.map((f) => PERSON_FOCUS_LABELS[f]), ["Overblik", "Roller", "Netværk", "Ejerskab", "Risiko", "Historik"]);
  assert.ok(isPersonFocus("netvaerk"));
  assert.ok(!isPersonFocus("oekonomi"));
  assert.ok(!isPersonFocus(undefined));
  assert.ok(isFocusFor("person", "roller") && !isFocusFor("company", "roller"));
  assert.ok(isFocusFor("company", "oekonomi") && !isFocusFor("person", "oekonomi"));
  for (const f of PERSON_FOCUSES) assert.ok((PAGE_FOCUSES as readonly string[]).includes(f), f);
  assert.equal(new Set(PAGE_FOCUSES).size, PAGE_FOCUSES.length);
});

test("pairByWeight: to og to med de mest lige bånd; den foretrukne rækkefølge, når forskellen er lille", () => {
  const c = (n: number): ViewComponent => ({ type: "LassoTimeline", person: ID, limit: n });
  const weigh = (x: ViewComponent) => (x.type === "LassoTimeline" ? (x.limit ?? 0) : 0);
  const out = (list: ViewComponent[]) => pairByWeight(list, weigh).map((x) => `${x.type === "LassoTimeline" ? x.limit : "?"}${x.column ? `@${x.column}` : ""}`);
  assert.deepEqual(out([c(10), c(10), c(20), c(20)]), ["10@1", "10@2", "20@1", "20@2"]);
  assert.deepEqual(out([c(10), c(20), c(10), c(20)]), ["10@1", "10@2", "20@1", "20@2"]);
  // Lille forskel (under 2 linjer): den foretrukne rækkefølge.
  assert.deepEqual(out([c(10), c(11), c(12), c(10)]), ["10@1", "11@2", "12@1", "10@2"]);
  // Tre: det mest lige par side om side, den sidste i fuld bredde.
  assert.deepEqual(out([c(5), c(20), c(19)]), ["20@1", "19@2", "5"]);
  assert.deepEqual(out([c(5)]), ["5"]);
});

test("personRoleRows: aktive, ejede og ophørte roller pr. selskab", () => {
  assert.deepEqual(
    personRoleRows(person, "current").map((r) => [r.companyName, r.text, r.period]),
    [
      ["Holm Holding ApS", "Ejer 100 %", "siden 2009"],
      ["Data Eksempel A/S", "Adm. direktør, bestyrelsesmedlem", "siden 2012"],
    ],
  );
  assert.deepEqual(personRoleRows(person, "owner").map((r) => [r.companyName, r.text, r.period]), [["Holm Holding ApS", "Ejer 100 %", "siden 2009"]]);
  const ended = personRoleRows(person, "ended");
  assert.deepEqual(ended.map((r) => [r.companyName, r.text, r.period, r.companyStatus]), [["Cloud Eksempel A/S", "Bestyrelsesmedlem", "2014–2018", "Under konkurs"]]);
  // Risiko: selskaberne med konkurs står i forløbet og udelades af de øvrige ophørte.
  assert.deepEqual(personRoleRows(person, "ended", { except: "risiko" }), []);
  // To ophørte roller med hver sin periode i samme selskab; senest ophørte selskab først.
  const two: PersonVM = {
    ...person,
    roles: [
      ...person.roles,
      { companyId: "CVR-1-5", companyName: "To Roller ApS", kind: "direction", role: "Direktør", from: "2010-01-01", to: "2015-01-01", active: false },
      { companyId: "CVR-1-5", companyName: "To Roller ApS", kind: "board", role: "Bestyrelsesmedlem", from: "2012-01-01", to: "2020-01-01", active: false },
    ],
  };
  assert.deepEqual(
    personRoleRows(two, "ended").map((r) => [r.companyName, r.text, r.period]),
    [
      ["To Roller ApS", "Bestyrelsesmedlem 2012–2020, direktør 2010–2015", "til 2020"],
      ["Cloud Eksempel A/S", "Bestyrelsesmedlem", "2014–2018"],
    ],
  );
});

test("riskTimeline: kun forløbet i selskaberne med konkurs eller tvangsopløsning", () => {
  const t = riskTimeline(personTimeline(person, "2026-09-27"), person);
  assert.deepEqual(t.events.map((e) => e.title), [
    "Cloud Eksempel A/S kom under konkurs",
    "Udtrådt som bestyrelsesmedlem i Cloud Eksempel A/S",
    "Indtrådt som bestyrelsesmedlem i Cloud Eksempel A/S",
  ]);
  // Uden sager er forløbet tomt.
  assert.deepEqual(riskTimeline(personTimeline(person, "2026-09-27"), { ...person, roles: person.roles.slice(0, 3) }).events, []);
});

test("tidslinje, nyheder og ejerdiagram tager company ELLER person, præcis én", () => {
  for (const type of ["LassoTimeline", "LassoNews", "LassoOwnershipDiagram"]) {
    assert.doesNotThrow(() => parseViewSpec({ title: "x", components: [{ type, person: ID }] }), type);
    assert.doesNotThrow(() => parseViewSpec({ title: "x", components: [{ type, company: "12345678" }] }), type);
    assert.throws(() => parseViewSpec({ title: "x", components: [{ type }] }), /præcis én/, type);
    assert.throws(() => parseViewSpec({ title: "x", components: [{ type, company: "12345678", person: ID }] }), /præcis én/, type);
  }
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoPersonFacts", person: ID }, { type: "LassoNews", person: ID }] });
  assert.equal(widthOf(spec.components[0]!, "dashboard"), "third");
  assert.equal(entityRefOf(spec.components[1] as { person?: string }), ID);
  assert.equal(ownershipGraphKey({ person: ID, ingoingDepth: 0, outgoingDepth: 2 }), `${ID}|0|2|`);
  assert.equal(ownershipGraphKey({ company: "CVR-1-1", ingoingDepth: 2, outgoingDepth: 1 }), "CVR-1-1|2|1|");
});

test("mergePeriods: overlap og tilstødende perioder lægges sammen, et hul giver to perioder", () => {
  const today = "2026-01-01";
  // Overlap -> én periode.
  assert.deepEqual(mergePeriods([{ from: "2010-01-01", to: "2015-01-01" }, { from: "2014-01-01", to: "2020-01-01" }], today).map((p) => [p.from, p.to]), [["2010-01-01", "2020-01-01"]]);
  // Tilstødende inden for én dag -> én periode.
  assert.equal(mergePeriods([{ from: "2010-01-01", to: "2014-12-31" }, { from: "2015-01-01", to: "2016-01-01" }], today).length, 1);
  // Et hul på mere end én dag -> to perioder.
  assert.equal(mergePeriods([{ from: "2010-01-01", to: "2014-12-30" }, { from: "2015-01-01", to: "2016-01-01" }], today).length, 2);
  // Åben periode regnes til i dag og er "open"; perioder uden start springes over.
  const open = mergePeriods([{ from: "2020-01-01" }, { to: "2021-01-01" }], today);
  assert.deepEqual(open, [{ from: "2020-01-01", to: "2026-01-01", open: true, days: 2192 }]);
});

test("longestPeriodYears: den længste sammenhængende periode vinder, ikke summen", () => {
  const today = "2026-01-01";
  const same = Array.from({ length: 13 }, () => ({ from: "2010-01-01", to: "2020-01-01" }));
  assert.equal(longestPeriodYears(same, today), 10);
  assert.equal(longestPeriodYears([{ from: "2000-01-01", to: "2005-01-01" }, { from: "2010-01-01", to: "2012-01-01" }], today), 5);
  assert.equal(longestPeriodYears([{ from: "2000-01-01", to: "2002-01-01" }, { from: "2010-01-01" }], today), 16);
  assert.equal(longestPeriod([{ from: "2000-01-01", to: "2002-01-01" }, { from: "2010-01-01" }], today)?.from, "2010-01-01");
  assert.equal(longestPeriodYears([], today), 0);
});

test("personFacts: ejerskaber, første registrering og seneste ændring", () => {
  const f = personFacts(person, "2026-09-27");
  assert.equal(f.ownedCompanies, 1);
  assert.equal(f.firstRegistered, "2009-01-01");
  assert.equal(f.latestChange, "2018-06-01");
  assert.equal(f.activeRoles, 3);
  // En varslet fratræden i fremtiden er ikke sket endnu.
  const later = personFacts({ ...person, roles: [{ ...person.roles[0]!, to: "2027-01-01" }] }, "2026-09-27");
  assert.equal(later.latestChange, "2012-05-14");
});

test("personTimeline: indtrådt/udtrådt som X i et selskab, ejerskab og konkurs, nyeste først", () => {
  const t = personTimeline(person, "2026-09-27");
  assert.equal(t.lassoId, ID);
  assert.deepEqual(t.events.slice(0, 3).map((e) => [e.date, e.title, e.category]), [
    ["2026-02-01", "Cloud Eksempel A/S kom under konkurs", "Status"],
    ["2018-06-01", "Udtrådt som bestyrelsesmedlem i Cloud Eksempel A/S", "Ledelse"],
    ["2016-01-01", "Indtrådt som bestyrelsesmedlem i Data Eksempel A/S", "Ledelse"],
  ]);
  assert.equal(t.events[0]!.detail, "Personen var udtrådt i 2018");
  const owner = t.events.find((e) => e.category === "Ejerskab");
  assert.equal(owner?.title, "Blev ejer af Holm Holding ApS");
  assert.equal(owner?.detail, "Ejerandel 100 %");
  // Selskabsnavnet er et segment med Lasso-ID, så det kan åbnes.
  assert.deepEqual(owner?.titleSegments, [{ text: "Blev ejer af " }, { text: "Holm Holding ApS", lassoId: "CVR-1-22222222" }]);
  assert.equal(t.events.length, 6);
  // "Adm. direktør" skrives med småt midt i sætningen.
  assert.ok(t.events.some((e) => e.title === "Indtrådt som adm. direktør i Data Eksempel A/S"));
});
