import { METRIC_LABELS, type Dataset, type Metric } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { Card, StateBox } from "../primitives.js";
import { formatMetric, METRIC_FIELD } from "./KeyFigures.js";

export function Comparison({
  companies,
  metrics,
  title,
  dataset,
  onAction,
  canDrillDown,
}: {
  companies: readonly string[];
  metrics: readonly Metric[];
  title?: string;
  dataset: Dataset;
  onAction: (a: ViewAction) => void;
  canDrillDown: boolean;
}) {
  const cols = companies.map((id) => ({
    id,
    name: dataset.companies[id]?.name ?? id,
    last: dataset.financials[id]?.years.at(-1),
    error: dataset.errors[`company:${id}`] ?? dataset.errors[`financials:${id}`],
  }));
  if (cols.every((c) => !c.last && c.error)) return <Card title={title ?? "Sammenligning"}><StateBox kind="error" message={cols[0]?.error} /></Card>;

  return (
    <Card title={title ?? "Sammenligning"} className="lasso-span-2">
      <div className="lasso-table-wrap">
        <table className="lasso-table lasso-compare">
          <thead>
            <tr>
              <th scope="col">Nøgletal</th>
              {cols.map((c) => (
                <th key={c.id} className="lasso-num" scope="col">
                  {canDrillDown ? <button className="lasso-link" onClick={() => onAction({ kind: "open-company", lassoId: c.id, name: c.name })}>{c.name}</button> : c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const values = cols.map((c) => (c.last?.[METRIC_FIELD[m]] as number | null | undefined) ?? null);
              const best = Math.max(...values.filter((v): v is number => v !== null));
              return (
                <tr key={m}>
                  <th scope="row">{METRIC_LABELS[m]}</th>
                  {values.map((v, i) => (
                    <td key={cols[i]!.id} className={`lasso-num ${v !== null && v === best && values.length > 1 ? "lasso-best" : ""}`}>
                      {formatMetric(m, v)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <th scope="row">Regnskabsår</th>
              {cols.map((c) => (
                <td key={c.id} className="lasso-num lasso-muted">{c.last?.year ?? "–"}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
