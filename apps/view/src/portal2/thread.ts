import type { ViewSpec } from "@lasso/spec";
import type { ChatEvent, ChatState, Placement } from "../chat/stream.js";
import { CHAT_CACHE_KEY, CHAT_CACHE_TTL_MS, LASSO_TAB, type AnswerPart, type OpenItem, type PendingChoice } from "./model.js";

/**
 * Samtalen pr. fane (docs/chat.md): hver fane har sin egen uendelige tråd af ture (spørgsmål + svar) og sin egen
 * historik til serveren. Rene reducere uden React, så de kan testes i node.
 *
 * WP2-STUB: denne fil er en tynd udgave af grænsefladen fra planen (samme eksporter og signaturer); WP1 erstatter
 * den med den fulde implementering og testene.
 */

/** Meddelelsesrækken i en tur: svaret bliver her ("here"), eller spørgsmålet flyttede til en anden fane ("moved"). */
export type Notice = { kind: "here"; name: string } | { kind: "moved"; name: string; tabKey: string; undoUntil: number; createdTab: boolean };

export interface Answer {
  parts: AnswerPart[];
  /** "Vis virksomhed …", mens værktøjet henter. */
  status?: string;
  error?: string;
  pending: boolean;
  placement?: Placement;
  choice?: PendingChoice;
  /** Hvornår svaret var færdigt (ms); tidspunktet under svaret. */
  at?: number;
}

export interface Turn {
  id: string;
  question: string;
  askedAt: number;
  notice?: Notice;
  answer: Answer;
}

export interface TabChat {
  chat: ChatState;
  turns: Turn[];
  /** Fingeraftrykket af det "Brugeren ser"-resumé, fanens samtale sidst fik (null = send det fulde). */
  sent: string | null;
}

export type Threads = Record<string, TabChat>;

const emptyTab = (): TabChat => ({ chat: { history: [] }, turns: [], sent: null });

function patchTurn(t: Threads, key: string, turnId: string, fn: (turn: Turn) => Turn): Threads {
  const tab = t[key];
  if (!tab || !tab.turns.some((x) => x.id === turnId)) return t;
  return { ...t, [key]: { ...tab, turns: tab.turns.map((x) => (x.id === turnId ? fn(x) : x)) } };
}

/** Et nyt spørgsmål på fanen: turen lægges sidst med et ventende svar. Åbne menuer lukkes overalt. */
export function startTurn(t: Threads, key: string, question: string, now: number, id: string): Threads {
  const closed = Object.fromEntries(
    Object.entries(t).map(([k, tab]) => [k, tab.turns.some((x) => x.answer.choice) ? { ...tab, turns: tab.turns.map((x) => (x.answer.choice ? { ...x, answer: { ...x.answer, choice: undefined } } : x)) } : tab]),
  );
  const tab = closed[key] ?? emptyTab();
  return { ...closed, [key]: { ...tab, turns: [...tab.turns, { id, question, askedAt: now, answer: { parts: [], pending: true } }] } };
}

/** Én hændelse fra /api/chat lagt på turens svar. */
export function applyTurnEvent(t: Threads, key: string, turnId: string, e: ChatEvent): Threads {
  return patchTurn(t, key, turnId, (turn) => {
    const a = turn.answer;
    switch (e.type) {
      case "placement": {
        const { type: _t, ...placement } = e;
        const notice = e.here && e.target ? ({ kind: "here", name: e.target.name } as const) : turn.notice;
        return { ...turn, ...(notice ? { notice } : {}), answer: { ...a, placement } };
      }
      case "text": {
        const last = a.parts.at(-1);
        const parts: AnswerPart[] = last?.kind === "text" ? [...a.parts.slice(0, -1), { kind: "text", text: last.text + e.text }] : [...a.parts, { kind: "text", text: e.text }];
        return { ...turn, answer: { ...a, parts } };
      }
      case "tool":
        return { ...turn, answer: { ...a, status: `${e.title} …` } };
      case "tool_error":
        return { ...turn, answer: { ...a, status: undefined } };
      case "view":
        return { ...turn, answer: { ...a, status: undefined, parts: [...a.parts, { kind: "view", id: e.id, form: e.form, spec: e.spec, dataset: e.dataset }] } };
      case "choice":
        return { ...turn, answer: { ...a, status: undefined, choice: { id: e.id, question: e.question, options: e.options, allowFreeText: e.allowFreeText } } };
      case "error":
        return { ...turn, answer: { ...a, status: undefined, error: e.message } };
      case "done":
        return { ...turn, answer: { ...a, status: undefined, pending: false, placement: e.placement, at: a.at ?? Date.now() } };
    }
  });
}

/**
 * Turen flytter til en anden fane: den nye fane får spørgsmålet og svaret (som første eller næste besked), den gamle
 * beholder spørgsmålet med meddelelsesrækken (uden svar).
 */
