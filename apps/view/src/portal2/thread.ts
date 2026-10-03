import type { Dataset, ViewSpec } from "@lasso/spec";
import type { ChatEvent, ChatState, ChoiceOption, Placement, ViewForm } from "../chat/stream.js";

/**
 * Chattens samtale i portalen (docs/chat.md): en tråd pr. fane, hver tur med spørgsmål, evt. notits om en flytning
 * og svar. Rene reducere uden React, så de kan testes i node. Hver fane har sin egen historik (serveren giver en
 * frisk historik, når et svar flytter til en anden fane), og samtalen gemmes i browseren (cache v2, migrerer v1).
 */

export type ItemKind = "company" | "person" | "result";

/** "lasso" = fanen med Lasso-mærket: det, chatten senest hentede om siden. */
export const LASSO_TAB = "lasso";

export interface Shown {
  spec: ViewSpec;
  dataset: Dataset;
  /** Serverens resumé af det viste (kun moduler); sendes til chatten som "det, brugeren ser". */
  summary?: string;
}

/** En åben fane: et firma, en person eller et resultat. key = Lasso-ID, eller "result:<n>". */
export interface OpenItem {
  key: string;
  kind: ItemKind;
  name: string;
  /** Linjen under navnet i fanens tooltip og i mobilarket, fx "Bagsværd, CVR 24256790". */
  sub?: string;
  /** Det valgte modul (fokus) eller LASSO_TAB. Resultater står altid på LASSO_TAB. */
  tab: string;
}

/** Ét stykke af svaret: tekst eller en visning, i den rækkefølge de kom. */
/** tool: værktøjet bag visningen (fra "view"-hændelsen); udeladt i ældre svar og gemte samtaler. */
export type AnswerPart = { kind: "text"; text: string } | ({ kind: "view"; id: string; form: ViewForm; tool?: string } & Shown);

/** Valgmenuen, serveren bad om ("choice"-hændelsen): vises over spørgefeltet, til brugeren vælger. */
export interface PendingChoice {
  id: string;
  question: string;
  options: ChoiceOption[];
  allowFreeText: boolean;
}

/**
 * Notitsen under spørgsmålet: here = svaret skrives her om en anden person/virksomhed (modellen valgte at blive),
 * moved = svaret flyttede til fanen tabKey (createdTab: fanen blev åbnet til dette spørgsmål); Fortryd virker til undoUntil.
 */
export type Notice =
  | { kind: "here"; name: string }
  | {
      kind: "moved";
      name: string;
      tabKey: string;
      undoUntil: number;
      createdTab: boolean;
      /** Flyttet ind i en fane, der fandtes: dens samtale (historik og resumé) før flytningen, så Fortryd kan lægge den tilbage. Gemmes ikke. */
      prev?: { chat: ChatState; sent: string | null };
    };

/** Hvad chatten svarede på et spørgsmål: delene (tekst og visninger) i rækkefølge. */
export interface Answer {
  parts: AnswerPart[];
  /** "Vis virksomhed …", mens værktøjet henter. */
  status?: string;
  error?: string;
  pending: boolean;
  /** Hvor serveren skriver svaret (første hændelse i turen, så modellens valg). */
  placement?: Placement;
  /** Valgmenuen, serveren bad om; står, til brugeren vælger eller spørger om noget andet. */
  choice?: PendingChoice;
  /** Hvornår svaret blev færdigt (ms), til klokkeslættet under svaret. */
  at?: number;
  /** Brugeren trykkede Stop: svaret står, som det nåede at blive, med "Stoppet." (ingen "Prøv igen"). */
  stopped?: true;
}

export interface Turn {
  id: string;
  question: string;
  askedAt: number;
  notice?: Notice;
  answer: Answer;
}

/** En fanes samtale: serverens historik (og signatur), turene og fingeraftrykket af det "Brugeren ser"-resumé, modellen sidst fik. */
export interface TabChat {
  chat: ChatState;
  turns: Turn[];
  /** null = send det fulde resumé (ny samtale, trimmet historik). */
  sent: string | null;
}

export type Threads = Record<string, TabChat>;

const emptyTab = (): TabChat => ({ chat: { history: [] }, turns: [], sent: null });

