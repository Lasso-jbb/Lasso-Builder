/**
 * Genererer docs/komponenter.md fra komponentregisteret (plan A9, Ø3): dokumentationen skrives aldrig
 * i hånden. Kilder: COMPONENT_CATALOG (titel, props, register) og GRID_RULES (std/min/max).
 * Kommando: npm run docs:komponenter -w @lasso/spec
 */
import { COMPONENT_CATALOG, GRID_RULES, GRID_VARIANT_RULES, GRID_WIDTH_LABEL, type CatalogEntry } from "./catalog.js";
import { DEFAULT_WIDTH, type ComponentType } from "./spec.js";
import type { LiveAvailability, Route, WidthProfile, ContentWidthDrivers } from "./register.js";

export const KOMPONENTER_COMMAND = "npm run docs:komponenter -w @lasso/spec";
const MISSING = "⚠ mangler register";

const LIVE_LABEL: Record<LiveAvailability, string> = {
  altid: "altid",
  "naar-data": "når data findes",
  abonnement: "kræver abonnement",
  modul: "kræver Lasso-modul",
  "ikke-endnu": "ikke koblet på endnu",
};
const ROUTE_LABEL: Record<Route, string> = {
  ask: "ask (spørgsmål)",
  focus: "focus",
  person: "show_person",
  render_view: "render_view",
  search_companies: "search_companies",
  search_persons: "search_persons",
  compare_companies: "compare_companies",
  saved: "gemte sider",
};
const PROFILE_LABEL: Record<WidthProfile, string> = { bred: "bred", smal: "smal", fleksibel: "fleksibel" };

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const bullets = (xs: readonly string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- (ingen)");

/** Alle spec-typer i katalogets rækkefølge; typer uden katalogpost (endnu) tages med til sidst, så de aldrig forsvinder fra dokumentet. */
function entries(): CatalogEntry[] {
  const listed = new Set<ComponentType>(COMPONENT_CATALOG.map((e) => e.type));
  const orphans = (Object.keys(DEFAULT_WIDTH) as ComponentType[]).filter((t) => !listed.has(t));
  return [...COMPONENT_CATALOG, ...orphans.map((type): CatalogEntry => ({ type, title: type, description: "", props: "⚠ mangler katalogpost" }))];
}

function widthTriple(e: CatalogEntry): string {
  const r = GRID_RULES[e.type];
  return `${GRID_WIDTH_LABEL[r.std]} / ${GRID_WIDTH_LABEL[r.min]} / ${GRID_WIDTH_LABEL[r.max]}`;
}

function drivers(d: ContentWidthDrivers | undefined): string {
  if (!d) return "ingen";
  const parts: string[] = [];
  if (d.rowsPerItem !== undefined) parts.push(`${d.rowsPerItem} rækker pr. post`);
  if (d.longestLabel !== undefined) parts.push(`længste etiket ${d.longestLabel} tegn`);
  if (d.timeAxis) parts.push("tidsakse");
  if (d.series !== undefined) parts.push(`${d.series} serier side om side`);
  return parts.length ? parts.join(", ") : "ingen";
}

/** Varianter med egen profil og egen række i elementtabellen (fx PersonRoles som liste), Ø13/B8. */
function variantLines(e: CatalogEntry): string[] {
  const v = e.register?.bredde.varianter;
  if (!v) return [];
  const rows = Object.entries(v).map(([key, b]) => {
    const r = GRID_VARIANT_RULES[`${e.type} ${key}`];
    const w = r ? `; std ${GRID_WIDTH_LABEL[r.std]}, min ${GRID_WIDTH_LABEL[r.min]}, maks ${GRID_WIDTH_LABEL[r.max]}` : "";
    return `- \`${key}\`: profil ${PROFILE_LABEL[b.profil]}${w}; drivere: ${drivers(b.drivere)}`;
  });
  return ["**Bredde pr. variant.**", ...rows, ""];
}

function section(e: CatalogEntry): string {
  const reg = e.register;
  const out: string[] = [`<a id="${e.type}"></a>`, `## ${e.title} (\`${e.type}\`)`, ""];
  if (!reg) {
    out.push(`**${MISSING}**`, "");
  } else {
    out.push(`**Formål.** ${reg.formaal}`, "", "**Bedst til**", bullets(reg.bedstTil), "", "**Undgå når**", bullets(reg.undgaaNaar), "");
    out.push(`**Veje ind.** ${reg.veje.length ? reg.veje.map((v) => ROUTE_LABEL[v]).join(", ") : "(ingen)"}`, "");
    out.push(`**Kræver data (Dataset).** ${reg.kraeverData.length ? reg.kraeverData.map((k) => `\`${k}\``).join(", ") : "ingen"}`, "");
    out.push(`**Live-tilgængelighed.** ${LIVE_LABEL[reg.live]}${reg.liveNote ? ` — ${reg.liveNote}` : ""}`, "");
  }
  const r = GRID_RULES[e.type];
  out.push(
    `**Bredde.** ${reg ? `profil ${PROFILE_LABEL[reg.bredde.profil]}; ` : `profil ${MISSING}; `}std ${GRID_WIDTH_LABEL[r.std]}, min ${GRID_WIDTH_LABEL[r.min]}, maks ${GRID_WIDTH_LABEL[r.max]}${reg ? `; drivere: ${drivers(reg.bredde.drivere)}` : ""}`,
    "",
    ...variantLines(e),
    `**Props.** \`${e.props}\``,
    "",
  );
  return out.join("\n");
}

function overview(): string {
  const rows = entries().map((e) => {
    const reg = e.register;
    const variants = reg?.bredde.varianter ? ` (${Object.entries(reg.bredde.varianter).map(([k, b]) => `${k}: ${PROFILE_LABEL[b.profil]}`).join(", ")})` : "";
    return `| \`${e.type}\` | ${reg ? PROFILE_LABEL[reg.bredde.profil] + variants : MISSING} | ${widthTriple(e)} | ${reg ? LIVE_LABEL[reg.live] : MISSING} | ${reg ? cell(reg.veje.join(", ")) : MISSING} |`;
  });
  return ["## Oversigt", "", "| Type | Profil | std/min/max | Live | Veje |", "|---|---|---|---|---|", ...rows, ""].join("\n");
}

export function komponenterMarkdown(): string {
  const lines: string[] = [
    "# Komponenter",
    "",
    `Denne fil er genereret fra komponentregisteret (\`packages/spec/src/catalog.ts\`) og må ikke redigeres i hånden; ret registeret og kør \`${KOMPONENTER_COMMAND}\`.`,
    "En test fejler, hvis filen ikke er ajour.",
    "",
    "## Indhold",
    "",
    ...entries().map((e) => `- [${e.title} (\`${e.type}\`)](#${e.type})`),
    "- [Oversigt](#oversigt)",
    "",
    ...entries().map(section),
    overview(),
  ];
  return lines.join("\n");
}
