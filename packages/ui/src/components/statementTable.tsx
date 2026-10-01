import { useState, type ReactNode } from "react";
import { amountScale, currencyUnit, formatPercent, formatScaled, changePercent, type AmountScale } from "@lasso/spec";
import { QualityFlag } from "./QualityFlag.js";
export { QualityFlag };
import { DataState, Section, stateForError } from "../primitives.js";

/**
 * Delt tabel-anatomi for de tre fulde regnskabsopgørelser (katalog 19: LassoIncomeStatement,
 * LassoBalanceSheet, LassoCashFlow). Ikke en selvstændig katalogkomponent - kun en intern
 * byggesten, som de tre filer bruger, ligesom BarChart/GroupedBarChart/LineChart deler charts.ts.
 */

/** Paper 19: opgørelserne står altid i t. kr. med tusindtalspunktum ("18.834"). */
export function thousands(currency?: string): AmountScale {
  return { divisor: 1_000, label: `t. ${currencyUnit(currency)}` };
}

export interface StatementRow {
  key: string;
  label: string;
  /** Én værdi pr. år i `years`, samme rækkefølge. */
  values: readonly (number | null | undefined)[];
  /** "line" (standard, underpost): 13/400 sekundær, indrykket 16 px. "subtotal": 14/600 på panel-flade. "bottom": 700 med streg over. "total": 600 uden flade (fx "Likvider ultimo"). */
  kind?: "line" | "subtotal" | "bottom" | "total";
  /** Forklaring til et lille udråbstegn-ikon ved seneste års værdi (tooltip ved mouseover). */
  flag?: string;
  /** Kort etiket til smalle tabeller (tablet 26f.3), fx "Personaleomk.". */
  short?: string;
  /**
   * Underposterne bag en sum (Jakob 01.10, detaljeret regnskab): rækken kan foldes ud, men kun når mindst to
   * underposter har tal (ellers giver det ingen mening, og rækken står uden fold).
   */
  children?: StatementRow[];
  /** Værdierne er procenter (nøgletal), ikke beløb. */
  percent?: boolean;
}

/** En række kan foldes ud, når mindst to underposter har tal. */
export function expandable(row: StatementRow): boolean {
  return (row.children ?? []).filter((c) => c.values.some((v) => typeof v === "number")).length >= 2;
}

export interface StatementSection {
  /** Overline i koral-tekst, fx "AKTIVER"/"PASSIVER". Udelades for opgørelser uden grupper. */
  heading?: string;
  rows: StatementRow[];
}

/**
 * Ændringskolonnen (19.2): kun subtotaler og bundlinje får ▲/▼ i farve ("▲ 7,5 %"); underposter får
 * ændringen i størrelse som muted ren tekst uden pil ("+23,0 %"). Skifter fortegnet, vises stadig pil +
 * procent (02c.4); "-" når tallet har kvalitetsflag, mangler eller forrige er 0.
 */
