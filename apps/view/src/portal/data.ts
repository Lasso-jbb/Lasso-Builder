import type { Dataset, SavedPageVM, ViewSpec } from "@lasso/spec";
import type { HostCapabilities } from "@lasso/ui";

/**
 * AppShells mobilbrudpunkt: container-forespørgslen "lasso (max-width: 560px)" på portalens rod.
 * Under det skjules modulbjælkens handlinger (også Gem/Gemt), og topbjælken tager over.
 */
export const SHELL_MOBILE_MAX = 560;

/**
 * Hvad LassoView må på en virksomheds- eller personside (docs/portal.md). Præcis én synlig
 * Gem-knap: på desktop og tablet står Gem/Gemt i modulbjælken, så hovedets knap (host.savePage)
 * er slået fra; på mobil er modulbjælkens handlinger skjult, så hovedets knap er slået til.
 * openFocus: overblikkets "Se alle … i Historik" skifter fane som modulbjælken (open-focus).
 */
export function entityHost(shellWidth: number): HostCapabilities {
  return { savePage: shellWidth <= SHELL_MOBILE_MAX, save: true, refine: false, drillDown: true, refresh: true, export: true, back: false, openFocus: true };
}

/** Den virksomhed eller person, en side handler om (til fanens navn, Gem/Gemt og Del link). */
export interface Entity {
  id: string;
  kind: "company" | "person";
  name: string;
}

/**
 * Første komponent med `company` (virksomhedsside) eller `person` (personside), som LassoViews
 * saveTarget. Navnet fra datasættet, ellers specens titel. Serverens id er det kanoniske Lasso-ID,
 * også når fanen blev åbnet med et CVR-nummer eller et navn.
 */
export function entityOf(spec: ViewSpec, ds: Dataset | null | undefined): Entity | null {
  for (const c of spec.components) {
    if (spec.kind === "company" && "company" in c && typeof c.company === "string") {
      return { id: c.company, kind: "company", name: ds?.companies[c.company]?.name ?? spec.title };
    }
    if (spec.kind === "person" && "person" in c && typeof c.person === "string") {
      return { id: c.person, kind: "person", name: ds?.persons[c.person]?.name ?? spec.title };
    }
  }
  return null;
}

/** Gem-laget: læg et Lasso-ID til eller træk det fra datasættets savedIds (Gem/Gemt). */
export function withSaved(ds: Dataset, lassoId: string, saved: boolean): Dataset {
  const ids = new Set(ds.savedIds ?? []);
  if (saved) ids.add(lassoId);
  else ids.delete(lassoId);
  return { ...ds, savedIds: [...ids] };
}

/** Alle gemte sider i et svar fra GET /api/portal/pages, i serverens rækkefølge (nyeste først). */
export function savedPagesOf(ds: Dataset | null | undefined): SavedPageVM[] {
  const seen = new Set<string>();
  const out: SavedPageVM[] = [];
  for (const list of Object.values(ds?.savedPages ?? {})) {
    for (const p of list.pages) {
      if (seen.has(p.lassoId)) continue;
      seen.add(p.lassoId);
      out.push(p);
    }
  }
  return out;
}

/** Om siden er gemt: datasættets savedIds, når serveren har sat dem, ellers listen over gemte. */
export function isSaved(lassoId: string, ds: Dataset | null | undefined, saved: readonly SavedPageVM[] | null): boolean {
  if (ds?.savedIds) return ds.savedIds.includes(lassoId);
  return Boolean(saved?.some((p) => p.lassoId === lassoId));
}
