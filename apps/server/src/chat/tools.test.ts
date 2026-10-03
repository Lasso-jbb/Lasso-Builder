import assert from "node:assert/strict";
import { test } from "node:test";
import { GLOBAL_TITLES } from "./context.js";
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
  assert.deepEqual(CHAT_TOOLS.map((t) => t.tool.name), ["find_entity", "ask_choice", "place_answer"], "fast rækkefølge, place_answer sidst");
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
  const ctx = { mcp: {} as never, context: { active: { kind: "global" as const }, open: [] }, message: "Hej", turn: { placement: { placement: "global" as const }, placed: false, viewed: false } };
  assert.equal((await ask.run({ question: "x".repeat(201), options: [{ label: "a", description: "Kort beskrivelse", action: { placement: "current" } }] }, ctx)).isError, true);
  assert.equal((await ask.run({ question: "Hvad?", options: Array.from({ length: 9 }, () => ({ label: "a", description: "Kort beskrivelse", action: { placement: "current" } })) }, ctx)).isError, true);
  assert.equal((await ask.run({ question: "Hvad?", options: [] }, ctx)).isError, true);
  const two = [{ label: "a", description: "Kort beskrivelse", action: { placement: "current" } }, { label: "b", description: "Kort beskrivelse", action: { placement: "current" } }];
  assert.ok((await ask.run({ question: "Hvad?", options: two }, ctx)).choice);
  // En menu har mindst to punkter (kun run() kræver det; skemaet tillader ét, så gamle menuer i historikken kan bekræftes).
  assert.equal((await ask.run({ question: "Hvad?", options: [two[0]] }, ctx)).isError, true, "ét punkt");
  // description kræves (højst 160 tegn); højst ét punkt må være anbefalet; recommended og description sendes videre til browseren.
  const opt = (extra: object) => ({ label: "a", action: { placement: "current" }, ...extra });
  assert.equal((await ask.run({ question: "Hvad?", options: [opt({}), opt({ description: "b" })] }, ctx)).isError, true, "uden description");
  assert.equal((await ask.run({ question: "Hvad?", options: [opt({ description: "x".repeat(161) }), opt({ description: "b" })] }, ctx)).isError, true);
  assert.equal((await ask.run({ question: "Hvad?", options: [opt({ description: "a", recommended: true }), opt({ description: "b", recommended: true })] }, ctx)).isError, true, "to anbefalede");
  const ok = await ask.run({ question: "Hvad?", options: [opt({ description: "Kort svar her", recommended: true }), opt({ description: "Ny fane" })] }, ctx);
  assert.deepEqual(ok.choice!.options.map((o) => [o.description, o.recommended ?? false]), [["Kort svar her", true], ["Ny fane", false]]);
  const find = CHAT_TOOLS.find((t) => t.tool.name === "find_entity")!;
  assert.equal((await find.run({ kind: "person", query: "" }, ctx)).isError, true);
  assert.equal((await find.run({ kind: "person", query: "x", limit: 99 }, ctx)).isError, true);
});

test("ask_choice: title i en handling er et af de fire generiske navne (enum i skemaet og i run())", async () => {
  const ask = CHAT_TOOLS.find((t) => t.tool.name === "ask_choice")!;
  const ctx = { mcp: {} as never, context: { active: { kind: "global" as const }, open: [] }, message: "Hej", turn: { placement: { placement: "global" as const }, placed: false, viewed: false } };
  const option = (title: string) => ({ label: "a", description: "d", action: { placement: "global", title } });
  assert.equal((await ask.run({ question: "Hvad?", options: [option("Firmaliste"), option("Kort")] }, ctx)).isError, undefined);
  assert.equal((await ask.run({ question: "Hvad?", options: [option("Største revisorer i Aarhus"), option("Kort")] }, ctx)).isError, true);
  const schema = JSON.stringify(ask.tool.input_schema);
  for (const t of GLOBAL_TITLES) assert.match(schema, new RegExp(`"${t}"`));
});

