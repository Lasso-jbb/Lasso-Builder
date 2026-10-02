import assert from "node:assert/strict";
import { test } from "node:test";
import { adaptResume, adaptValuation } from "./valuationAdapters.js";

const ID = "CVR-1-34580820";

test("adaptValuation: objekt, liste og tomt svar", () => {
  assert.deepEqual(adaptValuation({ value: 12_400_000, currency: "DKK", date: "2026-09-01" }, ID), { lassoId: ID, state: "ok", value: 12_400_000, currency: "DKK", date: "2026-09-01" });
  const list = adaptValuation([{ lassoId: "CVR-1-1", value: 1 }, { lassoId: ID, low: 10_000_000, high: 15_000_000 }], ID);
  assert.equal(list.state, "ok");
  assert.equal(list.low, 10_000_000);
  assert.equal(adaptValuation(null, ID).state, "unavailable");
  assert.equal(adaptValuation({}, ID).state, "unavailable");
  assert.equal(adaptValuation([], ID).state, "unavailable");
});

test("adaptResume: { content, lassoId, firstName, lastName }; tom tekst = intet resumé", () => {
  const r = adaptResume({ content: "Jonas Larsen startede sin erhvervskarriere ...", lassoId: "CVR-3-4000123456", firstName: "Jonas", lastName: "Larsen" }, "CVR-3-4000123456");
  assert.deepEqual(r, { lassoId: "CVR-3-4000123456", state: "ok", content: "Jonas Larsen startede sin erhvervskarriere ...", firstName: "Jonas", lastName: "Larsen" });
  assert.equal(adaptResume({ content: "Firmaet ApS blev stiftet i 2012, og efterfølgende..." , lassoId: ID }, ID).state, "ok");
  assert.equal(adaptResume({ content: "  " }, ID).state, "unavailable");
});
