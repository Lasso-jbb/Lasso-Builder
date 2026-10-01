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
 * listen er den, der fremhæves (order "asc" sorterer laveste først); resten tegnes i neutral (chart-5). Navn i fast kolonne 170 px,
 * bjælke 18 px med radius 3, tallet lige til højre for bjælken, plads-nummer som overlinje til venstre.
 */
/** 13.3: så mange står i ranglisten. */
const TOP = 5;

export function Ranking({ rows, metric, title, order = "desc", top = TOP }: { rows: RankingRow[]; metric: Metric; title?: string; order?: "desc" | "asc"; /** Antal pladser (3–10, standard 5). */ top?: number }) {
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
    .sort((a, b) => (order === "asc" ? a.value - b.value : b.value - a.value));

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
  // 13.3/35 (Jakob 01.10): top N (standard 5, op til 10). Står virksomheden selv længere nede, vises den i
  // midten med naboen over og under (fx 1, 2, …, 6, 7, 8), så man kan se, hvor den ligger.
  const originAt = entries.findIndex((e) => e.lassoId === originId);
  const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));
  const n = Math.min(top, entries.length);
  const middle = order !== "asc" && originAt >= n;
  const shown: ((typeof ranked)[number] | "gap")[] = middle
    ? [...ranked.slice(0, Math.max(1, n - 3)), "gap", ...ranked.slice(originAt - 1, originAt + 2)]
    : ranked.slice(0, n);
  const subtitle = `${scale ? `${scale.label}, ` : ""}${mixed ? "forskellige valutaer, ikke direkte sammenlignelige, " : ""}${middle ? `plads ${originAt + 1} af ${entries.length}` : `top ${n}`}`;

  return (
    <Section title={heading} subtitle={subtitle} span="half" className="lasso-ranking">
      <ol className="lasso-ranking-list">
        {shown.map((e, k) => {
          if (e === "gap") {
            return (
              <li className="lasso-ranking__gap" key={`gap-${k}`} aria-hidden="true">
                …
              </li>
            );
          }
          const isOrigin = e.lassoId === (order === "asc" ? entries[0]?.lassoId : originId);
          const pct = (Math.abs(e.value) / maxAbs) * 100;
          return (
            <li className={`lasso-ranking__row ${isOrigin ? "lasso-ranking__row--origin" : ""}`} key={e.lassoId}>
              <span className="lasso-ranking__rank">{e.rank}</span>
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
