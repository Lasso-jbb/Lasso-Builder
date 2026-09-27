import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composePerson, emptyDataset, ownershipGraphKey, parseViewSpec, PERSON_GRAPH_DEPTH, personTimeline, type Dataset, type PersonVM, type ViewSpec } from "@lasso/spec";
import { PersonFacts } from "./components/PersonFacts.js";
import { bandTemplate, columnBands, LassoView } from "./LassoView.js";
import type { HostCapabilities } from "./types.js";

// Demoformede data (som apps/server/src/data/demoPeople.ts): Bo Eksempel med roller, ejerskab og en konkurs.
const ID = "CVR-3-4000000002";
const bo: PersonVM = {
  lassoId: ID,
  name: "Bo Eksempel",
  city: "Silkeborg",
  zip: "8600",
  municipality: "Silkeborg",
  unitNumber: "4000000002",
  updated: "2026-09-12",
  roles: [
    { companyId: "CVR-1-99000010", companyName: "Eksempel Holding ApS", kind: "direction", role: "Direktør", from: "2005-01-01", active: true },
    { companyId: "CVR-1-99000010", companyName: "Eksempel Holding ApS", kind: "owner", role: "Ejer", share: "100 %", from: "2005-01-01", active: true },
    { companyId: "CVR-1-99000001", companyName: "Eksempel Byg A/S", kind: "board", role: "Bestyrelsesformand", from: "2012-05-01", active: true },
    {
      companyId: "CVR-1-99000011",
      companyName: "Eksempel Energi A/S",
      kind: "board",
      role: "Bestyrelsesmedlem",
      from: "2014-03-01",
      to: "2018-06-30",
      active: false,
      companyStatus: "Under konkurs",
      companyStatusKind: "warning",
      companyEnded: "2026-02-02",
    },
  ],
};
const GRAPH_KEY = ownershipGraphKey({ person: ID, ...PERSON_GRAPH_DEPTH });

function dataset(): Dataset {
  const ds = emptyDataset("demo");
  ds.persons[ID] = bo;
  ds.personNetworks[ID] = { lassoId: ID, people: [{ lassoId: "CVR-3-4000000001", name: "Anne Eksempel", companies: [{ companyId: "CVR-1-99000001", companyName: "Eksempel Byg A/S", role: "direktør", from: "2015-01-01" }], overlapYears: 12, since: "2015-01-01", active: true }] };
  ds.timeline[ID] = personTimeline(bo, "2026-09-27");
  ds.news[ID] = {
    lassoId: ID,
    items: [{ source: "Lasso", time: "2024-03-15T07:00:00Z", headline: "Carla Prøve indtræder i bestyrelsen for Eksempel Byg A/S (eksempel)", typeLabel: "Bestyrelsesændring" }],
    sources: ["Lasso News"],
  };
  ds.ownershipGraphs[GRAPH_KEY] = {
    rootId: ID,
    nodes: [
      { id: ID, name: "Bo Eksempel", kind: "person", root: true },
      { id: "CVR-1-99000010", name: "Eksempel Holding ApS", kind: "company", cvr: "99000010", form: "ApS", status: "Aktiv", statusKind: "active" },
      { id: "CVR-1-99000004", name: "Eksempel Transport A/S", kind: "company", cvr: "99000004", form: "A/S", status: "Aktiv", statusKind: "active" },
    ],
    edges: [
      { from: ID, to: "CVR-1-99000010", share: [100, 100], since: "2005-01-01" },
      { from: "CVR-1-99000010", to: "CVR-1-99000004", share: [100, 100] },
    ],
    ingoingDepth: 0,
    outgoingDepth: 2,
    fetchedAt: "2026-09-27T10:00:00Z",
  };
  return ds;
}

const noop = () => undefined;
const render = (spec: ViewSpec, ds: Dataset, host: HostCapabilities = {}) => renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host, onAction: noop }));
const facts = (person?: PersonVM, error?: string) => renderToStaticMarkup(createElement(PersonFacts, { person, error }));

test("PersonFacts: bopæl som postnummer og by, kommune, enhedsnummer og tal afledt af rollerne", () => {
  const html = facts(bo);
  assert.match(html, /Stamoplysninger/);
  assert.match(html, /8600 Silkeborg/);
  // Kommunen gentager byen og udelades; en anden kommune end byen vises.
  assert.doesNotMatch(html, /Kommune/);
  assert.match(facts({ ...bo, city: "Vinderup", zip: "7830", municipality: "Holstebro" }), /Kommune.*Holstebro/);
  assert.match(html, /Enhedsnummer.*4000000002/);
  assert.match(html, /3 i 2 selskaber/);
  assert.match(html, /Ejer af.*1 selskab</);
  assert.match(html, /Første registrering.*2005/);
  assert.match(html, /Seneste ændring.*30\.06\.2018/);
  assert.match(html, /Kilde: CVR via Lasso, opdateret 12\.09\.2026/);
  assert.doesNotMatch(html, />0</, "aldrig et nul, kun 'Ingen'");
});

