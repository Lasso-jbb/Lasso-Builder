import { FOCUSES, isPersonFocus } from "@lasso/spec";
import { resolveEntity } from "../usecases/index.js";
import type { McpContext } from "../mcp/server.js";
import type { ChatContext, ChatEntity, PlaceAnswerInput, Placement } from "./context.js";

/**
 * Serverens kontrol af place_answer (docs/chat.md): modellen vælger, hvor svaret skrives, men serveren afgør, om valget
 * holder. Stay er standard; en anden fane kræver, at brugeren selv bad om den ("vis alt om X", "åbn X"), og at navnet
 * peger på præcis én person eller virksomhed. Uden for reglerne får modellen en fejl og kan rette (eller bruge ask_choice).
 */

/** Hvad der tæller som en udtrykkelig bøn om en anden fane: "vis (mig) alt/det hele", "se (mig) alt/det hele" og "åbn". */
export const EXPLICIT_OPEN = /\b(vis|se)( mig)? (alt|det hele)\b|(?<![\p{L}])åbn(?![\p{L}])/iu;

/** Turens tilstand, agent.ts og værktøjerne deler: placeringen (først forslaget, så det, modellen valgte), og hvad der er sket. */
export interface TurnState {
  placement: Placement;
  /** place_answer er lykkedes i denne tur (kaldes højst én gang). */
  placed: boolean;
  /** Der er vist en visning i denne tur (så er det for sent at vælge placering). */
  viewed: boolean;
}

export interface PlaceCtx {
  mcp: McpContext;
  context: ChatContext;
  /** Brugerens besked i denne tur (til EXPLICIT_OPEN). */
  message: string;
  turn: TurnState;
}

export type PlaceResult = { placement: Placement } | { error: string };

const fail = (error: string): PlaceResult => ({ error });

/** Modulet kun, hvis det findes for siden (ellers står fanen på Overblik). */
function focusFor(kind: "company" | "person", focus: string | undefined): string | undefined {
  if (!focus) return undefined;
  return kind === "person" ? (isPersonFocus(focus) ? focus : undefined) : (FOCUSES as readonly string[]).includes(focus) ? focus : undefined;
}

export async function verifyPlacement(input: PlaceAnswerInput, { mcp, context, message, turn }: PlaceCtx): Promise<PlaceResult> {
  if (turn.placed) return fail("Højst én fane pr. spørgsmål: place_answer er allerede kaldt i denne tur.");
  if (turn.viewed) return fail("Vælg placeringen, før noget vises: kald place_answer først, og vis så.");
  if (context.choice && !("free" in context.choice)) return fail("Brugeren har valgt i menuen, og valget er bindende: placeringen står fast. Gør det, brugeren valgte.");
  const active = context.active;

  if (input.placement === "current") {
    // På en person eller virksomhed: svaret står her. På forsiden/et resultat er "her" en resultatfane (global).
    if (active.kind !== "global") return { placement: { placement: "current", decided: true, here: true } };
    return { placement: active.title ? { placement: "current", decided: true } : { placement: "global", decided: true } };
  }

  if (input.placement === "global") {
    if (!input.title) return fail("title kræves ved global: vælg Firmaliste, Sammenligning, Markedsanalyse eller Kort.");
    if (active.kind === "global" && active.title) return { placement: { placement: "current", decided: true } };
    return { placement: { placement: "global", title: input.title, decided: true } };
  }

  // entity: kun efter en udtrykkelig bøn, og kun til præcis én kendt person eller virksomhed.
  if (!EXPLICIT_OPEN.test(message)) return fail("Åbn kun en anden fane, når brugeren udtrykkeligt beder om det ('vis alt om …', 'åbn …'). Svar ellers her: kald place_answer med current.");
  const e = input.entity!;
  if (active.kind !== "global" && active.id === e.id) return fail("Det er allerede den aktive fane: kald place_answer med current.");
  const open = context.open.find((o) => o.kind === e.kind && o.id === e.id);
  let target: ChatEntity | undefined = open;
  if (!target) {
    const found = await resolveEntity(mcp, { kind: e.kind, query: e.query, limit: 2 }, context.open);
    if (!found.length) return fail("Lasso fandt ingen, der passer på navnet. Spørg brugeren om et mere præcist navn.");
    const only = found.length === 1 ? found[0]! : undefined;
    if (!only || only.id !== e.id) return fail("Navnet passer på flere; kald ask_choice med kandidaterne.");
    target = { kind: only.kind, id: only.id, name: only.name };
  }
  const focus = focusFor(target.kind, input.focus);
  return { placement: { placement: "entity", target, ...(focus ? { focus } : {}), decided: true } };
}
