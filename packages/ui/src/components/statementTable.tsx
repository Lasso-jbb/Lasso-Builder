import { amountScale, currencyUnit, formatPercent, formatScaled, percentChange } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

/**
 * Delt tabel-anatomi for de tre fulde regnskabsopgørelser (katalog 19: LassoIncomeStatement,
 * LassoBalanceSheet, LassoCashFlow). Ikke en selvstændig katalogkomponent — kun en intern
 * byggesten, som de tre filer bruger, ligesom BarChart/GroupedBarChart/LineChart deler charts.ts.
 */

export interface StatementRow {
  key: string;
  label: string;
  /** Én værdi pr. år i `years`, samme rækkefølge. */
  values: readonly (number | null | undefined)[];
  /** "line" (standard, underpost): 13/400 sekundær, indrykket 16 px. "subtotal": 14/600 på panel-flade. "bottom": 700 med streg over. */
  kind?: "line" | "subtotal" | "bottom";
  /** Forklaring til et lille udråbstegn-ikon ved seneste års værdi (tooltip ved mouseover). */
  flag?: string;
}

export interface StatementSection {
  /** Overline i koral-tekst, fx "AKTIVER"/"PASSIVER". Udelades for opgørelser uden grupper. */
  heading?: string;
  rows: StatementRow[];
}

/** "▲ overskud"/"▼ underskud" ved fortegnsskift, ellers pil + procent (samme regel som MultiYearTable/Delta, katalog 09). */
function changeText(prev: number | null | undefined, last: number | null | undefined): { text: string; tone: "up" | "down" | "" } {
  if (typeof prev !== "number" || typeof last !== "number") return { text: "", tone: "" };
  if (prev !== 0 && Math.sign(prev) !== Math.sign(last)) return { text: last < 0 ? "▼ underskud" : "▲ overskud", tone: last < 0 ? "down" : "up" };
  const pct = percentChange([prev, last]);
  if (pct === null) return { text: "", tone: "" };
  return { text: `${pct < 0 ? "▼" : "▲"} ${formatPercent(Math.abs(pct), false)}`, tone: pct < 0 ? "down" : "up" };
}

/** Lille udråbstegn-ikon med forklaring i `title` (tooltip ved mouseover, katalog 19 note: "ingen mærke eller understregning"). */
function QualityFlag({ reason }: { reason: string }) {
  return (
    <span className="lasso-stmt__flag" title={reason} aria-label={`Kvalitetsflag: ${reason}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function StatementTable({
  title,
  unit,
  years,
  sections,
  prefix,
  error,
  loading,
  emptyReason,
  currency,
}: {
  title?: string;
  unit: string;
  years: readonly number[];
  sections: readonly StatementSection[];
  /** CSS-præfiks, fx "lasso-income", "lasso-balance", "lasso-cashflow". */
  prefix: string;
  error?: string;
  loading?: boolean;
  emptyReason?: string;
  /** ISO-valuta for beløbene (FinancialStatementsVM.currency); DKK vises som "kr.". */
  currency?: string;
}) {
  if (loading) {
    return (
      <Section title={title} span="full">
        <DataState state="loading" lines={8} height={420} />
      </Section>
    );
  }
  if (error) {
    return (
      <Section title={title} span="full">
        <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />
      </Section>
    );
  }
  if (emptyReason) {
    return (
      <Section title={title} span="full">
        <DataState state="empty" reason={emptyReason} />
      </Section>
    );
  }
  const allValues = sections.flatMap((s) => s.rows.flatMap((r) => r.values.filter((v): v is number => typeof v === "number")));
  const scale = allValues.length ? amountScale(allValues, currencyUnit(currency)) : null;
  const fmt = (v: number | null | undefined) => {
    if (v == null) return null;
    return scale ? formatScaled(v, scale) : formatScaled(v, { divisor: 1, label: unit });
  };

  return (
    <Section title={title} span="full">
      <div className="lasso-table-wrap">
        <div className={`lasso-stmt ${prefix}`}>
          <div className={`lasso-stmt__row lasso-stmt__row--head ${prefix}__head`}>
            <div className="lasso-stmt__label">{scale ? scale.label.toUpperCase() : unit.toUpperCase()}</div>
            {years.map((y, i) => (
              <div key={y} className={`lasso-stmt__year ${i === years.length - 1 ? "lasso-stmt__year--last" : ""}`}>
                {y}
              </div>
            ))}
            <div className="lasso-stmt__delta">Ændring</div>
          </div>
          {sections.map((section, si) => (
            <div className="lasso-stmt__section" key={section.heading ?? si}>
              {section.heading ? <div className="lasso-stmt__group">{section.heading}</div> : null}
              {section.rows.map((row) => {
                const change = changeText(row.values.at(-2), row.values.at(-1));
                return (
                  <div
                    className={`lasso-stmt__row lasso-stmt__row--${row.kind ?? "line"}`}
                    key={row.key}
                  >
                    <div className="lasso-stmt__label">{row.label}</div>
                    {row.values.map((v, i) => (
                      <div
                        key={years[i]}
                        className={`lasso-stmt__year ${i === row.values.length - 1 ? "lasso-stmt__year--last" : ""} ${typeof v === "number" && v < 0 ? "lasso-down" : ""}`}
                      >
                        {fmt(v) ?? <span className="lasso-notreported">—</span>}
                        {row.flag && i === row.values.length - 1 ? <QualityFlag reason={row.flag} /> : null}
                      </div>
                    ))}
                    <div className={`lasso-stmt__delta ${change.tone === "down" ? "lasso-down" : change.tone === "up" ? "lasso-up" : ""}`}>
                      {change.text || <span className="lasso-notreported">—</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
