import { amountScale, currencyUnit, formatScaled, type FinancialStatementsVM, type FinancialsVM } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { CHART_AXIS_W, CHART_BOTTOM, CHART_H, CHART_TOP, makeYScale, niceTicks } from "../charts.js";
import { ChartTooltip, isCompact, useChartPick } from "../chartPick.js";

export interface WaterfallStep {
  label: string;
  value: number;
  kind: "start" | "delta" | "end";
}

/**
 * Aksens etiketter (13.7): fulde navne på højst to linjer ("Brutto-" / "fortjeneste", "Andre" /
 * "driftsomk."), aldrig forkortet til ét ord.
 */
const AXIS_LABEL: Record<string, [string, string?]> = {
  Omsætning: ["Omsætning"],
  Bruttofortjeneste: ["Brutto-", "fortjeneste"],
  "Vareforbrug mv.": ["Vareforbrug", "mv."],
  Personaleomkostninger: ["Personale"],
  "Andre driftsomkostninger": ["Andre", "driftsomk."],
  "Af- og nedskrivninger": ["Af- og", "nedskr."],
  "Finans og skat": ["Finans", "og skat"],
  "Finansielle poster": ["Finansielle", "poster"],
  Skat: ["Skat"],
  "Øvrige poster": ["Øvrige", "poster"],
  "Årets resultat": ["Årets", "resultat"],
};

/** Etiketten på én linje (mobil): "Brutto-" + "fortjeneste" -> "Bruttofortjeneste". */
const oneLine = (label: string) => (AXIS_LABEL[label] ?? [label]).filter((l): l is string => Boolean(l)).reduce((a, l) => (a.endsWith("-") ? a.slice(0, -1) + l : a ? `${a} ${l}` : l), "");

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Trinene fra bruttofortjeneste til årets resultat (13.7). Med det fulde regnskab (19) bruges
 * resultatopgørelsens underposter hver for sig (personale, andre driftsomkostninger, af- og
 * nedskrivninger, finansielle poster, skat); går de ikke op, samler "Øvrige poster" resten, så
 * vandfaldet altid ender i årets resultat. Uden underposter: omsætning/bruttofortjeneste,
 * ét mellemtrin og resultatet, som før.
 */
export function waterfallSteps(financials: FinancialsVM | undefined, statements?: FinancialStatementsVM): { year: number; steps: WaterfallStep[] } | null {
  const yr = financials?.years.at(-1);
  const inc = statements?.incomeStatement.find((r) => r.year === yr?.year) ?? (yr ? undefined : statements?.incomeStatement.at(-1));
  const year = yr?.year ?? inc?.year;
  if (year === undefined) return null;
  const gross = num(inc?.grossProfit) ? inc!.grossProfit! : yr?.grossProfit;
  const profit = num(inc?.profit) ? inc!.profit! : yr?.profit;
  const subs: [string, number | null | undefined][] = [
    ["Personaleomkostninger", inc?.staffCosts],
    ["Andre driftsomkostninger", inc?.otherOperatingCosts],
    ["Af- og nedskrivninger", inc?.depreciation],
    // 13.7/26b.5: finansielle poster og skat står som ét trin, "Finans og skat".
    ["Finans og skat", num(inc?.financialItemsNet) || num(inc?.tax) ? (inc?.financialItemsNet ?? 0) + (inc?.tax ?? 0) : undefined],
  ];
  const known = subs.filter((s): s is [string, number] => num(s[1]) && s[1] !== 0);
  if (num(gross) && num(profit) && known.length >= 2) {
    const steps: WaterfallStep[] = [{ label: "Bruttofortjeneste", value: gross, kind: "start" }];
    let cursor = gross;
    for (const [label, v] of known) {
      steps.push({ label, value: v, kind: "delta" });
      cursor += v;
    }
    const rest = profit - cursor;
    if (Math.abs(rest) >= Math.max(1, Math.abs(gross) * 0.001)) steps.push({ label: "Øvrige poster", value: rest, kind: "delta" });
    steps.push({ label: "Årets resultat", value: profit, kind: "end" });
    return { year, steps };
  }
  // Uden underposter: kun de bekræftede hovedtal.
  const steps: WaterfallStep[] = [];
  let cursor: number | null = null;
  const revenue = yr?.revenue;
  if (num(revenue)) {
    steps.push({ label: "Omsætning", value: revenue, kind: "start" });
    cursor = revenue;
  }
  if (num(gross)) {
    if (cursor === null) steps.push({ label: "Bruttofortjeneste", value: gross, kind: "start" });
    else steps.push({ label: "Vareforbrug mv.", value: gross - cursor, kind: "delta" });
    cursor = gross;
  }
  if (num(profit) && cursor !== null) {
    steps.push({ label: "Øvrige poster", value: profit - cursor, kind: "delta" });
    steps.push({ label: "Årets resultat", value: profit, kind: "end" });
  }
  return { year, steps };
}

