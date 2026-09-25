import { chartSeries, formatNumber, METRIC_FIELD, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_BOTTOM, CHART_H, CHART_TOP, clampMobilePoints, labelFor, makeYScale, niceTicks, yearRange } from "../charts.js";

/**
 * Linjegraf med områdefyld, ét nøgletal over flere år, med valgfri benchmark-serie
 * (chart-5, stiplet) fra en sammenligningsvirksomhed (katalog 13, række 2).
 * Mobil: maks 5 år (26b).
 */
export function LineChart({
  financials,
  metric,
  years,
  error,
  benchmarkFinancials,
  benchmarkName,
  benchmarkError,
}: {
  financials?: FinancialsVM;
  metric: Metric;
  years: number;
  error?: string;
  benchmarkFinancials?: FinancialsVM;
  benchmarkName?: string;
  benchmarkError?: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  if (!financials) {
    return (
      <Section title={METRIC_LABELS[metric]} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={CHART_H} />}
      </Section>
    );
  }
  const { metric: shown, points: allPoints } = chartSeries(financials, metric, years);
  if (allPoints.length === 0) {
    return (
      <Section title={METRIC_LABELS[metric]} span="half" className="lasso-chart">
        <DataState state="empty" reason={`Virksomheden har ikke oplyst ${METRIC_LABELS[metric].toLowerCase()} i sine regnskaber.`} height={CHART_H} />
      </Section>
    );
  }
  const points = clampMobilePoints(allPoints, W);
  const benchByYear = new Map<number, number>();
  if (benchmarkFinancials) {
    for (const y of benchmarkFinancials.years) {
      const v = y[METRIC_FIELD[shown]];
      if (typeof v === "number") benchByYear.set(y.year, v);
    }
  }
  const hasBenchmark = points.some((p) => benchByYear.has(p.year));

  const isCount = shown === "ansatte";
  const allValues = [...points.map((p) => p.value), ...(hasBenchmark ? points.filter((p) => benchByYear.has(p.year)).map((p) => benchByYear.get(p.year)!) : [])];
  const { scale, label } = labelFor(allValues, isCount);
  const values = points.map((p) => (scale ? p.value / scale.divisor : p.value));
  const benchValues = points.map((p) => {
    const v = benchByYear.get(p.year);
    return v === undefined ? null : scale ? v / scale.divisor : v;
  });
  const first = points[0]!.year;
  const last = points.at(-1)!.year;
  const subtitle = `${scale ? `${scale.label}, ` : ""}${yearRange(first, last)}`;

  const flat = [...values, ...benchValues.filter((v): v is number => v !== null)];
  const ticks = niceTicks(Math.min(0, ...flat), Math.max(0, ...flat));
  const tMin = ticks[0]!;
  const tMax = ticks.at(-1)!;
  const plotH = CHART_H - CHART_TOP - CHART_BOTTOM;
  const sidePad = 20;
  const plotW = Math.max(0, W - CHART_AXIS_W - sidePad);
  const y = makeYScale(tMin, tMax, CHART_TOP, plotH);
  const x = (i: number) => CHART_AXIS_W + sidePad / 2 + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);

  const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const areaPath = `${linePath} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const benchSegments: string[] = [];
  let seg: string[] = [];
  benchValues.forEach((v, i) => {
    if (v === null) {
      if (seg.length > 1) benchSegments.push(seg.join(" "));
      seg = [];
      return;
    }
    seg.push(`${seg.length === 0 ? "M" : "L"}${x(i)},${y(v)}`);
  });
  if (seg.length > 1) benchSegments.push(seg.join(" "));

  return (
    <Section title={METRIC_LABELS[shown]} subtitle={subtitle} span="half" className="lasso-chart">
      {hasBenchmark ? (
        <div className="lasso-chart__legend">
          <span className="lasso-chart__legend-item"><span className="lasso-chart__swatch lasso-chart__swatch--s1" aria-hidden="true" />Virksomheden</span>
          <span className="lasso-chart__legend-item lasso-chart__legend-item--dashed">
            <span className="lasso-chart__swatch lasso-chart__swatch--s5" aria-hidden="true" />
            {benchmarkName ?? "Sammenligning"}
          </span>
        </div>
      ) : null}
      {benchmarkError ? <p className="lasso-small lasso-muted">Sammenligning: {benchmarkError}</p> : null}
      <div ref={ref}>
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`${METRIC_LABELS[shown]} pr. år, ${subtitle}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="lasso-chart__grid" x1={CHART_AXIS_W} x2={W} y1={y(t)} y2={y(t)} />
                <text className="lasso-chart__tick" x={0} y={y(t) + 4}>{formatNumber(t)}</text>
              </g>
            ))}
            <path className="lasso-chart__area" d={areaPath} />
            {benchSegments.map((d, i) => (
              <path key={i} className="lasso-chart__line lasso-chart__line--bench" d={d} />
            ))}
            <path className="lasso-chart__line" d={linePath} />
            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              const bv = benchValues[i];
              return (
                <g key={p.year}>
                  <title>{`${p.year}: ${label(p.value)}${scale ? ` ${scale.label}` : ""}${bv !== null ? `, ${benchmarkName ?? "sammenligning"} ${label(benchByYear.get(p.year)!)}` : ""}`}</title>
                  <circle className={`lasso-chart__dot ${isLast ? "lasso-chart__dot--last" : ""}`} cx={x(i)} cy={y(values[i]!)} r={isLast ? 4 : 3} />
                  {bv !== null ? <circle className="lasso-chart__dot lasso-chart__dot--bench" cx={x(i)} cy={y(bv)} r={3} /> : null}
                  {isLast ? (
                    <text className="lasso-chart__value lasso-chart__value--last" x={x(i)} y={y(values[i]!) - 10} textAnchor="end">
                      {label(p.value)}
                    </text>
                  ) : null}
                  {isLast && bv !== null ? (
                    <text className="lasso-chart__value" x={x(i)} y={y(bv) + 16} textAnchor="end">
                      {label(benchByYear.get(p.year)!)}
                    </text>
                  ) : null}
                  <text className={`lasso-chart__label ${isLast ? "lasso-chart__label--last" : ""}`} x={x(i)} y={CHART_H - 6} textAnchor="middle">
                    {p.year}
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
