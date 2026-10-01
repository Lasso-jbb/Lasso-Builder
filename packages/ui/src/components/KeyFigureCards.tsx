import { effectiveMetric, formatMetricValue, mainMetric, METRIC_FIELD, METRIC_LABELS, type FinancialsVM, type Metric } from "@lasso/spec";
import { DataState, Delta, Sparkline, stateForError } from "../primitives.js";
import { QualityFlag } from "./QualityFlag.js";

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
const label = (m: Metric) =>
  m === "ansatte" ? (
    <>
      Ansatte<span className="lasso-kpi__label-extra"> (regnskab)</span>
    </>
  ) : (
    METRIC_LABELS[m]
  );

/** "mio. kr." -> "mio." + " kr." (på mobil står kun "mio." i samme størrelse som tallet, 26c.1). */
function Unit({ unit }: { unit: string }) {
  const m = /^(.+?)(\s(?:kr\.|DKK|EUR|USD|SEK|NOK))$/.exec(unit);
  return (
    <span className="lasso-kpi__unit">
      {m ? m[1] : unit}
      {m ? <span className="lasso-kpi__unit-cur">{m[2]}</span> : null}
    </span>
  );
}

/**
 * plain (24.5/30.13, portalens sider): felterne står mellem en 1 px top- og bundlinje, adskilt af lodrette
 * linjer uden ydre ramme; ingen sparkline, ingen branchelinje og "Ansatte 19 årsrapport 2025" i stedet for
 * "(regnskab)". På tablet (26f.1) bliver felterne selvstændige kort, på mobil 2×2 kort (26c.1).
 */
export function KeyFigureCards({
  financials,
  metrics,
  error,
  plain = false,
  employeesNow,
}: {
  financials?: FinancialsVM;
  metrics?: readonly Metric[];
  error?: string;
  plain?: boolean;
  /** Jakob 01.10: ansatte fra firmaet (GET /{lassoId}, employees.count: CVR's månedstal fra e-indkomst). Går forud for regnskabets tal. */
  employeesNow?: number;
}) {
  if (!financials) {
    if (!error) {
      // 09.1/09.4: "Henter" er kortformede skeletter, 3 linjer pr. kort, i samme højde som et fyldt kort.
      const count = Math.min(Math.max(metrics?.length ?? 4, 3), 5);
      return (
        <div className="lasso-kpis lasso-kpis--loading lasso-span-full" aria-busy="true" aria-label="Henter nøgletal" style={{ ["--lasso-kpi-count" as string]: count }}>
          {Array.from({ length: count }, (_, i) => (
            <div className="lasso-kpi" key={i}>
              <div className="lasso-skeleton lasso-kpi__skel lasso-kpi__skel--label" />
              <div className="lasso-skeleton lasso-kpi__skel lasso-kpi__skel--value" />
              <div className="lasso-skeleton lasso-kpi__skel lasso-kpi__skel--delta" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="lasso-span-full">
        <DataState state={stateForError(error) === "noaccess" ? "empty" : "error"} reason={error} />
      </div>
    );
  }
  const years = financials.years;
  const last = years.at(-1);
  const prev = years.at(-2);
  if (!last) return <div className="lasso-span-full"><DataState state="empty" reason="Virksomheden har ikke offentliggjort et regnskab endnu." /></div>;

  // Uden omsætning i seneste regnskab (typisk klasse B) vises bruttofortjeneste i stedet, medmindre
  // bruttofortjenesten allerede er valgt ved siden af. Standardkortene udelader nøgletal uden tal i
  // seneste regnskab; er nøgletallene valgt, vises de manglende som "Ikke oplyst" med årsag (09.4),
  // men aldrig som første kort.
  const explicit = Boolean(metrics?.length);
  const base: Metric[] = explicit ? [...metrics!] : [mainMetric(years), "resultat", "egenkapital", "ansatte"];
  const wanted: Metric[] = base.map((m) => {
    const eff = effectiveMetric(years, m);
    return explicit && eff !== m && base.includes(eff) ? m : eff;
  });
  const unique = wanted.filter((m, i, a) => a.indexOf(m) === i);
  const monthly = typeof employeesNow === "number";
  const has = (m: Metric) => (m === "ansatte" && monthly) || typeof last[METRIC_FIELD[m]] === "number";
  const present = unique.filter(has);
  const ordered = explicit ? [...present, ...unique.filter((m) => !has(m))] : present;
  const chosen: Metric[] = (ordered.length > 0 ? ordered : unique.slice(0, 1)).slice(0, 5);

  return (
    <div className={`lasso-kpis lasso-span-full${plain ? " lasso-kpis--plain" : ""}`} style={{ ["--lasso-kpi-count" as string]: chosen.length }}>
      {/* 26c.1: på mobil står titlen "Nøgletal ÅÅÅÅ" over de fire kort; på desktop er kortene selv overskriften. */}
      <h3 className="lasso-section__title lasso-kpis__title">Nøgletal {last.year}</h3>
      {chosen.map((m) => {
        if (m === "ansatte" && monthly) {
          // Firmaets månedstal (e-indkomst): ingen udvikling fra regnskabet, kilden står under tallet.
          return (
            <div className="lasso-kpi" key={m}>
              <div className="lasso-kpi__label">Ansatte</div>
              <div className="lasso-kpi__row">
                <div className="lasso-kpi__value">{formatMetric("ansatte", employeesNow)}</div>
              </div>
              <div className="lasso-kpi__delta lasso-muted">Seneste måned, e-indkomst</div>
            </div>
          );
        }
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
            <div className="lasso-kpi__label">
              {plain ? METRIC_LABELS[m] : label(m)}
              {/* 09.4 (Paper live): kvalitetsflaget står efter etiketten. */}
              {financials.quality?.[m] && !plain ? <QualityFlag text={financials.quality[m]!} /> : null}
            </div>
            <div className="lasso-kpi__row">
              <div className="lasso-kpi__value">
                {num}
                {unit ? <Unit unit={unit} /> : plain && m === "ansatte" ? <span className="lasso-kpi__unit lasso-kpi__unit--note">årsrapport {last.year}</span> : null}
              </div>
              {series.length >= 3 && !plain ? <Sparkline values={series} tone="accent" bare /> : null}
            </div>
            <div className="lasso-kpi__delta">
              {/* 02c.4/02c.5 (Jakob 29.09.2026): kun pil + procent; ingen "fra 2024" og ingen anden procent (branche) efter. */}
              {before === value ? <span className="lasso-muted">Uændret</span> : <Delta from={before} to={value} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