export function moveTurn(t: Threads, from: string, to: string, turnId: string, notice: Notice): Threads {
  const turn = t[from]?.turns.find((x) => x.id === turnId);
  if (!turn || from === to) return t;
  const kept: Turn = { ...turn, notice, answer: { parts: [], pending: false } };
  const dest = t[to] ?? emptyTab();
  return {
    ...t,
    [from]: { ...t[from]!, turns: t[from]!.turns.map((x) => (x.id === turnId ? kept : x)) },
    [to]: { ...dest, turns: [...dest.turns.filter((x) => x.id !== turnId), { ...turn, notice: undefined }] },
  };
}

/** Svaret er færdigt: fanens samtale er den, serveren gav ("done"), og turen venter ikke længere. */
export function finishTurn(t: Threads, key: string, done: Extract<ChatEvent, { type: "done" }>): Threads {
  const tab = t[key] ?? emptyTab();
  const last = [...tab.turns].reverse().find((x) => x.answer.pending);
  const next: Threads = { ...t, [key]: { ...tab, chat: { history: done.history, sig: done.sig } } };
  return last ? applyTurnEvent(next, key, last.id, done) : next;
}

/** Fortryd en flytning: turen fjernes fra den gamle tråd, og den nye fane lukkes (hvis den blev åbnet til turen) eller mister turen. */
export function undoMove(t: Threads, from: string, turnId: string): { threads: Threads; closeKey?: string } {
  const turn = t[from]?.turns.find((x) => x.id === turnId);
  if (!turn || turn.notice?.kind !== "moved") return { threads: t };
  const { tabKey, createdTab } = turn.notice;
  const next: Threads = { ...t, [from]: { ...t[from]!, turns: t[from]!.turns.filter((x) => x.id !== turnId) } };
  if (createdTab) {
    const { [tabKey]: _gone, ...rest } = next;
    return { threads: rest, closeKey: tabKey };
  }
  const dest = next[tabKey];
  return { threads: dest ? { ...next, [tabKey]: { ...dest, turns: dest.turns.filter((x) => x.id !== turnId) } } : next };
}

/** "Spring over": menuen på fanens seneste tur lukkes, og intet sendes. */
export function skipChoice(t: Threads, key: string): Threads {
  const last = t[key]?.turns.at(-1);
  return last?.answer.choice ? patchTurn(t, key, last.id, (x) => ({ ...x, answer: { ...x.answer, choice: undefined } })) : t;
}

/** Valgmenuen, der står åben på fanen (den seneste turs). */
export function pendingChoice(t: Threads, key: string): PendingChoice | undefined {
  return t[key]?.turns.at(-1)?.answer.choice;
}

/** Et rent tekstsvar (ingen visninger, ingen modul-links, ingen fejl): kun det får kopiér-ikonet. */
export function isPureText(a: Answer): boolean {
  return !a.pending && !a.error && !a.choice && a.parts.length > 0 && a.parts.every((p) => p.kind === "text" && !/\]\(lasso:/.test(p.text));
}

/** Svarets tekst til udklipsholderen (modul-links som deres tekst). */
export function answerText(a: Answer): string {
  return a.parts
    .filter((p): p is AnswerPart & { kind: "text" } => p.kind === "text")
    .map((p) => p.text.replace(/\[([^\]]+)\]\(lasso:[^)]+\)/g, "$1").replace(/\*\*(.+?)\*\*/g, "$1"))
    .join("\n\n")
    .trim();
}

/** Navnet på en global fane, når modellen ikke gav et: ud fra den første visnings værktøj. */
export function globalTitleFallback(viewName: string, spec: ViewSpec): string {
  if (/^search_|^list_saved_pages$/.test(viewName)) return "Firmaliste";
  if (viewName === "compare_companies") return "Sammenligning";
  if (spec.components.some((c) => c.type === "LassoMap")) return "Kort";
  return "Markedsanalyse";
}

/* ---------- lageret (cache v2: én samtale pr. fane) ---------- */

interface ChatCache {
  v: 2;
  user: string;
  savedAt: number;
  open: OpenItem[];
  active: string | null;
  tabs: Record<string, TabChat>;
}

type CacheState = { threads: Threads; open: OpenItem[]; active: string | null };

/** Det, der gemmes: kun færdige ture (uden status) på faner, der stadig er åbne. */
export function serializeCache(user: string, state: CacheState, now: number): ChatCache {
  const keys = new Set(state.open.map((o) => o.key));
  const tabs = Object.fromEntries(
    Object.entries(state.threads)
      .filter(([k]) => keys.has(k))
      .map(([k, tab]) => [
        k,
        {
          ...tab,
          turns: tab.turns
            .filter((x) => !x.answer.pending)
            .map((x) => ({ ...x, answer: { ...x.answer, status: undefined }, ...(x.notice?.kind === "moved" ? { notice: { ...x.notice, undoUntil: 0 } } : {}) })),
        },
      ]),
  );
  return { v: 2, user, savedAt: now, open: [...state.open], active: state.active, tabs };
}

