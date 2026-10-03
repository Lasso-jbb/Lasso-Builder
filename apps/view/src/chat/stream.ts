import type { Dataset, ViewSpec } from "@lasso/spec";

/**
 * Klienten til /api/chat (docs/chat.md). Rent modul uden React, så parseren kan testes i node.
 * Serveren streamer Server-Sent Events: én "data: <json>"-blok pr. hændelse.
 */
export const CHAT_API = "/api/chat";

/** De generiske navne på en resultatfane (apps/server/src/chat/context.ts GLOBAL_TITLES): faner hedder aldrig spørgsmålet. */
export const GLOBAL_TITLES = ["Firmaliste", "Sammenligning", "Markedsanalyse", "Kort"] as const;

/**
 * Hvor svaret skrives (apps/server/src/chat/context.ts): først serverens forslag (brugerens valg i menuen, ellers her),
 * så evt. modellens valg med place_answer (decided). Et skifte af fane sker, når placement er entity, eller global fra en
 * fane, der ikke er global; højst én gang pr. tur, efter den første placement-hændelse.
 */
export interface Placement {
  placement: "current" | "entity" | "global";
  target?: ChatEntityRef;
  focus?: string;
  /** Kun global: navnet på resultatfanen (et af GLOBAL_TITLES; i done også et navn, serveren satte ud fra visningen). */
  title?: string;
  /** Modellen har valgt placeringen (place_answer). */
  decided?: true;
  /** Modellen valgte at blive på fanen (kun current). */
  here?: true;
}

/** "page" er en hel side (show_*, søgninger, render_view med layout page), "module" et enkelt element. */
export type ViewForm = "page" | "module";

export type ChatEvent =
  | ({ type: "placement" } & Placement)
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; title: string }
  | { type: "view"; id: string; name: string; /** MCP-værktøjets navn (render_view, show_company …). */ tool: string; form: ViewForm; spec: ViewSpec; dataset: Dataset; pdfLink?: string }
  | { type: "tool_error"; id: string; name: string; message: string }
  | { type: "choice"; id: string; question: string; options: ChoiceOption[]; allowFreeText: boolean }
  /** fresh: svaret er flyttet til en anden fane; history er kun denne tur og hører til den nye fane. */
  | { type: "done"; history: unknown[]; sig: string; placement: Placement; fresh?: true }
  | { type: "error"; message: string };

/** Samtalen, serveren gav sidst ("done"): sendes uændret med næste spørgsmål. */
export interface ChatState {
  history: unknown[];
  sig?: string;
}

/* ---------- kontekst (apps/server/src/chat/context.ts) ---------- */

export interface ChatEntityRef {
  kind: "company" | "person";
  id: string;
  name: string;
}

/** Det, et punkt i valgmenuen gør: svaret skrives her, på en anden fane (entity) eller globalt. */
export interface ChoiceAction {
  placement: "current" | "entity" | "global";
  entity?: ChatEntityRef;
  focus?: string;
  /** Beskeden, der sendes, når punktet vælges (ellers label). */
  prompt?: string;
  /** Ved global: fanens navn (højst 40 tegn). */
  title?: string;
}

export interface ChoiceOption {
  /** Punktets korte titel. */
  label: string;
  /** Én linje om, hvad man får. */
  description: string;
  /** Det anbefalede punkt (står først). */
  recommended?: boolean;
  action: ChoiceAction;
}

/** Brugerens valg i menuen, sendt med næste spørgsmål: et punkt (index + dets action) eller fritekst. */
export type ChoicePick = { id: string; index: number; action: ChoiceAction } | { id: string; free: true };

/** Den fane, brugeren står på, de åbne faner og et evt. valg. Serveren svarer altid i den aktive kontekst. */
/** Det, brugeren ser på fanen: modulet og serverens resumé af dets data (højst VIEW_SUMMARY_MAX tegn). */
export interface ChatViewContext {
  module: string;
  /** Udeladt, når same er sat: resuméet er det samme, som blev sendt tidligere i samtalen. */
  summary?: string;
  same?: boolean;
}

export interface ChatContext {
  active: (ChatEntityRef & { tab?: string; view?: ChatViewContext }) | { kind: "global"; title?: string };
  open: ChatEntityRef[];
  choice?: ChoicePick;
}

/** Deler en tekstbuffer i hele SSE-blokke; resten (en halv blok) gives tilbage til næste chunk. */
export function splitSse(buffer: string): { events: ChatEvent[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: ChatEvent[] = [];
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as ChatEvent);
    } catch {
      // En ødelagt blok springes over; resten af svaret vises stadig.
    }
  }
  return { events, rest };
}

export class ChatHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Sender ét spørgsmål og kalder onEvent for hver hændelse, til svaret er færdigt. */
export async function streamChat(
  body: { message: string; context?: ChatContext } & Partial<ChatState>,
  onEvent: (e: ChatEvent) => void,
  { signal, fetcher = (...a) => fetch(...a) }: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<void> {
  let res: Response;
  try {
    res = await fetcher(CHAT_API, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", accept: "text/event-stream", "x-lasso-portal": "1" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) return;
    throw new ChatHttpError(0, "Serveren kunne ikke nås. Tjek forbindelsen, og prøv igen.");
  }
  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ChatHttpError(res.status, json?.error || `Serveren svarede med fejl ${res.status}.`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const { events, rest } = splitSse(buffer + value);
    buffer = rest;
    for (const e of events) onEvent(e);
  }
  for (const e of splitSse(`${buffer}\n\n`).events) onEvent(e);
}
