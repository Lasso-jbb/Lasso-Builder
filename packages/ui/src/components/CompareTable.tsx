import { amountScale, formatNumber, formatPercent, formatScaled, METRIC_FIELD, METRIC_LABELS, percentChange, type Dataset, type Metric } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section } from "../primitives.js";

/** "Bedst" er kun entydigt for beløb; aldrig for ansatte (katalog 22). */
const BEST_IS_HIGHEST: ReadonlySet<Metric> = new Set(["omsaetning", "bruttofortjeneste", "resultat", "egenkapital"]);

/**
 * Sammenligning, 2–6 virksomheder i kolonner, nøgletal i rækker (katalog 22).
 * Udgangsvirksomheden (første) har 3 px koral topkant. Enheden står i rækkenavnet.
 * Bedste værdi pr. række fremhæves kun med vægt 600. Manglende data: "Ikke oplyst".
 */
export function CompareTable({
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
  const cols = companies.map((id) => {
    const co = dataset.companies[id];
    const years = dataset.financials[id]?.years ?? [];
    return {
      id,
      name: co?.name ?? id,
      sub: [co?.cvr ? `CVR ${co.cvr}` : null, co?.address?.city].filter(Boolean).join(", "),
      last: years.at(-1),
      prev: years.at(-2),
      error: dataset.errors[`company:${id}`] ?? dataset.errors[`financials:${id}`],
      loaded: Boolean(co) || Boolean(dataset.financials[id]),
    };
  });
  // Rammen har allerede visningens titel; sektionen får kun en overskrift, når modellen giver en.
  const heading = title;
  if (cols.every((c) => !c.loaded && c.error)) {
    return (
      <Section title={heading} span="full">
        <DataState state="error" reason={cols[0]?.error} />
      </Section>
    );
  }
  const year = cols.map((c) => c.last?.year).find((y) => y !== undefined);
  const firstAmount = metrics.find((m) => m !== "ansatte");

  return (
    <Section title={heading} span="full">
      <div className="lasso-table-frame">
        <div className="lasso-table-wrap">
          <table className="lasso-table lasso-compare">
            <thead>
              <tr>
                <th scope="col" className="lasso-compare__corner">Nøgletal{year ? `, ${year}` : ""}</th>
                {cols.map((c, i) => (
                  <th key={c.id} scope="col" className={`lasso-compare__company ${i === 0 ? "is-origin" : ""}`}>
                    <div className="lasso-compare__name">
                      {canDrillDown ? (
                        <button type="button" className="lasso-link" onClick={() => onAction({ kind: "open-company", lassoId: c.id, name: c.name })}>
                          {c.name}
                        </button>
                      ) : (
                        c.name
                      )}
                    </div>
                    {c.sub ? <div className="lasso-compare__sub">{c.sub}</div> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const values = cols.map((c) => (c.last?.[METRIC_FIELD[m]] as number | null | undefined) ?? null);
                const present = values.filter((v): v is number => v !== null);
                const scale = m === "ansatte" ? null : amountScale(present);
                const best = BEST_IS_HIGHEST.has(m) && present.length > 1 ? Math.max(...present) : null;
                return (
                  <tr key={m}>
                    <th scope="row">
                      {METRIC_LABELS[m]}
                      {scale ? `, ${scale.label}` : ""}
                    </th>
                    {values.map((v, i) => (
                      <td key={cols[i]!.id} className={`lasso-num ${v !== null && v === best ? "lasso-best" : ""} ${v !== null && v < 0 && m === "resultat" ? "lasso-down" : ""}`}>
                        {v === null ? <span className="lasso-notreported">Ikke oplyst</span> : scale ? formatScaled(v, scale) : formatNumber(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {firstAmount ? (
                <tr>
                  <th scope="row">Udvikling i {METRIC_LABELS[firstAmount].toLowerCase()}, %</th>
                  {cols.map((c) => {
                    const pct = percentChange([c.prev?.[METRIC_FIELD[firstAmount]] as number | undefined, c.last?.[METRIC_FIELD[firstAmount]] as number | undefined]);
                    return (
                      <td key={c.id} className={`lasso-num ${pct === null ? "" : pct < 0 ? "lasso-down" : "lasso-up"}`}>
                        {pct === null ? <span className="lasso-notreported">Ikke oplyst</span> : formatPercent(pct).replace(" %", "")}
                      </td>
                    );
                  })}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
