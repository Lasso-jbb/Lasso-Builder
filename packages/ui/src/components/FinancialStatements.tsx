import { useState } from "react";
import {
  amountScale,
  currencyUnit,
  formatDate,
  formatPercent,
  formatScaled,
  noStatementsReason,
  percentChange,
  type AmountScale,
  type CompanyVM,
  type FinancialStatementsVM,
} from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import type { ViewAction } from "../types.js";
import { ShellIcon } from "./ShellIcons.js";
import { Tabs } from "./Tabs.js";
import { QualityFlag, StatementTable, type StatementRow, type StatementSection } from "./statementTable.js";
import { balanceSections, cashFlowRows, incomeRows } from "./statementRows.js";

export type StatementKind = "income" | "balance" | "cashflow";
type Scope = "Koncern" | "Selskab";
type Unit = "auto" | "t" | "mio";

const TAB_LABEL: Record<StatementKind, string> = { income: "Resultat", balance: "Balance", cashflow: "Pengestrøm" };
const HEADING: Record<StatementKind, string> = { income: "Resultatopgørelse", balance: "Balance", cashflow: "Pengestrømsopgørelse" };

export interface FinancialStatementsProps {
  statements?: FinancialStatementsVM;
  company?: CompanyVM;
  /** Opgørelsen, der er valgt fra start. */
  statement?: StatementKind;
  /** År side om side på desktop (2–5, standard 5). Tablet viser 3, mobil ét år + Δ. */
  years?: number;
  title?: string;
  error?: string;
  /** PDF-linket åbnes via værten, når den findes; ellers et almindeligt link. */
  onAction?: (a: ViewAction) => void;
}

/** Værdierne i ét scope (selskab eller koncern); det andet scope ligger i `alternate`. */
function scoped(s: FinancialStatementsVM, scope: Scope): FinancialStatementsVM {
  if ((s.scope ?? "Selskab") === scope || !s.alternate || s.alternate.scope !== scope) return s;
  return { ...s, ...s.alternate, lassoId: s.lassoId, alternate: undefined };
}

function unitScale(unit: Unit, values: readonly number[], currency: string | undefined): AmountScale {
  const cur = currencyUnit(currency);
  if (unit === "t") return { divisor: 1_000, label: `t. ${cur}` };
  if (unit === "mio") return { divisor: 1_000_000, label: `mio. ${cur}` };
  return amountScale(values, cur);
}

