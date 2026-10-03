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

let http: Server;
let base = "";
/** Alle kald, den falske model fik. */
const calls: MessageCreateParamsNonStreaming[] = [];

const message = (content: unknown[], stop_reason: string): BetaMessage =>
  ({ id: "msg", type: "message", role: "assistant", model: "fake", content, stop_reason, stop_sequence: null, usage: {} }) as unknown as BetaMessage;

/** Første kald: show_company. Når sidste besked er værktøjssvar: en kort tekst. */
const fakeModel: ModelCall = async (params, onText) => {
  calls.push(structuredClone(params));
  const last = params.messages.at(-1)!;
  const afterTool = Array.isArray(last.content) && last.content.some((b) => (b as { type: string }).type === "tool_result");
  if (afterTool) {
    onText("Her er ");
    onText("virksomheden.");
    return message([{ type: "text", text: "Her er virksomheden." }], "end_turn");
  }
  return message([{ type: "tool_use", id: `tu_${calls.length}`, name: "show_company", input: { company: "99000001", question: "Hvordan går det?" } }], "tool_use");
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
    MCP_USER_KEYS: `${PIA.key}:${PIA.id}:${PIA.name}:${PIA.org}`,
    LINK_SECRET: "chat-test-hemmelighed",
    LASSO_DATA_SOURCE: "demo",
    DATABASE_URL: "",
    PUBLIC_BASE_URL: "https://lasso.test",
    PORTAL_PUBLIC: "true",
    CHAT_MAX_PER_HOUR: "4",
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

  // Modellen fik MCP-instruktionerne + chattens, og værktøjerne uden de app-interne.
  const first = calls.at(-2)!;
  assert.match(String(first.system), /show_company/);
  assert.match(String(first.system), /Lassos egen chat/);
  const names = first.tools!.map((t) => (t as { name: string }).name);
  assert.ok(names.includes("show_company") && names.includes("render_view"));
  assert.ok(!names.includes("resolve_view"), "resolve_view er kun for appen");
  // Haiku (standard) får hverken effort eller fallbacks.
  assert.equal(first.model, "claude-haiku-4-5");
  assert.equal(first.output_config, undefined);

  // Værktøjssvaret til modellen: resuméet uden tekstkort og uden datasæt.
  const second = calls.at(-1)!;
  const result = (second.messages.at(-1)!.content as { type: string; content: string }[])[0]!;
  assert.equal(result.type, "tool_result");
  assert.match(result.content, /Eksempel Byg/);
  assert.doesNotMatch(result.content, /Tekstkort:/);

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
  // Pia har brugt 3 af 4 i testene ovenfor (de afviste kald tæller ikke).
  assert.equal((await chat({ message: "Fjerde" })).status, 200);
  const r = await chat({ message: "Femte" });
  assert.equal(r.status, 429);
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
