import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEntityLinks, stripEntityLinks } from "./entityLinks.js";

test("entityLinks: {Navn|Lasso-ID} bliver et link eller navnet alene (Lassos snippet)", () => {
  const text = "Jonas har haft den længste relation til {Annelise Jensen|CVR-3-4000654321}, som sidder i {Firmaet ApS|CVR-1-12345678}.";
  assert.deepEqual(parseEntityLinks(text), [
    "Jonas har haft den længste relation til ",
    { name: "Annelise Jensen", lassoId: "CVR-3-4000654321" },
    ", som sidder i ",
    { name: "Firmaet ApS", lassoId: "CVR-1-12345678" },
    ".",
  ]);
  assert.equal(stripEntityLinks(text), "Jonas har haft den længste relation til Annelise Jensen, som sidder i Firmaet ApS.");
  // Andre krøllede parenteser (ikke præcis to dele) står urørt.
  assert.equal(stripEntityLinks("Tekst {uden id} og {a|b|c}."), "Tekst {uden id} og {a|b|c}.");
  assert.deepEqual(parseEntityLinks("Ingen links."), ["Ingen links."]);
});
