import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  DataState,
  LassoView,
  ModuleBar,
  ModuleToolbar,
  ShellIcon,
  specToCsv,
  TabPanel,
  type ActionResult,
  type MenuItem,
  type HostCapabilities,
  type ModuleAction,
  type TabItem,
  type ViewAction,
} from "@lasso/ui";
import { FOCUSES, FOCUS_LABELS, isPersonFocus, PERSON_FOCUSES, PERSON_FOCUS_LABELS, type Focus, type PersonFocus } from "@lasso/spec";
import type { ViewResult } from "./api.js";
import { entityHost } from "./data.js";
import { dataKey, isFocus, type PortalRoute } from "./routes.js";
import type { PortalTab } from "./tabs.js";

/** En fanes data. `key` er den rute, der senest er bedt om; `resultKey` den, resultatet hører til. */
export interface TabData {
  key: string;
  status: "loading" | "ready" | "error";
  result?: ViewResult;
  resultKey?: string;
  /** Delt link (POST views) til den viste visning. */
  url?: string;
  error?: string;
  /** HTTP-status for fejlen: 400/404 er ikke tekniske fejl og vises som tom tilstand med forklaring. */
  errorStatus?: number;
}

type OnAction = (a: ViewAction) => Promise<ActionResult | void>;
type SearchRoute = Extract<PortalRoute, { kind: "search" }>;
type EntityRoute = Extract<PortalRoute, { kind: "company" | "person" }>;

export const FOCUS_MODULES: readonly TabItem[] = FOCUSES.map((f) => ({ id: f, label: FOCUS_LABELS[f] }));
/** Personsidens fokus (Overblik, Roller, Netværk, Ejerskab, Risiko, Historik), som virksomhedens. */
export const PERSON_MODULES: readonly TabItem[] = PERSON_FOCUSES.map((f) => ({ id: f, label: PERSON_FOCUS_LABELS[f] }));

export const SEARCH_EMPTY = "Søg på navn, CVR-nummer eller en beskrivelse, fx 'revisorer i Aarhus med mindst 10 ansatte'.";

/** Hvad LassoView må i hver slags fane (docs/portal.md). Knapper uden kapabilitet skjules. Virksomhed og person: entityHost i data.ts. */
export const SEARCH_HOST: HostCapabilities = { refine: true, drillDown: true, refresh: true, export: true, save: true, savePage: false };
export const SAVED_HOST: HostCapabilities = { savePage: true, drillDown: true };

/** Tilstanden, fanen står i lige nu (de fem tilstande: tom, henter, fejl, fyldt, og fyldt mens den opdateres). */
export type ViewState = "empty" | "loading" | "error" | "ready" | "refreshing";

export function viewState(route: PortalRoute, d: TabData | undefined): ViewState {
  if (route.kind === "search" && !route.q) return "empty";
  const key = dataKey(route);
  if (!d || d.key !== key) return "loading";
  if (d.status === "error") return "error";
  if (d.result && d.resultKey === key) return d.status === "loading" ? "refreshing" : "ready";
  return "loading";
}

function Body({ children }: { children: ReactNode }) {
  return <div className="lasso-portal-body">{children}</div>;
}

/**
 * Fejl (de fem tilstande): kun en teknisk fejl får fejltilstanden med "Prøv igen". Findes siden
 * ikke (404) eller er input ugyldigt (400), er det en tom tilstand, der siger hvorfor.
 */
function Failed({ data, onRetry }: { data: TabData | undefined; onRetry: () => void }) {
  if (data?.errorStatus === 404 || data?.errorStatus === 400) return <DataState state="empty" reason={data.error} />;
  return <DataState state="error" reason={data?.error} onRetry={onRetry} />;
}

/* ---------- Søgning: #/search?q= ---------- */

export function SearchPage({
  tab,
  route,
  data,
  savePrefix,
  onSearch,
  onRetry,
  onAction,
}: {
  tab: PortalTab;
  route: SearchRoute;
  data: TabData | undefined;
  savePrefix: string;
  onSearch: (q: string) => void;
  onRetry: () => void;
  onAction: OnAction;
}) {
  const [draft, setDraft] = useState(route.q);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(route.q), [route.q]);
  // En ny, tom søgning ("+") står klar til at skrive i.
  useEffect(() => {
    if (!route.q) input.current?.focus();
  }, []);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const q = draft.trim();
    if (q) onSearch(q);
    else input.current?.focus();
  };

  const state = viewState(route, data);
  return (
    <>
      <form role="search" className="lasso-portal-search" onSubmit={submit}>
        <ModuleToolbar
          field={
            <input
              ref={input}
              type="text"
              name="q"
              className="lasso-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Navn, CVR-nummer eller beskrivelse"
              aria-label="Søg efter virksomheder"
              enterKeyHint="search"
              autoComplete="off"
              maxLength={200}
            />
          }
          primary={{ label: "Søg", onClick: () => submit() }}
        />
      </form>
      {state === "empty" ? (
        <Body>
          <DataState state="empty" reason={SEARCH_EMPTY} />
        </Body>
      ) : state === "loading" ? (
        <Body>
          <DataState state="loading" height={320} lines={5} />
        </Body>
      ) : state === "error" ? (
        <Body>
          <Failed data={data} onRetry={onRetry} />
        </Body>
      ) : data?.result ? (
        <LassoView
          key={`${tab.id}:${data.resultKey}`}
          spec={data.result.spec}
          dataset={data.result.dataset}
          url={data.url}
          loading={state === "refreshing"}
          theme="light"
          host={SEARCH_HOST}
          savePrefix={savePrefix}
          onAction={onAction}
        />
      ) : null}
    </>
  );
}

