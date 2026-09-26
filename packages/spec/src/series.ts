import type { FinancialsVM, FinancialYear } from "./models.js";
import { METRIC_FIELD, type Metric } from "./spec.js";

export interface SeriesPoint {
  year: number;
  value: number;
}

/**
 * Tallene til en regnskabsgraf. Mindre selskaber (regnskabsklasse B) holder ofte op
 * med at oplyse omsætning; når omsætningen ikke når frem til seneste regnskab, vises
 * bruttofortjenesten i stedet, så grafen ikke ender år tilbage (Lasso X: omsætning
 * kun 2016–2019, bruttofortjeneste til 2025).
 */
export function chartSeries(f: FinancialsVM, wanted: Metric, years: number): { metric: Metric; points: SeriesPoint[] } {
  const series = (m: Metric) =>
    f.years.slice(-years).flatMap((y) => {
      const v = y[METRIC_FIELD[m]];
      return typeof v === "number" ? [{ year: y.year, value: v }] : [];
    });
  const points = series(wanted);
  const latest = f.years.at(-1)?.year;
  if (wanted === "omsaetning" && points.at(-1)?.year !== latest) {
    const gross = series("bruttofortjeneste");
    if (gross.length && (points.length === 0 || gross.at(-1)!.year === latest)) return { metric: "bruttofortjeneste", points: gross };
  }
  return { metric: wanted, points };
}

/** Seneste år først: det nyeste regnskab afgør, hvad der er oplyst "nu". */
const RECENT_YEARS = 3;

function has(y: FinancialYear | undefined, m: Metric): boolean {
  return !!y && typeof y[METRIC_FIELD[m]] === "number";
}

/**
 * Hovednøgletallet for en virksomhed: omsætning, når den er oplyst i det seneste regnskab
 * (eller i mindst 2 af de seneste 3), ellers bruttofortjeneste. Afgøres af de SENESTE år,
 * ikke af, hvor mange år i alt der har et tal: Lasso X oplyste omsætning 2012–2019, men
 * ikke siden, og så skal grafen og kortene vise bruttofortjenesten frem til i dag.
 */
export function mainMetric(years: readonly FinancialYear[], wanted?: Metric): Metric {
  if (wanted) return effectiveMetric(years, wanted);
  const recent = years.slice(-RECENT_YEARS);
  const revenueRecent = recent.filter((y) => has(y, "omsaetning")).length;
  if (has(years.at(-1), "omsaetning") || revenueRecent >= 2) return "omsaetning";
  if (years.some((y) => has(y, "bruttofortjeneste"))) return "bruttofortjeneste";
  return years.some((y) => has(y, "omsaetning")) ? "omsaetning" : "bruttofortjeneste";
}

/**
 * Det nøgletal, der faktisk kan vises for de seneste år. Omsætning uden tal i seneste
 * regnskab falder tilbage til bruttofortjeneste, når den findes der (samme regel som
 * chartSeries); andre nøgletal vises som de er.
 */
export function effectiveMetric(years: readonly FinancialYear[], m: Metric): Metric {
  const last = years.at(-1);
  if (m === "omsaetning" && !has(last, "omsaetning") && has(last, "bruttofortjeneste")) return "bruttofortjeneste";
  return m;
}
