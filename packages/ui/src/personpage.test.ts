import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composePerson, emptyDataset, ownershipGraphKey, parseViewSpec, PERSON_GRAPH_DEPTH, personTimeline, type Dataset, type PersonVM, type ViewSpec } from "@lasso/spec";
import { PersonFacts } from "./components/PersonFacts.js";
import { PersonNetwork } from "./components/PersonNetwork.js";
import { PersonRoles } from "./components/PersonRoles.js";
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
  assert.doesNotMatch(html, /Kilde:/, "G3: ingen kildelinje");
  assert.doesNotMatch(html, />0</, "aldrig et nul, kun 'Ingen'");
});

test("PersonFacts: adressebeskyttet, tom tilstand der siger hvorfor, henter og fejl", () => {
  const hidden = facts({ ...bo, addressProtected: true, city: undefined, zip: undefined, municipality: undefined });
  assert.match(hidden, /Adressebeskyttet/);
  assert.doesNotMatch(hidden, /Kommune/);
  assert.match(facts({ lassoId: ID, name: "Tom", roles: [] }), /hverken en bopæl eller roller/);
  assert.match(facts(undefined), /aria-busy="true"/);
  assert.match(facts(undefined, "Lasso API-fejl (500)"), /Data kunne ikke hentes/);
  // Uden bopæl, men med roller: "-" i stedet for en tom række.
  assert.match(facts({ ...bo, city: undefined, zip: undefined, municipality: undefined }), /Bopæl.*-/);
});

