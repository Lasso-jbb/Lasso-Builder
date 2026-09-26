import { amountScale, currencyUnit, formatScaled, type FinancialsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_BOTTOM, CHART_H, CHART_TOP, makeYScale, niceTicks } from "../charts.js";

interface Step {
  label: string;
  value: number;
  kind: "start" | "delta" | "end";
}

/** Korte etiketter, når søjlerne bliver for smalle til de fulde ord (mobil, 26b). */
const MOBILE_LABEL: Record<string, string> = {
  Omsætning: "Oms.",
  Bruttofortjeneste: "Brutto",
  "Vareforbrug mv.": "Varefb.",
  "Øvrige poster": "Øvrige",
  "Årets resultat": "Resultat",
};

/**
 * Bygger vandfaldstrinene fra omsætning/bruttofortjeneste til årets resultat.
 * Kun de bekræftede regnskabsfelter bruges: er der omsætning, starter vandfaldet
 * der og bruttofortjenesten bliver ét mellemtrin; ellers starter det ved
 * bruttofortjenesten. En fuld resultatopgørelse (personale, af- og nedskrivninger
 * hver for sig) er ikke bekræftet i Lassos regnskabsdata.
 */
function buildSteps(revenue: number | null | undefined, grossProfit: number | null | undefined, profit: number | null | undefined): Step[] {
  const steps: Step[] = [];
  let cursor: number | null = null;
  if (typeof revenue === "number") {
    steps.push({ label: "Omsætning", value: revenue, kind: "start" });
    cursor = revenue;
  }
  if (typeof grossProfit === "number") {
    if (cursor === null) {
      steps.push({ label: "Bruttofortjeneste", value: grossProfit, kind: "start" });
    } else {
      steps.push({ label: "Vareforbrug mv.", value: grossProfit - cursor, kind: "delta" });
    }
    cursor = grossProfit;
  }
  if (typeof profit === "number" && cursor !== null) {
    steps.push({ label: "Øvrige poster", value: profit - cursor, kind: "delta" });
    steps.push({ label: "Årets resultat", value: profit, kind: "end" });
  }
  return steps;
}

/** Vandfald fra omsætning/bruttofortjeneste til årets resultat, seneste regnskabsår (katalog 13, række 2). */
export function WaterfallChart({ financials, error }: { financials?: FinancialsVM; error?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const title = "Fra omsætning til resultat";
  if (!financials) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={CHART_H} />}
      </Section>
    );
  }
  const yr = financials.years.at(-1);
  const steps = yr ? buildSteps(yr.revenue, yr.grossProfit, yr.profit) : [];
  if (steps.length < 2) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        <DataState state="empty" reason="Virksomheden har ikke oplyst tilstrækkelige regnskabstal til et vandfald." height={CHART_H} />
      </Section>
    );
  }

  const scale = amountScale(steps.map((s) => s.value), currencyUnit(financials.currency));
  const label = (v: number) => formatScaled(v, scale);
  const subtitle = `${scale.label}, ${yr!.year}`;

  // Kumuleret højde pr. trin, så svævende søjler forbindes korrekt.
  let running = 0;
  const bars = steps.map((s) => {
    const scaled = s.value / scale.divisor;
    let from: number;
    let to: number;
    if (s.kind === "start") {
      from = 0;
      to = scaled;
      running = scaled;
    } else if (s.kind === "end") {
      from = 0;
      to = scaled;
    } else {
      from = running;
      to = running + scaled;
      running = to;
    }
    return { ...s, from, to };
  });

  const allV = bars.flatMap((b) => [b.from, b.to]);
  const ticks = niceTicks(Math.min(0, ...allV), Math.max(0, ...allV));
  const tMin = ticks[0]!;
  const tMax = ticks.at(-1)!;
  const plotH = CHART_H - CHART_TOP - CHART_BOTTOM;
  const plotW = Math.max(0, W - CHART_AXIS_W);
  const y = makeYScale(tMin, tMax, CHART_TOP, plotH);
  const slot = plotW / bars.length;
  const barW = Math.min(64, slot * 0.62);

  return (
    <Section title={title} subtitle={subtitle} span="half" className="lasso-chart">
      <div ref={ref}>
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`${title}, ${subtitle}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="lasso-chart__grid" x1={CHART_AXIS_W} x2={W} y1={y(t)} y2={y(t)} />
              </g>
            ))}
            {bars.map((b, i) => {
              const x = CHART_AXIS_W + i * slot + (slot - barW) / 2;
              const yFrom = y(b.from);
              const yTo = y(b.to);
              const rectY = Math.min(yFrom, yTo);
              const h = Math.max(Math.abs(yFrom - yTo), 2);
              const neg = b.kind === "end" && b.value < 0;
              const cls = b.kind === "start" ? "lasso-chart__bar--wf-start" : b.kind === "end" ? (neg ? "lasso-chart__bar--wf-end-neg" : "lasso-chart__bar--wf-end") : "lasso-chart__bar--wf-float";
              const next = bars[i + 1];
              return (
                <g key={b.label}>
                  <title>{`${b.label}: ${label(b.value)} ${scale.label}`}</title>
                  <rect className={`lasso-chart__bar ${cls}`} x={x} y={rectY} width={barW} height={h} rx="3" />
                  <text className="lasso-chart__value lasso-chart__value--last" x={x + barW / 2} y={b.value >= 0 ? rectY - 7 : rectY + h + 15} textAnchor="middle">
                    {label(b.value)}
                  </text>
                  <text className="lasso-chart__label" x={x + barW / 2} y={CHART_H - 6} textAnchor="middle">
                    {W > 0 && W < 420 ? (MOBILE_LABEL[b.label] ?? b.label) : b.label}
                  </text>
                  {next ? <line className="lasso-chart__connector" x1={x + barW} x2={x + slot} y1={y(b.to)} y2={y(b.to)} /> : null}
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>
    </Section>
  );
}
