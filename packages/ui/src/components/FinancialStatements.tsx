import { useState } from "react";
import {
  amountScale,
  currencyUnit,
  formatDate,
  formatPercent,
  formatScaled,
  noStatementsReason,
  changePercent,
  type AmountScale,
  type CompanyVM,
  type FinancialStatementsVM,
} from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import type { ViewAction } from "../types.js";
import { ShellIcon } from "./ShellIcons.js";
import { Tabs } from "./Tabs.js";
import { QualityFlag, StatementTable, type StatementRow, type StatementSection } from "./statementTable.js";
import { balanceRowsCompact, balanceSections, cashFlowRows, incomeRows, incomeRowsCompact } from "./statementRows.js";

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
  /** Regnskabsåret, periodevælgeren starter på; findes det ikke, vises seneste år. */
  year?: number;
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

/** Δ mod året før: "+7,5 %"; underposter som ændring i størrelse ("+9,1 %"); også ved fortegnsskift (02c.4). "-" ved kvalitetsflag, manglende tal eller forrige = 0 (26d.9). */
function deltaText(prev: number | null | undefined, cur: number | null | undefined, line = false, flagged = false): { text: string; tone: "up" | "down" | "" } {
  if (flagged || typeof prev !== "number" || typeof cur !== "number" || prev === 0) return { text: "-", tone: "" };
  const pct = line ? ((Math.abs(cur) - Math.abs(prev)) / Math.abs(prev)) * 100 : changePercent(prev, cur);
  if (pct === null) return { text: "-", tone: "" };
  return { text: formatPercent(pct), tone: pct < 0 ? "down" : "up" };
}

/**
 * Mobilens resultatopgørelse (26d.9): to talkolonner maks (valgt år + Δ), sumlinjer 600,
 * 2 px ink-streg over årets resultat, aldrig fyld. Negative sumtal i rødt med ægte minus. Kun
 * toplinjens positive Δ er grøn; øvrige Δ er muted.
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
        const d = deltaText(r.values.length > 1 ? r.values.at(-2) : undefined, cur, (r.kind ?? "line") === "line", Boolean(r.flag));
        return (
          <div key={r.key} className={`lasso-fs-m__row lasso-fs-m__row--${r.kind ?? "line"}`}>
            <span className="lasso-fs-m__label">{r.label}</span>
            <span className={`lasso-fs-m__value${typeof cur === "number" && cur < 0 ? " lasso-down" : ""}`}>
              {r.flag ? <QualityFlag reason={r.flag} /> : null}
              {typeof cur === "number" ? formatScaled(cur, scale) : <span className="lasso-notreported">-</span>}
            </span>
            <span className={`lasso-fs-m__delta${r.key === "top" && d.tone === "up" ? " lasso-up" : ""}`}>{d.text}</span>
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
  const v = (n: number | null | undefined) => (typeof n === "number" ? <span className={n < 0 ? "lasso-down" : undefined}>{formatScaled(n, scale)}</span> : <span className="lasso-notreported">-</span>);
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
            {typeof r.v === "number" && r.v !== 0 ? <span className={`lasso-fs-cf__bar lasso-fs-cf__bar--${r.v < 0 ? "neg" : "pos"}`} style={{ width: `max(16px, ${(Math.abs(r.v) / max) * 100}%)` }} /> : null}
          </span>
          <span className={`lasso-fs-cf__value${typeof r.v === "number" && r.v < 0 ? " lasso-down" : ""}`}>{typeof r.v === "number" ? formatScaled(r.v, scale) : "-"}</span>
        </div>
      ))}
      <div className="lasso-fs-cf__row lasso-fs-cf__row--total">
        <span className="lasso-fs-cf__label">Ændring i likvider</span>
        <span className={`lasso-fs-cf__value${typeof c.netCashFlow === "number" && c.netCashFlow < 0 ? " lasso-down" : ""}`}>{typeof c.netCashFlow === "number" ? formatScaled(c.netCashFlow, scale) : "-"}</span>
      </div>
    </div>
  );
}

/**
 * Regnskabsdetaljer med værktøjslinje (katalog 19.1, mobil 26d.8–26d.11, tablet 26f.3, 26h.2).
 * Desktop: værktøjslinjen i en kortramme (56 px): [Selskab | Koncern] (niveau 3, valgt = 1 px ink-kant
 * og 600), periode-dropdown "2025, 01.01–31.12", enheds-dropdown "t. kr." uden etiket,
 * revisorpåtegningen som muted tekst og "Hent PDF" yderst til højre. Ingen År/Halvår/Kvartal (kun
 * årsregnskaber, Jakob 29.09). Under linjen står
 * resultatopgørelsen (2 år + ændring) og balance og pengestrøm side om side (2 år, uden ændring).
 * Tablet: titel + "t. kr., 3 år synlige" og segment "Resultat + balance | Pengestrøm"; to opgørelser
 * side om side med 3 år, nyeste først. Mobil: titel + periode og 36 px årsdropdown, segment
 * "Resultat | Balance | Pengestrøm" i fuld bredde, valgt år + Δ, balancen som to kort og pengestrømmen
 * med retningsbjælker. Formen skifter med container queries, ingen separat mobilkomponent.
 */
