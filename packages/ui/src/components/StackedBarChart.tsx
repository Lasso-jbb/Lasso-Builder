import { amountScale, currencyUnit, formatDate, formatNumber, formatScaled, type AmountScale, type FinancialStatementsVM, type FinancialsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_H, CHART_TOP, makeYScale, niceTicks } from "../charts.js";
import { isCompact } from "../chartPick.js";

/** Én post i en stak. `tone` er farveklassen (chart-1 … chart-4b); `light` = mørk tekst indeni. */
interface Segment {
  key: string;
  label: string;
  value: number;
  tone: "s1" | "s2" | "s3" | "s4" | "s4b";
}

interface BalanceYear {
  year: number;
  assets: Segment[];
  liabilities: Segment[];
  total: number;
}

const LIGHT = new Set<Segment["tone"]>(["s3", "s4", "s4b"]);
const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Balancen pr. år som to stakke: aktiver i koral-familien (anlæg chart-4, omsætning chart-4b) og
 * passiver med egenkapital i koral (chart-1) nederst og gælden i blå-familien (lang chart-2, kort
 * chart-3) ovenpå, så egenkapitalen kan læses på tværs af årene. Fra det fulde regnskab (19), når
 * det findes; ellers kun egenkapital og gæld fra nøgletallene (aktiverne som én post).
 */
export function balanceYears(financials: FinancialsVM | undefined, statements: FinancialStatementsVM | undefined, years: number): BalanceYear[] {
  const byYear = new Map((statements?.balanceSheet ?? []).map((b) => [b.year, b]));
  const out: BalanceYear[] = [];
  for (const y of (financials?.years ?? []).slice(-years)) {
    const b = byYear.get(y.year);
    const equity = num(b?.equityTotal) ? b!.equityTotal! : y.equity;
    const long = b?.longTermLiabilities;
    const short = b?.shortTermLiabilities;
    const debtTotal = num(b?.liabilitiesTotal) ? b!.liabilitiesTotal! : num(long) && num(short) ? long + short : y.liabilities;
    if (!num(equity) || !num(debtTotal)) continue;
    const liabilities: Segment[] = [{ key: "equity", label: "Egenkapital", value: equity, tone: "s1" }];
    if (num(long) && num(short)) {
      liabilities.push({ key: "long", label: "Langfristet gæld", value: long, tone: "s2" });
      liabilities.push({ key: "short", label: "Kortfristet gæld", value: short, tone: "s3" });
    } else {
      liabilities.push({ key: "debt", label: "Gæld", value: debtTotal, tone: "s2" });
    }
    const total = liabilities.reduce((s, x) => s + x.value, 0);
    const fixed = b?.fixedAssetsTotal;
    const current = b?.currentAssetsTotal;
    const assets: Segment[] =
      num(fixed) && num(current)
        ? [
            { key: "fixed", label: "Anlægsaktiver", value: fixed, tone: "s4" },
            { key: "current", label: "Omsætningsaktiver", value: current, tone: "s4b" },
          ]
        : [{ key: "assets", label: "Aktiver i alt", value: num(b?.assetsTotal) ? b!.assetsTotal! : num(y.assetsTotal) ? y.assetsTotal : total, tone: "s4" }];
    out.push({ year: y.year, assets, liabilities, total });
  }
  return out;
}

/** Korte navne inde i segmenterne (13.5: "Anlæg 7,3", "Omsætning 11,1"; legenden bruger dem også). */
const SHORT: Record<string, string> = {
  fixed: "Anlæg",
  current: "Omsætning",
  assets: "Aktiver",
  equity: "Egenkapital",
  long: "Langfristet",
  short: "Kortfristet",
  debt: "Gæld",
};
const short = (s: Segment) => SHORT[s.key] ?? s.label;

function Legend({ segments, className = "lasso-chart__legend--right" }: { segments: readonly Segment[]; className?: string }) {
  return (
    <div className={`lasso-chart__legend ${className}`}>
      {segments.map((s) => (
        <span className="lasso-chart__legend-item" key={s.key}>
          <span className={`lasso-chart__swatch lasso-chart__swatch--${s.tone}`} aria-hidden="true" />
          {short(s)}
        </span>
      ))}
    </div>
  );
}

/** "31.12.2025" fra regnskabsårets slutdato; ellers året. */
function balanceDate(financials: FinancialsVM, year: number): string {
  const end = financials.years.find((y) => y.year === year)?.periodEnd;
  return end ? formatDate(end) : String(year);
}

/**
 * Mobil (26b.3): balancen lagt ned som to vandrette bjælker (Aktiver, Passiver) med segmentværdierne
 * skrevet inde i bjælkerne (navn + tal, når der er plads), én legende-linje under og "I alt" til højre.
 */