/* ---------- svaret ---------- */

export const newAnswer = (): Answer => ({ parts: [], pending: true });

/** Den seneste visning i svaret: den, handlinger (filtre, opdatér, PDF) virker på. */
export function lastView(answer: Answer | undefined): Shown | undefined {
  const v = answer?.parts.filter((p): p is AnswerPart & { kind: "view" } => p.kind === "view").at(-1);
  return v ? { spec: v.spec, dataset: v.dataset } : undefined;
}

/** Erstatter den seneste visning (fx efter et filterskift). */
export function withLastView(answer: Answer, shown: Shown): Answer {
  const i = answer.parts.map((p) => p.kind).lastIndexOf("view");
  if (i < 0) return answer;
  return { ...answer, parts: answer.parts.map((p, k) => (k === i && p.kind === "view" ? { ...p, ...shown } : p)) };
}

/** Alle visninger i svaret ændret (fx Gem/Gemt i datasættet). */
export function mapViews(answer: Answer, fn: (shown: Shown) => Shown): Answer {
  return { ...answer, parts: answer.parts.map((p) => (p.kind === "view" ? { ...p, ...fn({ spec: p.spec, dataset: p.dataset }) } : p)) };
}

/**
 * Ren reducer: én hændelse fra /api/chat lagt på svaret. Tekst føjes til den sidste tekstdel; visninger kommer i
 * rækkefølge. "done" hører til finishTurn (den gemmer også historikken) og ændrer intet her.
 */
export function applyEvent(answer: Answer, e: ChatEvent): Answer {
  switch (e.type) {
    case "placement": {
      const { type: _t, ...placement } = e;
      return { ...answer, placement };
    }
    case "text": {
      const last = answer.parts.at(-1);
      if (last?.kind === "text") return { ...answer, parts: [...answer.parts.slice(0, -1), { kind: "text", text: last.text + e.text }] };
      return { ...answer, parts: [...answer.parts, { kind: "text", text: e.text }] };
    }
    case "tool":
      return { ...answer, status: `${e.title} …` };
    case "tool_error":
      return { ...answer, status: undefined };
    case "view":
      return { ...answer, status: undefined, parts: [...answer.parts, { kind: "view", id: e.id, form: e.form, spec: e.spec, dataset: e.dataset, ...(e.tool ? { tool: e.tool } : {}) }] };
    case "choice":
      return { ...answer, status: undefined, choice: { id: e.id, question: e.question, options: e.options, allowFreeText: e.allowFreeText } };
    case "error":
      return { ...answer, status: undefined, error: e.message };
    case "done":
      return answer;
  }
}

/** Et svar, der kun er tekst (ingen visning, menu eller fejl): kun dem følger klokkeslæt og kopiér-knap. */
export function isPureText(a: Answer): boolean {
  return !a.pending && !a.error && !a.choice && a.parts.length > 0 && a.parts.every((p) => p.kind === "text");
}

