import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dataset, ViewSpec } from "@lasso/spec";
import type { LookupResult } from "../portal/api.js";
import type { ChatEvent } from "../chat/stream.js";
import { addRecent, applyEvent, askPlaceholder, choiceMessage, closeItem, contextFor, freeTextPick, headLines, highlight, lastView, loadRecent, mapViews, newAnswer, openItem, searchCounts, searchRows, suggestions, withLastView, withoutHead, type OpenItem, type PendingChoice } from "./model.js";

const novo: OpenItem = { key: "CVR-1-24256790", kind: "company", name: "NOVO NORDISK A/S", tab: "overblik" };
const lasso: OpenItem = { key: "CVR-1-34580820", kind: "company", name: "LASSO X A/S", tab: "overblik" };
const mette: OpenItem = { key: "CVR-3-4000123", kind: "person", name: "Mette Holm", tab: "overblik" };

test("åbne faner: åbn (eller opdatér) og luk; den aktive bliver naboen til venstre", () => {
  let list = openItem([], novo);
  list = openItem(list, lasso);
  list = openItem(list, { ...novo, tab: "ejerskab" });
  assert.deepEqual(
    list.map((o) => `${o.name}:${o.tab}`),
    ["NOVO NORDISK A/S:ejerskab", "LASSO X A/S:overblik"],
  );
  list = openItem(list, mette);
  const r = closeItem(list, lasso.key, lasso.key);
  assert.deepEqual(
    r.list.map((o) => o.key),
    [novo.key, mette.key],
  );
  assert.equal(r.active, novo.key);
  assert.equal(closeItem(r.list, mette.key, novo.key).active, novo.key);
  assert.equal(closeItem([novo], novo.key, novo.key).active, null);
});

test("withoutHead: portalen tegner selv navn og identitetslinje", () => {
  const spec = { version: 2, kind: "company", title: "X", layout: "dashboard", criteria: [], components: [{ type: "LassoCompanyHead", company: "CVR-1-1" }, { type: "LassoKeyFigureCards", company: "CVR-1-1" }] } as unknown as ViewSpec;
  assert.deepEqual(
    withoutHead(spec).components.map((c) => c.type),
    ["LassoKeyFigureCards"],
  );
});

test("headLines: adresse og CVR-linje som i prototypen", () => {
  const ds = { companies: { "CVR-1-1": { lassoId: "CVR-1-1", name: "X", cvr: "13612870", phone: "12 34 56 78", website: "https://www.microsoft.dk/", address: { street: "Kanalvej 7", zip: "2800", city: "Kgs. Lyngby" } } }, persons: {} } as unknown as Dataset;
  assert.deepEqual(headLines("company", "CVR-1-1", ds), ["Kanalvej 7, 2800 Kgs. Lyngby", "CVR: 13612870, Telefon: 12 34 56 78, microsoft.dk"]);
  assert.deepEqual(headLines("company", "CVR-1-2", ds), []);
  assert.deepEqual(headLines("result", "result:1", ds), []);
});

test("contextFor: den aktive fane, de åbne firmaer og personer, og valget", () => {
  const result: OpenItem = { key: "result:1", kind: "result", name: "Søgning: lasso", tab: "lasso" };
  const open = [novo, mette, result];
  assert.deepEqual(contextFor({ ...novo, tab: "ejerskab" }, open), {
    active: { kind: "company", id: novo.key, name: novo.name, tab: "ejerskab" },
    open: [
      { kind: "company", id: novo.key, name: novo.name },
      { kind: "person", id: mette.key, name: mette.name },
    ],
  });
  assert.deepEqual(contextFor(undefined, []), { active: { kind: "global" }, open: [] });
  assert.deepEqual(contextFor(result, open).active, { kind: "global", title: "Søgning: lasso" });
  assert.equal(contextFor(undefined, Array.from({ length: 30 }, (_, i) => ({ ...novo, key: `CVR-1-${i}` }))).open.length, 20);
  const pick = { id: "toolu_1", free: true as const };
  assert.deepEqual(contextFor(novo, [novo], pick).choice, pick);
  // Det, brugeren ser: modulets resumé, afkortet til serverens grænse; ikke på Lasso-fanen.
  const shown = { spec: {} as ViewSpec, dataset: {} as Dataset, summary: "Omsætning 2025: 12 mio." };
  assert.deepEqual((contextFor({ ...novo, tab: "oekonomi" }, [novo], undefined, shown).active as { view?: unknown }).view, { module: "oekonomi", summary: "Omsætning 2025: 12 mio." });
  assert.equal((contextFor({ ...novo, tab: "lasso" }, [novo], undefined, shown).active as { view?: unknown }).view, undefined);
  assert.equal((contextFor(novo, [novo], undefined, { ...shown, summary: "x".repeat(5000) }).active as { view: { summary: string } }).view.summary.length, 4000);
});

