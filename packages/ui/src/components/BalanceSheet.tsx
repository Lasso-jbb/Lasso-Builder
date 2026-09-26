import type { FinancialStatementsVM } from "@lasso/spec";
import { StatementTable, type StatementRow, type StatementSection } from "./statementTable.js";

const MISMATCH_REASON = "Aktiver i alt og passiver i alt matcher ikke. Balancen bør altid gå op; tjek de underliggende regnskabstal.";

/**
 * Balance, fuld (katalog 19): aktiver og passiver med subtotaler og balancesum, 2–3 år side om
 * side. Egenkapital og balancesum er de samme tal som i LassoKeyFigureCards/nøgletallet
 * "balancesum"; underposterne er ubekræftede og kan stå som "Ikke oplyst".
 */
export function LassoBalanceSheet({ statements, years, title, error }: { statements?: FinancialStatementsVM; years: number; title?: string; error?: string }) {
  const heading = title ?? "Balance";
  if (!statements) return <StatementTable title={heading} unit="t. kr., 31.12" years={[]} sections={[]} prefix="lasso-balance" error={error} loading={!error} />;
  const all = statements.balanceSheet;
  if (all.length === 0) {
    return <StatementTable title={heading} unit="t. kr., 31.12" years={[]} sections={[]} prefix="lasso-balance" emptyReason="Virksomheden har ikke offentliggjort regnskaber endnu." />;
  }
  const span = Math.max(2, Math.min(3, years));
  const shown = all.slice(-span);
  const yearsShown = shown.map((y) => y.year);
  const last = shown.at(-1);
  const mismatch = last && typeof last.assetsTotal === "number" && typeof last.liabilitiesAndEquityTotal === "number" && Math.abs(last.assetsTotal - last.liabilitiesAndEquityTotal) > 1
    ? MISMATCH_REASON
    : undefined;

  const assets: StatementRow[] = [
    { key: "intangible", label: "Immaterielle anlægsaktiver", values: shown.map((y) => y.intangibleAssets) },
    { key: "tangible", label: "Materielle anlægsaktiver", values: shown.map((y) => y.tangibleAssets) },
    { key: "fixedTotal", label: "Anlægsaktiver i alt", values: shown.map((y) => y.fixedAssetsTotal), kind: "subtotal" },
    { key: "tradeReceivables", label: "Tilgodehavender fra salg", values: shown.map((y) => y.tradeReceivables) },
    { key: "otherReceivables", label: "Andre tilgodehavender og periodeafgrænsning", values: shown.map((y) => y.otherReceivables) },
    { key: "cash", label: "Likvide beholdninger", values: shown.map((y) => y.cash) },
    { key: "currentTotal", label: "Omsætningsaktiver i alt", values: shown.map((y) => y.currentAssetsTotal), kind: "subtotal" },
    { key: "assetsTotal", label: "Aktiver i alt", values: shown.map((y) => y.assetsTotal), kind: "bottom", flag: mismatch },
  ];
  const liabilities: StatementRow[] = [
    { key: "shareCapital", label: "Selskabskapital", values: shown.map((y) => y.shareCapital) },
    { key: "retainedEarnings", label: "Overført resultat", values: shown.map((y) => y.retainedEarnings) },
    { key: "equityTotal", label: "Egenkapital i alt", values: shown.map((y) => y.equityTotal), kind: "subtotal" },
    { key: "longTerm", label: "Langfristet gæld", values: shown.map((y) => y.longTermLiabilities) },
    { key: "shortTerm", label: "Kortfristet gæld", values: shown.map((y) => y.shortTermLiabilities) },
    { key: "liabilitiesTotal", label: "Gæld i alt", values: shown.map((y) => y.liabilitiesTotal), kind: "subtotal" },
    { key: "liabAndEquityTotal", label: "Passiver i alt", values: shown.map((y) => y.liabilitiesAndEquityTotal), kind: "bottom", flag: mismatch },
  ];
  const sections: StatementSection[] = [
    { heading: "AKTIVER", rows: assets },
    { heading: "PASSIVER", rows: liabilities },
  ];

  return <StatementTable title={heading} unit="t. kr., 31.12" years={yearsShown} currency={statements.currency} sections={sections} prefix="lasso-balance" />;
}
