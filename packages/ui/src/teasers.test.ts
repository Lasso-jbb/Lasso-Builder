import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composeCompany, composePerson, emptyDataset, parseViewSpec, personTimeline, type Dataset, type PersonVM, type ViewSpec } from "@lasso/spec";
import { LassoNews } from "./components/LassoNews.js";
import { LassoTimeline } from "./components/LassoTimeline.js";
import { PersonNetwork } from "./components/PersonNetwork.js";
import { PersonRoles } from "./components/PersonRoles.js";
import { LassoView, moreInTab } from "./LassoView.js";
import type { HostCapabilities, MoreInTab, ViewAction } from "./types.js";

/*
 * Overblikkets smagsprøver (docs/portal.md, "Fokus og elementer"): med specens `more` og en vært,
 * der kan skifte fane (openFocus), åbner "Se alle … i Historik" fanen (open-focus) i stedet for at
 * folde ud på stedet. Uden kapabiliteten er alt som før.
 */

const CO = "CVR-1-99000001";
const PERSON = "CVR-3-4000000002";

function company(): Dataset {
  const ds = emptyDataset("demo");
  ds.companies[CO] = { lassoId: CO, cvr: "99000001", name: "Eksempel Byg A/S", status: "Normal", form: "A/S" };
  ds.people[CO] = [{ name: "Anne Eksempel", role: "Direktør", from: "2015-01-01" }];
  ds.ownership[CO] = { lassoId: CO, owners: [{ name: "Bo Eksempel", kind: "person", share: "100 %" }] };
  ds.timeline[CO] = { lassoId: CO, events: Array.from({ length: 8 }, (_, i) => ({ date: `${2025 - i}-04-15`, title: `Årsrapport ${2025 - i} offentliggjort`, category: "Regnskab" })) };
  ds.news[CO] = { lassoId: CO, items: [1, 2, 3, 4, 5].map((n) => ({ source: "Avis", headline: `Nyhed ${n} om byggeriet`, time: "2025-04-15" })) };
  return ds;
}

const bo: PersonVM = {
  lassoId: PERSON,
  name: "Bo Eksempel",
  roles: [
    { companyId: "CVR-1-99000010", companyName: "Eksempel Holding ApS", kind: "direction", role: "Direktør", from: "2005-01-01", active: true },
    { companyId: "CVR-1-99000001", companyName: "Eksempel Byg A/S", kind: "board", role: "Bestyrelsesformand", from: "2012-05-01", active: true },
    { companyId: "CVR-1-99000011", companyName: "Eksempel Energi A/S", kind: "board", role: "Bestyrelsesmedlem", from: "2014-03-01", to: "2018-06-30", active: false },
  ],
};

