import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppShell,
  Dialog,
  Menu,
  ShellIcon,
  ToastProvider,
  useToast,
  useWidth,
  type ActionResult,
  type AppShellMobile,
  type RailGroup,
  type StripTab,
  type ViewAction,
} from "@lasso/ui";
import { FOCUS_LABELS, isPersonFocus, PERSON_FOCUS_LABELS, type SavedPageVM, type ViewSpec } from "@lasso/spec";
import type { PortalUser } from "../boot.js";
import { errorText, isUnauthorized, LOGGED_OUT, PortalApiError, type PortalApi, type ViewResult } from "./api.js";
import { entityOf, isSaved, savedPagesOf, withSaved, type Entity } from "./data.js";
import { EntityPage, FOCUS_MODULES, PERSON_MODULES, SavedPage, SearchPage, type TabData } from "./pages.js";
import { dataKey, formatRoute, isFocus, portalRoute, sameRoute, type PortalRoute } from "./routes.js";
import {
  activate,
  activeTab,
  closeTab,
  EMPTY_TABS,
  initialTabs,
  newSearch,
  openRoute,
  parseTabs,
  serializeTabs,
  setLabel,
  updateRoute,
  type PortalTab,
  type TabsState,
} from "./tabs.js";

const STORAGE_KEY = "lasso.portal.tabs";
const RAIL_LIMIT = 8;

let seq = 0;
const newId = () => `t${Date.now().toString(36)}${(++seq).toString(36)}`;

