import { formatDate, formatNumber } from "./format.js";
import type { Address, CompanyVM, FinancialYear, OwnershipVM } from "./models.js";
import type { ViewComponent } from "./spec.js";

/**
 * Rækkerne i "Virksomhedsoplysninger" (LassoKeyValueList variant "company"). Ét sted, så
 * komponenten og komponisten (som udelader listen under 2 rækker) altid tæller det samme.
 *
 * Ingen 1:1-gentagelser på samme side: hovedet ejer identiteten (CVR, form, stiftet, adresse,
 * ansatte i CVR, branche), kontaktblokken ejer telefon/e-mail/web, og ejerlisten viser revisor
 * med skiftedato. Står de på siden, viser listen kun det, de ikke viser.
 */
export interface CompanyFact {
  label: string;
  value?: string;
  /** Revisorens Lasso-ID, så navnet kan åbnes i værter med drill-down. */
  lassoId?: string;
}

export interface CompanyFactOptions {
  /** LassoCompanyHead står på siden: stiftet, form, branche, ansatte og adresse gentages ikke. */
  hideIdentity?: boolean;
  /** LassoContact står på siden: adresse, telefon, e-mail og web gentages ikke. */
  hideContact?: boolean;
  /** LassoOwnerList står på siden og viser revisor og skiftedato. */
  hideAuditor?: boolean;
}

/** "2025-01-01" -> "01.01" (dag.måned, uden år, katalog 09: "01.01 – 31.12"). */
function dayMonth(value: string | undefined): string | undefined {
  const m = value ? /^\d{4}-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[2]}.${m[1]}` : undefined;
}

/** Regnskabsperioden uden år, "01.01 – 31.12", når begge datoer er kendt. */
export function accountingPeriod(year: Pick<FinancialYear, "periodStart" | "periodEnd"> | undefined): string | undefined {
  const from = dayMonth(year?.periodStart);
  const to = dayMonth(year?.periodEnd);
  return from && to ? `${from} – ${to}` : undefined;
}

/**
 * CVR's ansattetal (danske ansatte) og regnskabets (ofte koncernen) kan afvige meget;
 * begge vises med kilde, så forskellen ikke ligner en fejl: "64 (CVR), 62 i regnskab 2024".
 */
function employeesText(company: CompanyVM, lastYear: FinancialYear | undefined): string | undefined {
  const cvr = company.employees != null ? `${formatNumber(company.employees)} (CVR)` : undefined;
  const fromReport = lastYear && typeof lastYear.employees === "number" ? lastYear.employees : null;
  if (fromReport === null || fromReport === company.employees) return cvr;
  const report = `${formatNumber(fromReport)} i regnskab ${lastYear!.year}`;
  return cvr ? `${cvr}, ${report}` : report;
}

/**
 * Rækkerne med værdi, i fast rækkefølge. Revisor står også uden navn ("—"), når virksomheden har
 * regnskaber (så mangler den reelt); ellers udelades tomme rækker, så listen ikke fyldes af "—".
 */
export function companyFacts(company: CompanyVM, ownership: OwnershipVM | undefined, lastYear: FinancialYear | undefined, options: CompanyFactOptions = {}): CompanyFact[] {
  const a = company.address;
  const auditor = ownership?.auditor;
  const rows: CompanyFact[] = [];
  if (!options.hideAuditor) {
    if (auditor?.name || lastYear) rows.push({ label: "Revisor", value: auditor?.name, lassoId: auditor?.lassoId });
    if (auditor?.from) rows.push({ label: "Seneste revisorskift", value: formatDate(auditor.from) });
  }
  rows.push({ label: "Regnskabsperiode", value: accountingPeriod(lastYear) });
  if (!options.hideIdentity) {
    rows.push(
      { label: "Stiftet", value: company.founded ? formatDate(company.founded) : undefined },
      { label: "Virksomhedsform", value: company.form },
      { label: "Branche", value: company.industryText ? `${company.industryText}${company.industryCode ? ` (${company.industryCode})` : ""}` : undefined },
      { label: "Ansatte", value: employeesText(company, lastYear) },
    );
    if (!options.hideContact) rows.push({ label: "Adresse", value: [a?.street, [a?.zip, a?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined });
  } else {
    // Hovedet viser branchens tekst; koden er det eneste nye.
    rows.push({ label: "Branchekode", value: company.industryCode });
  }
  rows.push({ label: "Kommune", value: a?.municipality }, { label: "Region", value: a?.region });
  if (!options.hideContact) {
    rows.push({ label: "Telefon", value: company.phone }, { label: "E-mail", value: company.email }, { label: "Web", value: company.website });
  }
  return rows.filter((r) => r.value !== undefined || r.label === "Revisor");
}

/** Hvad der ellers står på siden for virksomheden, afledt af specen (samme regel i komponisten og i LassoView). */
export function companyFactOptions(page: readonly ViewComponent[], company: string): CompanyFactOptions {
  const has = (type: ViewComponent["type"]) => page.some((c) => c.type === type && "company" in c && c.company === company);
  return { hideIdentity: has("LassoCompanyHead"), hideContact: has("LassoContact"), hideAuditor: has("LassoOwnerList") };
}

/** Samme adresse (vej og postnummer, uden forskel på store/små bogstaver og mellemrum). */
export function sameAddress(a: Address | undefined, b: Address | undefined): boolean {
  const norm = (x: Address | undefined) => [x?.street, x?.zip].map((v) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim()).join("|");
  return Boolean(a?.street || a?.zip) && norm(a) === norm(b);
}
