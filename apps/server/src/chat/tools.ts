import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { candidatesAsText, resolveEntity } from "../usecases/index.js";
import type { McpContext } from "../mcp/server.js";
import type { ChatContext } from "./context.js";

/**
 * Chattens egne værktøjer (docs/chat.md): de findes kun i Lassos chat, ikke i /mcp, og giver ingen visning.
 * find_entity finder kandidater til et navn; ask_choice viser brugeren en valgmenu (trin 5). De lægges efter
 * MCP-værktøjerne i fast rækkefølge, så værktøjslisten (og dermed prompt-cachen) er den samme fra kald til kald.
 */

export interface ChatToolCtx {
  mcp: McpContext;
  context: ChatContext;
}

export interface ChatToolResult {
  text: string;
  isError?: boolean;
}

export interface ChatToolDef {
  tool: BetaTool;
  title: string;
  run: (input: unknown, ctx: ChatToolCtx) => Promise<ChatToolResult>;
}

/** Et BetaTool fra et zod-skema (JSON Schema 2020-12 uden $schema-feltet). */
function toolOf(name: string, description: string, schema: z.ZodObject, extra: Partial<BetaTool> = {}): BetaTool {
  const { $schema: _drop, ...input_schema } = z.toJSONSchema(schema) as Record<string, unknown> & { $schema?: string };
  return { name, description, input_schema: input_schema as BetaTool["input_schema"], ...extra };
}

const findEntitySchema = z.object({
  kind: z.enum(["company", "person"]).describe("Virksomhed eller person."),
  query: z.string().min(1).max(120).describe("Navnet (eller en del af det), et CVR-nummer eller et Lasso-ID."),
  limit: z.number().int().min(1).max(10).optional().describe("Højst så mange kandidater. Standard 5."),
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

/** Chattens værktøjer i fast rækkefølge (prompt-cachen). */
export const CHAT_TOOLS: readonly ChatToolDef[] = [findEntity];

export const chatToolByName = (name: string): ChatToolDef | undefined => CHAT_TOOLS.find((t) => t.tool.name === name);