test("choiceMessage: punktets prompt (ellers teksten) og valget med punktets action", () => {
  const choice: PendingChoice = {
    id: "toolu_1",
    question: "Hvad vil du se?",
    options: [
      { label: "Alt om Mette Holm", action: { placement: "entity", entity: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik", prompt: "Vis alt om Mette Holm (CVR-3-4000123)" } },
      { label: "Overordnet indblik her", action: { placement: "current" } },
    ],
    allowFreeText: true,
  };
  assert.deepEqual(choiceMessage(choice, 0), { message: "Vis alt om Mette Holm (CVR-3-4000123)", pick: { id: "toolu_1", index: 0, action: choice.options[0]!.action } });
  assert.equal(choiceMessage(choice, 1)!.message, "Overordnet indblik her");
  assert.equal(choiceMessage(choice, 2), null);
  assert.deepEqual(freeTextPick(choice), { id: "toolu_1", free: true });
});

test("forslag og pladsholder følger fanen", () => {
  assert.equal(askPlaceholder(novo), "Spørg Lasso");
  assert.equal(askPlaceholder(undefined), "Spørg Lasso");
  assert.notDeepEqual(suggestions({ ...novo, tab: "ejerskab" }), suggestions({ ...novo, tab: "oekonomi" }));
  assert.ok(suggestions(novo).includes("Hvem ejer NOVO NORDISK A/S?"));
  assert.equal(suggestions(undefined).length, 3);
});

test("søgeresultater: firmaer efter status, personer, antal og fremhævning", () => {
  const r: LookupResult = {
    q: "micro",
    companies: [
      { lassoId: "CVR-1-1", name: "MICROSOFT DANMARK ApS", cvr: "13612870", city: "Kgs. Lyngby", statusKind: "active" },
      { lassoId: "CVR-1-2", name: "MICRO-PC ApS", cvr: "25836316", city: "Ballerup", statusKind: "inactive", status: "Ophørt" },
    ],
    persons: [{ lassoId: "CVR-3-1", name: "Mette Microsen", city: "Aarhus" }],
  };
  assert.deepEqual(
    searchRows(r, "f", "Aktive").map((x) => x.meta),
    ["Kgs. Lyngby, CVR 13612870"],
  );
  assert.equal(searchRows(r, "f", "Inaktive")[0]?.status, "Ophørt");
  assert.equal(searchRows(r, "f", "Alle").length, 2);
  assert.deepEqual(searchCounts(r, "Aktive"), { f: 1, p: 1 });
  assert.deepEqual(highlight("MICROSOFT DANMARK ApS", "soft"), { pre: "MICRO", hit: "SOFT", post: " DANMARK ApS" });
  assert.deepEqual(highlight("LASSO X", "novo"), { pre: "LASSO X", hit: "", post: "" });
});

test("seneste: nyeste først uden dubletter; ødelagt lager giver en tom liste", () => {
  let l = addRecent([], { kind: "company", id: "a", name: "A", meta: "" });
  l = addRecent(l, { kind: "person", id: "b", name: "B", meta: "" });
  l = addRecent(l, { kind: "company", id: "a", name: "A", meta: "" });
  assert.deepEqual(
    l.map((x) => x.id),
    ["a", "b"],
  );
  assert.deepEqual(loadRecent({ getItem: () => "{ikke json" }), []);
  assert.deepEqual(loadRecent(undefined), []);
});

test("applyEvent: tekst og visninger i rækkefølge, placering først, menu og fejl", () => {
  const spec = { version: 2, kind: "company", title: "X", layout: "dashboard", criteria: [], components: [] } as unknown as ViewSpec;
  const ds = { companies: {}, persons: {} } as unknown as Dataset;
  const events: ChatEvent[] = [
    { type: "placement", placement: "entity", target: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik" },
    { type: "text", text: "Jakob " },
    { type: "text", text: "har 4 firmaer." },
    { type: "tool", id: "t1", name: "render_view", title: "Vis oversigt" },
    { type: "view", id: "t1", name: "render_view", form: "module", spec, dataset: ds },
    { type: "text", text: "Og her er siden." },
    { type: "view", id: "t2", name: "show_person", form: "page", spec, dataset: ds },
    { type: "done", history: [], sig: "s", placement: { placement: "entity", target: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik" } },
  ];
  let a = newAnswer("Hvad laver Jakob?");
  for (const e of events) a = applyEvent(a, e);
  assert.deepEqual(
    a.parts.map((p) => (p.kind === "text" ? `text:${p.text}` : `view:${p.form}`)),
    ["text:Jakob har 4 firmaer.", "view:module", "text:Og her er siden.", "view:page"],
  );
  assert.deepEqual(a.placement, { placement: "entity", target: { kind: "person", id: mette.key, name: mette.name }, focus: "overblik" });
  assert.equal(a.pending, false);
  assert.equal(a.status, undefined);
  assert.equal(lastView(a)?.spec, spec);

  // Status mens værktøjet henter; fejl fjerner status.
  const busy = applyEvent(newAnswer("q"), { type: "tool", id: "t", name: "show_company", title: "Vis virksomhed" });
  assert.equal(busy.status, "Vis virksomhed …");
  const failed = applyEvent(busy, { type: "error", message: "Nej." });
  assert.equal(failed.status, undefined);
  assert.equal(failed.error, "Nej.");

  // Menuen gemmes på svaret.
  const withMenu = applyEvent(newAnswer("vis alt om Mette"), { type: "choice", id: "toolu_1", question: "Hvad vil du se?", options: [{ label: "Alt om Mette", action: { placement: "current" } }], allowFreeText: false });
  assert.deepEqual(withMenu.choice, { id: "toolu_1", question: "Hvad vil du se?", options: [{ label: "Alt om Mette", action: { placement: "current" } }], allowFreeText: false });

  // Den seneste visning kan erstattes, og alle visninger kan ændres.
  const spec2 = { ...spec, title: "Y" } as ViewSpec;
  assert.equal(lastView(withLastView(a, { spec: spec2, dataset: ds }))?.spec.title, "Y");
  assert.equal((withLastView(a, { spec: spec2, dataset: ds }).parts[1] as { spec: ViewSpec }).spec.title, "X", "kun den seneste");
  assert.ok(mapViews(a, (s) => ({ ...s, dataset: { ...s.dataset, savedIds: ["a"] } })).parts.every((p) => p.kind !== "view" || p.dataset.savedIds?.[0] === "a"));
  assert.equal(lastView(newAnswer("q")), undefined);
});
