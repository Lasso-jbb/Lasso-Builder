/**
 * Lokal forhåndsvisning af /chat og /portal uden Claude-nøgle: en falsk model, der kalder show_company og
 * svarer kort. Skriver man "alt om …", viser den valgmenuen (ask_choice) først og følger brugerens valg.
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
const fake: ModelCall = async (params, onText) => {
  await new Promise((r) => setTimeout(r, 400));
  const last = params.messages.at(-1)!;
  if (Array.isArray(last.content) && last.content.some((b) => (b as { type: string }).type === "tool_result")) {
    for (const w of ["Jeg valgte ", "**Eksempel Byg A/S** ", "(CVR 99000001)."]) onText(w);
    return msg([{ type: "text", text: "Jeg valgte **Eksempel Byg A/S** (CVR 99000001)." }], "end_turn");
  }
  // Brugerens tur: [Kontekst]-blokken og så beskeden.
  const texts = Array.isArray(last.content) ? last.content.filter((b): b is { type: "text"; text: string } => (b as { type: string }).type === "text").map((b) => b.text) : [String(last.content)];
  const [context = "", question = ""] = texts.length > 1 ? texts : ["", texts[0] ?? ""];
  if (/alt om/i.test(question) && !/Brugeren valgte|fritekst/.test(context)) {
    const entity = { kind: "company", id: "CVR-1-99000001", name: "Eksempel Byg A/S" };
    const options = [
      { label: "Kort indsigt i Eksempel Byg A/S", action: { placement: "current", prompt: "Giv en kort indsigt i Eksempel Byg A/S her" } },
      { label: "Fuld indsigt i Eksempel Byg A/S", action: { placement: "entity", entity, focus: "overblik", prompt: "Vis alt om Eksempel Byg A/S (CVR-1-99000001)" } },
      { label: "Branchesammenligning", action: { placement: "global", title: "Branchesammenligning", prompt: "Sammenlign Eksempel Byg A/S med branchen" } },
    ];
    return msg([{ type: "tool_use", id: `toolu_${Date.now()}`, name: "ask_choice", input: { question: "Hvad vil du se om Eksempel Byg A/S?", options } }], "tool_use");
  }
  const showAll = /Brugeren valgte 'Fuld indsigt/.test(context);
  return msg([{ type: "tool_use", id: `tu_${Date.now()}`, name: "show_company", input: { company: "99000001", question, ...(showAll ? { show_all: true } : { focus: "oekonomi" }) } }], "tool_use");
};
const config = loadConfig({ ...process.env, LASSO_DATA_SOURCE: "demo", DATABASE_URL: "", PORT: "3999" });
const app = createApp({ config, client: new LassoClient(config), provider: new DemoProvider(), store: createViewStore(""), pages: createSavedPageStore(""), chatModel: fake });
app.listen(3999, () => console.log("http://localhost:3999/chat"));
