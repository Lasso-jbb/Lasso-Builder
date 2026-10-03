import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./safeNext.js";

test("safeNext: stier på samme oprindelse med query og hash passerer", () => {
  assert.equal(safeNext("/portal?aabn=CVR-1-99000001&fokus=risiko&fastgoer=1"), "/portal?aabn=CVR-1-99000001&fokus=risiko&fastgoer=1");
  assert.equal(safeNext("/portal"), "/portal");
  assert.equal(safeNext("/portal/klassisk#/company/CVR-1-1?focus=roller"), "/portal/klassisk#/company/CVR-1-1?focus=roller");
});

test("safeNext: anden vært, protokol, script, styretegn og mangler afvises", () => {
  for (const bad of ["https://evil.example/portal", "//evil.example", "/\\evil.example", "\\\\evil.example", "javascript:alert(1)", "portal", "", "/a\nb", "/a\\b", "/x".repeat(1100)]) {
    assert.equal(safeNext(bad), undefined, JSON.stringify(bad).slice(0, 40));
  }
  for (const bad of [undefined, null, 5, {}, ["/portal"]]) assert.equal(safeNext(bad), undefined);
});
