import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { LassoMark, LassoView, LassoWordmark, type ActionResult, type ViewAction } from "@lasso/ui";
import { FOCUS_LABELS, isPersonFocus, PAGE_TABS, PERSON_FOCUS_LABELS, PERSON_FOCUSES, type Focus, type PersonFocus } from "@lasso/spec";
import type { Portal2Boot } from "../boot.js";
import { Text } from "../chat/ChatApp.js";
import { ChatHttpError, streamChat, type ChatState } from "../chat/stream.js";
import { PDF_SAVED, saveBlob } from "../pdfDownload.js";
import { createPortalApi, errorText, type LookupResult, type ViewResult } from "../portal/api.js";
import { entityOf, withSaved } from "../portal/data.js";
import { isFocus } from "../portal/routes.js";
import { P2Icon, type P2IconName } from "./icons.js";
import {
  addRecent,
  askPlaceholder,
  closeItem,
  headLines,
  highlight,
  LASSO_TAB,
  loadRecent,
  messageFor,
  openItem,
  saveRecent,
  searchCounts,
  searchRows,
  SHORTCUTS,
  STATUS_FILTERS,
  suggestions,
  withoutHead,
  type Answer,
  type ItemKind,
  type OpenItem,
  type RecentItem,
  type SearchRow,
  type SearchType,
  type Shown,
  type StatusFilter,
} from "./model.js";
import "./portal2.css";

/**
 * Den nye portal på /portal (prototypen "lasso-portal4.html"): topbjælke med søgning mens man skriver,
 * ikonskinne, faner for åbne firmaer/personer/resultater, modulrække (Lasso-mærket + fokus) og spørgefeltet.
 * Spørgefeltet er chatten (/api/chat, samme værktøjer som Claude): det, Claude henter, vises under fanen
 * med Lasso-mærket, og mærket bevæger sig, mens der hentes. Søgning og modulfaner bruger ikke AI.
 */

type Theme = "light" | "dark";
/** Menuerne: skjulte faner ("Flere"), alle faner (den aktive som dropdown), moduler, mobilens "⋯" og topfaner. */
type MenuKind = "hidden" | "all" | "more" | "sel" | "topmore" | "tophidden";
type Menu = { kind: MenuKind; left: number; top: number } | null;

