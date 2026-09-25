import { amountScale, chartSeries, formatNumber, formatScaled, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";

/** Pæne tal til y-aksen: 0, 5, 10, 15, 20. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

/**
 * Søjlegraf, ét nøgletal over 2–10 år (katalog 13, række 0).
 * Seneste år i koral (chart-1), tidligere år i lys koral (chart-4),
 * værdien over hver søjle, y-akse med hjælpelinjer. Enhed og periode i undertitlen.
 * Mobil: maks 5 punkter ad gangen (26b).
 */
export function BarChart({ financials, metric, years, error }: { financials?: FinancialsVM; metric: Metric; years: number; error?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const H = 240;
  if (!financials) {
    return (
      <Section title={METRIC_LABELS[metric]} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={H} />}
      </Section>
    );
  }
  const { metric: shown, points: all } = chartSeries(financials, metric, years);
  if (all.length === 0) {
    return (
      <Section title={METRIC_LABELS[metric]} span="half" className="lasso-chart">
        <DataState state="empty" reason={`Virksomheden har ikke oplyst ${METRIC_LABELS[metric].toLowerCase()} i sine regnskaber.`} height={H} />
      </Section>
    );
  }
  const points = W > 0 && W < 420 ? all.slice(-5) : all;

  const scale = shown === "ansatte" ? null : amountScale(points.map((p) => p.value));
  const label = (v: number) => (scale ? formatScaled(v, scale) : formatNumber(v));
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
  const barW = Math.min(64, slot * 0.62);

  return (
    <Section title={METRIC_LABELS[shown]} subtitle={subtitle} span="half" className="lasso-chart">
      <div ref={ref}>
        {W > 0 ? (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${METRIC_LABELS[shown]} pr. år, ${subtitle}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="lasso-chart__grid" x1={axisW} x2={W} y1={y(t)} y2={y(t)} />
                <text className="lasso-chart__tick" x={0} y={y(t) + 4}>{formatNumber(t)}</text>
              </g>
            ))}
            {points.map((p, i) => {
              const v = values[i]!;
              const isLast = i === points.length - 1;
              const x = axisW + i * slot + (slot - barW) / 2;
              const y0 = y(0);
              const yv = y(v);
              const rectY = Math.min(y0, yv);
              const h = Math.max(Math.abs(y0 - yv), 1);
              const cls = p.value < 0 ? "lasso-chart__bar lasso-chart__bar--neg" : isLast ? "lasso-chart__bar lasso-chart__bar--last" : "lasso-chart__bar";
              return (
                <g key={p.year}>
                  <title>{`${p.year}: ${label(p.value)}${scale ? ` ${scale.label}` : ""}`}</title>
                  <rect className={cls} x={x} y={rectY} width={barW} height={h} rx="3" />
                  <text className={`lasso-chart__value ${isLast ? "lasso-chart__value--last" : ""}`} x={x + barW / 2} y={v >= 0 ? rectY - 7 : rectY + h + 15} textAnchor="middle">
                    {label(p.value)}
                  </text>
                  <text className={`lasso-chart__label ${isLast ? "lasso-chart__label--last" : ""}`} x={x + barW / 2} y={H - 6} textAnchor="middle">
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
