import { amountScale, formatNumber, formatScaled, type AmountScale } from "@lasso/spec";

/**
 * Fælles SVG-hjælpere til graferne i katalog 13. Ren SVG, intet chartbibliotek
 * (opskriften §3). Alle grafer bruger samme højde, akse-bredde og skalering,
 * så de sidder ens ved siden af hinanden i grid'et.
 */

export const CHART_H = 240;
export const CHART_AXIS_W = 32;
export const CHART_TOP = 22;
export const CHART_BOTTOM = 26;

/** Pæne tal til y-aksen: 0, 5, 10, 15, 20. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

/** Lodret skala: værdi -> y-koordinat, givet et interval og en plot-højde. */
export function makeYScale(tMin: number, tMax: number, top: number, plotH: number): (v: number) => number {
  const span = tMax - tMin || 1;
  return (v: number) => top + ((tMax - v) / span) * plotH;
}

export interface ChartLabel {
  scale: AmountScale | null;
  label: (v: number) => string;
}

/** Fælles enhed og labelfunktion for et sæt værdier; "ansatte" har ingen enhed. */
export function labelFor(values: readonly number[], isCount: boolean): ChartLabel {
  if (isCount) return { scale: null, label: (v) => formatNumber(v) };
  const scale = amountScale(values);
  return { scale, label: (v) => formatScaled(v, scale) };
}

/** Formaterer år-intervallet til en undertitel, fx "2021–2025" eller "2025". */
export function yearRange(first: number, last: number): string {
  return first === last ? String(first) : `${first}–${last}`;
}

/** Klipper til de sidste n punkter (mobil: maks 5, katalog 26b). */
export function clampMobilePoints<T>(points: readonly T[], width: number, max = 5): readonly T[] {
  return width > 0 && width < 420 ? points.slice(-max) : points;
}
