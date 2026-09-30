import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Kommentarer i designguiden. Alt, der tegnes i en ramme (moduler, elementer, sider), og alle rækker med
 * tokens og tekster kan kommenteres. En kommentar har et mål (target), en etiket, konteksten (modultype,
 * bredde, skærm, data …) og evt. en nål på det sted i rammen, den handler om. Gemmes på serveren
 * (/designguide/api/kommentarer); de åbne står som arbejdsliste på /designguide/kommentarer.md.
 */

export type CommentStatus = "aaben" | "rettet" | "afvist";

export interface CommentContext {
  kind: string;
  ref?: string;
  viewport?: string;
  vw?: number;
  width?: string;
  mode?: string;
  data?: string;
  hash?: string;
  theme?: string;
  element?: string;
}

export interface CommentTarget {
  target: string;
  label: string;
  context: CommentContext;
}

export interface GuideComment extends CommentTarget {
  id: string;
  pin?: { x: number; y: number };
  text: string;
  author: string;
  status: CommentStatus;
  reply?: string;
  commit?: string;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABEL: Record<CommentStatus, string> = { aaben: "Åben", rettet: "Rettet", afvist: "Afvist" };

interface Identity {
  name: string;
  key: string;
}

interface CommentsApi {
  comments: GuideComment[];
  mode: boolean;
  setMode: (on: boolean) => void;
  forTarget: (target: string) => GuideComment[];
  add: (t: CommentTarget, text: string, pin?: { x: number; y: number }) => Promise<GuideComment>;
  update: (id: string, patch: Partial<Pick<GuideComment, "status" | "reply" | "text" | "commit">>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  identity: Identity | null;
  setIdentity: (i: Identity) => void;
  keyRequired: boolean;
  error: string;
}

const Ctx = createContext<CommentsApi | null>(null);
const API = "/designguide/api/kommentarer";
const STORE_KEY = "dg-identity";

function readIdentity(): Identity | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null") as Identity | null;
    return v && typeof v.name === "string" ? v : null;
  } catch {
    return null;
  }
}

