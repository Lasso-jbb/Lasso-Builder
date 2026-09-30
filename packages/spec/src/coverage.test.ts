import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COMPONENT_CATALOG, GRID_RULES } from "./catalog.js";

/**
 * Dækningstest (plan A8, Ø2): ingen komponenttype uden katalogpost, register (formål, veje, data)
 * og gridregel. Typelisten læses fra spec.ts (z.literal("Lasso…")), så en ny type i spec'en
 * straks kræver resten. Testen må aldrig svækkes for at blive grøn; ret kataloget/registeret.
 */
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const TYPES = [...new Set([...read("./spec.ts").matchAll(/type:\s*z\.literal\("(Lasso\w+)"\)/g)].map((m) => m[1]!))];

/** Nøglerne i `interface Dataset` (models.ts), uden source/generatedAt (som register.DatasetKey). */
const DATASET_KEYS = (() => {
  const src = read("./models.ts");
  const start = src.indexOf("export interface Dataset {");
  assert.ok(start >= 0, "interface Dataset ikke fundet i models.ts");
  const body = src.slice(start, src.indexOf("\n}", start));
  return new Set([...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!).filter((k) => k !== "source" && k !== "generatedAt"));
})();

const entryOf = (t: string) => COMPONENT_CATALOG.find((c) => c.type === t);

/** Én samlet assertion pr. krav: alle fejlende typer på én gang. */
function require_(krav: string, fails: string[]): void {
  assert.deepEqual(fails, [], `${krav} — ${fails.length} af ${TYPES.length} typer fejler:\n  ${fails.join("\n  ")}`);
}

test("typelisten kan læses fra spec.ts", () => {
  assert.ok(TYPES.length >= 50, `kun ${TYPES.length} typer fundet i spec.ts; regex forældet?`);
  assert.ok(DATASET_KEYS.size >= 20 && DATASET_KEYS.has("companies"), "Dataset-nøgler kunne ikke læses fra models.ts");
});

test("(a) hver type har en post i COMPONENT_CATALOG", () => {
  require_("Mangler katalogpost i COMPONENT_CATALOG (catalog.ts)", TYPES.filter((t) => !entryOf(t)).map((t) => `${t}: ingen katalogpost`));
  const dubletter = COMPONENT_CATALOG.map((c) => c.type).filter((t, i, a) => a.indexOf(t) !== i);
  assert.deepEqual(dubletter, [], `Dobbelte katalogposter: ${dubletter.join(", ")}`);
  const ukendte = COMPONENT_CATALOG.map((c) => c.type as string).filter((t) => !TYPES.includes(t));
  assert.deepEqual(ukendte, [], `Katalogposter uden type i spec.ts: ${ukendte.join(", ")}`);
});

test("(b) hver type har register", () => {
  require_("Mangler register på katalogposten", TYPES.filter((t) => entryOf(t) && !entryOf(t)!.register).map((t) => `${t}: register mangler`));
});

test("(c) register.veje er ikke tom", () => {
  require_(
    "register.veje er tom eller mangler (ingen vej ind)",
    TYPES.filter((t) => !(entryOf(t)?.register?.veje?.length ?? 0)).map((t) => `${t}: ingen veje ind (register.veje)`),
  );
});

test("(d) register.kraeverData indeholder kun gyldige Dataset-nøgler", () => {
  const fails: string[] = [];
  for (const t of TYPES) {
    const r = entryOf(t)?.register;
    if (!r) continue; // manglende register meldes af (b)
    if (!Array.isArray(r.kraeverData)) fails.push(`${t}: kraeverData mangler`);
    else for (const k of r.kraeverData) if (!DATASET_KEYS.has(k)) fails.push(`${t}: '${k}' er ikke en nøgle i Dataset`);
  }
  require_("register.kraeverData har ugyldige nøgler", fails);
});

test("(e) hver type har en regel i GRID_RULES", () => {
  const rules = GRID_RULES as Record<string, unknown>;
  require_("Mangler regel i GRID_RULES (catalog.ts)", TYPES.filter((t) => !rules[t]).map((t) => `${t}: ingen GRID_RULES-regel`));
});
