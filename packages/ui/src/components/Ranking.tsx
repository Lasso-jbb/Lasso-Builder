import { amountScale, currencyUnit, formatAmount, formatNumber, formatPercent, formatScaled, METRIC_FIELD, METRIC_KIND, METRIC_LABELS, type CompanyVM, type FinancialsVM, type Metric } from "@lasso/spec";
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
 * listen er den, der fremhæves; resten tegnes i neutral (chart-5). Navn i fast kolonne 170 px,
 * bjælke 18 px med radius 3, tallet lige til højre for bjælken, plads-nummer som overlinje til venstre.
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
      const unit = currencyUnit(r.financials?.years.at(-1)?.currency ?? r.financials?.currency);
      return { lassoId: r.lassoId, name: r.company?.name ?? r.lassoId, value: typeof v === "number" ? v : null, unit };
    })
    .filter((r): r is { lassoId: string; name: string; value: number; unit: string } => r.value !== null)
    .sort((a, b) => b.value - a.value);

  if (entries.length < 2) {
    return (
      <Section title={heading} span="half" className="lasso-ranking">
        <DataState state="empty" reason={`Ikke nok virksomheder har oplyst ${METRIC_LABELS[metric].toLowerCase()} til en rangliste.`} height={220} />
      </Section>
    );
  }

  const values = entries.map((e) => e.value);
  // Beløb i forskellige valutaer kan ikke rangeres mod hinanden; hvert tal vises så med sin egen valuta.
  const units = new Set(entries.map((e) => e.unit));
  const mixed = kind === "amount" && units.size > 1;
  const scale = kind === "amount" && !mixed ? amountScale(values, [...units][0] ?? "kr.") : null;
  const label = (v: number, unit?: string) => (kind === "percent" ? formatPercent(v, false) : scale ? formatScaled(v, scale) : mixed ? formatAmount(v, unit ?? "") : formatNumber(v));
  const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1);
  const subtitle = `${scale ? `${scale.label}, ` : ""}${mixed ? "forskellige valutaer, ikke direkte sammenlignelige, " : ""}top ${entries.length}`;

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
              {/* 13.3: tallet står altid lige til højre for bjælken, aldrig inde i den eller i egen kolonne. */}
              <span className="lasso-ranking__track" style={{ ["--lasso-rank-p" as string]: pct / 100 }}>
                <span className={`lasso-ranking__fill ${isOrigin ? "lasso-ranking__fill--origin" : ""}`} />
                <span className="lasso-ranking__value">{label(e.value, e.unit)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
