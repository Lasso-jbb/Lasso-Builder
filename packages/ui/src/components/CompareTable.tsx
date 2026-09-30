import { useRef, useState } from "react";
import { amountScale, currencyUnit, formatAmount, formatNumber, formatPercent, formatScaled, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, changePercent, type Dataset, type Metric } from "@lasso/spec";
import type { ViewAction } from "../types.js";
import { DataState, Section } from "../primitives.js";

/** "Bedst" er kun entydigt for beløb (og ratio-nøgletal, hvor højere er bedre); aldrig for ansatte, gæld eller balancesum (katalog 22). */
const BEST_IS_HIGHEST: ReadonlySet<Metric> = new Set(["omsaetning", "bruttofortjeneste", "resultat", "egenkapital", "ebitda", "soliditetsgrad", "overskudsgrad", "likviditetsgrad"]);

const SHORT: Partial<Record<Metric, string>> = { bruttofortjeneste: "Bruttofortj.", resultat: "Resultat", soliditetsgrad: "Soliditet" };

/**
 * Sammenligning, 2–6 virksomheder i kolonner, nøgletal i rækker (katalog 22).
 * Udgangsvirksomheden (første) har 3 px koral topkant. Enheden står i rækkenavnet.
 * Bedste værdi pr. række fremhæves kun med vægt 600. Manglende data: "Ikke hentet" (tallene
 * kunne ikke hentes for virksomheden) eller "Ikke oplyst" (regnskabet har ikke tallet).
 * Tom kolonne med stiplet kant er "tilføj"-slot, "+ Tilføj (op til 6)" i koral (forsvinder ved 6).
 * Hovedrækken står på panel-flade; negative tal i rødt.
 * Tablet (26f.5): titel + "Tilføj"/"Nøgletal" i hovedet, fast nøgletalskolonne "Nøgletal, t. kr." og
 * emnevirksomheden i koral-soft hoved med "Emne"; alle tal i t. kr.; 4+ virksomheder ruller.
 * Mobil (26e.7, mønster 5): udgangsvirksomheden og én anden ad gangen; swipe eller prikkerne vælger
 * næste par; "+ Tilføj virksomhed" og "Vælg nøgletal" under tabellen.
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
      cvr: co?.cvr,
      city: co?.address?.city,
      last: years.at(-1),
      unit: currencyUnit(years.at(-1)?.currency ?? dataset.financials[id]?.currency),
      prev: years.at(-2),
      error: dataset.errors[`company:${id}`] ?? dataset.errors[`financials:${id}`],
      loaded: Boolean(co) || Boolean(dataset.financials[id]),
      fetched: Boolean(dataset.financials[id]),
    };
  });
  // Rammen har allerede visningens titel; sektionen får kun en overskrift, når modellen giver en.
  const heading = title ?? "Sammenligning";
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
  // 22.1: højeste vækst er entydigt bedst og står i vægt 600 som de andre rækker.
  const growth = firstAmount ? cols.map((c) => changePercent(c.prev?.[METRIC_FIELD[firstAmount]] as number | undefined, c.last?.[METRIC_FIELD[firstAmount]] as number | undefined)) : [];
  const growthPresent = growth.filter((v): v is number => v !== null);
  const bestGrowth = growthPresent.length > 1 ? Math.max(...growthPresent) : null;
  const addPrompt = () => onAction({ kind: "prompt", prompt: `Tilføj en virksomhed til sammenligningen af ${cols.map((c) => c.name).join(", ")}.` });
  const metricPrompt = () => onAction({ kind: "prompt", prompt: `Vælg andre nøgletal til sammenligningen af ${cols.map((c) => c.name).join(", ")}.` });
  const unitAll = cols.find((c) => c.last)?.unit ?? "kr.";
  const thousands = { divisor: 1_000, label: `t. ${unitAll}` };
  const subtitle = `${formatNumber(cols.length)} virksomheder${year ? `, ${year}` : ""}`;

  return (
    <Section
      title={heading}
      subtitle={subtitle}
      span="full"
      className={`lasso-comparesec${title ? " has-title" : ""}`}
      action={
        canAdd ? (
          <span className="lasso-compare__tools">
            {slot ? (
              <button type="button" className="lasso-btn lasso-btn--sm" onClick={addPrompt}>
                + Tilføj
              </button>
            ) : null}
            <button type="button" className="lasso-btn lasso-btn--sm" onClick={metricPrompt}>
              Nøgletal
            </button>
          </span>
        ) : undefined
      }
    >
      {cols.length > 2 ? (
        <div className="lasso-compare__pairs" role="group" aria-label="Vælg par">
          {Array.from({ length: pairs }, (_, k) => (
            <button key={k} type="button" className={`lasso-compare__dot ${k === shownPair ? "is-on" : ""}`} aria-pressed={k === shownPair} aria-label={`${cols[0]!.name} og ${cols[k + 1]!.name}`} onClick={() => setPair(k)} />
          ))}
          <span className="lasso-compare__hint">swipe for næste par</span>
        </div>
      ) : null}
      {/* 26f.5: fra 4 virksomheder ruller kolonnerne vandret bag en 28 px fade; udgangsvirksomheden står fast. */}
      <div className={`lasso-table-frame${cols.length >= 4 ? " lasso-compare-frame--many" : ""}`}>
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
                <th scope="col" className="lasso-compare__corner">
                  <span className="lasso-compare__v-d">Nøgletal{year ? `, ${year}` : ""}</span>
                  <span className="lasso-compare__v-t">Nøgletal, {thousands.label}</span>
                  <span className="lasso-compare__v-m">Nøgletal</span>
                </th>
                {cols.map((c, i) => (
                  <th key={c.id} scope="col" className={`lasso-compare__company ${i === 0 ? "is-origin" : ""} ${off(i)}`}>
                    {/* Ø13/B8: navnet ombrydes på højst 2 linjer og afkortes derefter; det fulde navn står i title (tooltip). */}
                    <div className="lasso-compare__name" title={c.name}>
                      {canDrillDown ? (
                        <button type="button" className="lasso-link" onClick={() => onAction({ kind: "open-company", lassoId: c.id, name: c.name })}>
                          {c.name}
                        </button>
                      ) : (
                        c.name
                      )}
                    </div>
                    {/* 22.1 (Jakob 29.09, G9): kun navnet; ingen "CVR …, by" under. Tablet markerer emnet, mobil enheden. */}
                    {i === 0 ? <div className="lasso-compare__sub lasso-compare__v-t is-origin">Emne</div> : null}
                    {i === 0 ? <div className="lasso-compare__sub lasso-compare__v-m">{thousands.label}</div> : null}
                  </th>
                ))}
                {slot ? (
                  <th scope="col" className="lasso-compare__slot">
                    <button type="button" className="lasso-compare__add" onClick={addPrompt}>
                      + Tilføj (op til 6)
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
                      <span className="lasso-compare__v-d">
                        {METRIC_LABELS[m]}
                        {scale ? `, ${scale.label}` : ""}
                      </span>
                      <span className="lasso-compare__v-c">{SHORT[m] && kind !== "count" ? <><span className="lasso-compare__v-t">{METRIC_LABELS[m]}</span><span className="lasso-compare__v-m">{SHORT[m]}</span></> : METRIC_LABELS[m]}</span>
                    </th>
                    {values.map((v, i) => (
                      <td key={cols[i]!.id} className={`lasso-num ${v !== null && v === best ? "lasso-best" : ""} ${v !== null && v < 0 ? "lasso-down" : ""} ${off(i)}`}>
                        {v === null ? (
                          missing(i)
                        ) : kind === "percent" ? (
                          formatPercent(v, false)
                        ) : scale ? (
                          <>
                            <span className="lasso-compare__v-d">{formatScaled(v, scale)}</span>
                            <span className="lasso-compare__v-c">{formatScaled(v, thousands)}</span>
                          </>
                        ) : mixed ? (
                          formatAmount(v, cols[i]!.unit)
                        ) : (
                          formatNumber(v)
                        )}
                      </td>
                    ))}
                    {slot ? <td className="lasso-compare__slot" aria-hidden="true" /> : null}
                  </tr>
                );
              })}
              {firstAmount ? (
                <tr>
                  <th scope="row">
                    <span className="lasso-compare__v-d">Udvikling i {METRIC_LABELS[firstAmount].toLowerCase()}, %</span>
                    <span className="lasso-compare__v-c">Udvikling, %</span>
                  </th>
                  {cols.map((c, i) => {
                    const pct = growth[i] ?? null;
                    return (
                      <td key={c.id} className={`lasso-num ${pct !== null && pct === bestGrowth ? "lasso-best" : ""} ${pct === null ? "" : pct < 0 ? "lasso-down" : "lasso-up"} ${off(i)}`}>
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
      {canAdd ? (
        <div className="lasso-compare__mactions">
          {slot ? (
            <button type="button" className="lasso-btn" onClick={addPrompt}>
              + Tilføj virksomhed
            </button>
          ) : null}
          <button type="button" className="lasso-btn" onClick={metricPrompt}>
            Vælg nøgletal
          </button>
        </div>
      ) : null}
    </Section>
  );
}
