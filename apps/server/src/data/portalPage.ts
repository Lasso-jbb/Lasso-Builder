import type { Dataset, PortalPage, ViewSpec } from "@lasso/spec";
import type { DataProvider } from "./provider.js";
import { resolveSpec, type ResolveExtras } from "./resolve.js";

/**
 * Lasso v1-siderne (portalPages i @lasso/spec/showcase.ts) som en visning: samme spec og samme datahentning, hvad enten de
 * står i udstillingen (web/showcase.ts, /komponenter og designguiden) eller i portalens Overblik (usecases/views.ts, PORTAL_OVERVIEW=v1).
 */
export function portalPageSpec(page: PortalPage, title: string): ViewSpec {
  return { version: 2, kind: "company", title, layout: page.layout, criteria: [], components: page.components } as unknown as ViewSpec;
}

/** Siden med data fra udbyderen (extras: Gem/Gemt i portalen; udstillingen har ingen). */
export async function resolvePortalPage(provider: DataProvider, page: PortalPage, title: string, extras: ResolveExtras = {}): Promise<{ spec: ViewSpec; dataset: Dataset }> {
  const spec = portalPageSpec(page, title);
  return { spec, dataset: await resolveSpec(spec, provider, extras) };
}
