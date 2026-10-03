import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { LassoMark, LassoView, LassoWordmark, type ActionResult, type ViewAction } from "@lasso/ui";
import { isPersonFocus, pageFocus, type Focus, type PersonFocus, type ViewSpec } from "@lasso/spec";
import type { Portal2Boot } from "../boot.js";
import { ChatHttpError, streamChat, type ChatEvent, type ChoicePick } from "../chat/stream.js";
import { PDF_SAVED, saveBlob } from "../pdfDownload.js";
import { createPortalApi, errorText, retryable, type LookupResult, type PageTemplate, type ViewResult } from "../portal/api.js";
import { entityOf, withSaved } from "../portal/data.js";
import { isFocus } from "../portal/routes.js";
import type { P2IconName } from "./icons.js";
import {
  addRecent,
  askPlaceholder,
  clearCache,
  closeItem,
  contextFor,
  freeTextPick,
  historyTrimmed,
  headLines,
  isTemplateTab,
  isUnrecognizedHistory,
  LASSO_TAB,
  moduleTabs,
  templateIdOf,
  templateTab,
  loadRecent,
  CHAT_CACHE_KEY,
  openItem,
  summaryFingerprint,
  recencyOrder,
  saveRecent,
  shortName,
  searchCounts,
  searchRows,
  suggestions,
  forPortal,
  type ItemKind,
  type OpenItem,
  type RecentItem,
  type SearchRow,
  type SearchType,
  type Shown,
  type StatusFilter,
} from "./model.js";
import {
  applyTurnEvent,
  finishTurn,
  globalTitleFallback,
  moveTurn,
  pendingChoice,
  restoreCache,
  saveCache,
  serializeCache,
  skipChoice,
  startTurn,
  stopTurn,
  undoMove,
  type Notice,
  type Threads,
  type Turn,
} from "./thread.js";
import { AskField, BottomBar, DropButton, IconButton, LassoTab, MenuItem, ModuleTab, OpenTab, RemoveTemplateDialog, SearchEmpty, SearchField, SearchResultRow, SearchTabs, StatusFilterMenu, Suggestions, TemplatePin, TopTab } from "./parts.js";
import { useElasticScroll } from "./elastic.js";
import { ChoicePanel } from "./ChoicePanel.js";
import type { ViewPart } from "./chat/AnswerCard.js";
import { EmptyState } from "./chat/EmptyState.js";
import { Fullscreen } from "./chat/Fullscreen.js";
import { NoticeRow, SkeletonCard, TextLink } from "./chat/Message.js";
import { ScrollDown, Thread } from "./chat/Thread.js";
import { anchorScrollTop, canAddAsTab, moreBelow, templateTitle, type ModuleTarget } from "./chat/util.js";
import "./portal2.css";
import "./chat/chat.css";

/**
 * Den nye portal på /portal (prototypen "lasso-portal4.html"): topbjælke med søgning mens man skriver,
 * ikonskinne, faner for åbne firmaer/personer/resultater, modulrække (Lasso-mærket + fokus) og spørgefeltet.
 * Spørgefeltet er chatten (/api/chat, samme værktøjer som Claude): det, Claude henter, vises under fanen
 * med Lasso-mærket, og mærket bevæger sig, mens der hentes. Søgning og modulfaner bruger ikke AI.
 */

type Theme = "light" | "dark";
/** Menuerne: skjulte faner ("Flere"), alle faner (den aktive som dropdown), moduler og telefonens topfaner. */
type MenuKind = "hidden" | "all" | "more" | "sel" | "tophidden";
type Menu = { kind: MenuKind; left: number; top: number } | null;

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
/** Fortryd står i 10 sekunder efter en flytning. */
const UNDO_MS = 10_000;
/** Turens svar er ikke længere i gang (afbrudt, fejl eller færdig): status væk, tidspunktet sat (thread.ts settleTurn sætter ikke tidspunktet). */
function settleWithTime(t: Threads, key: string, turnId: string): Threads {
  const tab = t[key];
  if (!tab?.turns.some((x) => x.id === turnId && x.answer.pending)) return t;
  return { ...t, [key]: { ...tab, turns: tab.turns.map((x) => (x.id === turnId ? { ...x, answer: { ...x.answer, pending: false, status: undefined, at: x.answer.at ?? Date.now() } } : x)) } };
}
/** Én visning i trådene ændret (filterskift, Gem/Gemt): fn får visningen og giver den nye. */
function mapThreadViews(t: Threads, fn: (p: ViewPart) => ViewPart): Threads {
  return Object.fromEntries(Object.entries(t).map(([k, tab]) => [k, { ...tab, turns: tab.turns.map((x) => ({ ...x, answer: { ...x.answer, parts: x.answer.parts.map((p) => (p.kind === "view" ? fn(p) : p)) } })) }]));
}
const iconOf = (k: ItemKind): P2IconName => (k === "company" ? "build" : k === "person" ? "user" : "search");