/** Svarets tekst (til Kopiér): tekstdelene med en tom linje imellem. */
export function answerText(a: Answer): string {
  return a.parts
    .filter((p): p is AnswerPart & { kind: "text" } => p.kind === "text")
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Navnet på en resultatfane ud fra den første visning (samme regler som serveren, apps/server/src/chat/agent.ts
 * fallbackTitle): lister Firmaliste, sammenligning Sammenligning, kort Kort, ellers Markedsanalyse.
 */
export function globalTitleFallback(viewName: string, spec: ViewSpec): string {
  if (viewName === "compare_companies") return "Sammenligning";
  if (viewName === "search_companies" || viewName === "search_persons" || viewName === "list_saved_pages") return "Firmaliste";
  return spec.components.some((c) => c.type === "LassoMap") ? "Kort" : "Markedsanalyse";
}

/* ---------- trådene ---------- */

/** Turen i en fane, der er sidst og har et svar her (ikke en flyttet turs stub). */
export function currentTurn(t: Threads, key: string): Turn | undefined {
  return t[key]?.turns.findLast((x) => x.notice?.kind !== "moved");
}

const mapTurns = (t: Threads, key: string, fn: (turn: Turn) => Turn): Threads => (t[key] ? { ...t, [key]: { ...t[key]!, turns: t[key]!.turns.map(fn) } } : t);

/** Et nyt spørgsmål i fanen: turen med et ventende svar. Åbne menuer i alle faner lukkes (deres valg passer ikke længere til samtalen). */
export function startTurn(t: Threads, key: string, question: string, now: number, id: string): Threads {
  const closed: Threads = Object.fromEntries(
    Object.entries(t).map(([k, tab]) => [k, tab.turns.some((x) => x.answer.choice) ? { ...tab, turns: tab.turns.map((x) => (x.answer.choice ? { ...x, answer: { ...x.answer, choice: undefined } } : x)) } : tab]),
  );
  const tab = closed[key] ?? emptyTab();
  return { ...closed, [key]: { ...tab, turns: [...tab.turns, { id, question, askedAt: now, answer: newAnswer() }] } };
}

/**
 * Serveren kunne ikke fortsætte fanens samtale (SSE-fejl med code "history_invalid"; ældre servere kun med teksten
 * "Samtalen kunne ikke fortsættes"): historikken passer ikke længere og skal ikke sendes igen.
 */
export function isHistoryInvalid(e: ChatEvent): boolean {
  return e.type === "error" && (e.code === "history_invalid" || /Samtalen kunne ikke fortsættes/i.test(e.message));
}

/** Fanen begynder en ny samtale: tom historik uden signatur, og det fulde resumé sendes igen. Turene (det synlige) bliver. */
export function resetTabHistory(t: Threads, key: string): Threads {
  const tab = t[key];
  return tab ? { ...t, [key]: { ...tab, chat: { history: [] }, sent: null } } : t;
}

/** En hændelse lagt på turens svar (turen findes i fanen key). En ugyldig historik nulstiller fanens samtale (isHistoryInvalid). */
export function applyTurnEvent(t: Threads, key: string, turnId: string, e: ChatEvent): Threads {
  if (e.type === "done") return t;
  const next = mapTurns(t, key, (x) => (x.id === turnId ? { ...x, answer: applyEvent(x.answer, e) } : x));
  return isHistoryInvalid(e) ? resetTabHistory(next, key) : next;
}

/** Turen uden at vente længere: ingen status, ikke ventende (afbrudt, fejlet eller færdig). */
export function settleTurn(t: Threads, key: string, turnId: string): Threads {
  return mapTurns(t, key, (x) => (x.id === turnId ? { ...x, answer: { ...x.answer, pending: false, status: undefined } } : x));
}

/** Stop: turen er ikke længere ventende og får "Stoppet." (kun en tur, der stadig ventede; en færdig tur røres ikke). */
export function stopTurn(t: Threads, key: string, turnId: string, at: number): Threads {
  if (!t[key]?.turns.some((x) => x.id === turnId && x.answer.pending)) return t;
  return mapTurns(t, key, (x) => (x.id === turnId ? { ...x, answer: { ...x.answer, pending: false, status: undefined, stopped: true, at: x.answer.at ?? at } } : x));
}

/** "done" for fanens ventende tur: svaret er færdigt, og fanen får serverens historik og signatur (frisk, hvis fresh). */
export type TurnDone = Extract<ChatEvent, { type: "done" }> & {
  /** Fingeraftrykket af det "Brugeren ser"-resumé, modellen nu har (null: send det fulde næste gang). */
  sent?: string | null;
  /** Hvornår svaret blev færdigt (ms). */
  at?: number;
};

export function finishTurn(t: Threads, key: string, done: TurnDone): Threads {
  const tab = t[key];
  if (!tab) return t;
  const i = tab.turns.findLastIndex((x) => x.answer.pending);
  const turns = tab.turns.map((x, k) => (k === i ? { ...x, answer: { ...x.answer, pending: false, status: undefined, placement: done.placement, ...(done.at !== undefined ? { at: done.at } : {}) } } : x));
  return { ...t, [key]: { ...tab, turns, chat: { history: done.history, sig: done.sig }, sent: done.sent === undefined ? tab.sent : done.sent } };
}

/**
 * Svaret flytter fra fanen from til fanen to: turen (med svaret og dem, der kommer) står nu i to, og i from bliver kun
 * en stub med spørgsmålet og notitsen (uden svar). Fanen to oprettes, hvis den ikke findes.
 */
export function moveTurn(t: Threads, from: string, to: string, turnId: string, notice: Notice): Threads {
  const src = t[from];
  const turn = src?.turns.find((x) => x.id === turnId);
  if (!src || !turn || from === to) return t;
  const dest = t[to] ?? emptyTab();
  // Målfanen fandtes: dens samtale huskes på notitsen, så Fortryd kan lægge den tilbage (svaret giver målfanen en frisk historik).
  const prior = t[to];
  // En åben fane uden samtale endnu (ingen tråd) husker en tom samtale, så Fortryd også dér fjerner den flyttede turs historik.
  const kept: Notice = notice.kind === "moved" && !notice.createdTab ? { ...notice, prev: prior ? { chat: prior.chat, sent: prior.sent } : { chat: { history: [] }, sent: null } } : notice;
  const stub: Turn = { ...turn, notice: kept, answer: { parts: [], pending: false } };
  return {
    ...t,
    [from]: { ...src, turns: src.turns.map((x) => (x.id === turnId ? stub : x)) },
    [to]: { ...dest, turns: [...dest.turns.filter((x) => x.id !== turnId), { ...turn, notice: undefined }] },
  };
}

/**
 * Fortryd: turen fjernes fra begge faner. Blev målfanen åbnet til turen (createdTab), fjernes dens tråd, og closeKey er den
 * fane, der skal lukkes. Er turen allerede færdig, har målfanen fået en frisk historik; den bliver (kun denne tur er væk).
 */
export function undoMove(t: Threads, from: string, turnId: string): { threads: Threads; closeKey?: string } {
  const stub = t[from]?.turns.find((x) => x.id === turnId);
  if (!stub || stub.notice?.kind !== "moved") return { threads: t };
  const { tabKey, createdTab } = stub.notice;
  const without = (tab: TabChat): TabChat => ({ ...tab, turns: tab.turns.filter((x) => x.id !== turnId) });
  const next: Threads = { ...t, [from]: without(t[from]!) };
  if (createdTab) {
    delete next[tabKey];
    return { threads: next, closeKey: tabKey };
  }
  if (next[tabKey]) {
    const prev = stub.notice.prev;
    next[tabKey] = { ...without(next[tabKey]!), ...(prev ? { chat: prev.chat, sent: prev.sent } : {}) };
  }
  return { threads: next };
}

/** "Spring over": menuen i fanens seneste tur lukkes, og intet sendes. */
export function skipChoice(t: Threads, key: string): Threads {
  const turn = t[key]?.turns.findLast((x) => x.answer.choice);
  return turn ? mapTurns(t, key, (x) => (x === turn ? { ...x, answer: { ...x.answer, choice: undefined } } : x)) : t;
}

/** Menuen, der står åben i fanen (den seneste tur med en menu), til panelet over spørgefeltet. */
export function pendingChoice(t: Threads, key: string): PendingChoice | undefined {
  return t[key]?.turns.findLast((x) => x.answer.choice)?.answer.choice;
}

/** Den seneste visning i fanens aktuelle tur (til handlinger som filtre og PDF). */
export function lastViewIn(t: Threads, key: string): Shown | undefined {
  return lastView(currentTurn(t, key)?.answer);
}

/** Erstatter den seneste visning i fanens aktuelle tur. */
export function replaceLastView(t: Threads, key: string, shown: Shown): Threads {
  const cur = currentTurn(t, key);
  return cur ? mapTurns(t, key, (x) => (x === cur ? { ...x, answer: withLastView(x.answer, shown) } : x)) : t;
}

/** Alle visninger i alle faner ændret (fx Gem/Gemt i datasættene). */
export function mapAllViews(t: Threads, fn: (shown: Shown) => Shown): Threads {
  return Object.fromEntries(Object.entries(t).map(([k, tab]) => [k, { ...tab, turns: tab.turns.map((x) => ({ ...x, answer: mapViews(x.answer, fn) })) }]));
}

/* ---------- samtalen i browseren (docs/chat.md): overlever en genindlæsning ---------- */

/**
 * Serveren gemmer ingen samtaler, så portalen gemmer selv samtalen (historik + signatur pr. fane), turene, de åbne faner
 * i localStorage, bundet til brugeren og med en udløbstid. Modulernes data gemmes ikke (de hentes igen). Historikken er
 * den trimmede (eller friske), serveren gav i "done".
 */
export const CHAT_CACHE_KEY = "lasso-chat";
export const CHAT_CACHE_TTL_MS = 24 * 60 * 60_000;

export interface ChatCache {
  v: 2;
  /** Brugerens id (boot.user.id): en anden bruger i samme browser får ikke samtalen. */
  user: string;
  savedAt: number;
  open: OpenItem[];
  active: string | null;
  tabs: Record<string, TabChat>;
}

export interface ChatCacheState {
  open: OpenItem[];
  active: string | null;
  threads: Threads;
}

/** Fortryd virker ikke efter en genindlæsning: den gemte samtale fra før flytningen gemmes ikke. */
function dropPrev(n: Extract<Notice, { kind: "moved" }>): Extract<Notice, { kind: "moved" }> {
  const { prev: _prev, ...rest } = n;
  return rest;
}

/** Det, der gemmes: kun faner, der stadig er åbne, uden status og uden en afbrudt hentning (pending). */
export function serializeCache(user: string, state: ChatCacheState, now: number): ChatCache {
  const keys = new Set(state.open.map((o) => o.key));
  const tabs = Object.fromEntries(
    Object.entries(state.threads)
      .filter(([k]) => keys.has(k))
      .map(([k, tab]) => [k, { ...tab, turns: tab.turns.filter((x) => !x.answer.pending).map((x) => ({ ...x, answer: { ...x.answer, status: undefined }, ...(x.notice?.kind === "moved" && x.notice.prev ? { notice: dropPrev(x.notice) } : {}) })) }]),
  );
  return { v: 2, user, savedAt: now, open: [...state.open], active: state.active, tabs };
}

const isTurn = (x: unknown): x is Turn => {
  const t = x as Turn | undefined;
  return Boolean(t && typeof t.id === "string" && typeof t.question === "string" && t.answer && Array.isArray(t.answer.parts));
};

/** En gemt tur klar til brug: ikke ventende, og Fortryd er udløbet (undoUntil gemmes ikke). */
const revive = (x: Turn): Turn => ({
  ...x,
  askedAt: typeof x.askedAt === "number" ? x.askedAt : 0,
  answer: { ...x.answer, pending: false },
  ...(x.notice?.kind === "moved" ? { notice: { ...dropPrev(x.notice), undoUntil: 0 } } : {}),
});

/** Samtalen fra lageret, hvis den er brugerens egen og ikke udløbet; ellers null. Version 1 (én samtale for alle faner) migreres. */
export function restoreCache(raw: string | null | undefined, user: string, now: number, ttl = CHAT_CACHE_TTL_MS): ChatCacheState | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as { v?: number; user?: string; savedAt?: number; open?: unknown; active?: unknown; tabs?: Record<string, TabChat>; chat?: ChatState; answers?: Record<string, Answer & { question?: string }> };
    if ((c.v !== 1 && c.v !== 2) || c.user !== user || typeof c.savedAt !== "number" || now - c.savedAt > ttl || now < c.savedAt) return null;
    if (!Array.isArray(c.open)) return null;
    const open = (c.open as OpenItem[]).filter((o) => Boolean(o && typeof o.key === "string" && typeof o.name === "string" && typeof o.tab === "string"));
    const active = typeof c.active === "string" && open.some((o) => o.key === c.active) ? c.active : (open.at(-1)?.key ?? null);
    let threads: Threads = {};
    if (c.v === 2) {
      if (!c.tabs || typeof c.tabs !== "object") return null;
      for (const [k, tab] of Object.entries(c.tabs)) {
        if (!tab || !tab.chat || !Array.isArray(tab.chat.history) || !Array.isArray(tab.turns)) continue;
        threads[k] = { chat: { history: tab.chat.history, ...(typeof tab.chat.sig === "string" ? { sig: tab.chat.sig } : {}) }, turns: tab.turns.filter(isTurn).map(revive), sent: typeof tab.sent === "string" ? tab.sent : null };
      }
    } else {
      // v1: ét svar pr. fane og én samtale. Svaret bliver fanens eneste tur; samtalen følger fanen, der var aktiv, så den kan fortsættes.
      if (!c.chat || !Array.isArray(c.chat.history)) return null;
      for (const [k, a] of Object.entries(c.answers ?? {})) {
        if (!a || !Array.isArray(a.parts) || !open.some((o) => o.key === k)) continue;
        const { question, ...answer } = a;
        threads[k] = { chat: { history: [] }, turns: [revive({ id: `v1-${k}`, question: typeof question === "string" ? question : "", askedAt: c.savedAt, answer })], sent: null };
      }
      const home = active ?? open.at(-1)?.key;
      if (home && c.chat.history.length) threads = { ...threads, [home]: { ...(threads[home] ?? emptyTab()), chat: { history: c.chat.history, ...(typeof c.chat.sig === "string" ? { sig: c.chat.sig } : {}) } } };
    }
    return { open, active, threads };
  } catch {
    return null;
  }
}

