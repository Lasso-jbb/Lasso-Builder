import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { BetaMessageParam, BetaToolUseBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { isPersonId } from "@lasso/spec";
import { isCompanyRef } from "../data/lookup.js";

/**
 * Chattens kontekst (docs/chat.md): hvilken fane brugeren står på, hvilke der er åbne, og det valg,
 * brugeren lige har truffet i en valgmenu (ask_choice). Hvert spørgsmål besvares i den aktive kontekst;
 * serveren skifter aldrig kontekst selv. Konteksten står som første tekstblok i brugerens tur, ikke i
 * systemprompten, fordi den skifter fra spørgsmål til spørgsmål (og ellers ville bryde cachen).
 */

/** Navnet på chattens valgmenu-værktøj (chat/tools.ts); verifyChoice leder efter det i historikken. */
export const ASK_CHOICE = "ask_choice";
/** Navnet på chattens placeringsværktøj (chat/tools.ts, chat/place.ts): modellen vælger fane, før noget vises. */
export const PLACE_ANSWER = "place_answer";

/**
 * De generiske navne på en ny resultatfane (docs/chat.md): faner hedder aldrig spørgsmålet. Samme liste står i
 * apps/view/src/chat/stream.ts (GLOBAL_TITLES); chat.e2e.test.ts tjekker, at de to er ens.
 */
export const GLOBAL_TITLES = ["Firmaliste", "Sammenligning", "Markedsanalyse", "Kort"] as const;
export type GlobalTitle = (typeof GLOBAL_TITLES)[number];

const entityBase = { id: z.string().min(1).max(40), name: z.string().min(1).max(200) };
/** Virksomheds-ID'er (CVR-1-…/CVR-nummer) og person-ID'er (CVR-3-…) valideres som i opslagene. */
const idFits = (e: { kind: "company" | "person"; id: string }) => (e.kind === "person" ? isPersonId(e.id) : isCompanyRef(e.id));

const entitySchema = z.object({ kind: z.enum(["company", "person"]), ...entityBase }).refine(idFits, { message: "id passer ikke til kind" });

export type ChatEntity = z.infer<typeof entitySchema>;

/** Det, brugeren ser på fanen: modulet og serverens resumé af dets data (samme tekst som værktøjssvarene giver modellen). */
export const VIEW_SUMMARY_MAX = 4000;
/** summary udelades med same: true, når klienten sendte præcis samme resumé tidligere i samtalen (historikken har det). */
const viewSchema = z
  .object({ module: z.string().min(1).max(40), summary: z.string().max(VIEW_SUMMARY_MAX).optional(), same: z.boolean().optional() })
  .refine((v) => v.summary !== undefined || v.same === true, { message: "summary eller same kræves" });

const activeSchema = z.union([
  z.object({ kind: z.enum(["company", "person"]), ...entityBase, tab: z.string().max(40).optional(), view: viewSchema.optional() }).refine(idFits, { message: "id passer ikke til kind" }),
  z.object({ kind: z.literal("global"), title: z.string().max(200).optional() }),
]);

/** Det, et valg i menuen gør: svaret skrives her (current), på en anden fane (entity) eller globalt. */
export const choiceActionSchema = z
  .object({
    placement: z.enum(["current", "entity", "global"]),
    entity: entitySchema.optional(),
    focus: z.string().max(40).optional(),
    prompt: z.string().max(4000).optional(),
    /** Fanens navn ved placement global: et af de generiske navne (GLOBAL_TITLES), aldrig spørgsmålet. */
    title: z.enum(GLOBAL_TITLES).optional(),
  })
  .refine((a) => a.placement !== "entity" || a.entity !== undefined, { message: "entity kræves ved placement entity" });

export type ChoiceAction = z.infer<typeof choiceActionSchema>;

/** place_answer's input (chat/tools.ts, chat/place.ts): hvor svaret skrives, valgt af modellen før noget vises. */
export const placeAnswerSchema = z
  .object({
    placement: z.enum(["current", "entity", "global"]).describe("current = svaret skrives her, på den aktive fane (standard). entity = på en anden persons eller virksomheds egen fane (kun når brugeren selv beder om det: 'vis alt om X', 'åbn X'). global = en liste, sammenligning eller analyse på en resultatfane."),
    entity: z
      .object({
        kind: z.enum(["company", "person"]).describe("Virksomhed eller person."),
        id: z.string().min(1).max(40).describe("Lasso-ID fra find_entity (højst 40 tegn)."),
        query: z.string().min(1).max(120).describe("Navnet, du søgte på med find_entity (højst 120 tegn)."),
      })
      .optional()
      .describe("Kun ved entity: den, fanen åbnes for."),
    focus: z.string().max(40).optional().describe("Kun ved entity: modulet, fx 'overblik' eller 'ejerskab'. Standard overblik."),
    title: z.enum(GLOBAL_TITLES).optional().describe("Kun ved global (kræves): fanens navn, et af de fire generiske navne, aldrig spørgsmålet."),
  })
  .refine((a) => a.placement !== "entity" || a.entity !== undefined, { message: "entity kræves ved placement entity" });

export type PlaceAnswerInput = z.infer<typeof placeAnswerSchema>;

/**
 * ask_choice's input (chat/tools.ts bruger det til validering; til API'et fjernes grænserne, se toolOf). Her,
 * fordi verifyChoice læser det gemte tool_use-input gennem samme skema (ukendte nøgler fra modellen fjernes).
 */
export const askChoiceSchema = z.object({
  question: z.string().min(1).max(200).describe("Spørgsmålet over punkterne, fx 'Hvilken Jakob mener du?' (højst 200 tegn)."),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(80).describe("Punktets korte titel: ved flere match navnet, fx 'Jakob Benediktson' (højst 80 tegn)."),
        description: z.string().min(1).max(160).describe("Én linje under titlen: ved flere match personens rolle, alder, by og virksomheder (højst 160 tegn)."),
        recommended: z.boolean().optional().describe("Det anbefalede punkt (højst ét; stil det først i listen)."),
        action: choiceActionSchema.describe("placement: 'current' = svaret skrives her, 'entity' = på personens/virksomhedens egen fane (entity kræves, med id fra find_entity), 'global' = en liste/analyse uden fane. focus: modulet, fx 'overblik' eller 'ejerskab'. prompt: beskeden, appen sender, når punktet vælges (standard: label). title: ved 'global' altid et af de fire generiske navne (Firmaliste, Sammenligning, Markedsanalyse, Kort), aldrig spørgsmålet."),
      }),
    )
    .min(1)
    .max(8)
    .refine((o) => o.filter((x) => x.recommended).length <= 1, { message: "højst ét punkt må være anbefalet" })
    .describe("1–8 punkter; det anbefalede først."),
  allowFreeText: z.boolean().optional().describe("Om brugeren også må skrive selv ('Andet'). Standard true."),
});

