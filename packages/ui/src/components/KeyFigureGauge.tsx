import { formatPercent, GAUGE_METRICS, METRIC_FIELD, METRIC_LABELS, type FinancialsVM, type IndustryBenchmarkVM, type Metric } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";
import { NO_BENCHMARK_REASON } from "../unavailableReasons.js";

/** Nøgletal, måleren kan vise (GAUGE_METRICS i spec.ts): procent-nøgletal, hvor højere er bedre. */
type GaugeMetric = (typeof GAUGE_METRICS)[number];

export interface GaugeAssessment {
  /** 0 = på/over branchen (grøn), 1 = lidt under (gul), 2 = klart under (rød). */
  index: 0 | 1 | 2;
  word: string;
}

/**
 * Vurderingen mod branchemedianen for et nøgletal, hvor højere er bedre: mindst medianen = grøn,
 * mindst 60 % af medianen = gul, ellers rød. Negative tal og en ikke-positiv median er altid rød/ukendt.
 */
export function assessAgainstMedian(value: number, median: number): GaugeAssessment | null {
  if (!(median > 0)) return null;
  const r = value / median;
  if (r >= 1) return { index: 0, word: "På eller over branchen" };
  if (r >= 0.6) return { index: 1, word: "Under branchen" };
  return { index: 2, word: "Klart under branchen" };
}

/**
 * Nøgletalsmåler, interval med branchemærke (katalog 13.10, node AJY-0). Hver måler er to linjer:
 * etiket til venstre og "17,3 %, branche 34 %" til højre, derunder en 6 px bjælke, hvis farve er
 * vurderingen (grøn/gul/rød; ordet står i tooltip og aria-label), med branchemedianen som 2 px
 * ink-mærke. Skalaen går fra 0 til 2 × branchen, så mærket altid står midt på.
 * Mobil (26b.8): fuld bredde, samme to linjer.
 */
export function KeyFigureGauge({
  financials,
  industry,
  metrics,
  title,
  error,
  industryError,
}: {
  financials?: FinancialsVM;
  industry?: IndustryBenchmarkVM;
  metrics?: readonly Metric[];
  title?: string;
  error?: string;
  industryError?: string;
}) {
  const heading = title ?? "Nøgletal mod branchen";
  if (!financials || (!industry && !industryError)) {
    const e = error ?? (financials ? undefined : industryError);
    return (
      <Section title={heading} span="half" className="lasso-kfg">
        {e ? <DataState state={stateForError(e) === "noaccess" ? "empty" : "error"} reason={e} /> : <DataState state="loading" lines={3} height={180} />}
      </Section>
    );
  }
  if (industry?.state === "unavailable" && !industryError) {
    // Branchetal mangler (ingen branchetal for branchen, eller ingen registreret branchekode): ikke tilgængelig med årsagen.
    return (
      <Section title={heading} span="half" className="lasso-kfg">
        <DataState state="unavailable" title="Branchetal ikke tilgængelige" reason={industry.reason ?? NO_BENCHMARK_REASON} height={140} />
      </Section>
    );
  }
  if (!industry || industry.state !== "ok") {
    return (
      <Section title={heading} span="half" className="lasso-kfg">
        <DataState state="empty" reason={industryError ?? industry?.reason ?? "Der er ingen branchetal at sammenligne med."} height={180} />
      </Section>
    );
  }
  const wanted = (metrics?.length ? metrics : GAUGE_METRICS).filter((m): m is GaugeMetric => (GAUGE_METRICS as readonly string[]).includes(m));
  const last = financials.years.at(-1);
  const bench = [...industry.years].reverse().find((y) => y.year <= (last?.year ?? Infinity)) ?? industry.years.at(-1);
  const rows = wanted
    .map((m) => {
      const v = last?.[METRIC_FIELD[m]];
      const med = bench?.median[m];
      return typeof v === "number" && typeof med === "number" && med > 0 ? { m, v, med, a: assessAgainstMedian(v, med)! } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (!last || rows.length === 0) {
    return (
      <Section title={heading} span="half" className="lasso-kfg">
        <DataState state="empty" reason="Virksomheden har ikke oplyst de nøgletal, branchen sammenlignes på." height={180} />
      </Section>
    );
  }
  const branch = industry.industryText ? `${industry.industryText}${industry.industryCode ? ` (${industry.industryCode})` : ""}` : "Branchen";
  return (
    <Section title={heading} subtitle={`${last.year}, ${branch}`} span="half" className="lasso-kfg">
      <ul className="lasso-kfg__list">
        {rows.map(({ m, v, med, a }) => {
          const max = med * 2;
          const pct = Math.max(0, Math.min(100, (v / max) * 100));
          return (
            <li className="lasso-kfg__row" key={m}>
              {/* 13.10/26b.8: to linjer, etiket 13 og "17,3 %, branche 34 %" 14/600, derunder bjælken. */}
              <div className="lasso-kfg__head">
                <span className="lasso-kfg__label">{METRIC_LABELS[m]}</span>
                <span className="lasso-kfg__value">{`${formatPercent(v, false)}, branche ${formatPercent(med, false)}`}</span>
              </div>
              <div className="lasso-kfg__bar" role="img" aria-label={`${METRIC_LABELS[m]} ${formatPercent(v, false)}, branchen ${formatPercent(med, false)}, ${a.word.toLowerCase()}`} title={a.word}>
                <span className={`lasso-kfg__fill lasso-kfg__fill--${a.index}`} style={{ width: `${pct}%` }} />
                <span className="lasso-kfg__mark" aria-hidden="true" />
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