export function CommentsProvider({ children, keyRequired, theme }: { children: ReactNode; keyRequired: boolean; theme: string }) {
  const [comments, setComments] = useState<GuideComment[]>([]);
  const [mode, setMode] = useState(false);
  const [identity, setIdentityState] = useState<Identity | null>(readIdentity);
  const [error, setError] = useState("");
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const reload = useCallback(async () => {
    try {
      const r = await fetch(API, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setComments((await r.json()) as GuideComment[]);
      setError("");
    } catch (e) {
      setError(`Kommentarerne kunne ikke hentes: ${(e as Error).message}`);
    }
  }, []);
  useEffect(() => {
    void reload();
    // Hent igen, når fanen får fokus (fx efter at Claude har rettet og svaret).
    const on = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [reload]);

  const call = async (method: string, url: string, body?: unknown) => {
    const r = await fetch(url, { method, headers: { "content-type": "application/json", ...(identity?.key ? { "x-api-key": identity.key } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) throw new Error("Forkert nøgle. Tjek nøglen under Kommentarer, Navn og nøgle.");
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`);
    return r.status === 204 ? null : r.json();
  };

  const api: CommentsApi = {
    comments,
    mode,
    setMode,
    forTarget: (target) => comments.filter((c) => c.target === target),
    add: async (t, text, pin) => {
      const c = (await call("POST", API, { ...t, context: { ...t.context, hash: t.context.hash ?? location.hash, theme: themeRef.current }, text, pin, author: identity?.name ?? "Ukendt" })) as GuideComment;
      setComments((prev) => [...prev, c]);
      return c;
    },
    update: async (id, patch) => {
      const c = (await call("PATCH", `${API}/${id}`, patch)) as GuideComment;
      setComments((prev) => prev.map((x) => (x.id === id ? c : x)));
    },
    remove: async (id) => {
      await call("DELETE", `${API}/${id}`);
      setComments((prev) => prev.filter((x) => x.id !== id));
    },
    reload,
    identity,
    setIdentity: (i) => {
      setIdentityState(i);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(i));
      } catch {
        /* privat vindue: gælder kun denne session */
      }
    },
    keyRequired,
    error,
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useComments(): CommentsApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useComments uden CommentsProvider");
  return c;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });

/** Navn (og nøgle, når serveren kræver det), før den første kommentar. */
export function IdentityForm({ onDone }: { onDone?: () => void }) {
  const { identity, setIdentity, keyRequired } = useComments();
  const [name, setName] = useState(identity?.name ?? "");
  const [key, setKey] = useState(identity?.key ?? "");
  return (
    <form
      className="dg-identity"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIdentity({ name: name.trim(), key: key.trim() });
        onDone?.();
      }}
    >
      <label>
        <span>Dit navn</span>
        <input className="dg-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Fx Jakob" />
      </label>
      {keyRequired ? (
        <label>
          <span>Nøgle</span>
          <input className="dg-input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="DESIGNGUIDE_KEY" />
        </label>
      ) : null}
      <button className="dg-btn dg-btn--primary" type="submit" disabled={!name.trim()}>
        Gem
      </button>
    </form>
  );
}

/** Én kommentar med status, svar og handlinger (ret status, slet). */
export function CommentItem({ c, compact = false, n }: { c: GuideComment; compact?: boolean; n?: number }) {
  const { update, remove } = useComments();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const act = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try {
      await f();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`dg-comment dg-comment--${c.status}`}>
      <div className="dg-comment__head">
        {n != null ? <span className="dg-pin dg-pin--static">{n}</span> : null}
        <strong>{c.author}</strong>
        <span className="dg-meta">{fmt(c.createdAt)}</span>
        <span className={`dg-status dg-status--${c.status}`}>{STATUS_LABEL[c.status]}</span>
      </div>
      {!compact ? <div className="dg-comment__label">{c.label}</div> : null}
      <p className="dg-comment__text">{c.text}</p>
      {c.reply ? (
        <div className="dg-comment__reply">
          <span className="dg-meta">Svar{c.commit ? `, ${c.commit}` : ""}</span>
          {c.reply}
        </div>
      ) : null}
      <div className="dg-comment__actions">
        {c.status === "aaben" ? (
          <button disabled={busy} onClick={() => act(() => update(c.id, { status: "rettet" }))}>
            Markér rettet
          </button>
        ) : (
          <button disabled={busy} onClick={() => act(() => update(c.id, { status: "aaben" }))}>
            Åbn igen
          </button>
        )}
        {c.status === "aaben" ? (
          <button disabled={busy} onClick={() => act(() => update(c.id, { status: "afvist" }))}>
            Afvis
          </button>
        ) : null}
        <button disabled={busy} onClick={() => confirm("Slet kommentaren?") && act(() => remove(c.id))}>
          Slet
        </button>
        {!compact && c.context.hash ? <a href={c.context.hash}>Gå til</a> : null}
      </div>
      {err ? <div className="dg-comment__err">{err}</div> : null}
    </div>
  );
}

/** Skriv en kommentar til et mål (evt. med nål). */
export function Composer({ target, pin, onDone, autoFocus = true }: { target: CommentTarget; pin?: { x: number; y: number }; onDone?: () => void; autoFocus?: boolean }) {
  const { add, identity } = useComments();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [asking, setAsking] = useState(!identity);
  if (asking) return <IdentityForm onDone={() => setAsking(false)} />;
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setErr("");
    try {
      await add(target, text.trim(), pin);
      setText("");
      onDone?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="dg-composer">
      <textarea
        className="dg-textarea"
        value={text}
        autoFocus={autoFocus}
        placeholder={pin ? "Hvad skal rettes her?" : "Hvad skal rettes?"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
          if (e.key === "Escape") onDone?.();
        }}
      />
      {err ? <div className="dg-comment__err">{err}</div> : null}
      <div className="dg-composer__actions">
        <span className="dg-meta">
          Som {identity?.name}.{" "}
          <button className="dg-linkbtn" onClick={() => setAsking(true)}>
            Skift
          </button>
        </span>
        {onDone ? (
          <button className="dg-btn dg-btn--sm" onClick={onDone}>
            Annullér
          </button>
        ) : null}
        <button className="dg-btn dg-btn--sm dg-btn--primary" disabled={busy || !text.trim()} onClick={() => void send()}>
          Kommentér
        </button>
      </div>
    </div>
  );
}

/** Kommentarknap med antal åbne, der folder tråden og en ny kommentar ud (til rammer og rækker uden nål). */
export function CommentButton({ target, small = false }: { target: CommentTarget; small?: boolean }) {
  const { forTarget, mode } = useComments();
  const [open, setOpen] = useState(false);
  const list = forTarget(target.target);
  const openCount = list.filter((c) => c.status === "aaben").length;
  if (!mode && !list.length) return null;
  return (
    <span className="dg-cbtn-wrap">
      <button className={`dg-cbtn${openCount ? " has-open" : ""}${small ? " dg-cbtn--sm" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={list.length ? `${list.length} kommentarer` : "Kommentér"}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M5 5h14v10H10l-4 4v-4H5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        {list.length ? <span>{openCount || list.length}</span> : small ? null : <span>Kommentér</span>}
      </button>
      {open ? (
        <div className="dg-popover" role="dialog" aria-label={`Kommentarer til ${target.label}`}>
          <div className="dg-popover__title">{target.label}</div>
          {list.map((c) => (
            <CommentItem key={c.id} c={c} compact />
          ))}
          <Composer target={target} autoFocus={!list.length} onDone={list.length ? undefined : () => setOpen(false)} />
        </div>
      ) : null}
    </span>
  );
}

/** Beskrivelse af elementet under nålen, så det kan findes i koden. */
export function describeElement(el: Element | null): string | undefined {
  if (!el) return undefined;
  const withClass = el.closest("[class*='lasso-']") ?? el;
  const cls = [...withClass.classList].filter((c) => c.startsWith("lasso")).slice(0, 3).join(".");
  // innerText har mellemrum mellem blokke ("Omsætning 135,8 mio. kr."), textContent ikke.
  const text = ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  return `${withClass.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${text ? ` "${text}"` : ""}`;
}

/**
 * Nålene i en ramme og, i kommentartilstand, et lag, der fanger klik og sætter en ny nål.
 * Koordinaterne er i rammens egne pixels (skærmbredden `vw`), så nålen står samme sted uanset skalering.
 */
export function PinLayer({ target, scale, left, getDoc }: { target: CommentTarget; scale: number; left: number; getDoc: () => Document | null | undefined }) {
  const { forTarget, mode } = useComments();
  const [draft, setDraft] = useState<{ x: number; y: number; element?: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const pins = forTarget(target.target).filter((c) => c.pin);
  const numbered = useMemo(() => pins.map((c, i) => ({ c, n: i + 1 })), [pins]);
  const toScreen = (p: { x: number; y: number }) => ({ left: (p.x - left) * scale, top: p.y * scale });
  return (
    <>
      {mode ? (
        <div
          className="dg-pinlayer"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = Math.round((e.clientX - r.left) / scale + left);
            const y = Math.round((e.clientY - r.top) / scale);
            setOpenId(null);
            setDraft({ x, y, element: describeElement(getDoc()?.elementFromPoint(x, y) ?? null) });
          }}
          title="Klik for at sætte en nål og kommentere"
        />
      ) : null}
      {numbered.map(({ c, n }) => (
        <button key={c.id} className={`dg-pin dg-pin--${c.status}${openId === c.id ? " is-open" : ""}`} style={toScreen(c.pin!)} onClick={() => setOpenId(openId === c.id ? null : c.id)} aria-label={`Kommentar ${n}: ${c.text}`}>
          {n}
        </button>
      ))}
      {openId ? (
        (() => {
          const hit = numbered.find((x) => x.c.id === openId);
          if (!hit) return null;
          return (
            <div className="dg-popover dg-popover--pin" style={toScreen(hit.c.pin!)}>
              <CommentItem c={hit.c} compact n={hit.n} />
            </div>
          );
        })()
      ) : null}
      {draft ? (
        <>
          <span className="dg-pin dg-pin--draft" style={toScreen(draft)}>
            +
          </span>
          <div className="dg-popover dg-popover--pin" style={toScreen(draft)} onClick={(e) => e.stopPropagation()}>
            <div className="dg-popover__title">{target.label}</div>
            {draft.element ? <div className="dg-meta">På {draft.element}</div> : null}
            <Composer target={{ ...target, context: { ...target.context, ...(draft.element ? { element: draft.element } : {}) } }} pin={{ x: draft.x, y: draft.y }} onDone={() => setDraft(null)} />
          </div>
        </>
      ) : null}
    </>
  );
}
