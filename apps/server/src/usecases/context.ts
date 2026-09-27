import type { Dataset, ViewSpec } from "@lasso/spec";
import type { CurrentUser } from "../auth/user.js";
import type { Config } from "../config.js";
import type { DataProvider } from "../data/provider.js";
import type { ResolveExtras } from "../data/resolve.js";
import { pagesExtras } from "../pages/resolveExtras.js";
import type { SavedPageStore } from "../pages/store.js";
import type { ViewStore } from "../views/store.js";

/**
 * Use-cases (docs/portal.md): den logik, MCP-tools og portal-API'et deler, så svaret i Claude og i
 * browseren kommer fra samme kode. Ingen Express- eller MCP-typer her: MCP-tools pakker svaret i
 * CallToolResult (mcp/server.ts), portalen i JSON (web/portalApi.ts).
 */
export interface UseCaseCtx {
  config: Config;
  provider: DataProvider;
  store: ViewStore;
  /** Gem-laget: brugerens gemte sider (docs/gem-lag.md). */
  pages: SavedPageStore;
  user: CurrentUser;
}

/**
 * En fejl, brugeren (eller modellen) kan handle på. Teksten er den samme i MCP og portalen;
 * status bruges kun af portalen: 400 ugyldigt input, 404 findes ikke, 409 optaget adresse.
 */
export interface UseCaseError {
  error: string;
  status: 400 | 404 | 409;
}

/** En visning: specen, datasættet til den og evt. en note (fx hvilket navn der blev valgt). */
export interface ViewData {
  spec: ViewSpec;
  dataset: Dataset;
  note?: string;
}

export const fail = (status: UseCaseError["status"], error: string): UseCaseError => ({ error, status });

/** Gem-laget i visningerne: brugerens gemte sider og Gem/Gemt-tilstanden (savedIds). */
export const extrasOf = (ctx: UseCaseCtx): ResolveExtras => pagesExtras(ctx.pages, ctx.user, ctx.config);