test("columnBands: et lavere kolonnenummer starter et nyt bånd, og bredderne giver båndets forhold", () => {
  const spec = composePerson(ID, dataset(), { followUps: false });
  const bands = columnBands(spec.components);
  assert.deepEqual(
    bands.map((b) => (b.kind === "full" ? b.item.c.type : b.columns.map((col) => col.map((x) => x.c.type).join("+")).join(" | "))),
    // Overblikket: roller | stamoplysninger, derefter de halve to og to efter vægt (de mest lige bånd).
    ["LassoPersonHead", "LassoPersonRoles | LassoPersonFacts", "LassoPersonNetwork | LassoOwnershipDiagram", "LassoPersonRisk | LassoTimeline"],
  );
  const [, rolesBand, netBand] = bands;
  assert.equal(rolesBand?.kind === "columns" && bandTemplate(rolesBand.columns), "minmax(0, 9fr) minmax(0, 3fr)");
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

test("personsiden, overblik: aktive roller som liste ¾ + stamoplysninger ¼ (uden hovedets tal), historik (3) og ejerdiagram, ingen nyheder", () => {
  const spec = composePerson(ID, dataset(), { followUps: false });
  const html = render(spec, dataset(), { drillDown: true });
  assert.match(html, /lasso-columns--ratio lasso-band" style="--lasso-columns-template:minmax\(0, 9fr\) minmax\(0, 3fr\)"/);
  // Aktive roller: én række pr. selskab med rollerne under og "siden" til højre; navnet kan åbnes.
  assert.match(html, /class="lasso-section__title">Aktive roller</);
  assert.match(html, /<button type="button" class="lasso-link lasso-row__open">Eksempel Holding ApS<\/button><\/div><div class="lasso-row__sub">Direktør, ejer 100 %<\/div><\/div><div class="lasso-row__side">siden 2005</);
  assert.doesNotMatch(html, /Eksempel Energi A\/S<\/button><\/div><div class="lasso-row__sub">/, "ophørte roller står ikke på listen over aktive");
  // Stamoplysningerne gentager ikke hovedets tal (roller, ejerskaber, første registrering).
  assert.match(html, /Stamoplysninger/);
  assert.match(html, /Enhedsnummer/);
  assert.doesNotMatch(html, /lasso-kv-row__label">Aktive roller|lasso-kv-row__label">Ejer af|lasso-kv-row__label">Første registrering/);
  assert.doesNotMatch(html, /første registrering 2005/, "16.1: hovedet viser kun navnet (G9)");
  // Historik: nyeste først (konkursen), selskabsnavnet som knap, 3 + "Se alle".
  assert.match(html, /<button type="button" class="lasso-link lasso-timeline__entity">Eksempel Energi A\/S<\/button><span> kom under konkurs<\/span>/);
  assert.match(html, /Se alle 6 begivenheder/);
  // Ingen nyheder på overblikket.
  assert.doesNotMatch(html, /Carla Prøve indtræder i bestyrelsen/);
  // Ejerdiagram med personen som rod: ingen retningsvalg (en person har ingen ejere); 14.1: legenden
  // forklarer ikke fokus, virksomhed eller person.
  assert.match(html, /Ejerskab/);
  assert.doesNotMatch(html, /Fokusperson/);
  assert.doesNotMatch(html, /Kun ejere/);
  assert.match(html, /aria-label="Eksempel Holding ApS, CVR 99000010/);
  assert.match(html, /100 %/);
});

test("personsiden, historik: historik (5) og nyheder om personen side om side", () => {
  const spec = composePerson(ID, dataset(), { focus: "historik", followUps: false });
  const html = render(spec, dataset(), { drillDown: true });
  assert.match(html, /Udtrådt som bestyrelsesmedlem i /);
  assert.match(html, /Se alle 6 begivenheder/);
  assert.match(html, /Nyheder/);
  assert.match(html, /Carla Prøve indtræder i bestyrelsen/);
  assert.doesNotMatch(html, /Stamoplysninger|Aktive roller|Fokusperson/);
});

test("personsiden, risiko: alle sager og forløbet i konkursselskabet; ingen andre selskaber i forløbet", () => {
  const spec = composePerson(ID, dataset(), { focus: "risiko", followUps: false });
  const html = render(spec, dataset(), { drillDown: true });
  assert.match(html, /class="lasso-section__title">Risiko</);
  assert.match(html, /class="lasso-section__title">Forløb i selskaberne</);
  assert.match(html, /Indtrådt som bestyrelsesmedlem i /);
  assert.doesNotMatch(html, /Eksempel Holding ApS|Eksempel Byg A\/S/, "kun selskabet med konkurs");
  // Bo har ingen andre ophørte roller: ingen ophørt-liste ved siden af.
  assert.doesNotMatch(html, /Øvrige ophørte roller/);
});

test("personsiden, ejerskab: de ejede selskaber med andel og siden-dato, og ejerstrukturen", () => {
  const spec = composePerson(ID, dataset(), { focus: "ejerskab", followUps: false });
  const html = render(spec, dataset(), {});
  assert.match(html, /class="lasso-section__title">Ejerskaber</);
  assert.match(html, /class="lasso-row__name">Eksempel Holding ApS<\/div><div class="lasso-row__sub">Ejer 100 %<\/div><\/div><div class="lasso-row__side">siden 2005</);
  assert.match(html, /Ejerstruktur/);
  assert.doesNotMatch(html, /Bestyrelsesformand/, "kun ejerskaber, ikke ledelsesroller");
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

/* ---------- LassoPersonRoles show/limit, LassoPersonNetwork limit, LassoTimeline filter ---------- */

const roles = (props: Partial<Parameters<typeof PersonRoles>[0]>) => renderToStaticMarkup(createElement(PersonRoles, { person: bo, ...props }));

test("PersonRoles show 'current': de aktive roller pr. selskab, limit + 'Se alle N selskaber', kildelinje", () => {
  const html = roles({ show: "current" });
  assert.match(html, /class="lasso-section__title">Aktive roller</);
  assert.equal((html.match(/<li class="lasso-row"/g) ?? []).length, 2);
  assert.match(html, /Eksempel Byg A\/S<\/div><div class="lasso-row__sub">Bestyrelsesformand<\/div><\/div><div class="lasso-row__side">siden 2012</);
  assert.doesNotMatch(html, /Eksempel Energi/);
  assert.doesNotMatch(html, /Se alle/);
  assert.doesNotMatch(html, /Kilde:/, "G3: ingen kildelinje");
  // limit 1: én række + "Se alle 2 selskaber".
  const one = roles({ show: "current", limit: 1 });
  assert.equal((one.match(/<li class="lasso-row"/g) ?? []).length, 1);
  assert.match(one, /aria-expanded="false"[^>]*>Se alle 2 selskaber</);
  // Ingen tidsbånd i listeformen.
  assert.doesNotMatch(html, /lasso-personroles__band/);
});

test("PersonRoles show 'ended' og 'owner': ophørte med status i rødt med ord, ejede med andel; tomme tilstande siger hvorfor", () => {
  const ended = roles({ show: "ended" });
  assert.match(ended, /class="lasso-section__title">Ophørte roller</);
  assert.match(ended, /<span class="lasso-status--warning">Under konkurs 2026, <\/span>bestyrelsesmedlem<\/div><\/div><div class="lasso-row__side">2014–2018</);
  assert.doesNotMatch(ended, /Eksempel Holding ApS/);
  assert.match(roles({ show: "ended", except: "risiko" }), /Personen har ingen andre ophørte roller i CVR\./);
  const owner = roles({ show: "owner" });
  assert.match(owner, /class="lasso-section__title">Ejerskaber</);
  assert.match(owner, /Eksempel Holding ApS<\/div><div class="lasso-row__sub">Ejer 100 %</);
  assert.doesNotMatch(owner, /Direktør/);
  const none = { ...bo, roles: bo.roles.filter((r) => r.kind !== "owner") };
  assert.match(roles({ show: "owner", person: none }), /Personen ejer ikke selskaber i CVR\./);
  assert.match(roles({ show: "current", person: { ...bo, roles: [bo.roles[3]!] } }), /Personen har ingen aktive roller i selskaber i CVR\./);
  assert.match(roles({ show: "owner", person: undefined }), /aria-busy="true"/);
});

test("PersonRoles show 'all' (tidsbånd): limit bestemmer, hvor mange selskaber der står før 'Se alle N'", () => {
  // Bo har tre selskaber: standard (3) viser alle, limit 2 folder det sidste.
  assert.equal((roles({}).match(/<li class="lasso-personroles__row/g) ?? []).length, 3);
  assert.doesNotMatch(roles({}), /Se alle/);
  const two = roles({ limit: 2 });
  assert.equal((two.match(/<li class="lasso-personroles__row/g) ?? []).length, 2);
  assert.match(two, /aria-expanded="false"[^>]*>Se alle 3 selskaber</);
});

test("PersonNetwork (16.3): tidsbånd pr. fælles selskab, limit 3 som standard + 'Vis alle N', ingen 'Vis som graf'", () => {
  const people = Array.from({ length: 10 }, (_, i) => ({ name: `Person ${i} Eksempel`, companies: [{ companyName: "Eksempel Byg A/S", role: "bestyrelse", from: "2012-01-01" }], overlapYears: 10 - i, active: true }));
  const net = (limit?: number) => renderToStaticMarkup(createElement(PersonNetwork, { network: { lassoId: ID, people }, limit, onGraph: () => {} }));
  const desk = (h: string) => (h.split("lasso-personnet__mob")[0]!.match(/<li class="lasso-personroles__row lasso-personnet__brow/g) ?? []).length;
  assert.equal(desk(net()), 3);
  assert.match(net(), /Vis alle 10/);
  assert.equal(desk(net(8)), 8);
  assert.match(net(), /lasso-personnet__band"/);
  assert.match(net(), /Eksempel Byg A\/S, bestyrelse, siden 2012/);
  assert.doesNotMatch(net(), /Vis som graf/);
  // Afsluttet = stiplet bånd; konkurs (runde 6) = rødt bånd og ", under konkurs" sidst i etiketten; ingen markør.
  const ended = renderToStaticMarkup(createElement(PersonNetwork, { network: { lassoId: ID, people: [{ name: "Peter Eksempel", overlapYears: 4, active: false, companies: [{ companyName: "Eksempel Energi A/S", role: "direktør", from: "2014-01-01", to: "2018-01-01", status: "Under konkurs", statusKind: "warning" }] }] } }));
  assert.match(ended, /lasso-personnet__band lasso-personnet__band--ended lasso-personnet__band--problem/);
  assert.doesNotMatch(ended, /lasso-personnet__marker/);
  assert.match(ended, /Eksempel Energi A\/S, direktør, 2014–2018<\/span><span class="lasso-personnet__label--short">Eksempel Energi A\/S, direktør<\/span><span class="lasso-personnet__bandstatus">, under konkurs<\/span>/);
  assert.match(ended, /lasso-personnet__swatch--bankrupt"><\/span>Under konkurs</);
  // Løbende rolle i et selskab under konkurs: fyldt rødt bånd (ikke stiplet).
  const running = renderToStaticMarkup(createElement(PersonNetwork, { network: { lassoId: ID, people: [{ name: "Peter Eksempel", overlapYears: 4, active: true, companies: [{ companyName: "Eksempel Energi A/S", role: "direktør", from: "2014-01-01", status: "Under konkurs", statusKind: "warning" }] }] } }));
  assert.match(running, /class="lasso-personnet__band lasso-personnet__band--problem"/);
  // Uden problemstatus: intet rødt og ingen "Under konkurs" i legenden.
  assert.doesNotMatch(net(), /band--problem|Under konkurs/);
  assert.match(ended, /1 fælles selskab, afsluttet/);
  assert.match(ended, />tidligere</);
});

test("LassoView: tidslinjen med filter 'risiko' viser kun forløbet i selskaberne med konkurs", () => {
  const spec = parseViewSpec({ kind: "person", title: "Bo", components: [{ type: "LassoTimeline", person: ID, filter: "risiko", title: "Forløb i selskaberne" }] });
  const html = render(spec, dataset());
  assert.match(html, /Forløb i selskaberne/);
  assert.match(html, /kom under konkurs/);
  assert.match(html, /Udtrådt som bestyrelsesmedlem i /);
  assert.doesNotMatch(html, /Eksempel Holding ApS|Eksempel Byg A\/S/);
  // Uden sager: den tomme tilstand siger hvorfor.
  const ds = dataset();
  ds.persons[ID] = { ...bo, roles: bo.roles.slice(0, 3) };
  assert.match(render(spec, ds), /Ingen registrerede rolleskift i selskaberne med konkurs eller tvangsopløsning\./);
  // Spec'en afviser et ukendt filter.
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoTimeline", person: ID, filter: "alt" }] }));
});
