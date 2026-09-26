import { amountScale, currencyUnit, formatNumber, formatPercent, formatScaled, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, percentChange, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Missing, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";

/**
 * Hvor mange årskolonner bredden kan bære uden vandret scroll (review P1-2): etiket +
 * år (+ ændring og tendens over 768 px). Mål fra styles.css (.lasso-myt__*). De nyeste
 * år beholdes altid; de ældste falder fra.
 */
export function yearsThatFit(width: number): number {
  const mobile = width <= 560;
  const label = mobile ? 120 : 160;
  const year = mobile ? 72 : 96;
  const extras = width > 768 ? 80 + 96 : 0;
  return Math.max(2, Math.floor((width - label - extras) / year));
}

const DEFAULT_METRICS: Metric[] = ["bruttofortjeneste", "resultat", "egenkapital", "ansatte"];

/** Tendens-sparkline 72×22 (katalog 09/10) med stiplet nullinje, når værdier krydser 0. */
function Trend({ values }: { values: readonly number[] }) {
  const w = 72;
  const h = 22;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = max - min || 1;
  const y = (v: number) => h - 3 - ((v - min) / span) * (h - 6);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, y(v)] as const);
  const d = pts.map(([x, py], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  const crossesZero = min < 0 && max > 0;
  return (
    <svg className="lasso-spark lasso-spark--accent" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {crossesZero ? <line className="lasso-myt__zero" x1="0" y1={y(0)} x2={w} y2={y(0)} /> : null}
      <path d={d} />
      <circle cx={last[0]} cy={last[1]} r="2.5" />
    </svg>
  );
}

/** "▲ overskud"/"▼ underskud" ved fortegnsskift, ellers pil + procent (samme regel som Delta, katalog 09). */
function changeText(prev: number | undefined, last: number | undefined): { text: string; tone: "up" | "down" | "" } {
  if (typeof prev !== "number" || typeof last !== "number") return { text: "", tone: "" };
  if (prev !== 0 && Math.sign(prev) !== Math.sign(last)) return { text: last < 0 ? "▼ underskud" : "▲ overskud", tone: last < 0 ? "down" : "up" };
  const pct = percentChange([prev, last]);
  if (pct === null) return { text: "", tone: "" };
  return { text: `${pct < 0 ? "▼" : "▲"} ${formatPercent(Math.abs(pct), false)}`, tone: pct < 0 ? "down" : "up" };
}

/**
 * Flerårstabel (katalog 10): nøgletal × år, tendens til højre. Enhed står én
 * gang i tabelhovedet (fælles skala for beløbsrækkerne; ansatte er et rent
 * antal). Seneste år fremhævet (600). Viser de seneste år, bredden kan bære, så
 * det nyeste år altid er synligt uden scroll. Mobil: tendens/ændring skjules (26c).
 */
export function MultiYearTable({ financials, metrics, years, title, error }: { financials?: FinancialsVM; metrics?: readonly Metric[]; years?: number; title?: string; error?: string }) {
  const heading = title ?? "Flerårstabel";
  const [ref, W] = useWidth<HTMLDivElement>(1048);
  if (!financials) {
    return (
      <Section title={heading} span="full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={5} height={280} />}
      </Section>
    );
  }
  const all = financials.years;
  if (all.length === 0) {
    return (
      <Section title={heading} span="full">
        <DataState state="empty" reason="Virksomheden har ikke offentliggjort regnskaber endnu." />
      </Section>
    );
  }
  const span = Math.max(2, Math.min(10, years ?? 5, yearsThatFit(W)));
  const shown = all.slice(-span);
  const chosen: Metric[] = (metrics?.length ? [...metrics] : shown.at(-1)?.revenue != null ? ["omsaetning", ...DEFAULT_METRICS] : DEFAULT_METRICS).slice(0, 6) as Metric[];
  const amountMetrics = chosen.filter((m) => METRIC_KIND[m] === "amount");
  const scale = amountMetrics.length ? amountScale(shown.flatMap((y) => amountMetrics.map((m) => (y[METRIC_FIELD[m]] as number | null) ?? 0)), currencyUnit(financials.currency)) : null;
  const fmt = (m: Metric, v: number | null | undefined) => {
    if (v == null) return null;
    const kind = METRIC_KIND[m];
    if (kind === "percent") return formatPercent(v, false);
    return kind === "amount" && scale ? formatScaled(v, scale) : formatNumber(v);
  };

  return (
    <Section title={heading} span="full">
      <div className="lasso-table-wrap" ref={ref}>
        <div className="lasso-myt">
          <div className="lasso-myt__head">
            <div className="lasso-myt__unit">{scale ? scale.label.toUpperCase() : ""}</div>
            {shown.map((y, i) => (
              <div key={y.year} className={`lasso-myt__year lasso-myt__year--head ${i === shown.length - 1 ? "lasso-myt__year--last" : ""}`}>
                {y.year}
              </div>
            ))}
            <div className="lasso-myt__delta">Ændring</div>
            <div className="lasso-myt__trend">Tendens</div>
          </div>
          {chosen.map((m) => {
            const values = shown.map((y) => y[METRIC_FIELD[m]] as number | null | undefined);
            const series = values.filter((v): v is number => typeof v === "number");
            const change = changeText(values.at(-2) ?? undefined, values.at(-1) ?? undefined);
            return (
              <div className="lasso-myt__row" key={m}>
                <div className="lasso-myt__label">{METRIC_LABELS[m]}</div>
                {values.map((v, i) => (
                  <div key={shown[i]!.year} className={`lasso-myt__year ${i === values.length - 1 ? "lasso-myt__year--last" : ""} ${typeof v === "number" && v < 0 ? "lasso-down" : ""}`}>
                    {fmt(m, v) ?? <Missing />}
                  </div>
                ))}
                <div className={`lasso-myt__delta ${change.tone === "down" ? "lasso-down" : change.tone === "up" ? "lasso-up" : ""}`}>{change.text}</div>
                <div className="lasso-myt__trend">{series.length >= 2 ? <Trend values={series} /> : <Missing />}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
