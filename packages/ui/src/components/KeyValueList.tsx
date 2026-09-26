import { useState } from "react";
import { currencyUnit, formatAmount, formatDate, formatMetricValue, formatNumber, METRIC_FIELD, METRIC_LABELS, type CompanyVM, type FinancialsVM, type Metric, type OwnershipVM } from "@lasso/spec";
import { DataState, Missing, Section, stateForError } from "../primitives.js";

/** "2025-01-01" -> "01.01" (dag.måned, uden år, katalog 09: "01.01 – 31.12"). */
function dayMonth(value: string | undefined): string | undefined {
  const m = value ? /^\d{4}-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[2]}.${m[1]}` : undefined;
}

/**
 * CVR's ansattetal (danske ansatte) og regnskabets (ofte koncernen) kan afvige meget;
 * begge vises med kilde, så forskellen ikke ligner en fejl: "64 (CVR), 62 i regnskab 2024".
 */
function employeesText(company: CompanyVM, lastYear: FinancialsVM["years"][number] | undefined): string | undefined {
  const cvr = company.employees != null ? `${formatNumber(company.employees)} (CVR)` : undefined;
  const fromReport = lastYear && typeof lastYear.employees === "number" ? lastYear.employees : null;
  if (fromReport === null || fromReport === company.employees) return cvr;
  const report = `${formatNumber(fromReport)} i regnskab ${lastYear!.year}`;
  return cvr ? `${cvr}, ${report}` : report;
}

interface Row {
  label: string;
  value?: string;
  danger?: boolean;
}

function companyRows(company: CompanyVM, ownership: OwnershipVM | undefined, lastYear: FinancialsVM["years"][number] | undefined, hideContact: boolean): Row[] {
  const a = company.address;
  const rows: Row[] = [{ label: "Revisor", value: ownership?.auditor?.name }];
  // "hvis tilgængeligt": rækken udelades helt, når skiftedatoen ikke er kendt (i stedet for en fast "—"-række).
  if (ownership?.auditor?.from) rows.push({ label: "Seneste revisorskift", value: formatDate(ownership.auditor.from) });
  const period = lastYear && dayMonth(lastYear.periodStart) && dayMonth(lastYear.periodEnd) ? `${dayMonth(lastYear.periodStart)} – ${dayMonth(lastYear.periodEnd)}` : undefined;
  rows.push(
    { label: "Regnskabsperiode", value: period },
    { label: "Stiftet", value: company.founded ? formatDate(company.founded) : undefined },
    { label: "Virksomhedsform", value: company.form },
    { label: "Branche", value: company.industryText ? `${company.industryText}${company.industryCode ? ` (${company.industryCode})` : ""}` : undefined },
    { label: "Ansatte", value: employeesText(company, lastYear) },
  );
  // Står kontaktblokken på samme side, gentages adresse, telefon, e-mail og web ikke her.
  if (!hideContact) {
    rows.push(
      { label: "Adresse", value: [a?.street, [a?.zip, a?.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined },
      { label: "Telefon", value: company.phone },
      { label: "E-mail", value: company.email },
      { label: "Web", value: company.website },
    );
  }
  return rows;
}

const FINANCIALS_ROW_METRICS: Metric[] = ["resultat", "egenkapital", "ansatte", "ebitda", "soliditetsgrad", "overskudsgrad", "likviditetsgrad", "balancesum", "gaeld"];

function financialsRows(year: FinancialsVM["years"][number], currency?: string): Row[] {
  const cur = year.currency ?? currency;
  const period = dayMonth(year.periodStart) && dayMonth(year.periodEnd) ? `${dayMonth(year.periodStart)} – ${dayMonth(year.periodEnd)}` : undefined;
  const rows: Row[] = [
    { label: "Regnskabsperiode", value: period },
    { label: "Regnskab udgivet", value: year.published ? formatDate(year.published) : undefined },
    {
      label: year.revenue != null ? "Omsætning" : "Bruttofortjeneste",
      value: (year.revenue != null ? year.revenue : year.grossProfit) != null ? formatAmount(year.revenue != null ? year.revenue : year.grossProfit, currencyUnit(cur)) : undefined,
    },
  ];
  for (const m of FINANCIALS_ROW_METRICS) {
    let v = year[METRIC_FIELD[m]] as number | null | undefined;
    // Gæld i alt = balancesum − egenkapital, når den ikke er oplyst direkte.
    if (m === "gaeld" && v == null && typeof year.assetsTotal === "number" && typeof year.equity === "number") v = year.assetsTotal - year.equity;
    rows.push({ label: METRIC_LABELS[m], value: v != null ? formatMetricValue(m, v, cur) : undefined, danger: typeof v === "number" && v < 0 });
  }
  return rows;
}

/**
 * Nøgle-værdi-liste (katalog 09). To varianter: "company" (stamdata, venstrestillet
 * værdi) og "financials" (regnskabstal med årsvælger, tal højrestillet, seneste
 * regnskab valgt som standard). Nøgle 13/400 grå i fast kolonne, værdi 14/400
 * (14/500 højrestillet i financials-varianten). Manglende værdi: "—" i faint.
 */
export function KeyValueList({
  company,
  ownership,
  financials,
  variant,
  title,
  error,
  hideContact = false,
}: {
  company?: CompanyVM;
  ownership?: OwnershipVM;
  financials?: FinancialsVM;
  variant: "company" | "financials";
  title?: string;
  error?: string;
  /** Skjul adresse/telefon/e-mail/web, når LassoContact står på samme side. */
  hideContact?: boolean;
}) {
  const heading = title ?? (variant === "financials" ? "Regnskab" : "Virksomhedsoplysninger");
  const ready = variant === "financials" ? Boolean(financials) : Boolean(company);
  const [year, setYear] = useState<number | null>(null);

  if (!ready) {
    return (
      <Section title={heading} span="half">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={6} height={320} />}
      </Section>
    );
  }

  if (variant === "financials") {
    const years = financials!.years;
    const last = years.at(-1);
    if (!last) {
      return (
        <Section title={heading} span="half">
          <DataState state="empty" reason="Virksomheden har ikke offentliggjort et regnskab endnu." />
        </Section>
      );
    }
    const options = years.slice(-5).reverse();
    const selected = years.find((y) => y.year === year) ?? last;
    const rows = financialsRows(selected, financials!.currency);
    return (
      <Section
        title={heading}
        action={
          options.length > 1 ? (
            <div className="lasso-kv-years" role="tablist" aria-label="Vælg regnskabsår">
              <div className="lasso-segment">
                {options.map((y) => (
                  <button key={y.year} type="button" role="tab" aria-selected={selected.year === y.year} className={`lasso-segment__item ${selected.year === y.year ? "is-on" : ""}`} onClick={() => setYear(y.year)}>
                    {y.year}
                  </button>
                ))}
              </div>
            </div>
          ) : undefined
        }
        span="half"
      >
        <div className="lasso-kv-list lasso-kv-list--financials">
          {rows.map((r) => (
            <div className="lasso-kv-row" key={r.label}>
              <div className="lasso-kv-row__label">{r.label}</div>
              <div className={`lasso-kv-row__value ${r.danger ? "lasso-down" : ""}`}>{r.value ?? <Missing />}</div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  const rows = companyRows(company!, ownership, financials?.years.at(-1), hideContact);
  return (
    <Section title={heading} span="half">
      <div className="lasso-kv-list">
        {rows.map((r) => (
          <div className="lasso-kv-row" key={r.label}>
            <div className="lasso-kv-row__label">{r.label}</div>
            <div className="lasso-kv-row__value" title={r.value}>
              {r.value ?? <Missing />}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
