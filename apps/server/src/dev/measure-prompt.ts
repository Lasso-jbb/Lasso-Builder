/** Måler prompt-vægten (instructions + tool-beskrivelser), som modellen ser den. Kør: npx tsx src/dev/measure-prompt.ts */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { AddressInfo } from "node:net";
process.env.LASSO_NO_MAIN = "1";
const { createApp } = await import("../index.js");
const { loadConfig } = await import("../config.js");
const { LassoClient } = await import("../lasso/client.js");
const { DemoProvider } = await import("../data/demo.js");
const { createViewStore } = await import("../views/store.js");
const config = loadConfig({ ...process.env, MCP_ACCESS_KEY: "k", ADMIN_API_KEY: "a", LASSO_DATA_SOURCE: "demo", DATABASE_URL: "", PUBLIC_BASE_URL: "http://x" });
const store = createViewStore("");
const app = createApp({ config, client: new LassoClient(config), provider: new DemoProvider(), store });
const http = app.listen(0);
await new Promise((r) => http.once("listening", r));
const client = new Client({ name: "m", version: "1" });
await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(http.address() as AddressInfo).port}/mcp?key=k`)));
const instr = client.getInstructions() ?? "";
const { tools } = await client.listTools();
let total = instr.length;
console.log(`instructions: ${instr.length} tegn (~${Math.round(instr.length / 3.5)} tokens)`);
for (const t of tools) {
  const n = (t.description ?? "").length + JSON.stringify(t.inputSchema).length;
  total += n;
  console.log(`${t.name}: ${n} tegn (beskrivelse ${(t.description ?? "").length})`);
}
console.log(`I alt: ${total} tegn (~${Math.round(total / 3.5)} tokens)`);
await client.close();
http.close();
process.exit(0);