const choiceSchema = z.union([
  z.object({ id: z.string().min(1).max(80), index: z.number().int().min(0).max(7), action: choiceActionSchema }),
  z.object({ id: z.string().min(1).max(80), free: z.literal(true) }),
]);

export const chatContextSchema = z.object({
  active: activeSchema,
  open: z.array(entitySchema).max(20).default([]),
  /** Kun i turen lige efter en "choice"-hændelse. */
  choice: choiceSchema.optional(),
});

/** Konteksten efter validering; label sættes af verifyChoice (menupunktets tekst). */
export type ChatContext = Omit<z.infer<typeof chatContextSchema>, "choice"> & {
  choice?: z.infer<typeof choiceSchema> & { label?: string };
};

/** Uden kontekst (Bearer-kald, /chat) svares der globalt. */
export const GLOBAL_CONTEXT: ChatContext = { active: { kind: "global" }, open: [] };

/** Parser body.context; undefined = global. null ved ugyldig kontekst. */
export function parseContext(raw: unknown): ChatContext | null {
  if (raw === undefined) return { ...GLOBAL_CONTEXT, open: [] };
  const r = chatContextSchema.safeParse(raw);
  return r.success ? r.data : null;
}

function askChoiceUse(history: readonly BetaMessageParam[], id: string): BetaToolUseBlock | null {
  const last = [...history].reverse().find((m) => m.role === "assistant");
  if (!last || !Array.isArray(last.content)) return null;
  const use = last.content.find((b): b is BetaToolUseBlock => b.type === "tool_use" && b.id === id && b.name === ASK_CHOICE);
  return use ?? null;
}

/**
 * Om valget hører til samtalen: den seneste assistentbesked i den signerede historik skal have et
 * ask_choice-kald med det id, og handlingen skal være præcis den, modellen gav det valgte punkt. Det gemte input
 * læses gennem askChoiceSchema (ukendte nøgler, modellen har lagt til, fjernes), så en sådan menu ikke giver 400 ved
 * hvert valg. Giver menupunktets tekst (label) til konteksten, eller en fejl.
 */
export function verifyChoice(history: readonly BetaMessageParam[], choice: NonNullable<ChatContext["choice"]>): { label?: string } | { error: string } {
  const mismatch = { error: "Valget passer ikke til samtalen" };
  const use = askChoiceUse(history, choice.id);
  if (!use) return mismatch;
  const input = askChoiceSchema.safeParse(use.input ?? {});
  if (!input.success) return mismatch;
  if ("free" in choice) return input.data.allowFreeText === false ? mismatch : {};
  const option = input.data.options[choice.index];
  if (!option || !isDeepStrictEqual(option.action, choice.action)) return mismatch;
  return { label: option.label };
}

/** Tekst fra klienten og fra Lasso til modellen: linjeskift og styretegn bliver til mellemrum, så den ikke kan lave nye linjer i konteksten. */
export const oneLine = (t: string): string => t.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();

const entityText = (e: ChatEntity) => `${e.kind === "company" ? "virksomheden" : "personen"} ${oneLine(e.name)} (${oneLine(e.id)})`;

