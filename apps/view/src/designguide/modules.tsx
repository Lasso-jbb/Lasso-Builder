import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { COMPONENT_CATALOG, NO_ALTERNATIVE_REASON, type ComponentType, type Dataset, type ShowcaseItem, type ViewComponent, type ViewSpec, type Width } from "@lasso/spec";
import { LassoView, type HostCapabilities } from "@lasso/ui";
import type { Report } from "./inspect.js";
import { SOURCE, type DesignguideBoot } from "./source.js";
import { CATALOG_NUMBER } from "./structure.js";

/** Som i Claude: alle værtens knapper tegnes (klik gør intet her), så handlinger og opfølgning vises. */
export const HOST: HostCapabilities = { prompt: true, save: true, savePage: true, refine: true, drillDown: true, export: true, monitor: true, openSection: true, verifyContact: true, refresh: true, fullscreen: true };

/** En datakilde, et modul kan vises med: hovedvirksomheden/personen eller en af de alternative virksomheder. */
export interface DataOption {
  id: string;
  label: string;
  component: ViewComponent;
  dataset: Dataset;
}

export interface ModuleInfo {
  type: ComponentType;
  n: number;
  title: string;
  catalog: (typeof COMPONENT_CATALOG)[number];
  item?: ShowcaseItem;
  options: DataOption[];
  /** Hvorfor modulet ikke kan vises med en anden virksomhed (kredit, login …). */
  noAlternative?: string;
}

/** Alle katalogets moduler med de rigtige data, de kan vises med. */
export function buildModules(boot: DesignguideBoot): Map<ComponentType, ModuleInfo> {
  const sc = boot.showcase;
  const names: Record<string, string> = Object.fromEntries([...sc.alt.companies.map((c) => [c.id, c.name] as const), ...Object.values(sc.alt.dataset.companies ?? {}).map((c) => [c.lassoId, c.name] as const)]);
  const out = new Map<ComponentType, ModuleInfo>();
  for (const entry of COMPONENT_CATALOG) {
    const options: DataOption[] = [];
    let item: ShowcaseItem | undefined;
    for (const tab of sc.tabs) {
      const it = tab.items.find((x) => x.type === entry.type);
      if (!it) continue;
      item ??= it;
      options.push({ id: `${tab.id}:${tab.entity}`, label: tab.label, component: it.component, dataset: tab.dataset });
    }
    for (const v of sc.alt.variants[entry.type] ?? []) options.push({ id: `alt:${v.id}`, label: names[v.id] ?? v.id, component: v.component, dataset: sc.alt.dataset });
    // Komponenterne til flere virksomheder har deres egen sammenligning med rigtige virksomheder.
    const cmp = sc.alt.compare.find((x) => x.type === entry.type);
    if (cmp) {
      item ??= cmp;
      options.push({ id: "sammenligning", label: "Sammenligning af store virksomheder", component: cmp.component, dataset: sc.alt.dataset });
    }
    // Personmoduler, udstillingen ikke har med (fx personrisiko): samme person og datasæt som personfanen.
    const personTab = sc.tabs.find((t) => t.id === "person");
    if (!options.length && personTab && entry.type.startsWith("LassoPerson")) options.push({ id: `${personTab.id}:${personTab.entity}`, label: personTab.label, component: { type: entry.type, person: personTab.entity } as unknown as ViewComponent, dataset: personTab.dataset });
    out.set(entry.type, {
      type: entry.type,
      n: CATALOG_NUMBER.get(entry.type) ?? 0,
      title: entry.title,
      catalog: entry,
      ...(item ? { item } : {}),
      options,
      ...(NO_ALTERNATIVE_REASON[entry.type] ? { noAlternative: NO_ALTERNATIVE_REASON[entry.type] } : {}),
    });
  }
  return out;
}

export type StateMode = "fyldt" | "henter" | "fejl" | "ingen-adgang";
export const STATE_LABEL: Record<StateMode, string> = { fyldt: "Med data", henter: "Henter", fejl: "Fejl", "ingen-adgang": "Ingen adgang" };

/** Lasso-ID'erne, komponenten peger på. */
export function idsOf(c: ViewComponent): string[] {
  const x = c as { company?: string; person?: string; companies?: string[]; benchmark?: string };
  return [x.company, x.person, x.benchmark, ...(x.companies ?? [])].filter((v): v is string => typeof v === "string");
}

/**
 * Datasættet i en given tilstand: "henter" = modulets data fjernet (skelettet), "fejl" og "ingen-adgang"
 * = data fjernet og en fejl på hver af modulets fejlnøgler (LassoView.tsx `err(...)`).
 */
export function stateDataset(ds: Dataset, c: ViewComponent, item: ShowcaseItem | undefined, mode: StateMode): Dataset {
  if (mode === "fyldt") return ds;
  const ids = idsOf(c);
  const errors: Record<string, string> = { ...(ds.errors ?? {}) };
  const copy: Record<string, unknown> = { ...ds, errors };
  for (const key of item?.kraeverData ?? []) {
    const v = copy[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const next = { ...(v as Record<string, unknown>) };
      for (const id of ids) delete next[id];
      if (!ids.length) for (const k of Object.keys(next)) delete next[k];
      copy[key] = next;
    } else if (v !== undefined) delete copy[key];
  }
  if (mode !== "henter") {
    const message = mode === "fejl" ? "Lasso svarede ikke i tide (eksempel på en teknisk fejl)." : "Ingen adgang (403): kontoen har ikke adgang til data.";
    const prefixes = SOURCE.errPrefixes[c.type] ?? [];
    for (const p of prefixes) for (const id of ids.length ? ids : ["*"]) errors[`${p}:${id}`] = message;
  }
  return copy as unknown as Dataset;
}

export const specFor = (c: ViewComponent, title: string, width?: Width): ViewSpec =>
  ({ version: 2, kind: "custom", title, layout: width ? "grid-2" : "stack", criteria: [], components: [width ? { ...c, width } : c] }) as unknown as ViewSpec;

/** Modulet tegnet som på siden (uden visningens egen ramme). */
export function ModuleView({ component, dataset, title, width, theme }: { component: ViewComponent; dataset: Dataset; title: string; width?: Width; theme: "light" | "dark" }) {
  return <LassoView spec={specFor(component, title, width)} dataset={dataset} host={HOST} onAction={() => undefined} frameless theme={theme} />;
}

/* ---------- Valideringsresultater, delt mellem modulsiderne og valideringsoversigten ---------- */

export type ReportKey = string;
export const reportKey = (type: string, viewport: string, width: string, option: string, mode: string = "fyldt") => `${type}|${viewport}|${width}|${option}|${mode}`;

interface Reports {
  reports: Record<ReportKey, Report>;
  put: (key: ReportKey, r: Report) => void;
}
const ReportsContext = createContext<Reports>({ reports: {}, put: () => undefined });

export function ReportsProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Record<ReportKey, Report>>({});
  const pending = useRef<Record<ReportKey, Report>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const put = useCallback((key: ReportKey, r: Report) => {
    pending.current[key] = r;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const batch = pending.current;
      pending.current = {};
      setReports((prev) => ({ ...prev, ...batch }));
    }, 150);
  }, []);
  const value = useMemo(() => ({ reports, put }), [reports, put]);
  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
}

export const useReports = () => useContext(ReportsContext);
