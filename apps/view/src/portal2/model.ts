import type { Dataset, ViewSpec } from "@lasso/spec";
import type { LookupResult } from "../portal/api.js";
import type { ChatContext, ChatEntityRef, ChatEvent, ChatState, ChoiceOption, ChoicePick, Placement, ViewForm } from "../chat/stream.js";

/**
 * Den nye portal (prototypen "lasso-portal4.html"): rene hjælpefunktioner uden React, så de kan testes
 * i node. Portalen har faner for de åbne firmaer, personer og resultater (søgning, sammenligning, lister).
 * Et firma eller en person har modulfanerne (fokus) og fanen med Lasso-mærket: det, chatten hentede.
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

/** Serveren tager højst så mange tegn resumé (apps/server/src/chat/context.ts). */
export const VIEW_SUMMARY_MAX = 4000;

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
export type AnswerPart = { kind: "text"; text: string } | ({ kind: "view"; id: string; form: ViewForm } & Shown);

/** Hvad chatten svarede på en fane: spørgsmålet og delene (tekst og visninger) i rækkefølge. */
export interface Answer {
  question: string;
  parts: AnswerPart[];
  /** "Vis virksomhed …", mens værktøjet henter. */
  status?: string;
  error?: string;
  pending: boolean;
  /** Hvor serveren skriver svaret (første hændelse i turen). */
  placement?: Placement;
  /** Valgmenuen, serveren bad om; står, til brugeren vælger eller spørger om noget andet. */
  choice?: PendingChoice;
}

export const newAnswer = (question: string): Answer => ({ question, parts: [], pending: true });

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

/** Ren reducer: én hændelse fra /api/chat lagt på svaret. Tekst føjes til den sidste tekstdel; visninger kommer i rækkefølge. */
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
      return { ...answer, status: undefined, parts: [...answer.parts, { kind: "view", id: e.id, form: e.form, spec: e.spec, dataset: e.dataset }] };
    case "choice":
      return { ...answer, status: undefined, choice: { id: e.id, question: e.question, options: e.options, allowFreeText: e.allowFreeText } };
    case "error":
      return { ...answer, status: undefined, error: e.message };
    case "done":
      return { ...answer, status: undefined, pending: false, placement: e.placement };
  }
}

export function openItem(list: readonly OpenItem[], item: OpenItem): OpenItem[] {
  const i = list.findIndex((o) => o.key === item.key);
  if (i < 0) return [...list, item];
  return list.map((o, k) => (k === i ? { ...o, ...item, sub: item.sub ?? o.sub } : o));
}

/** Lukker en fane; den aktive bliver naboen til venstre (eller den første). */
export function closeItem(list: readonly OpenItem[], key: string, active: string | null): { list: OpenItem[]; active: string | null } {
  const i = list.findIndex((o) => o.key === key);
  if (i < 0) return { list: [...list], active };
  const next = list.filter((o) => o.key !== key);
  if (active !== key) return { list: next, active };
  return { list: next, active: next[Math.max(0, i - 1)]?.key ?? null };
}

/** Hovedet tegnes af portalen selv (navnet står i fanen, adresse og CVR i fanens tooltip), så visningens eget hoved udelades. */
export function withoutHead(spec: ViewSpec): ViewSpec {
  const components = spec.components.filter((c) => c.type !== "LassoCompanyHead" && c.type !== "LassoPersonHead");
  return components.length === spec.components.length || components.length === 0 ? spec : { ...spec, components };
}

