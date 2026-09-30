/**
 * Ø13/B8/B9: layout-reglerne på en komponeret side, delt mellem grid.test.ts, eval-løberen og layout.test.ts.
 * Et element i et delt bånd må (a) ikke stå under sin indholdsstyrede mindstebredde (contentWidthOf),
 * (b) hvis det er smal ikke stå strakt til mere end ½ ved siden af andre, (c) ikke stå over sin max.
 * Alene i et bånd (uden kolonne) må en smal komponent fylde bredden.
 */
import { WIDTHS, contentWidthOf, gridRuleOf, widthProfileOf, type Dataset, type ViewComponent, type ViewSpec } from "@lasso/spec";

/** Sidens delte bånd som stakke ud fra kolonne og width (som LassoView.columnBands). */
export function bandsOf(spec: ViewSpec): ViewComponent[][][] {
  const bands: ViewComponent[][][] = [];
  let last = 0;
  for (const c of spec.components) {
    if (!c.column) {
      last = 0;
      continue;
    }
    if (last === 0 || c.column < last) bands.push([]);
    const band = bands.at(-1)!;
    while (band.length < c.column) band.push([]);
    band[c.column - 1]!.push(c);
    last = c.column;
  }
  return bands;
}

export interface LayoutViolation {
  /** Regel: "under-min" (bred/andet under mindstebredde), "smal-fuld" (smal for bred ved siden af andre), "over-max". */
  rule: "under-min" | "smal-fuld" | "over-max";
  type: string;
  width: string;
  /** Mindstebredden (under-min) eller grænsen (smal-fuld, over-max). */
  limit: string;
}

export function layoutViolations(spec: ViewSpec, ds: Dataset): LayoutViolation[] {
  const idx = (w: string) => WIDTHS.indexOf(w as never);
  const out: LayoutViolation[] = [];
  for (const band of bandsOf(spec)) {
    if (band.length < 2) continue;
    for (const st of band)
      for (const c of st) {
        const w = c.width!;
        const min = contentWidthOf(c, ds);
        const max = gridRuleOf(c).max;
        if (idx(w) < idx(min)) out.push({ rule: "under-min", type: c.type, width: w, limit: min });
        if (idx(w) > idx(max)) out.push({ rule: "over-max", type: c.type, width: w, limit: max });
        if (widthProfileOf(c).profil === "smal" && idx(w) > idx("half")) out.push({ rule: "smal-fuld", type: c.type, width: w, limit: "half" });
      }
  }
  return out;
}

export const describeViolation = (v: LayoutViolation): string => `${v.type} i ${v.width} (${v.rule}, grænse ${v.limit})`;
