import type { Dataset, ViewSpec } from "@lasso/spec";

/**
 * window.__LASSO_BOOT__, som serveren indsætter i render-appens HTML. Uden boot kører appen som
 * MCP App i Claude/ChatGPT; med boot er det enten en delt side eller portalen.
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
}

export type Boot = WebBoot | PortalBoot;
