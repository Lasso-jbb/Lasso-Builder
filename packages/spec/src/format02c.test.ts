import assert from "node:assert/strict";
import { test } from "node:test";
import { accountingPeriod } from "./companyFacts.js";
import { changeText, formatAge, formatBoolean, formatFullAmount, formatPeriod, formatRange, listParts, scoreWord } from "./format.js";

test("02c.3 Tal-interval: tankestreg uden mellemrum, åbne intervaller", () => {
  assert.equal(formatRange(10, 19), "10–19");
  assert.equal(formatRange(1000, null), "1.000+");
  assert.equal(formatRange(null, 5), "under 5");
  assert.equal(formatRange(null, null), "—");
});

test("02c.6 Periode: tankestreg, åben periode, alder", () => {
  assert.equal(formatPeriod("2025-01-01", "2025-12-31"), "01.01.2025–31.12.2025");
  assert.equal(formatPeriod("2016-03-01", null, { yearOnly: true }), "siden 2016");
  assert.equal(formatPeriod("2016-03-01", null, { yearOnly: true, open: "arrow" }), "2016 →");
  assert.equal(formatAge("2016-03-01", new Date("2025-09-01T00:00:00Z")), "9 år");
  assert.equal(accountingPeriod({ periodStart: "2025-01-01", periodEnd: "2025-12-31" }), "01.01–31.12");
});

test("02c.7 Ja/nej: ordene, konsekvens efter komma, ukendt = Ikke oplyst", () => {
  assert.equal(formatBoolean(true), "Ja");
  assert.equal(formatBoolean(false, "revideres ikke"), "Nej, revideres ikke");
  assert.equal(formatBoolean(null), "Ikke oplyst");
});

test("02c.9 Liste: og før sidste, og N flere, Ingen", () => {
  assert.equal(listParts(["A", "B"]).text, "A og B");
  assert.deepEqual(listParts(["A", "B", "C", "D"]), { shown: ["A", "B"], rest: 2, text: "A, B og 2 flere" });
  assert.equal(listParts([]).text, "Ingen");
});

test("02c.4 Ændring som trekant + ord, fuldt beløb", () => {
  assert.deepEqual(changeText(100, 112), { arrow: "▲", text: "12,0 % stigning", tone: "up" });
  assert.deepEqual(changeText(100, 80), { arrow: "▼", text: "20,0 % fald", tone: "down" });
  assert.equal(changeText(100, -20)?.text, "underskud");
  assert.equal(formatFullAmount(-18812400), "−18.812.400 kr.");
  assert.equal(scoreWord(72), "mulig risiko");
});