function person(): Dataset {
  const ds = emptyDataset("demo");
  ds.persons[PERSON] = bo;
  ds.personNetworks[PERSON] = {
    lassoId: PERSON,
    people: Array.from({ length: 5 }, (_, i) => ({ name: `Person ${i + 1} Eksempel`, companies: [], overlapYears: 5 - i, active: true })),
  };
  ds.timeline[PERSON] = personTimeline(bo, "2026-09-27");
  return ds;
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const render = (spec: ViewSpec, ds: Dataset, host: HostCapabilities) => text(renderToStaticMarkup(createElement(LassoView, { spec, dataset: ds, host, onAction: () => undefined })));

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

/**
 * Klikker på knappen med teksten i ét render-pas: komponenterne kaldes som funktioner inde i en
 * indpakning (hooks hører til den), og knappens onClick kaldes. Ingen DOM nødvendig.
 */
function click(element: ReactElement, label: RegExp): void {
  let found = false;
  const walk = (node: unknown): boolean => {
    if (Array.isArray(node)) return node.some(walk);
    if (!isValidElement(node)) return false;
    const { type, props } = node as ReactElement<{ children?: ReactNode; onClick?: () => void }>;
    if (typeof type === "function") return walk((type as (p: unknown) => unknown)(props));
    if (type === "button" && label.test(textOf(props.children))) {
      props.onClick?.();
      return true;
    }
    return walk(props.children);
  };
  function Probe() {
    found = walk(element);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  assert.ok(found, `ingen knap med ${label}`);
}

test("moreInTab: kun med 'more' på en fane og en vært, der kan skifte fane; fanens navn efter sidens slags", () => {
  const spec = composeCompany(CO, company(), { focus: "overblik" });
  const actions: ViewAction[] = [];
  const act = (a: ViewAction) => void actions.push(a);
  assert.equal(moreInTab("historik", spec, {}, act), undefined, "uden openFocus");
  assert.equal(moreInTab("expand", spec, { openFocus: true }, act), undefined);
  assert.equal(moreInTab(undefined, spec, { openFocus: true }, act), undefined);
  assert.equal(moreInTab("roller", spec, { openFocus: true }, act), undefined, "et personfokus på en virksomhedsside");
  const tab = moreInTab("historik", spec, { openFocus: true }, act);
  assert.equal(tab?.tab, "Historik");
  tab?.open();
  assert.deepEqual(actions, [{ kind: "open-focus", focus: "historik" }]);
  const personSpec = composePerson(PERSON, person());
  assert.equal(moreInTab("netvaerk", personSpec, { openFocus: true }, act)?.tab, "Netværk");
  assert.equal(moreInTab("roller", personSpec, { openFocus: true }, act)?.tab, "Roller");
});

test("virksomhedens overblik: 'Se alle … i Historik' med openFocus, ellers fold ud på stedet som før", () => {
  const ds = company();
  // showAll: uden højdebudgettet (23.3) står både nyheder og historik som smagsprøver på overblikket.
  const spec = composeCompany(CO, ds, { focus: "overblik", followUps: false, showAll: true });
  const linked = render(spec, ds, { openFocus: true });
  assert.match(linked, /Se alle 8 begivenheder i Historik/);
  assert.match(linked, /Se alle 5 nyheder i Historik/);
  const inPlace = render(spec, ds, {});
  assert.match(inPlace, /Se alle 8 begivenheder /);
  // Paper: nyhedslistens foldeknap hedder "Vis flere" (uden openFocus peger den ikke videre).
  assert.match(inPlace, /Vis flere/);
  assert.doesNotMatch(inPlace, /i Historik/);
  // Fanen Historik ejer elementerne: dér folder "Se alle" ud på stedet, også med openFocus.
  const history = render(composeCompany(CO, ds, { focus: "historik", followUps: false }), ds, { openFocus: true });
  assert.match(history, /Se alle 8 begivenheder /);
  assert.doesNotMatch(history, /i Historik/);
});

test("knapperne affyrer open-focus med fanen; den foldende knap har aria-expanded, linket ikke", () => {
  const ds = company();
  const actions: ViewAction[] = [];
  const moreIn: MoreInTab = { tab: "Historik", open: () => void actions.push({ kind: "open-focus", focus: "historik" }) };
  click(createElement(LassoTimeline, { timeline: ds.timeline[CO], limit: 3, moreIn }), /Se alle 8 begivenheder i Historik/);
  click(createElement(LassoNews, { news: ds.news[CO], limit: 3, moreIn }), /Se alle 5 nyheder i Historik/);
  assert.deepEqual(actions, [
    { kind: "open-focus", focus: "historik" },
    { kind: "open-focus", focus: "historik" },
  ]);
  const linked = renderToStaticMarkup(createElement(LassoTimeline, { timeline: ds.timeline[CO], limit: 3, moreIn }));
  assert.doesNotMatch(linked, /aria-expanded/);
  assert.match(renderToStaticMarkup(createElement(LassoTimeline, { timeline: ds.timeline[CO], limit: 3 })), /aria-expanded="false"/);
});

test("personens overblik: roller, netværk og historik peger på deres faner", () => {
  const ds = person();
  const spec = composePerson(PERSON, ds, { followUps: false });
  const linked = render(spec, ds, { openFocus: true });
  // To aktive roller står her; fanen Roller viser alle tre selskaber (også det ophørte).
  assert.match(linked, /Se alle 3 selskaber i Roller/);
  assert.match(linked, /Se alle 5 personer i Netværk/);
  assert.match(linked, /begivenheder i Historik/);
  // Uden openFocus: netværket folder ud på stedet (Paper: "Vis alle N"), og de to aktive roller har ingen knap.
  const inPlace = render(spec, ds, {});
  assert.match(inPlace, /Vis alle 5 /);
  assert.doesNotMatch(inPlace, / i (Roller|Netværk|Historik)/);
  assert.doesNotMatch(inPlace, /Se alle 3 selskaber/);

  const actions: ViewAction[] = [];
  const open = (focus: string): MoreInTab => ({ tab: focus, open: () => void actions.push({ kind: "open-focus", focus }) });
  click(createElement(PersonRoles, { person: bo, show: "current", limit: 5, moreIn: open("Roller") }), /Se alle 3 selskaber i Roller/);
  click(createElement(PersonNetwork, { network: ds.personNetworks[PERSON], limit: 3, moreIn: open("Netværk") }), /Se alle 5 personer i Netværk/);
  click(createElement(PersonRoles, { person: bo, limit: 1, moreIn: open("Roller") }), /Se alle 3 selskaber i Roller/);
  assert.deepEqual(
    actions.map((a) => (a.kind === "open-focus" ? a.focus : a.kind)),
    ["Roller", "Netværk", "Roller"],
  );
  // Viser listen allerede alle selskaber, er der ingen knap.
  const all = renderToStaticMarkup(createElement(PersonRoles, { person: { ...bo, roles: bo.roles.slice(0, 2) }, show: "current", limit: 5, moreIn: open("Roller") }));
  assert.doesNotMatch(all, /Se alle/);
});

test("more i en gemt spec: kun kendte faner pr. element (historik, roller, netvaerk)", () => {
  const ok = parseViewSpec({
    title: "x",
    components: [
      { type: "LassoTimeline", company: CO, more: "historik" },
      { type: "LassoNews", company: CO, more: "expand" },
      { type: "LassoPersonRoles", person: PERSON, more: "roller" },
      { type: "LassoPersonNetwork", person: PERSON, more: "netvaerk" },
    ],
  });
  assert.equal(ok.components.length, 4);
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoPersonNetwork", person: PERSON, more: "historik" }] }));
  assert.throws(() => parseViewSpec({ title: "x", components: [{ type: "LassoNews", company: CO, more: "roller" }] }));
});
