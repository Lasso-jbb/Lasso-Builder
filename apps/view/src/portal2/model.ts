import type { Dataset, ViewSpec } from "@lasso/spec";
import type { LookupResult } from "../portal/api.js";

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

/** Hovedet tegnes af portalen selv (navn i fanen, adresse og CVR i identitetslinjen), så visningens eget hoved udelades. */
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

/**
 * Beskeden til chatten. Kigger brugeren på et andet firma eller en anden person end den, samtalen sidst
 * handlede om (fx efter et klik i søgningen), får Claude det at vide, så "hvem ejer den?" virker.
 */
export function messageFor(text: string, item: OpenItem | undefined, lastEntityId: string | undefined): string {
  if (!item || item.kind === "result" || item.key === lastEntityId) return text;
  return `${text}\n\n(Kontekst: brugeren kigger på ${item.name}, ${item.key}.)`;
}

/** Forslagene under spørgefeltet. */
export function suggestions(item: OpenItem | undefined): string[] {
  if (item?.kind === "company") return ["Hvordan går det økonomisk?", `Hvem ejer ${item.name}?`, "Er der røde flag?"];
  if (item?.kind === "person") return [`Hvilke selskaber er ${item.name} involveret i?`, "Hvem sidder personen sammen med?", "Har der været konkurser?"];
  return ["Hvordan går det økonomisk med Novo Nordisk?", "Revisorer i Aarhus med mindst 10 ansatte", "Sammenlign Carlsberg og Royal Unibrew"];
}

export function askPlaceholder(item: OpenItem | undefined): string {
  return item && item.kind !== "result" ? `Spørg om ${item.name}` : "Spørg Lasso om en virksomhed, en person eller en målgruppe";
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
