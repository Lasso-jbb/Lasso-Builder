import { formatDate, formatEmail, formatNumber, formatPhone, formatWeb } from "./format.js";
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
  /** 02c.10 Branche med kode: koden står først i muted, derefter branchetekst (value). */
  code?: string;
  /** Katalog 28.7: "Fravalgt" revision er den eneste værdi, der farves (warning-tekst, med ordet). */
  tone?: "warning";
}

export interface CompanyFactOptions {
  /** LassoCompanyHead står på siden: stiftet, form, branche, ansatte og adresse gentages ikke. */
  hideIdentity?: boolean;
  /** LassoContact står på siden: adresse, telefon, e-mail og web gentages ikke. */
  hideContact?: boolean;
  /** LassoOwnerList står på siden og viser revisor og skiftedato. */
  hideAuditor?: boolean;
}

/** "2025-01-01" -> "01.01" (dag.måned, uden år, katalog 09: "01.01–31.12"). */
function dayMonth(value: string | undefined): string | undefined {
  const m = value ? /^\d{4}-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[2]}.${m[1]}` : undefined;
}

/** Regnskabsperioden uden år, "01.01 – 31.12" (09.2: mellemrum om tankestregen), når begge datoer er kendt. */
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
      { label: "Branche", value: company.industryText, code: company.industryText ? company.industryCode : undefined },
      { label: "Ansatte", value: employeesText(company, lastYear) },
    );
    if (!options.hideContact) rows.push({ label: "Adresse", value: [a?.street, [a?.zip, a?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined });
  } else {
    // Hovedet viser branchens tekst; koden er det eneste nye.
    rows.push({ label: "Branchekode", value: company.industryCode });
  }
  rows.push({ label: "Kommune", value: a?.municipality }, { label: "Region", value: a?.region });
  // Katalog 28.7/26h.9: bibrancher med kode først (hovedbranchen står i hovedet/Branche), revision og kapital.
  if (company.altIndustries) {
    rows.push({
      label: "Bibrancher",
      value: company.altIndustries.length ? company.altIndustries.slice(0, 3).map((b) => [b.code, b.text].filter(Boolean).join(" ")).join(", ") : "Ingen registreret",
    });
  }
  if (company.auditExempt) rows.push({ label: "Revision", value: "Fravalgt", tone: "warning" });
  if (company.registeredCapital) {
    const cap = company.registeredCapital;
    rows.push({ label: "Kapital", value: [`${formatNumber(cap.amount)} ${cap.currency ?? "DKK"}`, ...(cap.classes ?? [])].join(", ") });
  }
  if (!options.hideContact) {
    // 02c.12: telefon i grupper af to, e-mail i små bogstaver, web uden https:// og www.
    rows.push({ label: "Telefon", value: formatPhone(company.phone) }, { label: "E-mail", value: formatEmail(company.email) }, { label: "Web", value: formatWeb(company.website) });
  }
  return rows.filter((r) => r.value !== undefined || r.label === "Revisor");
}

/** Hvad der ellers står på siden for virksomheden, afledt af specen (samme regel i komponisten og i LassoView). */
export function companyFactOptions(page: readonly ViewComponent[], company: string): CompanyFactOptions {
  const has = (type: ViewComponent["type"]) => page.some((c) => c.type === type && "company" in c && c.company === company);
  // 11.3: ejerlisten viser ikke længere revisoren, så nøgle-værdi-listen beholder den.
  return { hideIdentity: has("LassoCompanyHead"), hideContact: has("LassoContact"), hideAuditor: false };
}

/** Samme adresse (vej og postnummer, uden forskel på store/små bogstaver og mellemrum). */
export function sameAddress(a: Address | undefined, b: Address | undefined): boolean {
  const norm = (x: Address | undefined) => [x?.street, x?.zip].map((v) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim()).join("|");
  return Boolean(a?.street || a?.zip) && norm(a) === norm(b);
}
