import type { ComponentType } from "./spec.js";

/**
 * Formater: de former, et modul kan tegnes i, fra den største til den mindste. Modulet vælger formen ud fra
 * sin egen målte bredde (ikke skærmens), og altid den første godkendte form, der er plads til. Fordi listen
 * er ordnet fra stor til lille, og hver form har en mindste bredde, kan modulet kun gå én vej, når det
 * bliver smallere: aldrig fra 2×2 tilbage til fire på række.
 *
 * Designguiden viser alle formerne for et modul fra største bredde og hele vejen ned, og her godkendes de.
 * Kun godkendte former bruges; en ikke-godkendt form springes over, så den næste mindre overtager.
 */
export interface LayoutFormat {
  id: string;
  /** Kort navn i designguiden. */
  name: string;
  /** Hvad formen er, i én sætning. */
  description: string;
  /** Mindste modulbredde i px, hvor formen er lovlig, for `count` elementer (fx antal nøgletal). 0 = altid. */
  minPx: (count: number) => number;
}

/** Nøgletalskort: mellemrum mellem selvstændige kort. */
export const KPI_CARD_GAP = 12;
export const KPI_GRID_GAP = 8;

/** Nøgletalskort (09): fra én række med skillelinjer til ét tal pr. række. */
export const KEY_FIGURE_FORMATS: readonly LayoutFormat[] = [
  {
    id: "linjer",
    name: "Én række med skillelinjer",
    description: "Alle tal på én række, adskilt af lodrette linjer; tal 28 px. Mindst 200 px pr. tal.",
    minPx: (n) => 200 * n,
  },
  {
    id: "kort",
    name: "Én række kort",
    description: "Alle tal på én række som selvstændige kort med 12 px mellemrum; tal 24 px. Mindst 140 px pr. kort.",
    minPx: (n) => 140 * n + KPI_CARD_GAP * (n - 1),
  },
  {
    id: "2x2",
    name: "To kort pr. række",
    description: "Titlen 'Nøgletal ÅÅÅÅ' over to kort pr. række (2×2 ved fire tal); tal 20–24 px. Mindst 136 px pr. kort.",
    minPx: () => 136 * 2 + KPI_GRID_GAP,
  },
  {
    id: "stablet",
    name: "Ét tal pr. række",
    description: "Tallene stablet under hinanden, ét pr. række. Bruges i smalle kolonner (¼ på desktop).",
    minPx: () => 0,
  },
];

/** Formerne pr. modul. Moduler uden liste har én form og følger kun gitteret. */
export const LAYOUT_FORMATS: Partial<Record<ComponentType, readonly LayoutFormat[]>> = {
  LassoKeyFigureCards: KEY_FIGURE_FORMATS,
};

/**
 * De godkendte former i koden (det, portalen, chatten og delte links bruger). Designguiden gemmer nye
 * godkendelser på serveren; de skrives herind, så de følger med næste udrulning.
 */
export const APPROVED_FORMATS: Partial<Record<ComponentType, readonly string[]>> = {
  LassoKeyFigureCards: ["linjer", "kort", "2x2", "stablet"],
};

/** De godkendte former for typen i listens rækkefølge; mindst én (den mindste), så modulet altid kan tegnes. */
export function approvedFormats(type: ComponentType, approved?: readonly string[]): readonly LayoutFormat[] {
  const all = LAYOUT_FORMATS[type] ?? [];
  const ok = approved ?? APPROVED_FORMATS[type] ?? all.map((f) => f.id);
  const list = all.filter((f) => ok.includes(f.id));
  return list.length ? list : all.slice(-1);
}

/** Formen ved bredden `width`: den første godkendte, der er plads til, ellers den mindste godkendte. */
export function pickFormat(type: ComponentType, width: number, count: number, approved?: readonly string[]): LayoutFormat | undefined {
  const list = approvedFormats(type, approved);
  return list.find((f) => width >= f.minPx(count)) ?? list.at(-1);
}

export interface FormatRange {
  format: LayoutFormat;
  /** Bredderne (px), formen bruges i: fra `from` ned til `to` (begge med). */
  from: number;
  to: number;
}

/** Hvor hver godkendt form bruges mellem `max` og `min` px (største først). Former uden plads udelades. */
export function formatRanges(type: ComponentType, count: number, max: number, min: number, approved?: readonly string[]): FormatRange[] {
  const out: FormatRange[] = [];
  for (let w = max; w >= min; w--) {
    const f = pickFormat(type, w, count, approved);
    if (!f) continue;
    const last = out.at(-1);
    if (last && last.format.id === f.id) last.to = w;
    else out.push({ format: f, from: w, to: w });
  }
  return out;
}
