import type { Criterion, Dataset, ViewSpec } from "@lasso/spec";

export type Visibility = "private" | "org" | "link";

/**
 * Alt, UI'en kan bede værten om. UI-pakken kalder aldrig selv API'er; værten
 * (MCP-appen, den delte side eller senere portalen) udfører handlingerne.
 */
export type ViewAction =
  | { kind: "prompt"; prompt: string }
  | { kind: "open-company"; lassoId: string; name?: string }
  /** Katalog 16: åbn personsiden for en person (Lasso-ID "CVR-3-…"). */
  | { kind: "open-person"; lassoId: string; name?: string }
  /**
   * Åbn en anden fane (fokus) på samme virksomheds- eller personside, fx "historik" fra overblikkets
   * "Se alle 12 begivenheder i Historik" (specens `more`). Kun når værten har `openFocus`.
   */
  | { kind: "open-focus"; focus: string }
  | { kind: "set-criteria"; criteria: Criterion[] }
  | { kind: "refresh" }
  | { kind: "save"; name: string; slug?: string; visibility: Visibility }
  /** Gem-laget (docs/gem-lag.md): gem den viste virksomhed eller person på brugerens liste. */
  | { kind: "save-page"; lassoId: string; pageKind: "company" | "person"; name: string; focus?: string }
  /** Gem-laget: fjern en side fra brugerens liste (fra hovedet eller fra listen over gemte sider). */
  | { kind: "remove-saved-page"; lassoId: string }
  | { kind: "copy-link"; url: string }
  | { kind: "open-link"; url: string }
  | { kind: "export"; filename: string; csv: string }
  /** "Gem som PDF" (hovedet): værten henter en rigtig PDF-fil fra serveren og gemmer den. */
  | { kind: "pdf" }
  | { kind: "fullscreen" }
  | { kind: "back" };

/**
 * En smagsprøves "Se alle … i <fane>" (specens `more`, når værten har `openFocus`): fanens navn,
 * fx "Historik", og handlingen, der åbner den. Uden den folder "Se alle" ud på stedet.
 */
export interface MoreInTab {
  tab: string;
  open: () => void;
}

export type ActionResult ={ ok: true; url?: string; message?: string } | { ok: false; error: string };

/** Hvad værten kan. Knapper uden kapabilitet skjules. */
export interface HostCapabilities {
  prompt?: boolean;
  save?: boolean;
  /** Gem-laget: værten kan gemme/fjerne sider for en kendt bruger (save_page/remove_saved_page). */
  savePage?: boolean;
  refine?: boolean;
  drillDown?: boolean;
  fullscreen?: boolean;
  back?: boolean;
  refresh?: boolean;
  export?: boolean;
  /** "Gem som PDF" øverst i hovedet: værten kan hente sidens PDF fra serveren (pdfLink, boot.pdfUrl, portal-API). */
  pdf?: boolean;
  /**
   * Værten kan skifte fane på siden (open-focus): overblikkets smagsprøver ("Se alle … i Historik")
   * åbner fanen. Uden den folder "Se alle" ud på stedet.
   */
  openFocus?: boolean;
}

export interface LassoViewProps {
  spec: ViewSpec;
  dataset: Dataset | null;
  /** Adresse, hvis visningen er gemt. */
  url?: string;
  host: HostCapabilities;
  onAction: (action: ViewAction) => Promise<ActionResult | void> | void;
  theme?: "light" | "dark";
  /** Viser skeletter i stedet for indhold. */
  loading?: boolean;
  /** Basis-URL til "gem"-dialogens adressevisning, fx "lassox.com/v/revisorhuset/". */
  savePrefix?: string;
  /**
   * Print-tilstand (serverens PDF af sider, der ikke er virksomhedsrapporten): ingen knapper,
   * handlingsbjælke eller filterredigering, "Se alle" foldet ud og faner som overskrifter.
   */
  print?: boolean;
}
