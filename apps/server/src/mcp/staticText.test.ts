import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogAsText } from "@lasso/spec";
import { staticToolParts } from "./staticText.js";

/** Tegn pr. token på dansk (plan Ø8). */
const CHARS_PER_TOKEN = 3.3;
/**
 * Token-loft for de faste værktøjstekster (instruktioner + alle værktøjsbeskrivelser), plan Ø8:
 * målt 29.09.2026 til ≈ 20.000 tokens; loft = dagens niveau + 10 %. Hæves kun af ejeren, og kun
 * efter målingen i B4 (katalog-udflytning) foreligger.
 */
const TOKEN_CEILING = 22_000;

const tok = (chars: number) => Math.round(chars / CHARS_PER_TOKEN);

test(`faste værktøjstekster ≤ ${TOKEN_CEILING} tokens (tegn / ${CHARS_PER_TOKEN})`, async () => {
  const p = await staticToolParts();
  const perTool = Object.entries(p.tools).map(([n, d]) => ({ n, chars: d.length }));
  const total = p.instructions.length + perTool.reduce((s, t) => s + t.chars, 0);
  const catalog = catalogAsText().length;
  const fordeling = [
    `instruktioner: ${tok(p.instructions.length)}`,
    ...perTool.map((t) => `${t.n}: ${tok(t.chars)}`),
    `heraf katalog (i render_view): ${tok(catalog)}`,
  ].join("\n  ");
  assert.ok(
    total / CHARS_PER_TOKEN <= TOKEN_CEILING,
    `Faste tekster er ${tok(total)} tokens (${total} tegn), loft ${TOKEN_CEILING} (plan Ø8). Fordeling i tokens:\n  ${fordeling}`,
  );
  assert.ok(catalog > 0 && p.tools["render_view"]?.includes(catalogAsText()), "kataloget står ikke i render_view's beskrivelse");
});
