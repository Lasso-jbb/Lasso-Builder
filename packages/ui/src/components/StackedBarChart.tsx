import { useState } from "react";
import { amountScale, currencyUnit, formatNumber, formatPercent, formatScaled, type AmountScale, type FinancialStatementsVM, type FinancialsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_H, CHART_TOP, makeYScale, niceTicks, yearRange } from "../charts.js";
import { ChartTooltip, isCompact, useChartPick, type PickRow } from "../chartPick.js";

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

function Legend({ segments }: { segments: readonly Segment[] }) {
  return (
    <div className="lasso-chart__legend lasso-chart__legend--right">
      {segments.map((s) => (
        <span className="lasso-chart__legend-item" key={s.key}>
          <span className={`lasso-chart__swatch lasso-chart__swatch--${s.tone}`} aria-hidden="true" />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Mobil (26b.3): balancen lagt ned som to vandrette bjælker for det valgte år, så segmentværdierne kan læses. */
function HorizontalBalance({ row, scale, years, value, onPick }: { row: BalanceYear; scale: AmountScale; years: readonly number[]; value: number; onPick: (y: number) => void }) {
  const label = (v: number) => formatScaled(v, scale);
  const sides: { title: string; segments: Segment[] }[] = [
    { title: "Aktiver", segments: row.assets },
    { title: "Passiver", segments: row.liabilities },
  ];
  const max = Math.max(...sides.map((s) => s.segments.reduce((a, x) => a + Math.max(0, x.value), 0)), 1);
  return (
    <div className="lasso-hbal">
      <div className="lasso-chart__years" role="group" aria-label="Vælg år">
        {years.map((y) => (
          <button key={y} type="button" className={`lasso-chart__year${y === value ? " is-active" : ""}`} aria-pressed={y === value} onClick={() => onPick(y)}>
            {y}
          </button>
        ))}
      </div>
      {sides.map((side) => {
        const sum = side.segments.reduce((a, x) => a + x.value, 0);
        return (
          <div className="lasso-hbal__side" key={side.title}>
            <div className="lasso-hbal__head">
              <span className="lasso-hbal__title">{side.title}</span>
              <span className="lasso-hbal__total">
                {label(sum)} {scale.label}
              </span>
            </div>
            <div className="lasso-hbal__bar" aria-hidden="true">
              {side.segments.map((s) => (
                <span key={s.key} className={`lasso-hbal__seg lasso-chart-fill--${s.tone}`} style={{ width: `${(Math.max(0, s.value) / max) * 100}%` }} />
              ))}
            </div>
            <ul className="lasso-hbal__list">
              {side.segments.map((s) => (
                <li key={s.key} className="lasso-hbal__row">
                  <span className={`lasso-chart__swatch lasso-chart__swatch--${s.tone}`} aria-hidden="true" />
                  <span className="lasso-hbal__label">{s.label}</span>
                  <span className="lasso-hbal__value">{label(s.value)}</span>
                  <span className="lasso-hbal__pct">{sum > 0 ? formatPercent((s.value / sum) * 100, false) : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Stablede søjler, balance (katalog 13.5, node ADW-0): aktiver og passiver som én helhed pr. år.
 * Segmentværdien står inde i segmentet, når det er mindst 24 px højt, ellers i tooltip; totalen står
 * under søjleparret. Mobil (26b.3): lagt ned som to vandrette bjælker for ét år ad gangen.
 */
export function StackedBarChart({ financials, statements, years, error }: { financials?: FinancialsVM; statements?: FinancialStatementsVM; years: number; error?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const compact = isCompact(W);
  const title = "Balance";
  const rows = balanceYears(financials, statements, years);
  const points = compact ? rows.slice(-5) : rows;
  const pick = useChartPick(points.length, compact);
  const [mobileYear, setMobileYear] = useState<number | null>(null);

  if (!financials) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={CHART_H} />}
      </Section>
    );
  }
  if (points.length === 0) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        <DataState state="empty" reason="Virksomheden har ikke oplyst egenkapital og gæld i sine regnskaber." height={CHART_H} />
      </Section>
    );
  }

  const scale = amountScale(points.flatMap((p) => [...p.assets, ...p.liabilities].map((s) => s.value)), currencyUnit(financials.currency));
  const label = (v: number) => formatScaled(v, scale);
  const first = points[0]!.year;
  const last = points.at(-1)!.year;
  const subtitle = `${scale.label}, ${yearRange(first, last)}`;
  const legendSegments = [...points.at(-1)!.assets, ...points.at(-1)!.liabilities];

  if (compact) {
    const chosen = points.find((p) => p.year === mobileYear) ?? points.at(-1)!;
    return (
      <Section title={title} subtitle={subtitle} span="half" className="lasso-chart lasso-chart--stacked">
        <div ref={ref}>
          <HorizontalBalance row={chosen} scale={scale} years={points.map((p) => p.year)} value={chosen.year} onPick={setMobileYear} />
        </div>
      </Section>
    );
  }

  const bottom = 46;
  const stackTop = (segs: readonly Segment[]) => segs.reduce((a, s) => a + Math.max(0, s.value), 0) / scale.divisor;
  const tops = points.flatMap((p) => [stackTop(p.assets), stackTop(p.liabilities)]);
  const ticks = niceTicks(0, Math.max(0, ...tops));
  const tMax = ticks.at(-1)!;
  const tMin = ticks[0]!;
  const plotH = CHART_H - CHART_TOP - bottom;
  const plotW = Math.max(0, W - CHART_AXIS_W);
  const y = makeYScale(tMin, tMax, CHART_TOP, plotH);
  const slot = plotW / points.length;
  const gap = 4;
  const barW = Math.max(8, Math.min(30, (slot * 0.7 - gap) / 2));
  const pairW = barW * 2 + gap;

  const stack = (segs: readonly Segment[], x: number) => {
    let acc = 0;
    return segs.map((s) => {
      const from = acc;
      acc += Math.max(0, s.value) / scale.divisor;
      const yTop = y(acc);
      const h = Math.max(y(from) - yTop, s.value > 0 ? 1 : 0);
      return (
        <g key={s.key}>
          <rect className={`lasso-chart__bar lasso-chart__bar--${s.tone}`} x={x} y={yTop} width={barW} height={h} />
          {h >= 24 && barW >= 26 ? (
            <text className={`lasso-chart__seg-label${LIGHT.has(s.tone) ? " lasso-chart__seg-label--dark" : ""}`} x={x + barW / 2} y={yTop + h / 2 + 4} textAnchor="middle">
              {label(s.value)}
            </text>
          ) : null}
        </g>
      );
    });
  };

  const rowsFor = (i: number): PickRow[] => [...points[i]!.assets, ...points[i]!.liabilities].map((s) => ({ label: s.label, value: `${label(s.value)} ${scale.label}`, swatch: s.tone }));
  const t = pick.tooltip;

  return (
    <Section title={title} subtitle={subtitle} span="half" className="lasso-chart lasso-chart--stacked">
      <Legend segments={legendSegments} />
      <div ref={ref} className="lasso-chart__plot" {...pick.frame} aria-label="Balance pr. år, aktiver og passiver. Brug piletasterne for at se hvert år.">
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`Balance pr. år, aktiver og passiver, ${subtitle}`}>
            {ticks.map((tk) => (
              <g key={tk}>
                <line className="lasso-chart__grid" x1={CHART_AXIS_W} x2={W} y1={y(tk)} y2={y(tk)} />
                <text className="lasso-chart__tick" x={0} y={y(tk) + 4}>{formatNumber(tk)}</text>
              </g>
            ))}
            {pick.active !== null ? <rect className="lasso-chart__band" x={CHART_AXIS_W + pick.active * slot} y={CHART_TOP - 12} width={slot} height={CHART_H - CHART_TOP + 12} rx="6" /> : null}
            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              const x = CHART_AXIS_W + i * slot + (slot - pairW) / 2;
              return (
                <g key={p.year}>
                  {stack(p.assets, x)}
                  {stack(p.liabilities, x + barW + gap)}
                  <line className="lasso-chart__axis" x1={x - 3} x2={x + pairW + 3} y1={y(0)} y2={y(0)} />
                  <text className={`lasso-chart__value ${isLast ? "lasso-chart__value--last" : ""}`} x={x + pairW / 2} y={y(0) + 17} textAnchor="middle">
                    {label(p.total)}
                  </text>
                  <text className={`lasso-chart__label ${isLast || pick.active === i ? "lasso-chart__label--last" : ""}`} x={x + pairW / 2} y={CHART_H - 6} textAnchor="middle">
                    {p.year}
                  </text>
                  <rect className="lasso-chart__hit" x={CHART_AXIS_W + i * slot} y={0} width={slot} height={CHART_H} onMouseEnter={() => pick.enter(i)} onClick={() => pick.pick(i)} />
                </g>
              );
            })}
          </svg>
        ) : null}
        {t !== null && W > 0 ? (
          <ChartTooltip
            x={CHART_AXIS_W + t * slot + slot / 2}
            y={y(Math.max(stackTop(points[t]!.assets), stackTop(points[t]!.liabilities)))}
            width={W}
            title={`${points[t]!.year}, aktiver og passiver`}
            rows={rowsFor(t)}
            note={`Balancesum ${label(points[t]!.total)} ${scale.label}`}
          />
        ) : null}
      </div>
    </Section>
  );
}
