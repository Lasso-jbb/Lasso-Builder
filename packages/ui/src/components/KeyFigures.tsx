import { formatAmount, formatNumber, METRIC_FIELD, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { Delta, StateBox, stateForError } from "../primitives.js";

export function formatMetric(metric: Metric, value: number | null | undefined): string {
  return metric === "ansatte" ? formatNumber(value) : formatAmount(value);
}

export function KeyFigures({ financials, metrics, error }: { financials?: FinancialsVM; metrics?: readonly Metric[]; error?: string }) {
  if (!financials) return error ? <StateBox kind={stateForError(error)} message={error} /> : <StateBox kind="loading" />;
  const last = financials.years.at(-1);
  const prev = financials.years.at(-2);
  if (!last) return <StateBox kind="empty" message="Ingen offentliggjorte regnskaber." />;

  // Uden omsætning (typisk for mindre selskaber) vises bruttofortjeneste i stedet.
  const chosen: Metric[] = metrics?.length
    ? [...metrics]
    : [last.revenue != null ? "omsaetning" : "bruttofortjeneste", "resultat", "egenkapital", "ansatte"];

  return (
    <div className="lasso-kpis lasso-span-2">
      {chosen.map((m) => {
        const field = METRIC_FIELD[m];
        const value = last[field] as number | null | undefined;
        const before = prev?.[field] as number | null | undefined;
        return (
          <div className="lasso-kpi" key={m}>
            <div className="lasso-kpi__label">{METRIC_LABELS[m]}</div>
            <div className="lasso-kpi__value">{formatMetric(m, value)}</div>
            <div className="lasso-kpi__delta">
              <Delta from={before} to={value} /> <span className="lasso-kpi__year">{last.year}{prev ? ` vs. ${prev.year}` : ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
