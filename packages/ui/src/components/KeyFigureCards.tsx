import { effectiveMetric, formatMetricValue, mainMetric, METRIC_FIELD, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Delta, Sparkline, stateForError } from "../primitives.js";

export function formatMetric(metric: Metric, value: number | null | undefined, currency?: string): string {
  return formatMetricValue(metric, value, currency);
}

/** "18,8 mio. kr." -> ["18,8", "mio. kr."]; "19" -> ["19", ""]. Enheden står mindre efter tallet (09). */
function splitUnit(text: string): [string, string] {
  const m = /^(\S+)\s(.+)$/.exec(text);
  return m ? [m[1]!, m[2]!] : [text, ""];
}

/**
 * Nøgletalskort (katalog 09): 3–5 på række i én ramme med lodrette skillelinjer.
 * Tal, enhed og udvikling fra året før. Sparkline til højre ved ≥ 3 år.
 * Mangler tallet: "Ikke oplyst" med årsagen under, aldrig "0".
 */
/** Ansatte i regnskabet (ofte koncern) afviger fra CVR's tal i hovedet; etiketten siger hvilket. */
const label = (m: Metric) => (m === "ansatte" ? "Ansatte (regnskab)" : METRIC_LABELS[m]);

export function KeyFigureCards({ financials, metrics, error }: { financials?: FinancialsVM; metrics?: readonly Metric[]; error?: string }) {
  if (!financials) {
    return (
      <div className="lasso-span-full">
        {error ? <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} /> : <DataState state="loading" lines={3} height={122} />}
      </div>
    );
  }
  const years = financials.years;
  const last = years.at(-1);
  const prev = years.at(-2);
  if (!last) return <div className="lasso-span-full"><DataState state="empty" reason="Virksomheden har ikke offentliggjort et regnskab endnu." /></div>;

  // Uden omsætning i seneste regnskab (typisk klasse B) vises bruttofortjeneste i stedet, og
  // nøgletal uden tal i seneste regnskab udelades, så "Ikke oplyst" aldrig står som første kort.
  const base: Metric[] = metrics?.length ? [...metrics] : [mainMetric(years), "resultat", "egenkapital", "ansatte"];
  const wanted: Metric[] = base.map((m) => effectiveMetric(years, m));
  const unique = wanted.filter((m, i, a) => a.indexOf(m) === i);
  const present = unique.filter((m) => typeof last[METRIC_FIELD[m]] === "number");
  const chosen: Metric[] = (present.length > 0 ? present : unique.slice(0, 1)).slice(0, 5);

  return (
    <div className="lasso-kpis lasso-span-full" style={{ ["--lasso-kpi-count" as string]: chosen.length }}>
      {chosen.map((m) => {
        const field = METRIC_FIELD[m];
        const value = last[field] as number | null | undefined;
        const before = prev?.[field] as number | null | undefined;
        const series = years.map((y) => y[field] as number | null | undefined).filter((v): v is number => typeof v === "number");
        if (value === null || value === undefined) {
          return (
            <div className="lasso-kpi" key={m}>
              <div className="lasso-kpi__label">{label(m)}</div>
              <div className="lasso-kpi__missing">Ikke oplyst</div>
              <div className="lasso-kpi__delta lasso-muted">
                {m === "omsaetning" ? "Klasse B kræver ikke omsætning" : `Ikke i regnskabet for ${last.year}`}
              </div>
            </div>
          );
        }
        const [num, unit] = splitUnit(formatMetric(m, value, last.currency ?? financials.currency));
        return (
          <div className="lasso-kpi" key={m}>
            <div className="lasso-kpi__label">{label(m)}</div>
            <div className="lasso-kpi__row">
              <div className="lasso-kpi__value">
                {num}
                {unit ? <span className="lasso-kpi__unit">{unit}</span> : null}
              </div>
              {series.length >= 3 ? <Sparkline values={series} tone="accent" bare /> : null}
            </div>
            <div className="lasso-kpi__delta">
              {before === value ? <span className="lasso-muted">Uændret</span> : <Delta from={before} to={value} />}
              {prev ? <span className="lasso-kpi__year">fra {prev.year}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
