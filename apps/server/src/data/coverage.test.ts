import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Dækningstest (plan A8, Ø2): hver komponenttype har data-opslag, dvs. en `case "LassoXxx":` i
 * resolve.ts. Både typelisten (spec.ts) og resolve.ts læses som tekst, så testen ikke afhænger af
 * en intern funktion og ikke kan blive grøn ved et uheld.
 */
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const TYPES = [...new Set([...read("../../../../packages/spec/src/spec.ts").matchAll(/type:\s*z\.literal\("(Lasso\w+)"\)/g)].map((m) => m[1]!))];
const RESOLVE = read("./resolve.ts");

test("typelisten kan læses fra spec.ts", () => {
  assert.ok(TYPES.length >= 50, `kun ${TYPES.length} typer fundet; regex forældet?`);
});

test("hver komponenttype har en case i resolve.ts", () => {
  const cases = new Set([...RESOLVE.matchAll(/case\s+"(Lasso\w+)"/g)].map((m) => m[1]!));
  const mangler = TYPES.filter((t) => !cases.has(t));
  assert.deepEqual(mangler, [], `Typer uden data-opslag (case i resolve.ts) — ${mangler.length} af ${TYPES.length}:\n  ${mangler.join("\n  ")}`);
});
