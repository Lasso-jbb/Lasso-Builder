import { amountScale, chartSeries, formatNumber, formatScaled, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { Card, StateBox, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";

export function FinancialChart({ financials, metric, years, error }: { financials?: FinancialsVM; metric: Metric; years: number; error?: string }) {
  const title = `${METRIC_LABELS[metric]} · ${years} år`;
  const [ref, W] = useWidth<HTMLDivElement>();
  if (!financials) {
    return <Card title={title}>{error ? <StateBox kind={stateForError(error)} message={error} /> : <StateBox kind="loading" />}</Card>;
  }
  const { metric: shown, points } = chartSeries(financials, metric, years);
  if (points.length === 0) return <Card title={title}><StateBox kind="empty" message="Ingen tal for dette nøgletal." /></Card>;

  // Én enhed for hele grafen (i titlen), så søjlerne kun bærer tal: "117,1 … 250,3" i mia. kr.
  const scale = shown === "ansatte" ? null : amountScale(points.map((p) => p.value));
  const label = (v: number) => (scale ? formatScaled(v, scale) : formatNumber(v));
  const chartTitle = `${METRIC_LABELS[shown]}${scale ? ` · ${scale.label}` : ""} · ${points.length} år`;

  const H = W < 420 ? 170 : 210;
  const max = Math.max(0, ...points.map((p) => p.value));
  const min = Math.min(0, ...points.map((p) => p.value));
  const top = max > 0 ? 22 : 6;
  const yearBand = 20;
  const negBand = min < 0 ? 18 : 0;
  const plotH = H - top - yearBand - negBand;
  const span = max - min || 1;
  const zeroY = top + (max / span) * plotH;
  const slot = W / points.length;
  const barW = Math.min(56, slot * 0.6);
  // Smalle søjler (fx 10 år på mobil) får kun tal på første og sidste, så tallene ikke løber sammen.

  return (
    <Card title={chartTitle} className="lasso-chart">
      <div ref={ref}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${METRIC_LABELS[shown]} pr. år`}>
          {points.map((p, i) => {
            const h = (Math.abs(p.value) / span) * plotH;
            const x = i * slot + (slot - barW) / 2;
            const y = p.value >= 0 ? zeroY - h : zeroY;
            const isLast = i === points.length - 1;
            const cls = p.value < 0 ? "lasso-chart__bar lasso-chart__bar--neg" : isLast ? "lasso-chart__bar lasso-chart__bar--last" : "lasso-chart__bar";
            return (
              <g key={p.year}>
                <rect className={cls} x={x} y={y} width={barW} height={Math.max(h, 1)} rx="4" />
                {slot >= 46 || i === 0 || isLast ? (
                  <text className="lasso-chart__value" x={x + barW / 2} y={p.value >= 0 ? y - 6 : y + h + 13} textAnchor="middle">
                    {label(p.value)}
                  </text>
                ) : null}
                <text className="lasso-chart__label" x={x + barW / 2} y={H - 5} textAnchor="middle">
                  {p.year}
                </text>
              </g>
            );
          })}
          <line className="lasso-chart__axis" x1="0" x2={W} y1={zeroY} y2={zeroY} />
        </svg>
      </div>
    </Card>
  );
}
