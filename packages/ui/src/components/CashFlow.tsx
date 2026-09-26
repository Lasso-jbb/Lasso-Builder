import type { FinancialStatementsVM } from "@lasso/spec";
import { StatementTable, type StatementRow } from "./statementTable.js";

const MISMATCH_REASON = "Likvider ultimo matcher ikke balancens likvide beholdninger for samme år.";

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
  const balanceByYear = new Map(statements.balanceSheet.map((y) => [y.year, y.cash]));
  const last = shown.at(-1);
  const lastBalanceCash = last ? balanceByYear.get(last.year) : undefined;
  const mismatch =
    last && typeof last.cashEnding === "number" && typeof lastBalanceCash === "number" && Math.abs(last.cashEnding - lastBalanceCash) > 1 ? MISMATCH_REASON : undefined;

  const rows: StatementRow[] = [
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
    { key: "cashEnding", label: "Likvider ultimo", values: shown.map((y) => y.cashEnding), flag: mismatch },
  ];

  return <StatementTable title={heading} unit="t. kr." years={yearsShown} currency={statements.currency} sections={[{ rows }]} prefix="lasso-cashflow" />;
}
