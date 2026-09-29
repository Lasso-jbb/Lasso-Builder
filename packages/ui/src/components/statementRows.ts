import type { BalanceSheetYear, CashFlowYear, FinancialStatementsVM, IncomeStatementYear } from "@lasso/spec";
import type { StatementRow, StatementSection } from "./statementTable.js";

/**
 * Rækkerne i de tre fulde opgørelser (katalog 19), delt af LassoIncomeStatement, LassoBalanceSheet,
 * LassoCashFlow og den samlede LassoFinancialStatements (19.1), så posterne står ens overalt.
 */

/** Kvalitetsflag: en underpost, der ændrer sig mere end 10× fra året før (katalog 19-note). */
export function bigJumpFlag(prev: number | null | undefined, last: number | null | undefined): string | undefined {
  if (typeof prev !== "number" || typeof last !== "number" || prev === 0) return undefined;
  const ratio = Math.abs(last) / Math.abs(prev);
  if (ratio >= 10 || ratio <= 0.1) return "Mulig fejl i tallet. Værdien afviger mere end 10× fra forrige år. Kan være indberetningsfejl eller en reel ekstraordinær post.";
  return undefined;
}

export function incomeRows(shown: readonly IncomeStatementYear[]): StatementRow[] {
  const revenueTop = shown.some((y) => y.revenue != null);
  return [
    { key: "top", label: revenueTop ? "Omsætning" : "Bruttofortjeneste", values: shown.map((y) => (revenueTop ? y.revenue : y.grossProfit)), kind: "subtotal" },
    { key: "staff", label: "Personaleomkostninger", short: "Personaleomk.", values: shown.map((y) => y.staffCosts) },
    { key: "other", label: "Andre driftsomkostninger", short: "Andre driftsomk.", values: shown.map((y) => y.otherOperatingCosts), flag: bigJumpFlag(shown.at(-2)?.otherOperatingCosts, shown.at(-1)?.otherOperatingCosts) },
    { key: "ebitda", label: "EBITDA", values: shown.map((y) => y.ebitda), kind: "subtotal" },
    { key: "depreciation", label: "Af- og nedskrivninger", short: "Af- og nedskr.", values: shown.map((y) => y.depreciation) },
    { key: "financial", label: "Finansielle poster, netto", short: "Finansielle poster", values: shown.map((y) => y.financialItemsNet) },
    { key: "pretax", label: "Resultat før skat", values: shown.map((y) => y.profitBeforeTax), kind: "subtotal" },
    { key: "tax", label: "Skat af årets resultat", values: shown.map((y) => y.tax) },
    { key: "profit", label: "Årets resultat", values: shown.map((y) => y.profit), kind: "bottom" },
  ];
}

const BALANCE_MISMATCH = "Aktiver i alt og passiver i alt matcher ikke. Balancen bør altid gå op; tjek de underliggende regnskabstal.";

export function balanceSections(shown: readonly BalanceSheetYear[]): StatementSection[] {
  const last = shown.at(-1);
  const mismatch =
    last && typeof last.assetsTotal === "number" && typeof last.liabilitiesAndEquityTotal === "number" && Math.abs(last.assetsTotal - last.liabilitiesAndEquityTotal) > 1 ? BALANCE_MISMATCH : undefined;
  return [
    {
      heading: "AKTIVER",
      rows: [
        { key: "intangible", label: "Immaterielle anlægsaktiver", values: shown.map((y) => y.intangibleAssets) },
        { key: "tangible", label: "Materielle anlægsaktiver", values: shown.map((y) => y.tangibleAssets) },
        { key: "fixedTotal", label: "Anlægsaktiver i alt", values: shown.map((y) => y.fixedAssetsTotal), kind: "subtotal" },
        { key: "tradeReceivables", label: "Tilgodehavender fra salg", values: shown.map((y) => y.tradeReceivables) },
        { key: "otherReceivables", label: "Andre tilgodehavender og periodeafgrænsning", values: shown.map((y) => y.otherReceivables) },
        { key: "cash", label: "Likvide beholdninger", values: shown.map((y) => y.cash) },
        { key: "currentTotal", label: "Omsætningsaktiver i alt", values: shown.map((y) => y.currentAssetsTotal), kind: "subtotal" },
        { key: "assetsTotal", label: "Aktiver i alt", values: shown.map((y) => y.assetsTotal), kind: "bottom", flag: mismatch },
      ],
    },
    {
      heading: "PASSIVER",
      rows: [
        { key: "shareCapital", label: "Selskabskapital", values: shown.map((y) => y.shareCapital) },
        { key: "retainedEarnings", label: "Overført resultat", values: shown.map((y) => y.retainedEarnings) },
        { key: "equityTotal", label: "Egenkapital i alt", values: shown.map((y) => y.equityTotal), kind: "subtotal" },
        { key: "longTerm", label: "Langfristet gæld", values: shown.map((y) => y.longTermLiabilities) },
        { key: "shortTerm", label: "Kortfristet gæld", values: shown.map((y) => y.shortTermLiabilities) },
        { key: "liabilitiesTotal", label: "Gæld i alt", values: shown.map((y) => y.liabilitiesTotal), kind: "subtotal" },
        { key: "liabAndEquityTotal", label: "Passiver i alt", values: shown.map((y) => y.liabilitiesAndEquityTotal), kind: "bottom", flag: mismatch },
      ],
    },
  ];
}

