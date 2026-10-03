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

test("adaptValuation: Lassos kapitalhændelser (bekræftet 02.10) giver den seneste værdiansættelse", () => {
  const raw = [
    { share: 0.1, cvr: "34580820", date: "2019-03-01", decisionDate: "2019-02-20", price: 10, amount: 100_000, investmentAmount: 1_000_000, paymentType: "Kontant", valuation: 10_000_000, startingCapital: 500_000 },
    { share: 0.05, cvr: "34580820", date: "2024-06-01", decisionDate: "2024-05-15", price: 40, amount: 50_000, investmentAmount: 2_000_000, paymentType: "Kontant", valuation: 40_000_000, startingCapital: 600_000 },
    { share: 0.02, cvr: "34580820", date: "2021-01-01", valuation: null },
  ];
  const v = adaptValuation(raw, ID);
  assert.equal(v.state, "ok");
  assert.equal(v.value, 40_000_000);
  assert.equal(v.date, "2024-05-15");
  assert.equal(v.method, "kapitalforhøjelse");
  assert.equal(v.events, 3);
});
