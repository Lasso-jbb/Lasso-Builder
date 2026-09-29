// G6: hvert element tegnes i sin egen bredde på 1200-gitteret (scratchpad/gridmodel.md, afsnit 6).
// Indholdsbredde 1152 ved 1200, 12 kolonner à 74 px, gutter 24.
import type { GalleryEntry } from "./types.js";

export const GRID = { quarter: 270, third: 368, half: 564, twoThirds: 760, threeQuarters: 858, full: 1152 } as const;

/** Standardbredde pr. elementtype (fed kolonne i gridmodellens elementtabel). */
const STD: Record<string, number> = {
  LassoCompanyHead: GRID.full,
  LassoKeyFigureCards: GRID.full,
  LassoKeyValueList: GRID.half,
  LassoContact: GRID.third,
  LassoContactPersons: GRID.third,
  LassoShortcuts: GRID.half,
  LassoTextSections: GRID.half,
  LassoSummary: GRID.full,
  LassoTimeline: GRID.half,
  LassoNews: GRID.half,
  LassoBarChart: GRID.half,
  LassoGroupedBarChart: GRID.half,
  LassoLineChart: GRID.half,
  LassoStackedBarChart: GRID.half,
  LassoWaterfallChart: GRID.half,
  LassoShareBars: GRID.half,
  LassoKeyFigureGauge: GRID.third,
  LassoMultiYearTable: GRID.half,
  LassoIncomeStatement: GRID.half,
  LassoBalanceSheet: GRID.half,
  LassoCashFlow: GRID.half,
  LassoFinancialStatements: GRID.full,
  LassoPersonList: GRID.third,
  LassoOwnerList: GRID.third,
  LassoBeneficialOwners: GRID.third,
  LassoOwnershipDiagram: GRID.twoThirds,
  LassoRelations: GRID.quarter,
  LassoRiskObservations: GRID.half,
  LassoScoreGauge: GRID.quarter,
  LassoProductionUnits: GRID.full,
  LassoProperties: GRID.half,
  LassoMap: GRID.half,
  LassoRegistration: GRID.full,
  LassoMergers: GRID.half,
  LassoAnnouncements: GRID.full,
  LassoPublications: GRID.half,
  LassoLivestock: GRID.half,
  LassoCompareTable: GRID.full,
  LassoRanking: GRID.half,
  LassoCompanyTable: GRID.full,
  LassoPersonTable: GRID.full,
  LassoPersonHead: GRID.full,
  LassoPersonStats: GRID.full,
  LassoPersonRoles: GRID.twoThirds,
  LassoPersonNetwork: GRID.twoThirds,
  LassoPersonRisk: GRID.half,
  LassoPersonFacts: GRID.third,
  LassoChangeFeed: GRID.full,
  LassoHeatmap: GRID.half,
  LassoFollowUps: GRID.full,
  LassoSavedPages: GRID.full,
};

const EXPLICIT: Record<string, number> = { quarter: GRID.quarter, third: GRID.third, half: GRID.half, "two-thirds": GRID.twoThirds, "three-quarters": GRID.threeQuarters, full: GRID.full };

type Comp = { type: string; width?: string; filterColumn?: boolean; layout?: string };

/**
 * Bredden, desktopbilledet tegnes i. Kun enkeltstående elementer (én elementtype, evt. flere eksempler
 * af samme type) får en smallere bredde; sammensatte visninger (mønstre, sider) står i fuld bredde.
 */
export function entryGridWidth(e: GalleryEntry): number | undefined {
  if (e.gridWidth) return e.gridWidth;
  if (e.only === "mobile" || (e.desktopWidth && e.desktopWidth !== 1200)) return undefined;
  const comps = ((e.spec as { components?: Comp[] } | undefined)?.components ?? []) as Comp[];
  if (!comps.length) return undefined;
  const types = new Set(comps.map((c) => c.type));
  if (types.size !== 1) return undefined;
  const c = comps[0]!;
  // Tidslinjen med filterkolonne og nyheder som kortgitter er 1/1-varianter (gridmodel afsnit 6).
  if (c.filterColumn || c.layout === "grid") return undefined;
  const w = c.width ? EXPLICIT[c.width] : STD[c.type];
  return w && w < GRID.full ? w : undefined;
}
