import assert from "node:assert/strict";
import { test } from "node:test";
import { MUNICIPALITY_CODES, municipalityCode, municipalityName } from "./municipalities.js";

test("98 kommuner plus Christiansø med unikke koder", () => {
  const codes = Object.values(MUNICIPALITY_CODES);
  assert.equal(codes.length, 99);
  assert.equal(new Set(codes).size, 99);
});

test("municipalityCode tåler 'Kommune', stavemåder og koder", () => {
  assert.equal(municipalityCode("Aarhus"), "751");
  assert.equal(municipalityCode("Århus Kommune"), "751");
  assert.equal(municipalityCode("odense kommune"), "461");
  assert.equal(municipalityCode("Lyngby-Taarbæk"), "173");
  assert.equal(municipalityCode("101"), "101");
  assert.equal(municipalityCode("Atlantis"), undefined);
  assert.equal(municipalityName("751"), "Aarhus");
});
