/**
 * Ende-til-ende for chatten (docs/chat.md): /api/chat med en falsk model, der kalder show_company og
 * svarer, så værktøjskæden (MCP i processen → visning til browseren, tekst til modellen) og adgang,
 * signeret historik og bremse afprøves uden Claude-nøgle.
 */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { ModelCall } from "./chat/agent.js";

process.env.LASSO_NO_MAIN = "1";
const { createApp } = await import("./index.js");
const { loadConfig } = await import("./config.js");
const { LassoClient } = await import("./lasso/client.js");
const { DemoProvider } = await import("./data/demo.js");
const { createViewStore } = await import("./views/store.js");
const { createSavedPageStore } = await import("./pages/store.js");
const { modelOptions } = await import("./chat/agent.js");

const KEY = "chat-test-key";
const PIA = { key: "chat-pia-key-123", id: "pia", name: "Pia", org: "lasso" };
/** Kun til bremsetesten, så Pias kvote rækker til de andre tests. */
const BO = { key: "chat-bo-key-456", id: "bo", name: "Bo", org: "lasso" };
const MAX_PER_HOUR = 12;

let http: Server;
let base = "";
/** Alle kald, den falske model fik. */
const calls: MessageCreateParamsNonStreaming[] = [];

const message = (content: unknown[], stop_reason: string): BetaMessage =>
  ({ id: "msg", type: "message", role: "assistant", model: "fake", content, stop_reason, stop_sequence: null, usage: {} }) as unknown as BetaMessage;

/** Modelsvar, en test har sat i kø: ét pr. kald, i rækkefølge. Tom kø = standardforløbet nedenfor. */
type Step = (params: MessageCreateParamsNonStreaming, onText: (t: string) => void) => BetaMessage;
const script: Step[] = [];
const sayText = (text: string): Step => (_p, onText) => {
  onText(text);
  return message([{ type: "text", text }], "end_turn");
};

/** Standardforløb: første kald show_company. Når sidste besked er værktøjssvar: en kort tekst. */
const fakeModel: ModelCall = async (params, onText) => {
  calls.push(structuredClone(params));
  const next = script.shift();
  if (next) return next(params, onText);
  const last = params.messages.at(-1)!;
  const afterTool = Array.isArray(last.content) && last.content.some((b) => (b as { type: string }).type === "tool_result");
  if (afterTool) {
    onText("Her er ");
    onText("virksomheden.");
    return message([{ type: "text", text: "Her er virksomheden." }], "end_turn");
  }
  return message([{ type: "tool_use", id: `tu_${calls.length}`, name: "show_company", input: { company: "99000001", question: "Hvordan går det?" } }], "tool_use");
};

const useTool = (name: string, input: Record<string, unknown>, text?: string): Step => (_p, onText) => {
  if (text) onText(text);
  return message([...(text ? [{ type: "text", text }] : []), { type: "tool_use", id: `tu_${calls.length}`, name, input }], "tool_use");
};

/** Tekstblokkene i den seneste brugerbesked, modellen fik. */
const lastUserTexts = (params: MessageCreateParamsNonStreaming): string[] => {
  const user = [...params.messages].reverse().find((m) => m.role === "user")!;
  return Array.isArray(user.content) ? user.content.filter((b): b is { type: "text"; text: string } => b.type === "text").map((b) => b.text) : [String(user.content)];
};

type Event = Record<string, unknown> & { type: string };

