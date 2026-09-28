import { useRef, useState } from "react";
import { amountScale, currencyUnit, formatAmount, formatNumber, formatPercent, formatScaled, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, percentChange, type Dataset, type Metric } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section } from "../primitives.js";

/** "Bedst" er kun entydigt for beløb (og ratio-nøgletal, hvor højere er bedre); aldrig for ansatte, gæld eller balancesum (katalog 22). */
const BEST_IS_HIGHEST: ReadonlySet<Metric> = new Set(["omsaetning", "bruttofortjeneste", "resultat", "egenkapital", "ebitda", "soliditetsgrad", "overskudsgrad", "likviditetsgrad"]);

/**
 * Sammenligning, 2–6 virksomheder i kolonner, nøgletal i rækker (katalog 22).
 * Udgangsvirksomheden (første) har 3 px koral topkant. Enheden står i rækkenavnet.
 * Bedste værdi pr. række fremhæves kun med vægt 600. Manglende data: "Ikke hentet" (tallene
 * kunne ikke hentes for virksomheden) eller "Ikke oplyst" (regnskabet har ikke tallet).
 * Tom kolonne med stiplet kant er "tilføj"-slot (forsvinder ved 6). Mobil (26e, mønster 5):
 * udgangsvirksomheden og én anden ad gangen; swipe eller prikkerne vælger næste par.
 */
export function CompareTable({
  companies,
  metrics,
  title,
  dataset,
  onAction,
  canDrillDown,
  canAdd = false,
}: {
  companies: readonly string[];
  metrics: readonly Metric[];
  title?: string;
  dataset: Dataset;
  onAction: (a: ViewAction) => void;
  canDrillDown: boolean;
  /** Værten kan tage imod et spørgsmål (host.prompt): tilføj-slottet beder om en virksomhed mere. */
  canAdd?: boolean;
}) {
  const [pair, setPair] = useState(0);
  const swipe = useRef<number | null>(null);
  const cols = companies.map((id) => {
    const co = dataset.companies[id];
    const years = dataset.financials[id]?.years ?? [];
    return {
      id,
      name: co?.name ?? id,
      sub: [co?.cvr ? `CVR ${co.cvr}` : null, co?.address?.city].filter(Boolean).join(", "),
      last: years.at(-1),
      unit: currencyUnit(years.at(-1)?.currency ?? dataset.financials[id]?.currency),
      prev: years.at(-2),
      error: dataset.errors[`company:${id}`] ?? dataset.errors[`financials:${id}`],
      loaded: Boolean(co) || Boolean(dataset.financials[id]),
      fetched: Boolean(dataset.financials[id]),
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
  // Mobil: udgangsvirksomheden + den valgte anden kolonne. Desktop viser alle.
  const pairs = Math.max(1, cols.length - 1);
  const shownPair = Math.min(pair, pairs - 1);
  const off = (i: number) => (cols.length > 2 && i !== 0 && i !== shownPair + 1 ? "is-offpair" : "");
  const slot = canAdd && cols.length < 6;
  const missing = (i: number) => <span className="lasso-notreported">{cols[i]!.fetched ? "Ikke oplyst" : "Ikke hentet"}</span>;
  const firstAmount = metrics.find((m) => METRIC_KIND[m] === "amount");

  return (
    <Section title={heading} span="full" className="lasso-comparesec">
      {cols.length > 2 ? (
        <div className="lasso-compare__pairs" role="group" aria-label="Vælg par">
          {Array.from({ length: pairs }, (_, k) => (
            <button key={k} type="button" className={`lasso-compare__dot ${k === shownPair ? "is-on" : ""}`} aria-pressed={k === shownPair} aria-label={`${cols[0]!.name} og ${cols[k + 1]!.name}`} onClick={() => setPair(k)} />
          ))}
          <span className="lasso-compare__hint">swipe for næste par</span>
        </div>
      ) : null}
      <div className="lasso-table-frame">
        <div
          className="lasso-table-wrap"
          onTouchStart={(e) => (swipe.current = e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            const x0 = swipe.current;
            const x1 = e.changedTouches[0]?.clientX;
            swipe.current = null;
            if (x0 == null || x1 == null || Math.abs(x1 - x0) < 40) return;
            setPair((p) => Math.max(0, Math.min(pairs - 1, Math.min(p, pairs - 1) + (x1 < x0 ? 1 : -1))));
          }}
        >
          <table className={`lasso-table lasso-compare ${slot ? "has-slot" : ""}`}>
            <thead>
              <tr>
                <th scope="col" className="lasso-compare__corner">Nøgletal{year ? `, ${year}` : ""}</th>
                {cols.map((c, i) => (
                  <th key={c.id} scope="col" className={`lasso-compare__company ${i === 0 ? "is-origin" : ""} ${off(i)}`}>
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
                {slot ? (
                  <th scope="col" className="lasso-compare__slot">
                    <button type="button" className="lasso-compare__add" onClick={() => onAction({ kind: "prompt", prompt: `Tilføj en virksomhed til sammenligningen af ${cols.map((c) => c.name).join(", ")}.` })}>
                      <span aria-hidden="true">+</span> Tilføj virksomhed
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const values = cols.map((c) => (c.last?.[METRIC_FIELD[m]] as number | null | undefined) ?? null);
                const present = values.filter((v): v is number => v !== null);
                const kind = METRIC_KIND[m];
                // Beløb i forskellige valutaer (fx DKK og EUR) kan ikke stå på fælles skala eller kåres "bedst".
                const units = new Set(cols.filter((_, i) => values[i] !== null).map((c) => c.unit));
                const mixed = kind === "amount" && units.size > 1;
                const scale = kind === "amount" && !mixed ? amountScale(present, [...units][0] ?? "kr.") : null;
                const best = BEST_IS_HIGHEST.has(m) && present.length > 1 && !mixed ? Math.max(...present) : null;
                return (
                  <tr key={m}>
                    <th scope="row">
                      {METRIC_LABELS[m]}
                      {scale ? `, ${scale.label}` : ""}
                    </th>
                    {values.map((v, i) => (
                      <td key={cols[i]!.id} className={`lasso-num ${v !== null && v === best ? "lasso-best" : ""} ${v !== null && v < 0 && m === "resultat" ? "lasso-down" : ""} ${off(i)}`}>
                        {v === null ? missing(i) : kind === "percent" ? formatPercent(v, false) : scale ? formatScaled(v, scale) : mixed ? formatAmount(v, cols[i]!.unit) : formatNumber(v)}
                      </td>
                    ))}
                    {slot ? <td className="lasso-compare__slot" aria-hidden="true" /> : null}
                  </tr>
                );
              })}
              {firstAmount ? (
                <tr>
                  <th scope="row">Udvikling i {METRIC_LABELS[firstAmount].toLowerCase()}, %</th>
                  {cols.map((c, i) => {
                    const pct = percentChange([c.prev?.[METRIC_FIELD[firstAmount]] as number | undefined, c.last?.[METRIC_FIELD[firstAmount]] as number | undefined]);
                    return (
                      <td key={c.id} className={`lasso-num ${pct === null ? "" : pct < 0 ? "lasso-down" : "lasso-up"} ${off(i)}`}>
                        {pct === null ? missing(i) : formatPercent(pct).replace(" %", "")}
                      </td>
                    );
                  })}
                  {slot ? <td className="lasso-compare__slot" aria-hidden="true" /> : null}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}
