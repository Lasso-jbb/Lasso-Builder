/**
 * Komponentregisteret (plan A5 + A11, docs/plan-mcp.md): ét sted, der siger hvad hver komponent er
 * til, hvad den kræver, hvordan den nås, og hvilken bredde den trives i. Registeret er kilden til
 * docs/komponenter.md (A9), dækningstesten (A8) og værktøjsteksterne (D5). Standard-, min- og
 * maksbredde bor fortsat i GRID_RULES (catalog.ts) — registeret gentager dem ikke, det lægger
 * bredde-profilen og indholdsmålene oven på.
 */
import type { Dataset } from "./models.js";
import type { Width } from "./spec.js";
import { WIDTHS } from "./spec.js";

/** Nøgler i Dataset, som serveren fylder for komponenten (resolve.ts). */
export type DatasetKey = Exclude<keyof Dataset, "source" | "generatedAt">;

/** Hvordan komponenten nås. */
export type Route = "ask" | "focus" | "person" | "render_view" | "search_companies" | "search_persons" | "compare_companies" | "saved";

/**
 * Hvornår komponenten har indhold live (Lasso API):
 *  - altid: findes for alle CVR-enheder (hoved, stamdata)
 *  - naar-data: findes når enheden har kategorien (regnskab, ejere, nyheder …); ellers tom tilstand med årsag
 *  - abonnement: kræver kundens abonnement/credits (Creditsafe, Ø6) — uden abonnement vises låst tilstand, intet opslag
 *  - modul: kræver et Lasso-modul i abonnementet (Ejendomme/CHR)
 *  - ikke-endnu: datakilden er ikke koblet på live endnu (fx branchetal for nogle brancher)
 */
export type LiveAvailability = "altid" | "naar-data" | "abonnement" | "modul" | "ikke-endnu";

/**
 * Bredde-profil (Ø13):
 *  - bred: læses kun i ≥ ⅔ — tidsakser, flere kolonner pr. række, lange navne i flere rækker
 *  - smal: læses bedst i ≤ ½ — nøgle/værdi, kontakt, korte lister; strækkes aldrig til fuld ved siden af andre
 *  - fleksibel: følger GRID_RULES
 */
export type WidthProfile = "bred" | "smal" | "fleksibel";

/** Indholdsmål, der kan hæve mindstebredden ud over typens min i GRID_RULES. */
export interface ContentWidthDrivers {
  /** Rækker pr. post (fx 3 selskabslinjer pr. person i netværket). */
  rowsPerItem?: number;
  /** Længste navn/etiket i tegn. */
  longestLabel?: number;
  /** Elementet har en tidsakse (år) der skal have plads til etiketter. */
  timeAxis?: boolean;
  /** Antal serier/kolonner side om side (grupperede søjler, sammenligningstabel). */
  series?: number;
}

export interface Register {
  /** Én sætning: hvad komponenten viser. */
  formaal: string;
  /** Spørgsmålstyper og emner, den er det rigtige svar på ("hvem ejer X", emne 'ejere'). */
  bedstTil: string[];
  /** Hvornår en anden komponent er bedre (med navnet på den). */
  undgaaNaar: string[];
  /** Dataset-nøgler serveren henter for den. */
  kraeverData: DatasetKey[];
  live: LiveAvailability;
  /** Årsag/tekst i tom eller låst tilstand, hvis live ≠ altid. */
  liveNote?: string;
  /** Veje ind: hvor komponenten faktisk udsendes eller kan vælges. */
  veje: Route[];
  bredde: { profil: WidthProfile; drivere?: ContentWidthDrivers };
}

/* ---------- A11: indholdsstyret mindstebredde ---------- */

const step = (w: Width, n: number): Width => WIDTHS[Math.max(0, Math.min(WIDTHS.length - 1, WIDTHS.indexOf(w) + n))]!;
const wider = (a: Width, b: Width): Width => (WIDTHS.indexOf(a) >= WIDTHS.indexOf(b) ? a : b);

/** Tærskler (Ø13). Målt mod billederne 29.09: 3 rækker pr. person + tidsakse i ½ gav afkortning og overlap. */
export const WIDTH_THRESHOLDS = {
  /** Rækker pr. post, hvorfra et element regnes for "tæt" og får ét trin mere. */
  rowsPerItem: 3,
  /** Etiketlængde (tegn), hvorfra et element får ét trin mere. */
  longestLabel: 24,
  /** Serier/kolonner side om side, hvorfra et element får ét trin mere. */
  series: 3,
} as const;

/**
 * Mindstebredden for et konkret element: typens min (GRID_RULES) hævet efter profil og indhold.
 *  - bred: aldrig under ⅔; tidsakse eller tæt indhold giver ét trin mere (op til fuld).
 *  - smal: typens min (indholdet er kort); ingen hævning.
 *  - fleksibel: typens min, hævet ét trin ved tæt indhold eller tidsakse.
 * Pakkeren (B8) må aldrig lægge elementet smallere end dette; hellere udelade (højdebudget) eller give eget bånd.
 */
export function contentMinWidth(profile: WidthProfile, typeMin: Width, d: ContentWidthDrivers = {}): Width {
  const dense =
    (d.rowsPerItem ?? 0) >= WIDTH_THRESHOLDS.rowsPerItem ||
    (d.longestLabel ?? 0) >= WIDTH_THRESHOLDS.longestLabel ||
    (d.series ?? 0) >= WIDTH_THRESHOLDS.series;
  if (profile === "smal") return typeMin;
  if (profile === "bred") {
    const base = wider(typeMin, "two-thirds");
    return dense || d.timeAxis ? step(base, 1) : base;
  }
  return dense || d.timeAxis ? step(typeMin, 1) : typeMin;
}

/**
 * Maksbredden for et element, der deler bånd med andre: smal-profilen må højst stå i ½ ved siden af
 * andre (alene i båndet må den fylde typens max). Øvrige følger typens max.
 */
export function sharedMaxWidth(profile: WidthProfile, typeMax: Width, aloneInBand: boolean): Width {
  if (profile === "smal" && !aloneInBand) return WIDTHS.indexOf(typeMax) > WIDTHS.indexOf("half") ? "half" : typeMax;
  return typeMax;
}