export function FinancialStatements({ statements, company, statement = "income", years = 2, year: startYear, title, error, onAction }: FinancialStatementsProps) {
  const heading = title ?? "Regnskab";
  const [tab, setTab] = useState<StatementKind>(statement);
  const [pairSel, setPair] = useState<"balance" | "cashflow">(statement === "cashflow" ? "cashflow" : "balance");
  const [scopeSel, setScope] = useState<Scope | null>(null);
  const [unit, setUnit] = useState<Unit>("t");
  const [yearSel, setYear] = useState<number | null>(startYear ?? null);

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
  /** Én opgørelse som tabel. `tablet`: nyeste år først, korte etiketter, uden ændringskolonne (26f.3). */
  const tableFor = (kind: StatementKind, n: number, key: string, tablet = false) => {
    const keep = upTo(n);
    const common = { bare: true, unit: scale.label, scale, newestFirst: tablet, short: tablet } as const;
    if (kind === "income") {
      const shown = s.incomeStatement.filter((y) => keep.has(y.year));
      if (!shown.length) return <StatementTable key={key} bare unit={scale.label} years={[]} sections={[]} prefix="lasso-income" emptyReason={noStatementsReason(company)} />;
      return <StatementTable key={key} {...common} headLabel={tablet ? HEADING.income : undefined} showDelta={!tablet} years={shown.map((y) => y.year)} sections={[{ rows: tablet ? incomeRowsCompact(shown) : incomeRows(shown) }]} prefix="lasso-income" />;
    }
    if (kind === "balance") {
      const shown = s.balanceSheet.filter((y) => keep.has(y.year));
      if (!shown.length) return <StatementTable key={key} bare unit={scale.label} years={[]} sections={[]} prefix="lasso-balance" emptyReason={noStatementsReason(company)} />;
      const sections: StatementSection[] = tablet ? [{ rows: balanceRowsCompact(shown) }] : balanceSections(shown);
      return <StatementTable key={key} {...common} headLabel={tablet ? "Balance 31.12" : undefined} unitSuffix=", 31.12" showDelta={false} years={shown.map((y) => y.year)} sections={sections} prefix="lasso-balance" />;
    }
    const shown = s.cashFlow.filter((y) => keep.has(y.year));
    if (!shown.length) return <StatementTable key={key} bare unit={scale.label} years={[]} sections={[]} prefix="lasso-cashflow" emptyReason="Pengestrømsopgørelse er ikke indberettet." />;
    return <StatementTable key={key} {...common} headLabel={tablet ? HEADING.cashflow : undefined} showDelta={false} years={shown.map((y) => y.year)} sections={[{ rows: cashFlowRows(shown, s) }]} prefix="lasso-cashflow" />;
  };
  const mobileIncome = s.incomeStatement.filter((y) => y.year === prevYear || y.year === year);
  const span = Math.max(2, Math.min(5, years));

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

  const periodOf = (y: number) => {
    const inc = s.incomeStatement.find((r) => r.year === y);
    const end = inc?.periodEnd ?? s.balanceSheet.find((r) => r.year === y)?.periodEnd;
    const p = periodText(inc?.periodStart, end);
    // "2025, 01.01–31.12" (19.1): perioden uden år, da året står først.
    return p && p.length > 10 ? `${y}, ${p.slice(0, 11)}` : String(y);
  };

  // Mobil (26d.8): 36 px årsdropdown i sektionens hoved.
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
  // Tablet (26f.3): "Resultat + balance | Pengestrøm" i sektionens hoved.
  const tabletSegment = (
    <Tabs
      level={3}
      ariaLabel="Opgørelser side om side"
      items={[
        { id: "balance", label: "Resultat + balance" },
        { id: "cashflow", label: "Pengestrøm", disabled: s.cashFlow.length === 0, disabledReason: "Pengestrømsopgørelse er ikke indberettet" },
      ]}
      value={pairSel}
      onChange={(id) => setPair(id as "balance" | "cashflow")}
      className="lasso-fs__pairseg"
    />
  );
  const tabletYears = Math.min(3, allYears.indexOf(year) + 1);

  return (
    <Section
      title={`${heading} ${year}`}
      subtitle={<span className="lasso-fs__sub"><span className="lasso-fs__sub-m">{sub}</span><span className="lasso-fs__sub-t">{`${scale.label}, ${tabletYears} år synlige`}</span></span>}
      span="full"
      className="lasso-fs"
      action={
        <>
          {yearSelect}
          {tabletSegment}
        </>
      }
    >
      {/* Desktop (19.1): værktøjslinjen i en kortramme. */}
      <div className="lasso-fs__toolbar" role="toolbar" aria-label="Regnskabets værktøjslinje">
        <Tabs
          level={3}
          ariaLabel="Selskab eller koncern"
          items={[
            { id: "Selskab", label: "Selskab", disabled: baseScope !== "Selskab" && !hasOther, disabledReason: "Kun koncernregnskab hentet" },
            { id: "Koncern", label: "Koncern", disabled: baseScope !== "Koncern" && !hasOther, disabledReason: "Intet koncernregnskab indberettet" },
          ]}
          value={scope}
          onChange={(id) => setScope(id as Scope)}
          className="lasso-fs__scope"
        />
        {/* 19.1 (Jakob 29.09): ingen periodevælger (År/Halvår/Kvartal); Lasso viser kun årsregnskaber. */}
        <label className="lasso-fs__select lasso-fs__periodsel">
          <span className="lasso-sr">Regnskabsperiode</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[...allYears].reverse().map((y) => (
              <option key={y} value={y}>
                {periodOf(y)}
              </option>
            ))}
          </select>
        </label>
        <label className="lasso-fs__select lasso-fs__unit">
          <span className="lasso-sr">Enhed</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="t">t. kr.</option>
            <option value="mio">mio. kr.</option>
            <option value="auto">Automatisk</option>
          </select>
        </label>
        <span className="lasso-fs__spacer" />
        {s.auditorOpinion ? <span className="lasso-fs__opinion" title={s.auditorOpinion}>{s.auditorOpinion}</span> : null}
        {pdfButton}
      </div>

      {/* Desktop (19): resultatopgørelsen (2 år + ændring), balance og pengestrøm side om side under. */}
      <div className="lasso-fs__wide">
        <div className="lasso-fs__block">{tableFor("income", span, "w-income")}</div>
        <div className="lasso-fs__pair">
          <div className="lasso-fs__col">
            <h4 className="lasso-fs__colhead">{HEADING.balance}</h4>
            {tableFor("balance", 2, "w-balance")}
          </div>
          {s.cashFlow.length ? (
            <div className="lasso-fs__col">
              <h4 className="lasso-fs__colhead">{HEADING.cashflow}</h4>
              {tableFor("cashflow", 2, "w-cashflow")}
            </div>
          ) : null}
        </div>
      </div>

      {/* Tablet (26f.3): to opgørelser side om side med 3 år, nyeste først; pengestrøm skiftes ind med segmentet. */}
      <div className="lasso-fs__tablet">
        <div className="lasso-fs__col">{tableFor("income", 3, "t-income", true)}</div>
        <div className="lasso-fs__col">{tableFor(pairSel, 3, `t-${pairSel}`, true)}</div>
      </div>

      {/* Mobil (26d.8–26d.11): én opgørelse ad gangen via segment i fuld bredde, valgt år + Δ. */}
      <div className="lasso-fs__mobile">
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
        {tab === "income" ? (
          mobileIncome.length ? <MobileRows rows={incomeRows(mobileIncome)} year={year} prevYear={mobileIncome.length > 1 ? prevYear : undefined} scale={scale} /> : <DataState state="empty" reason={noStatementsReason(company)} />
        ) : tab === "balance" ? (
          <MobileBalance s={s} year={year} scale={scale} />
        ) : (
          <MobileCashFlow s={s} year={year} scale={scale} />
        )}
      </div>
      {s.note ? <p className="lasso-fs__note">{s.note}</p> : null}
    </Section>
  );
}
