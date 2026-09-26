import { currencyUnit, effectiveMetric, formatNumber, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_BOTTOM, CHART_H, CHART_TOP, clampMobilePoints, labelFor, makeYScale, niceTicks, yearRange } from "../charts.js";

/** Farverne har fast rækkefølge (chart-1, chart-2, chart-3): serie 2 aldrig uden serie 1. */
const SERIES_CLASS = ["lasso-chart__bar--s1", "lasso-chart__bar--s2", "lasso-chart__bar--s3"];

/**
 * Grupperede søjler: 2–3 nøgletal side om side pr. år (katalog 13, række 1).
 * Mobil: maks 2 serier og 5 år (26b).
 */
export function GroupedBarChart({
  financials,
  metrics,
  years,
  error,
}: {
  financials?: FinancialsVM;
  metrics: Metric[];
  years: number;
  error?: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const titleMetrics = (financials ? metrics.map((m) => effectiveMetric(financials.years, m)) : metrics).filter((m, i, a) => a.indexOf(m) === i);
  const title = titleMetrics.map((m) => METRIC_LABELS[m]).join(" og ");
  if (!financials) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={CHART_H} />}
      </Section>
    );
  }
  // Omsætning uden tal i seneste regnskab falder tilbage til bruttofortjeneste (som BarChart),
  // så grafen altid når frem til de nyeste år i stedet for at stoppe, hvor omsætningen gjorde.
  const effective = metrics.map((m) => effectiveMetric(financials.years, m)).filter((m, i, a) => a.indexOf(m) === i);
  const shownMetrics = W > 0 && W < 420 ? effective.slice(0, 2) : effective;
  const rows = financials.years
    .slice(-years)
    .map((y) => ({ year: y.year, values: shownMetrics.map((m) => y[METRIC_FIELD[m]]) }))
    .filter((r): r is { year: number; values: number[] } => r.values.every((v) => typeof v === "number"));
  const points = clampMobilePoints(rows, W);
  if (points.length === 0) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        <DataState state="empty" reason={`Virksomheden har ikke oplyst ${shownMetrics.map((m) => METRIC_LABELS[m].toLowerCase()).join(" og ")} i sine regnskaber.`} height={CHART_H} />
      </Section>
    );
  }

  const kind = METRIC_KIND[shownMetrics[0]!];
  const all = points.flatMap((p) => p.values);
  const { scale, label } = labelFor(all, kind, currencyUnit(financials.currency));
  const values = points.map((p) => p.values.map((v) => (scale ? v / scale.divisor : v)));
  const first = points[0]!.year;
  const last = points.at(-1)!.year;
  const subtitle = `${scale ? `${scale.label}, ` : ""}${yearRange(first, last)}`;

  const flat = values.flat();
  const ticks = niceTicks(Math.min(0, ...flat), Math.max(0, ...flat));
  const tMin = ticks[0]!;
  const tMax = ticks.at(-1)!;
  const plotH = CHART_H - CHART_TOP - CHART_BOTTOM;
  const plotW = Math.max(0, W - CHART_AXIS_W);
  const y = makeYScale(tMin, tMax, CHART_TOP, plotH);
  const groupSlot = plotW / points.length;
  const n = shownMetrics.length;
  const innerGap = 4;
  const desired = n * 30 + (n - 1) * innerGap;
  const barW = desired <= groupSlot * 0.82 ? 30 : Math.max(6, (groupSlot * 0.82 - (n - 1) * innerGap) / n);
  const groupW = n * barW + (n - 1) * innerGap;

  return (
    <Section title={title} subtitle={subtitle} span="half" className="lasso-chart">
      <div className="lasso-chart__legend">
        {shownMetrics.map((m, j) => (
          <span className="lasso-chart__legend-item" key={m}>
            <span className={`lasso-chart__swatch lasso-chart__swatch--s${j + 1}`} aria-hidden="true" />
            {METRIC_LABELS[m]}
          </span>
        ))}
      </div>
      <div ref={ref}>
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`${title} pr. år, ${subtitle}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="lasso-chart__grid" x1={CHART_AXIS_W} x2={W} y1={y(t)} y2={y(t)} />
                <text className="lasso-chart__tick" x={0} y={y(t) + 4}>{formatNumber(t)}</text>
              </g>
            ))}
            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              const groupX = CHART_AXIS_W + i * groupSlot + (groupSlot - groupW) / 2;
              const y0 = y(0);
              return (
                <g key={p.year}>
                  {values[i]!.map((v, j) => {
                    const x = groupX + j * (barW + innerGap);
                    const yv = y(v);
                    const rectY = Math.min(y0, yv);
                    const h = Math.max(Math.abs(y0 - yv), 1);
                    return (
                      <g key={j}>
                        <title>{`${p.year}, ${METRIC_LABELS[shownMetrics[j]!]}: ${label(p.values[j]!)}${scale ? ` ${scale.label}` : ""}`}</title>
                        <rect className={`lasso-chart__bar ${SERIES_CLASS[j]}`} x={x} y={rectY} width={barW} height={h} rx="3" />
                        {isLast ? (
                          <text className="lasso-chart__value lasso-chart__value--last" x={x + barW / 2} y={v >= 0 ? rectY - 7 : rectY + h + 15} textAnchor="middle">
                            {label(p.values[j]!)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                  <text className={`lasso-chart__label ${isLast ? "lasso-chart__label--last" : ""}`} x={groupX + groupW / 2} y={CHART_H - 6} textAnchor="middle">
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
