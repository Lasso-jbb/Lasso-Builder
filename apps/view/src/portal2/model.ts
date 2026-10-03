import type { Dataset, ViewSpec } from "@lasso/spec";
import { FOCUS_LABELS, PAGE_TABS, PERSON_FOCUSES, PERSON_FOCUS_LABELS } from "@lasso/spec";
import type { LookupResult, PageTemplate } from "../portal/api.js";
export type { PageTemplate } from "../portal/api.js";
import type { ChatContext, ChatEntityRef, ChoicePick } from "../chat/stream.js";
import { LASSO_TAB, type ItemKind, type OpenItem, type PendingChoice, type Shown } from "./thread.js";

/** Samtalens tråde, svar, turreducere og cache (thread.ts) bor i thread.ts; her genudgives det, portalen importerer herfra. */
export {
  CHAT_CACHE_KEY,
  CHAT_CACHE_TTL_MS,
  LASSO_TAB,
  answerText,
  applyEvent,
  applyTurnEvent,
  clearCache,
  currentTurn,
  dropTabDatasets,
  finishTurn,
  globalTitleFallback,
  isPureText,
  lastView,
  lastViewIn,
  mapAllViews,
  mapViews,
  moveTurn,
  newAnswer,
  pendingChoice,
  recencyOrder,
  replaceLastView,
  resetConversation,
  restoreCache,
  saveCache,
  serializeCache,
  settleTurn,
  skipChoice,
  startTurn,
  undoMove,
  withLastView,
} from "./thread.js";
export type { Answer, AnswerPart, ChatCache, ChatCacheState, ItemKind, Notice, OpenItem, PendingChoice, Shown, TabChat, Threads, Turn, TurnDone } from "./thread.js";

/**
 * Den nye portal (prototypen "lasso-portal4.html"): rene hjælpefunktioner uden React, så de kan testes
 * i node. Portalen har faner for de åbne firmaer, personer og resultater (søgning, sammenligning, lister).
 * Et firma eller en person har modulfanerne (fokus) og fanen med Lasso-mærket: det, chatten hentede.
 */

/** Serveren tager højst så mange tegn resumé (apps/server/src/chat/context.ts). */
export const VIEW_SUMMARY_MAX = 4000;

/** Modulerne på en virksomheds- og personfane (uden Lasso-mærket): fokusserne i rækkefølge. */
export const COMPANY_TABS: readonly ModuleTab[] = PAGE_TABS.map((f) => ({ id: f as string, label: FOCUS_LABELS[f] }));
export const PERSON_TABS: readonly ModuleTab[] = PERSON_FOCUSES.map((f) => ({ id: f as string, label: PERSON_FOCUS_LABELS[f] }));

export interface ModuleTab {
  id: string;
  label: string;
  /** Sat for en egen side (sideskabelon): id er tpl:<skabelon-id>. */
  template?: true;
}

/** Fanen (modulet) for en egen side: tpl:<id>. Højst 40 tegn, som serverens context.tab (UUID + "tpl:"). */
export const TEMPLATE_PREFIX = "tpl:";
export const templateTab = (id: string): string => `${TEMPLATE_PREFIX}${id}`;
export const isTemplateTab = (tab: string): boolean => tab.startsWith(TEMPLATE_PREFIX);
export const templateIdOf = (tab: string): string => tab.slice(TEMPLATE_PREFIX.length);

/**
 * Modulerne på en fane: de indbyggede (efter slagsen) og så ét pr. egen side af samme slags (key tpl:<id>, navn = sidens titel),
 * efter de indbyggede i den rækkefølge, siderne blev tilføjet. Et resultat har ingen moduler.
 */
