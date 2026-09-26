import { amountScale, formatNumber, formatPercent, formatScaled, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, type CompanyVM, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Section, stateForError } from "../primitives.js";

export interface RankingRow {
  lassoId: string;
  company?: CompanyVM;
  financials?: FinancialsVM;
  error?: string;
}

/**
 * Rangliste: vandrette søjler, virksomheden selv i koral blandt lignende
 * virksomheder på ét nøgletal (katalog 13, række 0). Første virksomhed i
 * listen er den, der fremhæves; resten (og en median) tegnes i neutral (chart-5).
 */
export function Ranking({ rows, metric, title }: { rows: RankingRow[]; metric: Metric; title?: string }) {
  const heading = title ?? `${METRIC_LABELS[metric]} blandt lignende`;
  const originId = rows[0]?.lassoId;
  const errors = rows.filter((r) => r.error && !r.financials);
  if (rows.every((r) => !r.financials && !r.company)) {
    const first = errors[0]?.error;
    return (
      <Section title={heading} span="half" className="lasso-ranking">
        {first ? <DataState state={stateForError(first) === "noaccess" ? "empty" : "error"} reason={first} /> : <DataState state="loading" lines={5} height={220} />}
      </Section>
    );
  }
  const kind = METRIC_KIND[metric];
  const entries = rows
    .map((r) => {
      const v = r.financials?.years.at(-1)?.[METRIC_FIELD[metric]];
      return { lassoId: r.lassoId, name: r.company?.name ?? r.lassoId, value: typeof v === "number" ? v : null };
    })
    .filter((r): r is { lassoId: string; name: string; value: number } => r.value !== null)
    .sort((a, b) => b.value - a.value);

  if (entries.length < 2) {
    return (
      <Section title={heading} span="half" className="lasso-ranking">
        <DataState state="empty" reason={`Ikke nok virksomheder har oplyst ${METRIC_LABELS[metric].toLowerCase()} til en rangliste.`} height={220} />
      </Section>
    );
  }

  const values = entries.map((e) => e.value);
  const scale = kind === "amount" ? amountScale(values) : null;
  const label = (v: number) => (kind === "percent" ? formatPercent(v, false) : scale ? formatScaled(v, scale) : formatNumber(v));
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  const subtitle = `${scale ? `${scale.label}, ` : ""}top ${entries.length}`;

  return (
    <Section title={heading} subtitle={subtitle} span="half" className="lasso-ranking">
      <ol className="lasso-ranking-list">
        {entries.map((e, i) => {
          const isOrigin = e.lassoId === originId;
          const pct = (Math.abs(e.value) / maxAbs) * 100;
          return (
            <li className={`lasso-ranking__row ${isOrigin ? "lasso-ranking__row--origin" : ""}`} key={e.lassoId}>
              <span className="lasso-ranking__rank">{i + 1}</span>
              <span className="lasso-ranking__name">{e.name}</span>
              <span className="lasso-ranking__track">
                <span className={`lasso-ranking__fill ${isOrigin ? "lasso-ranking__fill--origin" : ""}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="lasso-ranking__value">{label(e.value)}</span>
            </li>
          );
        })}
        <li className="lasso-ranking__row lasso-ranking__row--median">
          <span className="lasso-ranking__rank" aria-hidden="true" />
          <span className="lasso-ranking__name">Median</span>
          <span className="lasso-ranking__track" aria-hidden="true" />
          <span className="lasso-ranking__value">{label(median)}</span>
        </li>
      </ol>
    </Section>
  );
}
