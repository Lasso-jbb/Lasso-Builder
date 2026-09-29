import { chartSeries, currencyUnit, formatNumber, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, type FinancialsVM, type IndustryBenchmarkVM, type Metric } from "@lasso/spec";
import { DataState, Section, SourceLine, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_BOTTOM, CHART_H, CHART_TOP, labelFor, makeYScale, niceTicks, yearRange } from "../charts.js";
import { ChartReadout, ChartTooltip, changeText, isCompact, useChartPick, type PickRow } from "../chartPick.js";

/** Indeks med én decimal ("108,4"), samme talformat som resten (09). */
const indexLabel = (v: number) => new Intl.NumberFormat("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v).replace("-", "−");

/**
 * Linje + område (katalog 13.6, node AF3-0). Koral linje 2,5 px med 8 % områdefyld. Benchmark som
 * 2 px stiplet neutral (chart-5) på samme akse, aldrig som egen akse. Seneste værdi står som tekst ved
 * linjens ende. Hover: lodret hårlinje + punkt på alle serier + én mørk tooltip.
 *
 * To benchmark-former:
 * - `industry` (branchen): begge serier som indeks med første viste år = 100, og indeks 100 tegnet i
 *   aksefarve ("udvikling mod branche, indeks 2021 = 100").
 * - `benchmarkFinancials` (en navngiven virksomhed): samme nøgletal i kroner for begge.
 * Mobil (26b.4): maks 5 år, valgt punkt via tryk i et fast felt under grafen.
 */
export function LineChart({
  financials,
  metric,
  years,
  error,
  benchmarkFinancials,
  benchmarkName,
  benchmarkError,
  industry,
  industryError,
}: {
  financials?: FinancialsVM;
  metric: Metric;
  years: number;
  error?: string;
  benchmarkFinancials?: FinancialsVM;
  benchmarkName?: string;
  benchmarkError?: string;
  /** Branchens median pr. år (13.6, indeks-visning). */
  industry?: IndustryBenchmarkVM;
  industryError?: string;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const compact = isCompact(W);
  const series = financials ? chartSeries(financials, metric, years) : null;
  const allPoints = series?.points ?? [];
  const points = compact ? allPoints.slice(-5) : allPoints;
  const pick = useChartPick(points.length, compact);
  const indexMode = industry !== undefined || industryError !== undefined;

  if (!financials || !series) {
    return (
      <Section title={METRIC_LABELS[metric]} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={CHART_H} />}
      </Section>
    );
  }
  const shown = series.metric;
  if (allPoints.length === 0) {
    return (
      <Section title={METRIC_LABELS[shown]} span="half" className="lasso-chart">
        <DataState state="empty" reason={`Virksomheden har ikke oplyst ${METRIC_LABELS[shown].toLowerCase()} i sine regnskaber.`} height={CHART_H} />
      </Section>
    );
  }

  // Benchmark-serien pr. år: en anden virksomheds tal eller branchens median.
  const benchByYear = new Map<number, number>();
  if (indexMode && industry?.state === "ok") {
    for (const y of industry.years) {
      const v = y.median[shown];
      if (typeof v === "number") benchByYear.set(y.year, v);
    }
  } else if (benchmarkFinancials) {
    for (const y of benchmarkFinancials.years) {
      const v = y[METRIC_FIELD[shown]];
      if (typeof v === "number") benchByYear.set(y.year, v);
    }
  }
  const hasBenchmark = points.some((p) => benchByYear.has(p.year));
  const benchLabel = indexMode ? (industry?.industryText ? `Branchen, ${industry.industryText.toLowerCase()}` : "Branchen") : (benchmarkName ?? "Sammenligning");

  // Indeks: første viste år = 100 for begge serier (kun når første værdi er positiv, ellers giver indekset ingen mening).
  const baseYear = points[0]!.year;
  const baseCompany = points[0]!.value;
  const baseBench = benchByYear.get(baseYear);
  const canIndex = indexMode && baseCompany > 0;
  const toIndex = (v: number, base: number | undefined) => (base && base > 0 ? (v / base) * 100 : null);

  const { scale, label } = labelFor(
    [...points.map((p) => p.value), ...points.filter((p) => benchByYear.has(p.year)).map((p) => benchByYear.get(p.year)!)],
    METRIC_KIND[shown],
    currencyUnit(financials.currency),
  );
  const unitLabel = (v: number) => `${label(v)}${scale ? ` ${scale.label}` : ""}`;
  const values = points.map((p) => (canIndex ? toIndex(p.value, baseCompany)! : scale ? p.value / scale.divisor : p.value));
  const benchValues = points.map((p) => {
    const v = benchByYear.get(p.year);
    if (v === undefined) return null;
    return canIndex ? toIndex(v, baseBench) : scale ? v / scale.divisor : v;
  });
  const shortLabel = (i: number, bench = false) => {
    const v = bench ? benchValues[i] : values[i];
    if (v === null || v === undefined) return "";
    return canIndex ? indexLabel(v) : label(bench ? benchByYear.get(points[i]!.year)! : points[i]!.value);
  };
  const first = points[0]!.year;
  const last = points.at(-1)!.year;
  const subtitle = canIndex ? `Indeks ${baseYear} = 100, ${yearRange(first, last)}` : `${scale ? `${scale.label}, ` : ""}${yearRange(first, last)}`;
  const title = indexMode ? `${METRIC_LABELS[shown]} mod branchen` : METRIC_LABELS[shown];

  const flat = [...values, ...benchValues.filter((v): v is number => v !== null)];
  const ticks = canIndex ? niceTicks(Math.min(100, ...flat), Math.max(100, ...flat)) : niceTicks(Math.min(0, ...flat), Math.max(0, ...flat));
  const tMin = ticks[0]!;
  const tMax = ticks.at(-1)!;
  const plotH = CHART_H - CHART_TOP - CHART_BOTTOM;
  const sidePad = 20;
  const endLabelW = compact ? 0 : 44;
  const plotW = Math.max(0, W - CHART_AXIS_W - sidePad - endLabelW);
  const y = makeYScale(tMin, tMax, CHART_TOP, plotH);
  const x = (i: number) => CHART_AXIS_W + sidePad / 2 + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const floor = canIndex ? tMin : 0;

  const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
  const areaPath = `${linePath} L${x(points.length - 1)},${y(floor)} L${x(0)},${y(floor)} Z`;
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

  const rowsFor = (i: number): PickRow[] => {
    const p = points[i]!;
    const idx = allPoints.findIndex((q) => q.year === p.year);
    const prev = idx > 0 ? allPoints[idx - 1] : undefined;
    const rows: PickRow[] = [
      {
        label: indexMode ? "Virksomheden" : METRIC_LABELS[shown],
        value: canIndex ? `${indexLabel(values[i]!)} (${unitLabel(p.value)})` : unitLabel(p.value),
        swatch: "s1",
        change: changeText(prev?.value, p.value),
      },
    ];
    const bv = benchValues[i];
    if (bv !== null && bv !== undefined) {
      const raw = benchByYear.get(p.year)!;
      rows.push({ label: benchLabel, value: canIndex ? `${indexLabel(bv)} (${unitLabel(raw)})` : unitLabel(raw), swatch: "s5", dashed: true, change: changeText(benchByYear.get(prev?.year ?? -1), raw) });
    }
    return rows;
  };
  const t = pick.tooltip;
  const a = pick.active;
  const lastI = points.length - 1;
  const industryNote =
    indexMode && industry?.state !== "ok" ? (industryError ?? industry?.reason ?? "Branchetal er ikke tilgængelige for virksomheden.") : undefined;

  return (
    <Section
      title={title}
      subtitle={subtitle}
      span="half"
      className="lasso-chart"
      action={
        hasBenchmark ? (
          <div className="lasso-chart__legend lasso-chart__legend--right">
            <span className="lasso-chart__legend-item">
              <span className="lasso-chart__swatch lasso-chart__swatch--s1" aria-hidden="true" />
              Virksomheden
            </span>
            <span className="lasso-chart__legend-item lasso-chart__legend-item--dashed">
              <span className="lasso-chart__swatch lasso-chart__swatch--s5" aria-hidden="true" />
              {indexMode ? "Branchen" : benchLabel}
            </span>
          </div>
        ) : undefined
      }
    >
      {benchmarkError ? <p className="lasso-small lasso-muted">Sammenligning: {benchmarkError}</p> : null}
      {industryNote ? <p className="lasso-small lasso-muted">{industryNote}</p> : null}
      <div ref={ref} className="lasso-chart__plot" {...pick.frame} aria-label={`${title} pr. år. Brug piletasterne for at se hvert år.`}>
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`${title} pr. år, ${subtitle}`}>
            {ticks.map((tk) => (
              <g key={tk}>
                <line className={canIndex && tk === 100 ? "lasso-chart__axis" : "lasso-chart__grid"} x1={CHART_AXIS_W} x2={W} y1={y(tk)} y2={y(tk)} />
                <text className="lasso-chart__tick" x={0} y={y(tk) + 4}>{formatNumber(tk)}</text>
              </g>
            ))}
            {canIndex && !ticks.includes(100) ? <line className="lasso-chart__axis" x1={CHART_AXIS_W} x2={W} y1={y(100)} y2={y(100)} /> : null}
            <path className="lasso-chart__area" d={areaPath} />
            {benchSegments.map((d, i) => (
              <path key={i} className="lasso-chart__line lasso-chart__line--bench" d={d} />
            ))}
            <path className="lasso-chart__line" d={linePath} />
            {a !== null ? <line className="lasso-chart__hairline" x1={x(a)} x2={x(a)} y1={CHART_TOP - 10} y2={CHART_H - CHART_BOTTOM} /> : null}
            {points.map((p, i) => {
              const isLast = i === lastI;
              const bv = benchValues[i];
              const on = a === i;
              return (
                <g key={p.year}>
                  {isLast || on ? <circle className={`lasso-chart__dot ${isLast ? "lasso-chart__dot--last" : ""}`} cx={x(i)} cy={y(values[i]!)} r={on ? 4.5 : 4} /> : null}
                  {bv !== null && (on || isLast) ? <circle className="lasso-chart__dot lasso-chart__dot--bench" cx={x(i)} cy={y(bv)} r={on ? 4 : 3} /> : null}
                  <text className={`lasso-chart__label ${isLast || on ? "lasso-chart__label--last" : ""}`} x={x(i)} y={CHART_H - 6} textAnchor="middle">
                    {p.year}
                  </text>
                </g>
              );
            })}
            {/* Seneste værdi som tekst ved linjens ende (højre for punktet; på mobil over punktet). */}
            <text className="lasso-chart__value lasso-chart__value--last" x={compact ? x(lastI) : x(lastI) + 8} y={compact ? y(values[lastI]!) - 10 : y(values[lastI]!) + 4} textAnchor={compact ? "end" : "start"}>
              {shortLabel(lastI)}
            </text>
            {benchValues[lastI] !== null && benchValues[lastI] !== undefined ? (
              <text className="lasso-chart__value" x={compact ? x(lastI) : x(lastI) + 8} y={compact ? y(benchValues[lastI]!) + 16 : y(benchValues[lastI]!) + 4} textAnchor={compact ? "end" : "start"}>
                {shortLabel(lastI, true)}
              </text>
            ) : null}
            {points.map((p, i) => {
              const left = i === 0 ? CHART_AXIS_W : (x(i - 1) + x(i)) / 2;
              const right = i === lastI ? W : (x(i) + x(i + 1)) / 2;
              return <rect key={p.year} className="lasso-chart__hit" x={left} y={0} width={Math.max(0, right - left)} height={CHART_H} onMouseEnter={() => pick.enter(i)} onClick={() => pick.pick(i)} />;
            })}
          </svg>
        ) : null}
        {t !== null && W > 0 ? <ChartTooltip x={x(t)} y={Math.min(y(values[t]!), benchValues[t] !== null ? y(benchValues[t]!) : Infinity)} width={W} title={points[t]!.year} rows={rowsFor(t)} /> : null}
      </div>
      {pick.readout !== null ? <ChartReadout title={points[pick.readout]!.year} rows={rowsFor(pick.readout)} hint="Tryk på et punkt for at se tallene" /> : null}
      {indexMode && industry?.state === "ok" && industry.source ? (
        <SourceLine source={`${industry.source}${industry.peers ? `, median af ${formatNumber(industry.peers)} virksomheder` : ""}`} updated={industry.updated} />
      ) : null}
    </Section>
  );
}
