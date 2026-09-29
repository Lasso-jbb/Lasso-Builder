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
  | { kind: "fullscreen" }
  /**
   * Katalog 08/16: "Overvåg" i hovedet. `monitoring` er tilstanden FØR klikket: falsk = start
   * overvågning, sand = åbn overvågningsindstillingerne (aldrig slå fra med ét klik).
   */
  | { kind: "monitor"; lassoId: string; pageKind: "company" | "person"; name: string; monitoring: boolean }
  /** Katalog 08/24: åbn en sektion/et fokus på siden, fx "Se risiko", "Se historik" eller en genvej (08.4). */
  | { kind: "open-section"; lassoId: string; pageKind: "company" | "person"; section: string; name?: string }
  /** Katalog 08.5: bed værten verificere virksomhedens telefonnumre/e-mail nu (live number). Værten opdaterer datasættet. */
  | { kind: "verify-contact"; lassoId: string }
  | { kind: "back" };

export type ActionResult = { ok: true; url?: string; message?: string } | { ok: false; error: string };

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
  /** Katalog 08/16: værten kan starte overvågning og åbne overvågningsindstillinger ("Overvåg"/"Overvåger"). */
  monitor?: boolean;
  /** Katalog 08/24: værten kan skifte til en sektion/et fokus ("Se risiko", "Se historik", genveje). */
  openSection?: boolean;
  /** Katalog 08.5: værten kan verificere kontaktoplysninger i realtid (live number). */
  verifyContact?: boolean;
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
   * Katalog 08.2: sektionsfaner (niveau 1, 48 px) lige under virksomheds-/personhovedet, der skifter
   * sidens indhold. Uden prop'en tegnes ingen faner (portalen har dem i modulbjælken).
   */
  headTabs?: { items: readonly { id: string; label: string; disabled?: boolean; disabledReason?: string }[]; value: string; onChange: (id: string) => void; ariaLabel?: string };
}
