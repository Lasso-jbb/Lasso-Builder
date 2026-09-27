import assert from "node:assert/strict";
import { test } from "node:test";
import { dataKey, formatRoute, portalRoute, sameRoute, type PortalRoute } from "./routes.js";
import { closeTab, initialTabs, newSearch, openRoute, parseTabs, serializeTabs, setLabel, updateRoute, EMPTY_TABS, type TabsState } from "./tabs.js";

/* ---------- Ruter (docs/portal.md) ---------- */

test("portalRoute: de fire ruter", () => {
  assert.deepEqual(portalRoute("#/search?q=revisorer%20i%20Aarhus"), { kind: "search", q: "revisorer i Aarhus" });
  assert.deepEqual(portalRoute("#/search?q=revisorer+i+Aarhus"), { kind: "search", q: "revisorer i Aarhus" });
  assert.deepEqual(portalRoute("#/search"), { kind: "search", q: "" });
  assert.deepEqual(portalRoute("#/company/CVR-1-34580820?focus=oekonomi"), { kind: "company", id: "CVR-1-34580820", focus: "oekonomi" });
  assert.deepEqual(portalRoute("#/person/CVR-3-4000123"), { kind: "person", id: "CVR-3-4000123", focus: "overblik" });
  assert.deepEqual(portalRoute("#/saved"), { kind: "saved" });
});

test("portalRoute: person med personfokus; uden, ukendt eller et virksomhedsfokus giver overblik", () => {
  assert.deepEqual(portalRoute("#/person/CVR-3-4000123?focus=risiko"), { kind: "person", id: "CVR-3-4000123", focus: "risiko" });
  assert.deepEqual(portalRoute("#/person/CVR-3-4000123?focus=netvaerk"), { kind: "person", id: "CVR-3-4000123", focus: "netvaerk" });
  assert.deepEqual(portalRoute("#/person/CVR-3-4000123?focus=oekonomi"), { kind: "person", id: "CVR-3-4000123", focus: "overblik" });
  assert.deepEqual(portalRoute("#/person/Bo%20Eksempel?focus=salg"), { kind: "person", id: "Bo Eksempel", focus: "overblik" });
  // Og omvendt: et personfokus er ikke et virksomhedsfokus.
  assert.deepEqual(portalRoute("#/company/CVR-1-34580820?focus=roller"), { kind: "company", id: "CVR-1-34580820", focus: "overblik" });
});

test("portalRoute: virksomhed uden eller med ukendt fokus får overblik", () => {
  assert.deepEqual(portalRoute("#/company/CVR-1-34580820"), { kind: "company", id: "CVR-1-34580820", focus: "overblik" });
  assert.deepEqual(portalRoute("#/company/CVR-1-34580820?focus=salg"), { kind: "company", id: "CVR-1-34580820", focus: "overblik" });
  // Navne og CVR-numre sendes videre til serveren som de er (afkodet)
  assert.deepEqual(portalRoute("#/company/Eksempel%20Byg%20A%2FS"), { kind: "company", id: "Eksempel Byg A/S", focus: "overblik" });
});

test("portalRoute: ukendt eller tom hash er en ny søgning", () => {
  for (const hash of ["", "#", "#/", "#/ukendt", "#/company", "#/company/", "#/person/", "noget", "#/%E0%A4%A"]) {
    assert.deepEqual(portalRoute(hash), { kind: "search", q: "" }, hash);
  }
});

test("formatRoute: modsat portalRoute, og tur-retur giver samme rute", () => {
  const routes: PortalRoute[] = [
    { kind: "search", q: "" },
    { kind: "search", q: "revisorer i Aarhus med mindst 10 ansatte" },
    { kind: "search", q: "æøå & ?#/" },
    { kind: "company", id: "CVR-1-34580820", focus: "overblik" },
    { kind: "company", id: "CVR-1-34580820", focus: "kontakt" },
    { kind: "person", id: "CVR-3-4000123", focus: "overblik" },
    { kind: "saved" },
    { kind: "person", id: "CVR-3-4000123", focus: "roller" },
  ];
  assert.equal(formatRoute(routes[0]!), "#/search");
  assert.equal(formatRoute(routes[1]!), "#/search?q=revisorer%20i%20Aarhus%20med%20mindst%2010%20ansatte");
  assert.equal(formatRoute(routes[3]!), "#/company/CVR-1-34580820?focus=overblik");
  // Personens standardfokus står ikke i adressen (ældre links er de samme); de øvrige gør.
  assert.equal(formatRoute(routes[5]!), "#/person/CVR-3-4000123");
  assert.equal(formatRoute(routes[6]!), "#/saved");
  assert.equal(formatRoute(routes[7]!), "#/person/CVR-3-4000123?focus=roller");
  for (const r of routes) assert.deepEqual(portalRoute(formatRoute(r)), r);
  assert.ok(sameRoute(portalRoute("#/search?q=a+b"), { kind: "search", q: "a b" }));
  assert.notEqual(dataKey(routes[3]!), dataKey(routes[4]!), "nyt fokus = nye data");
  assert.notEqual(dataKey(routes[5]!), dataKey(routes[7]!), "nyt personfokus = nye data");
});

/* ---------- Faner ---------- */

function ids() {
  let n = 0;
  return () => `t${++n}`;
}

const company = (id: string, focus: "overblik" | "oekonomi" = "overblik"): PortalRoute => ({ kind: "company", id, focus });

