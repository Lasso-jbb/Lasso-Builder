import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_TOOLS, stripUnsupported } from "./tools.js";

const FORBIDDEN = ["minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "pattern", "format"];

/** Alle nøgler i et JSON-træ (også under properties, items, anyOf …). */
function keysOf(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => keysOf(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      out.add(k);
      keysOf(v, out);
    }
  }
  return out;
}

test("chattens værktøjer: skemaet, der sendes til API'et, har ingen grænser, strict tool use ikke understøtter", () => {
  assert.ok(CHAT_TOOLS.length >= 2);
  for (const t of CHAT_TOOLS) {
    const keys = keysOf(t.tool.input_schema);
    for (const k of FORBIDDEN) assert.ok(!keys.has(k), `${t.tool.name}: ${k} står i skemaet`);
    assert.equal((t.tool.input_schema as { additionalProperties?: boolean }).additionalProperties, false, `${t.tool.name}: additionalProperties`);
    assert.ok(Array.isArray((t.tool.input_schema as { required?: string[] }).required), `${t.tool.name}: required`);
  }
  // Valideringen (grænserne) sker stadig i run(): for lange og tomme værdier afvises.
  assert.deepEqual(stripUnsupported({ a: { minLength: 1, type: "string" }, b: [{ maxItems: 2, items: {} }] }), { a: { type: "string" }, b: [{ items: {} }] });
});

test("ask_choice og find_entity: run() afviser det, grænserne før ville afvise", async () => {
  const ask = CHAT_TOOLS.find((t) => t.tool.name === "ask_choice")!;
  const ctx = { mcp: {} as never, context: { active: { kind: "global" as const }, open: [] } };
  assert.equal((await ask.run({ question: "x".repeat(201), options: [{ label: "a", description: "Kort beskrivelse", action: { placement: "current" } }] }, ctx)).isError, true);
  assert.equal((await ask.run({ question: "Hvad?", options: Array.from({ length: 9 }, () => ({ label: "a", description: "Kort beskrivelse", action: { placement: "current" } })) }, ctx)).isError, true);
  assert.equal((await ask.run({ question: "Hvad?", options: [] }, ctx)).isError, true);
  assert.ok((await ask.run({ question: "Hvad?", options: [{ label: "a", description: "Kort beskrivelse", action: { placement: "current" } }] }, ctx)).choice);
  // description kræves (højst 160 tegn); højst ét punkt må være anbefalet; recommended og description sendes videre til browseren.
  const opt = (extra: object) => ({ label: "a", action: { placement: "current" }, ...extra });
  assert.equal((await ask.run({ question: "Hvad?", options: [opt({})] }, ctx)).isError, true, "uden description");
  assert.equal((await ask.run({ question: "Hvad?", options: [opt({ description: "x".repeat(161) })] }, ctx)).isError, true);
  assert.equal((await ask.run({ question: "Hvad?", options: [opt({ description: "a", recommended: true }), opt({ description: "b", recommended: true })] }, ctx)).isError, true, "to anbefalede");
  const ok = await ask.run({ question: "Hvad?", options: [opt({ description: "Kort svar her", recommended: true }), opt({ description: "Ny fane" })] }, ctx);
  assert.deepEqual(ok.choice!.options.map((o) => [o.description, o.recommended ?? false]), [["Kort svar her", true], ["Ny fane", false]]);
  const find = CHAT_TOOLS.find((t) => t.tool.name === "find_entity")!;
  assert.equal((await find.run({ kind: "person", query: "" }, ctx)).isError, true);
  assert.equal((await find.run({ kind: "person", query: "x", limit: 99 }, ctx)).isError, true);
});
