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

test("Virksomhedshoved: ansatte kun som tal, aldrig '— ansatte' når det ikke er oplyst", () => {
  // Livedata kan sende null for "ikke oplyst" (fx en enkeltmandsvirksomhed).
  const html = renderToStaticMarkup(createElement(CompanyHead, { company: { ...enk, employees: null as unknown as number } }));
  assert.ok(!html.includes("ansatte"), html);
  assert.match(html, /CVR-1-43811983|ENK, stiftet 30\.01\.2023, Computerkonsulentbistand/);
  // 08.1: sidens hoved viser ikke ansatte; den kompakte variant viser tallet (også 0).
  assert.ok(!renderToStaticMarkup(createElement(CompanyHead, { company: { ...enk, employees: 64 } })).includes("ansatte"));
  assert.match(renderToStaticMarkup(createElement(CompanyHead, { company: { ...enk, employees: 64 }, variant: "compact" })), /64 ansatte/);
  assert.match(renderToStaticMarkup(createElement(CompanyHead, { company: { ...enk, employees: 0 }, variant: "compact" })), /0 ansatte/);
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