/**
 * Vandfald, resultatopgørelse fra bruttofortjeneste til resultat (katalog 13.7, node AGI-0).
 * Start- og slutsøjle er fulde (koral / ink), mellemposterne "svæver" i lys blå med stiplede
 * forbindelser, negativt resultat som tom søjle med rød kant under nullinjen. Tal altid over/under
 * søjlen, aldrig inde i tynde segmenter. Mobil (26b.5): lagt ned som vandrette bjælker med tal til højre.
 */
export function WaterfallChart({ financials, statements, error }: { financials?: FinancialsVM; statements?: FinancialStatementsVM; error?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const compact = isCompact(W);
  const built = waterfallSteps(financials, statements);
  const steps = built?.steps ?? [];
  const pick = useChartPick(steps.length, false);
  const fromGross = steps[0]?.label === "Bruttofortjeneste";
  const title = fromGross ? "Fra bruttofortjeneste til resultat" : "Fra omsætning til resultat";
  if (!financials) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={4} height={CHART_H} />}
      </Section>
    );
  }
  if (!built || steps.length < 2) {
    return (
      <Section title={title} span="half" className="lasso-chart">
        <DataState state="empty" reason="Virksomheden har ikke oplyst tilstrækkelige regnskabstal til et vandfald." height={CHART_H} />
      </Section>
    );
  }

  const scale = amountScale(steps.map((s) => s.value), currencyUnit(financials.currency));
  const label = (v: number) => formatScaled(v, scale);
  const subtitle = `${scale.label}, ${built.year}`;

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
  const cls = (b: (typeof bars)[number]) =>
    b.kind === "start" ? "lasso-chart__bar--wf-start" : b.kind === "end" ? (b.value < 0 ? "lasso-chart__bar--wf-end-neg" : "lasso-chart__bar--wf-end") : "lasso-chart__bar--wf-float";

  const allV = bars.flatMap((b) => [b.from, b.to]);
  const lo = Math.min(0, ...allV);
  const hi = Math.max(0, ...allV);

  if (compact) {
    // 26b.5: vandrette bjælker, én række pr. post, tal til højre.
    const span = hi - lo || 1;
    const pos = (v: number) => ((v - lo) / span) * 100;
    return (
      <Section title={title} subtitle={subtitle} span="half" className="lasso-chart lasso-chart--waterfall">
        <div ref={ref}>
          <ol className="lasso-hwf" aria-label={`${title}, ${subtitle}`}>
            {bars.map((b) => {
              const left = pos(Math.min(b.from, b.to));
              const width = Math.max(pos(Math.max(b.from, b.to)) - left, 0.8);
              return (
                <li key={b.label} className={`lasso-hwf__row lasso-hwf__row--${b.kind}`}>
                  <span className="lasso-hwf__label">{oneLine(b.label)}</span>
                  <span className="lasso-hwf__track">
                    {lo < 0 ? <span className="lasso-hwf__zero" style={{ left: `${pos(0)}%` }} aria-hidden="true" /> : null}
                    <span className={`lasso-hwf__bar ${cls(b)}`} style={{ left: `${left}%`, width: `${width}%` }} aria-hidden="true" />
                  </span>
                  <span className={`lasso-hwf__value${b.kind !== "delta" ? " is-strong" : ""}`}>{label(b.value)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </Section>
    );
  }

  const ticks = niceTicks(lo, hi);
  const tMin = ticks[0]!;
  const tMax = ticks.at(-1)!;
  // To linjer etiket under søjlerne (13.7).
  const plotH = CHART_H - CHART_TOP - CHART_BOTTOM - 16;
  const plotW = Math.max(0, W - CHART_AXIS_W);
  const y = makeYScale(tMin, tMax, CHART_TOP, plotH);
  const slot = plotW / bars.length;
  const barW = Math.min(64, slot * 0.62);
  const t = pick.tooltip;

  return (
    <Section title={title} subtitle={subtitle} span="half" className="lasso-chart lasso-chart--waterfall">
      <div ref={ref} className="lasso-chart__plot" {...pick.frame} aria-label={`${title}. Brug piletasterne for at se hver post.`}>
        {W > 0 ? (
          <svg width={W} height={CHART_H} viewBox={`0 0 ${W} ${CHART_H}`} role="img" aria-label={`${title}, ${subtitle}`}>
            {ticks.map((tk) => (
              <line key={tk} className="lasso-chart__grid" x1={CHART_AXIS_W} x2={W} y1={y(tk)} y2={y(tk)} />
            ))}
            {tMin < 0 ? <line className="lasso-chart__axis" x1={CHART_AXIS_W} x2={W} y1={y(0)} y2={y(0)} /> : null}
            {pick.active !== null ? <rect className="lasso-chart__band" x={CHART_AXIS_W + pick.active * slot} y={CHART_TOP - 18} width={slot} height={plotH + 18} rx="6" /> : null}
            {bars.map((b, i) => {
              const x = CHART_AXIS_W + i * slot + (slot - barW) / 2;
              const yFrom = y(b.from);
              const yTo = y(b.to);
              const rectY = Math.min(yFrom, yTo);
              const h = Math.max(Math.abs(yFrom - yTo), 2);
              const next = bars[i + 1];
              // Tal over søjlen, når posten går op (eller er positiv), ellers under: aldrig inde i søjlen.
              const up = b.kind === "delta" ? b.value >= 0 : b.value >= 0;
              return (
                <g key={b.label}>
                  <rect className={`lasso-chart__bar ${cls(b)}`} x={x} y={rectY} width={barW} height={h} rx="3" />
                  <text className={`lasso-chart__value${b.kind !== "delta" ? " lasso-chart__value--last" : ""}`} x={x + barW / 2} y={up ? rectY - 7 : rectY + h + 15} textAnchor="middle">
                    {label(b.value)}
                  </text>
                  <text className={`lasso-chart__label${slot < 80 ? " lasso-chart__label--small" : ""}`} x={x + barW / 2} y={CHART_H - (AXIS_LABEL[b.label]?.[1] ? 22 : 6)} textAnchor="middle">
                    {(AXIS_LABEL[b.label] ?? [b.label]).filter(Boolean).map((line, li) => (
                      <tspan key={li} x={x + barW / 2} dy={li === 0 ? 0 : 16}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                  {next ? <line className="lasso-chart__connector" x1={x + barW} x2={x + slot} y1={y(b.to)} y2={y(b.to)} /> : null}
                  <rect className="lasso-chart__hit" x={CHART_AXIS_W + i * slot} y={0} width={slot} height={CHART_H} onMouseEnter={() => pick.enter(i)} onClick={() => pick.pick(i)} />
                </g>
              );
            })}
          </svg>
        ) : null}
        {t !== null && W > 0 ? (
          <ChartTooltip
            x={CHART_AXIS_W + t * slot + slot / 2}
            y={y(Math.max(bars[t]!.from, bars[t]!.to))}
            width={W}
            title={bars[t]!.label}
            rows={[{ label: String(built.year), value: `${label(bars[t]!.value)} ${scale.label}` }]}
            note={bars[t]!.kind === "delta" ? `Efter posten: ${label(bars[t]!.to * scale.divisor)} ${scale.label}` : undefined}
          />
        ) : null}
      </div>
    </Section>
  );
}