/** Samtalen fra lageret, hvis den er brugerens egen og ikke udløbet (v1 flyttes over); ellers null. */
export function restoreCache(raw: string | null | undefined, user: string, now: number, ttl = CHAT_CACHE_TTL_MS): CacheState | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Record<string, unknown> & { v?: number; user?: string; savedAt?: number; open?: OpenItem[]; active?: string | null };
    if (c.user !== user || typeof c.savedAt !== "number" || now - c.savedAt > ttl || now < c.savedAt || !Array.isArray(c.open)) return null;
    const open = c.open.filter((o): o is OpenItem => Boolean(o && typeof o.key === "string" && typeof o.name === "string" && typeof o.tab === "string"));
    const active = typeof c.active === "string" && open.some((o) => o.key === c.active) ? c.active : (open.at(-1)?.key ?? null);
    let threads: Threads = {};
    if (c.v === 2 && c.tabs && typeof c.tabs === "object") {
      threads = Object.fromEntries(
        Object.entries(c.tabs as Record<string, TabChat>)
          .filter(([, tab]) => tab && Array.isArray(tab.turns) && tab.chat && Array.isArray(tab.chat.history))
          .map(([k, tab]) => [k, { chat: tab.chat, sent: null, turns: tab.turns.map((x) => ({ ...x, answer: { ...x.answer, pending: false }, ...(x.notice?.kind === "moved" ? { notice: { ...x.notice, undoUntil: 0 } } : {}) })) }]),
      );
    } else if (c.v === 1) {
      // v1: én samtale for alle faner og ét svar pr. fane. Svaret bliver en tur; historikken følger den aktive fane.
      const v1 = c as unknown as { chat?: ChatState; answers?: Record<string, { question?: string; parts?: AnswerPart[]; error?: string; placement?: Placement }> };
      for (const [k, a] of Object.entries(v1.answers ?? {})) {
        if (!a || !Array.isArray(a.parts)) continue;
        threads[k] = { chat: { history: [] }, sent: null, turns: [{ id: `v1-${k}`, question: a.question ?? "", askedAt: c.savedAt, answer: { parts: a.parts, pending: false, ...(a.error ? { error: a.error } : {}) } }] };
      }
      if (active && v1.chat && Array.isArray(v1.chat.history)) threads[active] = { ...(threads[active] ?? emptyTab()), chat: v1.chat };
    } else return null;
    return { threads, open, active };
  } catch {
    return null;
  }
}

/** Fanens datasæt ude af det gemte: visningerne droppes (teksten bliver). En fane på Lasso står på Overblik bagefter. */
export function dropTabDatasets(cache: ChatCache, key: string): ChatCache {
  const tab = cache.tabs[key];
  if (!tab || !tab.turns.some((x) => x.answer.parts.some((p) => p.kind === "view"))) return cache;
  const stripped: TabChat = { ...tab, turns: tab.turns.map((x) => ({ ...x, answer: { ...x.answer, parts: x.answer.parts.filter((p) => p.kind !== "view") } })) };
  return {
    ...cache,
    tabs: { ...cache.tabs, [key]: stripped },
    open: cache.open.map((o) => (o.key === key && o.kind !== "result" && o.tab === LASSO_TAB ? { ...o, tab: "overblik" } : o)),
  };
}

/** Samtalerne glemt i det gemte (tom historik, ingen signatur), og åbne menuer lukkes. */
export function resetConversation(cache: ChatCache): ChatCache {
  return {
    ...cache,
    tabs: Object.fromEntries(Object.entries(cache.tabs).map(([k, tab]) => [k, { ...tab, chat: { history: [] }, turns: tab.turns.map((x) => (x.answer.choice ? { ...x, answer: { ...x.answer, choice: undefined } } : x)) }])),
  };
}

/** Gemmer; er lageret fuldt, droppes først datasæt (ældste faner først), så samtalerne, og til sidst springes over. */
export function saveCache(storage: Pick<Storage, "setItem"> | undefined, cache: ChatCache, order: readonly string[] = []): "saved" | "dropped" | "reset" | "skipped" {
  if (!storage) return "skipped";
  const tryWrite = (c: ChatCache): boolean => {
    try {
      storage.setItem(CHAT_CACHE_KEY, JSON.stringify(c));
      return true;
    } catch {
      return false;
    }
  };
  if (tryWrite(cache)) return "saved";
  let next = cache;
  for (const key of order) {
    const smaller = dropTabDatasets(next, key);
    if (smaller === next) continue;
    next = smaller;
    if (tryWrite(next)) return "dropped";
  }
  return tryWrite(resetConversation(next)) ? "reset" : "skipped";
}
