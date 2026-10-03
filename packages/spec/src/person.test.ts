import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeCompany,
  composePerson,
  contentWidthOf,
  gridRuleOf,
  widthProfileOf,
  WIDTHS,
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
  compactPersonItem,
  PERSON_FOCUS_LABELS,
  PERSON_FOCUSES,
  PERSON_GRAPH_DEPTH,
  parseAsk,
  personWithRole,
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
  assert.deepEqual(spec.components.map((c) => widthOf(c, "dashboard")), ["full", "two-thirds", "full", "third"]); // Ø13/B8: netværket fuld (A13), risiko smal ⅓
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

/** Personsidens komponenter med de egenskaber, der afgør formen (show, limit, filter, except, more). */
const shape = (c: ViewComponent) => {
  const x = c as { show?: string; limit?: number; filter?: string; except?: string; more?: string };
  const props = [x.show, x.except && `-${x.except}`, x.filter && `~${x.filter}`, x.limit && `#${x.limit}`, x.more && `>${x.more}`].filter(Boolean).join(",");
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

/** De to udgåede personkomponenter (Jakob 30.09) står aldrig på en komponeret personside. */
function assertNoRetired(components: readonly ViewComponent[], label = "") {
  for (const type of ["LassoPersonRisk", "LassoPersonFacts"]) assert.ok(!components.some((c) => c.type === type), `${label} ${type} er udgået`.trim());
}

test("composePerson overblik (Ø13/B10): aktive roller (liste) alene i fuld bredde; netværket i eget fuldbånd; ingen historik og intet ejerskab (Jakob 01.10), ingen risiko, stamoplysninger eller nyheder", () => {
  const ds = fullDataset();
  const spec = composePerson(ID, ds);
  assert.equal(spec.layout, "columns");
  assert.equal(spec.title, "Mette Holm Eksempel");
  assert.equal(spec.subtitle, "Roller i 3 selskaber");
  assert.deepEqual(spec.components.map(shape), [
    "LassoPersonHead",
    "LassoPersonStats",
    // Stamoplysningerne er udgået: den aktive rolleliste står alene i fuld bredde.
    "LassoPersonRoles[current,#5,>roller]",
    // Netværket (min 1/1) står i eget fuldbånd og deler aldrig bånd.
    "LassoPersonNetwork[#3,>netvaerk]",
    // Jakob 01.10: historik og ejerskab står på deres egne faner. Erhvervsresuméet står kun, når Lasso har et.
    "LassoFollowUps",
  ]);
  assertNoDuplicates(spec.components);
  assertNoRetired(spec.components, "overblik");
  assert.ok(!spec.components.some((c) => c.type === "LassoNews"), "nyhederne står på historik");
  assert.ok(!spec.components.some((c) => c.type === "LassoOwnershipDiagram" || c.type === "LassoTimeline"), "historik og ejerskab står på fanerne");
  // Gamle specs med stamoplysningerne: de gentager ikke hovedets tal på samme side.
  assert.deepEqual(personFactOptions(spec.components, ID), { hideCounts: true });
  assert.deepEqual(personFactOptions([{ type: "LassoPersonFacts", person: ID }], ID), { hideCounts: false });
});

test("composePerson højdebudget (runde 6): kompakt før udeladelse, hoved og svar-element altid med; showAll viser alt", () => {
  const ds = fullDataset();
  const all = composePerson(ID, ds, { showAll: true });
  const std = composePerson(ID, ds);
  // Demodatasættet holder budgettet, som Papers side regner det: standard = vis alt. (B10: budgettet vælger
  // elementerne som før; pakningen efter bredderne ombryder kun siden og kan gøre den højere.)
  assert.deepEqual(std.components.map(shape), all.components.map(shape));
  // Et stramt budget: først kompakte former, så udelades de mindst relevante halve bagfra.
  const tight = composePerson(ID, ds, { heightBudget: 300, followUps: false });
  const types = tight.components.map((c) => c.type);
  assert.equal(types[0], "LassoPersonHead");
  const answer = tight.components.find((c) => c.type === "LassoPersonRoles");
  assert.ok(answer, "svar-elementet er med");
  assert.equal(shape(answer).replace(/@.*?\[/, "["), "LassoPersonRoles[current,#5,>roller]", "svar-elementet i fuld form");
  assertNoRetired(tight.components, "stramt budget");
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
    "LassoPersonStats",
    "LassoPersonRoles[current,#5,>roller]",
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
  // Netværket (min 1/1) i eget fuldbånd; ingen historik på overblikket (Jakob 01.10).
  ds.personNetworks[ID] = { lassoId: ID, people: Array.from({ length: 3 }, (_, i) => ({ name: `P${i}`, companies: [], overlapYears: 1, active: true })) };
  const three = composePerson(ID, ds, { followUps: false }).components.map(shape);
  assert.deepEqual(three.slice(3), ["LassoPersonNetwork[#3,>netvaerk]"]);
  // Med Lassos erhvervsresumé (GET /modules/resume) står det under netværket.
  ds.resumes[ID] = { lassoId: ID, state: "ok", content: "Mette har siddet i {Data Eksempel A/S|CVR-1-11111111} siden 2012." };
  assert.deepEqual(composePerson(ID, ds, { followUps: false }).components.map(shape).slice(3), ["LassoPersonNetwork[#3,>netvaerk]", "LassoSummary"]);
  delete ds.resumes[ID];
  // Kun ophørte roller: listen over de ophørte står i stedet for de aktive.
  ds.persons[ID] = { ...person, roles: [person.roles[3]!] };
  assert.equal(shape(composePerson(ID, ds).components.find((c) => c.type === "LassoPersonRoles")!), "LassoPersonRoles[ended,#5,>roller]");
  // Ingen roller (og intet netværk eller historik): kun hovedet; stamoplysningerne og risikoen er udgået.
  ds.persons[ID] = { ...person, roles: [] };
  ds.personNetworks[ID] = { lassoId: ID, people: [] };
  ds.timeline[ID] = { lassoId: ID, events: [] };
  assert.deepEqual(composePerson(ID, ds, { followUps: false }).components.map(shape), ["LassoPersonHead"]);
});

test("composePerson overblik: alvorlig risiko (personen var med) giver ingen risikosektion; persontallene står under hovedet og rollerne derunder", () => {
  const ds = fullDataset();
  ds.persons[ID] = { ...person, roles: [...person.roles.slice(0, 3), { ...person.roles[3]!, to: undefined, active: true }] };
  ds.timeline[ID] = personTimeline(ds.persons[ID]!, "2026-09-27");
  const spec = composePerson(ID, ds, { followUps: false });
  // B4: persontallene (med konkurserne) står øverst under hovedet; risikosektionen er udgået, så rollerne
  // følger lige under tallene i fuld bredde.
  assert.deepEqual(spec.components.map(shape).slice(0, 3), ["LassoPersonHead", "LassoPersonStats", "LassoPersonRoles[current,#5,>roller]"]);
  assertNoRetired(spec.components, "alvorlig risiko");
});

test("composePerson roller: alle roller som tidsbånd (8 + 'Se alle') alene i fuld bredde, ingen stamoplysninger og ingen ophørt-liste ved siden af båndene", () => {
  const spec = composePerson(ID, fullDataset(), { focus: "roller" });
  assert.equal(spec.subtitle, "Roller");
  assert.deepEqual(spec.components.map(shape), ["LassoPersonHead", "LassoPersonRoles[#8]", "LassoFollowUps"]);
  assertNoDuplicates(spec.components);
  assertNoRetired(spec.components, "roller");
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

test("composePerson risiko: kun forløbet i selskaberne ('Forløb i selskaberne') i fuld bredde, ingen risikosektion og ingen ophørte roller (de står på roller); uden sager forløbets tomme tilstand", () => {
  const ds = fullDataset();
  // Mette har kun én ophørt rolle, i konkursselskabet: forløbet alene i fuld bredde.
  const first = composePerson(ID, ds, { focus: "risiko", followUps: false });
  assert.deepEqual(first.components.map(shape), ["LassoPersonHead", "LassoTimeline[~risiko]"]);
  const tl = first.components[1]!;
  assert.ok(tl.type === "LassoTimeline" && tl.title === "Forløb i selskaberne");
  // En ophørt rolle i et andet selskab: den hører til fanen Roller (tidsbåndene), ikke risiko.
  const other = { companyId: "CVR-1-44444444", companyName: "Andet Eksempel ApS", kind: "direction" as const, role: "Direktør", from: "2010-01-01", to: "2013-01-01", active: false };
  ds.persons[ID] = { ...person, roles: [...person.roles, other] };
  const spec = composePerson(ID, ds, { focus: "risiko", followUps: false });
  assert.deepEqual(spec.components.map(shape), ["LassoPersonHead", "LassoTimeline[~risiko]"]);
  assert.ok(!spec.components.some((c) => c.type === "LassoPersonRoles"));
  assertNoDuplicates(spec.components);
  assertNoRetired(spec.components, "risiko");
  // Ingen konkurser eller tvangsopløsninger: forløbet står stadig (dets tomme tilstand er svaret).
  ds.persons[ID] = { ...person, roles: person.roles.slice(0, 3) };
  assert.deepEqual(composePerson(ID, ds, { focus: "risiko", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoTimeline[~risiko]"]);
});

test("composePerson historik: historik ½ | nyheder (5) ½; uden nyheder roller over tid ved siden af (Jakob 01.10)", () => {
  const ds = fullDataset();
  assert.deepEqual(composePerson(ID, ds, { focus: "historik", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoTimeline@1/half", "LassoNews@2/half[#5]"]);
  // Ofte har medierne intet skrevet: så står karrieren som roller over tid i stedet for en tom nyhedsliste.
  ds.news[ID] = { lassoId: ID, items: [] };
  const noNews = composePerson(ID, ds, { focus: "historik", followUps: false });
  assert.deepEqual(noNews.components.map(shape), ["LassoPersonHead", "LassoTimeline@1/third", "LassoPersonRoles@2/two-thirds[#8]"]);
  assert.ok(noNews.components.some((c) => c.type === "LassoPersonRoles" && c.title === "Roller over tid"));
  // Kunne nyhederne ikke hentes, står nyhedernes fejltilstand ved siden af.
  ds.errors[`news:${ID}`] = "Lasso API-fejl (500)";
  assert.deepEqual(composePerson(ID, ds, { focus: "historik", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoTimeline@1/half", "LassoNews@2/half[#5]"]);
  // Hverken rolleskift, nyheder eller roller: historikkens tomme tilstand.
  ds.timeline[ID] = { lassoId: ID, events: [] };
  ds.persons[ID] = { ...person, roles: [] };
  delete ds.errors[`news:${ID}`];
  assert.deepEqual(composePerson(ID, ds, { focus: "historik", followUps: false }).components.map(shape), ["LassoPersonHead", "LassoTimeline"]);
});

test("composePerson: op til seks forskellige spørgsmål pr. fokus, aldrig fokusets eget emne, med personens selskab", () => {
  const ds = fullDataset();
  const followUps = (focus: PersonFocus) => {
    const f = composePerson(ID, ds, { focus }).components.find((c) => c.type === "LassoFollowUps");
    return f?.type === "LassoFollowUps" ? f.prompts : [];
  };
  const own: Record<PersonFocus, string> = {
    overblik: "Hvem er Mette?",
    roller: "Hvor sidder Mette i bestyrelser?",
    netvaerk: "Hvem sidder Mette sammen med?",
    ejerskab: "Hvilke selskaber ejer Mette?",
    risiko: "Er der konkurser i historikken?",
    historik: "Hvad er der sket for nylig?",
  };
  for (const focus of PERSON_FOCUSES) {
    const f = followUps(focus);
    assert.ok(f.length >= 4 && f.length <= 6, `${focus}: ${f.length}`);
    assert.equal(new Set(f.map((p) => p.prompt)).size, f.length, `${focus}: ingen dubletter`);
    assert.ok(!f.some((p) => p.label === own[focus]), `${focus} peger ikke på sig selv`);
    assert.ok(f.some((p) => /^Hvordan går det i /.test(p.label)), `${focus}: personens selskab`);
  }
  assert.ok(followUps("overblik").some((p) => p.prompt === "Hvem sidder Mette Holm Eksempel sammen med i selskaber?"));
  // Uden netværk og ejerskab springes de over.
  ds.personNetworks[ID] = { lassoId: ID, people: [] };
  ds.persons[ID] = { ...person, roles: person.roles.filter((r) => r.kind !== "owner") };
  const roller = followUps("roller").map((p) => p.label);
  assert.ok(!roller.includes("Hvem sidder Mette sammen med?") && !roller.includes("Hvilke selskaber ejer Mette?"), roller.join(" | "));
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
  assert.deepEqual(probe(), ["LassoPersonHead", "LassoPersonNetwork", "LassoSummary"]);
  assert.deepEqual(probe("overblik"), probe());
  assert.deepEqual(probe("roller"), ["LassoPersonHead"]);
  assert.deepEqual(probe("netvaerk"), ["LassoPersonHead", "LassoPersonNetwork"]);
  assert.deepEqual(probe("ejerskab"), ["LassoPersonHead", "LassoOwnershipDiagram|0|2|"]);
  assert.deepEqual(probe("risiko"), ["LassoPersonHead", "LassoTimeline"]);
  assert.deepEqual(probe("historik"), ["LassoPersonHead", "LassoTimeline", "LassoNews"]);
  // Nyheder kun på historik, grafen kun på ejerskab (Jakob 01.10: ikke på overblikket).
  for (const focus of PERSON_FOCUSES) {
    assert.equal(probe(focus).includes("LassoNews"), focus === "historik", focus);
    assert.equal(probe(focus).some((t) => t.startsWith("LassoOwnershipDiagram")), focus === "ejerskab", focus);
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

/* ---------- Spørgsmålet styrer formen: personsiden (ask.ts) ---------- */

const personAsk = (q: string) => parseAsk(q, "person", { name: person.name });

test("composePerson spørgsmål: 'sidder X i bestyrelser' giver kun bestyrelsesposterne alene i fuld bredde og konteksten pakket efter bredderne", () => {
  const spec = composePerson(ID, fullDataset(), { ask: personAsk("Sidder Mette Holm Eksempel i bestyrelser?") });
  assert.equal(spec.subtitle, "Bestyrelsesposter");
  assert.deepEqual(spec.components.slice(0, 2).map(shape), ["LassoPersonHead", "LassoPersonRoles[current,#8]"]);
  const roles = spec.components[1]!;
  assert.ok(roles.type === "LassoPersonRoles" && roles.role === "bestyrelse");
  // Konteksten: netværk, historik og nyheder (ingen komponent to gange); netværket i eget fuldbånd.
  const rest = spec.components.slice(2).filter((c) => c.type !== "LassoFollowUps");
  assert.deepEqual(rest.map((c) => c.type).sort(), ["LassoNews", "LassoPersonNetwork", "LassoTimeline"]);
  assertNoRetired(spec.components, "bestyrelser");
  assert.equal(rest.find((c) => c.type === "LassoPersonNetwork")?.column, undefined);
  assertNoDuplicates(spec.components);
  // Udsnittet: kun bestyrelsesroller (én aktiv, én ophørt).
  assert.deepEqual(personRoleRows(personWithRole(person, "bestyrelse"), "current").map((r) => r.companyName), ["Data Eksempel A/S"]);
});

test("composePerson spørgsmål: tidligere poster giver de ophørte, udviklingen giver tidsbåndene", () => {
  const ended = composePerson(ID, fullDataset(), { ask: personAsk("hvilke bestyrelser har Mette tidligere siddet i") }).components[1]!;
  assert.ok(ended.type === "LassoPersonRoles" && ended.show === "ended" && ended.role === "bestyrelse");
  const all = composePerson(ID, fullDataset(), { ask: personAsk("hvordan har Mettes direktørposter udviklet sig") }).components[1]!;
  assert.ok(all.type === "LassoPersonRoles" && all.show === "all" && all.role === "direktion");
  const owner = composePerson(ID, fullDataset(), { ask: personAsk("hvilke selskaber ejer Mette") });
  assert.equal(owner.subtitle, "Ejerskaber");
  assert.ok(owner.components[1]!.type === "LassoPersonRoles" && owner.components[1]!.role === "ejer");
  // Ejerdiagrammet står som kontekst, når de ejede selskaber selv ejer selskaber.
  assert.ok(owner.components.some((c) => c.type === "LassoOwnershipDiagram"));
});

test("composePerson spørgsmål: konkurser giver forløbet i selskaberne som svar i fuld bredde; de ophørte roller uden konkursselskaberne", () => {
  const spec = composePerson(ID, fullDataset(), { ask: personAsk("har Mette været med i konkurser?") });
  assert.deepEqual(spec.components.slice(0, 2).map(shape), ["LassoPersonHead", "LassoTimeline[~risiko]"]);
  const risk = spec.components[1]!;
  assert.ok(risk.type === "LassoTimeline" && risk.title === "Forløb i selskaberne");
  assert.equal(spec.components.filter((c) => c.type === "LassoTimeline").length, 1, "forløbet kun én gang");
  assertNoRetired(spec.components, "konkurser");
  // Ingen andre ophørte roller end konkursselskabet: den liste udelades (tom kontekst), og siden fyldes
  // i stedet med de aktive roller fra den fælles hale.
  assert.ok(!spec.components.some((c) => c.type === "LassoPersonRoles" && c.show === "ended"));
  assert.ok(spec.components.some((c) => c.type === "LassoPersonRoles" && c.show === "current"));
  assertNoDuplicates(spec.components);
});

test("composePerson spørgsmål: netværket som svar; tomme kontekstmoduler udelades", () => {
  const ds = fullDataset();
  ds.news[ID] = { lassoId: ID, items: [] };
  const spec = composePerson(ID, ds, { ask: personAsk("hvem sidder Mette sammen med") });
  assert.equal(spec.subtitle, "Netværk");
  assert.equal(spec.components[1]!.type, "LassoPersonNetwork");
  assert.equal((spec.components[1] as { limit?: number }).limit, 8);
  assert.ok(!spec.components.some((c) => c.type === "LassoNews"));
  // Også uden netværk står svaret (den tomme tilstand er svaret).
  ds.personNetworks[ID] = { lassoId: ID, people: [] };
  assert.equal(composePerson(ID, ds, { ask: personAsk("hvem sidder Mette sammen med") }).components[1]!.type, "LassoPersonNetwork");
});

test("composePerson spørgsmål: bopæl giver de aktive roller (byen står i hovedet) og ejerstrukturen i fuld bredde; rollerne kun én gang", () => {
  const home = composePerson(ID, fullDataset(), { ask: personAsk("hvor bor Mette") });
  assert.equal(home.subtitle, "Bopæl");
  assert.equal(shape(home.components[1]!), "LassoPersonRoles[current,#5]");
  assert.equal(home.components.filter((c) => c.type === "LassoPersonRoles").length, 1, "svaret gentages ikke i konteksten");
  assertNoRetired(home.components, "bopæl");
  const group = composePerson(ID, fullDataset(), { ask: personAsk("hvordan ser Mettes ejerstruktur ud") });
  const diagram = group.components[1]!;
  assert.ok(diagram.type === "LassoOwnershipDiagram" && !diagram.column && ownershipGraphKey(diagram) === GRAPH_KEY);
});

test("composePerson spørgsmål: generelt spørgsmål giver fokus-siden; opfølgningen peger tilbage til hele siden", () => {
  const ds = fullDataset();
  assert.deepEqual(composePerson(ID, ds, { ask: personAsk("hvem er Mette Holm Eksempel") }), composePerson(ID, ds));
  const f = composePerson(ID, ds, { ask: personAsk("sidder Mette i bestyrelser") }).components.find((c) => c.type === "LassoFollowUps");
  assert.ok(f?.type === "LassoFollowUps" && f.prompts[0]!.label === "Vis hele personsiden" && /Hvem er Mette Holm Eksempel\?/.test(f.prompts[0]!.prompt));
});

test("composePersonProbe spørgsmål: henter alt i planen med personsidens ejerdiagram; uden emne som fokus", () => {
  const types = composePersonProbe(ID, undefined, personAsk("hvilke selskaber ejer Mette")).components.map((c) =>
    c.type === "LassoOwnershipDiagram" ? `${c.type}${ownershipGraphKey(c).slice(ID.length)}` : c.type,
  );
  assert.equal(types[0], "LassoPersonHead");
  for (const t of ["LassoPersonNetwork", "LassoTimeline", "LassoNews", "LassoOwnershipDiagram|0|2|"]) assert.ok(types.includes(t), t);
  // Roller, risiko og stamoplysninger afledes af personen: ét opslag (hovedet).
  assert.ok(!types.includes("LassoPersonRoles") && !types.includes("LassoPersonRisk"));
  assert.deepEqual(composePersonProbe(ID, undefined, personAsk("hvem er Mette")), composePersonProbe(ID, "overblik"));
});

test("B4: persontallene (LassoPersonStats) står under hovedet i fuld bredde på overblikket, kun med roller og plads", () => {
  const ds = fullDataset();
  const spec = composePerson(ID, ds, { followUps: false });
  assert.equal(spec.components[1]?.type, "LassoPersonStats");
  assert.equal(spec.components[1]?.column, undefined, "fuld bredde (eget fuldbånd)");
  // Svaret er stadig rollelisten (persontallene er strukturelle, som nøgletalskortene), nu alene i fuld bredde.
  assert.equal(shape(spec.components[2]!), "LassoPersonRoles[current,#5,>roller]");
  // Kun på overblikket.
  for (const focus of ["roller", "netvaerk", "ejerskab", "risiko", "historik"] as const) {
    assert.ok(!composePerson(ID, ds, { focus }).components.some((c) => c.type === "LassoPersonStats"), focus);
  }
  // Uden roller: ingen tal-kort (tre nuller siger intet).
  const none = fullDataset();
  none.persons[ID] = { ...person, roles: [] };
  assert.ok(!composePerson(ID, none).components.some((c) => c.type === "LassoPersonStats"));
  // Stramt budget: tallene koster aldrig en af overblikkets halve eller en kompakt form. Ved 600 px er der
  // kun plads til svaret og netværket (uden stamoplysningerne er siden lavere end før, så grænsen er rykket
  // fra 700 px), så tallene udelades, og siden er den samme som før B4.
  const tight = composePerson(ID, ds, { heightBudget: 600, followUps: false });
  assert.ok(!tight.components.some((c) => c.type === "LassoPersonStats"));
  assert.equal(shape(tight.components[1]!).replace(/@.*?\[/, "["), "LassoPersonRoles[current,#5,>roller]");
  assert.ok(tight.components.some((c) => c.type === "LassoPersonNetwork"), "netværket står i stedet for tallene");
  // Budgettet vælger elementerne (som Papers side regner højden); et større budget viser aldrig færre.
  // B10: den ombrudte side (netværket i eget fuldbånd) kan være højere end budgettet.
  let before = 0;
  for (const budget of [900, 1100, 1300, 5000]) {
    const page = composePerson(ID, ds, { heightBudget: budget, followUps: false });
    assert.ok(page.components.length >= before, `${budget}`);
    before = page.components.length;
  }
  assert.ok(composePerson(ID, ds, { showAll: true, heightBudget: 10 }).components.some((c) => c.type === "LassoPersonStats"));
});

/* ---------- Ø13/B10: personsidernes og spørgsmålssidernes bredder følger reglerne ---------- */

const widthIdx = (w: string) => WIDTHS.indexOf(w as never);

/** Delte bånd som stakke (som LassoView.columnBands: et lavere kolonnenummer starter et nyt bånd). */
function sharedBands(components: readonly ViewComponent[]): ViewComponent[][][] {
  const bands: ViewComponent[][][] = [];
  let last = 0;
  for (const c of components) {
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

/** Intet element under sin indholdsstyrede mindstebredde, ingen smal over ½ ved siden af andre, ingen over max. */
function assertWidths(components: readonly ViewComponent[], ds: Parameters<typeof contentWidthOf>[1], label: string) {
  for (const band of sharedBands(components)) {
    if (band.length < 2) continue;
    for (const c of band.flat()) {
      assert.ok(c.width, `${label}: ${c.type} uden bredde i et delt bånd`);
      assert.ok(widthIdx(c.width!) >= widthIdx(contentWidthOf(c, ds)), `${label}: ${c.type} i ${c.width} under mindstebredden ${contentWidthOf(c, ds)}`);
      assert.ok(widthIdx(c.width!) <= widthIdx(gridRuleOf(c).max), `${label}: ${c.type} i ${c.width} over max`);
      if (widthProfileOf(c).profil === "smal") assert.ok(widthIdx(c.width!) <= widthIdx("half"), `${label}: smal ${c.type} strakt til ${c.width}`);
    }
  }
}

/** Netværk med tre fælles selskaber pr. person og 30-tegns selskabsnavne (ejerens eksempel "Sidder sammen med"). */
function wideNetwork(ds: ReturnType<typeof fullDataset>) {
  const name = (i: number, k: number) => `Eksempel Selskab ${i}${k} Holding A/S`.padEnd(30, "X").slice(0, 30);
  ds.personNetworks[ID] = {
    lassoId: ID,
    people: Array.from({ length: 4 }, (_, i) => ({
      name: `Kollega ${i} Eksempelsen`,
      companies: [0, 1, 2].map((k) => ({ companyName: name(i, k), role: "Bestyrelsesmedlem", from: `${2008 + k}-01-01` })),
      overlapYears: 12 - i,
      active: true,
    })),
  };
  return ds;
}

test("Ø13/B10 (a): personens overblik med 3 fælles selskaber pr. person og 30-tegns navne: netværket står i fuld bredde (eget bånd)", () => {
  const ds = wideNetwork(fullDataset());
  assert.equal(contentWidthOf({ type: "LassoPersonNetwork", person: ID, limit: 3 }, ds), "full");
  for (const opts of [{}, { showAll: true }, { heightBudget: 5000 }] as const) {
    const spec = composePerson(ID, ds, opts);
    const net = spec.components.find((c) => c.type === "LassoPersonNetwork");
    assert.ok(net, JSON.stringify(opts));
    assert.equal(net.column, undefined, "eget fuldbånd");
    assert.ok(!net.width || net.width === "full");
    assertWidths(spec.components, ds, `overblik ${JSON.stringify(opts)}`);
  }
});

test("Ø13/B10 (b): aktive roller (liste) står alene i fuld bredde uden stamoplysninger, også med én rolle og som svar på et spørgsmål", () => {
  const ds = fullDataset();
  const pair = (spec: { components: ViewComponent[] }) => spec.components.filter((c) => c.type === "LassoPersonRoles" || c.type === "LassoPersonFacts").map(shape);
  assert.deepEqual(pair(composePerson(ID, ds)), ["LassoPersonRoles[current,#5,>roller]"]);
  // Én aktiv rolle (kort liste): stadig alene i eget fuldbånd.
  ds.persons[ID] = { ...person, roles: [person.roles[0]!] };
  assert.deepEqual(pair(composePerson(ID, ds, { followUps: false })), ["LassoPersonRoles[current,#5,>roller]"]);
  // Og som svar på et spørgsmål.
  const asked = composePerson(ID, fullDataset(), { ask: personAsk("Sidder Mette Holm Eksempel i bestyrelser?") });
  assert.deepEqual(pair(asked).slice(0, 1), ["LassoPersonRoles[current,#8]"]);
  for (const spec of [composePerson(ID, ds), asked]) {
    assertWidths(spec.components, ds, "roller alene");
    assertNoRetired(spec.components, "roller alene");
  }
});

test("Ø13/B10 (c): 'hvem sidder X sammen med' giver netværket i fuld bredde først; konteksten (roller | historik) deler bånd, ingen stamoplysninger", () => {
  const ds = wideNetwork(fullDataset());
  const spec = composePerson(ID, ds, { ask: personAsk("hvem sidder Mette sammen med") });
  assert.equal(spec.components[1]!.type, "LassoPersonNetwork");
  assert.equal(spec.components[1]!.column, undefined, "eget fuldbånd");
  assertNoRetired(spec.components, "netværk som svar");
  const roles = spec.components.find((c) => c.type === "LassoPersonRoles");
  assert.ok(roles?.column, "rollerne deler bånd med konteksten");
  assertWidths(spec.components, ds, "netværk som svar");
});

test("Ø13/B10 (d): composeAskCompany med et bredt svar-element (nyheder, Statstidende) står aldrig under mindstebredden", () => {
  const cid = "CVR-1-12345678";
  const ds = emptyDataset("demo");
  ds.companies[cid] = { lassoId: cid, cvr: "12345678", name: "TEST HOLDING ApS", status: "Normal", form: "ApS", founded: "2005-01-01" };
  ds.people[cid] = [{ name: "Bo", role: "Direktør", from: "2005-01-01" }];
  ds.ownership[cid] = { lassoId: cid, owners: [{ name: "Bo", kind: "person", share: "100 %" }] };
  ds.news[cid] = { lassoId: cid, items: [1, 2, 3, 4, 5].map((n) => ({ source: "Avis", headline: `Nyhed ${n} om holdingselskabet`, excerpt: "Uddrag af artiklen på to linjer.", time: "2025-04-15" })) };
  ds.timeline[cid] = { lassoId: cid, events: Array.from({ length: 8 }, (_, i) => ({ date: `${2025 - i}-04-15`, title: `Årsrapport ${2025 - i} offentliggjort`, category: "Regnskab" })) };
  ds.companyEvents[cid] = { lassoId: cid, mergers: [], publications: [], announcements: [{ date: "2025-01-10", type: "Indkaldelse af kreditorer", severity: "neutral" }] };
  const q = (text: string) => parseAsk(text, "company", { name: ["TEST HOLDING ApS", "Test Holding"] });
  for (const [text, lead] of [
    ["Hvilke nyheder er der om Test Holding?", "LassoNews"],
    ["Er der noget i Statstidende om Test Holding?", "LassoAnnouncements"],
  ] as const) {
    const spec = composeCompany(cid, ds, { ask: q(text), name: "TEST HOLDING ApS" });
    const first = spec.components.find((c) => c.type !== "LassoCompanyHead" && c.type !== "LassoKeyFigureCards")!;
    assert.equal(first.type, lead, text);
    // Svaret står først, og i et delt bånd aldrig under sin indholdsstyrede mindstebredde (nyheder ¾, Statstidende 1/1).
    if (first.column) assert.ok(widthIdx(first.width!) >= widthIdx(contentWidthOf(first, ds)), `${text}: ${first.width}`);
    assertWidths(spec.components, ds, text);
    // Jakob 01.10: nyhederne står i ½.
    const news = spec.components.find((c) => c.type === "LassoNews");
    if (news?.column) assert.equal(news.width, "half", text);
  }
});

test("16.3 (Jakob 03.10): networkRole, totalPeriodMonths og togetherText", async () => {
  const { networkRole, totalPeriodMonths, togetherText } = await import("./person.js");
  assert.equal(networkRole("Stifter"), null);
  assert.equal(networkRole("revisor"), null);
  assert.equal(networkRole("Ejer"), "Ejer");
  assert.equal(networkRole("Reel ejer"), "Andet");
  assert.equal(networkRole("Bestyrelsesformand"), "Bestyrelse");
  assert.equal(networkRole("Administrerende direktør"), "Direktion");
  assert.equal(networkRole("interessent"), "Andet");
  assert.equal(networkRole(undefined), "Andet");
  // Samme tid i to selskaber tæller én gang; et hul lægges ikke til.
  assert.equal(totalPeriodMonths([{ from: "2010-01-01", to: "2016-01-01" }, { from: "2012-01-01", to: "2014-01-01" }], "2026-01-01"), 72);
  assert.equal(totalPeriodMonths([{ from: "2010-01-01", to: "2011-01-01" }, { from: "2020-01-01", to: "2021-01-01" }], "2026-01-01"), 24);
  assert.equal(totalPeriodMonths([{ from: "2025-06-01" }], "2026-01-01"), 7);
  assert.equal(togetherText(0), "under 1 måned sammen");
  assert.equal(togetherText(1), "1 måned sammen");
  assert.equal(togetherText(7), "7 måneder sammen");
  assert.equal(togetherText(12), "1 år sammen");
  assert.equal(togetherText(17), "1 år sammen");
  assert.equal(togetherText(18), "2 år sammen");
  assert.equal(togetherText(144), "12 år sammen");
});
