import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LassoMark, LassoView, LassoWordmark, type ActionResult, type ViewAction } from "@lasso/ui";
import { FOCUS_LABELS, isPersonFocus, PAGE_TABS, PERSON_FOCUS_LABELS, PERSON_FOCUSES, type Focus, type PersonFocus } from "@lasso/spec";
import type { Portal2Boot } from "../boot.js";
import { Text } from "../chat/ChatApp.js";
import { ChatHttpError, streamChat, type ChatState } from "../chat/stream.js";
import { PDF_SAVED, saveBlob } from "../pdfDownload.js";
import { createPortalApi, errorText, type ViewResult } from "../portal/api.js";
import { entityOf, withSaved } from "../portal/data.js";
import { isFocus } from "../portal/routes.js";
import { P2Icon, type P2IconName } from "./icons.js";
import { askPlaceholder, headLines, LASSO_TAB, messageFor, suggestions, withoutHead, type Answer, type EntityKind, type Page, type Shown } from "./model.js";
import "./portal2.css";

/**
 * Den nye portal på /portal (prototypen "lasso-portal - new.html"): topbjælke med søgning, ikonskinne,
 * virksomhedens/personens hoved med modulfaner og spørgefeltet nederst. Spørgefeltet er chatten
 * (/api/chat, samme værktøjer som Claude): det, Claude henter, vises i grænsefladen under fanen
 * med Lasso-mærket, og mærket bevæger sig, mens der hentes. De andre faner er sidens faste fokus.
 */

type Theme = "light" | "dark";

const COMPANY_TABS = PAGE_TABS.map((f) => ({ id: f as string, label: FOCUS_LABELS[f] }));
const PERSON_TABS = PERSON_FOCUSES.map((f) => ({ id: f as string, label: PERSON_FOCUS_LABELS[f] }));
const SECTION_FOCUS: Record<string, string> = { ejerdiagram: "ejerskab", regnskabsanalyse: "oekonomi", noegletal: "oekonomi" };

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem("lasso-theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    // Ingen lager (privat vindue): følg systemet.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function Inert({ icon, label }: { icon: P2IconName; label: string }) {
  return (
    <button type="button" className="p2-ibtn" aria-disabled="true" aria-label={`${label} (kommer senere)`}>
      <P2Icon name={icon} />
      <span className="p2-tip">{label}</span>
    </button>
  );
}

