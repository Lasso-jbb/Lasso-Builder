import { formatRoute, portalRoute, sameRoute, type PortalRoute } from "./routes.js";

/**
 * Portalens åbne faner (TabStrip): en fane pr. åben side. Virksomheder, personer og "Gemte sider"
 * findes højst én gang; søgninger kan der være flere af ("+" åbner en ny). Rene funktioner uden
 * DOM, så PortalApp kun holder tilstanden og spejler den i hash og sessionStorage.
 */
export interface PortalTab {
  id: string;
  route: PortalRoute;
  /** Navnet i fanen: "Søgning", søgeteksten, "Gemte sider" eller virksomhedens/personens navn. */
  label: string;
}

export interface TabsState {
  tabs: PortalTab[];
  active: string;
}

export const EMPTY_TABS: TabsState = { tabs: [], active: "" };

/** Navnet, før data er hentet. Virksomheder og personer får deres navn, når siden er hentet. */
export function defaultLabel(route: PortalRoute): string {
  switch (route.kind) {
    case "search":
      return route.q || "Søgning";
    case "saved":
      return "Gemte sider";
    default:
      return route.id;
  }
}

export function activeTab(s: TabsState): PortalTab | undefined {
  return s.tabs.find((t) => t.id === s.active) ?? s.tabs[0];
}

function matches(tab: PortalTab, route: PortalRoute): boolean {
  const r = tab.route;
  switch (route.kind) {
    case "search":
      return r.kind === "search" && r.q === route.q;
    case "saved":
      return r.kind === "saved";
    case "company":
      return r.kind === "company" && r.id === route.id;
    case "person":
      return r.kind === "person" && r.id === route.id;
  }
}

/** Den åbne fane for ruten (den aktive foretrækkes), ellers undefined. */
export function findTab(s: TabsState, route: PortalRoute): PortalTab | undefined {
  const active = s.tabs.find((t) => t.id === s.active);
  if (active && matches(active, route)) return active;
  return s.tabs.find((t) => matches(t, route));
}

export interface OpenOptions {
  /** Navn til en ny fane, fx fra drill-down eller skinnen. */
  label?: string;
  /** Behold fokus på en virksomhed, der allerede er åben (skinnen og drill-down skifter kun fane). */
  keepFocus?: boolean;
  /** Tilbage/frem eller en indtastet adresse: en ukendt søgning genbruger den aktive søgefane. */
  fromHistory?: boolean;
}

/** Skift til fanen for ruten, eller åbn en ny fane yderst til højre. */
export function openRoute(s: TabsState, route: PortalRoute, newId: () => string, o: OpenOptions = {}): TabsState {
  const hit = findTab(s, route);
  if (hit) {
    const next = o.keepFocus ? hit.route : route;
    const label = o.label && hit.label === defaultLabel(hit.route) ? o.label : hit.route.kind === "search" ? defaultLabel(next) : hit.label;
    if (s.active === hit.id && sameRoute(next, hit.route) && label === hit.label) return s;
    return { tabs: s.tabs.map((t) => (t.id === hit.id ? { ...t, route: next, label } : t)), active: hit.id };
  }
  const active = s.tabs.find((t) => t.id === s.active);
  if (route.kind === "search" && o.fromHistory && active?.route.kind === "search") return updateRoute(s, active.id, route);
  const tab: PortalTab = { id: newId(), route, label: o.label ?? defaultLabel(route) };
  return { tabs: [...s.tabs, tab], active: tab.id };
}

/** "+" i fanebjælken: en tom søgefane (en eksisterende tom søgning genbruges). */
export function newSearch(s: TabsState, newId: () => string): TabsState {
  return openRoute(s, { kind: "search", q: "" }, newId);
}

/** Ny rute i en bestemt fane (ny søgetekst, nyt fokus). Søgefanens navn følger søgeteksten. */
export function updateRoute(s: TabsState, id: string, route: PortalRoute): TabsState {
  let changed = false;
  const tabs = s.tabs.map((t) => {
    if (t.id !== id) return t;
    const label = route.kind === "search" ? defaultLabel(route) : t.label;
    if (sameRoute(t.route, route) && label === t.label) return t;
    changed = true;
    return { ...t, route, label };
  });
  if (!changed && s.active === id) return s;
  return { tabs, active: id };
}

export function activate(s: TabsState, id: string): TabsState {
  if (s.active === id || !s.tabs.some((t) => t.id === id)) return s;
  return { ...s, active: id };
}

export function setLabel(s: TabsState, id: string, label: string): TabsState {
  const tab = s.tabs.find((t) => t.id === id);
  if (!tab || !label || tab.label === label || tab.route.kind === "search" || tab.route.kind === "saved") return s;
  return { ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, label } : t)) };
}

/** Luk en fane. Den sidste åbne fane kan ikke lukkes; lukkes den aktive, bliver naboen til højre aktiv. */
export function closeTab(s: TabsState, id: string): TabsState {
  if (s.tabs.length <= 1) return s;
  const i = s.tabs.findIndex((t) => t.id === id);
  if (i < 0) return s;
  const tabs = s.tabs.filter((t) => t.id !== id);
  const active = s.active === id ? (tabs[i] ?? tabs[i - 1])!.id : s.active;
  return { tabs, active };
}

/** Sessionens faner som tekst til sessionStorage: kun id, hash og navn (data hentes igen). */
export function serializeTabs(s: TabsState): string {
  return JSON.stringify({ v: 1, active: s.active, tabs: s.tabs.map((t) => ({ id: t.id, hash: formatRoute(t.route), label: t.label })) });
}

export function parseTabs(text: string | null | undefined): TabsState | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as { v?: unknown; active?: unknown; tabs?: unknown };
    if (raw.v !== 1 || !Array.isArray(raw.tabs)) return null;
    const seen = new Set<string>();
    const tabs: PortalTab[] = [];
    for (const t of raw.tabs as { id?: unknown; hash?: unknown; label?: unknown }[]) {
      if (typeof t?.id !== "string" || typeof t.hash !== "string" || !t.id || seen.has(t.id)) continue;
      seen.add(t.id);
      const route = portalRoute(t.hash);
      tabs.push({ id: t.id, route, label: typeof t.label === "string" && t.label ? t.label : defaultLabel(route) });
    }
    if (tabs.length === 0) return null;
    const active = typeof raw.active === "string" && seen.has(raw.active) ? raw.active : tabs[0]!.id;
    return { tabs, active };
  } catch {
    return null;
  }
}

/**
 * Fanerne ved start: adressens hash vinder (et delt eller bogmærket link), ellers sessionens
 * faner, ellers én tom søgning.
 */
export function initialTabs(hash: string, stored: TabsState | null, newId: () => string): TabsState {
  const base = stored ?? EMPTY_TABS;
  if (hash.replace(/^#\/?/, "") !== "") return openRoute(base, portalRoute(hash), newId, { fromHistory: true });
  if (stored) return stored;
  return newSearch(base, newId);
}