/* ---------- Virksomhed (#/company/…?focus=) og person (#/person/…?focus=) ---------- */

export function EntityPage({
  tab,
  route,
  data,
  savePrefix,
  shellWidth,
  saved,
  canAct,
  onFocus,
  onToggleSaved,
  onShare,
  onRetry,
  onAction,
  onMonitor,
  monitoring = false,
}: {
  tab: PortalTab;
  route: EntityRoute;
  data: TabData | undefined;
  savePrefix: string;
  /** Rammens bredde: afgør, om Gem står i modulbjælken (desktop) eller i visningens hoved (mobil). */
  shellWidth: number;
  /** Står siden på brugerens liste (Gem/Gemt). */
  saved: boolean;
  /** Handlingerne vises, når siden er hentet og vi kender dens Lasso-ID. */
  canAct: boolean;
  /** Virksomhedsfokus på en virksomhedsside, personfokus på en personside. */
  onFocus: (focus: Focus | PersonFocus) => void;
  onToggleSaved: () => void;
  onShare: () => void;
  onRetry: () => void;
  onAction: OnAction;
  /** 24.3: Overvåg i modulbjælken; udeladt, indtil portalen har et overvågnings-API. */
  onMonitor?: () => void;
  monitoring?: boolean;
}) {
  const state = viewState(route, data);
  const company = route.kind === "company";
  const panel = `portal-${tab.id}`;
  const value = route.focus;
  const label = company ? FOCUS_LABELS[route.focus] : PERSON_FOCUS_LABELS[route.focus];
  // 24.3: "Eksportér ▾" (link og tal som CSV), Gem/Gemt og Overvåg, når portalen kan overvåge.
  const csv = data?.result ? specToCsv(data.result.spec, data.result.dataset) : null;
  const exportItems: MenuItem[] = [
    { id: "del", label: "Del link", icon: <ShellIcon name="copy" size={16} />, onSelect: onShare },
    ...(csv && data?.result
      ? [{ id: "csv", label: "Tal som CSV", icon: <ShellIcon name="download" size={16} />, onSelect: () => void onAction({ kind: "export", filename: `${data.result!.spec.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.csv`, csv }) }]
      : []),
  ];
  const actions: ModuleAction[] = canAct
    ? [
        { id: "eksport", label: "Eksportér", items: exportItems },
        { id: "gem", label: saved ? "Gemt" : "Gem", icon: <ShellIcon name="bookmark" filled={saved} />, tone: saved ? "accent" : undefined, onSelect: onToggleSaved },
        ...(onMonitor ? [{ id: "overvaag", label: monitoring ? "Overvåger" : "Overvåg", icon: <ShellIcon name="rss" />, tone: "accent" as const, onSelect: onMonitor }] : []),
      ]
    : [];
  const waiting = state === "loading" || state === "error";
  return (
    <>
      <ModuleBar
        id={panel}
        modules={company ? FOCUS_MODULES : PERSON_MODULES}
        value={value}
        onChange={(id) => {
          if (company ? isFocus(id) : isPersonFocus(id)) onFocus(id as Focus | PersonFocus);
        }}
        actions={actions}
        ariaLabel="Fokus"
      />
      <TabPanel
        id={panel}
        tab={value}
        loading={state === "loading"}
        loadingHeight={320}
        loadingLines={5}
        loadingLabel={label}
        className={waiting ? "lasso-portal-body" : ""}
      >
        {state === "error" ? (
          <Failed data={data} onRetry={onRetry} />
        ) : data?.result ? (
          <LassoView
            key={`${tab.id}:${data.resultKey}`}
            spec={data.result.spec}
            dataset={data.result.dataset}
            url={data.url}
            loading={state === "refreshing"}
            theme="light"
            host={entityHost(shellWidth)}
            savePrefix={savePrefix}
            onAction={onAction}
          />
        ) : null}
      </TabPanel>
    </>
  );
}

/* ---------- Gemte sider: #/saved ---------- */

export function SavedPage({ tab, data, onRetry, onAction }: { tab: PortalTab; data: TabData | undefined; onRetry: () => void; onAction: OnAction }) {
  const state = viewState({ kind: "saved" }, data);
  if (state === "error") {
    return (
      <Body>
        <Failed data={data} onRetry={onRetry} />
      </Body>
    );
  }
  if (!data?.result || state === "loading") {
    return (
      <Body>
        <DataState state="loading" height={320} lines={5} />
      </Body>
    );
  }
  return (
    <LassoView
      key={tab.id}
      spec={data.result.spec}
      dataset={data.result.dataset}
      loading={state === "refreshing"}
      theme="light"
      host={SAVED_HOST}
      onAction={onAction}
    />
  );
}
