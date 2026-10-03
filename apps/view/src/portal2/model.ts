import type { Dataset, ViewSpec } from "@lasso/spec";
import type { LookupResult } from "../portal/api.js";
import type { ChatContext, ChatEntityRef, ChoiceOption, ChoicePick } from "../chat/stream.js";

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

/** Hvad chatten svarede på en fane: spørgsmålet, Claudes tekst og visningen. */
export interface Answer {
  question: string;
  text: string;
  /** "Vis virksomhed …", mens værktøjet henter. */
  status?: string;
  error?: string;
  view?: Shown;
  pending: boolean;
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

const entityRef = (o: OpenItem): ChatEntityRef | null => (o.kind === "result" ? null : { kind: o.kind, id: o.key, name: o.name });

/**
 * Konteksten til chatten (docs/chat.md): den fane, brugeren står på (et resultat tæller som globalt), de
 * åbne firmaer og personer (højst 20), og det valg, brugeren lige traf i menuen. Serveren svarer altid i
 * den aktive kontekst, så "hvem ejer den?" virker uden at navnet gentages.
 */
export function contextFor(item: OpenItem | undefined, open: readonly OpenItem[], pick?: ChoicePick): ChatContext {
  const active: ChatContext["active"] = !item ? { kind: "global" } : item.kind === "result" ? { kind: "global", title: item.name } : { kind: item.kind, id: item.key, name: item.name, tab: item.tab };
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
