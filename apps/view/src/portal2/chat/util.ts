import type { ViewSpec } from "@lasso/spec";
import type { Inline } from "../../chat/markdown.js";
import type { P2IconName } from "../icons.js";

/** Tidspunktet under et svar og i fuld skærm: "09:41" (D9). */
export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export type ModuleTarget = Extract<Inline, { kind: "module" }>["target"];

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