test("PersonFacts: adressebeskyttet, tom tilstand der siger hvorfor, henter og fejl", () => {
  const hidden = facts({ ...bo, addressProtected: true, city: undefined, zip: undefined, municipality: undefined });
  assert.match(hidden, /Adressebeskyttet/);
  assert.doesNotMatch(hidden, /Kommune/);
  assert.match(facts({ lassoId: ID, name: "Tom", roles: [] }), /hverken en bopæl eller roller/);
  assert.match(facts(undefined), /aria-busy="true"/);
  assert.match(facts(undefined, "Lasso API-fejl (500)"), /Data kunne ikke hentes/);
  // Uden bopæl, men med roller: "—" i stedet for en tom række.
  assert.match(facts({ ...bo, city: undefined, zip: undefined, municipality: undefined }), /Bopæl.*—/);
});

test("columnBands: et lavere kolonnenummer starter et nyt bånd, og bredderne giver båndets forhold", () => {
  const spec = composePerson(ID, dataset(), { followUps: false });
  const bands = columnBands(spec.components);
  assert.deepEqual(
    bands.map((b) => (b.kind === "full" ? b.item.c.type : b.columns.map((col) => col.map((x) => x.c.type).join("+")).join(" | "))),
    ["LassoPersonHead", "LassoPersonRoles | LassoPersonFacts", "LassoPersonNetwork | LassoPersonRisk", "LassoTimeline | LassoNews", "LassoOwnershipDiagram"],
  );
  const [, rolesBand, netBand] = bands;
  assert.equal(rolesBand?.kind === "columns" && bandTemplate(rolesBand.columns), "minmax(0, 3fr) minmax(0, 1fr)");
  assert.equal(netBand?.kind === "columns" && bandTemplate(netBand.columns), undefined);
  // Virksomhedssidens kolonner (stigende kolonnenumre uden bredder) er stadig ét bånd.
  const company = parseViewSpec({
    kind: "company",
    title: "x",
    layout: "columns",
    components: [
      { type: "LassoCompanyHead", company: "CVR-1-1" },
      { type: "LassoRelations", company: "CVR-1-1", column: 1 },
      { type: "LassoNews", company: "CVR-1-1", column: 1 },
      { type: "LassoTextSections", company: "CVR-1-1", column: 2 },
      { type: "LassoContact", company: "CVR-1-1", column: 3 },
    ],
  });
  assert.deepEqual(columnBands(company.components).map((b) => b.kind), ["full", "columns"]);
});

test("personsiden: roller ¾ + stamoplysninger ¼ i ét bånd, historik med selskaber, der kan åbnes, nyheder og ejerdiagram", () => {
  const spec = composePerson(ID, dataset(), { followUps: false });
  const html = render(spec, dataset(), { drillDown: true });
  assert.match(html, /lasso-columns--ratio" style="--lasso-columns-template:minmax\(0, 3fr\) minmax\(0, 1fr\)"/);
  // Historik: nyeste først (konkursen), selskabsnavnet som knap.
  assert.match(html, /Historik/);
  assert.match(html, /<button type="button" class="lasso-link lasso-timeline__entity">Eksempel Energi A\/S<\/button><span> kom under konkurs<\/span>/);
  assert.match(html, /Udtrådt som bestyrelsesmedlem i /);
  // Nyheder om personen.
  assert.match(html, /Nyheder/);
  assert.match(html, /Carla Prøve indtræder i bestyrelsen/);
  // Ejerdiagram med personen som rod: "Fokusperson", ingen retningsvalg (en person har ingen ejere).
  assert.match(html, /Ejerskab/);
  assert.match(html, /Fokusperson/);
  assert.doesNotMatch(html, /Kun ejere/);
  assert.match(html, /aria-label="Eksempel Holding ApS, CVR 99000010/);
  assert.match(html, /100 %/);
});

test("personsiden uden drill-down: selskabsnavnene i historikken er almindelig tekst", () => {
  const spec = composePerson(ID, dataset(), { followUps: false });
  const html = render(spec, dataset(), {});
  assert.doesNotMatch(html, /lasso-timeline__entity/);
  assert.match(html, /<span>Eksempel Energi A\/S<\/span><span> kom under konkurs<\/span>/);
});

test("nyheder og historik om en person har egne tomme tilstande", () => {
  const ds = dataset();
  ds.news[ID] = { lassoId: ID, items: [] };
  ds.timeline[ID] = { lassoId: ID, events: [] };
  const spec = parseViewSpec({
    kind: "person",
    title: "Bo",
    components: [
      { type: "LassoNews", person: ID },
      { type: "LassoTimeline", person: ID },
    ],
  });
  const html = render(spec, ds);
  assert.match(html, /Ingen nyheder om personen\./);
  assert.match(html, /Der er ingen registrerede rolleskift for personen i CVR\./);
  assert.doesNotMatch(html, /om virksomheden/);
});
