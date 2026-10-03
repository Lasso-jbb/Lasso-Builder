import assert from "node:assert/strict";
import { test } from "node:test";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { contextText, parseContext, verifyChoice, type ChatContext } from "./context.js";

const jakob = { kind: "person" as const, id: "CVR-3-4000123", name: "Jakob Benediktson" };
const lasso = { kind: "company" as const, id: "CVR-1-34580820", name: "LASSO X A/S" };
const entityAction = { placement: "entity" as const, entity: jakob, focus: "overblik", prompt: "Vis alt om Jakob Benediktson (CVR-3-4000123)" };
const hereAction = { placement: "current" as const, prompt: "Giv et kort overblik over Jakob Benediktson her" };

/** Historik, der ender med et ask_choice-kald og dets værktøjssvar (som efter en "choice"-hændelse). */
const history: BetaMessageParam[] = [
  { role: "user", content: "vis alt om Jakob" },
  {
    role: "assistant",
    content: [
      { type: "text", text: "Et øjeblik." },
      { type: "tool_use", id: "toolu_1", name: "ask_choice", input: { question: "Hvad vil du se?", options: [{ label: "Alt om Jakob Benediktson", action: entityAction }, { label: "Overordnet indblik her", action: hereAction }] } },
    ],
  },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "Valget er vist." }] },
];

test("parseContext: uden context global; id'er valideres; højst 20 åbne faner", () => {
  assert.deepEqual(parseContext(undefined), { active: { kind: "global" }, open: [] });
  assert.equal(parseContext({ active: { kind: "company", id: "ikke-et-id", name: "X" } }), null);
  assert.equal(parseContext({ active: { kind: "person", id: "CVR-1-34580820", name: "X" } }), null, "et virksomheds-ID er ikke en person");
  assert.equal(parseContext({ active: { kind: "global" }, open: Array.from({ length: 21 }, () => lasso) }), null);
  const ok = parseContext({ active: { ...lasso, tab: "ejerskab" }, open: [jakob] })!;
  assert.equal(ok.active.kind, "company");
  assert.equal(ok.open.length, 1);
  assert.equal(parseContext({ active: { kind: "global" }, choice: { id: "toolu_1", index: 0, action: { placement: "entity" } } }), null, "entity kræver entity");
});

test("verifyChoice: valget skal pege på modellens ask_choice med præcis dets handling", () => {
  assert.deepEqual(verifyChoice(history, { id: "toolu_1", index: 0, action: entityAction }), { label: "Alt om Jakob Benediktson" });
  assert.deepEqual(verifyChoice(history, { id: "toolu_1", index: 1, action: hereAction }), { label: "Overordnet indblik her" });
  assert.deepEqual(verifyChoice(history, { id: "toolu_1", free: true }), {});
  // Forfalsket: andet id, andet indeks, ændret handling, eller intet ask_choice i den seneste assistentbesked.
  assert.ok("error" in verifyChoice(history, { id: "toolu_2", index: 0, action: entityAction }));
  assert.ok("error" in verifyChoice(history, { id: "toolu_1", index: 2, action: entityAction }));
  assert.ok("error" in verifyChoice(history, { id: "toolu_1", index: 0, action: { ...entityAction, entity: lasso } }));
  assert.ok("error" in verifyChoice([...history, { role: "assistant", content: "Noget andet." }], { id: "toolu_1", index: 0, action: entityAction }));
  assert.ok("error" in verifyChoice([], { id: "toolu_1", free: true }));
});

test("contextText: aktiv fane, åbne faner og valget", () => {
  const ctx: ChatContext = { active: { ...lasso, tab: "ejerskab" }, open: [lasso, jakob] };
  assert.equal(contextText(ctx), "[Kontekst] Aktiv fane: virksomheden LASSO X A/S (CVR-1-34580820), modul ejerskab. Åbne faner: LASSO X A/S (CVR-1-34580820), Jakob Benediktson (CVR-3-4000123).");
  assert.equal(contextText({ active: { kind: "global" }, open: [] }), "[Kontekst] Aktiv fane: forsiden (global, ingen virksomhed eller person er åben).");
  assert.match(contextText({ active: { kind: "global", title: "Søgning: lasso" }, open: [] }), /resultatet 'Søgning: lasso' \(globalt/);
  const picked = contextText({ ...ctx, choice: { id: "toolu_1", index: 0, action: entityAction, label: "Alt om Jakob Benediktson" } });
  assert.match(picked, /^\[Kontekst\] Brugeren valgte 'Alt om Jakob Benediktson': svaret skrives på personen Jakob Benediktson \(CVR-3-4000123\), modul overblik\./);
  assert.match(contextText({ ...ctx, choice: { id: "toolu_1", index: 1, action: hereAction, label: "Overordnet indblik her" } }), /svaret skrives her, på den aktive fane/);
  assert.match(contextText({ ...ctx, choice: { id: "toolu_1", index: 0, action: { placement: "global" as const } } }), /svaret er globalt/);
  assert.match(contextText({ ...ctx, choice: { id: "toolu_1", free: true } }), /fritekst/);
  // Det, brugeren ser: modulets resumé efter fanelinjen.
  const seen = contextText({ active: { ...lasso, tab: "oekonomi", view: { module: "oekonomi", summary: "Omsætning 2025: 12 mio." } }, open: [] });
  assert.match(seen, /modul oekonomi\. Brugeren ser: oekonomi — Omsætning 2025: 12 mio\.$/);
});

test("parseContext: resuméet af det, brugeren ser, er højst 4000 tegn", () => {
  const view = (n: number) => ({ active: { ...lasso, tab: "oekonomi", view: { module: "oekonomi", summary: "x".repeat(n) } } });
  assert.ok(parseContext(view(4000)));
  assert.equal(parseContext(view(4001)), null);
  assert.equal(parseContext({ active: { kind: "global", view: { module: "oekonomi", summary: "x" } } })!.active.kind, "global", "view ignoreres på forsiden (ukendte felter fjernes)");
});