const CASH_MISMATCH = "Likvider ultimo matcher ikke balancens likvide beholdninger for samme år.";

export function cashFlowRows(shown: readonly CashFlowYear[], statements: Pick<FinancialStatementsVM, "balanceSheet">): StatementRow[] {
  const balanceByYear = new Map(statements.balanceSheet.map((y) => [y.year, y.cash]));
  const last = shown.at(-1);
  const lastBalanceCash = last ? balanceByYear.get(last.year) : undefined;
  const mismatch = last && typeof last.cashEnding === "number" && typeof lastBalanceCash === "number" && Math.abs(last.cashEnding - lastBalanceCash) > 1 ? CASH_MISMATCH : undefined;
  return [
    { key: "profit", label: "Årets resultat", values: shown.map((y) => y.profit) },
    { key: "depreciation", label: "Af- og nedskrivninger", values: shown.map((y) => y.depreciation) },
    { key: "workingCapital", label: "Ændring i driftskapital", values: shown.map((y) => y.workingCapitalChange) },
    { key: "operating", label: "Pengestrøm fra drift", values: shown.map((y) => y.operatingCashFlow), kind: "subtotal" },
    { key: "intangibleInvestments", label: "Køb af immaterielle aktiver", values: shown.map((y) => y.intangibleInvestments) },
    { key: "investing", label: "Pengestrøm fra investering", values: shown.map((y) => y.investingCashFlow), kind: "subtotal" },
    { key: "capitalIncrease", label: "Kapitalforhøjelse", values: shown.map((y) => y.capitalIncrease) },
    { key: "loanChange", label: "Optagelse / afdrag på lån", values: shown.map((y) => y.loanChange) },
    { key: "financing", label: "Pengestrøm fra finansiering", values: shown.map((y) => y.financingCashFlow), kind: "subtotal" },
    { key: "netCashFlow", label: "Årets pengestrøm", values: shown.map((y) => y.netCashFlow), kind: "bottom" },
    { key: "cashBeginning", label: "Likvider primo", values: shown.map((y) => y.cashBeginning) },
    { key: "cashEnding", label: "Likvider ultimo", values: shown.map((y) => y.cashEnding), kind: "total", flag: mismatch },
  ];
}

/** Tablet (26f.3): resultatopgørelsen i syv linjer med korte etiketter (uden andre driftsomk. og skat). */
export function incomeRowsCompact(shown: readonly IncomeStatementYear[]): StatementRow[] {
  const keep = new Set(["top", "staff", "ebitda", "depreciation", "financial", "pretax", "profit"]);
  return incomeRows(shown).filter((r) => keep.has(r.key));
}

/** Tablet (26f.3): balancen i syv linjer uden grupper: anlæg, omsætning, aktiver i alt, egenkapital, gæld, passiver i alt. */
export function balanceRowsCompact(shown: readonly BalanceSheetYear[]): StatementRow[] {
  return [
    { key: "fixedTotal", label: "Anlægsaktiver", values: shown.map((y) => y.fixedAssetsTotal) },
    { key: "currentTotal", label: "Omsætningsaktiver", values: shown.map((y) => y.currentAssetsTotal) },
    { key: "assetsTotal", label: "Aktiver i alt", values: shown.map((y) => y.assetsTotal), kind: "total" },
    { key: "equityTotal", label: "Egenkapital", values: shown.map((y) => y.equityTotal), kind: "total" },
    { key: "longTerm", label: "Langfristet gæld", values: shown.map((y) => y.longTermLiabilities) },
    { key: "shortTerm", label: "Kortfristet gæld", values: shown.map((y) => y.shortTermLiabilities) },
    { key: "liabAndEquityTotal", label: "Passiver i alt", values: shown.map((y) => y.liabilitiesAndEquityTotal ?? y.assetsTotal), kind: "bottom" },
  ];
}