test("openRoute: samme virksomhed åbnes kun én gang; skinne/drill-down beholder fokus, adressen sætter det", () => {
  const id = ids();
  let s = newSearch(EMPTY_TABS, id);
  s = openRoute(s, company("CVR-1-1", "oekonomi"), id, { label: "Eksempel A/S" });
  assert.equal(s.tabs.length, 2);
  assert.equal(s.active, "t2");
  assert.equal(s.tabs[1]!.label, "Eksempel A/S");
  s = openRoute(s, { kind: "search", q: "" }, id);
  assert.equal(s.active, "t1");
  s = openRoute(s, company("CVR-1-1"), id, { keepFocus: true });
  assert.equal(s.tabs.length, 2);
  assert.deepEqual(s.tabs[1]!.route, company("CVR-1-1", "oekonomi"));
  s = openRoute(s, company("CVR-1-1"), id, { fromHistory: true });
  assert.deepEqual(s.tabs[1]!.route, company("CVR-1-1"));
  // Uændret rute og aktiv fane: samme tilstand (ingen ny historik)
  assert.equal(openRoute(s, company("CVR-1-1"), id), s);
});

test("openRoute: en åben person beholder sit fokus ved drill-down; adressen sætter det", () => {
  const id = ids();
  const person = (focus: "overblik" | "risiko" = "overblik"): PortalRoute => ({ kind: "person", id: "CVR-3-9", focus });
  let s = openRoute(newSearch(EMPTY_TABS, id), person("risiko"), id, { label: "Bo Eksempel" });
  s = openRoute(s, { kind: "search", q: "" }, id);
  s = openRoute(s, person(), id, { keepFocus: true });
  assert.equal(s.tabs.length, 2);
  assert.deepEqual(s.tabs[1]!.route, person("risiko"));
  s = openRoute(s, person(), id, { fromHistory: true });
  assert.deepEqual(s.tabs[1]!.route, person());
  assert.equal(s.tabs[1]!.label, "Bo Eksempel");
});

test("Søgefaner: '+' genbruger en tom søgning, ny søgetekst skifter navn, tilbage genbruger den aktive søgefane", () => {
  const id = ids();
  let s = newSearch(EMPTY_TABS, id);
  assert.equal(newSearch(s, id), s);
  s = updateRoute(s, "t1", { kind: "search", q: "revisorer" });
  assert.equal(s.tabs[0]!.label, "revisorer");
  s = newSearch(s, id);
  assert.equal(s.tabs.length, 2);
  assert.equal(s.tabs[1]!.label, "Søgning");
  s = openRoute(s, { kind: "search", q: "advokater" }, id, { fromHistory: true });
  assert.equal(s.tabs.length, 2);
  assert.equal(s.active, "t2");
  assert.equal(s.tabs[1]!.label, "advokater");
  // Søge- og gemte-faner beholder deres faste navn
  assert.equal(setLabel(s, "t2", "Noget andet"), s);
});

test("closeTab: naboen til højre bliver aktiv, og den sidste fane kan ikke lukkes", () => {
  const id = ids();
  let s: TabsState = newSearch(EMPTY_TABS, id);
  s = openRoute(s, company("CVR-1-1"), id);
  s = openRoute(s, { kind: "saved" }, id);
  s = openRoute(s, company("CVR-1-1"), id);
  s = closeTab(s, "t2");
  assert.deepEqual(s.tabs.map((t) => t.id), ["t1", "t3"]);
  assert.equal(s.active, "t3");
  s = closeTab(s, "t3");
  assert.equal(s.active, "t1");
  assert.equal(closeTab(s, "t1"), s);
});

test("sessionStorage: fanerne gemmes som hash og navn; ødelagt indhold ignoreres", () => {
  const id = ids();
  let s = newSearch(EMPTY_TABS, id);
  s = openRoute(s, company("CVR-1-1", "oekonomi"), id, { label: "Eksempel A/S" });
  s = openRoute(s, { kind: "person", id: "CVR-3-9", focus: "netvaerk" }, id, { label: "Anne Eksempel" });
  const back = parseTabs(serializeTabs(s));
  assert.deepEqual(back, s);
  for (const bad of [null, "", "{", "[]", '{"v":1,"tabs":[]}', '{"v":2,"tabs":[{"id":"a","hash":"#/saved"}]}']) assert.equal(parseTabs(bad), null, String(bad));
  assert.deepEqual(parseTabs('{"v":1,"active":"x","tabs":[{"id":"a","hash":"#/saved"},{"id":"a","hash":"#/search"}]}'), {
    tabs: [{ id: "a", route: { kind: "saved" }, label: "Gemte sider" }],
    active: "a",
  });
});

test("initialTabs: adressens hash vinder, ellers sessionens faner, ellers én tom søgning", () => {
  const id = ids();
  const stored = openRoute(newSearch(EMPTY_TABS, id), company("CVR-1-1"), id, { label: "Eksempel A/S" });
  assert.equal(initialTabs("", stored, id), stored);
  const fromHash = initialTabs("#/company/CVR-1-1?focus=oekonomi", stored, id);
  assert.equal(fromHash.tabs.length, 2);
  assert.deepEqual(fromHash.tabs[1]!.route, company("CVR-1-1", "oekonomi"));
  const opened = initialTabs("#/person/CVR-3-9", stored, id);
  assert.equal(opened.tabs.length, 3);
  assert.equal(opened.tabs[2]!.label, "CVR-3-9");
  const fresh = initialTabs("", null, id);
  assert.equal(fresh.tabs.length, 1);
  assert.deepEqual(fresh.tabs[0]!.route, { kind: "search", q: "" });
});
