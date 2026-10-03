/**
 * Chatværten (host "chat", docs/chat.md "Tokens") får mindre end Claude.ai over /mcp: kort render_view-beskrivelse,
 * ingen gem-værktøjer og værktøjssvar uden boilerplate. /mcp skal være uændret: instruktionerne og render_view's
 * beskrivelse er pinnet som hash, så en utilsigtet ændring opdages (opdater hashen bevidst, når teksten ændres).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { catalogIndexText, COMPONENT_CATALOG, LAYOUT_RULES } from "@lasso/spec";
import { loadConfig } from "../config.js";
import { DemoProvider } from "../data/demo.js";
import { createSavedPageStore } from "../pages/store.js";
import { demoUser } from "../auth/user.js";
import { createViewStore } from "../views/store.js";
import { CHAT_ROUTING, createMcpServer, MCP_RULES, ROUTING, type McpContext } from "./server.js";

const config = loadConfig({ LASSO_DATA_SOURCE: "demo", DATABASE_URL: "", PUBLIC_BASE_URL: "https://lasso.test", LINK_SECRET: "x" });
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

async function clientFor(host: McpContext["host"]): Promise<Client> {
  const ctx: McpContext = { config, provider: new DemoProvider(), store: createViewStore(""), pages: createSavedPageStore(""), user: demoUser(config), host };
  const server = createMcpServer(ctx);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await server.connect(b);
  await client.connect(a);
  return client;
}

test("render_view: chatten får en kort beskrivelse med typenavnene; /mcp den fulde med layoutguide og indeks", async () => {
  const chat = (await (await clientFor("chat")).listTools()).tools.find((t) => t.name === "render_view")!;
  const mcp = (await (await clientFor("mcp")).listTools()).tools.find((t) => t.name === "render_view")!;
  assert.ok(chat.description!.length < 1500, `chat: ${chat.description!.length} tegn`);
  assert.match(chat.description!, /describe_components/);
  assert.match(chat.description!, /layout "page"/);
  assert.match(chat.description!, /højst én graf/);
  assert.match(chat.description!, /udelad width/);
  assert.match(chat.description!, /aldrig HTML/);
  for (const c of COMPONENT_CATALOG) assert.ok(chat.description!.includes(c.type), `chat mangler typen ${c.type}`);
  assert.ok(!chat.description!.includes(LAYOUT_RULES.slice(0, 40)), "layoutguiden er udeladt i chatten");
  assert.ok(mcp.description!.includes(catalogIndexText()) && mcp.description!.includes(LAYOUT_RULES), "/mcp har den fulde");
  // Samme skema begge steder.
  assert.deepEqual(chat.inputSchema, mcp.inputSchema);
});

const SAVE_TOOLS = ["save_view", "save_page", "remove_saved_page", "list_saved_pages"];

test("gem-værktøjerne findes kun i /mcp; chatten beholder describe_components og chattens routing nævner dem ikke", async () => {
  const chat = (await (await clientFor("chat")).listTools()).tools.map((t) => t.name);
  const mcp = (await (await clientFor("mcp")).listTools()).tools.map((t) => t.name);
  for (const n of SAVE_TOOLS) {
    assert.ok(!chat.includes(n), `chatten har ${n}`);
    assert.ok(mcp.includes(n), `/mcp mangler ${n}`);
  }
  assert.ok(chat.includes("describe_components") && chat.includes("render_view"));
  assert.doesNotMatch(CHAT_ROUTING, /save_page|save_view|list_saved_pages|remove_saved_page/);
  assert.match(ROUTING, /save_page/);
  assert.ok(ROUTING.startsWith(CHAT_ROUTING));
});

const textOf = (r: unknown) => ((r as { content: { type: string; text: string }[] }).content ?? []).filter((c) => c.type === "text");

test("visningssvar: chatten får resuméet uden boilerplate og uden tekstkort-blok; /mcp uændret; structuredContent ens", async () => {
  const args = { name: "show_company", arguments: { company: "99000001", focus: "oekonomi" } };
  const chat = await (await clientFor("chat")).callTool(args);
  const mcp = await (await clientFor("mcp")).callTool(args);
  const ct = textOf(chat);
  const mt = textOf(mcp);
  assert.equal(ct.length, 1, "chatten: kun resuméet");
  assert.match(ct[0]!.text, /^OBS: demodata \(opdigtet\)\.\n/);
  for (const line of [/Visningen vises for brugeren/, /Visningen er svaret/, /Tekstkortet er kun til værter/, /Interaktiv Lasso-visning/, /Tekstkort:/]) assert.doesNotMatch(ct[0]!.text, line);
  assert.equal(mt.length, 2, "/mcp: resumé og tekstkort");
  assert.match(mt[0]!.text, /^Visningen vises for brugeren nu og er hele svaret/);
  assert.match(mt[0]!.text, /OBS: Demodata \(opdigtede virksomheder\)/);
  assert.match(mt[0]!.text, /Visningen er svaret: skriv ingen tekst i chatten/);
  assert.match(mt[0]!.text, /Interaktiv Lasso-visning \(link til brugeren\): https:\/\/lasso\.test\//);
  assert.match(mt[1]!.text, /^Tekstkort:\n/);
  // Tallene er de samme; chatten er kortere.
  assert.ok(ct[0]!.text.length < mt[0]!.text.length - 250, `${ct[0]!.text.length} vs ${mt[0]!.text.length}`);
  const sc = (r: unknown) => Object.keys((r as { structuredContent: object }).structuredContent).sort();
  assert.deepEqual(sc(chat), sc(mcp));
  assert.ok((chat as { structuredContent: { card?: string } }).structuredContent.card, "tekstkortet står stadig i structuredContent");
});

test("/mcp er byte-identisk: instruktioner og render_view's beskrivelse (pinnet hash)", async () => {
  const client = await clientFor("mcp");
  const instr = client.getInstructions() ?? "";
  assert.equal(instr, `${ROUTING}\n\n${MCP_RULES}`);
  // Opdater hashen her, når teksten til Claude.ai ændres med vilje.
  assert.equal(sha(instr), "df28a00854e1b33b");
  const rv = (await client.listTools()).tools.find((t) => t.name === "render_view")!;
  assert.equal(sha(rv.description!), "315b3814a067317a");
});