/** Konteksten, som modellen får den: første tekstblok i brugerens tur. */
export function contextText(ctx: ChatContext): string {
  const lines: string[] = [];
  const a = ctx.active;
  const choice = ctx.choice;
  const picked = choice && !("free" in choice) ? choice.action : undefined;
  const quoted = choice?.label ? `'${oneLine(choice.label)}'` : "et punkt i menuen";
  if (picked?.placement === "entity" && picked.entity) {
    lines.push(`Brugeren valgte ${quoted}: svaret skrives på ${entityText(picked.entity)}${picked.focus ? `, modul ${oneLine(picked.focus)}` : ""}. Den er den aktive kontekst i dette svar.`);
  } else if (picked?.placement === "global") {
    lines.push(`Brugeren valgte ${quoted}: svaret er globalt (liste/analyse), ikke på en fane.`);
  } else if (picked?.entity) {
    lines.push(`Brugeren valgte ${quoted}: svaret handler om ${entityText(picked.entity)} og skrives her, på den aktive fane (ingen ny fane).`);
  } else if (picked) {
    lines.push(`Brugeren valgte ${quoted}: svaret skrives her, på den aktive fane${picked.focus ? ` (modul ${oneLine(picked.focus)})` : ""}.`);
  } else if (choice) {
    lines.push("Brugeren skrev selv et svar i valgmenuen (fritekst) i stedet for at vælge et punkt.");
  }
  if (a.kind === "global") lines.push(a.title ? `Aktiv fane: resultatet '${oneLine(a.title)}' (globalt, ingen virksomhed eller person).` : "Aktiv fane: forsiden (global, ingen virksomhed eller person er åben).");
  else {
    lines.push(`Aktiv fane: ${entityText(a)}${a.tab ? `, modul ${oneLine(a.tab)}` : ""}.`);
    // Det tredje lag i konteksten (docs/chat.md): hvad brugeren ser, så "hvorfor faldt den?" kan besvares ud fra tallene på skærmen.
    if (a.view?.same) lines.push(`Brugeren ser: ${oneLine(a.view.module)} (uændret siden sidst).`);
    else if (a.view?.summary) lines.push(`Brugeren ser: ${oneLine(a.view.module)} — ${oneLine(a.view.summary)}`);
  }
  // De åbne faner står ikke i teksten til modellen: serveren bruger context.open deterministisk (find_entity, place_answer).
  return `[Kontekst] ${lines.join(" ")}`;
}

/**
 * Om det fulde "Brugeren ser"-resumé for den aktive fane og modulet stadig står i en bevaret brugerbesked (som
 * contextText skriver det: "… (<id>), modul <m>. Brugeren ser: <m> — …"). Efter en trimning kan det være væk.
 */
export function summaryRetained(messages: readonly BetaMessageParam[], ctx: ChatContext): boolean {
  const a = ctx.active;
  if (a.kind === "global" || !a.view) return false;
  const id = `(${oneLine(a.id)})`;
  const line = `Brugeren ser: ${oneLine(a.view.module)} — `;
  return messages.some((m) => m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b.type === "text" && b.text.startsWith("[Kontekst]") && b.text.includes(id) && b.text.includes(line)));
}

/** Konteksten uden et same, hvis resuméet ikke længere står i historikken: så skrives ingen "Brugeren ser"-linje i denne tur. */
export function withoutStaleSame(ctx: ChatContext, messages: readonly BetaMessageParam[]): ChatContext {
  const a = ctx.active;
  if (a.kind === "global" || !a.view?.same || summaryRetained(messages, ctx)) return ctx;
  const { view: _drop, ...active } = a;
  return { ...ctx, active };
}

/** Hvor svaret skrives (docs/chat.md): valgt af brugeren i menuen, ellers her. Serveren bærer det kun. */
export interface Placement {
  placement: "current" | "entity" | "global";
  target?: ChatEntity;
  focus?: string;
  /** Kun global: navnet på den nye resultatfane (fra valget eller place_answer; ellers sætter agent.ts et fra visningen). */
  title?: string;
  /** Modellen har valgt placeringen med place_answer (første hændelse er kun serverens forslag). */
  decided?: true;
  /** Kun current: modellen valgte at blive på fanen (klienten kan vise "svarer her"). */
  here?: true;
}

/** Placeringen for turen: valgets handling, ellers "current" (som på forsiden/et resultat er globalt). */
export function placementOf(ctx: ChatContext): Placement {
  const action = ctx.choice && !("free" in ctx.choice) ? ctx.choice.action : undefined;
  if (action?.placement === "entity" && action.entity) return { placement: "entity", target: action.entity, ...(action.focus ? { focus: action.focus } : {}) };
  if (action?.placement === "global") return { placement: "global", ...(action.title ? { title: action.title } : {}) };
  // current med en entity: svaret handler om den valgte, men skrives her (ingen ny fane).
  if (ctx.active.kind === "global") return { placement: "global" };
  return { placement: "current", ...(action?.focus ? { focus: action.focus } : {}) };
}
