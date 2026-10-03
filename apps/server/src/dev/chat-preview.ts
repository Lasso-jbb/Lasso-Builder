/**
 * Lokal forhåndsvisning af /chat og /portal uden Claude-nøgle: en falsk model, der kalder show_company og
 * svarer kort. Skriver man "alt om …", slår den virksomheden op (find_entity) og åbner dens fane (place_answer entity).
 * Kør: npx tsx src/dev/chat-preview.ts (port 3999), åbn http://localhost:3999/chat eller /portal.
 */
import type { BetaMessage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
process.env.LASSO_NO_MAIN = "1";
const { createApp } = await import("../index.js");
const { loadConfig } = await import("../config.js");
const { LassoClient } = await import("../lasso/client.js");
const { DemoProvider } = await import("../data/demo.js");
const { createViewStore } = await import("../views/store.js");
const { createSavedPageStore } = await import("../pages/store.js");
import type { ModelCall } from "../chat/agent.js";

const msg = (content: unknown[], stop_reason: string) => ({ id: "m", type: "message", role: "assistant", model: "fake", content, stop_reason, usage: {} }) as unknown as BetaMessage;
const toolResultText = (m: { content: unknown }): string =>
  Array.isArray(m.content) ? (m.content as { type: string; content?: unknown }[]).filter((b) => b.type === "tool_result").map((b) => (typeof b.content === "string" ? b.content : JSON.stringify(b.content))).join("\n") : "";
const use = (name: string, input: unknown) => msg([{ type: "tool_use", id: `tu_${name}_${Date.now()}`, name, input }], "tool_use");
const fake: ModelCall = async (params, onText) => {
  await new Promise((r) => setTimeout(r, 400));
  const last = params.messages.at(-1)!;
  // Brugerens tur: [Kontekst]-blokken og så beskeden (findes i turen før værktøjssvarene).
  const turnStart = [...params.messages].reverse().find((m) => m.role === "user" && !toolResultText(m))!;
  const texts = Array.isArray(turnStart.content) ? turnStart.content.filter((b): b is { type: "text"; text: string } => (b as { type: string }).type === "text").map((b) => b.text) : [String(turnStart.content)];
  const question = texts.at(-1) ?? "";
  const entityTurn = /alt om/i.test(question);
  const results = toolResultText(last);
  if (results) {
    // "alt om …": find_entity → place_answer (entity) → show_company med show_all → tekst.
    if (entityTurn && /virksomhed for/.test(results)) return use("place_answer", { placement: "entity", entity: { kind: "company", id: "CVR-1-99000001", query: "Eksempel Byg" }, focus: "overblik" });
    if (entityTurn && /^Placeringen er valgt/.test(results)) return use("show_company", { company: "99000001", question, show_all: true });
    if (/^Placeringen er valgt/.test(results)) return use("show_company", { company: "99000001", question, focus: "oekonomi" });
    for (const w of ["Her er ", "**Eksempel Byg A/S** ", "(CVR 99000001)."]) onText(w);
    return msg([{ type: "text", text: "Her er **Eksempel Byg A/S** (CVR 99000001)." }], "end_turn");
  }
  if (entityTurn) return use("find_entity", { kind: "company", query: "Eksempel Byg" });
  return use("place_answer", { placement: "current" });
};
const config = loadConfig({ ...process.env, LASSO_DATA_SOURCE: "demo", DATABASE_URL: "", PORT: "3999" });
const app = createApp({ config, client: new LassoClient(config), provider: new DemoProvider(), store: createViewStore(""), pages: createSavedPageStore(""), chatModel: fake });
app.listen(3999, () => console.log("http://localhost:3999/chat"));
