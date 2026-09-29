import { currencyUnit, effectiveMetric, formatNumber, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_BOTTOM, CHART_H, CHART_TOP, labelFor, makeYScale, niceTicks, yearRange } from "../charts.js";
import { ChartTooltip, changeText, isCompact, useChartPick, type PickRow } from "../chartPick.js";

/** Farverne har fast rækkefølge (chart-1, chart-2, chart-3): serie 2 aldrig uden serie 1. */
const SERIES_CLASS = ["lasso-chart__bar--s1", "lasso-chart__bar--s2", "lasso-chart__bar--s3"];

/**
 * Grupperede søjler: 2–3 nøgletal side om side pr. år (katalog 13.4, node ACE-0).
 * Maks 3 serier, søjler 30 px, 4 px imellem, 40 px mellem grupperne (de ældste år falder fra, når bredden ikke rækker). Hover fremhæver hele året med 4 % ink og viser én mørk
 * tooltip (ink, radius 8) med alle serier. Legenden står øverst til højre, aldrig under grafen.
 * Mobil (26b.2): maks 2 serier og 5 år, søjler op til 40 px, 3. serie i en tabel under grafen,
 * valgt år i et fast felt (tryk vælger).
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
  const compact = isCompact(W);
  const titleMetrics = (financials ? metrics.map((m) => effectiveMetric(financials.years, m)) : metrics).filter((m, i, a) => a.indexOf(m) === i).slice(0, 3);
  // "A og B" / "A, B og C"; kun første ord med stort.
  const names = titleMetrics.map((m, i) => (i === 0 || METRIC_LABELS[m] === METRIC_LABELS[m].toUpperCase() ? METRIC_LABELS[m] : METRIC_LABELS[m].toLowerCase()));
  const title = names.length > 1 ? `${names.slice(0, -1).join(", ")} og ${names.at(-1)}` : (names[0] ?? "");
  // Omsætning uden tal i seneste regnskab falder tilbage til bruttofortjeneste (som BarChart),
  // så grafen altid når frem til de nyeste år i stedet for at stoppe, hvor omsætningen gjorde.
  const effective = titleMetrics;
  const allRows = financials
    ? financials.years
        .slice(-years)
        .map((y) => ({ year: y.year, values: effective.map((m) => y[METRIC_FIELD[m]]) }))
        .filter((r): r is { year: number; values: number[] } => r.values.every((v) => typeof v === "number"))
    : [];
  const shownMetrics = compact ? effective.slice(0, 2) : effective;
  const extraMetrics = compact ? effective.slice(2) : [];
  // 13.4: søjler 30 px, 4 px imellem og 40 px mellem grupper. Er der ikke plads til alle år i den
  // bredde, grafen har (fx ½ kolonne med 3 serier), falder de ældste år fra (mindst 3), før søjlerne krymper.
  const desktopGroups = Math.max(3, Math.floor((Math.max(0, W - CHART_AXIS_W) + 40) / (effective.length * 30 + (effective.length - 1) * 4 + 40)));
  // 26b.2: 4 år på mobil (søjler ca. 24 px), ingen fast valgfelt.
  const points = compact ? allRows.slice(-4) : allRows.slice(-desktopGroups);
  const pick = useChartPick(points.length, compact);

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
        <DataState state="empty" reason={`Virksomheden har ikke oplyst ${effective.map((m) => METRIC_LABELS[m].toLowerCase()).join(" og ")} i sine regnskaber.`} height={CHART_H} />
      </Section>
    );
  }

  const kind = METRIC_KIND[shownMetrics[0]!];
  const all = points.flatMap((p) => p.values);
  const { scale, label } = labelFor(all, kind, currencyUnit(financials.currency));
  const unit = (v: number) => `${label(v)}${scale ? ` ${scale.label}` : ""}`;
  const n = shownMetrics.length;
  const values = points.map((p) => p.values.slice(0, n).map((v) => (scale ? v / scale.divisor : v)));
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
  const innerGap = 4;
  const target = compact ? 24 : 30;
  // Katalog: 40 px mellem grupper; søjlerne krymper først, når der ikke er plads til det.
  const room = compact ? groupSlot * 0.8 : Math.min((plotW - (points.length - 1) * 40) / points.length, groupSlot * 0.82);
  const desired = n * target + (n - 1) * innerGap;
  const barW = desired <= room ? target : Math.max(6, (room - (n - 1) * innerGap) / n);
  const groupW = n * barW + (n - 1) * innerGap;

  const legend = (
    <div className="lasso-chart__legend lasso-chart__legend--right">
      {shownMetrics.map((m, j) => (
        <span className="lasso-chart__legend-item" key={m}>
          <span className={`lasso-chart__swatch lasso-chart__swatch--s${j + 1}`} aria-hidden="true" />
          {METRIC_LABELS[m]}
        </span>
      ))}
    </div>
  );

  const rowsFor = (i: number): PickRow[] => {
    const p = points[i]!;
    const idx = allRows.findIndex((r) => r.year === p.year);
    const prev = idx > 0 ? allRows[idx - 1] : undefined;
    return shownMetrics.map((m, j) => ({ label: METRIC_LABELS[m], value: unit(p.values[j]!), swatch: `s${j + 1}`, change: changeText(prev?.values[j], p.values[j]) }));
  };
  const t = pick.tooltip;

  return (
    <Section title={title} subtitle={subtitle} span="half" className="lasso-chart lasso-chart--grouped" action={legend}>
      <div ref={ref} className="lasso-chart__plot" {...pick.frame} aria-label={`${title} pr. år. Brug piletasterne for at se hvert år.`}>
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`${title} pr. år, ${subtitle}`}>
            {ticks.map((tk) => (
              <g key={tk}>
                <line className="lasso-chart__grid" x1={CHART_AXIS_W} x2={W} y1={y(tk)} y2={y(tk)} />
                <text className="lasso-chart__tick" x={0} y={y(tk) + 4}>{formatNumber(tk)}</text>
              </g>
            ))}
            {pick.tooltip !== null ? <rect className="lasso-chart__band" x={CHART_AXIS_W + pick.tooltip * groupSlot} y={CHART_TOP - 18} width={groupSlot} height={plotH + 18} rx="6" /> : null}
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
                        <rect className={`lasso-chart__bar ${SERIES_CLASS[j]}`} x={x} y={rectY} width={barW} height={h} rx="3" />
                      </g>
                    );
                  })}
                  <text className={`lasso-chart__label ${isLast || pick.tooltip === i ? "lasso-chart__label--last" : ""}`} x={groupX + groupW / 2} y={CHART_H - 6} textAnchor="middle">
                    {p.year}
                  </text>
                  <rect className="lasso-chart__hit" x={CHART_AXIS_W + i * groupSlot} y={0} width={groupSlot} height={CHART_H} onMouseEnter={() => pick.enter(i)} onClick={() => pick.pick(i)} />
                </g>
              );
            })}
          </svg>
        ) : null}
        {t !== null && W > 0 ? (
          <ChartTooltip x={CHART_AXIS_W + t * groupSlot + groupSlot / 2} y={Math.min(y(0), ...values[t]!.map((v) => y(v)))} width={W} title={points[t]!.year} rows={rowsFor(t)} />
        ) : null}
      </div>
      {extraMetrics.length > 0 ? (
        <table className="lasso-chart__extra">
          <caption className="lasso-sr">{extraMetrics.map((m) => METRIC_LABELS[m]).join(", ")} pr. år</caption>
          <tbody>
            {extraMetrics.map((m) => {
              const j = effective.indexOf(m);
              return (
                <tr key={m}>
                  <th scope="row">
                    <span className={`lasso-chart__swatch lasso-chart__swatch--s${j + 1}`} aria-hidden="true" />
                    {METRIC_LABELS[m]}
                  </th>
                  {points.map((p, i) => (
                    <td key={p.year} className={i === points.length - 1 ? "is-last" : undefined}>
                      <span className="lasso-chart__extra-year">{p.year}</span>
                      {label(p.values[j]!)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </Section>
  );
}