export function Portal2App({ boot }: { boot: Portal2Boot }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [open, setOpen] = useState<OpenItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  /** Data pr. fane: "<id>:<modul>" for firmaer og personer, "<key>" for resultater. */
  const [shown, setShown] = useState<Record<string, Shown>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  /** Samtalen pr. fane (firmaets/personens Lasso-ID eller den globale fanes key): ture, historik og det sendte resumé. */
  const [threads, setThreadsState] = useState<Threads>({});
  const threadsRef = useRef(threads);
  const setThreads = (fn: (t: Threads) => Threads) => {
    threadsRef.current = fn(threadsRef.current);
    setThreadsState(threadsRef.current);
  };
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  /** Det element, der står i fuld skærm (fra et kort i samtalen). */
  const [fullscreen, setFullscreen] = useState<{ part: ViewPart; at?: number } | null>(null);
  /** Nu, mens et Fortryd-vindue er åbent (tikker hvert sekund). */
  const [now, setNow] = useState(() => Date.now());
  const [phone, setPhone] = useState(isPhone);
  /** Egne sider (sideskabeloner): ekstra moduler efter de indbyggede på alle virksomheder/personer af samme slags. */
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  /** Egne sider er hentet (så en fane på en fjernet egen side kan sættes tilbage). */
  const templatesLoaded = useRef(false);
  const [adding, setAdding] = useState<string | null>(null);
  /** Fejlen efter en tur, når en side ikke kunne tilføjes som modul (med "Prøv igen" ved netværks- og serverfejl). */
  const [tplNotes, setTplNotes] = useState<Record<string, { ok: boolean; text: string; retry?: () => void }>>({});
  const [confirmRemove, setConfirmRemove] = useState<PageTemplate | null>(null);
  const [jump, setJump] = useState(false);
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
  /** Først når samtalen fra lageret er lagt ind, må der gemmes igen (ellers overskrev første gemning den med tom tilstand). */
  const [hydrated, setHydrated] = useState(false);

  const persistTheme = useRef(true);
  /** Sat, når sessionen er logget ud: så gemmes samtalen ikke igen for en bruger, der ikke er logget ind (et nyt login er en ny sideindlæsning). */
  const loggedOut = useRef(false);
  /** Den tur, der hentes nu (og fanen, den står på): Fortryd afbryder den. */
  const pendingTurn = useRef<{ key: string; turnId: string } | null>(null);
  /** Brugeren står nederst i samtalen: nye beskeder ruller med. */
  const atBottom = useRef(true);
  /** Hvornår brugeren sidst rullede selv (hjul, berøring, taster, rullebjælken). */
  const userScroll = useRef(0);
  const toEnd = useRef(false);
  const askRef = useRef<HTMLDivElement>(null);
  const scrollboxRef = useRef<HTMLDivElement>(null);
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
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /** Fanernes bredde holdes efter et luk, til musen forlader fanebjælken (så næste kryds står samme sted). */
  const frozenTabW = useRef<number | null>(null);

  // Bounce i rulleområdet som i Safari, også i Chrome og Edge (elastic.ts).
  useElasticScroll(scroller, contentRef);

  const api = useMemo(
    () =>
      createPortalApi(() => {
        // Logget ud: samtalen i browseren hører til sessionen og ryddes.
        loggedOut.current = true;
        clearCache(storage());
        setNotice("Du er logget ud. Genindlæs siden.");
      }),
    [],
  );
  const item = open.find((o) => o.key === active);
  const itemRef = useRef(item);
  itemRef.current = item;
  const openRef = useRef(open);
  openRef.current = open;

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
      const r: ViewResult = isTemplateTab(tab) ? await api.templates.render(templateIdOf(tab), id) : kind === "company" ? await api.company(id, tab as Focus) : await api.person(id, tab as PersonFocus);
      put(key, { spec: r.spec, dataset: r.dataset, ...(r.summary ? { summary: r.summary } : {}) });
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
    setFullscreen(null);
    // Står fanen på Lasso, vises det nyeste (nederst); ellers modulets top.
    toEnd.current = true;
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
    setThreads((t) => {
      if (!t[key]) return t;
      const { [key]: _gone, ...rest } = t;
      return rest;
    });
  };

  const switchTab = (tab: string) => {
    if (!item || item.kind === "result") return;
    setOpen((l) => l.map((o) => (o.key === item.key ? { ...o, tab } : o)));
    setMenu(null);
    setFullscreen(null);
    toEnd.current = true;
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
    // Samtalen fra sidste besøg (docs/chat.md): faner, svar og historik, hvis den er brugerens egen og under 24 timer gammel.
    const cached = restoreCache(storage()?.getItem(CHAT_CACHE_KEY), boot.user?.id ?? "", Date.now());
    if (cached) {
      setOpen(cached.open);
      setThreads(() => cached.threads);
      if (!params.get("aaben")) setActive(cached.active);
      toEnd.current = true;
    }

    setHydrated(true);
    const ids = (params.get("aaben") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^CVR-[134]-\d+$/i.test(x));
    const tab = params.get("fane") ?? "overblik";
    ids.forEach((id) => {
      const kind = /^CVR-[34]-/i.test(id) ? "person" : "company";
      const t = kind === "company" ? (isFocus(tab) ? pageFocus(tab) : "overblik") : isPersonFocus(tab) ? tab : "overblik";
      openEntity(kind, id, id, t, undefined, false);
    });
    // ?soeg=… åbner søgningen med teksten (telefon: fuld skærm); ?spoerg=1 åbner spørgefeltet på telefon.
    const soeg = params.get("soeg");
    if (soeg) {
      setQ(soeg);
      if (isPhone()) setMSearch(true);
      else setDropOpen(true);
    }
    if (params.get("spoerg") === "1") setAskOpen(true);
    const tema = params.get("tema");
    if (tema === "dark" || tema === "light") {
      // Et tema fra adressen (designguiden) gemmes ikke som brugerens valg.
      persistTheme.current = false;
      setTheme(tema);
    }
    // Kun ved start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Samtalen gemmes i browseren, når der ikke hentes (ikke pr. tegn, mens svaret streames); kun den trimmede historik fra "done".
  useEffect(() => {
    if (!hydrated || pendingKey !== null || !boot.user || loggedOut.current) return;
    saveCache(storage(), serializeCache(boot.user.id, { threads, open, active }, Date.now()), recencyOrder(open, history, active));
  }, [hydrated, open, active, threads, pendingKey, boot.user, history]);

  // Egne sider hentes, når man er logget ind; en fane på en egen side, der er fjernet, står på Overblik.
  const reloadTemplates = useCallback(async () => {
    if (!boot.user) return;
    try {
      const [c, p] = await Promise.all([api.templates.list("company"), api.templates.list("person")]);
      templatesLoaded.current = true;
      setTemplates([...c, ...p]);
    } catch {
      // Uden egne sider er modulrækken bare de indbyggede.
    }
  }, [api, boot.user]);
  useEffect(() => void reloadTemplates(), [reloadTemplates]);
  useEffect(() => {
    if (!templatesLoaded.current) return;
    setOpen((l) => (l.some((o) => isTemplateTab(o.tab) && !templates.some((t) => t.id === templateIdOf(o.tab))) ? l.map((o) => (isTemplateTab(o.tab) && !templates.some((t) => t.id === templateIdOf(o.tab)) ? { ...o, tab: "overblik" } : o)) : l));
  }, [templates]);

  // Telefonen (760 px og derunder): kortene og afklaringen har deres mobilform.
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE);
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Fortryd: uret tikker, så længe et Fortryd-vindue står åbent.
  const undoLive = Object.values(threads).some((tab) => tab.turns.some((x) => x.notice?.kind === "moved" && x.notice.undoUntil > now));
  useEffect(() => {
    if (!undoLive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [undoLive]);

  // En fane på et modul uden data (fx genskabt fra lageret) henter det, når den vises.
  useEffect(() => {
    if (!item || item.kind === "result" || item.tab === LASSO_TAB) return;
    const key = `${item.key}:${item.tab}`;
    if (!shown[key] && !loading.has(key) && !failed[key]) void load(item.kind, item.key, item.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.key, item?.tab]);

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
    void openResult(shortName(`Søgning: ${text}`), () => api.search(text));
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

  /**
   * Ét spørgsmål til chatten (docs/chat.md). Turen lægges i samtalen på den fane, man står på (forsiden får en ny
   * global fane, foreløbig "Lasso"). Serveren afgør placeringen før svaret: "placement" med decided flytter turen
   * til en firma- eller personfane (entity) eller en global fane (global fra en firma- eller personfane), højst én
   * gang pr. tur; den gamle samtale får meddelelsesrækken med Fortryd i 10 sekunder. pick er valget fra menuen.
   */
  const ask = async (raw: string, pick?: ChoicePick) => {
    const text = raw.trim();
    if (!text || pendingKey) return;
    if (!boot.chat) {
      setNotice("Chatten er ikke slået til på serveren (ANTHROPIC_API_KEY).");
      return;
    }
    setDraft("");
    setAskOpen(false);
    setFullscreen(null);
    const here = itemRef.current;
    let key: string;
    let createdHere = false;
    if (here) key = here.key;
    else {
      key = `result:${++resultSeq.current}`;
      createdHere = true;
      setOpen((l) => [...l, { key, kind: "result", name: "Lasso", tab: LASSO_TAB }]);
      activate(key);
    }
    const tab = threadsRef.current[key];
    // Skriver brugeren selv, mens menuen står på fanen, er det fritekst til menuen (når den tillader det).
    const menu = pendingChoice(threadsRef.current, key);
    const choice = pick ?? (menu ? freeTextPick(menu) : undefined);
    // Det, brugeren ser (modulets resumé), sendes med; kun "uændret", når fanens samtale allerede har det.
    const shownNow = here && here.kind !== "result" ? shownRef.current[`${here.key}:${here.tab}`] : undefined;
    const context = contextFor(here, openRef.current, choice, shownNow, tab?.sent ?? null);
    const fingerprint = summaryFingerprint(here, shownNow);
    const sentHistory = tab?.chat.history ?? [];
    if (here && here.kind !== "result" && here.tab !== LASSO_TAB) setOpen((l) => l.map((o) => (o.key === key ? { ...o, tab: LASSO_TAB } : o)));
    const turnId = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setThreads((t) => startTurn(t, key, text, Date.now(), turnId));
    atBottom.current = true;
    toEnd.current = true;
    /** Fanen, turen står på nu (flytter ved placering). */
    let at = key;
    /** Fanens navn er valgt (title fra serveren): følger ikke længere visningerne. */
    let named = false;
    let moved = false;
    setPendingKey(key);
    pendingTurn.current = { key, turnId };
    const rename = (k: string, name: string) => setOpen((l) => l.map((o) => (o.key === k ? { ...o, name } : o)));
    /** Turen flytter til en anden fane: den åbnes (eller aktiveres), og den gamle får meddelelsesrækken. */
    const moveTo = (target: OpenItem) => {
      const from = at;
      if (from === target.key || moved) return;
      moved = true;
      const createdTab = !openRef.current.some((o) => o.key === target.key);
      const notice: Notice = { kind: "moved", name: target.name, tabKey: target.key, undoUntil: Date.now() + UNDO_MS, createdTab };
      setNow(Date.now());
      setThreads((t) => {
        const next = moveTurn(t, from, target.key, turnId, notice);
        // En global fane, der blev åbnet til netop dette spørgsmål fra forsiden, lukkes igen (den har intet andet).
        if (createdHere && from === key) {
          const { [from]: _gone, ...rest } = next;
          return rest;
        }
        return next;
      });
      setOpen((l) => openItem(createdHere && from === key ? l.filter((o) => o.key !== from) : l, target));
      at = target.key;
      setPendingKey(at);
      pendingTurn.current = { key: at, turnId };
      activate(at);
    };
    const ctrl = new AbortController();
    abort.current = ctrl;
    const onEvent = (e: ChatEvent) => {
      if (e.type === "placement" && e.decided) {
        if (e.placement === "entity" && e.target) moveTo({ key: e.target.id, kind: e.target.kind, name: e.target.name, tab: LASSO_TAB });
        else if (e.placement === "global") {
          if (e.title) named = true;
          const cur = openRef.current.find((o) => o.key === at);
          if (cur && cur.kind !== "result" && context.active.kind !== "global") moveTo({ key: `result:${++resultSeq.current}`, kind: "result", name: e.title ?? "Lasso", tab: LASSO_TAB });
          else if (e.title) rename(at, e.title);
        }
      }
      if (e.type === "placement" && e.here) {
        // "Svarer her i …": fanens eget navn, når serveren ikke sender målet med.
        const name = e.target?.name ?? openRef.current.find((o) => o.key === at)?.name ?? "";
        setThreads((t) => {
          const tabNow = t[at];
          if (!tabNow) return t;
          return { ...t, [at]: { ...tabNow, turns: tabNow.turns.map((x) => (x.id === turnId ? { ...x, notice: { kind: "here", name } } : x)) } };
        });
      }
      if (e.type === "view") {
        // Fanens navn følger det hentede: firmaets/personens navn, eller et generisk navn på en global fane.
        const ent = entityOf(e.spec, e.dataset);
        const cur = openRef.current.find((o) => o.key === at);
        if (cur && ent && ent.id === at) rename(at, ent.name);
        else if (cur?.kind === "result" && !named) {
          named = true;
          rename(at, globalTitleFallback(e.name, e.spec));
        }
      }
      // Placeringen er et internt skridt: Lasso "tænker" stadig (ingen statuslinje for place_answer).
      if (e.type === "tool" && e.name === "place_answer") return;
      if (e.type === "done") {
        if (e.placement.title && openRef.current.find((o) => o.key === at)?.kind === "result") rename(at, e.placement.title);
        // Ny samtale (flyttet) eller trimmet historik: næste gang sendes det fulde resumé.
        const sent = e.fresh || moved || historyTrimmed(sentHistory, e.history) ? null : (fingerprint ?? undefined);
        setThreads((t) => finishTurn(t, at, { ...e, sent, at: Date.now() }));
        return;
      }
      setThreads((t) => applyTurnEvent(t, at, turnId, e));
    };
    try {
      await streamChat({ message: text, context, history: tab?.chat.history ?? [], sig: tab?.chat.sig }, onEvent, { signal: ctrl.signal });
      // Stop (eller Fortryd/luk, hvor turen allerede er væk): streamChat vender stille tilbage; turen får "Stoppet.".
      if (ctrl.signal.aborted) setThreads((t) => stopTurn(t, at, turnId, Date.now()));
    } catch (e) {
      if (ctrl.signal.aborted) {
        setThreads((t) => stopTurn(t, at, turnId, Date.now()));
        return;
      }
      // Serveren kender ikke fanens samtale (ændret historik eller signatur): begynd en ny, så brugeren ikke sidder fast.
      if (e instanceof ChatHttpError && isUnrecognizedHistory(e.status, e.message)) {
        setThreads((t) => (t[at] ? { ...t, [at]: { ...t[at]!, chat: { history: [] }, sent: null } } : t));
      }
      if (e instanceof ChatHttpError && e.status === 401) {
        // Sessionen er udløbet: samtalen ryddes og gemmes ikke igen.
        loggedOut.current = true;
        clearCache(storage());
      }
      const message = e instanceof ChatHttpError && e.status === 401 ? "Chatten kræver login. Log ind i portalen og prøv igen." : errorText(e);
      setThreads((t) => applyTurnEvent(t, at, turnId, { type: "error", message }));
    } finally {
      setThreads((t) => settleWithTime(t, at, turnId));
      setPendingKey(null);
      pendingTurn.current = null;
      abort.current = null;
    }
  };

  const stop = () => abort.current?.abort();

  /** Fortryd i den gamle samtale: hentningen stoppes, den nye fane lukkes (eller mister turen), og man står tilbage. */
  const undo = (from: string, turn: Turn) => {
    if (pendingTurn.current?.turnId === turn.id) abort.current?.abort();
    const r = undoMove(threadsRef.current, from, turn.id);
    setThreads(() => r.threads);
    if (r.closeKey) {
      const gone = r.closeKey;
      setOpen((l) => l.filter((o) => o.key !== gone));
      setHistory((h) => h.filter((k) => k !== gone));
    }
    setOpen((l) => l.map((o) => (o.key === from && o.kind !== "result" ? { ...o, tab: LASSO_TAB } : o)));
    activate(from);
  };

  /** Et modul-link i svaret: et modul på fanen, eller et firma/en person som (ny) fane. */
  const openModule = (target: ModuleTarget, text: string) => {
    const it = itemRef.current;
    if (target.kind === "modul") {
      if (it && it.kind !== "result" && (it.kind === "company" ? isFocus(target.focus) : isPersonFocus(target.focus))) switchTab(it.kind === "company" ? pageFocus(target.focus as Focus) : target.focus);
      else setNotice("Modulet findes ikke på denne fane.");
      return;
    }
    openEntity(target.kind === "firma" ? "company" : "person", target.id, text);
  };

  /** "Tilføj som fane" på en side om fanens firma eller person: gemmes som modul på alle af samme slags og vises. */
  const addTemplate = async (part: ViewPart, turnId: string) => {
    const it = itemRef.current;
    if (!it || it.kind === "result" || adding) return;
    setAdding(part.id);
    setTplNotes((n) => {
      const { [turnId]: _old, ...rest } = n;
      return rest;
    });
    try {
      const tpl = await api.templates.save({ kind: it.kind, title: templateTitle(part.spec, entityOf(part.spec, part.dataset)?.name ?? it.name), spec: part.spec, entity: { kind: it.kind, id: it.key } });
      setTemplates((t) => [...t.filter((x) => x.id !== tpl.id), tpl]);
      // Ingen meddelelsesrække: den røde pin på det nye modul er bekræftelsen (Jakob 03.10).
      setOpen((l) => l.map((o) => (o.key === it.key ? { ...o, tab: templateTab(tpl.id) } : o)));
      void load(it.kind, it.key, templateTab(tpl.id), true);
    } catch (e) {
      setTplNotes((n) => ({ ...n, [turnId]: { ok: false, text: errorText(e), ...(retryable(e) ? { retry: () => void addTemplate(part, turnId) } : {}) } }));
    } finally {
      setAdding(null);
    }
  };

  /** Den røde nål bekræftet: skabelonen fjernes, og faner på modulet går tilbage til Overblik. */
  const removeTemplate = async (tpl: PageTemplate) => {
    setConfirmRemove(null);
    try {
      await api.templates.remove(tpl.id);
      // Faner på modulet går tilbage til Overblik (effekten ovenfor), som henter sig selv, når den vises.
      setTemplates((t) => t.filter((x) => x.id !== tpl.id));
    } catch (e) {
      setNotice(errorText(e));
    }
  };

  /** PDF af en visning fra samtalen (kortets download og fuld skærm). */
  const downloadPart = async (spec: ViewSpec) => {
    try {
      const file = await api.pdfSpec(spec);
      saveBlob(file.blob, file.filename);
    } catch (e) {
      setNotice(errorText(e));
    }
  };

  /* ---------- det, der vises nu ---------- */

  const onLasso = item ? item.kind === "result" || item.tab === LASSO_TAB : false;
  const tabChat = item ? threads[item.key] : undefined;
  const turns = tabChat?.turns ?? [];
  const choiceNow = item ? pendingChoice(threads, item.key) : undefined;
  const dataKey = item ? (item.kind === "result" ? item.key : `${item.key}:${item.tab}`) : null;
  /** Det, modulet (eller den globale fanes resultat) viser; på Lasso har kortene hver deres visning. */
  const current: Shown | undefined = item && dataKey && (item.kind === "result" || item.tab !== LASSO_TAB) ? shown[dataKey] : undefined;
  const headData = item && item.kind !== "result" ? (shown[`${item.key}:overblik`]?.dataset ?? current?.dataset) : undefined;
  const lines = item ? headLines(item.kind, item.key, headData) : [];
  const saved = Boolean(item && item.kind !== "result" && (headData?.savedIds?.includes(item.key) || current?.dataset.savedIds?.includes(item.key)));
  const busy = dataKey ? loading.has(dataKey) : false;
  const err = dataKey ? failed[dataKey] : "";
  const pending = pendingKey !== null;
  const tabs = item ? moduleTabs(item.kind, templates) : [];
  const activeTemplate = item && item.kind !== "result" && isTemplateTab(item.tab) ? templates.find((t) => t.kind === item.kind && t.id === templateIdOf(item.tab)) : undefined;
  const curLabel = item ? (onLasso ? "Lasso" : (tabs.find((t) => t.id === item.tab)?.label ?? "")) : "";

  // Sub-linjen i fanens tooltip og i mobilarket, når data kommer.
  useEffect(() => {
    if (!item || item.kind === "result" || item.sub || !lines.length) return;
    const sub = lines.join(", ");
    setOpen((l) => l.map((o) => (o.key === item.key ? { ...o, sub } : o)));
  }, [item?.key, lines.join("|")]);

  /** Den visning, en handling virker på: modulets (eller resultatets), eller et kort i samtalen. */
  type ActionTarget = { shown: Shown; replace: (r: Shown) => void; pdf: () => Promise<{ blob: Blob; filename: string }> };
  const moduleTarget: ActionTarget | undefined =
    current && item && dataKey
      ? {
          shown: current,
          replace: (r) => put(dataKey, r),
          pdf: () =>
            item.kind !== "result" && !isTemplateTab(item.tab) ? (item.kind === "company" ? api.pdfCompany(item.key, item.tab as Focus) : api.pdfPerson(item.key, item.tab as PersonFocus)) : api.pdfSpec(current.spec),
        }
      : undefined;
  const partTarget = (part: ViewPart): ActionTarget => ({
    shown: part,
    replace: (r) => setThreads((t) => mapThreadViews(t, (p) => (p.id === part.id ? { ...p, ...r } : p))),
    pdf: () => api.pdfSpec(part.spec),
  });

  const patchSaved = (lassoId: string, on: boolean) => {
    setShown((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, dataset: withSaved(v.dataset, lassoId, on) }])));
    setThreads((t) => mapThreadViews(t, (p) => ({ ...p, dataset: withSaved(p.dataset, lassoId, on) })));
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

  const onAction = async (a: ViewAction, target: ActionTarget | undefined = moduleTarget): Promise<ActionResult | void> => {
    const current = target?.shown;
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
          target?.replace({ spec: r.spec, dataset: r.dataset });
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
          if (!target) return;
          const file = await target.pdf();
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
    // Åbne faner (Jakob 02.10): alle faner har samme bredde (højst 170 px, mindst 120 px), så næste fanes kryds
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
      // Jakob 02.10: omtrent 170 px pr. fane, når der er flere åbne (ikke hele bjælken); mindst 120 før "Flere".
      const MAX = 170;
      const MIN = 120;
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
    // Telefon: de åbne faner i topbjælken (aktive først, ældste skjules).
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
  }, [measure, open, active, item?.tab, templates.length]);

  useEffect(() => {
    const onResize = () => {
      measure();
      setMenu(null);
    };
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener("resize", onResize);
  }, [measure]);

  /** Det nyeste i samtalen: brugerens seneste spørgsmål øverst i det synlige (anchorScrollTop); uden ture bunden. */
  const latestTop = (sc: HTMLElement): number => {
    const turnsEl = sc.querySelectorAll<HTMLElement>(".chat-turn");
    const last = turnsEl[turnsEl.length - 1];
    const q = last?.querySelector<HTMLElement>(".chat-msg--user") ?? last;
    const box = { viewTop: sc.getBoundingClientRect().top, scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight };
    return q ? anchorScrollTop({ ...box, anchorTop: q.getBoundingClientRect().top }) : Math.max(0, box.scrollHeight - box.clientHeight);
  };
  /** Rullepositionen pr. fane og modul (og antallet af ture dengang): en fane, man vender tilbage til, står, som man forlod den. */
  const scrollPos = useRef(new Map<string, { top: number; turns: number }>());
  const viewKey = useRef("");
  viewKey.current = item ? `${item.key}:${item.tab}` : "";
  /** En gemt position, der venter på, at indholdet (kortenes visninger) er højt nok igen; brugerens egen rulning afbryder. */
  const restoreTo = useRef<{ top: number; until: number } | null>(null);
  const turnCount = useRef(0);
  turnCount.current = item ? (threads[item.key]?.turns.length ?? 0) : 0;
  const syncJump = (sc: HTMLElement) => {
    const more = moreBelow(sc);
    setJump((j) => (j === more ? j : more));
  };

  /**
   * Rulning: kun skyggen under modulrækken på desktop (klassen "scrolled"), sat direkte på roden uden React-
   * tilstand, så rulning og iPhones bounce ikke gentegner portalen (det fik siden til at hakke).
   */
  const onScroll = () => {
    const sc = scroller.current;
    const root = rootRef.current;
    if (!sc || !root) return;
    const on = !isPhone() && sc.scrollTop > 4;
    if (root.classList.contains("scrolled") !== on) root.classList.toggle("scrolled", on);
    // Samtalen ruller selv med, så længe brugeren står ved det nyeste (nederst, eller i den nyeste tur); rullet op
    // vises "Rul til nyeste". Også når rulningen kommer fra portalen selv, så et hændelsesløb ikke slår følgningen fra.
    const bottom = !moreBelow(sc);
    // Kun brugerens egen rulning (hjul, træk, taster) ændrer følgningen; portalens rulning og indhold, der skifter, gør ikke.
    const user = Date.now() - userScroll.current < 800;
    if (user) {
      atBottom.current = bottom || Math.abs(sc.scrollTop - latestTop(sc)) <= 8;
      restoreTo.current = null;
    } else if (restoreTo.current) {
      // Lige efter et fanebyt flytter browseren (scroll anchoring, kort, der måler sig selv) positionen; den sættes igen.
      if (Date.now() > restoreTo.current.until) restoreTo.current = null;
      else if (Math.abs(sc.scrollTop - restoreTo.current.top) > 1) {
        sc.scrollTop = restoreTo.current.top;
        return;
      }
    }
    // Mens en gemt position venter på indholdet, er rulningen portalens (klemt af en kortere side), ikke en ny position.
    if (viewKey.current && restoreTo.current === null) scrollPos.current.set(viewKey.current, { top: sc.scrollTop, turns: turnCount.current });
    if (jump === bottom) setJump(!bottom);
  };

  const markUserScroll = () => {
    userScroll.current = Date.now();
  };

  const scrollToEnd = (smooth = false) => {
    const sc = scroller.current;
    if (!sc) return;
    sc.scrollTo({ top: sc.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    atBottom.current = true;
    setJump(false);
  };

  /**
   * Forankring, mens svaret kommer og når det er færdigt: brugerens spørgsmål står øverst, svarets tekst og kortets top
   * under det; et langt kort følges ikke ned. Har brugeren selv rullet, bliver positionen stående.
   */
  function follow() {
    const sc = scroller.current;
    if (!sc || !onLasso) return;
    if (restoreTo.current && Date.now() <= restoreTo.current.until) {
      if (Math.abs(sc.scrollTop - restoreTo.current.top) > 1) sc.scrollTop = restoreTo.current.top;
    } else if (atBottom.current) {
      const target = latestTop(sc);
      if (Math.abs(target - sc.scrollTop) > 1) sc.scrollTop = target;
    }
    syncJump(sc);
  }

  // Ny fane eller nyt modul: Lasso viser det nyeste (nederst), et modul sin top. Nye beskeder ruller med, når man står nederst.
  useLayoutEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    if (toEnd.current) {
      toEnd.current = false;
      if (onLasso) {
        // Tilbage til en fane: samme sted som da man forlod den, med mindre der er kommet ture til siden.
        const saved = scrollPos.current.get(viewKey.current);
        const anchor = latestTop(sc);
        restoreTo.current = null;
        if (saved && saved.turns === turnCount.current) {
          sc.scrollTop = saved.top;
          // De første 800 ms holdes positionen, mens kortene måler sig selv og browseren justerer rulningen.
          restoreTo.current = { top: saved.top, until: Date.now() + 800 };
          atBottom.current = Math.abs(saved.top - anchor) <= 8;
        } else {
          sc.scrollTop = anchor;
          atBottom.current = true;
        }
        syncJump(sc);
      } else {
        sc.scrollTo({ top: 0 });
        setJump(false);
      }
    } else follow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, active, item?.tab, onLasso, tplNotes]);

  // Visningerne i kortene vokser efter tegningen (målt layout, data): følg også med, når indholdet bliver højere.
  const followRef = useRef(follow);
  followRef.current = follow;
  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => followRef.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spørgefeltets top (eller afklaringens) målt fra bunden: trådens luft forneden og "Rul til nyeste" står over det.
  useLayoutEffect(() => {
    const box = scrollboxRef.current;
    const askEl = askRef.current;
    const root = rootRef.current;
    if (!box || !askEl || !root) return;
    const set = () => {
      const first = [...askEl.children].find((c) => (c as HTMLElement).offsetParent !== null) as HTMLElement | undefined;
      if (!first) return;
      const top = Math.round(box.getBoundingClientRect().bottom - first.getBoundingClientRect().top);
      if (top > 0) root.style.setProperty("--ask-top", `${top}px`);
    };
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(askEl);
    ro.observe(box);
    return () => ro.disconnect();
  });

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
  /** Tom tilstand på Lasso: ingen ture og intet resultat. Forslagene står så som piller, ikke under feltet. */
  let empty = false;
  const host = (page: boolean) => ({ prompt: true, save: true, refine: true, drillDown: true, refresh: true, export: true, pdf: boot.pdf !== false, openFocus: page, openSection: page });
  if (!item) {
    content = (
      <div className="home">
        <LassoMark className={`home__mark${pending ? " is-busy" : ""}`} />
        <h1>Hvad vil du vide?</h1>
        <p>Søg efter et firma eller en person ovenfor, eller spørg Lasso nedenfor. Svaret vises her.</p>
      </div>
    );
  } else {
    const lassoView = (key: string, shownNow: Shown, page: boolean) => {
      const spec = forPortal(shownNow.spec, { head: item.kind === "result" });
      return (
        <div className="view" key={key}>
          <LassoView key={`${key}:${spec.title}:${spec.components.length}`} spec={spec} dataset={shownNow.dataset} theme={theme} frameless page={page} host={host(item.kind !== "result")} onAction={(a) => onAction(a)} />
        </div>
      );
    };
    const skeleton = (
      <div className="mod-skel" aria-label="Henter">
        <span className="lasso-skeleton" />
        <span className="lasso-skeleton" />
        <span className="lasso-skeleton" />
      </div>
    );
    if (onLasso) {
      // Lasso-modulet: fanens samtale (en global fane fra søgningen eller Lister viser først sit resultat).
      empty = !turns.length && !current && !busy && !err;
      const entityPage = (part: ViewPart) => canAddAsTab(part, item);
      const turnOf = (part: ViewPart) => turns.find((x) => x.answer.parts.includes(part));
      content = empty ? (
        <EmptyState name={item.name} kind={item.kind === "result" ? "global" : item.kind} suggestions={suggestions(item)} disabled={pending || !boot.chat} onPick={(x) => void ask(x)} />
      ) : (
        <div className="chat">
          {err ? <p className="chat-error">{err}</p> : current ? lassoView(item.key, current, false) : busy ? <SkeletonCard /> : null}
          <Thread
            turns={turns}
            now={now}
            mobile={phone}
            currentId={item.kind !== "result" ? item.key : undefined}
            onModule={openModule}
            onStop={stop}
            onRetry={(turn) => void ask(turn.question)}
            onUndo={(turn) => undo(item.key, turn)}
            cardProps={(part) => ({
              headless: item.kind !== "result",
              theme,
              host: host(false),
              onAction: (a) => onAction(a, partTarget(part)),
              onDownload: boot.pdf !== false ? () => void downloadPart(part.spec) : undefined,
              onFullscreen: () => setFullscreen({ part, at: turnOf(part)?.answer.at }),
              onAddTab: entityPage(part) ? () => void addTemplate(part, turnOf(part)?.id ?? "") : undefined,
              adding: adding === part.id,
            })}
            afterTurn={(turn) => {
              const note = tplNotes[turn.id];
              if (!note) return null;
              return note.ok ? (
                <NoticeRow text={note.text} />
              ) : (
                <div className="chat-after">
                  <div className="chat-body">
                    <p className="chat-error">
                      {note.text}{" "}
                      {note.retry ? <TextLink onClick={note.retry}>Prøv igen</TextLink> : null}
                    </p>
                  </div>
                </div>
              );
            }}
          />
        </div>
      );
    } else {
      content = (
        <>
          {err ? (
            <p className="mod-error" role="alert">
              {err}
            </p>
          ) : current ? (
            lassoView(dataKey ?? item.key, current, item.kind !== "result")
          ) : busy ? (
            skeleton
          ) : null}
          <div className="end" />
        </>
      );
    }
  }

  const sugg = suggestions(item);
  /** Forslagene under feltet: ikke i tom tilstand (de står som piller), ikke i fuld skærm, og på telefonen ikke ved afklaring eller kort. */
  const lastTurn = turns.at(-1);
  const hideSugg = (onLasso && empty) || Boolean(fullscreen) || (phone && onLasso && (Boolean(choiceNow) || Boolean(lastTurn?.answer.parts.some((p) => p.kind === "view"))));
  const chatOn = Boolean(item && onLasso);

  return (
    <div ref={rootRef} className="p3 lasso-root" data-theme={theme}>
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
                  kind={o.kind}
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
                <LassoTab on={onLasso} busy={pendingKey === item.key} onClick={() => (item.kind === "result" ? undefined : switchTab(LASSO_TAB))} />
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
                {tabs.length && modSelect ? <DropButton label={onLasso ? (tabs[0]?.label ?? "") : curLabel} className={`sel-btn${onLasso ? " is-off" : ""}`} expanded={menu?.kind === "sel"} onClick={(e) => showMenu("sel", e.currentTarget)} /> : null}
                {item.kind !== "result" ? (
                  <div className="rgroup">
                    {activeTemplate ? <TemplatePin kind={activeTemplate.kind} title={activeTemplate.title} onClick={() => setConfirmRemove(activeTemplate)} /> : null}
                    <IconButton icon="rss" label="Følg" disabled />
                    <IconButton icon="book" label={saved ? "Gemt på din liste" : "Gem på din liste"} on={saved} pressed={saved} onClick={() => void toggleSaved()} />
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <div className="scrollbox" ref={scrollboxRef}>
          <div
            className="scroll"
            ref={scroller}
            onScroll={onScroll}
            onWheel={markUserScroll}
            onTouchMove={markUserScroll}
            onPointerDown={markUserScroll}
            onKeyDown={markUserScroll}
          >
            <div className={`col content${chatOn ? " is-chat" : ""}`} ref={contentRef}>
              {content}
            </div>
          </div>
          {chatOn && jump && !fullscreen && turns.length ? <ScrollDown onClick={() => scrollToEnd(true)} /> : null}
          {fullscreen && chatOn ? (
            <Fullscreen
              part={fullscreen.part}
              at={fullscreen.at}
              headless={item?.kind !== "result"}
              mobile={phone}
              theme={theme}
              host={host(false)}
              onAction={(a) => onAction(a, partTarget(fullscreen.part))}
              onDownload={boot.pdf !== false ? () => void downloadPart(fullscreen.part.spec) : undefined}
              onClose={() => setFullscreen(null)}
            />
          ) : null}
        </div>

        {notice ? (
          <div className="notice" role="status">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Luk">
              ×
            </button>
          </div>
        ) : null}

        <div ref={askRef} className={`ask${askOpen ? " is-open" : ""}${chatOn ? " is-chat" : ""}${hideSugg ? " no-sugg" : ""}`}>
          {choiceNow && item ? (
            // Afklaringen over feltet (docs/chat.md); "Spring over" lukker den uden at sende noget.
            <ChoicePanel
              choice={choiceNow}
              disabled={pending}
              variant={phone ? "sheet" : "panel"}
              onSend={(message, pick) => void ask(message, pick)}
              onSkip={() => setThreads((t) => skipChoice(t, item.key))}
            />
          ) : null}
          <AskField value={draft} placeholder={askPlaceholder(item)} pending={pending} disabled={!boot.chat} inputRef={askInput} onChange={setDraft} onSubmit={() => void ask(draft)} />
          {hideSugg ? null : <Suggestions items={sugg} disabled={pending || !boot.chat} onPick={(x) => void ask(x)} />}
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
          ) : item ? (
            <>
              {menu.kind === "sel" ? <MenuItem label="Lasso" current={onLasso} onClick={() => switchTab(LASSO_TAB)} /> : null}
              {(menu.kind === "more" ? tabs.filter((t) => hiddenMods.includes(t.id)) : tabs).map((t) => (
                <MenuItem key={t.id} label={t.label} current={t.id === item.tab} onClick={() => switchTab(t.id)} />
              ))}
            </>
          ) : null}
        </div>
      ) : null}

      {confirmRemove ? (
        <RemoveTemplateDialog open kind={confirmRemove.kind} title={confirmRemove.title} onCancel={() => setConfirmRemove(null)} onConfirm={() => void removeTemplate(confirmRemove)} />
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
