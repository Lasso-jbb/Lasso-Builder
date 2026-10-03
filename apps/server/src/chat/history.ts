import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

/**
 * Historikken trimmes på serveren (docs/chat.md): klienten sender den signerede historik uændret, og over
 * CHAT_HISTORY_MAX_CHARS kastes de ældste hele ture (spørgsmål + svar + værktøjsskifte), så et tool_result
 * aldrig står uden sit tool_use. Trimningen er sjælden og grov (ned til ca. 60 % af grænsen i ét hug), så
 * prompt-cachen ikke nulstilles ved hvert spørgsmål; den trimmede liste er den, "done" giver og signerer.
 */

/** Så meget af grænsen beholdes, når der trimmes (hysterese). */
export const TRIM_KEEP_RATIO = 0.6;

const size = (m: BetaMessageParam): number => JSON.stringify(m).length;

/** En brugerbesked, der er et spørgsmål (ikke værktøjssvar): dér begynder en tur. */
export function startsTurn(m: BetaMessageParam): boolean {
  return m.role === "user" && !(Array.isArray(m.content) && m.content.some((b) => b.type === "tool_result"));
}

export function historyChars(messages: readonly BetaMessageParam[]): number {
  return messages.reduce((n, m) => n + size(m), 0);
}

/** Historikken uden de ældste ture, når den er over maxChars; den seneste tur beholdes altid. */
export function trimHistory(messages: readonly BetaMessageParam[], maxChars: number, keepRatio = TRIM_KEEP_RATIO): BetaMessageParam[] {
  let total = historyChars(messages);
  if (total <= maxChars) return [...messages];
  const target = maxChars * keepRatio;
  const starts = messages.map((m, i) => (startsTurn(m) ? i : -1)).filter((i) => i >= 0);
  let from = 0;
  for (let t = 1; t < starts.length && total > target; t++) {
    const next = starts[t]!;
    total -= historyChars(messages.slice(from, next));
    from = next;
  }
  return messages.slice(from);
}
