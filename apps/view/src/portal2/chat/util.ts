import type { ViewSpec } from "@lasso/spec";
import type { ModuleTarget } from "../../chat/markdown.js";
import type { P2IconName } from "../icons.js";
import type { AnswerPart, ItemKind } from "../thread.js";

/** Tidspunktet under et svar og i fuld skærm: "09:41" (D9). */
export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type { ModuleTarget };

/** Modul-linkets ikon (koral): fokus efter emnet, et firma med bygning og en person med personikonet. */
const FOCUS_ICON: Record<string, P2IconName> = {
  overblik: "eye",
  oekonomi: "card",
  regnskab: "chart",
  ejerskab: "layers",
  ledelse: "users",
  risiko: "flag",
  historik: "doc",
  kontakt: "user",
  roller: "doc",
  netvaerk: "network",
};

export function moduleIcon(target: ModuleTarget): P2IconName {
  if (target.kind === "modul") return FOCUS_ICON[target.focus] ?? "doc";
  return target.kind === "firma" ? "build" : "user";
}

/**
 * "Tilføj som fane" (regel 5) står på hvert sidekort (form page: show_company, show_person, render_view som side, og
 * ældre svar uden tool) om fanens eget firma eller egen person, kun på firma- og personfaner. Et enkelt element (form
 * module) og globale faner får aldrig knappen.
 */
export function canAddAsTab(part: Extract<AnswerPart, { kind: "view" }>, tab: { kind: ItemKind; key: string }): boolean {
  if (part.form !== "page" || tab.kind === "result") return false;
  const one = singleEntity(part.spec);
  return one?.kind === tab.kind && one.id === tab.key;
}

/**
 * Skabelonens navn ud fra sidekortet. En side fra show_company/show_person hedder entiteten selv (titel = navnet) og har
 * modulet som undertitel ("Ejerskab"): så er undertitlen navnet, for serveren klipper navnet af titlen (og en tom titel
 * blev til "Side"). Ellers sidens titel.
 */
export function templateTitle(spec: Pick<ViewSpec, "title" | "subtitle">, entityName: string | undefined): string {
  const norm = (s: string) => s.trim().toLowerCase();
  if (entityName && norm(spec.title) === norm(entityName) && spec.subtitle?.trim()) return spec.subtitle.trim();
  return spec.title;
}

/** Målene for at forankre samtalen: elementets top og rulleområdets top (skærmkoordinater), rulleposition og højder. */
export interface ScrollBox {
  /** Top af brugerens spørgsmål (den nyeste tur) i skærmkoordinater. */
  anchorTop: number;
  /** Top af rulleområdet i skærmkoordinater. */
  viewTop: number;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Luft over spørgsmålet, når det står øverst. */
export const ANCHOR_MARGIN = 16;

/**
 * Rullepositionen, der lægger brugerens spørgsmål øverst i det synlige med en lille luft (svarets tekst og kortets top
 * står under det); aldrig ud over bunden og aldrig under 0. Et langt kort læses derfra og nedad.
 */
export function anchorScrollTop(b: ScrollBox, margin = ANCHOR_MARGIN): number {
  const max = Math.max(0, b.scrollHeight - b.clientHeight);
  return Math.min(max, Math.max(0, Math.round(b.anchorTop - b.viewTop + b.scrollTop - margin)));
}

/** Der er mere under det synlige ("Rul til nyeste" vises). */
export function moreBelow(b: Pick<ScrollBox, "scrollTop" | "scrollHeight" | "clientHeight">, slack = 48): boolean {
  return b.scrollHeight - b.scrollTop - b.clientHeight >= slack;
}

/**
 * Det ene firma eller den ene person, en side handler om (alle komponenter peger på samme), ellers null.
 * Kun en side om fanens egen entitet kan gemmes som skabelon ("Tilføj som fane").
 */
export function singleEntity(spec: ViewSpec): { kind: "company" | "person"; id: string } | null {
  const ids = new Map<string, "company" | "person">();
  for (const c of spec.components as readonly Record<string, unknown>[]) {
    if (typeof c.company === "string") ids.set(c.company, "company");
    if (typeof c.person === "string") ids.set(c.person, "person");
  }
  if (ids.size !== 1) return null;
  const [[id, kind]] = [...ids];
  return { kind, id };
}
