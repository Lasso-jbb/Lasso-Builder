import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaMessage,
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { Client, InMemoryTransport, type CallToolResult } from "@modelcontextprotocol/client";
import { DATASET_META_KEY, type Dataset, type ViewSpec } from "@lasso/spec";
import type { Config } from "../config.js";
import { createMcpServer, ROUTING, type McpContext } from "../mcp/server.js";
import { contextText, type ChatContext } from "./context.js";

/**
 * Lassos egen chat (docs/chat.md): Claude via Claude Platform med NØJAGTIG de samme værktøjer og
 * instruktioner som /mcp. Chatten forbinder sig til en MCP-server i processen (InMemoryTransport),
 * så værktøjernes beskrivelser, validering og svar er de samme som i Claude.ai; visningerne
 * (spec + datasæt) sendes til browseren som "view"-hændelser, modellen får kun teksten.
 */

/** Hændelserne, /api/chat streamer til browseren (én JSON pr. SSE-besked). */
export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; title: string }
  | { type: "view"; id: string; name: string; spec: ViewSpec; dataset: Dataset; pdfLink?: string }
  | { type: "tool_error"; id: string; name: string; message: string }
  | { type: "done"; history: BetaMessageParam[] }
  | { type: "error"; message: string };

/** Ét kald til modellen; streamer teksten med onText og giver den færdige besked. Udskiftes i test. */
export type ModelCall = (params: MessageCreateParamsNonStreaming, onText: (delta: string) => void, signal?: AbortSignal) => Promise<BetaMessage>;

export function anthropicModelCall(apiKey: string): ModelCall {
  const client = new Anthropic({ apiKey });
  return async (params, onText, signal) => {
    const stream = client.beta.messages.stream(params, { signal });
    stream.on("text", onText);
    return stream.finalMessage();
  };
}

/**
 * Chattens egne regler (docs/chat.md), efter MCP-routingen (mcp/server.ts ROUTING). Hvert spørgsmål
 * besvares i den aktive kontekst ([Kontekst] først i brugerens tur); et skift til en anden fane sker
 * kun gennem valgmenuen (ask_choice, chat/tools.ts), som brugeren selv vælger i.
 */
export const CHAT_RULES = `Du er Lassos assistent i Lassos egen chat (portalen). Svar på dansk.

Kontekst:
- Brugerens tur begynder med [Kontekst]: den fane, brugeren står på (en virksomhed, en person eller forsiden/et resultat = globalt), de åbne faner og evt. det, brugeren lige valgte i en menu. Svar altid i den aktive kontekst. Svar direkte, når spørgsmålet tydeligt bliver dér: "Hvad laver Jakob ellers?" på LASSO X A/S besvares med show_person/render_view om Jakob, vist her, i LASSO X's chat.
- Kald ask_choice først, uden nogen visning, når spørgsmålet lægger op til en anden kontekst (en anden persons eller virksomheds side: "vis alt om Jakob", "åbn X"; eller en global liste, analyse eller sammenligning, mens brugeren står på en side), eller når et navn er tvetydigt. Naturlige punkter: a) "Alt om Jakob Benediktson" (placement entity, focus overblik, prompt "Vis alt om Jakob Benediktson (CVR-3-…)"), b) "Overordnet indblik her" (placement current, prompt "Giv et kort overblik over Jakob Benediktson her"); fritekst ("Andet") lægger appen selv til. Flere match: ét punkt pr. kandidat (entity) + fritekst. Hent id'erne med find_entity, før du kalder ask_choice; kald aldrig show_person med et fornavn alene.
- På forsiden (global) besvares lister og analyser direkte, uden menu.
- Efter et valg står det i [Kontekst]: gør det i ét trin (show_person/show_company med show_all for "Alt om", kort tekst og evt. ét modul for "Overordnet").
- Spørger brugeren om noget andet i stedet for at vælge (intet valg i konteksten), så besvar det nye spørgsmål her.

Svar:
- Et svar kan være tekst, en eller flere visninger, eller begge dele ("Jakob har 4 firmaer …" og et ejerdiagram via render_view med én komponent), eller en hel side (show_*, eller render_view med layout "page"). Appen viser visningerne under din tekst i den rækkefølge, de kommer.
- Teksten er kort og almindelig: **fed**, punktlister og links er tilladt, ingen overskrifter, ingen tabeller. Skriv aldrig tekstkortet, aldrig links til visningen og aldrig HTML/CSS. Gentag ikke tallene fra visningen.
- Beløb angives i hele kroner (10 mio. = 10000000).`;

