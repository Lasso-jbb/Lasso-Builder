import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { candidatesAsText, resolveEntity, type EntityCandidate } from "../usecases/index.js";
import type { McpContext } from "../mcp/server.js";
import { ASK_CHOICE, askChoiceSchema, PLACE_ANSWER, placeAnswerSchema, type ChatContext, type ChoiceAction, type Placement } from "./context.js";
import { EXPLICIT_OPEN, verifyPlacement, type TurnState } from "./place.js";

/** Et punkt i menuen: titel, én linjes beskrivelse, evt. anbefalet, og handlingen (kun den er afgørende for placeringen). */
export interface ChoiceOption {
  label: string;
  description: string;
  recommended?: boolean;
  action: ChoiceAction;
}

/**
 * Chattens egne værktøjer (docs/chat.md): de findes kun i Lassos chat, ikke i /mcp, og giver ingen visning.
 * find_entity finder kandidater til et navn; ask_choice viser brugeren en valgmenu, når et navn er tvetydigt;
 * place_answer vælger, hvor svaret skrives (serveren kontrollerer valget, chat/place.ts). De lægges efter
 * MCP-værktøjerne i fast rækkefølge (place_answer sidst), så værktøjslisten (og dermed prompt-cachen) er den samme fra kald til kald.
 */

export interface ChatToolCtx {
  mcp: McpContext;
  context: ChatContext;
  /** Brugerens besked i turen (place_answer tjekker, om en anden fane er bedt om udtrykkeligt). */
  message: string;
  /** Turens tilstand: placeringen, om place_answer er kaldt, og om der er vist noget. */
  turn: TurnState;
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
  /** Kun place_answer: den kontrollerede placering (agent.ts sender den som "placement"-hændelse). */
  placement?: Placement;
  /** Kun ask_choice: det effektive input (efter omskrivningen af handlingerne), som gemmes i historikken, så valget kan bekræftes. */
  input?: unknown;
  /** Kun find_entity: kandidaterne (agent.ts kræver en valgmenu, når der er flere og modellen ikke afgør det). */
  candidates?: EntityCandidate[];
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
    return { text: candidatesAsText(input.kind, input.query, candidates), candidates };
  },
};

const askChoice: ChatToolDef = {
  title: "Spørg brugeren",
  tool: toolOf(
    ASK_CHOICE,
    "Viser brugeren en valgmenu og afslutter dit svar. Brug det kun, når et navn passer på flere (ét punkt pr. kandidat fra find_entity, den mest sandsynlige først og anbefalet), aldrig til at vælge placering eller indsigtsniveau. Kald intet andet i samme svar: ingen visning, før brugeren har valgt. Brugerens valg kommer som næste besked med det valgte i [Kontekst]; gør så det, brugeren valgte, i ét trin.",
    askChoiceSchema,
    { strict: true },
  ),
  async run(raw, ctx) {
    const parsed = askChoiceSchema.safeParse(raw);
    if (!parsed.success) return { text: `Ugyldig valgmenu: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
    const { question, options, allowFreeText } = parsed.data;
    // Skemaet tillader ét punkt (gamle menuer i historikken skal stadig kunne bekræftes, context.ts); en ny menu har mindst to.
    if (options.length < 2) return { text: "Ugyldig valgmenu: options: mindst 2 punkter (en menu er kun til flere match; ved ét match gør du det bare).", isError: true };
    // Brugeren bliver på fanen, medmindre vedkommende udtrykkeligt beder om at åbne: for et ikke-udtrykkeligt spørgsmål
    // ("Hvem er Prøve?") er menuen kun til at vælge, hvem der menes, og svaret skrives her om den valgte.
    let effective = options;
    if (!EXPLICIT_OPEN.test(ctx.message)) {
      if (ctx.context.active.kind !== "global" && options.some((o) => o.action.placement === "global")) {
        return { text: "Ugyldig valgmenu: en menu vælger kun mellem flere match; en global liste eller analyse hører ikke hjemme i den. Svar her.", isError: true };
      }
      effective = options.map((o) =>
        o.action.placement === "entity" && o.action.entity
          ? { ...o, action: { placement: "current" as const, entity: o.action.entity, ...(o.action.focus ? { focus: o.action.focus } : {}), prompt: `Fortæl om ${o.action.entity.name} (${o.action.entity.id}) her`.slice(0, 4000) } }
          : o,
      );
    }
    return {
      text: "Valget er vist for brugeren. Svaret kommer som næste besked med det valgte i konteksten; gør så det, brugeren valgte.",
      choice: { question, options: effective, allowFreeText: allowFreeText ?? true },
      input: { ...parsed.data, options: effective },
    };
  },
};

const placeAnswer: ChatToolDef = {
  title: "Vælg placering",
  tool: toolOf(
    PLACE_ANSWER,
    "Vælger, hvor svaret skrives, før du viser noget; kaldes højst én gang pr. spørgsmål og som det første. current (standard) = her, på den aktive fane: kald det, når spørgsmålet nævner en anden person eller virksomhed, men brugeren ikke har bedt om dens side. entity = den anden persons eller virksomheds egen fane, kun når brugeren skriver 'vis alt om X' eller 'åbn X' (id og navn fra find_entity; passer navnet på flere, brug ask_choice). global = en liste, sammenligning eller analyse på en resultatfane, med title (Firmaliste, Sammenligning, Markedsanalyse eller Kort). Serveren kontrollerer valget og svarer med en fejl, hvis det ikke holder.",
    placeAnswerSchema,
    { strict: true },
  ),
  async run(raw, ctx) {
    const parsed = placeAnswerSchema.safeParse(raw);
    if (!parsed.success) return { text: `Ugyldig placering: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
    const r = await verifyPlacement(parsed.data, ctx);
    if ("error" in r) return { text: r.error, isError: true };
    ctx.turn.placed = true;
    ctx.turn.placement = r.placement;
    return { text: "Placeringen er valgt. Vis nu svaret.", placement: r.placement };
  },
};

/** Chattens værktøjer i fast rækkefølge (prompt-cachen): place_answer sidst. */
export const CHAT_TOOLS: readonly ChatToolDef[] = [findEntity, askChoice, placeAnswer];

export const chatToolByName = (name: string): ChatToolDef | undefined => CHAT_TOOLS.find((t) => t.tool.name === name);
