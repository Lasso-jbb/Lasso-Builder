import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { LassoMark, LassoView, LoginCard, type ActionResult, type ViewAction } from "@lasso/ui";
import { composeCompany, composePerson, composePersonProbe, composeProbe, type Dataset, type ViewSpec } from "@lasso/spec";
import type { ChatBoot } from "../boot.js";
import { focusPrompt } from "../focusPrompt.js";
import { PDF_SAVED, saveBlob } from "../pdfDownload.js";
import { createPortalApi, errorText, LOGGED_OUT, type PortalApi } from "../portal/api.js";
import { parseBlocks, type Inline } from "./markdown.js";
import { ChatHttpError, streamChat, type ChatEvent, type ChatState } from "./stream.js";
import "./chat.css";

/**
 * Lassos egen chat (/chat, docs/chat.md): spørgsmål går til /api/chat, hvor Claude bruger de samme
 * værktøjer som i Claude.ai (MCP). Visningerne tegnes med LassoView lige under svaret; klik i dem
 * (åbn person/virksomhed, filtre, gem, PDF) går til portal-API'et uden en tur til modellen, og
 * opfølgende spørgsmål ("Se hele økonomien") sendes som nye beskeder i chatten.
 */

type Part =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: string; title: string; state: "running" | "done" | "error"; message?: string }
  | { kind: "view"; id: string; spec: ViewSpec; dataset: Dataset };

type Turn = { role: "user"; text: string } | { role: "assistant"; parts: Part[]; error?: string; pending: boolean };

const SUGGESTIONS = [
  "Hvordan går det økonomisk med Novo Nordisk?",
  "Hvem ejer LEGO A/S?",
  "Revisorer i Region Midtjylland med mindst 10 ansatte",
  "Sammenlign Carlsberg og Royal Unibrew",
];

/** Tilføjer en hændelse til det svar, der er ved at blive skrevet. */
function applyEvent(turn: Extract<Turn, { role: "assistant" }>, e: ChatEvent): Extract<Turn, { role: "assistant" }> {
  const parts = [...turn.parts];
  const last = parts.at(-1);
  switch (e.type) {
    case "text":
      if (last?.kind === "text") parts[parts.length - 1] = { kind: "text", text: last.text + e.text };
      else parts.push({ kind: "text", text: e.text });
      return { ...turn, parts };
    case "tool":
      parts.push({ kind: "tool", id: e.id, title: e.title, state: "running" });
      return { ...turn, parts };
    case "view": {
      const i = parts.findIndex((p) => p.kind === "tool" && p.id === e.id);
      const view: Part = { kind: "view", id: e.id, spec: e.spec, dataset: e.dataset };
      // Visningen erstatter "Henter …"-linjen for samme værktøjskald.
      if (i >= 0) parts[i] = view;
      else parts.push(view);
      return { ...turn, parts };
    }
    case "tool_error":
      return { ...turn, parts: parts.map((p) => (p.kind === "tool" && p.id === e.id ? { ...p, state: "error", message: e.message } : p)) };
    case "error":
      return { ...turn, error: e.message };
    case "done":
      return { ...turn, pending: false, parts: parts.map((p) => (p.kind === "tool" && p.state === "running" ? { ...p, state: "done" } : p)) };
    case "placement":
    case "choice":
      // Placering og valgmenu hører til portalen (uden context svarer serveren globalt og uden menu).
      return turn;
  }
}

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "bold" ? (
          <strong key={i}>{p.text}</strong>
        ) : p.kind === "link" ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
            {p.text}
          </a>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