/** "01.01–31.12.2025" fra periodens start og slut. */
function periodText(start?: string, end?: string): string | undefined {
  if (!end) return undefined;
  const e = formatDate(end);
  if (!start) return e;
  const s = formatDate(start);
  return `${s.slice(0, 5)}–${e}`;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12.5l2.7 2.7L16 9.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Δ mod året før: "+7,5 %", "—" ved fortegnsskift eller manglende tal. */
function deltaText(prev: number | null | undefined, cur: number | null | undefined): { text: string; tone: "up" | "down" | "" } {
  if (typeof prev !== "number" || typeof cur !== "number" || prev === 0 || Math.sign(prev) !== Math.sign(cur)) return { text: "—", tone: "" };
  const pct = percentChange([prev, cur]);
  if (pct === null) return { text: "—", tone: "" };
  return { text: formatPercent(pct), tone: pct < 0 ? "down" : "up" };
}

/**
 * Mobilens resultatopgørelse (26d.8): to talkolonner maks (valgt år + Δ), sumlinjer 600,
 * tynd ink-streg over årets resultat, aldrig fyld. Negative tal i rødt med ægte minus.
 */
function MobileRows({ rows, year, prevYear, scale }: { rows: StatementRow[]; year: number; prevYear?: number; scale: AmountScale }) {
  return (
    <div className="lasso-fs-m">
      <div className="lasso-fs-m__row lasso-fs-m__row--head">
        <span className="lasso-fs-m__label">Post</span>
        <span className="lasso-fs-m__value">{year}</span>
        <span className="lasso-fs-m__delta">{prevYear ? `Δ ${prevYear}` : "Δ"}</span>
      </div>
      {rows.map((r) => {
        const cur = r.values.at(-1);
        const d = deltaText(r.values.length > 1 ? r.values.at(-2) : undefined, cur);
        return (
          <div key={r.key} className={`lasso-fs-m__row lasso-fs-m__row--${r.kind ?? "line"}`}>
            <span className="lasso-fs-m__label">{r.label}</span>
            <span className={`lasso-fs-m__value${typeof cur === "number" && cur < 0 ? " lasso-down" : ""}`}>
              {typeof cur === "number" ? formatScaled(cur, scale) : <span className="lasso-notreported">—</span>}
              {r.flag ? <QualityFlag reason={r.flag} /> : null}
            </span>
            <span className={`lasso-fs-m__delta${r.kind === "subtotal" && d.tone === "up" ? " lasso-up" : ""}`}>{d.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Balancen på mobil (26d.10): to små kort side om side, aktiver og passiver med to poster hver. */
function MobileBalance({ s, year, scale }: { s: FinancialStatementsVM; year: number; scale: AmountScale }) {
  const b = s.balanceSheet.find((y) => y.year === year);
  if (!b) return <DataState state="empty" reason="Balancen er ikke indberettet for året." />;
  const v = (n: number | null | undefined) => (typeof n === "number" ? <span className={n < 0 ? "lasso-down" : undefined}>{formatScaled(n, scale)}</span> : <span className="lasso-notreported">—</span>);
  const cards = [
    { key: "a", head: "Aktiver", total: b.assetsTotal, rows: [["Anlæg", b.fixedAssetsTotal], ["Oms.aktiver", b.currentAssetsTotal]] as const },
    { key: "p", head: "Passiver", total: b.liabilitiesAndEquityTotal ?? b.assetsTotal, rows: [["Egenkapital", b.equityTotal], ["Gæld", b.liabilitiesTotal]] as const },
  ];
  return (
    <div className="lasso-fs-bal">
      {cards.map((c) => (
        <div key={c.key} className="lasso-fs-bal__card">
          <div className="lasso-fs-bal__row lasso-fs-bal__row--head">
            <span>{c.head}</span>
            {v(c.total)}
          </div>
          {c.rows.map(([label, n]) => (
            <div key={label} className="lasso-fs-bal__row">
              <span>{label}</span>
              {v(n)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Pengestrømmen på mobil (26d.11): rækker med retningsbjælke (længde efter beløb, farve + fortegn). */
function MobileCashFlow({ s, year, scale }: { s: FinancialStatementsVM; year: number; scale: AmountScale }) {
  const c = s.cashFlow.find((y) => y.year === year);
  if (!c) return <DataState state="empty" reason="Pengestrømsopgørelse er ikke indberettet." />;
  const rows = [
    { key: "op", label: "Drift", v: c.operatingCashFlow },
    { key: "inv", label: "Investering", v: c.investingCashFlow },
    { key: "fin", label: "Finansiering", v: c.financingCashFlow },
  ];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.v ?? 0)));
  return (
    <div className="lasso-fs-cf">
      {rows.map((r) => (
        <div key={r.key} className="lasso-fs-cf__row">
          <span className="lasso-fs-cf__label">{r.label}</span>
          <span className="lasso-fs-cf__track" aria-hidden="true">
            {typeof r.v === "number" && r.v !== 0 ? <span className={`lasso-fs-cf__bar lasso-fs-cf__bar--${r.v < 0 ? "neg" : "pos"}`} style={{ width: `${Math.max(6, (Math.abs(r.v) / max) * 100)}%` }} /> : null}
          </span>
          <span className={`lasso-fs-cf__value${typeof r.v === "number" && r.v < 0 ? " lasso-down" : ""}`}>{typeof r.v === "number" ? formatScaled(r.v, scale) : "—"}</span>
        </div>
      ))}
      <div className="lasso-fs-cf__row lasso-fs-cf__row--total">
        <span className="lasso-fs-cf__label">Ændring i likvider</span>
        <span className={`lasso-fs-cf__value${typeof c.netCashFlow === "number" && c.netCashFlow < 0 ? " lasso-down" : ""}`}>{typeof c.netCashFlow === "number" ? formatScaled(c.netCashFlow, scale) : "—"}</span>
      </div>
    </div>
  );
}

/**
 * Regnskabsdetaljer med værktøjslinje (katalog 19.1, mobil 26d.8–26d.11, tablet 26f.3, 26h.2).
 * Værktøjslinjen: koncern/selskab og periode (år, halvår, kvartal) som segmentkontroller
 * (niveau 3, valgt = 1 px ink-kant og 600, aldrig fyld), enhed, revisorpåtegning som tekst med
 * flueben (aldrig badge) og "Hent PDF". Halvår/kvartal er dæmpet 45 % med tooltip, når selskabet
 * kun indberetter årsregnskab. Opgørelsen vælges med en segmentkontrol (Resultat, Balance,
 * Pengestrøm). Desktop: én opgørelse med op til 5 år. Tablet: to opgørelser side om side med 3 år
 * (pengestrøm skiftes ind). Mobil: ét år (dropdown) + Δ, balancen som to kort og pengestrømmen
 * med retningsbjælker. Formen skifter med container queries, ingen separat mobilkomponent.
 */
export function FinancialStatements({ statements, company, statement = "income", years = 5, title, error, onAction }: FinancialStatementsProps) {
  const heading = title ?? "Regnskab";
  const [tab, setTab] = useState<StatementKind>(statement);
  const [scopeSel, setScope] = useState<Scope | null>(null);
  const [period, setPeriod] = useState("year");
  const [unit, setUnit] = useState<Unit>("auto");
  const [yearSel, setYear] = useState<number | null>(null);

  if (!statements) {
    return (
      <Section title={heading} span="full" className="lasso-fs">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} title="Regnskab kunne ikke hentes" reason={error} /> : <DataState state="loading" lines={8} height={420} />}
      </Section>
    );
  }
  if (statements.incomeStatement.length === 0 && statements.balanceSheet.length === 0) {
    return (
      <Section title={heading} span="full" className="lasso-fs">
        <DataState state="empty" reason={noStatementsReason(company)} />
      </Section>
    );
  }

  const baseScope: Scope = statements.scope ?? "Selskab";
  const scope = scopeSel ?? baseScope;
  const s = scoped(statements, scope);
  const allYears = [...new Set([...s.incomeStatement.map((y) => y.year), ...s.balanceSheet.map((y) => y.year)])].sort((a, b) => a - b);
  const year = yearSel !== null && allYears.includes(yearSel) ? yearSel : allYears.at(-1)!;
  const prevYear = allYears[allYears.indexOf(year) - 1];
  const hasOther = statements.alternate?.scope && statements.alternate.scope !== baseScope;
  const periods = s.periods ?? ["year"];

  const values = [
    ...s.incomeStatement.flatMap((y) => [y.revenue, y.grossProfit, y.profit]),
    ...s.balanceSheet.flatMap((y) => [y.assetsTotal, y.equityTotal]),
  ].filter((v): v is number => typeof v === "number");
  const scale = unitScale(unit, values, s.currency);
  const income = s.incomeStatement.find((y) => y.year === year);
  const sub = [periodText(income?.periodStart, income?.periodEnd ?? s.balanceSheet.find((y) => y.year === year)?.periodEnd), scale.label].filter(Boolean).join(", ");

  const upTo = (n: number) => {
    const idx = allYears.indexOf(year);
    return new Set(allYears.slice(Math.max(0, idx - n + 1), idx + 1));
  };
  const tableFor = (kind: StatementKind, n: number, key: string) => {
    const keep = upTo(n);
    if (kind === "income") {
      const shown = s.incomeStatement.filter((y) => keep.has(y.year));
      if (!shown.length) return <StatementTable key={key} bare unit={scale.label} years={[]} sections={[]} prefix="lasso-income" emptyReason={noStatementsReason(company)} />;
      return <StatementTable key={key} bare unit={scale.label} scale={scale} years={shown.map((y) => y.year)} sections={[{ rows: incomeRows(shown) }]} prefix="lasso-income" />;
    }
    if (kind === "balance") {
      const shown = s.balanceSheet.filter((y) => keep.has(y.year));
      if (!shown.length) return <StatementTable key={key} bare unit={scale.label} years={[]} sections={[]} prefix="lasso-balance" emptyReason={noStatementsReason(company)} />;
      const sections: StatementSection[] = balanceSections(shown);
      return <StatementTable key={key} bare unit={scale.label} scale={scale} years={shown.map((y) => y.year)} sections={sections} prefix="lasso-balance" />;
    }
    const shown = s.cashFlow.filter((y) => keep.has(y.year));
    if (!shown.length) return <StatementTable key={key} bare unit={scale.label} years={[]} sections={[]} prefix="lasso-cashflow" emptyReason="Pengestrømsopgørelse er ikke indberettet." />;
    return <StatementTable key={key} bare unit={scale.label} scale={scale} years={shown.map((y) => y.year)} sections={[{ rows: cashFlowRows(shown, s) }]} prefix="lasso-cashflow" />;
  };
  const pair: StatementKind = tab === "cashflow" ? "cashflow" : "balance";
  const mobileIncome = s.incomeStatement.filter((y) => y.year === prevYear || y.year === year);

  const pdf = s.pdfUrl;
  const pdfButton = pdf ? (
    onAction ? (
      <button type="button" className="lasso-btn lasso-fs__pdf" onClick={() => onAction({ kind: "open-link", url: pdf })}>
        <ShellIcon name="download" size={15} />
        Hent PDF
      </button>
    ) : (
      <a className="lasso-btn lasso-fs__pdf" href={pdf} target="_blank" rel="noopener noreferrer">
        <ShellIcon name="download" size={15} />
        Hent PDF
      </a>
    )
  ) : null;

  const yearSelect = (
    <label className="lasso-fs__yearsel">
      <span className="lasso-sr">Vælg regnskabsår</span>
      <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {[...allYears].reverse().map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Section title={`${heading} ${year}`} subtitle={sub} span="full" className="lasso-fs" action={yearSelect}>
      <div className="lasso-fs__toolbar" role="toolbar" aria-label="Regnskabets værktøjslinje">
        <Tabs
          level={3}
          ariaLabel="Koncern eller selskab"
          items={[
            { id: "Koncern", label: "Koncern", disabled: baseScope !== "Koncern" && !hasOther, disabledReason: "Intet koncernregnskab indberettet" },
            { id: "Selskab", label: "Selskab", disabled: baseScope !== "Selskab" && !hasOther, disabledReason: "Kun koncernregnskab hentet" },
          ]}
          value={scope}
          onChange={(id) => setScope(id as Scope)}
          className="lasso-fs__scope"
        />
        <Tabs
          level={3}
          ariaLabel="Periode"
          items={[
            { id: "year", label: "År" },
            { id: "half", label: "Halvår", disabled: !periods.includes("half"), disabledReason: "Kun årsregnskab indberettet" },
            { id: "quarter", label: "Kvartal", disabled: !periods.includes("quarter"), disabledReason: "Kun årsregnskab indberettet" },
          ]}
          value={period}
          onChange={setPeriod}
          className="lasso-fs__period"
        />
        <label className="lasso-fs__unit">
          <span className="lasso-fs__unit-label">Enhed</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="auto">{unit === "auto" ? scale.label : "Automatisk"}</option>
            <option value="t">t. kr.</option>
            <option value="mio">mio. kr.</option>
          </select>
        </label>
        <span className="lasso-fs__spacer" />
        {s.auditorOpinion ? (
          <span className="lasso-fs__opinion">
            <CheckIcon />
            {s.auditorOpinion}
          </span>
        ) : null}
        {pdfButton}
      </div>

      <Tabs
        level={3}
        ariaLabel="Opgørelse"
        items={(["income", "balance", "cashflow"] as const).map((k) => ({
          id: k,
          label: TAB_LABEL[k],
          disabled: k === "cashflow" && s.cashFlow.length === 0,
          disabledReason: "Pengestrømsopgørelse er ikke indberettet",
        }))}
        value={tab}
        onChange={(id) => setTab(id as StatementKind)}
        className="lasso-fs__tabs"
      />

      {/* Desktop: den valgte opgørelse med op til 5 år. */}
      <div className="lasso-fs__wide">{tableFor(tab, Math.max(2, Math.min(5, years)), "wide")}</div>

      {/* Tablet (26f.3): to opgørelser side om side med 3 år; pengestrøm skiftes ind med segmentet. */}
      <div className="lasso-fs__tablet">
        <div className="lasso-fs__col">
          <h4 className="lasso-fs__colhead">{HEADING.income}</h4>
          {tableFor("income", 3, "t-income")}
        </div>
        <div className="lasso-fs__col">
          <h4 className="lasso-fs__colhead">{HEADING[pair]}</h4>
          {tableFor(pair, 3, `t-${pair}`)}
        </div>
      </div>

      {/* Mobil (26d.8–26d.11): én opgørelse ad gangen, valgt år + Δ. */}
      <div className="lasso-fs__mobile">
        {tab === "income" ? (
          mobileIncome.length ? <MobileRows rows={incomeRows(mobileIncome)} year={year} prevYear={mobileIncome.length > 1 ? prevYear : undefined} scale={scale} /> : <DataState state="empty" reason={noStatementsReason(company)} />
        ) : tab === "balance" ? (
          <MobileBalance s={s} year={year} scale={scale} />
        ) : (
          <MobileCashFlow s={s} year={year} scale={scale} />
        )}
      </div>
    </Section>
  );
}
