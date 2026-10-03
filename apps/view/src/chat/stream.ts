import type { Dataset, ViewSpec } from "@lasso/spec";

/**
 * Klienten til /api/chat (docs/chat.md). Rent modul uden React, så parseren kan testes i node.
 * Serveren streamer Server-Sent Events: én "data: <json>"-blok pr. hændelse.
 */
export const CHAT_API = "/api/chat";

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; title: string }
  | { type: "view"; id: string; name: string; spec: ViewSpec; dataset: Dataset; pdfLink?: string }
  | { type: "tool_error"; id: string; name: string; message: string }
  | { type: "done"; history: unknown[]; sig: string }
  | { type: "error"; message: string };

/** Samtalen, serveren gav sidst ("done"): sendes uændret med næste spørgsmål. */
export interface ChatState {
  history: unknown[];
  sig?: string;
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
  body: { message: string } & Partial<ChatState>,
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
