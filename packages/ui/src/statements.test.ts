import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CompanyVM, FinancialStatementsVM } from "@lasso/spec";
import { LassoBalanceSheet } from "./components/BalanceSheet.js";
import { CompanyHead } from "./components/CompanyHead.js";
import { LassoIncomeStatement } from "./components/IncomeStatement.js";

const enk: CompanyVM = { lassoId: "CVR-1-43811983", name: "Lasso", status: "Aktiv", form: "ENK", founded: "2023-01-30", industryText: "Computerkonsulentbistand" };
const none: FinancialStatementsVM = { lassoId: enk.lassoId, currency: "DKK", incomeStatement: [], balanceSheet: [], cashFlow: [] };

test("Virksomhedshoved: ansatte kun som tal, aldrig '- ansatte' når det ikke er oplyst", () => {
  // Livedata kan sende null for "ikke oplyst" (fx en enkeltmandsvirksomhed).
  const html = renderToStaticMarkup(createElement(CompanyHead, { company: { ...enk, employees: null as unknown as number } }));
  assert.ok(!html.includes("ansatte"), html);
  // G9 (Jakob 29.09): ingen hovedvariant viser ansatte (eller andre fakta) under navnet.
  assert.ok(!renderToStaticMarkup(createElement(CompanyHead, { company: { ...enk, employees: 64 } })).includes("ansatte"));
  assert.ok(!renderToStaticMarkup(createElement(CompanyHead, { company: { ...enk, employees: 64 }, variant: "compact" })).includes("ansatte"));
});

test("Regnskabstabeller uden regnskab: tom tilstand, der siger hvorfor (ikke en fejl)", () => {
  for (const C of [LassoIncomeStatement, LassoBalanceSheet]) {
    const html = renderToStaticMarkup(createElement(C, { statements: none, company: enk, years: 3, title: "Regnskab" }));
    assert.match(html, /class="lasso-state"/);
    assert.match(html, /Enkeltmandsvirksomheder og personligt ejede mindre virksomheder skal ikke indsende årsregnskab/);
    assert.ok(!html.includes("Data kunne ikke hentes"));
    assert.match(html, /lasso-section__title">Regnskab</);
  }
  // Uden virksomhedens stamdata: den almindelige forklaring.
  assert.match(renderToStaticMarkup(createElement(LassoIncomeStatement, { statements: none, years: 3 })), /ikke offentliggjort regnskaber endnu/);
});

test("19.2: ændringskolonnen farver kun subtotaler; underposter som muted procent, fortegnsskift som pil eller -", async () => {
  const { changeText } = await import("./components/statementTable.js");
  assert.deepEqual(changeText(17481, 18792, "subtotal"), { text: "▲ 7,5 %", tone: "up" });
  assert.deepEqual(changeText(-12104, -14890, "line"), { text: "+23,0 %", tone: "" });
  assert.deepEqual(changeText(1084, -338, "subtotal"), { text: "▼ 131,2 %", tone: "down" });
  assert.deepEqual(changeText(-239, 137, "line"), { text: "\u221242,7 %", tone: "" });
  assert.deepEqual(changeText(-612, -6702, "line", true), { text: "", tone: "" });
});
