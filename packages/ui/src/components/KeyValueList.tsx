import { useState } from "react";
import { companyFacts, currencyUnit, formatAmount, formatDate, formatMetricValue, isPersonId, METRIC_FIELD, METRIC_LABELS, type CompanyVM, type FinancialsVM, type Metric, type OwnershipVM } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section, stateForError } from "../primitives.js";
import { FoldText, IndustryValue, NotReported } from "./Values.js";
import { Tabs } from "./Tabs.js";

/** "2025-01-01" -> "01.01" (dag.måned, uden år, katalog 09: "01.01–31.12"). */
function dayMonth(value: string | undefined): string | undefined {
  const m = value ? /^\d{4}-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[2]}.${m[1]}` : undefined;
}

interface Row {
  label: string;
  value?: string;
  danger?: boolean;
  /** Entitetens Lasso-ID (revisoren), så navnet kan åbnes i værter med drill-down. */
  lassoId?: string;
  /** 02c.10: branchekoden, vist i muted før teksten. */
  code?: string;
}

/**
 * Rækkerne for variant "company" kommer fra companyFacts (@lasso/spec), så komponisten tæller
 * det samme, når den udelader en liste under 2 rækker. Står hovedet, kontaktblokken eller
 * ejerlisten på siden, gentages deres oplysninger ikke her.
 */
function companyRows(
  company: CompanyVM,
  ownership: OwnershipVM | undefined,
  lastYear: FinancialsVM["years"][number] | undefined,
  hide: { identity: boolean; contact: boolean; auditor: boolean },
): Row[] {
  return companyFacts(company, ownership, lastYear, { hideIdentity: hide.identity, hideContact: hide.contact, hideAuditor: hide.auditor });
}

const FINANCIALS_ROW_METRICS: Metric[] = ["resultat", "egenkapital", "ansatte", "ebitda", "soliditetsgrad", "overskudsgrad", "likviditetsgrad", "balancesum", "gaeld"];

function financialsRows(year: FinancialsVM["years"][number], currency?: string, exclude: readonly Metric[] = []): Row[] {
  const cur = year.currency ?? currency;
  const period = dayMonth(year.periodStart) && dayMonth(year.periodEnd) ? `${dayMonth(year.periodStart)}–${dayMonth(year.periodEnd)}` : undefined;
  const rows: Row[] = [
    { label: "Regnskabsperiode", value: period },
    { label: "Regnskab udgivet", value: year.published ? formatDate(year.published) : undefined },
  ];
  // Omsætning, ellers bruttofortjeneste; udeladt, når nøgletalskortene på siden allerede viser den.
  const main: Metric = year.revenue != null ? "omsaetning" : "bruttofortjeneste";
  if (!exclude.includes(main)) {
    const v = year.revenue != null ? year.revenue : year.grossProfit;
    rows.push({ label: METRIC_LABELS[main], value: v != null ? formatAmount(v, currencyUnit(cur)) : undefined });
  }
  for (const m of FINANCIALS_ROW_METRICS) {
    if (exclude.includes(m)) continue;
    let v = year[METRIC_FIELD[m]] as number | null | undefined;
    // Gæld i alt = balancesum − egenkapital, når den ikke er oplyst direkte.
    if (m === "gaeld" && v == null && typeof year.assetsTotal === "number" && typeof year.equity === "number") v = year.assetsTotal - year.equity;
    rows.push({ label: METRIC_LABELS[m], value: v != null ? formatMetricValue(m, v, cur) : undefined, danger: typeof v === "number" && v < 0 });
  }
  return rows;
}

/** Værdien som link (lasso-link), når den har et Lasso-ID og værten kan åbne det; ellers ren tekst. */
function Value({ value, lassoId, onOpen }: { value: string; lassoId?: string; onOpen?: (a: ViewAction) => void }) {
  if (onOpen && lassoId?.startsWith("CVR-1-")) {
    return (
      <button type="button" className="lasso-link" onClick={(e) => { e.stopPropagation(); onOpen({ kind: "open-company", lassoId, name: value }); }}>
        {value}
      </button>
    );
  }
  if (onOpen && isPersonId(lassoId)) {
    return (
      <button type="button" className="lasso-link" onClick={(e) => { e.stopPropagation(); onOpen({ kind: "open-person", lassoId, name: value }); }}>
        {value}
      </button>
    );
  }
  return <>{value}</>;
}

/** Handling for en klikbar række (02c.13): åbner virksomheden eller personen, når værten kan. */
function rowOpener(r: Row, onOpen?: (a: ViewAction) => void): (() => void) | undefined {
  if (!onOpen || !r.value || !r.lassoId) return undefined;
  if (r.lassoId.startsWith("CVR-1-")) return () => onOpen({ kind: "open-company", lassoId: r.lassoId!, name: r.value });
  if (isPersonId(r.lassoId)) return () => onOpen({ kind: "open-person", lassoId: r.lassoId!, name: r.value });
  return undefined;
}

/**
 * Nøgle-værdi-liste (katalog 09). To varianter: "company" (stamdata, venstrestillet
 * værdi) og "financials" (regnskabstal med årsvælger, seneste regnskab valgt som
 * standard). Nøgle 13/400 grå i fast kolonne, værdi 14/400 (14/500 i financials-varianten), tal
 * venstrestillet i nøgle-værdi (02c.2). Manglende værdi: "Ikke oplyst"/"Ikke registreret" (02c.17).
 * Lange tekster foldes efter 3 linjer med "Vis mere" (02c.1).
 */
export function KeyValueList({
  company,
  ownership,
  financials,
  variant,
  title,
  error,
  hideContact = false,
  onOpen,
  hideIdentity = false,
  hideAuditor = false,
  exclude,
}: {
  company?: CompanyVM;
  ownership?: OwnershipVM;
  financials?: FinancialsVM;
  variant: "company" | "financials";
  title?: string;
  error?: string;
  /** Skjul adresse/telefon/e-mail/web, når LassoContact står på samme side. */
  hideContact?: boolean;
  /** Værten kan åbne virksomheder og personer (drill-down): revisoren bliver et link. */
  onOpen?: (a: ViewAction) => void;
  /** Skjul stiftet, form, branche, ansatte og adresse, når LassoCompanyHead står på samme side. */
  hideIdentity?: boolean;
  /** Skjul revisor og revisorskift, når LassoOwnerList (med revisor) står på samme side. */
  hideAuditor?: boolean;
  /** Variant "financials": nøgletal, der allerede står på siden (nøgletalskortene). */
  exclude?: readonly Metric[];
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
    const rows = financialsRows(selected, financials!.currency, exclude);
    return (
      <Section
        title={heading}
        action={
          options.length > 1 ? (
            // Årsvælger = niveau 3-faner (29). Over 3 år på mobil bliver den en dropdown (29, mobil).
            <div className="lasso-kv-years">
              <Tabs level={3} ariaLabel="Vælg regnskabsår" items={options.map((y) => ({ id: String(y.year), label: String(y.year) }))} value={String(selected.year)} onChange={(id) => setYear(Number(id))} />
            </div>
          ) : undefined
        }
        span="half"
      >
        <div className="lasso-kv-list lasso-kv-list--financials">
          {rows.map((r) => (
            <div className="lasso-kv-row" key={r.label}>
              <div className="lasso-kv-row__label">{r.label}</div>
              <div className={`lasso-kv-row__value ${r.danger ? "lasso-down" : ""}`}>{r.value ?? <NotReported />}</div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  const rows = companyRows(company!, ownership, financials?.years.at(-1), { identity: hideIdentity, contact: hideContact, auditor: hideAuditor });
  if (rows.length === 0) {
    return (
      <Section title={heading} span="half">
        <DataState state="empty" reason="CVR har ikke oplyst flere oplysninger om virksomheden end dem øverst på siden." />
      </Section>
    );
  }
  return (
    <Section title={heading} span="half">
      <div className="lasso-kv-list">
        {rows.map((r) => {
          const open = rowOpener(r, onOpen);
          return (
            // 02c.13: har værdien et Lasso-ID, er hele rækken klikbar (navnet er stadig knappen for tastatur).
            <div className={`lasso-kv-row ${open ? "lasso-kv-row--link" : ""}`} key={r.label} onClick={open}>
              <div className="lasso-kv-row__label">{r.label}</div>
              <div className="lasso-kv-row__value lasso-kv-row__value--wrap">
                {r.code ? (
                  <IndustryValue code={r.code} text={r.value} />
                ) : r.value ? (
                  r.lassoId && onOpen ? <Value value={r.value} lassoId={r.lassoId} onOpen={onOpen} /> : <FoldText text={r.value} />
                ) : (
                  // 02c.17: felter siger "Ikke registreret", når kilden er tom; tabeller beholder "—".
                  <NotReported kind="registered" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