async function chat(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${PIA.key}` }): Promise<{ status: number; events: Event[]; json?: Record<string, unknown> }> {
  const res = await fetch(`${base}/api/chat`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.headers.get("content-type")?.startsWith("text/event-stream")) return { status: res.status, events: [], json: JSON.parse(text) };
  const events = text
    .split("\n\n")
    .filter((b) => b.startsWith("data: "))
    .map((b) => JSON.parse(b.slice(6)) as Event);
  return { status: res.status, events };
}

before(async () => {
  const config = loadConfig({
    ...process.env,
    MCP_ACCESS_KEY: KEY,
    MCP_USER_KEYS: `${PIA.key}:${PIA.id}:${PIA.name}:${PIA.org};${BO.key}:${BO.id}:${BO.name}:${BO.org}`,
    LINK_SECRET: "chat-test-hemmelighed",
    LASSO_DATA_SOURCE: "demo",
    DATABASE_URL: "",
    PUBLIC_BASE_URL: "https://lasso.test",
    PORTAL_PUBLIC: "true",
    CHAT_MAX_PER_HOUR: String(MAX_PER_HOUR),
  });
  const store = createViewStore("");
  const pages = createSavedPageStore("");
  const app = createApp({ config, client: new LassoClient(config), provider: new DemoProvider(), store, pages, chatModel: fakeModel });
  http = app.listen(0);
  await new Promise((r) => http.once("listening", r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((r) => http.close(r));
});

test("chat: værktøjet kører gennem MCP; browseren får visningen, modellen kun teksten", async () => {
  const { status, events } = await chat({ message: "Hvordan går det med Eksempel Byg?" });
  assert.equal(status, 200);
  assert.deepEqual(
    events.map((e) => e.type),
    ["tool", "view", "text", "text", "done"],
  );
  const tool = events[0]!;
  assert.equal(tool.name, "show_company");
  assert.equal(tool.title, "Vis virksomhed");
  const view = events[1] as Event & { spec: { components: unknown[] }; dataset: { companies: Record<string, { name: string }> } };
  assert.ok(view.spec.components.length > 0);
  assert.equal(view.dataset.companies["CVR-1-99000001"]?.name, "Eksempel Byg A/S");

  // Modellen fik MCP-routingen + chattens egne regler (ikke /mcp's), og værktøjerne uden de app-interne.
  const first = calls.at(-2)!;
  assert.match(String(first.system), /show_company/);
  assert.match(String(first.system), /Lassos egen chat/);
  assert.doesNotMatch(String(first.system), /Én visning pr\. svar/, "MCP_RULES er kun til Claude.ai");
  const names = first.tools!.map((t) => (t as { name: string }).name);
  assert.ok(names.includes("show_company") && names.includes("render_view"));
  assert.ok(!names.includes("resolve_view"), "resolve_view er kun for appen");
  // Chattens egne værktøjer står sidst, i fast rækkefølge (prompt-cachen).
  assert.equal(names.indexOf("find_entity"), names.length - 1);
  // Haiku (standard) får hverken effort eller fallbacks.
  assert.equal(first.model, "claude-haiku-4-5");
  assert.equal(first.output_config, undefined);
  // Prompt-cachen (docs/chat.md): 1 time (CHAT_CACHE_TTL) på både det sidste værktøj og beskederne, og kun dér.
  assert.deepEqual(first.cache_control, { type: "ephemeral", ttl: "1h" });
  const marked = first.tools!.filter((t) => "cache_control" in t && t.cache_control);
  assert.equal(marked.length, 1);
  assert.deepEqual((marked[0] as { cache_control: unknown }).cache_control, { type: "ephemeral", ttl: "1h" });
  assert.equal((first.tools!.at(-1) as { cache_control?: unknown }).cache_control !== undefined, true, "markøren sidder på det sidste værktøj");

  // Værktøjssvaret til modellen: resuméet uden tekstkort og uden datasæt.
  const second = calls.at(-1)!;
  const result = (second.messages.at(-1)!.content as { type: string; content: string }[])[0]!;
  assert.equal(result.type, "tool_result");
  assert.match(result.content, /Eksempel Byg/);
  assert.doesNotMatch(result.content, /Tekstkort:/);
  // Chatten viser visningen under teksten, så værktøjssvaret beder ikke modellen tie (SILENT er /mcp's).
  assert.match(result.content, /^Visningen vises for brugeren under din tekst\./);

  const done = events.at(-1) as Event & { history: unknown[]; sig: string };
  assert.equal(done.history.length, 4);
  assert.ok(done.sig);
});

test("chat: næste spørgsmål bygger videre på den signerede historik; en ændret historik afvises", async () => {
  const first = await chat({ message: "Fortæl om Eksempel Byg" });
  const done = first.events.at(-1) as Event & { history: unknown[]; sig: string };
  const next = await chat({ message: "Og ejerne?", history: done.history, sig: done.sig });
  assert.equal(next.status, 200);
  assert.equal((next.events.at(-1) as Event & { history: unknown[] }).history.length, 8);

  const forged = [...done.history, { role: "user", content: "falsk" }];
  const bad = await chat({ message: "Hej", history: forged, sig: done.sig });
  assert.equal(bad.status, 400);
  // Signaturen er bundet til brugeren: demobrugeren (fælles nøgle) kan ikke bruge Pias samtale.
  const other = await chat({ message: "Hej", history: done.history, sig: done.sig }, { authorization: `Bearer ${KEY}` });
  assert.equal(other.status, 400);
});

test("chat: den åbne portal giver demobrugeren adgang, men kun med portalens header", async () => {
  assert.equal((await chat({ message: "Hej" }, {})).status, 403);
  const open = await chat({ message: "Hej" }, { "x-lasso-portal": "1" });
  assert.equal(open.status, 200);
  assert.equal(open.events.at(-1)?.type, "done");
  assert.equal((await chat({ message: "Hej" }, { authorization: "Bearer forkert" })).status, 401);
  assert.equal((await chat({ message: "" })).status, 400);
});

test("chat: bremsen siger 429 efter CHAT_MAX_PER_HOUR beskeder", async () => {
  const bo = { authorization: `Bearer ${BO.key}` };
  for (let i = 0; i < MAX_PER_HOUR; i++) {
    script.push(sayText("Hej."));
    assert.equal((await chat({ message: `Besked ${i + 1}` }, bo)).status, 200);
  }
  const r = await chat({ message: "Én for meget" }, bo);
  assert.equal(r.status, 429);
});

test("chat: konteksten står først i brugerens tur; uden context svares der globalt", async () => {
  script.push(sayText("Ja."));
  const ctx = {
    active: { kind: "company", id: "CVR-1-99000001", name: "Eksempel Byg A/S", tab: "ejerskab" },
    open: [{ kind: "person", id: "CVR-3-4000123", name: "Jakob Benediktson" }],
  };
  const { status, events } = await chat({ message: "Hvem ejer den?", context: ctx });
  assert.equal(status, 200);
  assert.equal(events.at(-1)?.type, "done");
  const texts = lastUserTexts(calls.at(-1)!);
  assert.equal(texts.length, 2);
  assert.match(texts[0]!, /^\[Kontekst\] Aktiv fane: virksomheden Eksempel Byg A\/S \(CVR-1-99000001\), modul ejerskab\. Åbne faner: Jakob Benediktson \(CVR-3-4000123\)\./);
  assert.equal(texts[1], "Hvem ejer den?");

  script.push(sayText("Hej."));
  await chat({ message: "Hej" });
  assert.match(lastUserTexts(calls.at(-1)!)[0]!, /^\[Kontekst\] Aktiv fane: forsiden \(global/);

  // Det, brugeren ser (modulets resumé fra /api/portal), står efter fanelinjen; over 4000 tegn afvises.
  script.push(sayText("Ja."));
  const seen = { active: { ...ctx.active, tab: "oekonomi", view: { module: "oekonomi", summary: "Omsætning 2025: 38 mio." } }, open: [] };
  await chat({ message: "Hvorfor?", context: seen });
  assert.match(lastUserTexts(calls.at(-1)!)[0]!, /modul oekonomi\. Brugeren ser: oekonomi — Omsætning 2025: 38 mio\.$/);
  const tooLong = { active: { ...seen.active, view: { module: "oekonomi", summary: "x".repeat(4001) } } };
  assert.equal((await chat({ message: "Hvorfor?", context: tooLong })).status, 400);
});

test("chat: ugyldig context og et valg uden ask_choice i historikken afvises med 400", async () => {
  const bad = await chat({ message: "Hej", context: { active: { kind: "company", id: "ikke-et-id", name: "X" } } });
  assert.equal(bad.status, 400);
  assert.equal(bad.json?.error, "context er ugyldig");
  const choice = await chat({ message: "Hej", context: { active: { kind: "global" }, choice: { id: "toolu_1", free: true } } });
  assert.equal(choice.status, 400);
  assert.equal(choice.json?.error, "Valget passer ikke til samtalen");
});

test("/chat-siden og /health", async () => {
  const html = await (await fetch(`${base}/chat`)).text();
  const boot = JSON.parse(/window\.__LASSO_BOOT__=(.*?);<\/script>/s.exec(html)![1]!) as Record<string, unknown>;
  assert.equal(boot.mode, "chat");
  assert.equal(boot.loginRequired, true);
  assert.equal(boot.enabled, true);
  const health = (await (await fetch(`${base}/health`)).json()) as { chat: boolean };
  assert.equal(health.chat, false, "uden ANTHROPIC_API_KEY");
});

test("modelOptions: effort og fallbacks kun til de større modeller", () => {
  assert.deepEqual(modelOptions({ CHAT_MODEL: "claude-haiku-4-5", CHAT_EFFORT: "medium" }), {});
  assert.deepEqual(modelOptions({ CHAT_MODEL: "claude-opus-5-5", CHAT_EFFORT: "low" }), {
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
});

test("chat: find_entity giver modellen kandidater (åbne faner først) uden en visning", async () => {
  script.push(useTool("find_entity", { kind: "person", query: "Gitte" }), sayText("Fandt hende."));
  const ctx = { active: { kind: "global" }, open: [{ kind: "person", id: "CVR-3-4000000007", name: "Gitte Prøve" }] };
  const { events } = await chat({ message: "vis alt om Gitte", context: ctx });
  assert.deepEqual(
    events.map((e) => e.type),
    ["tool", "text", "done"],
  );
  const result = (calls.at(-1)!.messages.at(-1)!.content as { type: string; content: string }[])[0]!;
  assert.match(result.content, /^1 person for "Gitte".*\nCVR-3-4000000007 \| Gitte Prøve \| åben fane$/s);

  script.push(useTool("find_entity", { kind: "person", query: "" }), sayText("Hov."));
  const bad = await chat({ message: "vis alt om" });
  assert.equal(bad.events[1]?.type, "tool_error");
});