/** sessionStorage kan kaste (privat vindue, blokeret lager); fanerne virker også uden. */
function readTabs(): TabsState | null {
  try {
    return parseTabs(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeTabs(s: TabsState | null): void {
  try {
    if (s) window.sessionStorage.setItem(STORAGE_KEY, serializeTabs(s));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Uden lager glemmes fanerne ved genindlæsning; hash'en bevarer stadig den aktive side.
  }
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function statusOf(e: unknown): number | undefined {
  return e instanceof PortalApiError ? e.status : undefined;
}

function openExternal(url: string) {
  window.open(url, "_blank", "noopener");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export interface PortalShellProps {
  user: PortalUser;
  api: PortalApi;
  baseUrl: string;
  /** Efter "Log ud": appen viser login-siden (eller demobrugeren lokalt). */
  onLoggedOut: () => void;
  /** Åben portal uden login (PORTAL_PUBLIC eller ingen nøgler): ingen kontomenu og intet "Log ud". */
  canLogout?: boolean;
}

/** Beskeder (07) hører til rammen: logges brugeren ud, forsvinder de med den. */
export function PortalShell(props: PortalShellProps) {
  return (
    <ToastProvider>
      <Shell {...props} />
    </ToastProvider>
  );
}

function Shell({ user, api, baseUrl, onLoggedOut, canLogout = true }: PortalShellProps) {
  const toast = useToast();
  const [tabs, setTabs] = useState<TabsState>(() => initialTabs(window.location.hash, readTabs(), newId));
  const [data, setData] = useState<Record<string, TabData>>({});
  const [saved, setSaved] = useState<SavedPageVM[] | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [accountOpen, setAccountOpen] = useState(false);
  // Bredden på portalens rod, samme container som AppShells mobilbrudpunkt (én synlig Gem-knap).
  const [rootRef, shellWidth] = useWidth<HTMLDivElement>(typeof window === "undefined" ? 1280 : window.innerWidth);

  // Seneste tilstand til asynkrone handlinger, og et løbenummer pr. fane, så et sent svar aldrig
  // overskriver et nyere (hurtige fokusskift, ny søgning mens den forrige henter).
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const dataRef = useRef(data);
  dataRef.current = data;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const requests = useRef(new Map<string, number>());
  const pendingSave = useRef(new Set<string>());
  const sharing = useRef(false);
  const firstSync = useRef(true);

  const active: PortalTab = activeTab(tabs) ?? { id: "", route: { kind: "search", q: "" }, label: "Søgning" };
  const activeHash = formatRoute(active.route);
  const activeKey = dataKey(active.route);

  const bump = (id: string) => {
    const n = (requests.current.get(id) ?? 0) + 1;
    requests.current.set(id, n);
    return n;
  };
  const current = (id: string, n: number) => requests.current.get(id) === n;

  /* ---------- Faner: sessionStorage, hash, titel ---------- */

  useEffect(() => writeTabs(tabs), [tabs]);

  // Den aktive fane står i adresselinjen. Første gang (og når kun skrivemåden afviger) erstattes
  // adressen; ellers lægges et nyt punkt i historikken, så tilbage/frem skifter fane.
  useEffect(() => {
    if (window.location.hash !== activeHash) {
      const same = sameRoute(portalRoute(window.location.hash), active.route);
      if (firstSync.current || same) window.history.replaceState(null, "", activeHash);
      else window.history.pushState(null, "", activeHash);
    }
    firstSync.current = false;
  }, [activeHash]);

  useEffect(() => {
    const onNavigate = () => setTabs((s) => openRoute(s, portalRoute(window.location.hash), newId, { fromHistory: true }));
    window.addEventListener("popstate", onNavigate);
    window.addEventListener("hashchange", onNavigate);
    return () => {
      window.removeEventListener("popstate", onNavigate);
      window.removeEventListener("hashchange", onNavigate);
    };
  }, []);

  useEffect(() => {
    document.title = `Lasso, ${active.label}`;
  }, [active.label]);

  // Kontoarket (mobil) hører til den side, det blev åbnet fra; tilbage/frem lukker det.
  useEffect(() => setAccountOpen(false), [activeHash]);

  /* ---------- Data ---------- */

  const fetchRoute = useCallback(
    (route: PortalRoute): Promise<ViewResult> => {
      switch (route.kind) {
        case "search":
          return api.search(route.q);
        case "saved":
          return api.pages();
        case "company":
          return api.company(route.id, route.focus);
        case "person":
          return api.person(route.id, route.focus);
      }
    },
    [api],
  );

  /** Gemte sider til skinnen og fanen "Gemte sider": ét kald, samme svar begge steder. */
  const loadSaved = useCallback(async (): Promise<ActionResult> => {
    const tab = tabsRef.current.tabs.find((t) => t.route.kind === "saved");
    const n = tab ? bump(tab.id) : 0;
    const key = dataKey({ kind: "saved" });
    if (tab) setData((all) => ({ ...all, [tab.id]: { ...all[tab.id], key, status: "loading", error: undefined, errorStatus: undefined } }));
    try {
      const result = await api.pages();
      setSaved(savedPagesOf(result.dataset));
      if (tab && current(tab.id, n)) setData((all) => ({ ...all, [tab.id]: { key, status: "ready", result, resultKey: key } }));
      return { ok: true };
    } catch (e) {
      if (tab && current(tab.id, n)) {
        setData((all) => {
          const prev = all[tab.id];
          return { ...all, [tab.id]: prev?.result ? { ...prev, status: "ready" } : { key, status: "error", error: errorText(e), errorStatus: statusOf(e) } };
        });
      }
      return { ok: false, error: errorText(e) };
    }
  }, [api]);

  const load = useCallback(
    async (tab: PortalTab): Promise<ActionResult> => {
      if (tab.route.kind === "saved") return loadSaved();
      const key = dataKey(tab.route);
      const n = bump(tab.id);
      setData((all) => ({ ...all, [tab.id]: { ...all[tab.id], key, status: "loading", error: undefined, errorStatus: undefined } }));
      try {
        const result = await fetchRoute(tab.route);
        if (!current(tab.id, n)) return { ok: true };
        setData((all) => {
          const prev = all[tab.id];
          return { ...all, [tab.id]: { key, status: "ready", result, resultKey: key, url: prev?.resultKey === key ? prev.url : undefined } };
        });
        const entity = entityOf(result.spec, result.dataset);
        if (entity) setTabs((s) => setLabel(s, tab.id, entity.name));
        return { ok: true };
      } catch (e) {
        if (current(tab.id, n)) {
          // Fejler en opdatering af en side, der allerede står, bliver siden stående (beskeden siger det).
          setData((all) => {
            const prev = all[tab.id];
            return { ...all, [tab.id]: prev?.result && prev.resultKey === key ? { ...prev, status: "ready" } : { ...prev, key, status: "error", error: errorText(e), errorStatus: statusOf(e) } };
          });
        }
        return { ok: false, error: errorText(e) };
      }
    },
    [fetchRoute, loadSaved],
  );

  // Hent den aktive fanes data, når fanen eller dens rute (søgetekst, fokus) skifter. En tom søgning
  // venter på brugeren; en fejl hentes først igen med "Prøv igen".
  useEffect(() => {
    if (!active.id) return;
    if (dataRef.current[active.id]?.key === activeKey) return;
    if (active.route.kind === "search" && !active.route.q) return;
    void load(active);
  }, [active.id, activeKey, load]);

  // Skinnens Firmaer og Personer (fanen "Gemte sider" henter selv, når den er aktiv).
  useEffect(() => {
    if (activeTab(tabsRef.current)?.route.kind !== "saved") void loadSaved();
  }, [loadSaved]);

  /** Gem/Gemt på alle åbne faner med samme side, så knapperne passer overalt. */
  const patchSaved = (lassoId: string, on: boolean) =>
    setData((all) => {
      const next: Record<string, TabData> = {};
      for (const [id, d] of Object.entries(all)) next[id] = d.result ? { ...d, result: { ...d.result, dataset: withSaved(d.result.dataset, lassoId, on) } } : d;
      return next;
    });

  const setUrl = (tabId: string, url: string) => setData((all) => (all[tabId] ? { ...all, [tabId]: { ...all[tabId]!, url } } : all));

  const savePage = async (target: { lassoId: string; pageKind: "company" | "person"; focus?: string }): Promise<ActionResult> => {
    try {
      await api.savePage({ page: target.lassoId, kind: target.pageKind, ...(target.focus ? { focus: target.focus } : {}) });
      patchSaved(target.lassoId, true);
      void loadSaved();
      return { ok: true, message: "Gemt på din liste" };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  };

  const removePage = async (lassoId: string): Promise<ActionResult> => {
    try {
      await api.removePage(lassoId);
      patchSaved(lassoId, false);
      void loadSaved();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  };

  /** Ny spec i samme fane (filterændring, opdatering af en søgning): POST resolve, som MCP-appen. */
  const resolveInto = async (tab: PortalTab, spec: ViewSpec): Promise<ActionResult> => {
    const key = dataKey(tab.route);
    const n = bump(tab.id);
    const before = dataRef.current[tab.id];
    setData((all) => {
      const prev = all[tab.id];
      return { ...all, [tab.id]: { ...prev, key, status: "loading", error: undefined, result: prev?.result ? { ...prev.result, spec } : undefined } };
    });
    try {
      const result = await api.resolve(spec);
      if (current(tab.id, n)) setData((all) => ({ ...all, [tab.id]: { key, status: "ready", result, resultKey: key } }));
      return { ok: true };
    } catch (e) {
      if (current(tab.id, n) && before) setData((all) => ({ ...all, [tab.id]: { ...before, status: "ready" } }));
      return { ok: false, error: errorText(e) };
    }
  };

  const failed = (res: ActionResult | void, retry: () => void) => {
    // Et 401 sender allerede til login-siden med sin egen besked; ingen fejlbesked oveni.
    if (res && !res.ok && res.error !== LOGGED_OUT) toast.show({ text: res.error, tone: "error", action: { label: "Prøv igen", onClick: retry } });
  };

  /* ---------- Navigation ---------- */

  const openEntity = (route: PortalRoute, label?: string) => setTabs((s) => openRoute(s, route, newId, { label, keepFocus: true }));
  const openSaved = () => setTabs((s) => openRoute(s, { kind: "saved" }, newId));
  const openSearch = () =>
    setTabs((s) => {
      const hit = s.tabs.find((t) => t.id === s.active && t.route.kind === "search") ?? s.tabs.find((t) => t.route.kind === "search");
      return hit ? activate(s, hit.id) : newSearch(s, newId);
    });
  const setRoute = (tab: PortalTab, route: PortalRoute) => setTabs((s) => updateRoute(s, tab.id, route));
  const close = (id: string) => {
    setTabs((s) => closeTab(s, id));
    requests.current.delete(id);
    setData((all) => {
      if (!(id in all)) return all;
      const next = { ...all };
      delete next[id];
      return next;
    });
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Cookien udløber alligevel; login-siden vises under alle omstændigheder.
    }
    writeTabs(null);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setTabs(newSearch(EMPTY_TABS, newId));
    setData({});
    onLoggedOut();
  };

  /* ---------- Handlinger fra LassoView og modulbjælken ---------- */

  /** Genvejene (08.4) peger på et værktøj; i portalen svarer de til et fokus. */
  const SECTION_FOCUS: Record<string, string> = { ejerdiagram: "ejerskab", regnskabsanalyse: "oekonomi", noegletal: "oekonomi" };

  const actionFor =
    (tab: PortalTab) =>
    async (a: ViewAction): Promise<ActionResult | void> => {
      const result = dataRef.current[tab.id]?.result;
      switch (a.kind) {
        case "open-company":
          openEntity({ kind: "company", id: a.lassoId, focus: "overblik" }, a.name);
          return { ok: true };
        case "open-person":
          openEntity({ kind: "person", id: a.lassoId, focus: "overblik" }, a.name);
          return { ok: true };
        case "set-criteria": {
          if (!result) return;
          const criteria = a.criteria;
          const spec: ViewSpec = {
            ...result.spec,
            criteria,
            components: result.spec.components.map((c) => (c.type === "LassoCompanyTable" ? { ...c, search: { ...c.search, criteria } } : c)),
          };
          const res = await resolveInto(tab, spec);
          failed(res, () => void actionFor(tab)(a));
          return res;
        }
        case "refresh": {
          const res = tab.route.kind === "search" && result ? await resolveInto(tab, result.spec) : await load(tab);
          failed(res, () => void actionFor(tab)(a));
          return res;
        }
        case "save": {
          if (!result) return;
          try {
            const r = await api.saveView({ spec: result.spec, name: a.name, slug: a.slug, visibility: a.visibility });
            setUrl(tab.id, r.url);
            return { ok: true, url: r.url };
          } catch (e) {
            return { ok: false, error: errorText(e) };
          }
        }
        case "save-page":
          return savePage(a);
        case "remove-saved-page":
          return removePage(a.lassoId);
        case "copy-link":
          return (await copyText(a.url)) ? { ok: true } : { ok: false, error: "Kunne ikke kopiere. Kopiér adressen fra browseren." };
        case "open-link":
          openExternal(a.url);
          return { ok: true };
        case "export":
          downloadCsv(a.filename, a.csv);
          return { ok: true };
        case "open-section": {
          // 08/24: "Se risiko", "Se historik" og genveje skifter fokus på samme fane.
          const route = tab.route;
          const focus = SECTION_FOCUS[a.section] ?? a.section;
          if (route.kind === "company" && route.id === a.lassoId && isFocus(focus)) {
            setRoute(tab, { ...route, focus });
            return { ok: true };
          }
          if (route.kind === "person" && route.id === a.lassoId && isPersonFocus(focus)) {
            setRoute(tab, { ...route, focus });
            return { ok: true };
          }
          return { ok: false, error: "Værktøjet findes ikke i portalen endnu." };
        }
        default:
          return;
      }
    };

  /** Gem/Gemt i modulbjælken: skifter straks og rulles tilbage, hvis serveren siger nej. */
  const toggleSaved = async (entity: Entity, focus?: string) => {
    if (pendingSave.current.has(entity.id)) return;
    pendingSave.current.add(entity.id);
    const want = !isSaved(entity.id, dataRef.current[active.id]?.result?.dataset, savedRef.current);
    patchSaved(entity.id, want);
    const res = want ? await savePage({ lassoId: entity.id, pageKind: entity.kind, ...(focus && focus !== "overblik" ? { focus } : {}) }) : await removePage(entity.id);
    pendingSave.current.delete(entity.id);
    if (!res.ok) {
      patchSaved(entity.id, !want);
      failed(res, () => void toggleSaved(entity, focus));
      return;
    }
    toast.show({ text: want ? "Gemt på din liste" : "Fjernet fra din liste", tone: "ok" });
  };

  /** Del link: gem den viste visning (POST views) og kopiér adressen. Samme link genbruges i fanen. */
  const shareLink = async (tab: PortalTab) => {
    const d = dataRef.current[tab.id];
    if (!d?.result || sharing.current) return;
    sharing.current = true;
    try {
      let url = d.url;
      if (!url) {
        const entity = entityOf(d.result.spec, d.result.dataset);
        url = (await api.saveView({ spec: d.result.spec, name: (entity?.name ?? d.result.spec.title).slice(0, 120) })).url;
        setUrl(tab.id, url);
      }
      const link = url;
      if (await copyText(link)) toast.show({ text: "Link kopieret", tone: "ok" });
      else toast.show({ text: "Linket er gemt, men kunne ikke kopieres.", tone: "error", action: { label: "Åbn", onClick: () => openExternal(link) } });
    } catch (e) {
      if (!isUnauthorized(e)) toast.show({ text: errorText(e), tone: "error", action: { label: "Prøv igen", onClick: () => void shareLink(tab) } });
    } finally {
      sharing.current = false;
    }
  };

  /* ---------- Rammen ---------- */

  const railActive =
    active.route.kind === "search" ? "search" : active.route.kind === "saved" ? "saved" : `${active.route.kind}:${active.route.id}`;

  const railGroups: RailGroup[] = (() => {
    const pages = saved ?? [];
    const entry = (p: SavedPageVM) => ({
      id: `${p.kind}:${p.lassoId}`,
      label: p.name,
      icon: "letter" as const,
      onSelect: () =>
        openEntity(
          p.kind === "company"
            ? { kind: "company", id: p.lassoId, focus: isFocus(p.focus) ? p.focus : "overblik" }
            : { kind: "person", id: p.lassoId, focus: isPersonFocus(p.focus) ? p.focus : "overblik" },
          p.name,
        ),
    });
    const footer = { label: "Se alle gemte", icon: "none" as const, onSelect: openSaved };
    return [
      {
        id: "vaerktoejer",
        label: "Værktøjer",
        collapsed: collapsed.vaerktoejer,
        items: [
          { id: "search", label: "Søgning", icon: <ShellIcon name="search" />, onSelect: openSearch },
          { id: "saved", label: "Gemte sider", icon: <ShellIcon name="list" />, onSelect: openSaved },
        ],
      },
      { id: "firmaer", label: "Firmaer", collapsed: collapsed.firmaer, items: pages.filter((p) => p.kind === "company").slice(0, RAIL_LIMIT).map(entry), footer },
      { id: "personer", label: "Personer", collapsed: collapsed.personer, items: pages.filter((p) => p.kind === "person").slice(0, RAIL_LIMIT).map(entry), footer },
    ];
  })();

  const stripTabs: StripTab[] = tabs.tabs.map((t) => ({
    id: t.id,
    label: t.label,
    active: t.id === active.id,
    icon:
      t.route.kind === "search" ? (
        <ShellIcon name="search" />
      ) : t.route.kind === "saved" ? (
        <ShellIcon name="list" />
      ) : t.route.kind === "person" ? (
        <ShellIcon name="user" />
      ) : undefined,
  }));

  const account = (
    <Menu
      trigger={<ShellIcon name="user" size={18} />}
      triggerClassName="lasso-strip__tool"
      triggerLabel="Konto"
      label="Konto"
      align="end"
      context={{ title: user.name, subtitle: user.org }}
      items={[{ id: "logout", label: "Log ud", sub: `Logget ind som ${user.name}`, onSelect: () => void logout() }]}
    />
  );

  const route = active.route;
  const mobile: AppShellMobile = {
    title: active.label,
    subtitle: route.kind === "company" ? FOCUS_LABELS[route.focus] : route.kind === "person" ? PERSON_FOCUS_LABELS[route.focus] : undefined,
    sections: route.kind === "company" ? FOCUS_MODULES : route.kind === "person" ? PERSON_MODULES : undefined,
    activeSection: route.kind === "company" || route.kind === "person" ? route.focus : undefined,
    onSelectSection:
      route.kind === "company"
        ? (id) => isFocus(id) && setRoute(active, { ...route, focus: id })
        : route.kind === "person"
          ? (id) => isPersonFocus(id) && setRoute(active, { ...route, focus: id })
          : undefined,
    nav: [
      { id: "soeg", label: "Søg", icon: <ShellIcon name="search" size={20} />, active: route.kind === "search", onSelect: openSearch },
      { id: "lister", label: "Lister", icon: <ShellIcon name="list" size={20} />, active: route.kind === "saved", onSelect: openSaved },
      // 26a: bundnavigationen har altid fire punkter. Portalen har endnu ingen overvågning, så punktet står dæmpet med grunden.
      { id: "overvaagning", label: "Overvågning", icon: <ShellIcon name="bell" size={20} />, disabled: true, disabledReason: "Overvågning er ikke slået til i portalen" },
      ...(canLogout ? [{ id: "konto", label: "Konto", icon: <ShellIcon name="user" size={20} />, active: accountOpen, onSelect: () => setAccountOpen(true) }] : []),
    ],
  };

  const d = data[active.id];
  const onAction = actionFor(active);
  const savePrefix = `${baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/v/${user.org}/`;

  let page;
  switch (route.kind) {
    case "search":
      page = (
        <SearchPage
          key={active.id}
          tab={active}
          route={route}
          data={d}
          savePrefix={savePrefix}
          onSearch={(q) => {
            if (!q) return;
            if (q === route.q) void load(active);
            else setRoute(active, { kind: "search", q });
          }}
          onRetry={() => void load(active)}
          onAction={onAction}
        />
      );
      break;
    case "saved":
      page = <SavedPage key={active.id} tab={active} data={d} onRetry={() => void loadSaved()} onAction={onAction} />;
      break;
    default: {
      const entity = d?.result && d.resultKey === d.key ? entityOf(d.result.spec, d.result.dataset) : null;
      const on = entity ? isSaved(entity.id, d?.result?.dataset, saved) : false;
      // "…" i mobilens topbjælke (26a): sidens handlinger som handlingsark.
      if (entity) {
        mobile.moreItems = [
          { id: "save", label: on ? "Fjern fra din liste" : "Gem på din liste", icon: <ShellIcon name="bookmark" size={16} filled={on} />, onSelect: () => void toggleSaved(entity, route.focus) },
          { id: "share", label: "Del link", icon: <ShellIcon name="copy" size={16} />, onSelect: () => void shareLink(active) },
        ];
      }
      page = (
        <EntityPage
          key={active.id}
          tab={active}
          route={route}
          data={d}
          savePrefix={savePrefix}
          shellWidth={shellWidth}
          saved={on}
          canAct={Boolean(entity)}
          onFocus={(focus) => {
            if (route.kind === "company" && isFocus(focus)) setRoute(active, { ...route, focus });
            else if (route.kind === "person" && isPersonFocus(focus)) setRoute(active, { ...route, focus });
          }}
          onToggleSaved={() => entity && void toggleSaved(entity, route.focus)}
          onShare={() => void shareLink(active)}
          onRetry={() => void load(active)}
          onAction={onAction}
        />
      );
    }
  }

  return (
    <div ref={rootRef} className="lasso-root lasso-portal" data-theme="light">
      <AppShell
        rail={{
          groups: railGroups,
          activeItem: railActive,
          onToggleGroup: (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] })),
          onLogo: openSearch,
        }}
        tabs={{
          tabs: stripTabs,
          onSelect: (id) => setTabs((s) => activate(s, id)),
          onClose: tabs.tabs.length > 1 ? close : undefined,
          onAdd: () => setTabs((s) => newSearch(s, newId)),
          account: canLogout ? account : undefined,
        }}
        mobile={mobile}
      >
        {page}
      </AppShell>
      <Dialog
        open={accountOpen}
        title="Konto"
        description={`Logget ind som ${user.name}${user.org ? `, ${user.org}` : ""}.`}
        size="sm"
        onClose={() => setAccountOpen(false)}
        actions={{
          primary: {
            label: "Log ud",
            onClick: () => {
              setAccountOpen(false);
              void logout();
            },
          },
          secondary: { label: "Annuller", onClick: () => setAccountOpen(false) },
        }}
      />
    </div>
  );
}
