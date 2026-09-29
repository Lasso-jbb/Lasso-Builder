import { noStatementsReason, type CompanyVM, type FinancialStatementsVM } from "@lasso/spec";
import { StatementTable } from "./statementTable.js";
import { balanceSections } from "./statementRows.js";

/**
 * Balance, fuld (katalog 19): aktiver og passiver med subtotaler og balancesum, 2–3 år side om
 * side. Egenkapital og balancesum er de samme tal som i LassoKeyFigureCards/nøgletallet
 * "balancesum"; underposterne er ubekræftede og kan stå som "Ikke oplyst".
 */
export function LassoBalanceSheet({ statements, company, years, title, error }: { statements?: FinancialStatementsVM; company?: CompanyVM; years: number; title?: string; error?: string }) {
  const heading = title ?? "Balance";
  if (!statements) return <StatementTable title={heading} unit="t. kr., 31.12" years={[]} sections={[]} prefix="lasso-balance" error={error} loading={!error} />;
  const all = statements.balanceSheet;
  if (all.length === 0) {
    return <StatementTable title={heading} unit="t. kr., 31.12" years={[]} sections={[]} prefix="lasso-balance" emptyReason={noStatementsReason(company)} />;
  }
  const span = Math.max(2, Math.min(3, years));
  const shown = all.slice(-span);
  const yearsShown = shown.map((y) => y.year);
  const sections = balanceSections(shown);

  return <StatementTable title={heading} unit="t. kr., 31.12" years={yearsShown} currency={statements.currency} sections={sections} prefix="lasso-balance" />;
}
