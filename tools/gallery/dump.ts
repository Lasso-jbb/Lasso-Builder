// Dumper galleriets indgange (nr, titel, spec-typer) og katalogets AI-tekster til JSON (bruges til Excel-overblikket).
import { writeFileSync } from "node:fs";
import { COMPONENT_CATALOG, COMPOSITION_RULES, LAYOUT_RULES } from "@lasso/spec";
import { ENTRIES } from "./entries/index.js";
const out = process.argv[2] ?? "gallery-dump.json";
const entries = ENTRIES.map((e) => ({
  nr: e.nr,
  title: e.title,
  node: e.node,
  kind: e.spec ? "spec" : "ui",
  types: e.spec ? [...new Set(((e.spec as { components?: { type: string }[] }).components ?? []).map((c) => c.type))] : [],
  note: e.note,
}));
const catalog = COMPONENT_CATALOG.map((c) => ({ type: c.type, title: c.title, description: c.description, width: (c as { width?: string }).width }));
writeFileSync(out, JSON.stringify({ entries, catalog, COMPOSITION_RULES, LAYOUT_RULES }, null, 1));
console.log(entries.length, catalog.length);
