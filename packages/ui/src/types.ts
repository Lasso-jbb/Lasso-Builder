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
  /** MCP-appen (Jakob 30.09): hovedet har kun "Vis i fuld skærm" og "Gem som PDF"; ingen Gem- og Eksportér-ikoner. */
  minimalHead?: boolean;
  /** Visningen står allerede i fuld skærm (MCP displayMode "fullscreen"): "Vis i fuld skærm" skjules. */
  fullscreenActive?: boolean;
  /** Katalog 08/16: værten kan starte overvågning og åbne overvågningsindstillinger ("Overvåg"/"Overvåger"). */
  monitor?: boolean;
  /** Katalog 08/24: værten kan skifte til en sektion/et fokus ("Se risiko", "Se historik", genveje). */
  openSection?: boolean;
  /** Katalog 08.5: værten kan verificere kontaktoplysninger i realtid (live number). */
  verifyContact?: boolean;
  /**
   * Modul 5 (Jakob 01.10): de Lasso-moduler (genvejenes værktøjer), brugeren har adgang til. Genvejene viser kun
   * dem. Udeladt: adgangen kendes ikke, og alle genveje, værten kan åbne, vises.
   */
  modules?: readonly string[];
  /**
   * Værtens ramme om visningen i px (topbjælke, faner, spørgefelt …): ejerdiagrammets lærred tilpasses vinduets højde minus
   * den, så hele grafen ses i ét (portalen: 400). Udeladt (/mcp i Claude.ai's iframe, /v): lærredet vokser i 100 % op til
   * 1200 px og tilpasses kun bredden.
   */
  viewportChrome?: number;
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
  /**
   * Katalog 08.2: sektionsfaner (niveau 1, 48 px) lige under virksomheds-/personhovedet, der skifter
   * sidens indhold. Uden prop'en tegnes ingen faner (portalen har dem i modulbjælken).
   */
  /**
   * Katalog 24/25/26g: visningen står i portalens sideskabelon (AppShell med skinne, fanebjælke og
   * modulbjælke). Så tegnes hverken rammens egen header (logo, "Virksomhedsprofil", datastempel) eller
   * handlingslinjen nederst på virksomheds- og personsider; sidens hoved bærer Gem, Eksportér og "…".
   */
  /** @deprecated Brug `frameless` (samme betydning). */
  embedded?: boolean;
  headTabs?: { items: readonly { id: string; label: string; disabled?: boolean; disabledReason?: string }[]; value: string; onChange: (id: string) => void; ariaLabel?: string; maxVisible?: number; moreLabel?: string };
  /**
   * Katalog 06.1/24/25: visningen står i portalens ramme (AppShell med fanebjælke og modulbjælke).
   * Så udelades visningens egen ramme: headeren (logo, "Virksomhedsprofil", "Data hentet …", Gem)
   * og foden (Eksportér, Del link, "Gem visning"). Kroppen går direkte under modulbjælken, og
   * værten står selv for sidens handlinger (modulbjælkens Eksportér, Gem, Overvåg).
   */
  frameless?: boolean;
  /**
   * Mobil (< 560, 26g.1/26g.2): hver sektion står som kort (1 px kant, radius 12, 16 px luft) i stedet
   * for at være adskilt af dividere, og sektionsfanerne under hovedet går i fuld bredde. Kun med frameless.
   */
  sectionCards?: boolean;
  /**
   * Visningen er en sammensat side i portalen (24, 25, 26.2/26.3, 26f.1, 26g): elementerne bruger
   * sidens rolige former: nøgletal med lodrette linjer uden ramme og sparkline (24.5), personrisiko som
   * tjeklinjer (25.6) og personhovedets observationslinje med "Se risiko" (25.3). Udeladt: elementernes
   * egne former (09.1, 16.1, 16.4).
   */
  page?: boolean;
}