export function Text({ text }: { text: string }) {
  return (
    <div className="lasso-chat__text">
      {parseBlocks(text).map((b, i) =>
        b.kind === "ul" ? (
          <ul key={i}>
            {b.items.map((item, k) => (
              <li key={k}>
                <InlineText parts={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((line, k) => (
              <Fragment key={k}>
                {k > 0 ? <br /> : null}
                <InlineText parts={line} />
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

interface Screen {
  spec: ViewSpec;
  dataset: Dataset | null;
  url?: string;
}

function withSaved(ds: Dataset, lassoId: string, saved: boolean): Dataset {
  const ids = new Set(ds.savedIds ?? []);
  if (saved) ids.add(lassoId);
  else ids.delete(lassoId);
  return { ...ds, savedIds: [...ids] };
}

function downloadCsv(filename: string, csv: string) {
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

/** Én visning i chatten med sin egen stak (drill-down og "tilbage"), som i MCP-appen. */
function ChatView({ spec, dataset, api, pdf, onPrompt }: { spec: ViewSpec; dataset: Dataset; api: PortalApi; pdf: boolean; onPrompt: (text: string) => void }) {
  const [stack, setStack] = useState<Screen[]>([{ spec, dataset }]);
  const [loading, setLoading] = useState(false);
  const current = stack.at(-1)!;
  const replaceTop = (s: Screen) => setStack((st) => [...st.slice(0, -1), s]);

  const onAction = async (a: ViewAction): Promise<ActionResult | void> => {
    try {
      switch (a.kind) {
        case "prompt":
          onPrompt(a.prompt);
          return { ok: true };
        case "open-focus": {
          const text = focusPrompt(current.spec, current.dataset, a.focus);
          if (!text) return { ok: false, error: "Fanen findes ikke på denne side." };
          onPrompt(text);
          return { ok: true };
        }
        case "open-company": {
          const probe = composeProbe(a.lassoId, "overblik");
          setStack((st) => [...st, { spec: { ...probe, title: a.name ?? a.lassoId }, dataset: null }]);
          setLoading(true);
          const { dataset: ds } = await api.resolve(probe);
          replaceTop({ spec: composeCompany(a.lassoId, ds, { focus: "overblik", name: ds.companies[a.lassoId]?.name ?? a.name ?? a.lassoId }), dataset: ds });
          return { ok: true };
        }
        case "open-person": {
          const probe = composePersonProbe(a.lassoId);
          setStack((st) => [...st, { spec: { ...probe, title: a.name ?? a.lassoId }, dataset: null }]);
          setLoading(true);
          const { dataset: ds } = await api.resolve(probe);
          replaceTop({ spec: composePerson(a.lassoId, ds, { name: ds.persons[a.lassoId]?.name ?? a.name ?? a.lassoId }), dataset: ds });
          return { ok: true };
        }
        case "back":
          setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
          return { ok: true };
        case "set-criteria": {
          const next: ViewSpec = {
            ...current.spec,
            criteria: a.criteria,
            components: current.spec.components.map((c) => (c.type === "LassoCompanyTable" ? { ...c, search: { ...c.search, criteria: a.criteria } } : c)),
          };
          setLoading(true);
          replaceTop({ spec: next, dataset: current.dataset });
          const r = await api.resolve(next);
          replaceTop({ spec: r.spec, dataset: r.dataset });
          return { ok: true };
        }
        case "refresh": {
          setLoading(true);
          const r = await api.resolve(current.spec);
          replaceTop({ spec: r.spec, dataset: r.dataset, url: current.url });
          return { ok: true };
        }
        case "save": {
          const r = await api.saveView({ spec: current.spec, name: a.name, slug: a.slug, visibility: a.visibility });
          replaceTop({ ...current, url: r.url });
          return { ok: true, url: r.url };
        }
        case "save-page": {
          await api.savePage({ page: a.lassoId, kind: a.pageKind, ...(a.focus ? { focus: a.focus } : {}) });
          setStack((st) => st.map((s) => (s.dataset ? { ...s, dataset: withSaved(s.dataset, a.lassoId, true) } : s)));
          return { ok: true, message: "Gemt på din liste" };
        }
        case "remove-saved-page": {
          await api.removePage(a.lassoId);
          setStack((st) => st.map((s) => (s.dataset ? { ...s, dataset: withSaved(s.dataset, a.lassoId, false) } : s)));
          return { ok: true };
        }
        case "copy-link":
          try {
            await navigator.clipboard.writeText(a.url);
            return { ok: true };
          } catch {
            return { ok: false, error: "Kunne ikke kopiere linket." };
          }
        case "open-link":
          window.open(a.url, "_blank", "noopener");
          return { ok: true };
        case "export":
          downloadCsv(a.filename, a.csv);
          return { ok: true };
        case "pdf": {
          const file = await api.pdfSpec(current.spec);
          saveBlob(file.blob, file.filename);
          return { ok: true, message: PDF_SAVED };
        }
        default:
          return { ok: false, error: "Det kan chatten ikke endnu." };
      }
    } catch (e) {
      return { ok: false, error: errorText(e) };
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lasso-chat__view">
      <LassoView
        key={stack.length}
        spec={current.spec}
        dataset={current.dataset}
        url={current.url}
        loading={loading || current.dataset === null}
        theme="light"
        savePrefix="…/v/"
        host={{ prompt: true, save: true, savePage: true, refine: true, drillDown: true, back: stack.length > 1, refresh: true, export: true, pdf, openFocus: true }}
        onAction={onAction}
      />
    </div>
  );
}

function ToolLine({ part }: { part: Extract<Part, { kind: "tool" }> }) {
  if (part.state === "error") return <div className="lasso-chat__tool lasso-chat__tool--error">{part.title}: {part.message || "fejlede"}</div>;
  return <div className={`lasso-chat__tool${part.state === "running" ? " is-running" : ""}`}>{part.state === "running" ? `${part.title} …` : part.title}</div>;
}

export function ChatApp({ boot }: { boot: ChatBoot }) {
  const [user, setUser] = useState<{ name: string } | null | undefined>(undefined);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyLogin, setBusyLogin] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const state = useRef<ChatState>({ history: [] });
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const api = useMemo(
    () =>
      createPortalApi(() => {
        setUser(null);
        setNotice(LOGGED_OUT);
      }),
    [],
  );

  useEffect(() => {
    document.title = "Lasso, Chat";
    document.documentElement.style.colorScheme = "light";
    document.body.style.background = "#ffffff";
    fetch("/api/chat/status", { credentials: "same-origin" })
      .then((r) => r.json() as Promise<{ user: { name: string } | null }>)
      .then((s) => setUser(s.user ?? (boot.loginRequired ? null : { name: "Demobruger" })))
      .catch(() => setUser(null));
  }, [boot.loginRequired]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns.length]);

  const updateLast = (fn: (t: Extract<Turn, { role: "assistant" }>) => Extract<Turn, { role: "assistant" }>) =>
    setTurns((ts) => {
      const last = ts.at(-1);
      return last?.role === "assistant" ? [...ts.slice(0, -1), fn(last)] : ts;
    });

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sending) return;
      setDraft("");
      setSending(true);
      setTurns((ts) => [...ts, { role: "user", text: message }, { role: "assistant", parts: [], pending: true }]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        await streamChat(
          { message, history: state.current.history, sig: state.current.sig },
          (e) => {
            if (e.type === "done") state.current = { history: e.history, sig: e.sig };
            updateLast((t) => applyEvent(t, e));
          },
          { signal: ctrl.signal },
        );
      } catch (e) {
        if (e instanceof ChatHttpError && e.status === 401) {
          setUser(null);
          setNotice(LOGGED_OUT);
        }
        updateLast((t) => ({ ...t, error: errorText(e) }));
      } finally {
        updateLast((t) => ({ ...t, pending: false }));
        setSending(false);
        abort.current = null;
      }
    },
    [sending],
  );

  const reset = () => {
    abort.current?.abort();
    state.current = { history: [] };
    setTurns([]);
    setSending(false);
  };

  if (user === undefined) return <div className="lasso-root lasso-chat" data-theme="light" />;

  if (user === null) {
    const login = async (id: string, key: string) => {
      setBusyLogin(true);
      setLoginError(null);
      try {
        const r = await api.login(id, key);
        setNotice(null);
        setUser(r.user);
      } catch (e) {
        setLoginError(errorText(e) || "Forkert bruger eller adgangsnøgle.");
      } finally {
        setBusyLogin(false);
      }
    };
    return (
      <div className="lasso-root lasso-portal lasso-portal--login" data-theme="light">
        <LoginCard onSubmit={(id, key) => void login(id, key)} error={loginError} notice={notice} busy={busyLogin} />
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className="lasso-root lasso-chat" data-theme="light">
      <header className="lasso-chat__header">
        <LassoMark className="lasso-chat__mark" />
        <span className="lasso-chat__brand">Lasso Chat</span>
        <span className="lasso-chat__spacer" />
        {turns.length ? (
          <button type="button" className="lasso-btn" onClick={reset}>
            Ny samtale
          </button>
        ) : null}
        <a className="lasso-btn" href="/portal">
          Portalen
        </a>
      </header>

      <main className="lasso-chat__log" aria-live="polite">
        {!boot.enabled ? (
          <div className="lasso-chat__empty">
            <h1>Chatten er ikke slået til</h1>
            <p>Serveren mangler ANTHROPIC_API_KEY. Læg nøglen under servicens Variables på Railway.</p>
          </div>
        ) : !turns.length ? (
          <div className="lasso-chat__empty">
            <h1>Spørg om danske virksomheder og personer</h1>
            <p>Svarene vises som Lasso-visninger med regnskaber, ejere, ledelse, risiko og historik.</p>
            <div className="lasso-chat__suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="lasso-chat__suggestion" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="lasso-chat__user">
                <div className="lasso-chat__bubble">{t.text}</div>
              </div>
            ) : (
              <div key={i} className="lasso-chat__assistant">
                {t.parts.map((p, k) =>
                  p.kind === "text" ? (
                    <Text key={k} text={p.text} />
                  ) : p.kind === "tool" ? (
                    <ToolLine key={p.id} part={p} />
                  ) : (
                    <ChatView key={p.id} spec={p.spec} dataset={p.dataset} api={api} pdf={boot.pdf !== false} onPrompt={(text) => void send(text)} />
                  ),
                )}
                {t.pending && !t.parts.length ? <div className="lasso-chat__tool is-running">Tænker …</div> : null}
                {t.error ? (
                  <div className="lasso-chat__error" role="alert">
                    {t.error}
                  </div>
                ) : null}
              </div>
            ),
          )
        )}
        <div ref={endRef} />
      </main>

      <form className="lasso-chat__composer" onSubmit={submit}>
        <textarea
          className="lasso-chat__input"
          value={draft}
          rows={1}
          placeholder={boot.enabled ? "Spørg om en virksomhed, en person eller en målgruppe …" : "Chatten er ikke slået til"}
          aria-label="Besked"
          disabled={!boot.enabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        <button type="submit" className="lasso-btn lasso-btn--primary" disabled={!boot.enabled || sending || !draft.trim()}>
          {sending ? "Svarer …" : "Send"}
        </button>
      </form>
    </div>
  );
}
