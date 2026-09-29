import { noStatementsReason, type CompanyVM, type FinancialStatementsVM } from "@lasso/spec";
import { StatementTable } from "./statementTable.js";
import { incomeRows } from "./statementRows.js";

/**
 * Resultatopgørelse, fuld (katalog 19): alle linjer med subtotaler (bruttofortjeneste/omsætning,
 * EBITDA, resultat før skat, årets resultat), 2–3 år side om side med udvikling. Hovedtallene er
 * de samme bekræftede tal som i LassoKeyFigureCards/LassoMultiYearTable; underposterne
 * (personaleomkostninger, andre driftsomkostninger, af- og nedskrivninger, finansielle poster, skat)
 * er ubekræftede XBRL-begreber og kan stå som "Ikke oplyst".
 */
export function LassoIncomeStatement({ statements, company, years, title, error }: { statements?: FinancialStatementsVM; company?: CompanyVM; years: number; title?: string; error?: string }) {
  const heading = title ?? "Resultatopgørelse";
  if (!statements) return <StatementTable title={heading} unit="t. kr." years={[]} sections={[]} prefix="lasso-income" error={error} loading={!error} />;
  const all = statements.incomeStatement;
  if (all.length === 0) {
    return <StatementTable title={heading} unit="t. kr." years={[]} sections={[]} prefix="lasso-income" emptyReason={noStatementsReason(company)} />;
  }
  const span = Math.max(2, Math.min(3, years));
  const shown = all.slice(-span);
  const yearsShown = shown.map((y) => y.year);
  const rows = incomeRows(shown);

  return <StatementTable title={heading} unit="t. kr." years={yearsShown} currency={statements.currency} sections={[{ rows }]} prefix="lasso-income" />;
}
