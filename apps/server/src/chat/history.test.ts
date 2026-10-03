import assert from "node:assert/strict";
import { test } from "node:test";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { historyChars, startsTurn, trimHistory } from "./history.js";

/** Én tur med værktøjskald: spørgsmål, tool_use, tool_result, svar. */
const turn = (n: number, pad = 200): BetaMessageParam[] => [
  { role: "user", content: [{ type: "text", text: "[Kontekst] …" }, { type: "text", text: `Spørgsmål ${n}` }] },
  { role: "assistant", content: [{ type: "tool_use", id: `t${n}`, name: "show_company", input: { company: "x" } }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: `t${n}`, content: "x".repeat(pad) }] },
  { role: "assistant", content: [{ type: "text", text: `Svar ${n}` }] },
];

test("trimHistory: under grænsen uændret; over grænsen kastes hele ture forfra ned til 60 %", () => {
  const history = [1, 2, 3, 4, 5].flatMap((n) => turn(n));
  const total = historyChars(history);
  assert.deepEqual(trimHistory(history, total), history);
  const trimmed = trimHistory(history, total - 1);
  // Grov trimning: ikke kun nok til at passe, men ned til ca. 60 % (her 2 ture).
  assert.ok(historyChars(trimmed) <= (total - 1) * 0.6, `${historyChars(trimmed)} > 60 %`);
  assert.equal(trimmed.length, 8);
  assert.ok(startsTurn(trimmed[0]!), "begynder med et spørgsmål");
  assert.equal((trimmed[0]!.content as { text: string }[])[1]!.text, "Spørgsmål 4");
  // Et værktøjssvar står aldrig først (uden sit kald).
  for (const [i, m] of trimmed.entries()) {
    const orphan = Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result") && !(Array.isArray(trimmed[i - 1]?.content) && (trimmed[i - 1]!.content as { type: string }[]).some((b) => b.type === "tool_use"));
    assert.ok(!orphan, `tool_result uden tool_use ved ${i}`);
  }
  // Den seneste tur beholdes altid, også når den alene er for stor.
  assert.deepEqual(trimHistory(history, 10), turn(5));
  assert.deepEqual(trimHistory([], 10), []);
});
