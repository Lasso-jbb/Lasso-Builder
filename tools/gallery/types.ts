import type { ReactNode } from "react";
import type { Dataset } from "@lasso/spec";

/**
 * Ét element i galleriet: tegnes fra koden og mærkes med Paper-nummeret, så det kan
 * sammenlignes 1:1 med designkataloget. Enten `spec` (en visning, der løses med demodata
 * som i MCP'en) eller `render` (en ren UI-komponent med eksempelprops).
 */
export interface GalleryEntry {
  /** Paper-nummer, fx "08.2" eller "26a.4–26a.7". */
  nr: string;
  /** Elementets navn som i Paper. */
  title: string;
  /** Paper node-id, når det kendes (fx "9R5-0"). */
  node?: string;
  /** Visning (samme format som render_view). Løses med DemoProvider. */
  spec?: Record<string, unknown>;
  /** Ret demodatasættet før tegning, fx for at vise en særlig tilstand. */
  mutate?: (ds: Dataset) => void;
  /** Ren UI-komponent. Tegnes i en .lasso-root med 24 px luft. */
  render?: () => ReactNode;
  /** Kun én bredde (fx et mobil-element eller en side på 1440). */
  only?: "desktop" | "mobile";
  /** Bredde på desktop-billedet (standard 1200). */
  desktopWidth?: number;
  /**
   * Mobilelementerne i Paper 26b–26h er tegnet som ét kort (1 px kant, radius 12, padding 16).
   * Rammen er præsentation (som Papers artboard), ikke en del af komponenten.
   */
  card?: boolean;
  /** Kort note til reviewet, fx hvad der ikke kan vises statisk. */
  note?: string;
  /**
   * G6: elementets egen bredde på 1200-gitteret (indholdsbredde i px: 270, 368, 564, 760, 858 eller 1152).
   * Desktopbilledet tegnes i en 1200-visning (samme containerbredde som på siden), men elementet står i
   * denne bredde, og billedet beskæres til den. Udelades den på en spec med én elementtype, bruges
   * typens standardbredde fra gridmodellen (grid.ts); ellers fuld bredde.
   */
  gridWidth?: number;
  /** Ekstra desktopbredder (fx tablet 834 og 1024), hver på sin egen side i PDF'en. */
  extraWidths?: number[];
  /** Placering i rækkefølgen, når elementet står ved et andet afsnit end sit nummer (fx mobil-only ved 06/07). */
  sortAs?: string;
}
