import assert from "node:assert/strict";
import { test } from "node:test";
import { accountingPeriod } from "./companyFacts.js";
import { changeText, formatAge, formatAmount, formatBoolean, formatEmail, formatFullAmount, formatPeriod, formatPhone, formatRange, formatWeb, listParts, moreText, scoreWord } from "./format.js";

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
  assert.equal(accountingPeriod({ periodStart: "2025-01-01", periodEnd: "2025-12-31" }), "01.01 – 31.12");
});

test("02c.7 Ja/nej: ordene, konsekvens efter komma, ukendt = Ikke oplyst", () => {
  assert.equal(formatBoolean(true), "Ja");
  assert.equal(formatBoolean(false, "revideres ikke"), "Nej, revideres ikke");
  assert.equal(formatBoolean(null), "Ikke oplyst");
});

test("02c.9 Liste: og før sidste, og 1 mere / og N flere, Ingen", () => {
  assert.equal(listParts(["A", "B"]).text, "A og B");
  assert.deepEqual(listParts(["A", "B", "C"]), { shown: ["A", "B"], rest: 1, text: "A, B og 1 mere" });
  assert.equal(moreText(1), "1 mere");
  assert.equal(moreText(2), "2 flere");
  assert.equal(moreText(1, "selskab", "selskaber"), "1 selskab mere");
  assert.equal(moreText(3, "selskab", "selskaber"), "3 flere selskaber");
  assert.deepEqual(listParts(["A", "B", "C", "D"]), { shown: ["A", "B"], rest: 2, text: "A, B og 2 flere" });
  assert.equal(listParts([]).text, "Ingen");
});

test("02c.4 Ændring kun som pil + procent (også ved fortegnsskift), fuldt beløb", () => {
  assert.deepEqual(changeText(100, 112), { arrow: "▲", text: "12,0 %", tone: "up" });
  assert.deepEqual(changeText(100, 80), { arrow: "▼", text: "20,0 %", tone: "down" });
  assert.deepEqual(changeText(318_000, -201_000), { arrow: "▼", text: "163,2 %", tone: "down" });
  assert.deepEqual(changeText(-100, 50), { arrow: "▲", text: "150,0 %", tone: "up" });
  assert.equal(changeText(0, 50), null);
  assert.equal(changeText(null, 50), null);
  assert.equal(formatFullAmount(-18812400), "−18.812.400 kr.");
  assert.equal(scoreWord(72), "mulig risiko");
});


test("02c.12 Telefon i grupper af to, web uden https:// og www., e-mail med små bogstaver", () => {
  assert.equal(formatPhone("86123456"), "86 12 34 56");
  assert.equal(formatPhone("+4586123456"), "+45 86 12 34 56");
  assert.equal(formatPhone("+46 8 123 456"), "+46 8 123 456");
  assert.equal(formatWeb("https://www.eksempelbyg.dk/"), "eksempelbyg.dk");
  assert.equal(formatWeb("http://eksempelbyg.dk/om"), "eksempelbyg.dk/om");
  assert.equal(formatEmail("Info@Eksempelbyg.DK"), "info@eksempelbyg.dk");
});

test("01.7/23.5 Beløb: mio. og mia. med én decimal og ægte minus", () => {
  assert.equal(formatAmount(34_000_000), "34,0 mio. kr.");
  assert.equal(formatAmount(135_800_000), "135,8 mio. kr.");
  assert.equal(formatAmount(-201_000), "\u2212201 t. kr.");
  assert.equal(formatAmount(10_000_000, "kr.", { trimZero: true }), "10 mio. kr.");
});

test("02c.8/05.7 Status: CVR-koder til danske navne og fire farvegrupper for alle 19 statusser", async () => {
  const { STATUS_GROUPS, statusGroup, statusKind, statusLabel } = await import("./status.js");
  assert.equal(STATUS_GROUPS.flatMap((g) => g.statuses).length, 19);
  for (const g of STATUS_GROUPS) for (const s of g.statuses) assert.equal(statusGroup(s), g.group, s);
  assert.equal(statusLabel("NORMAL"), "Normal");
  assert.equal(statusLabel("OPLØSTEFTERKONKURS"), "Opløst efter konkurs");
  assert.equal(statusLabel("UNDERREASSUMERING"), "Under reassumering");
  assert.equal(statusLabel("UNDERREASUMMERING"), "Under reassumering");
  assert.equal(statusLabel("OPLØSTEFTERGRÆNSEOVERSKRIDENDEFUSION"), "Opløst efter grænseoverskridende fusion");
  assert.equal(statusLabel("UDENRETSVIRKNING"), "Uden retsvirkning");
  assert.equal(statusGroup("UNDERKONKURS"), "problem");
  assert.equal(statusGroup("FREMTID"), "temporary");
  // Opløst efter konkurs er afsluttet (inactive i modellen), men farves som problem.
  assert.equal(statusKind("Opløst efter konkurs"), "inactive");
  assert.equal(statusKind("Fremtid"), "warning");
  assert.equal(statusGroup("Ukendt"), undefined);
});

test("02a.6 Dato mellem: til-dato før fra-dato afvises med fejltekst", async () => {
  const { validateCriteria, DATE_RANGE_ERROR } = await import("./catalog.js");
  assert.equal(validateCriteria([{ field: "stiftet", operator: "between", value: ["2020-01-01", "2019-12-31"] }])[0]?.message, DATE_RANGE_ERROR);
  assert.equal(validateCriteria([{ field: "stiftet", operator: "between", value: ["2019-01-01", "2020-12-31"] }]).length, 0);
});
