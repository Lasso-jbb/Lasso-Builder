import { useState } from "react";
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

/**
 * Tendens-sparkline 72×22 (katalog 09/10): skaleret til seriens eget spænd, så kurven er tydelig,
 * prik på seneste værdi (inden for rammen) og stiplet nullinje, når værdierne krydser 0.
 */
export function trendPoints(values: readonly number[], w = 72, h = 22, pad = 3): (readonly [number, number])[] {
  const crossesZero = Math.min(...values) < 0 && Math.max(...values) > 0;
  const min = crossesZero ? Math.min(...values, 0) : Math.min(...values);
  const max = crossesZero ? Math.max(...values, 0) : Math.max(...values);
  const span = max - min;
  const y = (v: number) => (span === 0 ? h / 2 : h - pad - ((v - min) / span) * (h - 2 * pad));
  return values.map((v, i) => [pad + (values.length > 1 ? i / (values.length - 1) : 0) * (w - 2 * pad), y(v)] as const);
}
function Trend({ values }: { values: readonly number[] }) {
  const w = 72;
  const h = 22;
  const pts = trendPoints(values, w, h);
  const d = pts.map(([x, py], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const crossesZero = min < 0 && max > 0;
  const zeroY = crossesZero ? h - 3 - ((0 - min) / (max - min)) * (h - 6) : 0;
  return (
    <svg className="lasso-spark lasso-spark--accent lasso-myt__spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {crossesZero ? <line className="lasso-myt__zero" x1="0" y1={zeroY} x2={w} y2={zeroY} /> : null}
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
/** Mobil (26c.3): variant A (nøgletal i rækker) højst 4 rækker, før resten foldes. */
export const MOBILE_A_ROWS = 4;

/**
 * Mobilvariant (26c.3): A (nøgletal i rækker, år i kolonner) når brugeren skal sammenligne
 * på tværs af nøgletal; B (år i rækker, nøgletal i kolonner) når der er få nøgletal (1–2)
 * og mange år. Over 560 px altid A.
 */
export function multiYearVariant(width: number, metricCount: number, variant?: "A" | "B"): "A" | "B" {
  if (width > 560) return "A";
  if (variant) return variant;
  return metricCount <= 2 ? "B" : "A";
}

/** "2022 og 2021", "2023, 2022 og 2021". */
function joinYears(ys: readonly number[]): string {
  return ys.length < 2 ? ys.join("") : `${ys.slice(0, -1).join(", ")} og ${ys.at(-1)}`;
}

export function MultiYearTable({ financials, metrics, years, title, error, variant }: { financials?: FinancialsVM; metrics?: readonly Metric[]; years?: number; title?: string; error?: string; variant?: "A" | "B" }) {
  const heading = title ?? "Flerårstabel";
  const [ref, W] = useWidth<HTMLDivElement>(1048);
  const [allRows, setAllRows] = useState(false);
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
  const chosen: Metric[] = (metrics?.length ? [...metrics] : all.at(-1)?.revenue != null ? ["omsaetning", ...DEFAULT_METRICS] : DEFAULT_METRICS).slice(0, 6) as Metric[];
  const mode = multiYearVariant(W, chosen.length, variant);
  const mobile = W <= 560;
  // Mobil (26c.3) ruller vandret til de ældre år, så alle ønskede år tegnes; desktop viser dem, bredden kan bære.
  const span = Math.max(2, Math.min(10, years ?? 5, mobile ? 10 : yearsThatFit(W)));
  const shown = all.slice(-span);
  const amountMetrics = chosen.filter((m) => METRIC_KIND[m] === "amount");
  const scale = amountMetrics.length ? amountScale(shown.flatMap((y) => amountMetrics.map((m) => (y[METRIC_FIELD[m]] as number | null) ?? 0)), currencyUnit(financials.currency)) : null;
  const fmt = (m: Metric, v: number | null | undefined) => {
    if (v == null) return null;
    const kind = METRIC_KIND[m];
    if (kind === "percent") return formatPercent(v, false);
    return kind === "amount" && scale ? formatScaled(v, scale) : formatNumber(v);
  };
  const unitOf = (m: Metric) => (METRIC_KIND[m] === "amount" && scale ? scale.label : METRIC_KIND[m] === "percent" ? "%" : "antal");

  if (mobile && mode === "B") {
    // 26c.3 variant B (EEO-0): ét kort pr. nøgletal, titel 600 + enhed muted, år som kolonner, seneste år i en grå boks.
    return (
      <Section title={heading} span="full">
        <div className="lasso-myt-cards" data-variant="B" ref={ref}>
          {chosen.map((m) => (
            <div key={m} className="lasso-myt-card">
              <div className="lasso-myt-card__head">
                <span className="lasso-myt-card__title">{METRIC_LABELS[m]}</span>
                <span className="lasso-myt-card__unit">{unitOf(m)}</span>
              </div>
              <div className="lasso-myt-card__years" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
                {shown.map((y, i) => {
                  const v = y[METRIC_FIELD[m]] as number | null | undefined;
                  const last = i === shown.length - 1;
                  return (
                    <div key={y.year} className={`lasso-myt-card__year ${last ? "is-last" : ""}`}>
                      <span className="lasso-myt-card__yr">{y.year}</span>
                      <span className={`lasso-myt-card__val ${typeof v === "number" && v < 0 ? "lasso-down" : ""}`}>{fmt(m, v) ?? <Missing />}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  if (mobile) {
    // 26c.3 variant A (ED8-0): fast navnekolonne med lodret kant, hovedrække på grå flade, nyeste år først
    // (600), vandret rul til de ældre år med en hjælpetekst under tabellen. Højst 4 rækker, før resten foldes.
    const newestFirst = [...shown].reverse();
    const visibleYears = Math.max(1, Math.floor((W - 120) / 72));
    const hidden = newestFirst.slice(visibleYears).map((y) => y.year);
    const mRows = chosen.length > MOBILE_A_ROWS && !allRows ? chosen.slice(0, MOBILE_A_ROWS) : chosen;
    return (
      <Section title={heading} subtitle={scale ? scale.label : undefined} span="full">
        <div className="lasso-myt-m" ref={ref}>
          <table className="lasso-myt-m__table" data-variant="A">
            <thead>
              <tr>
                <th scope="col" className="lasso-myt-m__name">Nøgletal</th>
                {newestFirst.map((y, i) => (
                  <th key={y.year} scope="col" className={`lasso-num ${i === 0 ? "is-last" : ""}`}>
                    {y.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mRows.map((m) => (
                <tr key={m}>
                  <th scope="row" className="lasso-myt-m__name">{METRIC_LABELS[m]}</th>
                  {newestFirst.map((y, i) => {
                    const v = y[METRIC_FIELD[m]] as number | null | undefined;
                    return (
                      <td key={y.year} className={`lasso-num ${i === 0 ? "is-last" : ""} ${typeof v === "number" && v < 0 ? "lasso-down" : ""}`}>
                        {fmt(m, v) ?? <Missing />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hidden.length ? <p className="lasso-myt-m__note">Rul vandret for {joinYears(hidden)}.</p> : null}
        {chosen.length > MOBILE_A_ROWS ? (
          <button type="button" className="lasso-rowmore" aria-expanded={allRows} onClick={() => setAllRows(!allRows)}>
            {allRows ? "Vis færre" : `Vis alle ${chosen.length} nøgletal`}
          </button>
        ) : null}
      </Section>
    );
  }

  const rowsShown = chosen;

  return (
    <Section title={heading} span="full">
      <div className="lasso-table-wrap" ref={ref}>
        <div className="lasso-myt" data-variant="A">
          <div className="lasso-myt__head">
            <div className="lasso-myt__unit">{scale ? scale.label.toUpperCase() : ""}</div>
            {shown.map((y, i) => (
              <div key={y.year} className={`lasso-myt__year lasso-myt__year--head ${i === shown.length - 1 ? "lasso-myt__year--last" : ""}`}>
                {y.year}
              </div>
            ))}
            <div className="lasso-myt__delta lasso-myt__colhead">Ændring</div>
            <div className="lasso-myt__trend lasso-myt__colhead">Tendens</div>
          </div>
          {rowsShown.map((m) => {
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