/**
 * Det, der afhænger af modellen. Haiku 4.5 kender hverken effort eller fallbacks (400), så de sendes kun
 * til de større modeller: effort styrer tænkningen, og afviser modellen et svar (sikkerhedsfiltrene),
 * prøver Claude Platform selv en anden model (fallbacks "default").
 */
export function modelOptions(config: Pick<Config, "CHAT_MODEL" | "CHAT_EFFORT">): Partial<MessageCreateParamsNonStreaming> {
  if (config.CHAT_MODEL.startsWith("claude-haiku")) return {};
  return { output_config: { effort: config.CHAT_EFFORT }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}

/** Så mange modelkald må ét brugerspørgsmål bruge (værktøj → svar → evt. rettelse). */
export const MAX_STEPS = 6;

interface ToolDef {
  tool: BetaTool;
  title: string;
}

/** Forbinder en klient til en frisk MCP-server for brugeren (samme som én /mcp-request). */
async function connect(ctx: McpContext): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createMcpServer(ctx);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "lasso-chat", version: "0.1.0" });
  await server.connect(serverSide);
  await client.connect(clientSide);
  return {
    client,
    close: async () => {
      await client.close().catch(() => {});
      await server.close().catch(() => {});
    },
  };
}

/** MCP-værktøjerne som Claude-værktøjer. App-interne værktøjer (visibility ["app"], fx resolve_view) udelades. */
export async function chatTools(client: Client): Promise<ToolDef[]> {
  const { tools } = await client.listTools();
  return tools
    .filter((t) => {
      const visibility = (t._meta as { ui?: { visibility?: string[] } } | undefined)?.ui?.visibility;
      return !visibility || visibility.includes("model");
    })
    .map((t, i, all) => ({
      title: t.annotations?.title ?? t.title ?? t.name,
      tool: {
        name: t.name,
        description: t.description ?? "",
        input_schema: t.inputSchema as BetaTool["input_schema"],
        // Store specs (render_view) streames, mens de skrives; MCP-serveren validerer dem bagefter.
        eager_input_streaming: true,
        // Værktøjerne ændrer sig ikke mellem kald: cachen dækker dem og systemprompten.
        ...(i === all.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
      },
    }));
}

/** Teksten til modellen: værktøjets tekst uden tekstkortet (chatten viser altid visningen). */
export function textForModel(result: CallToolResult): string {
  return (result.content ?? [])
    .filter((c): c is { type: "text"; text: string } => c.type === "text" && !c.text.startsWith("Tekstkort:"))
    .map((c) => c.text)
    .join("\n");
}

export interface ChatRunOptions {
  ctx: McpContext;
  config: Pick<Config, "CHAT_MODEL" | "CHAT_EFFORT" | "CHAT_MAX_TOKENS">;
  model: ModelCall;
  /** Den hidtidige samtale (Claude-beskeder, uændret fra sidste "done"). */
  history: BetaMessageParam[];
  message: string;
  /** Den fane, brugeren står på, de åbne faner og et evt. valg fra menuen (chat/context.ts). */
  context: ChatContext;
  emit: (e: ChatEvent) => void;
  signal?: AbortSignal;
}

function apiErrorText(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "Claude har travlt lige nu. Prøv igen om lidt.";
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return "Chatten er ikke sat rigtigt op (Claude-nøglen blev afvist).";
  if (e instanceof Anthropic.BadRequestError) return "Samtalen kunne ikke fortsættes. Start en ny samtale.";
  if (e instanceof Anthropic.APIError) return `Claude svarede med fejl ${e.status ?? ""}. Prøv igen.`.replace("  ", " ");
  return "Der skete en fejl. Prøv igen.";
}

/**
 * Ét brugerspørgsmål: kald Claude, kør værktøjerne gennem MCP-serveren, giv svarene tilbage, og
 * gentag til Claude er færdig. Historikken udvides kun (beskederne ændres aldrig), så tænkeblokke
 * og cache holder mellem spørgsmålene.
 */
export async function runChat({ ctx, config, model, history, message, context, emit, signal }: ChatRunOptions): Promise<void> {
  // Konteksten står først i brugerens tur (ikke i system: den skifter pr. spørgsmål og ville bryde cachen).
  const messages: BetaMessageParam[] = [...history, { role: "user", content: [{ type: "text", text: contextText(context) }, { type: "text", text: message }] }];
  const { client, close } = await connect({ ...ctx, host: "chat" });
  try {
    const tools = await chatTools(client);
    const titles = new Map(tools.map((t) => [t.tool.name, t.title]));
    // Routingen deles med /mcp; reglerne er chattens egne (MCP_RULES gælder kun Claude.ai).
    const system = `${ROUTING}\n\n${CHAT_RULES}`;

    for (let step = 0; step < MAX_STEPS; step++) {
      let response: BetaMessage;
      try {
        response = await model(
          {
            model: config.CHAT_MODEL,
            max_tokens: config.CHAT_MAX_TOKENS,
            system,
            tools: tools.map((t) => t.tool),
            messages,
            cache_control: { type: "ephemeral" },
            ...modelOptions(config),
          },
          (text) => emit({ type: "text", text }),
          signal,
        );
      } catch (e) {
        if (signal?.aborted) return;
        console.error("[chat] Claude-fejl:", e instanceof Error ? e.message : e);
        emit({ type: "error", message: apiErrorText(e) });
        return;
      }
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "refusal") {
        emit({ type: "error", message: "Claude kunne ikke svare på det spørgsmål." });
        break;
      }
      if (response.stop_reason !== "tool_use") break;

      const uses = response.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
      for (const u of uses) emit({ type: "tool", id: u.id, name: u.name, title: titles.get(u.name) ?? u.name });
      // Alle værktøjssvar i én brugerbesked (parallelle kald), fejl som is_error.
      const results: BetaToolResultBlockParam[] = await Promise.all(
        uses.map(async (u): Promise<BetaToolResultBlockParam> => {
          let result: CallToolResult;
          try {
            result = (await client.callTool({ name: u.name, arguments: (u.input ?? {}) as Record<string, unknown> })) as CallToolResult;
          } catch (e) {
            const text = e instanceof Error ? e.message : String(e);
            emit({ type: "tool_error", id: u.id, name: u.name, message: text });
            return { type: "tool_result", tool_use_id: u.id, content: text, is_error: true };
          }
          const text = textForModel(result);
          if (result.isError) {
            emit({ type: "tool_error", id: u.id, name: u.name, message: text });
            return { type: "tool_result", tool_use_id: u.id, content: text || "Værktøjet fejlede.", is_error: true };
          }
          // Visninger til browseren; svar uden visning (save_view, describe_components …) kender kun modellen.
          const sc = result.structuredContent as { spec?: ViewSpec; pdfLink?: string } | undefined;
          const dataset = (result._meta as Record<string, unknown> | undefined)?.[DATASET_META_KEY] as Dataset | undefined;
          if (sc?.spec && dataset) emit({ type: "view", id: u.id, name: u.name, spec: sc.spec, dataset, ...(sc.pdfLink ? { pdfLink: sc.pdfLink } : {}) });
          return { type: "tool_result", tool_use_id: u.id, content: text || "OK" };
        }),
      );
      messages.push({ role: "user", content: results });
      if (step === MAX_STEPS - 1) emit({ type: "error", message: "Spørgsmålet krævede for mange trin. Prøv at stille det mere præcist." });
    }
    emit({ type: "done", history: messages });
  } finally {
    await close();
  }
}