export function changeText(prev: number | null | undefined, last: number | null | undefined, kind: StatementRow["kind"] = "line", flagged = false): { text: string; tone: "up" | "down" | "" } {
  if (flagged || typeof prev !== "number" || typeof last !== "number" || prev === 0) return { text: "", tone: "" };
  const sum = kind === "subtotal" || kind === "bottom";
  if (!sum) {
    const pct = ((Math.abs(last) - Math.abs(prev)) / Math.abs(prev)) * 100;
    return { text: formatPercent(pct), tone: "" };
  }
  const pct = changePercent(prev, last);
  if (pct === null) return { text: "", tone: "" };
  return { text: `${pct < 0 ? "▼" : "▲"} ${formatPercent(Math.abs(pct), false)}`, tone: pct < 0 ? "down" : "up" };
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
  bare = false,
  scale: forcedScale,
  deltaLabel = "Ændring",
  showDelta = true,
  headLabel,
  unitSuffix = "",
  newestFirst = false,
  short = false,
  expandAll = false,
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
  /** Uden sektionsramme (titel og luft), når tabellen indgår i LassoFinancialStatements (19.1). */
  bare?: boolean;
  /** Fast enhed fra værktøjslinjens enhedsvælger (19.1) i stedet for den automatiske. */
  scale?: AmountScale;
  /** Overskrift på ændringskolonnen, fx "Δ 2024". */
  deltaLabel?: string;
  /** Uden ændringskolonne (balance og pengestrøm, 19.4/19.5). */
  showDelta?: boolean;
  /** Tekst i hovedets første celle i stedet for enheden, fx "Resultatopgørelse" (tablet 26f.3). */
  headLabel?: string;
  /** Tilføjes enheden i hovedet, fx ", 31.12" → "T. KR., 31.12" (19.4). */
  unitSuffix?: string;
  /** Nyeste år først (tablet 26f.3: 2025, 2024, 2023). */
  newestFirst?: boolean;
  /** Brug rækkernes korte etiketter (`short`). */
  short?: boolean;
  /** "Vis alt" (Jakob 01.10): alle foldbare rækker står foldet ud. */
  expandAll?: boolean;
}) {
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set());
  const wrap = (children: ReactNode) => (bare ? <div className="lasso-stmt-bare">{children}</div> : <Section title={title} span="full">{children}</Section>);
  if (loading) return wrap(<DataState state="loading" lines={8} height={420} />);
  if (error) return wrap(<DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />);
  if (emptyReason) return wrap(<DataState state="empty" reason={emptyReason} />);
  const allValues = sections.flatMap((s) => s.rows.flatMap((r) => r.values.filter((v): v is number => typeof v === "number")));
  const scale = forcedScale ?? (allValues.length ? amountScale(allValues, currencyUnit(currency)) : null);
  const order = years.map((_, i) => i);
  if (newestFirst) order.reverse();
  const fmt = (v: number | null | undefined) => {
    if (v == null) return null;
    return scale ? formatScaled(v, scale) : formatScaled(v, { divisor: 1, label: unit });
  };

  return wrap(
      <div className="lasso-table-wrap">
        <div className={`lasso-stmt ${prefix}`}>
          <div className={`lasso-stmt__row lasso-stmt__row--head ${prefix}__head`}>
            <div className={`lasso-stmt__label${headLabel ? " lasso-stmt__label--named" : ""}`}>{headLabel ?? `${(scale ? scale.label : unit).toUpperCase()}${unitSuffix}`}</div>
            {order.map((i) => (
              <div key={years[i]} className={`lasso-stmt__year ${i === years.length - 1 ? "lasso-stmt__year--last" : ""}`}>
                {years[i]}
              </div>
            ))}
            {showDelta ? <div className="lasso-stmt__delta">{deltaLabel}</div> : null}
          </div>
          {sections.map((section, si) => (
            <div className="lasso-stmt__section" key={section.heading ?? si}>
              {section.heading ? <div className="lasso-stmt__group">{section.heading}</div> : null}
              {section.rows.flatMap((row) => {
                const canOpen = expandable(row);
                const open = canOpen && (expandAll || openKeys.has(row.key));
                const toggle = () =>
                  setOpenKeys((cur) => {
                    const n = new Set(cur);
                    if (n.has(row.key)) n.delete(row.key);
                    else n.add(row.key);
                    return n;
                  });
                const line = (r: StatementRow, child: boolean) => {
                  const change = changeText(r.values.at(-2), r.values.at(-1), r.kind, Boolean(r.flag));
                  const text = short && r.short ? r.short : r.label;
                  return (
                    <div className={`lasso-stmt__row lasso-stmt__row--${r.kind ?? "line"}${child ? " lasso-stmt__row--child" : ""}`} key={child ? `${row.key}:${r.key}` : r.key}>
                      <div className="lasso-stmt__label" title={short && r.short ? r.label : undefined}>
                        {!child && canOpen ? (
                          <button type="button" className="lasso-stmt__toggle" aria-expanded={open} onClick={toggle}>
                            <span className="lasso-stmt__chev" aria-hidden="true">{open ? "▾" : "▸"}</span>
                            {text}
                          </button>
                        ) : (
                          text
                        )}
                      </div>
                      {order.map((i) => {
                        const v = r.values[i];
                        return (
                          <div key={years[i]} className={`lasso-stmt__year ${i === r.values.length - 1 ? "lasso-stmt__year--last" : ""} ${typeof v === "number" && v < 0 ? "lasso-down" : ""}`}>
                            {/* 19.1 (Jakob): kvalitetsflaget står foran tallet. */}
                            {r.flag && i === r.values.length - 1 ? <QualityFlag reason={r.flag} /> : null}
                            {(r.percent ? (v == null ? null : formatPercent(v, false)) : fmt(v)) ?? <span className="lasso-notreported">-</span>}
                          </div>
                        );
                      })}
                      {showDelta ? (
                        <div className={`lasso-stmt__delta ${change.tone === "down" ? "lasso-down" : change.tone === "up" ? "lasso-up" : "lasso-stmt__delta--plain"}`}>
                          {(r.percent ? "" : change.text) || <span className="lasso-notreported">-</span>}
                        </div>
                      ) : null}
                    </div>
                  );
                };
                return [line(row, false), ...(open ? (row.children ?? []).map((c) => line(c, true)) : [])];
              })}
            </div>
          ))}
        </div>
      </div>,
  );
}
