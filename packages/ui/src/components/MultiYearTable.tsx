import { useEffect, useRef, useState } from "react";
import { usePrintMode } from "../print.js";
import { ExpandLink } from "./ExpandLink.js";
import { amountScale, currencyUnit, formatNumber, formatPercent, formatScaled, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, changePercent, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Missing, Section, stateForError } from "../primitives.js";
import { useWidth } from "../useWidth.js";
import { Checkbox } from "./TableKit.js";

/**
 * Hvor mange årskolonner bredden kan bære uden vandret scroll (review P1-2): etiket +
 * år (+ ændring og tendens over 768 px). Mål fra styles.css (.lasso-myt__*). De nyeste
 * år beholdes altid; de ældste falder fra.
 */
export function yearsThatFit(width: number): number {
  const mobile = width <= 560;
  const label = mobile ? 120 : 160;
  const year = mobile ? 72 : 96;
  // Jakob 01.10: ingen tendenskolonne; kun ændringen står efter årene.
  const extras = width > 768 ? 80 : 0;
  return Math.max(2, Math.floor((width - label - extras) / year));
}

/** 10.2 (Jakob 01.10): de 4 vigtigste i læserækkefølge: indtjening, bundlinje, polstring, størrelse. Ingen omsætning (mange oplyser den ikke). */
const DEFAULT_METRICS: Metric[] = ["bruttofortjeneste", "resultat", "egenkapital", "ansatte"];
/** 18 (Jakob 01.10): den store flerårstabel (fuld bredde) viser flere nøgletal. */
const LARGE_METRICS: Metric[] = ["bruttofortjeneste", "ebitda", "resultat", "egenkapital", "balancesum", "soliditetsgrad", "overskudsgrad", "ansatte"];
/** Fra denne bredde er tabellen "stor" og viser LARGE_METRICS som standard. */
const LARGE_FROM = 960;
/** 18 mobil (Jakob 01.10): kun de seneste 3 år, så tabellen står uden vandret rulning. */
const MOBILE_YEARS = 3;


/** Pil + procent, også ved fortegnsskift; intet når forrige mangler eller er 0 (samme regel som Delta, 02c.4). */
function changeText(prev: number | undefined, last: number | undefined): { text: string; tone: "up" | "down" | "" } {
  const pct = changePercent(prev, last);
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

/**
 * `chartMetrics` + `onChartToggle` (30.11): afkrydsning foran hver post, der styrer, hvilke nøgletal
 * en tilhørende linjegraf viser (LineChart extraMetrics). Uden `onChartToggle` ingen afkrydsning.
 */
export function MultiYearTable({ financials, metrics, years, title, error, variant, chartMetrics, onChartToggle }: { financials?: FinancialsVM; metrics?: readonly Metric[]; years?: number; title?: string; error?: string; variant?: "A" | "B"; /** Nøgletal, der står i grafen (afkrydset). */ chartMetrics?: readonly Metric[]; /** Afkrydsning ændret: vis/skjul nøgletallet i grafen. */ onChartToggle?: (metric: Metric, on: boolean) => void }) {
  const heading = title ?? "Flerårstabel";
  const [ref, W] = useWidth<HTMLDivElement>(1048);
  const [allRows, setAllRows] = useState(usePrintMode());
  // Kontrol r5 (10.2 mobil): hjælpeteksten nævner kun de år, der faktisk ligger uden for billedet (målt).
  const mobileTable = useRef<HTMLTableElement>(null);
  const [fitYears, setFitYears] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      const t = mobileTable.current;
      if (!t || !t.parentElement) return;
      const right = t.parentElement.getBoundingClientRect().right + 1;
      const cols = Array.from(t.querySelectorAll("thead th:not(.lasso-myt-m__name)"));
      setFitYears(cols.filter((th) => th.getBoundingClientRect().right <= right).length);
    };
    measure();
    // Skrifttypen kan ændre kolonnebredderne efter første måling.
    if (typeof document !== "undefined") void document.fonts?.ready.then(measure);
  }, [W, financials, years]);
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
  const large = W >= LARGE_FROM;
  const chosen: Metric[] = (metrics?.length ? [...metrics] : large ? LARGE_METRICS : DEFAULT_METRICS).slice(0, large ? 8 : 6) as Metric[];
  const mode = multiYearVariant(W, chosen.length, variant);
  const mobile = W <= 560;
  // Mobil (26c.3) ruller vandret til de ældre år, så alle ønskede år tegnes; desktop viser dem, bredden kan bære.
  const span = Math.max(2, Math.min(10, years ?? 5, mobile ? MOBILE_YEARS : yearsThatFit(W)));
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
    const visibleYears = fitYears ?? Math.max(1, Math.floor((W - 120) / 60));
    const hidden = newestFirst.slice(visibleYears).map((y) => y.year);
    const mRows = chosen.length > MOBILE_A_ROWS && !allRows ? chosen.slice(0, MOBILE_A_ROWS) : chosen;
    return (
      <Section title={heading} subtitle={scale ? scale.label : undefined} span="full">
        <div className="lasso-myt-m" ref={ref}>
          <table className="lasso-myt-m__table" data-variant="A" ref={mobileTable}>
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
          <ExpandLink expanded={allRows} total={chosen.length} onToggle={() => setAllRows(!allRows)} />
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
          </div>
          {rowsShown.map((m) => {
            const values = shown.map((y) => y[METRIC_FIELD[m]] as number | null | undefined);
            const change = changeText(values.at(-2) ?? undefined, values.at(-1) ?? undefined);
            return (
              <div className="lasso-myt__row" key={m}>
                <div className="lasso-myt__label">
                  {onChartToggle ? (
                    <label className="lasso-myt__pick">
                      <Checkbox checked={chartMetrics?.includes(m) ?? false} label={`Vis ${METRIC_LABELS[m].toLowerCase()} i grafen`} onChange={(on) => onChartToggle(m, on)} />
                      {METRIC_LABELS[m]}
                    </label>
                  ) : (
                    METRIC_LABELS[m]
                  )}
                </div>
                {values.map((v, i) => (
                  <div key={shown[i]!.year} className={`lasso-myt__year ${i === values.length - 1 ? "lasso-myt__year--last" : ""} ${typeof v === "number" && v < 0 ? "lasso-down" : ""}`}>
                    {fmt(m, v) ?? <Missing />}
                  </div>
                ))}
                <div className={`lasso-myt__delta ${change.tone === "down" ? "lasso-down" : change.tone === "up" ? "lasso-up" : ""}`}>{change.text}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
