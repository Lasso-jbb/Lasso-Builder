import type { Dataset, PortalPage, ShowcaseAlternatives, ShowcaseTab, ViewSpec } from "@lasso/spec";

/**
 * window.__LASSO_BOOT__, som serveren indsætter i render-appens HTML. Uden boot kører appen som
 * MCP App i Claude/ChatGPT; med boot er det enten en delt side eller portalen.
 * Print-siden, serverens Chromium laver "Gem som PDF" fra, har også boot (mode "print").
 */

/** Delt side (/v/:org/:slug, /e/, /k/): specen er gemt, data er hentet friskt af serveren. */
export interface WebBoot {
  mode: "web";
  spec?: ViewSpec;
  dataset?: Dataset;
  url?: string;
  name?: string | null;
  error?: string;
  /**
   * Signerede /e/-links pr. Lasso-ID for de virksomheder og personer, siden viser (ledelse, ejere,
   * revisor, navne i nyheder …). Med links kan navnene på den delte side åbnes (drill-down).
   */
  links?: Record<string, string>;
  /**
   * Signerede /e/-links pr. fokus til sidens egen virksomhed eller person, for de faner, sidens
   * smagsprøver peger på (specens `more`, fx "historik"). Med dem åbner "Se alle … i Historik" fanen.
   */
  focusLinks?: Record<string, string>;
  /** "Gem som PDF": false, når serveren ikke har Chromium (knappen skjules). */
  pdf?: boolean;
  /** Det signerede .pdf-link til netop denne side (samme query som siden). */
  pdfUrl?: string;
  /**
   * /d/<id> ("Del visning" fra MCP-appen, Jakob 03.10): kun visningen. Ingen handlingsbjælke (Opdatér, Eksportér, PDF);
   * navne kan stadig åbnes, når serveren har lagt links i boot'en.
   */
  minimal?: boolean;
}

/** Brugeren i portalen, samme form som serverens CurrentUser. */
export interface PortalUser {
  id: string;
  name: string;
  org: string;
  isDemo: boolean;
}

/** Portalen på /portal (docs/portal.md). Uden user og med loginRequired vises login-siden. */
export interface PortalBoot {
  mode: "portal";
  user: PortalUser | null;
  loginRequired: boolean;
  baseUrl: string;
  /** "Gem som PDF": false, når serveren ikke har Chromium (knappen skjules). */
  pdf?: boolean;
}

/**
 * Print-siden (/print/:token), som kun serverens egen Chromium åbner, når den laver en PDF:
 * `report` = virksomhedsrapporten (ReportA4), `page` = visningen i print-tilstand.
 */
export interface PrintBoot {
  mode: "print";
  kind: "report" | "page";
  spec: ViewSpec;
  dataset: Dataset;
  name: string;
  generatedAt: string;
}

/** Komponentudstillingen (/komponenter): alle komponenter på én virksomhed og én person, to faner. */
export interface ShowcaseBoot {
  mode: "showcase";
  generatedAt: string;
  /** Kort commit-hash for den udrullede kode ("lokal" uden Railway). */
  version?: string;
  tabs: (ShowcaseTab & { dataset: Dataset })[];
  alt: ShowcaseAlternatives & { dataset: Dataset };
  portal: { company: string; name: string; pages: (PortalPage & { dataset: Dataset })[] };
}

/** Lassos egen chat på /chat (docs/chat.md): Claude med samme værktøjer som MCP, visningerne tegnes her. */
export interface ChatBoot {
  mode: "chat";
  /** Kræver /mcp en nøgle, skal brugeren logge ind (også når portalen er åben: hvert svar koster). */
  loginRequired: boolean;
  /** false: serveren har ingen ANTHROPIC_API_KEY. */
  enabled: boolean;
  baseUrl: string;
  pdf?: boolean;
}

/** Den nye portal på /portal (prototypen "lasso-portal - new.html"): uden login, med chatten i spørgefeltet. */
export interface Portal2Boot {
  mode: "portal2";
  /** Brugeren bag sessionen, eller demobrugeren, når portalen er åben (PORTAL_PUBLIC). null: login kræves. */
  user: PortalUser | null;
  baseUrl: string;
  pdf?: boolean;
  /** false: serveren har ingen ANTHROPIC_API_KEY, og spørgefeltet er slået fra. */
  chat: boolean;
}

export type Boot = WebBoot | PortalBoot | PrintBoot | ShowcaseBoot | ChatBoot | Portal2Boot;
