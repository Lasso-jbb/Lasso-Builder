import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composePerson,
  composePersonProbe,
  emptyDataset,
  entityRefOf,
  isPersonId,
  longestPeriod,
  longestPeriodYears,
  mergePeriods,
  ownershipGraphKey,
  parseViewSpec,
  PERSON_GRAPH_DEPTH,
  personCompanies,
  personCounts,
  personFacts,
  personRisk,
  personTimeline,
  roleKind,
  widthOf,
  type PersonVM,
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
  assert.deepEqual(spec.components.map((c) => widthOf(c, "dashboard")), ["full", "full", "half", "half"]);
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

/** Et fuldt datasæt: netværk, historik, nyheder og et ejerdiagram med ét ejet selskab. */
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
    ],
    edges: [{ from: ID, to: "CVR-1-22222222", share: [100, 100] }],
    ingoingDepth: 0,
    outgoingDepth: 2,
  };
  return ds;
}

test("composePerson: roller ¾ + stamoplysninger ¼, netværk | risiko, historik | nyheder, ejerdiagram i fuld bredde", () => {
  const spec = composePerson(ID, fullDataset());
  assert.equal(spec.layout, "columns");
  assert.equal(spec.title, "Mette Holm Eksempel");
  assert.deepEqual(spec.components.map(placement), [
    "LassoPersonHead",
    "LassoPersonRoles@1/three-quarters",
    "LassoPersonFacts@2/quarter",
    "LassoPersonNetwork@1",
    "LassoPersonRisk@2",
    "LassoTimeline@1",
    "LassoNews@2",
    "LassoOwnershipDiagram",
    "LassoFollowUps",
  ]);
  const news = spec.components.find((c) => c.type === "LassoNews");
  assert.equal(news?.type === "LassoNews" && news.limit, 3);
  assert.equal(news?.type === "LassoNews" && news.person, ID);
  const diagram = spec.components.find((c) => c.type === "LassoOwnershipDiagram");
  assert.ok(diagram?.type === "LassoOwnershipDiagram" && ownershipGraphKey(diagram) === GRAPH_KEY);
});

test("composePerson: tomme sektioner udelades, og de halve rykker sammen to og to", () => {
  const ds = fullDataset();
  ds.news[ID] = { lassoId: ID, items: [] };
  ds.ownershipGraphs[GRAPH_KEY] = { ...ds.ownershipGraphs[GRAPH_KEY]!, edges: [] };
  ds.personNetworks[ID] = { lassoId: ID, people: [] };
  // Risiko | historik i ét bånd; ingen nyheder, intet netværk og intet diagram.
  assert.deepEqual(composePerson(ID, ds).components.map(placement), [
    "LassoPersonHead",
    "LassoPersonRoles@1/three-quarters",
    "LassoPersonFacts@2/quarter",
    "LassoPersonRisk@1",
    "LassoTimeline@2",
    "LassoFollowUps",
  ]);
  // Et ophørt ejerskab alene giver heller intet diagram.
  ds.ownershipGraphs[GRAPH_KEY] = { ...ds.ownershipGraphs[GRAPH_KEY]!, edges: [{ from: ID, to: "CVR-1-22222222", until: "2020-01-01" }] };
  assert.ok(!composePerson(ID, ds).components.some((c) => c.type === "LassoOwnershipDiagram"));
  // Kunne grafen ikke hentes, men ejer personen selskaber, vises diagrammets fejltilstand.
  delete ds.ownershipGraphs[GRAPH_KEY];
  ds.errors[`graph:${GRAPH_KEY}`] = "Lasso API-fejl (500)";
  assert.ok(composePerson(ID, ds).components.some((c) => c.type === "LassoOwnershipDiagram"));
});

test("composePerson: en halv til overs står i fuld bredde; alvorlig risiko rykker op under hovedet", () => {
  const ds = fullDataset();
  ds.persons[ID] = { ...person, roles: [...person.roles.slice(0, 3), { ...person.roles[3]!, to: undefined, active: true }] };
  ds.timeline[ID] = personTimeline(ds.persons[ID]!, "2026-09-27");
  ds.news[ID] = { lassoId: ID, items: [] };
  assert.deepEqual(composePerson(ID, ds, { followUps: false }).components.map(placement), [
    "LassoPersonHead",
    "LassoPersonRisk",
    "LassoPersonRoles@1/three-quarters",
    "LassoPersonFacts@2/quarter",
    "LassoPersonNetwork@1",
    "LassoTimeline@2",
    "LassoOwnershipDiagram",
  ]);
  // Ét selskab og alvorlig risiko: netværket står under rollerne, historikken alene i fuld bredde.
  ds.persons[ID] = { ...person, roles: [{ ...person.roles[3]!, to: undefined, active: true }] };
  ds.timeline[ID] = personTimeline(ds.persons[ID]!, "2026-09-27");
  delete ds.ownershipGraphs[GRAPH_KEY];
  assert.deepEqual(composePerson(ID, ds, { followUps: false }).components.map(placement), [
    "LassoPersonHead",
    "LassoPersonRisk",
    "LassoPersonRoles@1/three-quarters",
    "LassoPersonNetwork@1/three-quarters",
    "LassoPersonFacts@2/quarter",
    "LassoTimeline",
  ]);
});

test("composePerson: med højst to selskaber står risikoen under rollerne i ¾-kolonnen, så båndet ikke får et hul", () => {
  const ds = fullDataset();
  const one = { ...person, roles: [person.roles[0]!, person.roles[1]!] };
  ds.persons[ID] = one;
  ds.timeline[ID] = personTimeline(one, "2026-09-27");
  assert.deepEqual(composePerson(ID, ds, { followUps: false }).components.map(placement), [
    "LassoPersonHead",
    "LassoPersonRoles@1/three-quarters",
    "LassoPersonRisk@1/three-quarters",
    "LassoPersonFacts@2/quarter",
    "LassoPersonNetwork@1",
    "LassoTimeline@2",
    "LassoNews",
    "LassoOwnershipDiagram",
  ]);
});

test("composePerson uden persondata viser kun hovedet (som viser fejlen)", () => {
  const ds = emptyDataset("live");
  ds.errors[`person:${ID}`] = "Ikke fundet hos Lasso";
  assert.deepEqual(composePerson(ID, ds).components.map((c) => c.type), ["LassoPersonHead"]);
  assert.deepEqual(composePersonProbe(ID).components.map((c) => c.type), ["LassoPersonHead", "LassoPersonNetwork", "LassoTimeline", "LassoNews", "LassoOwnershipDiagram"]);
});

test("tidslinje, nyheder og ejerdiagram tager company ELLER person, præcis én", () => {
  for (const type of ["LassoTimeline", "LassoNews", "LassoOwnershipDiagram"]) {
    assert.doesNotThrow(() => parseViewSpec({ title: "x", components: [{ type, person: ID }] }), type);
    assert.doesNotThrow(() => parseViewSpec({ title: "x", components: [{ type, company: "12345678" }] }), type);
    assert.throws(() => parseViewSpec({ title: "x", components: [{ type }] }), /præcis én/, type);
    assert.throws(() => parseViewSpec({ title: "x", components: [{ type, company: "12345678", person: ID }] }), /præcis én/, type);
  }
  const spec = parseViewSpec({ title: "x", components: [{ type: "LassoPersonFacts", person: ID }, { type: "LassoNews", person: ID }] });
  assert.equal(widthOf(spec.components[0]!, "dashboard"), "quarter");
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