export function Portal2App({ boot }: { boot: Portal2Boot }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [page, setPage] = useState<Page>({ kind: "home" });
  const [back, setBack] = useState<Page[]>([]);
  /** Sidernes data: "<id>:<fane>" for virksomheder/personer, "result" for søgning og lister. */
  const [shown, setShown] = useState<Record<string, Shown>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState<Answer | null>(null);
  /** Hvilken side svaret hører til: virksomhedens/personens Lasso-ID eller "result". */
  const [answerFor, setAnswerFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const chat = useRef<ChatState>({ history: [] });
  const lastEntity = useRef<string | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);
  const askInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // Hændelserne fra chatten kommer efter renderingen; de læser siden, som den er nu.
  const pageRef = useRef(page);
  pageRef.current = page;
  const answerForRef = useRef(answerFor);
  answerForRef.current = answerFor;

  const api = useMemo(() => createPortalApi(() => setNotice("Du er logget ud. Genindlæs siden.")), []);

  useEffect(() => {
    document.title = "Lasso";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem("lasso-theme", theme);
    } catch {
      // Uden lager huskes temaet bare ikke.
    }
  }, [theme]);

  const keyOf = (p: Page): string | null => (p.kind === "entity" ? `${p.id}:${p.tab}` : p.kind === "result" ? "result" : null);

  const go = (next: Page, remember = true) => {
    if (remember) setBack((b) => [...b.slice(-20), page]);
    setPage(next);
    setAskOpen(false);
    setSearchOpen(false);
    scroller.current?.scrollTo({ top: 0 });
  };

  const put = (key: string, r: Shown) => setShown((s) => ({ ...s, [key]: r }));

  /** Henter en fane (fokus) for en virksomhed eller person, hvis den ikke allerede er hentet. */
  const load = async (kind: EntityKind, id: string, tab: string, force = false) => {
    const key = `${id}:${tab}`;
    if (!force && shown[key]) return;
    setLoading(key);
    setFailed((f) => ({ ...f, [key]: "" }));
    try {
      const r: ViewResult = kind === "company" ? await api.company(id, tab as Focus) : await api.person(id, tab as PersonFocus);
      put(key, { spec: r.spec, dataset: r.dataset });
      // Siden blev åbnet med CVR eller navn: brug det kanoniske ID og navnet fra data.
      const ent = entityOf(r.spec, r.dataset);
      if (ent) setPage((p) => (p.kind === "entity" && p.id === id ? { ...p, name: ent.name } : p));
    } catch (e) {
      setFailed((f) => ({ ...f, [key]: errorText(e) }));
    } finally {
      setLoading((l) => (l === key ? null : l));
    }
  };

  const openEntity = (kind: EntityKind, id: string, name: string, tab = "overblik") => {
    go({ kind: "entity", entity: kind, id, name, tab });
    void load(kind, id, tab);
  };

  const switchTab = (tab: string) => {
    if (page.kind !== "entity") return;
    setPage({ ...page, tab });
    if (tab !== LASSO_TAB) void load(page.entity, page.id, tab);
  };

  const showResult = async (title: string, fetcher: () => Promise<ViewResult>) => {
    go({ kind: "result", title });
    setAnswerFor(null);
    setLoading("result");
    setFailed((f) => ({ ...f, result: "" }));
    try {
      const r = await fetcher();
      put("result", { spec: r.spec, dataset: r.dataset });
    } catch (e) {
      setFailed((f) => ({ ...f, result: errorText(e) }));
    } finally {
      setLoading((l) => (l === "result" ? null : l));
    }
  };

  /**
   * Søgefeltet: et navn eller CVR-nummer åbner virksomhedens side på Overblik (serveren vælger det bedste
   * match). Findes ingen virksomhed, eller er det en beskrivelse ("revisorer i Aarhus"), vises søgningen.
   */
  const search = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    setSearchOpen(false);
    setLoading("search");
    try {
      const r = await api.company(text, "overblik");
      const ent = entityOf(r.spec, r.dataset);
      if (ent) {
        put(`${ent.id}:overblik`, { spec: r.spec, dataset: r.dataset });
        go({ kind: "entity", entity: "company", id: ent.id, name: ent.name, tab: "overblik" });
        setQuery("");
        return;
      }
    } catch {
      // Intet navnematch: vis søgningen i stedet.
    } finally {
      setLoading((l) => (l === "search" ? null : l));
    }
    void showResult(`Søgning: ${text}`, () => api.search(text));
  };

  const openLists = () => void showResult("Gemte sider", () => api.pages());

  /** Spørgefeltet: chatten. Svaret vises under Lasso-fanen på den side, Claude henter. */
  const ask = async (raw: string) => {
    const text = raw.trim();
    if (!text || answer?.pending) return;
    if (!boot.chat) {
      setNotice("Chatten er ikke slået til på serveren (ANTHROPIC_API_KEY).");
      return;
    }
    setDraft("");
    setAskOpen(false);
    const message = messageFor(text, page, lastEntity.current);
    setAnswer({ question: text, text: "", pending: true });
    if (page.kind === "entity") {
      setAnswerFor(page.id);
      setPage({ ...page, tab: LASSO_TAB });
    } else {
      setAnswerFor("result");
      go({ kind: "result", title: text });
      setShown((s) => {
        const { result: _drop, ...rest } = s;
        return rest;
      });
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      await streamChat(
        { message, history: chat.current.history, sig: chat.current.sig },
        (e) => {
          switch (e.type) {
            case "text":
              setAnswer((a) => (a ? { ...a, text: a.text + e.text } : a));
              break;
            case "tool":
              setAnswer((a) => (a ? { ...a, status: `${e.title} …` } : a));
              break;
            case "tool_error":
              setAnswer((a) => (a ? { ...a, status: undefined } : a));
              break;
            case "view": {
              const view = { spec: e.spec, dataset: e.dataset };
              const ent = entityOf(e.spec, e.dataset);
              setAnswer((a) => (a ? { ...a, view, status: undefined } : a));
              if (ent) {
                lastEntity.current = ent.id;
                setAnswerFor(ent.id);
                const p = pageRef.current;
                if (p.kind === "entity" && p.id === ent.id) setPage({ ...p, name: ent.name, tab: LASSO_TAB });
                else {
                  // Spurgte man fra forsiden, er "tilbage" forsiden; ellers den side, man stod på.
                  if (p.kind !== "result" || answerForRef.current !== "result") setBack((b) => [...b.slice(-20), p]);
                  setPage({ kind: "entity", entity: ent.kind, id: ent.id, name: ent.name, tab: LASSO_TAB });
                }
              } else {
                setAnswerFor("result");
                put("result", view);
                setPage((p) => (p.kind === "result" ? { ...p, title: e.spec.title } : { kind: "result", title: e.spec.title }));
              }
              break;
            }
            case "error":
              setAnswer((a) => (a ? { ...a, error: e.message, status: undefined } : a));
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
      setAnswer((a) => (a ? { ...a, error: msg } : a));
    } finally {
      setAnswer((a) => (a ? { ...a, pending: false, status: undefined } : a));
      abort.current = null;
    }
  };

  const stop = () => abort.current?.abort();

  const newConversation = () => {
    stop();
    chat.current = { history: [] };
    lastEntity.current = undefined;
    setAnswer(null);
    setAnswerFor(null);
    go({ kind: "home" });
  };

  /* ---------- det, der vises nu ---------- */

  const key = keyOf(page);
  const onLassoTab = page.kind === "result" || (page.kind === "entity" && page.tab === LASSO_TAB);
  const answerHere = answer && ((page.kind === "entity" && answerFor === page.id) || (page.kind === "result" && answerFor === "result")) ? answer : null;
  const current: Shown | undefined = page.kind === "entity" && page.tab === LASSO_TAB ? answerHere?.view : key ? shown[key] : undefined;
  const headData = page.kind === "entity" ? (shown[`${page.id}:overblik`]?.dataset ?? (answerFor === page.id ? answer?.view?.dataset : undefined) ?? current?.dataset) : undefined;
  const saved = page.kind === "entity" && Boolean(headData?.savedIds?.includes(page.id) || current?.dataset.savedIds?.includes(page.id));

  const replaceCurrent = (r: Shown) => {
    if (page.kind === "entity" && page.tab === LASSO_TAB) setAnswer((a) => (a ? { ...a, view: r } : a));
    else if (key) put(key, r);
  };

  const patchSaved = (lassoId: string, on: boolean) => {
    setShown((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, dataset: withSaved(v.dataset, lassoId, on) }])));
    setAnswer((a) => (a?.view ? { ...a, view: { ...a.view, dataset: withSaved(a.view.dataset, lassoId, on) } } : a));
  };

  const toggleSaved = async () => {
    if (page.kind !== "entity") return;
    const want = !saved;
    patchSaved(page.id, want);
    try {
      if (want) await api.savePage({ page: page.id, kind: page.entity });
      else await api.removePage(page.id);
    } catch (e) {
      patchSaved(page.id, !want);
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
          if (page.kind === "entity" && (page.entity === "company" ? isFocus(focus) : isPersonFocus(focus))) {
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
          if (!current) return;
          const file = page.kind === "entity" && page.tab !== LASSO_TAB ? await (page.entity === "company" ? api.pdfCompany(page.id, page.tab as Focus) : api.pdfPerson(page.id, page.tab as PersonFocus)) : await api.pdfSpec(current.spec);
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

  const goBack = () => {
    const prev = back.at(-1);
    if (!prev) return;
    setBack((b) => b.slice(0, -1));
    setPage(prev);
  };

  const submitAsk = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    void search(query);
  };

  /* ---------- tegning ---------- */

  const pending = Boolean(answer?.pending);
  const lassoTabAvailable = page.kind === "result" || (page.kind === "entity" && answerFor === page.id && answer !== null);
  const tabs = page.kind === "entity" ? (page.entity === "company" ? COMPANY_TABS : PERSON_TABS) : [];
  const title = page.kind === "entity" ? page.name : page.kind === "result" ? page.title : "";
  const lines = page.kind === "entity" ? headLines(page.entity, page.id, headData) : [];
  const busy = key !== null && loading === key;
  const err = key ? failed[key] : "";

  let content: ReactNode;
  if (page.kind === "home") {
    content = (
      <div className="p2-home">
        <LassoMark className={`p2-home__mark${pending ? " is-busy" : ""}`} />
        <h1>Hvad vil du vide?</h1>
        <p>Spørg om en virksomhed, en person eller en målgruppe. Lasso henter svaret og viser det her.</p>
      </div>
    );
  } else {
    const view = current ? (page.kind === "entity" ? withoutHead(current.spec) : current.spec) : null;
    content = (
      <>
        {onLassoTab && answerHere ? (
          <div className="p2-answer" aria-live="polite">
            <div className="p2-answer__q">{answerHere.question}</div>
            {answerHere.text ? <Text text={answerHere.text} /> : null}
            {answerHere.pending && !answerHere.view ? <div className="p2-answer__status">{answerHere.status ?? "Tænker …"}</div> : null}
            {answerHere.error ? (
              <div className="p2-answer__error" role="alert">
                {answerHere.error}
              </div>
            ) : null}
          </div>
        ) : null}
        {err ? (
          <div className="p2-answer__error" role="alert">
            {err}
          </div>
        ) : view && current ? (
          <div className="p2-view">
            <LassoView
              key={`${key}:${view.title}:${view.components.length}`}
              spec={view}
              dataset={current.dataset}
              theme={theme}
              frameless
              page={page.kind === "entity"}
              host={{ prompt: true, save: true, refine: true, drillDown: true, refresh: true, export: true, pdf: boot.pdf !== false, openFocus: page.kind === "entity", openSection: page.kind === "entity" }}
              onAction={onAction}
            />
          </div>
        ) : busy || (onLassoTab && pending) ? (
          <div className="p2-skeleton" aria-label="Henter">
            <div />
            <div />
            <div />
          </div>
        ) : null}
      </>
    );
  }

  const sugg = suggestions(page);

  return (
    <div className={`p2-app${pending ? " is-busy" : ""}`} data-theme={theme}>
      <header className="p2-top">
        <button type="button" className="p2-logo" onClick={newConversation} aria-label="Lasso, forside">
          <LassoWordmark className="p2-wordmark" />
        </button>
        <form className={`p2-search${searchOpen ? " is-open" : ""}`} role="search" onSubmit={submitSearch}>
          <P2Icon name="search" className="p2-i p2-search__icon" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søg firma, person eller adresse" aria-label="Søg firma, person eller adresse" />
          {loading === "search" ? <span className="p2-search__busy" aria-label="Søger" /> : null}
        </form>
        <div className="p2-top__right">
          <button type="button" className="p2-ibtn p2-m-only" aria-label="Søg" onClick={() => setSearchOpen((o) => !o)}>
            <P2Icon name="search" />
          </button>
          <button type="button" className="p2-ibtn" aria-label="Skift mellem lyst og mørkt tema" aria-pressed={theme === "dark"} onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
            <P2Icon name="theme" />
          </button>
          <button type="button" className="p2-ibtn" aria-disabled="true" aria-label="Notifikationer (kommer senere)">
            <P2Icon name="bell" />
          </button>
          <button type="button" className="p2-ibtn" aria-label={`Profil: ${boot.user?.name ?? "Demobruger"}`} title={boot.user?.name ?? "Demobruger"}>
            <P2Icon name="user" />
          </button>
        </div>
      </header>

      <nav className="p2-rail" aria-label="Menu">
        <button type="button" className={`p2-ibtn${page.kind === "home" ? " is-on" : ""}`} aria-label="Værktøjer" onClick={() => go({ kind: "home" })}>
          <P2Icon name="grid" />
          <span className="p2-tip">Værktøjer</span>
        </button>
        <button type="button" className={`p2-ibtn${page.kind === "result" && page.title === "Gemte sider" ? " is-on" : ""}`} aria-label="Lister" onClick={openLists}>
          <P2Icon name="folder" />
          <span className="p2-tip">Lister</span>
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

      <div className="p2-main">
        <div className="p2-scroll" ref={scroller}>
          {page.kind !== "home" ? (
            <>
              <div className="p2-col p2-head">
                <div className="p2-back">
                  {back.length ? (
                    <button type="button" className="p2-backbtn" aria-label="Tilbage" onClick={goBack}>
                      <P2Icon name="back" />
                    </button>
                  ) : null}
                </div>
                <div className="p2-who">
                  <h1>{title}</h1>
                  {lines.map((l) => (
                    <div key={l} className="p2-line">
                      {l}
                    </div>
                  ))}
                </div>
                {page.kind === "entity" ? (
                  <div className="p2-acts">
                    <button type="button" className="p2-ibtn" aria-disabled="true" aria-label="Følg (kommer senere)">
                      <P2Icon name="rss" />
                    </button>
                    <button type="button" className={`p2-ibtn${saved ? " is-on" : ""}`} aria-pressed={saved} aria-label={saved ? "Gemt på din liste" : "Gem på din liste"} onClick={() => void toggleSaved()}>
                      <P2Icon name="book" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="p2-mods">
                <div className="p2-col p2-mods__row">
                  <div className="p2-tablist" role="tablist" aria-label="Moduler">
                    <button
                      type="button"
                      role="tab"
                      className={`p2-tabmark${onLassoTab ? " is-on" : ""}${pending ? " is-busy" : ""}`}
                      aria-selected={onLassoTab}
                      aria-label={pending ? "Lasso henter svaret" : "Lassos svar"}
                      title={pending ? "Lasso henter svaret" : "Lassos svar"}
                      disabled={!lassoTabAvailable}
                      onClick={() => switchTab(LASSO_TAB)}
                    >
                      <LassoMark className="p2-mark" />
                    </button>
                    {tabs.map((t) => (
                      <button key={t.id} type="button" role="tab" className="p2-tab" aria-selected={page.kind === "entity" && page.tab === t.id} onClick={() => switchTab(t.id)}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="p2-col p2-content">{content}</div>
          <div className="p2-end" />
        </div>

        {notice ? (
          <div className="p2-notice" role="status">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Luk">
              ×
            </button>
          </div>
        ) : null}

        <div className={`p2-ask${askOpen ? " is-open" : ""}`}>
          <form className="p2-ask__field" onSubmit={submitAsk}>
            <LassoMark className={`p2-ask__mark${pending ? " is-busy" : ""}`} />
            <input ref={askInput} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={askPlaceholder(page)} aria-label="Spørg Lasso" disabled={!boot.chat} />
            {pending ? (
              <button type="button" className="p2-ask__send" aria-label="Stop" onClick={stop}>
                <P2Icon name="stop" />
              </button>
            ) : (
              <button type="submit" className="p2-ask__send" aria-label="Send" disabled={!draft.trim()}>
                <P2Icon name="enter" />
              </button>
            )}
          </form>
          <div className="p2-ask__sugg">
            {sugg.map((s) => (
              <button key={s} type="button" onClick={() => void ask(s)} disabled={pending || !boot.chat}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="p2-mbar">
          <button
            type="button"
            className={`p2-lbtn${pending ? " is-busy" : ""}`}
            aria-label="Spørg Lasso"
            onClick={() => {
              setAskOpen((o) => !o);
              setTimeout(() => askInput.current?.focus(), 0);
            }}
          >
            <LassoMark className="p2-mark" />
          </button>
          <div className="p2-capsule">
            <button type="button" className={`p2-ibtn${searchOpen ? " is-on" : ""}`} aria-label="Søg" onClick={() => setSearchOpen((o) => !o)}>
              <P2Icon name="search" />
            </button>
            <button type="button" className={`p2-ibtn${page.kind === "home" ? " is-on" : ""}`} aria-label="Værktøjer" onClick={() => go({ kind: "home" })}>
              <P2Icon name="grid" />
            </button>
            <button type="button" className="p2-ibtn" aria-label="Lister" onClick={openLists}>
              <P2Icon name="folder" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
