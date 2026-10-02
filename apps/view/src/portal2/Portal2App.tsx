import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { LassoMark, LassoView, LassoWordmark, type ActionResult, type ViewAction } from "@lasso/ui";
import { FOCUS_LABELS, isPersonFocus, PAGE_TABS, PERSON_FOCUS_LABELS, PERSON_FOCUSES, type Focus, type PersonFocus } from "@lasso/spec";
import type { Portal2Boot } from "../boot.js";
import { Text } from "../chat/ChatApp.js";
import { ChatHttpError, streamChat, type ChatState } from "../chat/stream.js";
import { PDF_SAVED, saveBlob } from "../pdfDownload.js";
import { createPortalApi, errorText, type LookupResult, type ViewResult } from "../portal/api.js";
import { entityOf, withSaved } from "../portal/data.js";
import { isFocus } from "../portal/routes.js";
import type { P2IconName } from "./icons.js";
import {
  addRecent,
  askPlaceholder,
  closeItem,
  headLines,
  LASSO_TAB,
  loadRecent,
  messageFor,
  openItem,
  saveRecent,
  searchCounts,
  searchRows,
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
import { AskField, BottomBar, DropButton, IconButton, LassoTab, MenuItem, ModuleTab, OpenTab, SearchEmpty, SearchField, SearchResultRow, SearchTabs, StatusFilterMenu, Suggestions, TopTab } from "./parts.js";
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
  const persistTheme = useRef(true);
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
  /** Fanernes bredde holdes efter et luk, til musen forlader fanebjælken (så næste kryds står samme sted). */
  const frozenTabW = useRef<number | null>(null);

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
    if (!persistTheme.current) return;
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
  const openEntity = (kind: "company" | "person", id: string, name: string, tab = "overblik", sub?: string, recentToo = true) => {
    setOpen((l) => openItem(l, { key: id, kind, name, tab, ...(sub ? { sub } : {}) }));
    activate(id);
    if (recentToo) remember({ kind, id, name, meta: sub ?? "" });
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

  // Dybe links (og designguidens rammer): /portal?aaben=CVR-1-…,CVR-3-…&fane=oekonomi åbner fanerne; den sidste er aktiv.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = (params.get("aaben") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^CVR-[134]-\d+$/i.test(x));
    const tab = params.get("fane") ?? "overblik";
    ids.forEach((id) => {
      const kind = /^CVR-[34]-/i.test(id) ? "person" : "company";
      const t = kind === "company" ? (isFocus(tab) ? tab : "overblik") : isPersonFocus(tab) ? tab : "overblik";
      openEntity(kind, id, id, t, undefined, false);
    });
    const tema = params.get("tema");
    if (tema === "dark" || tema === "light") {
      // Et tema fra adressen (designguiden) gemmes ikke som brugerens valg.
      persistTheme.current = false;
      setTheme(tema);
    }
    // Kun ved start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Åbne faner (Jakob 02.10): alle faner har samme bredde (højst 280 px, mindst 136 px), så næste fanes kryds
    // står samme sted, når man lukker flere i træk. Er der ikke plads til alle, skjules de ældste inaktive bag
    // "Flere"; står kun den aktive tilbage, bliver den selv en dropdown med alle åbne. Efter et luk holdes
    // bredden (frozenTabW), til musen forlader fanebjælken.
    const box = otabs.current;
    const col = tabsCol.current;
    if (box && col) {
      const els = [...box.children] as HTMLElement[];
      const oa = col.querySelector<HTMLElement>("[data-openall]");
      els.forEach((t) => {
        t.style.display = "";
        t.style.width = "";
        t.style.maxWidth = "";
      });
      if (oa) oa.style.display = "none";
      const cs = getComputedStyle(col);
      const avail = col.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 8;
      const n = els.length;
      const MAX = 280;
      const MIN = 136;
      let w = Math.min(MAX, Math.floor(avail / Math.max(n, 1)));
      const hide: string[] = [];
      if (n > 1 && w < MIN && oa) {
        oa.style.display = "";
        const room = avail - oa.offsetWidth - 6;
        const fit = Math.max(1, Math.floor(room / MIN));
        w = Math.min(MAX, Math.floor(room / fit));
        let visible = n;
        for (const t of els) {
          if (visible <= fit) break;
          if (t.classList.contains("on")) continue;
          t.style.display = "none";
          hide.push(t.dataset.key ?? "");
          visible--;
        }
      }
      if (frozenTabW.current) w = frozenTabW.current;
      if (n > 1) els.forEach((t) => (t.style.width = `${w}px`));
      const solo = n > 1 && hide.length === n - 1;
      if (solo) {
        if (oa) oa.style.display = "none";
        els.forEach((t) => (t.style.width = ""));
      }
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
      // Mobil (Jakob 02.10): topbjælken står altid i den samlede form (lille logo, fanerne, ikonerne), så den klapper ikke.
      setCollapsed(false);
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
          <SearchEmpty query={text} onAsk={askFromSearch} />
        </>
      );
    }
    const nouns: Record<SearchType, string> = { f: "firmaer", p: "personer" };
    const tabsEl = (
      <SearchTabs
        type={sType}
        counts={counts}
        onType={(t) => {
          setSType(t);
          setSel(0);
        }}
      />
    );
    const stat =
      sType === "f" ? (
        <StatusFilterMenu
          status={sStatus}
          open={statusOpen}
          onToggle={() => setStatusOpen((o) => !o)}
          onPick={(st) => {
            setSStatus(st);
            setStatusOpen(false);
            setSel(0);
          }}
        />
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

  const renderRow = (r: SearchRow, i: number, text: string) => (
    <SearchResultRow key={r.id} row={r} query={text} selected={i === sel} showStatus={sStatus !== "Aktive"} onHover={() => i !== sel && setSel(i)} onChoose={(tab) => choose(r, tab)} />
  );

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
          <SearchField
            value={q}
            focus={dropOpen}
            busy={looking}
            inputRef={dq}
            onChange={(v) => {
              setQ(v);
              setSel(0);
              setDropOpen(true);
            }}
            onFocus={() => setDropOpen(true)}
            onKeyDown={onSearchKey}
            onClear={() => (resetSearch(), dq.current?.focus())}
          />
          {dropOpen && !mSearch ? (
            <div className="sdrop" onMouseDown={(e) => e.preventDefault()}>
              {resultsView(false)}
            </div>
          ) : null}
        </div>
        {open.length ? (
          <div className="toptabs" ref={toptabs} role="tablist" aria-label="Åbne firmaer og personer">
            {open.map((o) => (
              <TopTab
                key={o.key}
                dataKey={o.key}
                name={o.name}
                active={o.key === active}
                solo={soloTop && o.key === active}
                onClick={(e) => (soloTop && o.key === active ? showMenu("all", e.currentTarget) : activate(o.key))}
              />
            ))}
            <DropButton label="Flere" className="tt" data={{ "data-ttmore": "" }} onClick={(e) => showMenu("tophidden", e.currentTarget)} />
          </div>
        ) : null}
        <div className="right">
          <IconButton icon="theme" label="Skift mellem lyst og mørkt tema" pressed={theme === "dark"} onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
          <IconButton icon="bell" label="Notifikationer" disabled />
          <IconButton icon="user" label={`Profil: ${boot.user?.name ?? "Demobruger"}`} />
          <IconButton icon="dots" label="Mere" className="topmore" menu onClick={(e) => showMenu("topmore", e.currentTarget, "right")} />
        </div>
      </header>

      <nav className="rail" aria-label="Menu">
        <IconButton icon="grid" label="Værktøjer" tip="Værktøjer" on={!item} onClick={() => activate(null)} />
        <IconButton icon="folder" label="Lister" tip="Lister" onClick={() => void openResult("Gemte sider", () => api.pages())} />
        <IconButton icon="bolt" label="Handlinger" tip="Handlinger" disabled />
        <hr />
        <IconButton icon="user" label="Profil" tip="Profil" disabled />
        <IconButton icon="card" label="Abonnement" tip="Abonnement" disabled />
        <IconButton icon="plug" label="Integrationer" tip="Integrationer" disabled />
        <IconButton icon="build" label="Firma" tip="Firma" disabled />
        <IconButton icon="layers" label="Moduler" tip="Moduler" disabled />
        <IconButton icon="users" label="Brugere" tip="Brugere" disabled />
      </nav>

      <div className="main">
        <div
          className="tabsbar"
          onMouseLeave={() => {
            if (!frozenTabW.current) return;
            frozenTabW.current = null;
            measure();
          }}
        >
          <div className="col" ref={tabsCol}>
            <div className="otabs" ref={otabs} role="tablist" aria-label="Åbne">
              {open.map((o) => (
                <OpenTab
                  key={o.key}
                  dataKey={o.key}
                  name={o.name}
                  sub={o.sub}
                  active={o.key === active}
                  solo={soloTab && o.key === active}
                  busy={pendingKey === o.key}
                  onSelect={(e) => (soloTab && o.key === active ? showMenu("all", e.currentTarget) : activate(o.key))}
                  onClose={() => {
                    const el = otabs.current?.querySelector<HTMLElement>(".otab");
                    if (el && !frozenTabW.current) frozenTabW.current = el.getBoundingClientRect().width;
                    closeTab(o.key);
                  }}
                />
              ))}
            </div>
            <DropButton label="Flere" className="openall" data={{ "data-openall": "" }} onClick={(e) => showMenu("hidden", e.currentTarget)} />
          </div>
        </div>

        {/* Modulrækken står uden for rulleområdet, så den ikke flytter sig, når man ruller eller trækker (bounce). */}
        {item ? (
          <>
            <div className="mods">
              <div className="col" ref={modCol}>
                <LassoTab on={onLasso} busy={pendingKey === item.key} disabled={!lassoAvailable} onClick={() => switchTab(LASSO_TAB)} />
                <div className="mlist" ref={mlist} role="tablist" aria-label="Moduler">
                  {tabs.map((t) => (
                    <ModuleTab key={t.id} id={t.id} label={t.label} selected={item.tab === t.id} onClick={() => switchTab(t.id)} />
                  ))}
                  {tabs.length ? (
                    <DropButton
                      label={hiddenMods.includes(item.tab) ? curLabel : "Flere"}
                      className="tab more"
                      data={{ "data-more": "" }}
                      expanded={menu?.kind === "more"}
                      selected={hiddenMods.includes(item.tab)}
                      onClick={(e) => showMenu("more", e.currentTarget)}
                    />
                  ) : null}
                </div>
                {tabs.length && modSelect ? <DropButton label={curLabel} className="sel-btn" expanded={menu?.kind === "sel"} onClick={(e) => showMenu("sel", e.currentTarget)} /> : null}
                {item.kind !== "result" ? (
                  <div className="rgroup">
                    <IconButton icon="rss" label="Følg" disabled />
                    <IconButton icon="book" label={saved ? "Gemt på din liste" : "Gem på din liste"} on={saved} pressed={saved} onClick={() => void toggleSaved()} />
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <div className="scrollbox">
          <div className="scroll" ref={scroller} onScroll={onScroll}>
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
          <AskField value={draft} placeholder={askPlaceholder(item)} pending={pending} disabled={!boot.chat} inputRef={askInput} onChange={setDraft} onSubmit={() => void ask(draft)} onStop={stop} />
          <Suggestions items={sugg} disabled={pending || !boot.chat} onPick={(x) => void ask(x)} />
        </div>

        <BottomBar
          busy={pending}
          searchOn={mSearch}
          homeOn={!item}
          onAsk={() => {
            setAskOpen((o) => !o);
            setTimeout(() => askInput.current?.focus(), 0);
          }}
          onSearch={() => {
            setMSearch(true);
            setTimeout(() => mq.current?.focus(), 30);
          }}
          onHome={() => activate(null)}
          onLists={() => void openResult("Gemte sider", () => api.pages())}
        />
      </div>

      {menu ? (
        <div className="dd" style={{ left: menu.left, top: menu.top, position: "fixed" }}>
          {menu.kind === "hidden" || menu.kind === "all" || menu.kind === "tophidden" ? (
            <>
              {(menu.kind === "hidden" ? open.filter((o) => hiddenTabs.includes(o.key)) : menu.kind === "tophidden" ? open.filter((o) => hiddenTop.includes(o.key)) : open).map((o) => (
                <MenuItem
                  key={o.key}
                  icon={iconOf(o.kind)}
                  label={o.name}
                  current={o.key === active}
                  onClick={() => activate(o.key)}
                  onClose={() => {
                    setMenu(null);
                    closeTab(o.key);
                  }}
                />
              ))}
              {open.length > 1 ? (
                <>
                  <hr />
                  <MenuItem
                    label="Luk alle andre faner"
                    muted
                    onClick={() => {
                      setOpen((l) => l.filter((o) => o.key === active));
                      setMenu(null);
                    }}
                  />
                </>
              ) : null}
            </>
          ) : menu.kind === "topmore" ? (
            <>
              <MenuItem
                icon="theme"
                label={theme === "dark" ? "Lyst tema" : "Mørkt tema"}
                onClick={() => {
                  setTheme((t) => (t === "dark" ? "light" : "dark"));
                  setMenu(null);
                }}
              />
              <MenuItem icon="bell" label="Notifikationer (kommer senere)" onClick={() => setMenu(null)} />
              <MenuItem icon="user" label={boot.user?.name ?? "Demobruger"} onClick={() => setMenu(null)} />
            </>
          ) : item ? (
            <>
              {menu.kind === "sel" && lassoAvailable ? <MenuItem label="Lassos svar" current={onLasso} onClick={() => switchTab(LASSO_TAB)} /> : null}
              {(menu.kind === "more" ? tabs.filter((t) => hiddenMods.includes(t.id)) : tabs).map((t) => (
                <MenuItem key={t.id} label={t.label} current={t.id === item.tab} onClick={() => switchTab(t.id)} />
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {mSearch ? (
        <div className="msearch">
          <div className="bar">
            <SearchField
              value={q}
              focus
              placeholder="Firma, person eller CVR"
              label="Søg"
              inputRef={mq}
              onChange={(v) => {
                setQ(v);
                setSel(0);
              }}
              onKeyDown={onSearchKey}
              onClear={() => (resetSearch(), mq.current?.focus())}
            />
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
