import type { FinancialsVM } from "./models.js";
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
