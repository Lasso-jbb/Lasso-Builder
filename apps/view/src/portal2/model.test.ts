import assert from "node:assert/strict";
import { test } from "node:test";
import type { Dataset, ViewSpec } from "@lasso/spec";
import { askPlaceholder, headLines, messageFor, suggestions, withoutHead, type Page } from "./model.js";

const novo: Page = { kind: "entity", entity: "company", id: "CVR-1-24256790", name: "NOVO NORDISK A/S", tab: "overblik" };

test("withoutHead: portalen tegner selv hovedet", () => {
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
});

test("messageFor: Claude får at vide, hvilken side brugeren kigger på, når den har skiftet", () => {
  assert.equal(messageFor("Hvem ejer den?", novo, "CVR-1-24256790"), "Hvem ejer den?");
  assert.match(messageFor("Hvem ejer den?", novo, undefined), /Kontekst: brugeren kigger på NOVO NORDISK A\/S, CVR-1-24256790/);
  assert.equal(messageFor("Hej", { kind: "home" }, undefined), "Hej");
});

test("forslag og pladsholder følger siden", () => {
  assert.equal(askPlaceholder(novo), "Spørg om NOVO NORDISK A/S");
  assert.ok(suggestions(novo).includes("Hvem ejer NOVO NORDISK A/S?"));
  assert.equal(suggestions({ kind: "home" }).length, 3);
});
