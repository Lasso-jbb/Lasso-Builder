import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FinancialStatementsVM } from "@lasso/spec";
import { FinancialStatements } from "./components/FinancialStatements.js";
import { QualityFlag } from "./components/statementTable.js";

const years = [2021, 2022, 2023, 2024, 2025];
const s: FinancialStatementsVM = {
  lassoId: "CVR-1-1",
  currency: "DKK",
  scope: "Selskab",
  auditorOpinion: "Revisionspåtegning uden forbehold",
  pdfUrl: "https://example.com/aarsrapport.pdf",
  incomeStatement: years.map((year, i) => ({ year, periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, grossProfit: 18_000_000 + i * 200_000, staffCosts: -14_000_000, ebitda: 3_900_000, profitBeforeTax: i === 4 ? -338_000 : 500_000, tax: 137_000, profit: i === 4 ? -201_000 : 400_000 })),
  balanceSheet: years.map((year) => ({ year, fixedAssetsTotal: 7_300_000, currentAssetsTotal: 11_100_000, assetsTotal: 18_400_000, equityTotal: 3_200_000, liabilitiesTotal: 15_200_000, liabilitiesAndEquityTotal: 18_400_000 })),
  cashFlow: years.map((year) => ({ year, operatingCashFlow: 3_410_000, investingCashFlow: -2_620_000, financingCashFlow: -900_000, netCashFlow: -110_000 })),
};

test("19.1: værktøjslinje med selskab/koncern, periode, enhed, påtegning og Hent PDF", () => {
  const html = renderToStaticMarkup(createElement(FinancialStatements, { statements: s }));
  assert.match(html, /role="toolbar" aria-label="Regnskabets værktøjslinje"/);
  // Intet koncernregnskab: Koncern dæmpet med forklaring
  assert.match(html, /disabled=""[^>]*title="Intet koncernregnskab indberettet"[^>]*>Koncern</);
  assert.match(html, /disabled=""[^>]*title="Kun årsregnskab indberettet"[^>]*>Halvår</);
  assert.match(html, /disabled=""[^>]*title="Kun årsregnskab indberettet"[^>]*>Kvartal</);
  // Selskab først, periode-dropdown "2025, 01.01–31.12", enhed "t. kr." uden synlig etiket
  assert.match(html, />Selskab<[^]*>Koncern</);
  assert.match(html, /<option value="2025"[^>]*>2025, 01\.01–31\.12<\/option>/);
  assert.match(html, /lasso-sr">Enhed<\/span><select[^>]*><option value="t"[^>]*>t\. kr\.</);
  assert.match(html, /lasso-fs__opinion"[^>]*>Revisionspåtegning uden forbehold</);
  assert.match(html, /href="https:\/\/example\.com\/aarsrapport\.pdf"[^>]*>[^]*Hent PDF/);
  // Segment Resultat/Balance/Pengestrøm (niveau 3) kun i mobilformen, aldrig badge
  assert.match(html, /lasso-fs__mobile[^]*aria-label="Opgørelse"[^]*>Resultat<[^]*>Balance<[^]*>Pengestrøm</);
  assert.doesNotMatch(html, /lasso-badge|·/);
  // Desktop: resultatopgørelsen med 2 år + ændring, balance og pengestrøm under uden ændring
  const wide = html.slice(html.indexOf("lasso-fs__wide"), html.indexOf("lasso-fs__tablet"));
  assert.match(wide, /lasso-income[^]*>2024<[^]*>2025<[^]*Ændring[^]*lasso-balance[^]*lasso-cashflow/);
  assert.doesNotMatch(wide, />2023</);
  assert.equal((wide.match(/lasso-stmt__delta"/g) ?? []).length, 1, "kun resultatopgørelsen har ændringskolonne");
  // Titel og periode (tablet/mobil)
  assert.match(html, /Regnskab 2025/);
  assert.match(html, /01\.01–31\.12\.2025/);
});

test("26d.8/26d.10/26d.11: mobilformer (år + Δ, balance som to kort, pengestrøm med retningsbjælke)", () => {
  const income = renderToStaticMarkup(createElement(FinancialStatements, { statements: s }));
  assert.match(income, /lasso-fs-m__row--head[^]*>2025<[^]*Δ 2024/);
  assert.match(income, /lasso-fs-m__row--bottom[^]*Årets resultat/);
  const balance = renderToStaticMarkup(createElement(FinancialStatements, { statements: s, statement: "balance" }));
  assert.match(balance, /lasso-fs-bal__card[^]*Aktiver[^]*Anlæg[^]*Oms\.aktiver[^]*Passiver[^]*Egenkapital[^]*Gæld/);
  const cash = renderToStaticMarkup(createElement(FinancialStatements, { statements: s, statement: "cashflow" }));
  assert.match(cash, /Drift[^]*lasso-fs-cf__bar--pos[^]*Investering[^]*lasso-fs-cf__bar--neg[^]*Ændring i likvider/);
});

test("26f.3: tablet har to opgørelser side om side med 3 år", () => {
  const html = renderToStaticMarkup(createElement(FinancialStatements, { statements: s }));
  const tablet = html.slice(html.indexOf("lasso-fs__tablet"), html.indexOf("lasso-fs__mobile"));
  assert.match(tablet, /Resultatopgørelse[^]*Balance 31\.12/);
  assert.doesNotMatch(tablet, />2022</);
  assert.match(tablet, />2025<[^]*>2024<[^]*>2023</, "nyeste år først");
  assert.match(html, /Resultat \+ balance[^]*Pengestrøm/);
});

test("19.1: koncern kan vælges, når alternativt scope findes", () => {
  const withGroup = { ...s, alternate: { currency: "DKK", scope: "Koncern" as const, incomeStatement: s.incomeStatement, balanceSheet: s.balanceSheet, cashFlow: [] } };
  const html = renderToStaticMarkup(createElement(FinancialStatements, { statements: withGroup }));
  assert.doesNotMatch(html, /title="Intet koncernregnskab indberettet"/);
});

test("26h.2: kvalitetsflag er en knap med tooltip (tap), tallet i normal farve", () => {
  const html = renderToStaticMarkup(createElement(QualityFlag, { reason: "Mulig fejl i tallet." }));
  assert.match(html, /<button type="button" class="lasso-qflag__btn" aria-label="Mulig fejl: Mulig fejl i tallet\." aria-expanded="false"/);
  assert.match(html, /role="tooltip"[^>]*>Mulig fejl i tallet\.</);
});
