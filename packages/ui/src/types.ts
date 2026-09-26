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
  | { kind: "copy-link"; url: string }
  | { kind: "open-link"; url: string }
  | { kind: "export"; filename: string; csv: string }
  | { kind: "fullscreen" }
  | { kind: "back" };

export type ActionResult = { ok: true; url?: string; message?: string } | { ok: false; error: string };

/** Hvad værten kan. Knapper uden kapabilitet skjules. */
export interface HostCapabilities {
  prompt?: boolean;
  save?: boolean;
  refine?: boolean;
  drillDown?: boolean;
  fullscreen?: boolean;
  back?: boolean;
  refresh?: boolean;
  export?: boolean;
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
}
