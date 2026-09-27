import { formatDate } from "./format.js";
import type { CompanyVM } from "./models.js";

/** Personligt ejede former uden regnskabspligt (årsregnskabslovens § 3): enkeltmandsvirksomhed og PMV. */
const PERSONAL_FORM = /^(enk|pmv)$|enkeltmands|personligt ejet/i;
/** Interessentskaber har kun regnskabspligt, når alle interessenter er selskaber. */
const PARTNERSHIP_FORM = /^i\/s$|interessentskab/i;
/** Første regnskabsår må være op til 18 måneder plus 5 måneders frist: under to år er "endnu" rigtigt. */
const FIRST_REPORT_MONTHS = 24;
const MONTH = 30.44 * 24 * 3600 * 1000;

/** Regnskabspligt efter årsregnskabsloven: personligt ejede virksomheder (ENK, PMV) har ingen. Ukendt form regnes som pligtig. */
export function hasReportingDuty(form: string | undefined): boolean {
  return !PERSONAL_FORM.test(form?.trim() ?? "");
}

export const NO_STATEMENTS_REASON = "Virksomheden har ikke offentliggjort regnskaber endnu.";

/**
 * Hvorfor der ingen regnskabstal er (den tomme tilstand siger hvorfor, guide 23). Bruges af
 * regnskabstabellerne (katalog 19), komponisten og tekstkortet, så alle siger det samme.
 */
export function noStatementsReason(company?: CompanyVM, now: Date = new Date()): string {
  const form = company?.form?.trim() ?? "";
  if (PERSONAL_FORM.test(form)) return "Enkeltmandsvirksomheder og personligt ejede mindre virksomheder skal ikke indsende årsregnskab, så der er ingen regnskabstal at vise.";
  if (PARTNERSHIP_FORM.test(form)) return "Interessentskaber med personlige ejere skal ikke indsende årsregnskab, så der er normalt ingen regnskabstal at vise.";
  const founded = company?.founded ? Date.parse(company.founded) : Number.NaN;
  if (!Number.isNaN(founded) && (now.getTime() - founded) / MONTH < FIRST_REPORT_MONTHS) {
    return `Virksomheden er stiftet ${formatDate(company!.founded)} og har ikke offentliggjort sit første regnskab endnu.`;
  }
  return NO_STATEMENTS_REASON;
}

/** Hentet, men uden en eneste opgørelse: den tomme tilstand, ikke "henter". */
export function hasNoStatements(s: { incomeStatement: readonly unknown[]; balanceSheet: readonly unknown[] } | undefined): boolean {
  return s !== undefined && s.incomeStatement.length === 0 && s.balanceSheet.length === 0;
}
