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

const entityBase = { id: z.string().min(1).max(40), name: z.string().min(1).max(200) };
/** Virksomheds-ID'er (CVR-1-…/CVR-nummer) og person-ID'er (CVR-3-…) valideres som i opslagene. */
const idFits = (e: { kind: "company" | "person"; id: string }) => (e.kind === "person" ? isPersonId(e.id) : isCompanyRef(e.id));

const entitySchema = z.object({ kind: z.enum(["company", "person"]), ...entityBase }).refine(idFits, { message: "id passer ikke til kind" });

export type ChatEntity = z.infer<typeof entitySchema>;

/** Det, brugeren ser på fanen: modulet og serverens resumé af dets data (samme tekst som værktøjssvarene giver modellen). */
export const VIEW_SUMMARY_MAX = 4000;
const viewSchema = z.object({ module: z.string().min(1).max(40), summary: z.string().max(VIEW_SUMMARY_MAX) });

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
  })
  .refine((a) => a.placement !== "entity" || a.entity !== undefined, { message: "entity kræves ved placement entity" });

export type ChoiceAction = z.infer<typeof choiceActionSchema>;

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

type ChoiceOption = { label?: string; action?: unknown };

function askChoiceUse(history: readonly BetaMessageParam[], id: string): BetaToolUseBlock | null {
  const last = [...history].reverse().find((m) => m.role === "assistant");
  if (!last || !Array.isArray(last.content)) return null;
  const use = last.content.find((b): b is BetaToolUseBlock => b.type === "tool_use" && b.id === id && b.name === ASK_CHOICE);
  return use ?? null;
}

/**
 * Om valget hører til samtalen: den seneste assistentbesked i den signerede historik skal have et
 * ask_choice-kald med det id, og handlingen skal være præcis den, modellen gav det valgte punkt.
 * Giver menupunktets tekst (label) til konteksten, eller en fejl.
 */
export function verifyChoice(history: readonly BetaMessageParam[], choice: NonNullable<ChatContext["choice"]>): { label?: string } | { error: string } {
  const use = askChoiceUse(history, choice.id);
  if (!use) return { error: "Valget passer ikke til samtalen" };
  const input = (use.input ?? {}) as { options?: ChoiceOption[]; allowFreeText?: boolean };
  if ("free" in choice) {
    if (input.allowFreeText === false) return { error: "Valget passer ikke til samtalen" };
    return {};
  }
  const option = Array.isArray(input.options) ? input.options[choice.index] : undefined;
  if (!option || !isDeepStrictEqual(option.action, choice.action)) return { error: "Valget passer ikke til samtalen" };
  return typeof option.label === "string" ? { label: option.label } : {};
}

const entityText = (e: ChatEntity) => `${e.kind === "company" ? "virksomheden" : "personen"} ${e.name} (${e.id})`;

/** Konteksten, som modellen får den: første tekstblok i brugerens tur. */
export function contextText(ctx: ChatContext): string {
  const lines: string[] = [];
  const a = ctx.active;
  const choice = ctx.choice;
  const picked = choice && !("free" in choice) ? choice.action : undefined;
  const quoted = choice?.label ? `'${choice.label}'` : "et punkt i menuen";
  if (picked?.placement === "entity" && picked.entity) {
    lines.push(`Brugeren valgte ${quoted}: svaret skrives på ${entityText(picked.entity)}${picked.focus ? `, modul ${picked.focus}` : ""}. Den er den aktive kontekst i dette svar.`);
  } else if (picked?.placement === "global") {
    lines.push(`Brugeren valgte ${quoted}: svaret er globalt (liste/analyse), ikke på en fane.`);
  } else if (picked) {
    lines.push(`Brugeren valgte ${quoted}: svaret skrives her, på den aktive fane${picked.focus ? ` (modul ${picked.focus})` : ""}.`);
  } else if (choice) {
    lines.push("Brugeren skrev selv et svar i valgmenuen (fritekst) i stedet for at vælge et punkt.");
  }
  if (a.kind === "global") lines.push(a.title ? `Aktiv fane: resultatet '${a.title}' (globalt, ingen virksomhed eller person).` : "Aktiv fane: forsiden (global, ingen virksomhed eller person er åben).");
  else {
    lines.push(`Aktiv fane: ${entityText(a)}${a.tab ? `, modul ${a.tab}` : ""}.`);
    // Det tredje lag i konteksten (docs/chat.md): hvad brugeren ser, så "hvorfor faldt den?" kan besvares ud fra tallene på skærmen.
    if (a.view?.summary) lines.push(`Brugeren ser: ${a.view.module} — ${a.view.summary}`);
  }
  if (ctx.open.length) lines.push(`Åbne faner: ${ctx.open.map((e) => `${e.name} (${e.id})`).join(", ")}.`);
  return `[Kontekst] ${lines.join(" ")}`;
}