/** Fanerne fra den, der har været aktiv længst siden, til den aktive: rækkefølgen, datasæt droppes i ved fuldt lager. */
export function recencyOrder(open: readonly OpenItem[], visited: readonly string[], active: string | null): string[] {
  const rank = new Map<string, number>();
  [...visited, ...(active ? [active] : [])].forEach((k, i) => rank.set(k, i));
  return open.map((o) => o.key).sort((a, b) => (rank.get(a) ?? -1) - (rank.get(b) ?? -1));
}

/**
 * Fanens datasæt ude af det gemte: visningerne i dens ture droppes (teksten og spørgsmålene bliver). En firma- eller
 * personfane, der stod på Lasso-svaret, står på Overblik ved genskabelsen, og den henter selv sit modul igen.
 */
export function dropTabDatasets(cache: ChatCache, key: string): ChatCache {
  const tab = cache.tabs[key];
  if (!tab || !tab.turns.some((x) => x.answer.parts.some((p) => p.kind === "view"))) return cache;
  const turns = tab.turns.map((x) => ({ ...x, answer: { ...x.answer, parts: x.answer.parts.filter((p) => p.kind !== "view") } }));
  return {
    ...cache,
    tabs: { ...cache.tabs, [key]: { ...tab, turns } },
    open: cache.open.map((o) => (o.key === key && o.kind !== "result" && o.tab === LASSO_TAB ? { ...o, tab: "overblik" } : o)),
  };
}