test("place_answer: skemaet har enum for placement og title, entity kræver id og query; fejl giver is_error uden at røre turen", async () => {
  const place = CHAT_TOOLS.find((t) => t.tool.name === "place_answer")!;
  const schema = JSON.stringify(place.tool.input_schema);
  assert.match(schema, /"current","entity","global"/);
  for (const t of GLOBAL_TITLES) assert.match(schema, new RegExp(`"${t}"`));
  assert.equal((place.tool as { strict?: boolean }).strict, true);
  const turn = { placement: { placement: "global" as const }, placed: false, viewed: false };
  const ctx = { mcp: {} as never, context: { active: { kind: "global" as const }, open: [] }, message: "Største revisorer", turn };
  // Ugyldigt input: ukendt placement, title uden for listen, entity uden id.
  assert.equal((await place.run({ placement: "overalt" }, ctx)).isError, true);
  assert.equal((await place.run({ placement: "global", title: "Største revisorer" }, ctx)).isError, true);
  assert.equal((await place.run({ placement: "entity" }, ctx)).isError, true);
  assert.equal((await place.run({ placement: "entity", entity: { kind: "person", id: "CVR-3-1" } }, ctx)).isError, true);
  assert.equal(turn.placed, false);
  const ok = await place.run({ placement: "global", title: "Firmaliste" }, ctx);
  assert.deepEqual(ok.placement, { placement: "global", title: "Firmaliste", decided: true });
  assert.equal(turn.placed, true);
  assert.deepEqual(turn.placement, ok.placement);
  assert.equal((await place.run({ placement: "global", title: "Kort" }, ctx)).isError, true, "anden gang");
});

test("ask_choice: uden en udtrykkelig bøn om at åbne bliver entity-punkter til current (svar her om den valgte); med en bøn står de", async () => {
  const ask = CHAT_TOOLS.find((t) => t.tool.name === "ask_choice")!;
  const gitte = { kind: "person" as const, id: "CVR-3-4000000007", name: "Gitte Prøve" };
  const kim = { kind: "person" as const, id: "CVR-3-4000000008", name: "Kim Prøve" };
  const onCompany = { kind: "company" as const, id: "CVR-1-99000001", name: "Eksempel Byg A/S" };
  const turn = { placement: { placement: "current" as const }, placed: false, viewed: false };
  const ctxFor = (message: string, active: object = { ...onCompany, tab: "overblik" }) => ({ mcp: {} as never, context: { active: active as never, open: [] }, message, turn });
  const options = [gitte, kim].map((e) => ({ label: e.name, description: "Direktør", action: { placement: "entity", entity: e, focus: "overblik", prompt: `Vis alt om ${e.name}` } }));
  const quiet = await ask.run({ question: "Hvem?", options }, ctxFor("Hvem er Prøve?"));
  assert.ok(quiet.choice);
  assert.deepEqual(quiet.choice!.options.map((o) => o.action), [
    { placement: "current", entity: gitte, focus: "overblik", prompt: "Fortæl om Gitte Prøve (CVR-3-4000000007) her" },
    { placement: "current", entity: kim, focus: "overblik", prompt: "Fortæl om Kim Prøve (CVR-3-4000000008) her" },
  ]);
  // Det effektive input (til historikken) har de samme handlinger.
  assert.deepEqual((quiet.input as { options: { action: unknown }[] }).options.map((o) => o.action), quiet.choice!.options.map((o) => o.action));
  const explicit = await ask.run({ question: "Hvem?", options }, ctxFor("Vis alt om Prøve"));
  assert.deepEqual(explicit.choice!.options.map((o) => o.action.placement), ["entity", "entity"]);
  // Global fra en entitet afvises uden en bøn; på forsiden og ved en bøn er den fin.
  const globalOptions = [...options, { label: "Sammenlign", description: "d", action: { placement: "global", title: "Sammenligning" } }];
  assert.equal((await ask.run({ question: "Hvem?", options: globalOptions }, ctxFor("Hvem er Prøve?"))).isError, true);
  assert.ok((await ask.run({ question: "Hvem?", options: globalOptions }, ctxFor("Hvem er Prøve?", { kind: "global" }))).choice);
  assert.ok((await ask.run({ question: "Hvem?", options: globalOptions }, ctxFor("åbn Prøve"))).choice);
});
