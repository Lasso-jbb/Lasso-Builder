import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dataset, ViewSpec } from "@lasso/spec";
import type { LookupResult } from "../portal/api.js";
import { addRecent, askPlaceholder, closeItem, headLines, highlight, loadRecent, messageFor, openItem, searchCounts, searchRows, suggestions, withoutHead, type OpenItem } from "./model.js";

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

test("messageFor: Claude får at vide, hvilken side brugeren kigger på, når den har skiftet", () => {
  assert.equal(messageFor("Hvem ejer den?", novo, novo.key), "Hvem ejer den?");
  assert.match(messageFor("Hvem ejer den?", novo, undefined), /Kontekst: brugeren kigger på NOVO NORDISK A\/S, CVR-1-24256790/);
  assert.equal(messageFor("Hej", undefined, undefined), "Hej");
  assert.equal(messageFor("Hej", { key: "result:1", kind: "result", name: "Søgning", tab: "lasso" }, undefined), "Hej");
});

test("forslag og pladsholder følger fanen", () => {
  assert.equal(askPlaceholder(novo), "Spørg om NOVO NORDISK A/S");
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