const COMPANY_TABS = PAGE_TABS.map((f) => ({ id: f as string, label: FOCUS_LABELS[f] }));
const PERSON_TABS = PERSON_FOCUSES.map((f) => ({ id: f as string, label: PERSON_FOCUS_LABELS[f] }));
const SECTION_FOCUS: Record<string, string> = { ejerdiagram: "ejerskab", regnskabsanalyse: "oekonomi", noegletal: "oekonomi" };
const PHONE = "(max-width: 760px)";

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem("lasso-theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    // Ingen lager (privat vindue): følg systemet.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const isPhone = () => window.matchMedia?.(PHONE).matches ?? false;
const iconOf = (k: ItemKind): P2IconName => (k === "company" ? "build" : k === "person" ? "user" : "search");
const tabsOf = (k: ItemKind) => (k === "company" ? COMPANY_TABS : k === "person" ? PERSON_TABS : []);

function Inert({ icon, label }: { icon: P2IconName; label: string }) {
  return (
    <button type="button" className="ibtn" aria-disabled="true" aria-label={`${label} (kommer senere)`}>
      <P2Icon name={icon} />
      <span className="tip">{label}</span>
    </button>
  );
}

export function Portal2App({ boot }: { boot: Portal2Boot }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [open, setOpen] = useState<OpenItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  /** Data pr. fane: "<id>:<modul>" for firmaer og personer, "<key>" for resultater. */
  const [shown, setShown] = useState<Record<string, Shown>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  /** Chattens svar pr. fane (firmaets/personens Lasso-ID eller resultatets key). */
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [hiddenMods, setHiddenMods] = useState<string[]>([]);
  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  const [soloTab, setSoloTab] = useState(false);
  const [modSelect, setModSelect] = useState(false);
  const [hiddenTop, setHiddenTop] = useState<string[]>([]);
  const [soloTop, setSoloTop] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // Søgefeltet
  const [q, setQ] = useState("");
  const [sType, setSType] = useState<SearchType>("f");
  const [sStatus, setSStatus] = useState<StatusFilter>("Aktive");
  const [statusOpen, setStatusOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [dropOpen, setDropOpen] = useState(false);
  const [mSearch, setMSearch] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | undefined>();
  const [looking, setLooking] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>(() => loadRecent(storage()));

  const chat = useRef<ChatState>({ history: [] });
  const lastEntity = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const resultSeq = useRef(0);
  const lookupSeq = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const dq = useRef<HTMLInputElement>(null);
  const mq = useRef<HTMLInputElement>(null);
  const askInput = useRef<HTMLInputElement>(null);
  const searchwrap = useRef<HTMLDivElement>(null);
  const tabsCol = useRef<HTMLDivElement>(null);
  const otabs = useRef<HTMLDivElement>(null);
  const modCol = useRef<HTMLDivElement>(null);
  const mlist = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLElement>(null);
  const toptabs = useRef<HTMLDivElement>(null);

  const api = useMemo(() => createPortalApi(() => setNotice("Du er logget ud. Genindlæs siden.")), []);
  const item = open.find((o) => o.key === active);
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    document.title = item ? `${item.name}, Lasso` : "Lasso";
  }, [item?.name]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("lasso-theme", theme);
    } catch {
      // Uden lager huskes temaet bare ikke.
    }
  }, [theme]);

  /* ---------- data ---------- */

  const setBusy = (key: string, on: boolean) =>
    setLoading((s) => {
      const n = new Set(s);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });
  const put = (key: string, r: Shown) => setShown((s) => ({ ...s, [key]: r }));

  const load = async (kind: "company" | "person", id: string, tab: string, force = false) => {
    const key = `${id}:${tab}`;
    if (!force && shownRef.current[key]) return;
    setBusy(key, true);
    setFailed((f) => ({ ...f, [key]: "" }));
    try {
      const r: ViewResult = kind === "company" ? await api.company(id, tab as Focus) : await api.person(id, tab as PersonFocus);
      put(key, { spec: r.spec, dataset: r.dataset });
      const ent = entityOf(r.spec, r.dataset);
      if (ent) setOpen((l) => l.map((o) => (o.key === id ? { ...o, name: ent.name } : o)));
    } catch (e) {
      setFailed((f) => ({ ...f, [key]: errorText(e) }));
    } finally {
      setBusy(key, false);
    }
  };
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const activate = (key: string | null) => {
    setActive((prev) => {
      if (prev && prev !== key) setHistory((h) => [...h.filter((k) => k !== prev).slice(-20), prev]);
      return key;
    });
    setMenu(null);
    setAskOpen(false);
    scroller.current?.scrollTo({ top: 0 });
  };

  const remember = (r: RecentItem) =>
    setRecent((l) => {
      const next = addRecent(l, r);
      saveRecent(storage(), next);
      return next;
    });

  /** Åbner et firma eller en person som fane (eller skifter til den) på et modul. */
  const openEntity = (kind: "company" | "person", id: string, name: string, tab = "overblik", sub?: string) => {
    setOpen((l) => openItem(l, { key: id, kind, name, tab, ...(sub ? { sub } : {}) }));
    activate(id);
    remember({ kind, id, name, meta: sub ?? "" });
    if (tab !== LASSO_TAB) void load(kind, id, tab);
  };

  /** Et resultat (søgning, liste) som fane. */
  const openResult = async (title: string, fetcher: () => Promise<ViewResult>) => {
    const key = `result:${++resultSeq.current}`;
    setOpen((l) => [...l, { key, kind: "result", name: title, tab: LASSO_TAB }]);
    activate(key);
    setBusy(key, true);
    try {
      const r = await fetcher();
      put(key, { spec: r.spec, dataset: r.dataset });
    } catch (e) {
      setFailed((f) => ({ ...f, [key]: errorText(e) }));
    } finally {
      setBusy(key, false);
    }
  };

  const closeTab = (key: string) => {
    const r = closeItem(open, key, active);
    setOpen(r.list);
    setActive(r.active);
    setHistory((h) => h.filter((k) => k !== key));
    if (pendingKey === key) abort.current?.abort();
  };

  const switchTab = (tab: string) => {
    if (!item || item.kind === "result") return;
    setOpen((l) => l.map((o) => (o.key === item.key ? { ...o, tab } : o)));
    setMenu(null);
    if (tab !== LASSO_TAB) void load(item.kind, item.key, tab);
  };

  const goBack = () => {
    const prev = [...history].reverse().find((k) => open.some((o) => o.key === k));
    if (!prev) return;
    setHistory((h) => h.filter((k) => k !== prev));
    setActive(prev);
  };

  /* ---------- søgefeltet ---------- */

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setLookup(undefined);
      setLooking(false);
      return;
    }
    const seq = ++lookupSeq.current;
    setLooking(true);
    const t = setTimeout(() => {
      api
        .lookup(text)
        .then((r) => {
          if (seq !== lookupSeq.current) return;
          setLookup(r);
          setSel(0);
          // Ingen firmaer, men personer: vis personfanen.
          if (!r.companies.length && r.persons.length) setSType("p");
        })
        .catch(() => seq === lookupSeq.current && setLookup({ q: text, companies: [], persons: [] }))
        .finally(() => seq === lookupSeq.current && setLooking(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q, api]);

  const counts = searchCounts(lookup, sStatus);
  const rows: SearchRow[] = q.trim() ? searchRows(lookup, sType, sStatus) : recent.map((r) => ({ kind: r.kind, id: r.id, name: r.name, meta: r.meta }));

  const closeSearch = () => {
    setDropOpen(false);
    setMSearch(false);
    setStatusOpen(false);
  };
  const resetSearch = () => {
    setQ("");
    setLookup(undefined);
    setSel(0);
  };

  const choose = (r: SearchRow, tab = "overblik") => {
    resetSearch();
    closeSearch();
    dq.current?.blur();
    openEntity(r.kind, r.id, r.name, tab, r.meta);
  };

  const seeAll = () => {
    const text = q.trim();
    resetSearch();
    closeSearch();
    void openResult(`Søgning: ${text}`, () => api.search(text));
  };

  const askFromSearch = () => {
    const text = q.trim();
    resetSearch();
    closeSearch();
    void ask(text);
  };

  const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const empty = q.trim().length >= 2 && !looking && !counts.f && !counts.p;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (empty) askFromSearch();
      else if (rows[sel]) choose(rows[sel]!);
    } else if (e.key === "Tab" && q.trim()) {
      e.preventDefault();
      setSType((t) => (t === "f" ? "p" : "f"));
      setSel(0);
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
      closeSearch();
    }
  };

  // "/" sætter fokus i søgefeltet (desktop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea" && !isPhone()) {
        e.preventDefault();
        dq.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Klik uden for søgefeltet og menuerne lukker dem.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (searchwrap.current && !searchwrap.current.contains(t)) setDropOpen(false);
      if (!(t as HTMLElement).closest?.(".dd,[data-menu]")) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  /* ---------- chatten ---------- */

  const ask = async (raw: string) => {
    const text = raw.trim();
    if (!text || pendingKey) return;
    if (!boot.chat) {
      setNotice("Chatten er ikke slået til på serveren (ANTHROPIC_API_KEY).");
      return;
    }
    setDraft("");
    setAskOpen(false);
    const here = itemRef.current;
    const message = messageFor(text, here, lastEntity.current);
    // Svaret hører til den fane, man står på; står man på forsiden eller et resultat, til en ny resultatfane.
    let key: string;
    if (here && here.kind !== "result") {
      key = here.key;
      setOpen((l) => l.map((o) => (o.key === key ? { ...o, tab: LASSO_TAB } : o)));
    } else {
      key = `result:${++resultSeq.current}`;
      setOpen((l) => [...l, { key, kind: "result", name: text, tab: LASSO_TAB }]);
      activate(key);
    }
    let current = key;
    setPendingKey(key);
    setAnswers((a) => ({ ...a, [key]: { question: text, text: "", pending: true } }));
    const patch = (fn: (a: Answer) => Answer) => setAnswers((all) => (all[current] ? { ...all, [current]: fn(all[current]!) } : all));
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await streamChat(
        { message, history: chat.current.history, sig: chat.current.sig },
        (e) => {
          switch (e.type) {
            case "text":
              patch((a) => ({ ...a, text: a.text + e.text }));
              break;
            case "tool":
              patch((a) => ({ ...a, status: `${e.title} …` }));
              break;
            case "tool_error":
              patch((a) => ({ ...a, status: undefined }));
              break;
            case "view": {
              const view = { spec: e.spec, dataset: e.dataset };
              const ent = entityOf(e.spec, e.dataset);
              if (ent && ent.id !== current) {
                // Claude hentede et andet firma/en anden person: svaret flytter til den fane (åbnes, hvis den ikke er åben).
                const moved = { ...(answersRef.current[current] ?? { question: text, text: "", pending: true }), view, status: undefined };
                const from = current;
                current = ent.id;
                setPendingKey(ent.id);
                setAnswers((all) => {
                  const { [from]: _drop, ...rest } = all;
                  return { ...rest, [ent.id]: moved };
                });
                setOpen((l) => {
                  const base = from.startsWith("result:") ? l.filter((o) => o.key !== from) : l.map((o) => (o.key === from && o.tab === LASSO_TAB ? { ...o, tab: "overblik" } : o));
                  return openItem(base, { key: ent.id, kind: ent.kind, name: ent.name, tab: LASSO_TAB });
                });
                activate(ent.id);
                // Den fane, man spurgte fra, går tilbage til Overblik (dens Lasso-svar er flyttet).
                if (here && here.kind !== "result" && here.key === from) void load(here.kind, from, "overblik");
              } else {
                patch((a) => ({ ...a, view, status: undefined }));
                if (ent) setOpen((l) => l.map((o) => (o.key === ent.id ? { ...o, name: ent.name } : o)));
                else setOpen((l) => l.map((o) => (o.key === current ? { ...o, name: e.spec.title } : o)));
              }
              if (ent) lastEntity.current = ent.id;
              break;
            }
            case "error":
              patch((a) => ({ ...a, error: e.message, status: undefined }));
              break;
            case "done":
              chat.current = { history: e.history, sig: e.sig };
              break;
          }
        },
        { signal: ctrl.signal },
      );
    } catch (e) {
      const msg = e instanceof ChatHttpError && e.status === 401 ? "Chatten kræver login. Log ind i portalen og prøv igen." : errorText(e);
      patch((a) => ({ ...a, error: msg }));
    } finally {
      patch((a) => ({ ...a, pending: false, status: undefined }));
      setPendingKey(null);
      abort.current = null;
    }
  };
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const stop = () => abort.current?.abort();

  /* ---------- det, der vises nu ---------- */

  const onLasso = item ? item.kind === "result" || item.tab === LASSO_TAB : false;
  const answer = item ? answers[item.key] : undefined;
  const dataKey = item ? (item.kind === "result" ? item.key : `${item.key}:${item.tab}`) : null;
  const current: Shown | undefined = item ? (item.kind !== "result" && item.tab === LASSO_TAB ? answer?.view : (dataKey ? shown[dataKey] : undefined) ?? (item.kind === "result" ? answer?.view : undefined)) : undefined;
  const headData = item && item.kind !== "result" ? (shown[`${item.key}:overblik`]?.dataset ?? answer?.view?.dataset ?? current?.dataset) : undefined;
  const lines = item ? headLines(item.kind, item.key, headData) : [];
  const saved = Boolean(item && item.kind !== "result" && (headData?.savedIds?.includes(item.key) || current?.dataset.savedIds?.includes(item.key)));
  const busy = dataKey ? loading.has(dataKey) : false;
  const err = dataKey ? failed[dataKey] : "";
  const pending = pendingKey !== null;
  const tabs = item ? tabsOf(item.kind) : [];
  const lassoAvailable = Boolean(item && (item.kind === "result" || answers[item.key]));
  const curLabel = item ? (onLasso ? "Lassos svar" : (tabs.find((t) => t.id === item.tab)?.label ?? "")) : "";

  // Sub-linjen i fanens tooltip og i mobilarket, når data kommer.
  useEffect(() => {
    if (!item || item.kind === "result" || item.sub || !lines.length) return;
    const sub = lines.join(", ");
    setOpen((l) => l.map((o) => (o.key === item.key ? { ...o, sub } : o)));
  }, [item?.key, lines.join("|")]);

  const replaceCurrent = (r: Shown) => {
    if (!item) return;
    if (item.kind !== "result" && item.tab === LASSO_TAB) setAnswers((a) => (a[item.key] ? { ...a, [item.key]: { ...a[item.key]!, view: r } } : a));
    else if (dataKey) put(dataKey, r);
  };

  const patchSaved = (lassoId: string, on: boolean) => {
    setShown((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, dataset: withSaved(v.dataset, lassoId, on) }])));
    setAnswers((all) => Object.fromEntries(Object.entries(all).map(([k, a]) => [k, a.view ? { ...a, view: { ...a.view, dataset: withSaved(a.view.dataset, lassoId, on) } } : a])));
  };

  const toggleSaved = async () => {
    if (!item || item.kind === "result") return;
    const want = !saved;
    patchSaved(item.key, want);
    try {
      if (want) await api.savePage({ page: item.key, kind: item.kind });
      else await api.removePage(item.key);
    } catch (e) {
      patchSaved(item.key, !want);
      setNotice(errorText(e));
    }
  };

  const onAction = async (a: ViewAction): Promise<ActionResult | void> => {
    try {
      switch (a.kind) {
        case "prompt":
          void ask(a.prompt);
          return { ok: true };
        case "open-focus":
        case "open-section": {
          const focus = a.kind === "open-focus" ? a.focus : (SECTION_FOCUS[a.section] ?? a.section);
          if (item && item.kind !== "result" && (item.kind === "company" ? isFocus(focus) : isPersonFocus(focus))) {
            switchTab(focus);
            return { ok: true };
          }
          return { ok: false, error: "Fanen findes ikke på denne side." };
        }
        case "open-company":
          openEntity("company", a.lassoId, a.name ?? a.lassoId);
          return { ok: true };
        case "open-person":
          openEntity("person", a.lassoId, a.name ?? a.lassoId);
          return { ok: true };
        case "set-criteria":
        case "refresh": {
          if (!current) return;
          const spec =
            a.kind === "set-criteria"
              ? { ...current.spec, criteria: a.criteria, components: current.spec.components.map((c) => (c.type === "LassoCompanyTable" ? { ...c, search: { ...c.search, criteria: a.criteria } } : c)) }
              : current.spec;
          const r = await api.resolve(spec);
          replaceCurrent({ spec: r.spec, dataset: r.dataset });
          return { ok: true };
        }
        case "save": {
          if (!current) return;
          const r = await api.saveView({ spec: current.spec, name: a.name, slug: a.slug, visibility: a.visibility });
          return { ok: true, url: r.url };
        }
        case "save-page":
          await api.savePage({ page: a.lassoId, kind: a.pageKind, ...(a.focus ? { focus: a.focus } : {}) });
          patchSaved(a.lassoId, true);
          return { ok: true, message: "Gemt på din liste" };
        case "remove-saved-page":
          await api.removePage(a.lassoId);
          patchSaved(a.lassoId, false);
          return { ok: true };
        case "copy-link":
          await navigator.clipboard.writeText(a.url);
          return { ok: true };
        case "open-link":
          window.open(a.url, "_blank", "noopener");
          return { ok: true };
        case "export":
          saveBlob(new Blob([a.csv], { type: "text/csv;charset=utf-8" }), a.filename);
          return { ok: true };
        case "pdf": {
          if (!current || !item) return;
          const file =
            item.kind !== "result" && item.tab !== LASSO_TAB
              ? await (item.kind === "company" ? api.pdfCompany(item.key, item.tab as Focus) : api.pdfPerson(item.key, item.tab as PersonFocus))
              : await api.pdfSpec(current.spec);
          saveBlob(file.blob, file.filename);
          return { ok: true, message: PDF_SAVED };
        }
        case "back":
          goBack();
          return { ok: true };
        default:
          return { ok: false, error: "Det kan portalen ikke endnu." };
      }
    } catch (e) {
      return { ok: false, error: errorText(e) };
    }
  };

  /* ---------- layout: fanernes og modulernes overløb, rulning, søgefeltets placering ---------- */

  const measure = useCallback(() => {
    // Åbne faner (prototype 4): de inaktive smalles ind og skjules bag "Flere"; står kun den aktive tilbage,
    // bliver den selv en dropdown med alle åbne.
    const box = otabs.current;
    const col = tabsCol.current;
    if (box && col) {
      const els = [...box.children] as HTMLElement[];
      const oa = col.querySelector<HTMLElement>("[data-openall]");
      els.forEach((t) => {
        t.style.display = "";
        t.style.maxWidth = "";
      });
      if (oa) oa.style.display = "none";
      const cs = getComputedStyle(col);
      const avail = col.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
      const sum = () => els.filter((t) => t.style.display !== "none").reduce((s2, t) => s2 + t.offsetWidth, 0) + (oa && oa.style.display !== "none" ? oa.offsetWidth + 6 : 0);
      if (sum() > avail) els.forEach((t) => !t.classList.contains("on") && (t.style.maxWidth = "136px"));
      if (sum() > avail && oa) {
        oa.style.display = "";
        for (const t of els) {
          if (sum() <= avail) break;
          if (t.classList.contains("on")) continue;
          t.style.display = "none";
        }
      }
      const hide = els.filter((t) => t.style.display === "none").map((t) => t.dataset.key ?? "");
      const visibleInactive = els.filter((t) => !t.classList.contains("on") && t.style.display !== "none").length;
      const solo = els.length > 1 && visibleInactive === 0;
      if (solo && oa) oa.style.display = "none";
      setHiddenTabs((h) => (h.join("|") === hide.join("|") ? h : hide));
      setSoloTab(solo);
    }
    // Moduler: skjul fra højre bag "Flere"; er der plads til færre end to, bliver rækken en vælger.
    const ml = mlist.current;
    const mc = modCol.current;
    if (ml && mc) {
      const btns = [...ml.querySelectorAll<HTMLElement>("[data-mod]")];
      const more = ml.querySelector<HTMLElement>("[data-more]");
      ml.style.display = "";
      btns.forEach((b) => (b.style.display = ""));
      if (more) more.style.display = "none";
      const cs = getComputedStyle(mc);
      const fixed = [...mc.querySelectorAll<HTMLElement>(".tabmark, .rgroup")].reduce((s2, e) => s2 + e.offsetWidth, 0);
      const avail = mc.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - fixed - 8;
      const width = () => btns.filter((b) => b.style.display !== "none").reduce((s2, b) => s2 + b.offsetWidth + 22, 0) + (more && more.style.display !== "none" ? more.offsetWidth + 22 : 0);
      if (width() > avail && more) {
        more.style.display = "";
        for (let i = btns.length - 1; i >= 0 && width() > avail; i--) btns[i]!.style.display = "none";
      }
      const hide = btns.filter((b) => b.style.display === "none").map((b) => b.dataset.mod ?? "");
      const select = btns.length > 0 && btns.length - hide.length < 2;
      ml.style.display = select ? "none" : "";
      setHiddenMods((h) => (h.join("|") === hide.join("|") ? h : hide));
      setModSelect(select);
    }
    // Mobil: de åbne faner i topbjælken, når den er klappet sammen (aktive først, ældste skjules).
    const tt = toptabs.current;
    if (tt && isPhone()) {
      const items = [...tt.querySelectorAll<HTMLElement>("[data-tt]")];
      const more = tt.querySelector<HTMLElement>("[data-ttmore]");
      items.forEach((t) => {
        t.style.display = "";
        t.style.maxWidth = "";
      });
      if (more) more.style.display = "none";
      const avail = tt.clientWidth;
      const w = () => items.filter((t) => t.style.display !== "none").reduce((s2, t) => s2 + t.offsetWidth + 6, 0) + (more && more.style.display !== "none" ? more.offsetWidth + 6 : 0);
      if (w() > avail) items.forEach((t) => !t.classList.contains("on") && (t.style.maxWidth = "110px"));
      if (w() > avail && more) {
        more.style.display = "";
        for (const t of items) {
          if (w() <= avail) break;
          if (t.classList.contains("on")) continue;
          t.style.display = "none";
        }
      }
      const hide = items.filter((t) => t.style.display === "none").map((t) => t.dataset.tt ?? "");
      const solo = items.length > 1 && items.filter((t) => !t.classList.contains("on") && t.style.display !== "none").length === 0;
      if (solo && more) more.style.display = "none";
      setHiddenTop((h) => (h.join("|") === hide.join("|") ? h : hide));
      setSoloTop(solo);
    }
    // Søgefeltet flugter med indholdets kolonne.
    if (top.current && mc && !isPhone()) {
      const c = mc.getBoundingClientRect();
      const t = top.current.getBoundingClientRect();
      if (c.width) top.current.style.setProperty("--searchX", `${Math.max(140, c.left + 40 - t.left)}px`);
    }
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, open, active, item?.tab, lassoAvailable, collapsed]);

  useEffect(() => {
    const onResize = () => {
      measure();
      setMenu(null);
    };
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  const onScroll = () => {
    const sc = scroller.current;
    if (!sc) return;
    if (isPhone()) {
      setCollapsed(sc.scrollTop > 48);
      setScrolled(false);
    } else {
      setCollapsed(false);
      setScrolled(sc.scrollTop > 4);
    }
  };

  const showMenu = (kind: MenuKind, anchor: HTMLElement, align: "left" | "right" = "left") => {
    if (menu?.kind === kind) return setMenu(null);
    const r = anchor.getBoundingClientRect();
    const w = 260;
    let left = align === "right" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    setMenu({ kind, left, top: r.bottom + 6 });
  };

  /* ---------- tegning ---------- */

  const resultsView = (phone: boolean): ReactNode => {
    const text = q.trim();
    if (!text) {
      return (
        <div className="sr-list">
          <div className="sr-label">
            Seneste
            {recent.length ? (
              <button
                type="button"
                onClick={() => {
                  setRecent([]);
                  saveRecent(storage(), []);
                }}
              >
                Ryd
              </button>
            ) : null}
          </div>
          {rows.length ? rows.map((r, i) => renderRow(r, i, "")) : <div className="sr-empty">Søg på et firmanavn, et CVR-nummer eller en person.</div>}
        </div>
      );
    }
    if (looking && !lookup) return <div className="sr-empty">Søger …</div>;
    if (!counts.f && !counts.p && !looking) {
      return (
        <>
          <div className="sr-empty">Ingen firmaer eller personer matcher "{text}". Prøv et CVR-nummer eller en del af navnet.</div>
          <div className="sr-list">
            <div className="sr-row sel" onClick={askFromSearch}>
              <LassoMark className="mark" />
              <div className="t">
                <div className="n">Spørg Lasso om "{text}"</div>
              </div>
            </div>
          </div>
        </>
      );
    }
    const names: Record<SearchType, string> = { f: "Firmaer", p: "Personer" };
    const nouns: Record<SearchType, string> = { f: "firmaer", p: "personer" };
    const tabsEl = (["f", "p"] as const).map((t) => (
      <button
        key={t}
        type="button"
        className={`sr-tab${t === sType ? " on" : ""}${counts[t] ? "" : " zero"}`}
        onClick={() => {
          setSType(t);
          setSel(0);
        }}
      >
        {names[t]} <small>{counts[t]}</small>
      </button>
    ));
    const stat =
      sType === "f" ? (
        <div className="stat">
          <span>Status:</span>
          <button type="button" style={{ display: "flex", alignItems: "center", gap: 4 }} onClick={() => setStatusOpen((o) => !o)}>
            <b>{sStatus}</b>
            <P2Icon name="down" />
          </button>
          {statusOpen ? (
            <div className="statdd">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={s === sStatus ? "cur" : ""}
                  onClick={() => {
                    setSStatus(s);
                    setStatusOpen(false);
                    setSel(0);
                  }}
                >
                  {s}
                  {s === sStatus ? <P2Icon name="check" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null;
    const seeall =
      sType === "f" && counts.f ? (
        <button type="button" className="seeall" onClick={seeAll}>
          Se alle {nouns[sType]} for "{text}"
        </button>
      ) : null;
    return (
      <>
        {phone ? (
          <>
            <div className="sr-head">{tabsEl}</div>
            <div className="sr-sub">
              {seeall ?? <span />}
              {stat}
            </div>
          </>
        ) : (
          <div className="sr-head">
            {tabsEl}
            {stat}
          </div>
        )}
        <div className="sr-list">{rows.length ? rows.map((r, i) => renderRow(r, i, text)) : <div className="sr-empty">Ingen resultater med den status.</div>}</div>
        {!phone && seeall ? <div className="sr-foot">{seeall}</div> : null}
      </>
    );
  };

  const renderRow = (r: SearchRow, i: number, text: string) => {
    const h = highlight(r.name, text);
    return (
      <div key={r.id} className={`sr-row${i === sel ? " sel" : ""}`} onMouseMove={() => i !== sel && setSel(i)} onClick={() => choose(r)}>
        <P2Icon name={r.kind === "company" ? "build" : "user"} />
        <div className="t">
          <div className="n">
            {h.pre}
            {h.hit ? <b>{h.hit}</b> : null}
            {h.post}
          </div>
          <div className="m">{r.meta}</div>
        </div>
        {r.status && sStatus !== "Aktive" ? <span className="st">{r.status}</span> : null}
        {r.kind === "company" ? (
          <div className="short">
            {SHORTCUTS.map((s) => (
              <button
                key={s.tab}
                type="button"
                aria-label={`Åbn i ${s.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  choose(r, s.tab);
                }}
              >
                <P2Icon name={s.icon} />
                <span className="tt">{s.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  let content: ReactNode;
  if (!item) {
    content = (
      <div className="home">
        <LassoMark className={`home__mark${pending ? " is-busy" : ""}`} />
        <h1>Hvad vil du vide?</h1>
        <p>Søg efter et firma eller en person ovenfor, eller spørg Lasso nedenfor. Svaret vises her.</p>
      </div>
    );
  } else {
    const view = current ? (item.kind !== "result" ? withoutHead(current.spec) : current.spec) : null;
    content = (
      <>
        {onLasso && answer ? (
          <div className="answer" aria-live="polite">
            <div className="answer__q">{answer.question}</div>
            {answer.text ? <Text text={answer.text} /> : null}
            {answer.pending && !answer.view ? <div className="answer__status">{answer.status ?? "Tænker …"}</div> : null}
            {answer.error ? (
              <div className="answer__error" role="alert">
                {answer.error}
              </div>
            ) : null}
          </div>
        ) : null}
        {err ? (
          <div className="answer__error" role="alert">
            {err}
          </div>
        ) : view && current ? (
          <div className="view">
            <LassoView
              key={`${dataKey}:${view.title}:${view.components.length}`}
              spec={view}
              dataset={current.dataset}
              theme={theme}
              frameless
              page={item.kind !== "result"}
              host={{ prompt: true, save: true, refine: true, drillDown: true, refresh: true, export: true, pdf: boot.pdf !== false, openFocus: item.kind !== "result", openSection: item.kind !== "result" }}
              onAction={onAction}
            />
          </div>
        ) : busy || (onLasso && answer?.pending) ? (
          <div className="skeleton" aria-label="Henter">
            <div />
            <div />
            <div />
          </div>
        ) : null}
        <div className="end" />
      </>
    );
  }

  const sugg = suggestions(item);

  return (
    <div className={`p3${collapsed ? " collapsed" : ""}${scrolled ? " scrolled" : ""}`} data-theme={theme}>
      <header className="top" ref={top}>
        <button type="button" className="logo" onClick={() => activate(null)} aria-label="Lasso, forside">
          <LassoWordmark className="wordmark" />
        </button>
        <div className="searchwrap" ref={searchwrap}>
          <div className={`search${dropOpen ? " focus" : ""}`}>
            <P2Icon name="search" className="s" />
            <input
              ref={dq}
              type="text"
              autoComplete="off"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSel(0);
                setDropOpen(true);
              }}
              onFocus={() => setDropOpen(true)}
              onKeyDown={onSearchKey}
              placeholder="Søg firma, person eller CVR"
              aria-label="Søg firma, person eller CVR"
            />
            {looking ? <span className="spin" aria-label="Søger" /> : null}
            {q ? (
              <button type="button" className="clear" aria-label="Ryd" onMouseDown={(e) => e.preventDefault()} onClick={() => (resetSearch(), dq.current?.focus())}>
                <P2Icon name="x" />
              </button>
            ) : null}
          </div>
          {dropOpen && !mSearch ? (
            <div className="sdrop" onMouseDown={(e) => e.preventDefault()}>
              {resultsView(false)}
            </div>
          ) : null}
        </div>
        {open.length ? (
          <div className="toptabs" ref={toptabs} role="tablist" aria-label="Åbne firmaer og personer">
            {open.map((o) => (
              <button
                key={o.key}
                type="button"
                data-tt={o.key}
                data-menu={soloTop && o.key === active ? "" : undefined}
                className={`tt${o.key === active ? " on" : ""}${soloTop && o.key === active ? " solo" : ""}`}
                onClick={(e) => (soloTop && o.key === active ? showMenu("all", e.currentTarget) : activate(o.key))}
              >
                <span>{o.name}</span>
                {soloTop && o.key === active ? <P2Icon name="down" /> : null}
              </button>
            ))}
            <button type="button" className="tt" data-ttmore data-menu onClick={(e) => showMenu("tophidden", e.currentTarget)}>
              <span>Flere</span>
              <P2Icon name="down" />
            </button>
          </div>
        ) : null}
        <div className="right">
          <button type="button" className="ibtn" aria-label="Skift mellem lyst og mørkt tema" aria-pressed={theme === "dark"} onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <P2Icon name="theme" />
          </button>
          <button type="button" className="ibtn" aria-disabled="true" aria-label="Notifikationer (kommer senere)">
            <P2Icon name="bell" />
          </button>
          <button type="button" className="ibtn" aria-label={`Profil: ${boot.user?.name ?? "Demobruger"}`} title={boot.user?.name ?? "Demobruger"}>
            <P2Icon name="user" />
          </button>
          <button type="button" className="ibtn topmore" data-menu aria-label="Mere" onClick={(e) => showMenu("topmore", e.currentTarget, "right")}>
            <P2Icon name="dots" />
          </button>
        </div>
      </header>

      <nav className="rail" aria-label="Menu">
        <button type="button" className={`ibtn${!item ? " on" : ""}`} aria-label="Værktøjer" onClick={() => activate(null)}>
          <P2Icon name="grid" />
          <span className="tip">Værktøjer</span>
        </button>
        <button type="button" className="ibtn" aria-label="Lister" onClick={() => void openResult("Gemte sider", () => api.pages())}>
          <P2Icon name="folder" />
          <span className="tip">Lister</span>
        </button>
        <Inert icon="bolt" label="Handlinger" />
        <hr />
        <Inert icon="user" label="Profil" />
        <Inert icon="card" label="Abonnement" />
        <Inert icon="plug" label="Integrationer" />
        <Inert icon="build" label="Firma" />
        <Inert icon="layers" label="Moduler" />
        <Inert icon="users" label="Brugere" />
      </nav>

      <div className="main">
        <div className="tabsbar">
          <div className="col" ref={tabsCol}>
            <div className="otabs" ref={otabs} role="tablist" aria-label="Åbne">
              {open.map((o) => (
                <div
                  key={o.key}
                  data-key={o.key}
                  className={`otab${o.key === active ? " on" : ""}${soloTab && o.key === active ? " solo" : ""}`}
                  role="tab"
                  aria-selected={o.key === active}
                  tabIndex={0}
                  data-menu={soloTab && o.key === active ? "" : undefined}
                  onClick={(e) => (soloTab && o.key === active ? showMenu("all", e.currentTarget) : activate(o.key))}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && activate(o.key)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      closeTab(o.key);
                    }
                  }}
                >
                  {pendingKey === o.key ? <LassoMark className="mark is-busy" /> : null}
                  <span className="nm">{o.name}</span>
                  <P2Icon name="down" className="i chev" />
                  <button
                    type="button"
                    className="x"
                    aria-label={`Luk ${o.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(o.key);
                    }}
                  >
                    <P2Icon name="x" />
                  </button>
                  <span className="ttip">
                    {o.name}
                    {o.sub ? (
                      <>
                        <br />
                        <span>{o.sub}</span>
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
            <button type="button" className="openall" data-openall data-menu onClick={(e) => showMenu("hidden", e.currentTarget)}>
              <span>Flere</span>
              <P2Icon name="down" />
            </button>
          </div>
        </div>

        <div className="scrollbox">
          <div className="scroll" ref={scroller} onScroll={onScroll}>
            {item ? (
              <>
                <div className="mods">
                  <div className="col" ref={modCol}>
                    <button
                      type="button"
                      role="tab"
                      className={`tabmark${onLasso ? " on" : ""}${pendingKey === item.key ? " is-busy" : ""}`}
                      aria-selected={onLasso}
                      aria-label={pendingKey === item.key ? "Lasso henter svaret" : "Lassos svar"}
                      title={pendingKey === item.key ? "Lasso henter svaret" : "Lassos svar"}
                      disabled={!lassoAvailable}
                      onClick={() => switchTab(LASSO_TAB)}
                    >
                      <LassoMark className="mark" />
                    </button>
                    <div className="mlist" ref={mlist} role="tablist" aria-label="Moduler">
                      {tabs.map((t) => (
                        <button key={t.id} type="button" className="tab" role="tab" data-mod={t.id} aria-selected={item.tab === t.id} onClick={() => switchTab(t.id)}>
                          {t.label}
                        </button>
                      ))}
                      {tabs.length ? (
                        <button
                          type="button"
                          className="tab more"
                          data-more
                          data-menu
                          aria-expanded={menu?.kind === "more"}
                          aria-selected={hiddenMods.includes(item.tab)}
                          onClick={(e) => showMenu("more", e.currentTarget)}
                        >
                          <span>{hiddenMods.includes(item.tab) ? curLabel : "Flere"}</span>
                          <P2Icon name="down" />
                        </button>
                      ) : null}
                    </div>
                    {tabs.length ? (
                      <button
                        type="button"
                        className="sel-btn"
                        data-menu
                        style={{ display: modSelect ? "inline-flex" : "none" }}
                        aria-expanded={menu?.kind === "sel"}
                        onClick={(e) => showMenu("sel", e.currentTarget)}
                      >
                        <span>{curLabel}</span>
                        <P2Icon name="down" />
                      </button>
                    ) : null}
                    {item.kind !== "result" ? (
                      <div className="rgroup">
                        <button type="button" className="ibtn" aria-disabled="true" aria-label="Følg (kommer senere)">
                          <P2Icon name="rss" />
                        </button>
                        <button type="button" className={`ibtn${saved ? " on" : ""}`} aria-pressed={saved} aria-label={saved ? "Gemt på din liste" : "Gem på din liste"} onClick={() => void toggleSaved()}>
                          <P2Icon name="book" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}

            <div className="col content">{content}</div>
          </div>
        </div>

        {notice ? (
          <div className="notice" role="status">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Luk">
              ×
            </button>
          </div>
        ) : null}

        <div className={`ask${askOpen ? " is-open" : ""}`}>
          <form
            className="field"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <LassoMark className={`mark${pending ? " is-busy" : ""}`} />
            <input ref={askInput} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={askPlaceholder(item)} aria-label="Spørg Lasso" disabled={!boot.chat} />
            {pending ? (
              <button type="button" className="send" aria-label="Stop" onClick={stop}>
                <P2Icon name="stop" />
              </button>
            ) : (
              <button type="submit" className="send" aria-label="Send" disabled={!draft.trim()}>
                <P2Icon name="enter" />
              </button>
            )}
          </form>
          <div className="sugg">
            {sugg.map((s) => (
              <button key={s} type="button" onClick={() => void ask(s)} disabled={pending || !boot.chat}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mbar">
          <button
            type="button"
            className={`lbtn${pending ? " is-busy" : ""}`}
            aria-label="Spørg Lasso"
            onClick={() => {
              setAskOpen((o) => !o);
              setTimeout(() => askInput.current?.focus(), 0);
            }}
          >
            <LassoMark className="mark" />
          </button>
          <div className="capsule">
            <button
              type="button"
              className={`ibtn${mSearch ? " on" : ""}`}
              aria-label="Søg"
              onClick={() => {
                setMSearch(true);
                setTimeout(() => mq.current?.focus(), 30);
              }}
            >
              <P2Icon name="search" />
            </button>
            <button type="button" className={`ibtn${!item ? " on" : ""}`} aria-label="Værktøjer" onClick={() => activate(null)}>
              <P2Icon name="grid" />
            </button>
            <button type="button" className="ibtn" aria-label="Lister" onClick={() => void openResult("Gemte sider", () => api.pages())}>
              <P2Icon name="folder" />
            </button>
          </div>
        </div>
      </div>

      {menu ? (
        <div className="dd" style={{ left: menu.left, top: menu.top, position: "fixed" }}>
          {menu.kind === "hidden" || menu.kind === "all" || menu.kind === "tophidden" ? (
            <>
              {(menu.kind === "hidden" ? open.filter((o) => hiddenTabs.includes(o.key)) : menu.kind === "tophidden" ? open.filter((o) => hiddenTop.includes(o.key)) : open).map((o) => (
                <button key={o.key} type="button" className={o.key === active ? "cur" : ""} onClick={() => activate(o.key)}>
                  <span className="ic">
                    <P2Icon name={iconOf(o.kind)} />
                    <span>{o.name}</span>
                  </span>
                  {o.key === active ? (
                    <P2Icon name="check" />
                  ) : (
                    <span
                      className="ddx"
                      role="button"
                      aria-label={`Luk ${o.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu(null);
                        closeTab(o.key);
                      }}
                    >
                      <P2Icon name="x" />
                    </span>
                  )}
                </button>
              ))}
              {open.length > 1 ? (
                <>
                  <hr />
                  <button
                    type="button"
                    className="muted"
                    onClick={() => {
                      setOpen((l) => l.filter((o) => o.key === active));
                      setMenu(null);
                    }}
                  >
                    Luk alle andre faner
                  </button>
                </>
              ) : null}
            </>
          ) : menu.kind === "topmore" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setTheme((t) => (t === "dark" ? "light" : "dark"));
                  setMenu(null);
                }}
              >
                <span className="ic">
                  <P2Icon name="theme" />
                  <span>{theme === "dark" ? "Lyst tema" : "Mørkt tema"}</span>
                </span>
              </button>
              <button type="button" aria-disabled="true" onClick={() => setMenu(null)}>
                <span className="ic">
                  <P2Icon name="bell" />
                  <span>Notifikationer (kommer senere)</span>
                </span>
              </button>
              <button type="button" onClick={() => setMenu(null)}>
                <span className="ic">
                  <P2Icon name="user" />
                  <span>{boot.user?.name ?? "Demobruger"}</span>
                </span>
              </button>
            </>
          ) : item ? (
            <>
              {menu.kind === "sel" && lassoAvailable ? (
                <button type="button" className={onLasso ? "cur" : ""} onClick={() => switchTab(LASSO_TAB)}>
                  Lassos svar
                  {onLasso ? <P2Icon name="check" /> : null}
                </button>
              ) : null}
              {(menu.kind === "more" ? tabs.filter((t) => hiddenMods.includes(t.id)) : tabs).map((t) => (
                <button key={t.id} type="button" className={t.id === item.tab ? "cur" : ""} onClick={() => switchTab(t.id)}>
                  {t.label}
                  {t.id === item.tab ? <P2Icon name="check" /> : null}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {mSearch ? (
        <div className="msearch">
          <div className="bar">
            <div className="search focus">
              <P2Icon name="search" className="s" />
              <input
                ref={mq}
                type="text"
                autoComplete="off"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSel(0);
                }}
                onKeyDown={onSearchKey}
                placeholder="Firma, person eller CVR"
                aria-label="Søg"
              />
              {q ? (
                <button type="button" className="clear" aria-label="Ryd" onClick={() => (resetSearch(), mq.current?.focus())}>
                  <P2Icon name="x" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="cancel"
              onClick={() => {
                resetSearch();
                closeSearch();
              }}
            >
              Annullér
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>{resultsView(true)}</div>
        </div>
      ) : null}
    </div>
  );
}
