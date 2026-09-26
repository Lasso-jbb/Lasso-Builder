import { amountScale, formatNumber, formatScaled, type FinancialsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_BOTTOM, CHART_H, CHART_TOP, clampMobilePoints, makeYScale, niceTicks, yearRange } from "../charts.js";

/**
 * Stablede søjler: egenkapital og gæld som dele af balancen, pr. år (katalog 13, række 1).
 * Egenkapital i koral (chart-1), gæld i dyb blå (chart-2). Kun de to størrelser er
 * bekræftet i Lassos regnskabsdata; en fuld balance (anlæg/omsætningsaktiver) er ikke.
 * Mobil: maks 5 år (26b).
 */
export function StackedBarChart({ financials, years, error }: { financials?: FinancialsVM; years: number; error?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const title = "Balance";
  if (!financials) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={CHART_H} />}
      </Section>
    );
  }
  const rows = financials.years
    .slice(-years)
    .filter((y) => typeof y.equity === "number" && typeof y.liabilities === "number")
    .map((y) => ({ year: y.year, equity: y.equity as number, liabilities: y.liabilities as number }));
  const points = clampMobilePoints(rows, W);
  if (points.length === 0) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        <DataState state="empty" reason="Virksomheden har ikke oplyst egenkapital og gæld i sine regnskaber." height={CHART_H} />
      </Section>
    );
  }

  const totals = points.map((p) => p.equity + p.liabilities);
  const scale = amountScale([...points.map((p) => p.equity), ...points.map((p) => p.liabilities)]);
  const label = (v: number) => formatScaled(v, scale);
  const first = points[0]!.year;
  const last = points.at(-1)!.year;
  const subtitle = `${scale.label}, ${yearRange(first, last)}`;

  const equityScaled = points.map((p) => p.equity / scale.divisor);
  const liabScaled = points.map((p) => p.liabilities / scale.divisor);
  const totalScaled = points.map((_, i) => equityScaled[i]! + liabScaled[i]!);
  const ticks = niceTicks(Math.min(0, ...totalScaled), Math.max(0, ...totalScaled));
  const tMax = ticks.at(-1)!;
  const tMin = ticks[0]!;
  const plotH = CHART_H - CHART_TOP - CHART_BOTTOM;
  const plotW = Math.max(0, W - CHART_AXIS_W);
  const y = makeYScale(tMin, tMax, CHART_TOP, plotH);
  const slot = plotW / points.length;
  const barW = Math.min(64, slot * 0.62);

  return (
    <Section title={title} subtitle={subtitle} span="half" className="lasso-chart">
      <div className="lasso-chart__legend">
        <span className="lasso-chart__legend-item"><span className="lasso-chart__swatch lasso-chart__swatch--s1" aria-hidden="true" />Egenkapital</span>
        <span className="lasso-chart__legend-item"><span className="lasso-chart__swatch lasso-chart__swatch--s2" aria-hidden="true" />Gæld</span>
      </div>
      <div ref={ref}>
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`Balance pr. år, ${subtitle}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="lasso-chart__grid" x1={CHART_AXIS_W} x2={W} y1={y(t)} y2={y(t)} />
                <text className="lasso-chart__tick" x={0} y={y(t) + 4}>{formatNumber(t)}</text>
              </g>
            ))}
            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              const x = CHART_AXIS_W + i * slot + (slot - barW) / 2;
              const y0 = y(0);
              const yEquityTop = y(equityScaled[i]!);
              const yTotalTop = y(totalScaled[i]!);
              const eqH = Math.max(y0 - yEquityTop, 1);
              const debtH = Math.max(yEquityTop - yTotalTop, 1);
              return (
                <g key={p.year}>
                  <title>{`${p.year}: egenkapital ${label(p.equity)}, gæld ${label(p.liabilities)}, i alt ${label(totals[i]!)} ${scale.label}`}</title>
                  <rect className="lasso-chart__bar lasso-chart__bar--s1" x={x} y={yEquityTop} width={barW} height={eqH} rx="3" />
                  <rect className="lasso-chart__bar lasso-chart__bar--s2" x={x} y={yTotalTop} width={barW} height={debtH} rx="3" />
                  {eqH > 22 ? (
                    <text className="lasso-chart__seg-label" x={x + barW / 2} y={(yEquityTop + y0) / 2 + 4} textAnchor="middle">{label(p.equity)}</text>
                  ) : null}
                  {debtH > 22 ? (
                    <text className="lasso-chart__seg-label" x={x + barW / 2} y={(yTotalTop + yEquityTop) / 2 + 4} textAnchor="middle">{label(p.liabilities)}</text>
                  ) : null}
                  <text className={`lasso-chart__value ${isLast ? "lasso-chart__value--last" : ""}`} x={x + barW / 2} y={yTotalTop - 7} textAnchor="middle">
                    {label(totals[i]!)}
                  </text>
                  <text className={`lasso-chart__label ${isLast ? "lasso-chart__label--last" : ""}`} x={x + barW / 2} y={CHART_H - 6} textAnchor="middle">
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