function HorizontalBalance({ row, scale }: { row: BalanceYear; scale: AmountScale }) {
  const label = (v: number) => formatScaled(v, scale);
  const sides: { title: string; segments: Segment[] }[] = [
    { title: "Aktiver", segments: row.assets },
    { title: "Passiver", segments: row.liabilities },
  ];
  const max = Math.max(...sides.map((s) => s.segments.reduce((a, x) => a + Math.max(0, x.value), 0)), 1);
  return (
    <div className="lasso-hbal">
      {sides.map((side) => (
        <div className="lasso-hbal__side" key={side.title}>
          <div className="lasso-hbal__title">{side.title}</div>
          <div className="lasso-hbal__bar">
            {side.segments.map((s) => {
              const pct = (Math.max(0, s.value) / max) * 100;
              // Navnet står med, når segmentet er bredt nok (ca. 40 % af bjælken); ellers kun tallet.
              return (
                <span key={s.key} className={`lasso-hbal__seg lasso-chart-fill--${s.tone}${LIGHT.has(s.tone) ? " lasso-hbal__seg--light" : ""}`} style={{ width: `${pct}%` }} title={`${s.label} ${label(s.value)} ${scale.label}`}>
                  {pct >= 12 ? (pct >= 40 ? `${short(s)} ${label(s.value)}` : label(s.value)) : ""}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      <div className="lasso-hbal__foot">
        <Legend segments={[...row.assets, ...row.liabilities]} className="lasso-hbal__legend" />
        <span className="lasso-hbal__total">I alt {label(row.total)}</span>
      </div>
    </div>
  );
}

/**
 * Stablede søjler, balance (katalog 13.5, node ADW-0): balancen på én dato (seneste balancedag) som to
 * brede stablede søjler, Aktiver og Passiver, med segmentets navn og værdi inde i segmentet og totalen
 * i 600 under søjlen. Legenden (passivernes poster) øverst til højre.
 * Mobil (26b.3): lagt ned som to vandrette bjælker med værdierne i bjælkerne.
 */
export function StackedBarChart({ financials, statements, years, error }: { financials?: FinancialsVM; statements?: FinancialStatementsVM; years: number; error?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const compact = isCompact(W);
  const rows = balanceYears(financials, statements, years);
  const row = rows.at(-1);

  if (!financials) {
    return (
      <Section title="Balance" span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={CHART_H} />}
      </Section>
    );
  }
  if (!row) {
    return (
      <Section title="Balance" span="half" className="lasso-chart">
        <DataState state="empty" reason="Virksomheden har ikke oplyst egenkapital og gæld i sine regnskaber." height={CHART_H} />
      </Section>
    );
  }

  const scale = amountScale([...row.assets, ...row.liabilities].map((s) => s.value), currencyUnit(financials.currency));
  const label = (v: number) => formatScaled(v, scale);
  const date = balanceDate(financials, row.year);

  if (compact) {
    return (
      <Section title={`Balance ${date}`} span="half" className="lasso-chart lasso-chart--stacked" action={<span className="lasso-chart__unit">{scale.label}</span>}>
        <div ref={ref}>
          <HorizontalBalance row={row} scale={scale} />
        </div>
      </Section>
    );
  }

  const bottom = 46;
  const sum = (segs: readonly Segment[]) => segs.reduce((a, s) => a + Math.max(0, s.value), 0);
  const ticks = niceTicks(0, Math.max(sum(row.assets), sum(row.liabilities)) / scale.divisor);
  const tMax = ticks.at(-1)!;
  const tMin = ticks[0]!;
  const plotH = CHART_H - CHART_TOP - bottom;
  const plotW = Math.max(0, W - CHART_AXIS_W);
  const y = makeYScale(tMin, tMax, CHART_TOP, plotH);
  const barW = Math.max(48, Math.min(160, plotW * 0.3));
  const cols = [
    { title: "Aktiver", segments: row.assets, total: sum(row.assets) },
    { title: "Passiver", segments: row.liabilities, total: sum(row.liabilities) },
  ];

  const stack = (segs: readonly Segment[], x: number) => {
    let acc = 0;
    return segs.map((s) => {
      const from = acc;
      acc += Math.max(0, s.value) / scale.divisor;
      const yTop = y(acc);
      const h = Math.max(y(from) - yTop, s.value > 0 ? 1 : 0);
      return (
        <g key={s.key}>
          <rect className={`lasso-chart__bar lasso-chart__bar--${s.tone}`} x={x} y={yTop} width={barW} height={h}>
            <title>{`${s.label} ${label(s.value)} ${scale.label}`}</title>
          </rect>
          {h >= 22 ? (
            <text className={`lasso-chart__seg-label${LIGHT.has(s.tone) ? " lasso-chart__seg-label--dark" : ""}`} x={x + barW / 2} y={yTop + h / 2 + 4} textAnchor="middle">
              {barW >= 96 ? `${short(s)} ${label(s.value)}` : label(s.value)}
            </text>
          ) : null}
        </g>
      );
    });
  };

  return (
    <Section title="Balance" subtitle={`${scale.label}, ${date}`} span="half" className="lasso-chart lasso-chart--stacked" action={<Legend segments={row.liabilities} />}>
      <div ref={ref} className="lasso-chart__plot">
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`Balance ${date}: aktiver ${label(cols[0]!.total)} og passiver ${label(cols[1]!.total)} ${scale.label}`}>
            {ticks.map((tk) => (
              <g key={tk}>
                <line className="lasso-chart__grid" x1={CHART_AXIS_W} x2={W} y1={y(tk)} y2={y(tk)} />
                <text className="lasso-chart__tick" x={0} y={y(tk) + 4}>{formatNumber(tk)}</text>
              </g>
            ))}
            {cols.map((c, i) => {
              const cx = CHART_AXIS_W + plotW * (i === 0 ? 0.3 : 0.7);
              const x = cx - barW / 2;
              return (
                <g key={c.title}>
                  {stack(c.segments, x)}
                  {/* 13.5: navn og total på én linje under søjlen, "Aktiver · 62,8" i 600. */}
                  <text className="lasso-chart__value lasso-chart__value--last" x={cx} y={y(0) + 20} textAnchor="middle">
                    {`${c.title} \u00b7 ${label(c.total)}`}
                  </text>
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
    </Section>
  );
}