export function moduleTabs(kind: ItemKind, templates: readonly PageTemplate[]): ModuleTab[] {
  if (kind === "result") return [];
  const own = templates.filter((t) => t.kind === kind).map((t): ModuleTab => ({ id: templateTab(t.id), label: t.title, template: true }));
  return [...(kind === "company" ? COMPANY_TABS : PERSON_TABS), ...own];
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

/**
 * Uden de opfølgende spørgsmål (LassoFollowUps): i portalen står forslagene kun under spørgefeltet (designregel 8), aldrig i
 * et modul, en egen side eller et kort i samtalen. /mcp og /chat beholder dem (de bruger ikke denne funktion). Resten af
 * visningen pakkes igen af LassoView (gitter, kolonner og grupper), så der ikke står et hul.
 */
export function withoutFollowUps(spec: ViewSpec): ViewSpec {
  const components = spec.components.filter((c) => c.type !== "LassoFollowUps");
  return components.length === spec.components.length ? spec : { ...spec, components };
}

/**
 * Uden chattens knapper til næste spørgsmål eller en anden fane (Jakob 03.10): i portalen står forslagene kun under
 * spørgefeltet. Det fjerner
 * - de opfølgende spørgsmål (LassoFollowUps),
 * - svarets bundlink videre (`answer`, 30.1-30.3: "Se hele økonomien"),
 * - "Se alle N … i <fane> →" (komponenternes `more` med et fokus; uden det folder "Se alle"/"Vis alle" ud på stedet),
 * - modulværktøjslinjens opfølgende spørgsmål (`group.toolbar`, 30.11).
 * Almindelige "Se alle"-links, der folder en liste ud, bliver. /mcp og /chat bruger ikke funktionen og beholder alt.
 */
export function withoutChatPrompts(spec: ViewSpec): ViewSpec {
  const s = withoutFollowUps(spec);
  let changed = s !== spec;
  const components = s.components.map((c) => {
    const x = c as typeof c & { more?: string; group?: { toolbar?: unknown } };
    const dropMore = typeof x.more === "string" && x.more !== "expand";
    const dropToolbar = Boolean(x.group && "toolbar" in x.group);
    if (!dropMore && !dropToolbar) return c;
    changed = true;
    const { more: _more, ...rest } = x;
    const out = dropMore ? rest : x;
    if (!dropToolbar) return out as typeof c;
    const { toolbar: _toolbar, ...group } = x.group!;
    return { ...out, group } as typeof c;
  });
  if ("answer" in s && s.answer !== undefined) changed = true;
  if (!changed) return spec;
  const { answer: _answer, ...base } = s;
  return { ...base, components } as ViewSpec;
}

/** Visningen, som portalen tegner den: ingen chatknapper (withoutChatPrompts), og uden eget hoved på en firma- eller personfane (head: false). */
export function forPortal(spec: ViewSpec, { head = true }: { head?: boolean } = {}): ViewSpec {
  const s = withoutChatPrompts(spec);
  return head ? s : withoutHead(s);
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

/** Navnet på en resultatfane uden bedre navn: spørgsmålet afkortet til højst 40 tegn ved et ordskel. */
export function shortName(text: string, max = 40): string {
  const t = text.trim().replace(/\s+/g, " ").replace(/[?!.]+$/, "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max / 2 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** Serveren afviser navne og titler over 200 tegn (hele konteksten giver 400), så klienten afkorter. */
export const CONTEXT_NAME_MAX = 200;
const clip = (t: string): string => t.slice(0, CONTEXT_NAME_MAX);

const entityRef = (o: OpenItem): ChatEntityRef | null => (o.kind === "result" ? null : { kind: o.kind, id: o.key, name: clip(o.name) });

/**
 * Konteksten til chatten (docs/chat.md): den fane, brugeren står på (et resultat tæller som globalt), de
 * åbne firmaer og personer (højst 20), og det valg, brugeren lige traf i menuen. Serveren svarer altid i
 * den aktive kontekst, så "hvem ejer den?" virker uden at navnet gentages.
 */
/** Resuméet, der sendes som "Brugeren ser": kun på et modul (ikke på Lasso-fanen, som er chattens eget svar), afkortet til serverens grænse. */
function viewSummary(item: OpenItem | undefined, shown: Shown | undefined): string {
  return item && item.kind !== "result" && item.tab !== LASSO_TAB && shown?.summary ? shown.summary.slice(0, VIEW_SUMMARY_MAX) : "";
}

/** Lille, stabil hash (djb2) af en tekst, til fingeraftrykket. */
export function textHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * Fingeraftryk af det, brugeren ser (fane, modul, resumé). Er det det samme, som sidst blev sendt i samtalen, sendes
 * kun same: true (docs/chat.md, tokens): historikken har allerede det fulde resumé. null uden resumé.
 */
export function summaryFingerprint(item: OpenItem | undefined, shown: Shown | undefined): string | null {
  const summary = viewSummary(item, shown);
  return summary && item ? `${item.key}:${item.tab}:${textHash(summary)}` : null;
}

/** Om serveren trimmede historikken (de ældste ture kastes forfra): så har modellen måske ikke det tidligere resumé længere. */
export function historyTrimmed(sent: readonly unknown[], returned: readonly unknown[]): boolean {
  if (!sent.length) return false;
  return !returned.length || JSON.stringify(returned[0]) !== JSON.stringify(sent[0]);
}

export function contextFor(item: OpenItem | undefined, open: readonly OpenItem[], pick?: ChoicePick, shown?: Shown, lastSent?: string | null): ChatContext {
  // Det, brugeren ser: modulets resumé fra serveren, eller kun "uændret", når præcis det samme allerede er sendt i samtalen.
  const summary = viewSummary(item, shown);
  const fp = summaryFingerprint(item, shown);
  const view = summary && item ? { view: fp && fp === lastSent ? { module: item.tab, same: true } : { module: item.tab, summary } } : {};
  const active: ChatContext["active"] = !item ? { kind: "global" } : item.kind === "result" ? { kind: "global", title: clip(item.name) } : { kind: item.kind, id: item.key, name: clip(item.name), tab: item.tab, ...view };
  const refs = open.map(entityRef).filter((e): e is ChatEntityRef => e !== null).slice(0, 20);
  return { active, open: refs, ...(pick ? { choice: pick } : {}) };
}

/** Et punkt i menuen: beskeden, der sendes (punktets prompt, ellers teksten), og valget til konteksten. */
export function choiceMessage(choice: PendingChoice, index: number): { message: string; pick: ChoicePick } | null {
  const option = choice.options[index];
  if (!option) return null;
  return { message: option.action.prompt ?? option.label, pick: { id: choice.id, index, action: option.action } };
}

/** Valget i panelet: et punkt (index) eller "Andet" (fritekst i panelet). */
export type ChoiceSelection = number | "other";

/** Forvalgt punkt: det anbefalede, ellers det første. */
export function defaultChoiceSelection(choice: PendingChoice): number {
  const i = choice.options.findIndex((o) => o.recommended);
  return i >= 0 ? i : 0;
}

/** Det, "Send" sender: punktets prompt og valg, eller "Andet"-teksten som fritekst. null, når der intet er at sende. */
export function choiceSend(choice: PendingChoice, selection: ChoiceSelection, otherText: string): { message: string; pick: ChoicePick } | null {
  if (selection !== "other") return choiceMessage(choice, selection);
  const text = otherText.trim();
  const pick = freeTextPick(choice);
  return text && pick ? { message: text, pick } : null;
}

export type ChoiceKey = { kind: "select"; selection: ChoiceSelection } | { kind: "send" } | { kind: "skip" };

/**
 * Tastaturet i panelet: 1–9 vælger punktet (tallet efter punkterne er "Andet"), Cmd/Ctrl+Enter sender, Esc springer over.
 * Tal tastes kun som genvej, når fokus ikke står i et tekstfelt (inField). scope: "panel" = fokus er i panelet (alle
 * taster); "body" = fokus er på siden uden for felter (kun tal; Esc og Cmd/Ctrl+Enter hører til panelet, ellers kan en
 * Esc, der lukker noget andet, springe menuen over). otherField: fokus er i "Andet"-feltet, hvor almindelig Enter sender.
 */
export function choiceKey(
  e: { key: string; metaKey: boolean; ctrlKey: boolean },
  choice: PendingChoice,
  inField: boolean,
  scope: "panel" | "body" = "panel",
  otherField = false,
): ChoiceKey | null {
  if (scope === "panel") {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || (otherField && inField))) return { kind: "send" };
    if (e.key === "Escape") return { kind: "skip" };
  }
  if (inField || e.metaKey || e.ctrlKey || !/^[1-9]$/.test(e.key)) return null;
  const n = Number(e.key) - 1;
  if (n < choice.options.length) return { kind: "select", selection: n };
  return n === choice.options.length && choice.allowFreeText !== false ? { kind: "select", selection: "other" } : null;
}

/** Fritekst i stedet for et punkt: beskeden er det, brugeren skrev. Kun når menuen tillader det; ellers intet valg (spørgsmålet besvares her). */
export function freeTextPick(choice: PendingChoice): ChoicePick | undefined {
  return choice.allowFreeText === false ? undefined : { id: choice.id, free: true };
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
  [LASSO_TAB]: (n) => ["Hvordan går det økonomisk?", `Hvem ejer ${n}?`, "Er der røde flag?"],
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

/** Serveren kender ikke historikken (ændret, anden bruger eller ny hemmelighed): klienten skal begynde en ny samtale. */
export const isUnrecognizedHistory = (status: number, message: string): boolean => status === 400 && /kunne ikke genkendes/.test(message);
