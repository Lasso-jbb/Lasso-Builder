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
import { createMcpServer, MCP_RULES, ROUTING, type McpContext } from "./server.js";

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

test("/mcp er byte-identisk: instruktioner og render_view's beskrivelse (pinnet hash)", async () => {
  const client = await clientFor("mcp");
  const instr = client.getInstructions() ?? "";
  assert.equal(instr, `${ROUTING}\n\n${MCP_RULES}`);
  // Opdater hashen her, når teksten til Claude.ai ændres med vilje.
  assert.equal(sha(instr), "df28a00854e1b33b");
  const rv = (await client.listTools()).tools.find((t) => t.name === "render_view")!;
  assert.equal(sha(rv.description!), "315b3814a067317a");
});
