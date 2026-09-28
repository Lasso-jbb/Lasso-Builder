import type { FinancialStatementsVM } from "@lasso/spec";
import { StatementTable } from "./statementTable.js";
import { cashFlowRows } from "./statementRows.js";

/**
 * Pengestrømsopgørelse (katalog 19): drift, investering og finansiering frem til årets
 * pengestrøm og likvider ultimo, 2–3 år side om side. Tom tilstand, når selskabet ikke
 * aflægger opgørelsen (regnskabsklasse B skal ikke, og LiveProvider kan da ikke finde den).
 */
export function LassoCashFlow({
  statements,
  years,
  title,
  error,
}: {
  statements?: FinancialStatementsVM;
  years: number;
  title?: string;
  error?: string;
}) {
  const heading = title ?? "Pengestrømsopgørelse";
  if (!statements) return <StatementTable title={heading} unit="t. kr." years={[]} sections={[]} prefix="lasso-cashflow" error={error} loading={!error} />;
  const all = statements.cashFlow;
  if (all.length === 0) {
    return <StatementTable title={heading} unit="t. kr." years={[]} sections={[]} prefix="lasso-cashflow" emptyReason="Pengestrømsopgørelse er ikke indberettet." />;
  }
  const span = Math.max(2, Math.min(3, years));
  const shown = all.slice(-span);
  const yearsShown = shown.map((y) => y.year);
  const rows = cashFlowRows(shown, statements);

  return <StatementTable title={heading} unit="t. kr." years={yearsShown} currency={statements.currency} sections={[{ rows }]} prefix="lasso-cashflow" />;
}