/** Samtalen glemt i det gemte: tom historik og ingen signatur i hver fane (en afkortet historik ville ikke passe til signaturen), og åbne menuer lukkes (deres valg kan ikke bekræftes). */
export function resetConversation(cache: ChatCache): ChatCache {
  return {
    ...cache,
    tabs: Object.fromEntries(
      Object.entries(cache.tabs).map(([k, tab]) => [k, { chat: { history: [] }, sent: null, turns: tab.turns.map((x) => (x.answer.choice ? { ...x, answer: { ...x.answer, choice: undefined } } : x)) }]),
    ),
  };
}

/**
 * Gemmer samtalen. Historikken afkortes aldrig i det gemte: serverens signatur gælder præcis den historik, den gav
 * (HMAC over JSON), så en afkortet kopi ville give 400 ved hvert spørgsmål efter en genindlæsning. Er lageret fuldt
 * (QuotaExceeded): først droppes datasættene fra de mindst nyligt aktive faner ét ad gangen (order: ældste først;
 * fanen henter sit modul igen ved genskabelsen), så glemmes hele samtalen (tom historik, ingen signatur; faner og ture
 * bliver), og først til sidst springes gemningen over. Der prøves igen efter hvert trin.
 */
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

export function clearCache(storage: Pick<Storage, "removeItem"> | undefined): void {
  try {
    storage?.removeItem(CHAT_CACHE_KEY);
  } catch {
    // Uden lager er der intet at rydde.
  }
}
