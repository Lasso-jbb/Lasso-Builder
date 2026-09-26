import type { FinancialStatementsVM } from "@lasso/spec";
import { StatementTable, type StatementRow } from "./statementTable.js";

/** Kvalitetsflag: en underpost, der ændrer sig mere end 10× fra året før (katalog 19-note). */
function bigJumpFlag(prev: number | null | undefined, last: number | null | undefined): string | undefined {
  if (typeof prev !== "number" || typeof last !== "number" || prev === 0) return undefined;
  const ratio = Math.abs(last) / Math.abs(prev);
  if (ratio >= 10 || ratio <= 0.1) return "Mulig fejl i tallet. Værdien afviger mere end 10× fra forrige år. Kan være indberetningsfejl eller en reel ekstraordinær post.";
  return undefined;
}

/**
 * Resultatopgørelse, fuld (katalog 19): alle linjer med subtotaler (bruttofortjeneste/omsætning,
 * EBITDA, resultat før skat, årets resultat), 2–3 år side om side med udvikling. Hovedtallene er
 * de samme bekræftede tal som i LassoKeyFigureCards/LassoMultiYearTable; underposterne
 * (personaleomkostninger, andre driftsomkostninger, af- og nedskrivninger, finansielle poster, skat)
 * er ubekræftede XBRL-begreber og kan stå som "Ikke oplyst".
 */
export function LassoIncomeStatement({ statements, years, title, error }: { statements?: FinancialStatementsVM; years: number; title?: string; error?: string }) {
  const heading = title ?? "Resultatopgørelse";
  if (!statements) return <StatementTable title={heading} unit="t. kr." years={[]} sections={[]} prefix="lasso-income" error={error} loading={!error} />;
  const all = statements.incomeStatement;
  if (all.length === 0) {
    return <StatementTable title={heading} unit="t. kr." years={[]} sections={[]} prefix="lasso-income" emptyReason="Virksomheden har ikke offentliggjort regnskaber endnu." />;
  }
  const span = Math.max(2, Math.min(3, years));
  const shown = all.slice(-span);
  const yearsShown = shown.map((y) => y.year);
  const revenueTop = shown.some((y) => y.revenue != null);
  const topLabel = revenueTop ? "Omsætning" : "Bruttofortjeneste";
  const topValues = shown.map((y) => (revenueTop ? y.revenue : y.grossProfit));

  const rows: StatementRow[] = [
    { key: "top", label: topLabel, values: topValues, kind: "subtotal" },
    { key: "staff", label: "Personaleomkostninger", values: shown.map((y) => y.staffCosts) },
    {
      key: "other",
      label: "Andre driftsomkostninger",
      values: shown.map((y) => y.otherOperatingCosts),
      flag: bigJumpFlag(shown.at(-2)?.otherOperatingCosts, shown.at(-1)?.otherOperatingCosts),
    },
    { key: "ebitda", label: "EBITDA", values: shown.map((y) => y.ebitda), kind: "subtotal" },
    { key: "depreciation", label: "Af- og nedskrivninger", values: shown.map((y) => y.depreciation) },
    { key: "financial", label: "Finansielle poster, netto", values: shown.map((y) => y.financialItemsNet) },
    { key: "pretax", label: "Resultat før skat", values: shown.map((y) => y.profitBeforeTax), kind: "subtotal" },
    { key: "tax", label: "Skat af årets resultat", values: shown.map((y) => y.tax) },
    { key: "profit", label: "Årets resultat", values: shown.map((y) => y.profit), kind: "bottom" },
  ];

  return <StatementTable title={heading} unit="t. kr." years={yearsShown} currency={statements.currency} sections={[{ rows }]} prefix="lasso-income" />;
}
