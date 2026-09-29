import { useState } from "react";
import { amountScale, chartSeries, currencyUnit, formatNumber, formatPercent, formatScaled, METRIC_KIND, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { niceTicks } from "../charts.js";
import { ChartReadout, ChartTooltip, changeText, isCompact, useChartPick, type PickRow } from "../chartPick.js";

export { niceTicks };

/** Rækkefølgen i nøgletalsvælgeren (13.2): beløb først, så antal, så procent-nøgletal. */
const PICKER_ORDER: readonly Metric[] = ["omsaetning", "bruttofortjeneste", "resultat", "ebitda", "egenkapital", "balancesum", "gaeld", "ansatte", "soliditetsgrad", "overskudsgrad", "likviditetsgrad"];

/** Nøgletal, virksomheden har mindst to år af, til vælgeren. Omsætning uden seneste år falder tilbage til bruttofortjeneste og vises ikke dobbelt. */
export function pickableMetrics(financials: FinancialsVM, years: number): Metric[] {
  const out: Metric[] = [];
  for (const m of PICKER_ORDER) {
    const { metric, points } = chartSeries(financials, m, years);
    if (metric === m && points.length >= 2 && !out.includes(m)) out.push(m);
  }
  return out;
}

/**
 * Søjlegraf, ét nøgletal over 2–10 år (katalog 13.2, node 9YI-0).
 * Seneste år i koral (chart-1), tidligere år i lys koral (chart-4), værdien over hver søjle (maks 10),
 * y-akse med hjælpelinjer, enhed og periode i undertitlen. Nøgletalsvælger (dropdown) øverst til
 * højre. Hover fremhæver året (4 % ink) og viser én mørk tooltip med år, tal og ændring.
 * Mobil (26b.1): søjler 40 px, maks 5 år, valgt år i et fast felt under grafen (tryk vælger).
 */
export function BarChart({
  financials,
  metric,
  years,
  error,
  picker = true,
}: {
  financials?: FinancialsVM;
  metric: Metric;
  years: number;
  error?: string;
  /** Nøgletalsvælgeren øverst til højre. Standard: vist, når der er mindst to nøgletal at vælge mellem. */
  picker?: boolean;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [chosen, setChosen] = useState<Metric | null>(null);
  const H = 240;
  const compact = isCompact(W);
  const series = financials ? chartSeries(financials, chosen ?? metric, years) : null;
  const all = series?.points ?? [];
  const points = compact ? all.slice(-5) : all.slice(-10);
  const pick = useChartPick(points.length, compact);

  if (!financials || !series) {
    return (
      <Section title={METRIC_LABELS[metric]} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={H} />}
      </Section>
    );
  }
  const shown = series.metric;
  const options = picker ? pickableMetrics(financials, years) : [];
  const action =
    options.length >= 2 ? (
      <label className="lasso-chart__picker">
        <span className="lasso-sr">Nøgletal</span>
        <select className="lasso-select lasso-chart__select" value={shown} onChange={(e) => setChosen(e.target.value as Metric)}>
          {(options.includes(shown) ? options : [shown, ...options]).map((m) => (
            <option key={m} value={m}>
              {METRIC_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
    ) : undefined;

  if (all.length === 0) {
    return (
      <Section title={METRIC_LABELS[shown]} span="half" className="lasso-chart" action={action}>
        <DataState state="empty" reason={`Virksomheden har ikke oplyst ${METRIC_LABELS[shown].toLowerCase()} i sine regnskaber.`} height={H} />
      </Section>
    );
  }

  const kind = METRIC_KIND[shown];
  const scale = kind === "amount" ? amountScale(points.map((p) => p.value), currencyUnit(financials.currency)) : null;
  const label = (v: number) => (kind === "percent" ? formatPercent(v, false) : scale ? formatScaled(v, scale) : formatNumber(v));
  const unit = (v: number) => `${label(v)}${scale ? ` ${scale.label}` : ""}`;
  const first = points[0]!.year;
  const last = points.at(-1)!.year;
  const subtitle = `${scale ? `${scale.label}, ` : ""}${first === last ? first : `${first}–${last}`}`;

  const values = points.map((p) => (scale ? p.value / scale.divisor : p.value));
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const tMin = ticks[0]!;
  const tMax = ticks.at(-1)!;
  const axisW = 32;
  const top = 22;
  const bottom = 26;
  const plotH = H - top - bottom;
  const plotW = Math.max(0, W - axisW);
  const y = (v: number) => top + ((tMax - v) / (tMax - tMin || 1)) * plotH;
  const slot = plotW / points.length;
  const barW = compact ? Math.min(40, slot * 0.8) : Math.min(64, slot * 0.62);

  // Ændringen mod året før regnes fra hele serien, så også første viste år på mobil har en ændring.
  const rowsFor = (i: number): PickRow[] => {
    const p = points[i]!;
    const idx = all.findIndex((q) => q.year === p.year);
    const prev = idx > 0 ? all[idx - 1] : undefined;
    return [{ label: METRIC_LABELS[shown], value: unit(p.value), change: changeText(prev?.value, p.value) }];
  };
  const prevYear = (i: number) => {
    const idx = all.findIndex((q) => q.year === points[i]!.year);
    return idx > 0 ? all[idx - 1]!.year : undefined;
  };
  const t = pick.tooltip;

  return (
    <Section title={METRIC_LABELS[shown]} subtitle={subtitle} span="half" className="lasso-chart" action={action}>
      <div ref={ref} className="lasso-chart__plot" {...pick.frame} aria-label={`${METRIC_LABELS[shown]} pr. år. Brug piletasterne for at se hvert år.`}>
        {W > 0 ? (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${METRIC_LABELS[shown]} pr. år, ${subtitle}`}>
            {ticks.map((tk) => (
              <g key={tk}>
                <line className="lasso-chart__grid" x1={axisW} x2={W} y1={y(tk)} y2={y(tk)} />
                <text className="lasso-chart__tick" x={0} y={y(tk) + 4}>{formatNumber(tk)}</text>
              </g>
            ))}
            {pick.active !== null ? <rect className="lasso-chart__band" x={axisW + pick.active * slot} y={top - 18} width={slot} height={plotH + 18} rx="6" /> : null}
            {points.map((p, i) => {
              const v = values[i]!;
              const isLast = i === points.length - 1;
              const isActive = pick.active === i;
              const x = axisW + i * slot + (slot - barW) / 2;
              const y0 = y(0);
              const yv = y(v);
              const rectY = Math.min(y0, yv);
              const h = Math.max(Math.abs(y0 - yv), 1);
              const cls = p.value < 0 ? "lasso-chart__bar lasso-chart__bar--neg" : isLast ? "lasso-chart__bar lasso-chart__bar--last" : "lasso-chart__bar";
              return (
                <g key={p.year}>
                  <rect className={cls} x={x} y={rectY} width={barW} height={h} rx="3" />
                  <text className={`lasso-chart__value ${isLast || isActive ? "lasso-chart__value--last" : ""}`} x={x + barW / 2} y={v >= 0 ? rectY - 7 : rectY + h + 15} textAnchor="middle">
                    {label(p.value)}
                  </text>
                  <text className={`lasso-chart__label ${isLast || isActive ? "lasso-chart__label--last" : ""}`} x={x + barW / 2} y={H - 6} textAnchor="middle">
                    {p.year}
                  </text>
                  <rect className="lasso-chart__hit" x={axisW + i * slot} y={0} width={slot} height={H} onMouseEnter={() => pick.enter(i)} onClick={() => pick.pick(i)} />
                </g>
              );
            })}
          </svg>
        ) : null}
        {t !== null && W > 0 ? (
          <ChartTooltip
            x={axisW + t * slot + slot / 2}
            y={Math.min(y(0), y(values[t]!))}
            width={W}
            title={points[t]!.year}
            rows={rowsFor(t)}
            note={prevYear(t) ? `Ændring fra ${prevYear(t)}` : undefined}
          />
        ) : null}
      </div>
      {pick.readout !== null ? <ChartReadout title={points[pick.readout]!.year} rows={rowsFor(pick.readout)} note={prevYear(pick.readout) ? `Ændring fra ${prevYear(pick.readout)}` : undefined} /> : null}
    </Section>
  );
}