/** Identitetslinjerne: adresse, og CVR, telefon og web, som i prototypen. */
export function headLines(kind: ItemKind, id: string, ds: Dataset | undefined): string[] {
  if (!ds || kind === "result") return [];
  if (kind === "person") {
    const p = ds.persons[id] as { city?: string; address?: { city?: string } } | undefined;
    const city = p?.city ?? p?.address?.city;
    return city ? [city] : [];
  }
  const c = ds.companies[id];
  if (!c) return [];
  const a = c.address;
  const address = a ? [a.street, [a.zip, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  const contact = [c.cvr ? `CVR: ${c.cvr}` : "", c.phone ? `Telefon: ${c.phone}` : "", c.website ? c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : ""].filter(Boolean).join(", ");
  return [address, contact].filter(Boolean);
}

/** Valgmenuen, serveren bad om ("choice"-hændelsen): vises over spørgefeltet, til brugeren vælger. */
export interface PendingChoice {
  id: string;
  question: string;
  options: ChoiceOption[];
  allowFreeText: boolean;
}

/** Navnet på en resultatfane uden bedre navn: spørgsmålet afkortet til højst 40 tegn ved et ordskel. */
export function shortName(text: string, max = 40): string {
  const t = text.trim().replace(/\s+/g, " ").replace(/[?!.]+$/, "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max / 2 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

const entityRef = (o: OpenItem): ChatEntityRef | null => (o.kind === "result" ? null : { kind: o.kind, id: o.key, name: o.name });

/**
 * Konteksten til chatten (docs/chat.md): den fane, brugeren står på (et resultat tæller som globalt), de
 * åbne firmaer og personer (højst 20), og det valg, brugeren lige traf i menuen. Serveren svarer altid i
 * den aktive kontekst, så "hvem ejer den?" virker uden at navnet gentages.
 */
export function contextFor(item: OpenItem | undefined, open: readonly OpenItem[], pick?: ChoicePick, shown?: Shown): ChatContext {
  // Det, brugeren ser: modulets resumé fra serveren (ikke på Lasso-fanen, som er chattens eget svar).
  const summary = item && item.kind !== "result" && item.tab !== LASSO_TAB && shown?.summary ? shown.summary.slice(0, VIEW_SUMMARY_MAX) : "";
  const view = summary && item ? { view: { module: item.tab, summary } } : {};
  const active: ChatContext["active"] = !item ? { kind: "global" } : item.kind === "result" ? { kind: "global", title: item.name } : { kind: item.kind, id: item.key, name: item.name, tab: item.tab, ...view };
  const refs = open.map(entityRef).filter((e): e is ChatEntityRef => e !== null).slice(0, 20);
  return { active, open: refs, ...(pick ? { choice: pick } : {}) };
}

/** Et punkt i menuen: beskeden, der sendes (punktets prompt, ellers teksten), og valget til konteksten. */
export function choiceMessage(choice: PendingChoice, index: number): { message: string; pick: ChoicePick } | null {
  const option = choice.options[index];
  if (!option) return null;
  return { message: option.action.prompt ?? option.label, pick: { id: choice.id, index, action: option.action } };
}

/** Fritekst i stedet for et punkt: beskeden er det, brugeren skrev. */
export function freeTextPick(choice: PendingChoice): ChoicePick {
  return { id: choice.id, free: true };
}

/** Forslagene under spørgefeltet: de følger siden, man står på (firma eller person, og modulet). */
const COMPANY_SUGGESTIONS: Record<string, (n: string) => string[]> = {
  overblik: (n) => [`Hvordan går det økonomisk med ${n}?`, `Hvem ejer ${n}?`, "Er der røde flag?"],
  oekonomi: () => ["Hvordan har overskuddet udviklet sig?", "Hvordan er soliditeten?", "Sammenlign med branchen"],
  regnskab: () => ["Hvad er de vigtigste tal i seneste regnskab?", "Har revisor taget forbehold?", "Hvordan har egenkapitalen udviklet sig?"],
  ejerskab: (n) => [`Hvem er de reelle ejere af ${n}?`, "Hvilke datterselskaber er der?", "Er der sket ejerskifte for nylig?"],
  risiko: () => ["Er der røde flag?", "Har ledelsen været involveret i konkurser?", "Hvordan er betalingsevnen?"],
  historik: () => ["Hvad er der sket det seneste år?", "Hvornår skiftede ledelsen sidst?", "Er der nyheder om firmaet?"],
  kontakt: () => ["Hvem sidder i ledelsen?", "Hvem sidder i bestyrelsen?", "Hvem er revisor?"],
  ledelse: () => ["Hvem sidder i ledelsen?", "Hvem sidder i bestyrelsen?", "Hvem er revisor?"],
  [LASSO_TAB]: (n) => [`Hvem ejer ${n}?`, "Er der røde flag?", "Sammenlign med de største konkurrenter"],
};
const PERSON_SUGGESTIONS: Record<string, (n: string) => string[]> = {
  overblik: (n) => [`Hvilke selskaber er ${n} involveret i?`, "Hvem sidder personen sammen med?", "Har der været konkurser?"],
  roller: () => ["Hvilke roller er aktive nu?", "Hvilke roller er ophørt?", "Hvor længe har personen siddet i ledelser?"],
  netvaerk: (n) => [`Hvem sidder ${n} oftest sammen med?`, "Hvilke bestyrelser deler de?", "Hvem i netværket er revisorer?"],
  ejerskab: (n) => [`Hvilke selskaber ejer ${n}?`, "Hvor store er ejerandelene?", "Hvordan går det økonomisk i selskaberne?"],
  risiko: () => ["Har der været konkurser?", "Har der været tvangsopløsninger?", "Er der røde flag i selskaberne?"],
  historik: (n) => [`Hvad er der sket med ${n} det seneste år?`, "Er der nyheder om personen?", "Hvornår kom de nyeste roller til?"],
  [LASSO_TAB]: (n) => [`Hvilke selskaber er ${n} involveret i?`, "Hvem sidder personen sammen med?", "Har der været konkurser?"],
};

export function suggestions(item: OpenItem | undefined): string[] {
  if (item?.kind === "company") return (COMPANY_SUGGESTIONS[item.tab] ?? COMPANY_SUGGESTIONS.overblik!)(item.name);
  if (item?.kind === "person") return (PERSON_SUGGESTIONS[item.tab] ?? PERSON_SUGGESTIONS.overblik!)(item.name);
  if (item?.kind === "result") return ["Vis kun de største", "Sorter efter omsætning", "Hvilke er vokset mest?"];
  return ["Hvordan går det økonomisk med Novo Nordisk?", "Revisorer i Aarhus med mindst 10 ansatte", "Sammenlign Carlsberg og Royal Unibrew"];
}

/** Spørgefeltet hedder altid "Spørg Lasso", uanset siden. */
export function askPlaceholder(_item?: OpenItem): string {
  return "Spørg Lasso";
}

/* ---------- søgefeltet ---------- */

export type SearchType = "f" | "p";
export type StatusFilter = "Aktive" | "Inaktive" | "Alle";
export const STATUS_FILTERS: readonly StatusFilter[] = ["Aktive", "Inaktive", "Alle"];

/** Én række i søgeresultaterne (firma eller person). */
export interface SearchRow {
  kind: "company" | "person";
  id: string;
  name: string;
  /** "Bagsværd, CVR 24256790" eller byen. */
  meta: string;
  /** "Ophørt" o.l. for et inaktivt firma. */
  status?: string;
}

/** Genvejene på et firma i søgeresultaterne: åbn direkte i et modul. */
export const SHORTCUTS: readonly { label: string; tab: string; icon: "chart" | "org" | "news" }[] = [
  { label: "Økonomi", tab: "oekonomi", icon: "chart" },
  { label: "Ejerskab", tab: "ejerskab", icon: "org" },
  { label: "Historik", tab: "historik", icon: "news" },
];

export function searchRows(r: LookupResult | undefined, type: SearchType, status: StatusFilter): SearchRow[] {
  if (!r) return [];
  if (type === "p") return r.persons.map((p) => ({ kind: "person", id: p.lassoId, name: p.name, meta: p.city ?? "" }));
  return r.companies
    .filter((c) => status === "Alle" || (status === "Aktive" ? c.statusKind !== "inactive" : c.statusKind === "inactive"))
    .map((c) => ({ kind: "company", id: c.lassoId, name: c.name, meta: [c.city, c.cvr ? `CVR ${c.cvr}` : ""].filter(Boolean).join(", "), ...(c.statusKind === "inactive" && c.status ? { status: c.status } : {}) }));
}

/** Antal pr. fane i søgeresultaterne (firmaer efter statusfilteret). */
export function searchCounts(r: LookupResult | undefined, status: StatusFilter): Record<SearchType, number> {
  return { f: searchRows(r, "f", status).length, p: searchRows(r, "p", status).length };
}

/** Navnet delt om det søgte (fremhævet med fed), uden HTML. */
export function highlight(name: string, q: string): { pre: string; hit: string; post: string } {
  const i = q ? name.toLowerCase().indexOf(q.trim().toLowerCase()) : -1;
  if (i < 0) return { pre: name, hit: "", post: "" };
  const n = q.trim().length;
  return { pre: name.slice(0, i), hit: name.slice(i, i + n), post: name.slice(i + n) };
}

/* ---------- seneste (søgefeltet uden tekst) ---------- */

export interface RecentItem {
  kind: "company" | "person";
  id: string;
  name: string;
  meta: string;
}

const RECENT_KEY = "lasso-recent";
const RECENT_MAX = 8;

export function loadRecent(storage: Pick<Storage, "getItem"> | undefined): RecentItem[] {
  try {
    const raw = storage?.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as RecentItem[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === "string" && typeof r.name === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function addRecent(list: readonly RecentItem[], item: RecentItem): RecentItem[] {
  return [item, ...list.filter((r) => r.id !== item.id)].slice(0, RECENT_MAX);
}

export function saveRecent(storage: Pick<Storage, "setItem"> | undefined, list: readonly RecentItem[]): void {
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Uden lager huskes de seneste bare ikke.
  }
}

/* ---------- chatten i browseren (docs/chat.md): samtalen overlever en genindlæsning ---------- */

/**
 * Serveren gemmer ingen samtaler, så portalen gemmer selv samtalen (historik + signatur), de åbne faner og det
 * seneste svar pr. fane i localStorage, bundet til brugeren og med en udløbstid. Modulernes data gemmes ikke
 * (de hentes igen). Historikken er den trimmede, serveren gav i "done".
 */
export const CHAT_CACHE_KEY = "lasso-chat";
export const CHAT_CACHE_TTL_MS = 24 * 60 * 60_000;

export interface ChatCache {
  v: 1;
  /** Brugerens id (boot.user.id): en anden bruger i samme browser får ikke samtalen. */
  user: string;
  savedAt: number;
  chat: ChatState;
  open: OpenItem[];
  active: string | null;
  answers: Record<string, Answer>;
}

export type ChatCacheState = Pick<ChatCache, "chat" | "open" | "answers" | "active">;

/** Det, der gemmes: svar uden status og uden en afbrudt hentning (pending), kun for faner, der stadig er åbne. */
export function serializeCache(user: string, state: ChatCacheState, now: number): ChatCache {
  const keys = new Set(state.open.map((o) => o.key));
  const answers = Object.fromEntries(
    Object.entries(state.answers)
      .filter(([k, a]) => keys.has(k) && !a.pending)
      .map(([k, a]) => [k, { ...a, status: undefined }]),
  );
  return { v: 1, user, savedAt: now, chat: state.chat, open: [...state.open], active: state.active, answers };
}

/** Samtalen fra lageret, hvis den er brugerens egen og ikke udløbet; ellers null. */
export function restoreCache(raw: string | null | undefined, user: string, now: number, ttl = CHAT_CACHE_TTL_MS): ChatCacheState | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Partial<ChatCache>;
    if (c.v !== 1 || c.user !== user || typeof c.savedAt !== "number" || now - c.savedAt > ttl || now < c.savedAt) return null;
    if (!Array.isArray(c.open) || !c.chat || !Array.isArray(c.chat.history)) return null;
    const open = c.open.filter((o): o is OpenItem => Boolean(o && typeof o.key === "string" && typeof o.name === "string" && typeof o.tab === "string"));
    const answers = Object.fromEntries(Object.entries(c.answers ?? {}).filter(([, a]) => a && Array.isArray(a.parts)).map(([k, a]) => [k, { ...a, pending: false }]));
    const active = typeof c.active === "string" && open.some((o) => o.key === c.active) ? c.active : (open.at(-1)?.key ?? null);
    return { chat: { history: c.chat.history, ...(typeof c.chat.sig === "string" ? { sig: c.chat.sig } : {}) }, open, answers, active };
  } catch {
    return null;
  }
}

type HistoryMessage = { role?: string; content?: unknown };

/** En brugerbesked, der er et spørgsmål (ikke værktøjssvar): dér begynder en tur. */
const startsTurn = (m: HistoryMessage) => m.role === "user" && !(Array.isArray(m.content) && m.content.some((b) => (b as { type?: string })?.type === "tool_result"));

/** Historikken uden de ældste `turns` hele ture (spørgsmål + svar + værktøjsskifte); tool_use og tool_result skilles aldrig. */
export function dropOldestTurns(history: readonly unknown[], turns: number): unknown[] {
  if (turns <= 0) return [...history];
  const starts = history.map((m, i) => (startsTurn(m as HistoryMessage) ? i : -1)).filter((i) => i >= 0);
  const keepFrom = starts[turns];
  return keepFrom === undefined ? [] : history.slice(keepFrom);
}

export const countTurns = (history: readonly unknown[]): number => history.filter((m) => startsTurn(m as HistoryMessage)).length;

/** Fanerne fra den, der har været aktiv længst siden, til den aktive: rækkefølgen, datasæt droppes i ved fuldt lager. */
export function recencyOrder(open: readonly OpenItem[], visited: readonly string[], active: string | null): string[] {
  const rank = new Map<string, number>();
  [...visited, ...(active ? [active] : [])].forEach((k, i) => rank.set(k, i));
  return open.map((o) => o.key).sort((a, b) => (rank.get(a) ?? -1) - (rank.get(b) ?? -1));
}

/**
 * Fanens datasæt ude af det gemte: visningerne i dens svar droppes (teksten og spørgsmålet bliver). En firma- eller
 * personfane, der stod på Lasso-svaret, står på Overblik ved genskabelsen, og den henter selv sit modul igen.
 */
export function dropTabDatasets(cache: ChatCache, key: string): ChatCache {
  const answer = cache.answers[key];
  if (!answer || !answer.parts.some((p) => p.kind === "view")) return cache;
  const stripped: Answer = { ...answer, parts: answer.parts.filter((p) => p.kind !== "view") };
  return {
    ...cache,
    answers: { ...cache.answers, [key]: stripped },
    open: cache.open.map((o) => (o.key === key && o.kind !== "result" && o.tab === LASSO_TAB ? { ...o, tab: "overblik" } : o)),
  };
}

/**
 * Gemmer samtalen. Er lageret fuldt (QuotaExceeded): først kastes den ældste halvdel af turene (hele ture), så droppes
 * datasættene fra de mindst nyligt aktive faner ét ad gangen (order: ældste først; fanen henter sit modul igen ved
 * genskabelsen), og der prøves igen efter hvert trin. Først til sidst springes gemningen over.
 */
export function saveCache(storage: Pick<Storage, "setItem"> | undefined, cache: ChatCache, order: readonly string[] = []): "saved" | "trimmed" | "dropped" | "skipped" {
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
  const turns = countTurns(cache.chat.history);
  if (turns >= 2) {
    next = { ...cache, chat: { ...cache.chat, history: dropOldestTurns(cache.chat.history, Math.ceil(turns / 2)) } };
    if (tryWrite(next)) return "trimmed";
  }
  for (const key of order) {
    const smaller = dropTabDatasets(next, key);
    if (smaller === next) continue;
    next = smaller;
    if (tryWrite(next)) return "dropped";
  }
  return "skipped";
}

export function clearCache(storage: Pick<Storage, "removeItem"> | undefined): void {
  try {
    storage?.removeItem(CHAT_CACHE_KEY);
  } catch {
    // Uden lager er der intet at rydde.
  }
}
