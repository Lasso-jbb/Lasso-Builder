import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { candidatesAsText, resolveEntity } from "../usecases/index.js";
import type { McpContext } from "../mcp/server.js";
import { ASK_CHOICE, askChoiceSchema, type ChatContext, type ChoiceAction } from "./context.js";

export interface ChoiceOption {
  label: string;
  action: ChoiceAction;
}

/**
 * Chattens egne værktøjer (docs/chat.md): de findes kun i Lassos chat, ikke i /mcp, og giver ingen visning.
 * find_entity finder kandidater til et navn; ask_choice viser brugeren en valgmenu (trin 5). De lægges efter
 * MCP-værktøjerne i fast rækkefølge, så værktøjslisten (og dermed prompt-cachen) er den samme fra kald til kald.
 */

export interface ChatToolCtx {
  mcp: McpContext;
  context: ChatContext;
}

/** Valgmenuen, som "choice"-hændelsen sender til browseren. */
export interface ChoiceMenu {
  id: string;
  question: string;
  options: ChoiceOption[];
  allowFreeText: boolean;
}

export interface ChatToolResult {
  text: string;
  isError?: boolean;
  /** Kun ask_choice: menuen, der skal vises (agent.ts afslutter turen med den). */
  choice?: Omit<ChoiceMenu, "id">;
}

export interface ChatToolDef {
  tool: BetaTool;
  title: string;
  run: (input: unknown, ctx: ChatToolCtx) => Promise<ChatToolResult>;
}

/** Nøgleord, Anthropics strict tool use ikke understøtter; de fjernes fra det skema, der sendes til API'et. */
const UNSUPPORTED_SCHEMA_KEYS = new Set(["minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "pattern", "format"]);

/** JSON Schema uden de nøgleord, strict tool use afviser (rekursivt). Grænserne står i beskrivelserne og tjekkes af zod i run(). */
export function stripUnsupported<T>(schema: T): T {
  if (Array.isArray(schema)) return schema.map(stripUnsupported) as T;
  if (schema && typeof schema === "object") {
    return Object.fromEntries(Object.entries(schema).filter(([k]) => !UNSUPPORTED_SCHEMA_KEYS.has(k)).map(([k, v]) => [k, stripUnsupported(v)])) as T;
  }
  return schema;
}

/** Et BetaTool fra et zod-skema (JSON Schema 2020-12 uden $schema-feltet og uden grænser, som strict tool use ikke kender). */
function toolOf(name: string, description: string, schema: z.ZodObject, extra: Partial<BetaTool> = {}): BetaTool {
  const { $schema: _drop, ...input_schema } = stripUnsupported(z.toJSONSchema(schema)) as Record<string, unknown> & { $schema?: string };
  return { name, description, input_schema: input_schema as BetaTool["input_schema"], ...extra };
}

const findEntitySchema = z.object({
  kind: z.enum(["company", "person"]).describe("Virksomhed eller person."),
  query: z.string().min(1).max(120).describe("Navnet (eller en del af det), et CVR-nummer eller et Lasso-ID (højst 120 tegn)."),
  limit: z.number().int().min(1).max(10).optional().describe("Højst så mange kandidater, 1–10. Standard 5."),
});

export const FIND_ENTITY = "find_entity";

const findEntity: ChatToolDef = {
  title: "Find person eller virksomhed",
  tool: toolOf(
    FIND_ENTITY,
    "Finder kandidater til et navn, før du kalder ask_choice eller show_person/show_company: id, navn og detaljer (by, CVR, status) pr. linje, uden at vise noget for brugeren. De åbne faner i konteksten tæller som præcise match og står først. Brug det, når et navn er tvetydigt eller kun et fornavn (\"Jakob\"), og kald aldrig show_person med et fornavn alene. Brug ikke search_persons/search_companies til det (de viser en tabel).",
    findEntitySchema,
  ),
  async run(raw, { mcp, context }) {
    const parsed = findEntitySchema.safeParse(raw);
    if (!parsed.success) return { text: `Ugyldigt input: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
    const input = parsed.data;
    const candidates = await resolveEntity(mcp, input, context.open);
    return { text: candidatesAsText(input.kind, input.query, candidates) };
  },
};

const askChoice: ChatToolDef = {
  title: "Spørg brugeren",
  tool: toolOf(
    ASK_CHOICE,
    "Viser brugeren en valgmenu og afslutter dit svar: brug det, når spørgsmålet lægger op til en anden kontekst end den aktive fane (en anden persons eller virksomheds side, eller en global liste/analyse fra en side), eller når et navn er tvetydigt (ét punkt pr. kandidat fra find_entity). Kald intet andet i samme svar: ingen visning, før brugeren har valgt. Brugerens valg kommer som næste besked med det valgte i [Kontekst]; gør så det, brugeren valgte, i ét trin.",
    askChoiceSchema,
    { strict: true },
  ),
  async run(raw) {
    const parsed = askChoiceSchema.safeParse(raw);
    if (!parsed.success) return { text: `Ugyldig valgmenu: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
    const { question, options, allowFreeText } = parsed.data;
    return {
      text: "Valget er vist for brugeren. Svaret kommer som næste besked med det valgte i konteksten; gør så det, brugeren valgte.",
      choice: { question, options, allowFreeText: allowFreeText ?? true },
    };
  },
};

/** Chattens værktøjer i fast rækkefølge (prompt-cachen). */
export const CHAT_TOOLS: readonly ChatToolDef[] = [findEntity, askChoice];

export const chatToolByName = (name: string): ChatToolDef | undefined => CHAT_TOOLS.find((t) => t.tool.name === name);
